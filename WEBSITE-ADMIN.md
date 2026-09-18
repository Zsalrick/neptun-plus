# admin.kreditplus.hu (leírás a website agentnek)

Cél: egy csak a tulajdonos számára elérhető admin felület, ahol látja és kezeli a hírlevél-feliratkozókat
és a tesztelő-jelentkezőket, letölti őket, és (2. fázisban) levelet küld nekik.

Nincs saját jelszó és nincs saját belépés-kód: a belépést a **Cloudflare Access** végzi. Ez a legfontosabb
szabály, mert az oldal személyes adatokat mutat.

---

## 0. A mostani állapot (erre épül)

- Repó: `website/` (Zsalrick/kreditplus-web), Worker: `kreditplus-web`, `src/index.js`, statikus assetek.
- D1: `kreditplus` (binding: `DB`). Séma: `website/schema.sql`. Mostani táblák:
  - `subscribers(id, email UNIQUE, name, university, neptun_url, created_at, source, unsub_token UNIQUE, unsubscribed_at)`
  - `testers(id, name, email UNIQUE, university, neptun_url, android, accepted_terms, created_at)`
- Meglévő végpontok: `POST /api/subscribe`, `POST /api/tester-signup`, `POST /api/unsubscribe`.
  **Ezekhez ne nyúlj**, az admin külön útvonalon él.

---

## 1. Hozzáférés: Cloudflare Access (kötelező, ez az első lépés)

A tulajdonos a Cloudflare irányítópulton állítja be (ezt nem lehet a kódból):

1. Zero Trust → Access → Applications → **Add an application → Self-hosted**.
2. Application domain: `admin.kreditplus.hu` (az egész aldomain, minden útvonal).
3. Policy: **Allow**, szabály: *Emails* = a tulajdonos Google-fiókjának címe. Senki más.
4. Bejelentkezési mód: **Google** (vagy „One-time PIN” e-mailben, ha a Google nincs beállítva).
5. Session duration: 24 óra.
6. Az Application oldalán kiírja az **AUD tag**-et és a csapat domainjét (`<csapat>.cloudflareaccess.com`).
   Ezt a kettőt Worker változóként add meg: `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`.

A Worker **ettől függetlenül is ellenőrizze** a belépést (kétszeres védelem), mert a Worker más úton is
elérhető lehet (pl. `*.workers.dev`):

- Minden `admin.kreditplus.hu` kérésnél olvasd a `Cf-Access-Jwt-Assertion` fejlécet.
- Ellenőrizd a JWT aláírását a `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` kulcsaival (RS256),
  az `aud` tartalmazza az `ACCESS_AUD`-ot, az `exp` ne járt le. A kulcsokat pár percig cache-elheted.
- Ha bármi nem stimmel: `403`, üres választörzs. Titok, adat nem szivároghat ki hibaüzenetben.
- A JWT `email` mezője a „ki csinálta” napló szereplője (lásd 3. pont).
- A `wrangler.jsonc`-ben kapcsold ki a `workers_dev` elérést (`"workers_dev": false`), hogy ne legyen
  kerülőút.

## 2. Útvonal és kiszolgálás

- Egy Worker marad (`kreditplus-web`), a `wrangler.jsonc` kapjon egy custom domaint:
  `admin.kreditplus.hu`.
- A Worker a `request.url` hostja alapján választ:
  - `kreditplus.hu`, `www.kreditplus.hu`: minden úgy megy, mint most.
  - `admin.kreditplus.hu`: CSAK az admin (Access-ellenőrzés után). A publikus oldal statikus fájljait
    innen ne szolgáld ki, és fordítva: a publikus hostról az `/admin` útvonal ne létezzen.
- Az admin felület maga egy statikus HTML+JS oldal (pl. `admin/index.html`, `admin/admin.js`), de a
  Worker adja ki, **nem** a publikus asset-kiszolgálás (különben `kreditplus.hu/admin/` alatt is
  elérhető lenne). Egyszerű megoldás: a fájlokat a Worker importálja szövegként, vagy tedd őket az
  `.assetsignore`-ba, és a Worker adja vissza őket admin hoston.
