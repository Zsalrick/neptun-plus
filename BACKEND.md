# Kredit+ backend (előfizetés + ajánlói rendszer) — spec a website agentnek

Ez a dokumentum a **Kredit+ fizetős előfizetés + ajánlói (referral) rendszer** backendjét írja le.
Cél: a website agent fel tudja építeni a Cloudflare oldalt (infra + deploy), úgy, hogy az **app-oldal
(MAIN) API-igényeivel** tökéletesen illeszkedjen. Az API-szerződés itt van rögzítve — mindkét track
ehhez épít.

> Rövid üzleti cél: előfizetés (havi / féléves / éves), 14 napos ingyenes próba. Aki **ajánlói kóddal**
> regisztrál, 14 helyett **31 nap** próbát kap, és a **kód gazdája is +31 napot** kap. Fizetés és
> azonosítás a **Google Play Billing**-en keresztül, ezért **nincs saját jelszavas fiók**.

---

## 0. Csomagok / árazás (FONTOS — a website MINDHÁRMAT mutassa)

**Három előfizetési csomag van, nem csak a havi.** A weboldal és a Play Console is mindhármat
tartalmazza:

| Csomag | Számlázási időszak | Play base plan | Ár |
|---|---|---|---|
| Havi | 1 hónap (P1M) | `monthly` | **299 Ft / hó** |
| Féléves | 6 hónap (P6M) | `semester` | **1 615 Ft / félév** (−10%, kb. 269 Ft/hó) |
| Éves | 12 hónap (P1Y) | `yearly` | **2 691 Ft / év** (−25%, kb. 224 Ft/hó) |

- Ezek a **pontos árak, amiket az app onboarding csomagválasztója már mutat** (index.html `#ob-plans`):
  havi 299 Ft, féléves 1 615 Ft (−10%), éves 2 691 Ft (−25%). A weboldal ezekkel egyezzen.
- **Google Play felépítés:** EGY előfizetési termék (`kreditplus`), alatta **három base plan**
  (monthly / semester / yearly). A 6 hónap (P6M) és az 1 év (P1Y) is támogatott Play billing-időszak.
- A féléves/éves csomagnál mutasd a **megtakarítást** (−10% / −25%, illetve a havi egyenérték
  269 / 224 Ft/hó).
- Az app és a backend a base plan / product azonosítóból tudja, melyik csomag aktív; az entitlement
  szempontjából mindegy, a lejárati dátum (`play_until`) számít.

---

## 1. Felelősség-megosztás

**Website agent (te) — infra, web, deploy:**
- Domain + Cloudflare fiók, nameserverek, DNS.
- **Cloudflare Pages** a weboldalhoz (a website repóból, auto-deploy).
- **Cloudflare Email Routing** (hivatalos email a domainre).
- A **Cloudflare Worker + D1 projekt** felállítása és deploya (te vagy a Cloudflare-gazda): `wrangler`
  config, D1 adatbázis létrehozás, bindingok, **secretek**, route (`api.<domain>/*`).
- A weboldal designja, landing, jogi oldalak linkje.

**MAIN (én) — backend-logika + app-integráció:**
- A Worker **handler-kódja** (végpontok logikája), a **D1 séma** (`schema.sql`), a Google Play
  purchase-ellenőrzés és a jogosultság/ajánlói logika. Ezt átadom neked kész forrásként; te deployolod.
- Az **appba a Play Billing kliens** (natív, APK) és az entitlement-gate.

**Közös igazság = ez a fájl.** Ha az API változik, itt módosítjuk, és szólunk egymásnak.

Repo-kérdés: a Worker forrása **a te (website) repódban** éljen (te deployolsz). Én PR-ként / fájlként
adom a `worker/src/index.ts` + `worker/schema.sql` tartalmát; te bemásolod és deployolod. (Ha jobb egy
külön `neptun-plus-api` repó, az is mehet — akkor abba teszem.)

---

## 2. Architektúra dióhéjban

```
[Kredit+ app (Android)]
   | 1. induláskor: POST /v1/session  { installId, neptunHash, referralCode?, purchaseToken? }
   | 2. vásárlás után: ugyanaz purchaseToken-nel
   v
[Cloudflare Worker  api.<domain>/v1/*]
   |  - purchaseToken ellenőrzése a Google Play Developer API-val (service account)
   |  - jogosultság számítás (trial / bonus / play)  ->  D1
   |  - ajánlói jóváírás
   v
[Cloudflare D1 (SQLite)]   users, referrals
```