- Minden admin válasz fejlécei: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`,
  `Referrer-Policy: no-referrer`, szigorú `Content-Security-Policy` (csak saját script, nincs inline
  eval), `X-Frame-Options: DENY`.

## 3. Adatbázis bővítés (idempotens, a `schema.sql`-be is)

```sql
-- tesztelők kezelése
ALTER TABLE testers ADD COLUMN status TEXT NOT NULL DEFAULT 'new';   -- new | approved | invited | active | rejected
ALTER TABLE testers ADD COLUMN note TEXT;
ALTER TABLE testers ADD COLUMN updated_at TEXT;
ALTER TABLE testers ADD COLUMN invited_at TEXT;
-- feliratkozóknál csak megjegyzés
ALTER TABLE subscribers ADD COLUMN note TEXT;
-- ki mit csinált (adatvédelmi elszámoltathatóság)
CREATE TABLE IF NOT EXISTS admin_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  actor  TEXT NOT NULL,      -- az Access JWT email mezője
  action TEXT NOT NULL,      -- pl. tester.status, tester.delete, export.csv, subscriber.delete
  target TEXT                -- érintett sor azonosítója (id), NEM e-mail-cím
);
```

Élesre: `npx wrangler d1 execute kreditplus --remote --file <migráció>`. Előtte helyben próbáld ki
(`--local --persist-to <ideiglenes mappa>`).

## 4. Admin API (csak admin hoston, csak érvényes Access JWT-vel)

Minden válasz JSON. Személyes adat (e-mail, név) **soha ne kerüljön URL-be**: a keresés, szűrés POST
törzsben menjen, ne query stringben (a böngészőelőzmény és a naplók miatt).

| Végpont | Mit csinál |
|---|---|
| `POST /api/admin/testers/list` | törzs: `{ q, status, university, sort, page }` → `{ rows, total }`. 50 sor/oldal. `q` név, e-mail, egyetem részletére keres. |
| `POST /api/admin/testers/update` | törzs: `{ id, status?, note? }`. `status` csak a felsorolt értékek egyike. `updated_at` frissül, `invited`-nél `invited_at` is. Naplózás. |
| `POST /api/admin/testers/delete` | törzs: `{ id }`. Végleges törlés (kérésre törlés joga). Megerősítés a felületen. Naplózás. |
| `POST /api/admin/subscribers/list` | mint a tesztelőknél, plusz szűrő: `active` (nincs `unsubscribed_at`) vagy `unsubscribed`. |
| `POST /api/admin/subscribers/update` | `{ id, note }` |
| `POST /api/admin/subscribers/delete` | `{ id }`, naplózás |
| `GET /api/admin/stats` | számok: összes, új az elmúlt 7 napban, egyetemenként, státuszonként, napi bontás (30 nap). |
| `POST /api/admin/export` | törzs: `{ table: "testers" | "subscribers", filter }` → CSV letöltés (`Content-Disposition: attachment`), UTF-8 BOM-mal, hogy az Excel jól nyissa meg. Naplózás. |
| `POST /api/admin/testers/emails` | a kiválasztott vagy szűrt tesztelők e-mail-címei vesszővel elválasztva, a Google Play zárt tesztjéhez (lásd 6. pont). |

Minden SQL paraméteres (`.bind()`), string-összefűzés nincs. A `sort` csak egy engedélyezett oszloplista
eleme lehet.

## 5. A felület

Utilitarian admin, nem marketing oldal. Tartsd a weboldal sötét tokenjeit (bg `#0c0d0f`, surface
`#141518`, porcelán gomb `#e9e7e1`), Hanken betű, számok IBM Plex Mono. DESIGN.md szabályai itt is:
nincs gondolatjel (– —) a látható szövegben, nincs csillogás, színkódolás csak visszafogottan.
**Telefonon is használható legyen**, mert a tulajdonos sokszor onnan nézi.

- **Fejléc:** „Kredit+ admin”, jobb oldalt a belépett e-mail-cím (a JWT-ből), és egy kijelentkezés link:
  `/cdn-cgi/access/logout`.
- **Áttekintés:** 4 szám (tesztelők, ebből új; feliratkozók, ebből aktív), egyetemenkénti lista, 30 napos
  napi grafikon (egyszerű oszlopok).