- **Nincs jelszavas fiók.** Az azonosítás a Play-vásárlásból + egy anonim install-id-ből + a
  **Neptun-kód hasheből** jön (utóbbi az anti-abuse horgony).
- A jogosultságot a **szerver** dönti el; a kliens csak cache-eli és kikényszeríti.

---

## 3. Cloudflare setup checklist (website agent)

1. **Domain** Cloudflare-re (Registrar vagy nameserver átállítás).
2. **Pages**: website repo bekötése, custom domain (`www` + apex), HTTPS.
3. **Email Routing**: `hello@<domain>` (vagy hasonló) → Gmail forward + küldés engedélyezése. Ez kell a
   Google dev fiókhoz és a supporthoz.
4. **D1 adatbázis**:
   ```
   wrangler d1 create neptunplus
   # a kapott database_id-t a wrangler.toml-ba
   wrangler d1 execute neptunplus --file=worker/schema.sql
   ```
5. **Worker**:
   - `wrangler.toml`: `name = "neptun-plus-api"`, `main = "src/index.ts"`, `compatibility_date`,
     `[[d1_databases]] binding = "DB" database_name = "neptunplus" database_id = "..."`.
   - Route: `api.<domain>/*` (vagy a Pages `/api/*` — de külön `api.` szub-domain a tisztább).
   - **Secretek** (`wrangler secret put NÉV`), soha nem a kódban:
     - `GOOGLE_SA_JSON` — a Google Cloud service account kulcs JSON-ja (Play Developer API-hoz).
     - `PLAY_PACKAGE` — `hu.neptun.autologin` (az app csomagneve).
     - `NEPTUN_HASH_PEPPER` — véletlen 32+ bájt; ezzel hash-eljük a Neptun-kódot (só/pepper).
     - (2. fázis) `RTDN_AUDIENCE` / Pub/Sub verifikációhoz.
6. Add meg nekem: a **végleges API base URL**-t (`https://api.<domain>/v1`) és erősítsd meg a binding
   nevét (`DB`). Ezt beégetem az appba.

---

## 4. D1 adatmodell (`schema.sql` — a végleges verziót én adom, ez a váz)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,      -- belső uuid
  neptun_hash   TEXT UNIQUE,           -- sha256(neptunCode|university|PEPPER) — erős identitás-horgony
  install_id    TEXT,                  -- app által generált uuid (újratelepítéskor változhat)
  code          TEXT UNIQUE,           -- ennek a usernek a SAJÁT ajánlói kódja
  referred_by   TEXT,                  -- milyen kódot használt (nullable)
  referral_done INTEGER DEFAULT 0,     -- a referral jóváírás megtörtént-e (0/1)
  lifetime      INTEGER DEFAULT 0,     -- 1 = ÖRÖKÖS prémium (tesztelők) — sose jár le
  trial_until   TEXT,                  -- ISO — a próbaidő vége
  bonus_until   TEXT,                  -- ISO — ajándék/ajánlói napok vége
  play_token    TEXT,                  -- utolsó ellenőrzött purchase token
  play_until    TEXT,                  -- ISO — Play előfizetés/próba vége
  play_state    TEXT,                  -- active | in_grace | canceled | expired | none
  created_at    TEXT,
  updated_at    TEXT
);
CREATE TABLE referrals (
  id            TEXT PRIMARY KEY,
  referrer_id   TEXT,                  -- users.id (kód gazdája)
  referred_id   TEXT,                  -- users.id (aki beírta)
  code          TEXT,
  granted       INTEGER DEFAULT 0,     -- kifizettük-e a +31 napot a gazdának
  created_at    TEXT,
  granted_at    TEXT
);
CREATE INDEX idx_users_code ON users(code);
CREATE INDEX idx_ref_referrer ON referrals(referrer_id);
```

**Jogosultság kiszámítása (szerver):**
```
premium = (lifetime === 1)                                 // tesztelők: örökös, sose jár le
          OR play_state ∈ {active,in_grace}
          OR max(trial_until, bonus_until, play_until) > now
premiumUntil = (lifetime === 1) ? "lifetime" : max(trial_until, bonus_until, play_until)
```

---

## 5. API-szerződés (v1)

Base: `https://api.<domain>/v1` · minden kérés/válasz **JSON**, `Content-Type: application/json`.
Az app natívan (CapacitorHttp) hívja, de a WebView-fetch útra is engedd a CORS-t:
`Access-Control-Allow-Origin: https://localhost, capacitor://localhost` (+ preflight OPTIONS).

Közös **identity** mezők (minden hívásban):
```jsonc
{
  "installId": "uuid-v4",           // app generálja, localStorage-ban tárolja
  "neptunHash": "hex64",            // az app számolja: sha256(neptunCode|university) — a PEPPER-t a szerver adja hozzá? lásd lent
  "appVersion": "v0.257",
  "platform": "android"
}
```
> Hash-elés: hogy a nyers Neptun-kód sose menjen ki, az app egy **elő-hasht** küld
> (`sha256(neptunCode|university)`), a szerver ezt pepperrel újra-hasheli tárolás előtt
> (`sha256(preHash|PEPPER)`). Így sem a hálózaton, sem a DB-ben nincs nyers azonosító.

### 5.1 `POST /v1/session` — fő végpont (induláskor + vásárlás után)
Kérés:
```jsonc
{
  "installId": "...", "neptunHash": "...", "appVersion": "...", "platform": "android",
  "referralCode": "ABC123",     // OPCIONÁLIS, csak ha a user beírt egyet és még nincs referred_by
  "purchaseToken": "...",       // OPCIONÁLIS, ha van Play-vásárlás
  "productId": "kreditplus_monthly"
}
```
Szerver teendő:
1. User keresése/létrehozása `neptun_hash` alapján (elsődleges), különben `install_id`.
2. **Új user** (most jött létre): `trial_until = now + 14 nap`, saját `code` generálása.
3. Ha `referralCode` van, érvényes, **nem a sajátja**, és a user még **új** (nincs `referred_by`):
   - a beíró próbája **31 napra** bővül (`trial_until = max(trial_until, now+31d)`),
   - `referred_by = referralCode`, `referrals` sor létrejön,
   - a **gazdának +31 nap** `bonus_until` (lásd 6. anti-abuse: mikor).
4. Ha `purchaseToken` van: **ellenőrzés a Google Play Developer API-val** (lásd 7.), majd
   `play_until` / `play_state` / `play_token` frissítése.
5. `premiumUntil`, `premium` kiszámítása, `updated_at` frissítése.

Válasz:
```jsonc
{
  "premium": true,
  "premiumUntil": "2026-11-14T00:00:00Z",
  "source": "trial",            // trial | bonus | play | none
  "code": "K7F2Q9",             // a user SAJÁT ajánlói kódja (ezt oszthatja meg)
  "referralApplied": true,      // most alkalmaztuk-e a beírt kódot
  "serverTime": "2026-10-14T09:00:00Z"
}
```

### 5.2 `POST /v1/redeem` — ajánlói kód beírása utólag (ha nem az első indításkor)
```jsonc
{ "installId":"...", "neptunHash":"...", "code":"ABC123" }
```
Válasz: mint a session `premium*` + `{ "ok": true|false, "reason": "invalid|self|already|ok" }`.

### 5.3 `GET /v1/referral` — a saját kód + statisztika
Kérés: identity mezők query-ben vagy POST-ként. Válasz:
```jsonc
{ "code":"K7F2Q9", "referredCount": 3, "bonusDaysEarned": 93 }
```

### 5.4 (2. fázis) `POST /v1/play/rtdn` — Google Real-time Developer Notifications
Pub/Sub push a megújulásokról/lemondásokról/visszatérítésekről → `play_until`/`play_state` frissítés,
visszatérítéskor a bónusz visszavonása. Nem kötelező az MVP-hez, de a helyes elszámoláshoz kell.

---

## 6. Ajánlói logika + anti-abuse

- **Kód formátum:** 6 karakter, félreérthető jelek nélkül (0/O, 1/I kihagyva). A szerver generálja,
  egyedi (`users.code UNIQUE`).
- **Új user jutalma** (31 napos próba): azonnal jár, ha a kód érvényes. (Kockázat alacsony, hisz még
  csak próbaidő.)
- **A gazda jutalma** (+31 nap): a **DÖNTÉSI PONT**. Ajánlott default: akkor írjuk jóvá, ha az ajánlott
  user **egyedi `neptun_hash`** (még nem láttuk) — a Neptun-kód a valós személy horgonya, egy ember nem
  tud vég nélkül álfiókot gyártani. Szigorúbb változat: csak akkor, ha az ajánlott usernek **valós Play
  próbája/előfizetése** aktiválódott (valódi Google-fiók + fizetési mód). → lásd Döntések.