- **Tesztelők fül:** kereső, szűrők (státusz, egyetem), táblázat: név, e-mail, egyetem, jelentkezés
  napja, státusz. Sorra koppintva oldalsó panel (telefonon teljes képernyő): minden adat, egyéni
  Neptun-cím ha van, státuszváltó, megjegyzés, Törlés (megerősítéssel). Tömeges kijelölés: státusz
  átállítása, e-mail-címek másolása.
- **Feliratkozók fül:** ugyanígy, státusz helyett aktív vagy leiratkozott.
- **Letöltés:** a szűrt lista CSV-ben.
- Üres állapotok értelmes szöveggel („Még nincs jelentkező”).

## 6. Tesztelők meghívása a Google Playre

A zárt teszthez a tesztelők e-mail-címét a Play Console-ban is fel kell venni, ezt az admin nem tudja
helyettesíteni. Amit ad: a jóváhagyott (`approved`) tesztelők címei egy gombbal vágólapra, vesszővel
elválasztva, amit a tulajdonos beilleszt a Play Console tesztelői listájába (vagy egy Google-csoportba).
Utána egy gombbal `invited` státuszra állíthatók.

## 7. 2. fázis: levél küldése az adminból (csak ha a levélküldő megvan)

Előfeltétel: eldöntött levélküldő (Cloudflare Email Service, ami Workers Paid csomagot kér, vagy Resend).
Addig ezt a részt ne építsd.

- Sablonok, fix szöveggel: „Bekerültél a tesztbe” (Play link), „Most betelt a keret”, hírlevél.
  A beküldött név és egyéb mező **ne** kerüljön a levélbe szó szerint (spam-visszaélés ellen), vagy csak
  szigorúan szűrve, hosszkorláttal.
- Tömeges küldés sorba téve (Queues vagy D1-es sor), percenként korlátozva, napi plafonnal.
- Hírlevél csak `unsubscribed_at IS NULL` címekre, minden levélben a saját leiratkozó link
  (`https://kreditplus.hu/leiratkozas/?t=<unsub_token>`) és `List-Unsubscribe` +
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` fejlécek.
- Válaszcím: `info@kreditplus.hu` (Email Routing a tulajdonos Gmailjére).
- Minden küldés naplózva (`admin_log`: ki, mikor, melyik sablon, hány címzett).

## 8. Adatvédelem

- Az adatkezelési tájékoztatóba (legal szál) kerüljön be: a jelentkezéseket a Kredit+ saját rendszerében
  kezeli, csak a tulajdonos fér hozzá, megőrzési idő (pl. tesztelőknél a teszt végéig + 6 hónap).
- Törlési kérésre a sor végleg törölhető az adminból (és a naplóban csak az id marad).
- CSV csak kérésre, és a felület figyelmeztessen: „A letöltött fájl személyes adatokat tartalmaz.”

## 9. Elfogadási feltételek (ezt teszteld, mielőtt élesbe megy)

1. `admin.kreditplus.hu` belépés nélkül: a Cloudflare Access belépő oldala jön, adat nem.
2. Hamis vagy hiányzó `Cf-Access-Jwt-Assertion` fejléccel közvetlenül a Workerre küldött kérés: `403`.
3. `kreditplus.hu/admin/`, `kreditplus.hu/api/admin/...`: `404`.
4. `*.workers.dev` cím: nem érhető el.
5. Lista, keresés, szűrés, státuszváltás, törlés, CSV működik, és mind bekerül az `admin_log`-ba.
6. Egyik URL-ben sincs e-mail-cím vagy név.
7. A publikus űrlapok (feliratkozás, tesztelő, leiratkozás) változatlanul működnek.
8. Telefonon (360 px széles) is használható.

Helyi teszthez: `wrangler dev` mellé egy kapcsoló (`ACCESS_DEV_BYPASS=1`, csak helyben, élesen soha),
ami egy fix teszt-e-mail-címmel engedi be a kéréseket. Éles `wrangler.jsonc`-be ez ne kerüljön be.

## 10. Sorrend

1. Access beállítása (tulajdonos) + JWT-ellenőrzés a Workerben + `workers_dev: false`.
2. Migráció (3. pont), helyben, majd élesen.
3. Admin API (4. pont) és a felület (5. pont), benne a Play-címlista (6. pont).
4. Tesztelés a 9. pont szerint, élesítés.
5. Később: 2. fázis (levélküldés), ha a levélküldő el van döntve.