- **Tiltások:** önajánlás (`code === saját`), duplikált beváltás (`referred_by` már megvan),
  visszamenőleges kód régi usernek (csak `created_at` közeli / még trial-ben lévő usernek).
- **Rate limit:** IP + `neptun_hash` alapon (pl. Cloudflare Rate Limiting vagy KV számláló).
- **2. fázis:** **Google Play Integrity API** az app-hívások hitelesítésére (hogy tényleg a valódi app
  hívja, ne egy szkript). Ez zárja le a farmolást igazán.

### Tesztelők → ÖRÖKÖS (lifetime) fiók
A tesztelők (a Play production előtti kb. 20 tesztelő, akik a website `tester-signup`-on / a Play
license-tesztelő listán vannak) **élethosszig tartó prémium fiókot** kapnak: `lifetime = 1`, sose jár
le, és nem kell fizetniük.
- **Mechanizmus (ajánlott, mert nincs saját login):** minden tesztelő kap egy **egyszer beváltható
  tesztelői kódot**, amit az appban beír (ugyanaz a `/v1/redeem` folyamat, csak a kód típusa „tester").
  Beváltáskor a szerver `lifetime = 1`-et állít az adott `neptun_hash`-re. A kódok listáját te tartod
  (kézzel kiadva a ~20 tesztelőnek), egyszer használhatók, `neptun_hash`-hez kötve.
- **Alternatíva:** ha a tesztelő Neptun-kódját előre ismered, közvetlenül is beállíthatod
  `lifetime = 1`-re a D1-ben. Play license-tesztelőként a tesztidőszakban amúgy sem fizet, de a
  `lifetime` biztosítja, hogy **élesben, örökre** is prémium maradjon.
- Fontos: a lifetime a Play-előfizetéstől független (a `premium` képlet első ága), így a tesztelőnek
  soha nem kell előfizetnie.

---

## 7. Google Play purchase-ellenőrzés (a Worker csinálja)

1. **Google Cloud projekt** + **service account**, hozzáférés a **Play Developer API**-hoz (a Play
   Console-ban linkelve). A kulcs JSON a `GOOGLE_SA_JSON` secret.
2. A Worker OAuth2 JWT-vel access tokent kér (`https://oauth2.googleapis.com/token`,
   scope `https://www.googleapis.com/auth/androidpublisher`).
3. Előfizetés lekérése:
   `GET androidpublisher/v3/applications/{PLAY_PACKAGE}/purchases/subscriptionsv2/tokens/{purchaseToken}`
   → `subscriptionState`, `lineItems[].expiryTime`, linkelt azonosítók. Ebből `play_until` + `play_state`.
4. Csak a **szerver** hisz a Play-nek; a kliens által küldött "premium" sosem megbízható.

---

## 8. App-oldal (amit MAIN csinál — hogy tudd a határt)

- `installId` generálás + tárolás; `neptunHash` számítás; `/v1/session` hívása induláskor és vásárlás
  után; az entitlement **cache-elése** (offline türelmi idő: ha a szerver elérhetetlen, az utolsó ismert
  jogosultság még N napig él, hogy offline se zárjuk ki a fizető usert).
- **Play Billing** kliens (natív, APK): előfizetés indítása, `purchaseToken` átadása a szervernek.
- Prémium-gate az appban (mely funkciók zártak próba/előfizetés nélkül).
- Ajánlói kód UI: saját kód mutatása/megosztása, kód beírása első indításkor.

---

## 9. Döntések, amikre válasz kell (jelöld meg a választ, vagy beszéljük meg)

1. **A gazda +31 napja mikor jár?** (a) azonnal, ha az ajánlott egyedi Neptun-identitás; (b) csak ha az
   ajánlottnak valós Play próbája/előfizetése aktiválódott. → *Ajánlásom: (a) MVP-re, (b) később Play
   Integrity-vel.*
2. **Van felső korlát** az ajánlásból szerezhető napokra? (pl. max 12 hónap). *Ajánlásom: igen, pl. 365 nap.*
3. **Trial hossz** kód nélkül: 14 nap, kóddal 31 nap — fix? *Igen, hacsak nem akarsz kampányt.*
4. **Előfizetés termék(ek):** rögzítve a §0-ban — EGY `kreditplus` termék, három base plan: monthly
   299 Ft, semester 1 615 Ft (−10%), yearly 2 691 Ft (−25%). Árak véglegesek (az app ezeket mutatja).
5. **API domain:** `api.<domain>` szub-domain vagy `/api/*` a Pages-en? *Ajánlásom: külön `api.` szub.*
6. **Tesztelői lifetime kód vs. előre beállított Neptun-kód?** *Ajánlásom: egyszer beváltható tesztelői
   kód (`/v1/redeem`, „tester" típus) → `lifetime=1`. Egyszerű, login nélkül működik.*

---

## 10. Sorrend (mit mikor)

1. (te) Domain → Cloudflare → Pages → Email Routing.
2. (te) Worker + D1 projekt váz felállítása (üres), route + secretek helye előkészítve.
3. (párhuzamosan, user) Google Play fejlesztői fiók + a 20 tesztelős folyamat indítása (ez a leglassabb).
4. (user) Google Cloud projekt + service account a Play API-hoz → `GOOGLE_SA_JSON`.
5. (MAIN) `worker/src/index.ts` + `schema.sql` átadása → (te) deploy.
6. (MAIN) Play Billing + entitlement az appba (APK).
7. Teszt end-to-end egy tesztelői fiókkal.

Kérdés/nem világos rész esetén írj a repo-ban, és frissítjük ezt a fájlt.

---

## 11. Email küldés (feliratkozás-megerősítés + tesztelő jelentkezés) — a WEBSITE Workerben

Ezt a website agent csinálja, mert a `/api/subscribe` és `/api/tester-signup` a website Workerében
(`kreditplus-web`) él (lásd a website infra memóriát).

**Fontos buktató:** a **Cloudflare Email Routing CSAK BEJÖVŐ** (forward a Gmailre). Kimenő tranzakciós
emailt (megerősítés) **nem tud küldeni**. Ahhoz külső tranzakciós email-API kell a Workerből `fetch`-csel.

### Szolgáltató: Resend (ajánlott)
- Cloudflare Workers-barát, egy `fetch` hívás, ingyenes keret (~100 email/nap, 3 000/hó) bőven elég az
  induláshoz. Alternatíva: Postmark, Brevo, SES. (A régi ingyenes MailChannels+Cloudflare út 2024-ben
  megszűnt, azt NE.)
- **Küldő cím:** `noreply@kreditplus.hu`. A Resendhez **`send.kreditplus.hu` aldomaint** verifikálj, így
  a gyökér MX (Email Routing bejövő) érintetlen marad.
- **DNS (Cloudflare):** a Resend által adott **DKIM** (CNAME/TXT), **SPF** (TXT) és egy **DMARC** (TXT,
  pl. `v=DMARC1; p=none; rua=mailto:...`). DKIM+SPF+DMARC nélkül spambe megy. Teszt: mail-tester.com.
- **Secret:** `RESEND_API_KEY` (Worker secret).

### Worker → Resend (vázlat)
```js
async function sendEmail(env, to, subject, html) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Kredit+ <noreply@kreditplus.hu>", to, subject, html }),
  });
}
```

### Feliratkozás = DUPLA opt-in
1. `POST /api/subscribe {email}` → `subscribers` sor `confirmed=0`, `token=uuid`.
2. `sendEmail(email, "Erősítsd meg a feliratkozást", ...)` egy linkkel:
   `https://kreditplus.hu/api/confirm?token=<token>`.
3. `GET /api/confirm?token=` → a sort `confirmed=1`-re állítja, és egy „Megerősítve" oldalt mutat.
   (GDPR + jobb kézbesíthetőség, kevesebb spam-panasz.)

### Tesztelő jelentkezés
1. `POST /api/tester-signup {email, neptunCode?}` → `testers` sor.
2. `sendEmail(email, "Köszönjük a jelentkezést", ...)`: köszönet + következő lépések. Tartalmazza, hogy
   **jóváhagyás után** felkerül a Google Play tesztelői listára, és **élethosszig tartó (lifetime)**
   prémiumot kap (lásd §6 Tesztelők). A Play-listára vétel + a **lifetime kód** kiadása kézi/utólagos
   (nem automatikus, hogy csak valódi tesztelők kapják).

### Copy szabály
Az email szövege is a DESIGN.md szerint: nincs gondolatjel (– —), tömör, magyar. Legyen benne
leiratkozási/adatkezelési lábléc (GDPR).
