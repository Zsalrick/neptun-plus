# Partnerajánlatok: admin felület és nyilvános végpont (leírás a website agentnek)

**Cél:** az admin.kreditplus.hu-n partnerajánlatokat (pl. „Mateking: 15% kedvezmény”) lehessen felvenni, akár egyetemenként célozva. Az app a Kezdőlap alján, a belépősáv fölött mutatja őket, egy visszafogott, „Partnerajánlat” feliratú kártyán. Ha több van, vízszintesen lapozhatók.

**Az app oldala kész (v0.318, `www/js/promos.js`):**
- lekéri a nyilvános végpontot;
- csak a már érvényes, https linkes ajánlatokat mutatja;
- a tárgy szerinti célzást a telefonon dönti el;
- a felhasználó egy ajánlatot „Nem érdekel” gombbal elrejthet;
- 6 óránként kérdez újra (a válasz `ttl` mezője felülírja).

Amíg a végpont nincs kész, az appban egyszerűen nem jelenik meg semmi.

A meglévő admin rendszerre építs (WEBSITE-ADMIN.md: `src/admin.js`, `handleAdmin`, `adminEmail`, `log`, Access + `admins` tábla).

---

## 1. D1 táblák

```sql
CREATE TABLE IF NOT EXISTS promos (
  id          TEXT PRIMARY KEY,            -- rövid, URL-barát azonosító, pl. "mateking-2026-osz" (a /go/ linkben is ez)
  partner     TEXT NOT NULL,               -- "Mateking"
  title       TEXT NOT NULL,               -- legfeljebb 60 karakter
  text        TEXT,                        -- legfeljebb 160 karakter
  discount    TEXT,                        -- legfeljebb 40 karakter, pl. "15% kedvezmény"
  code        TEXT,                        -- kuponkód, nem kötelező, legfeljebb 30 karakter
  target_url  TEXT NOT NULL,               -- a partner oldala, CSAK https://
  cta         TEXT,                        -- a gomb szövege, alapból "Megnézem", legfeljebb 20 karakter
  unis        TEXT NOT NULL DEFAULT '[]',  -- JSON tömb egyetem-nevekkel; üres = minden egyetem
  subjects    TEXT NOT NULL DEFAULT '[]',  -- JSON tömb tárgy-kulcsszavakkal (nem kötelező), pl. ["matematika","analízis"]
  starts_at   TEXT NOT NULL,               -- ISO, alapból a létrehozás napja 00:00 (Budapest)
  ends_at     TEXT,                        -- ISO vagy NULL = visszavonásig
  active      INTEGER NOT NULL DEFAULT 1,  -- kézi ki- és bekapcsolás
  priority    INTEGER NOT NULL DEFAULT 0,  -- nagyobb = előrébb
  created_at  TEXT, updated_at TEXT, created_by TEXT
);
CREATE TABLE IF NOT EXISTS promo_stats (   -- napi összesítés, személyes adat NINCS benne
  promo_id TEXT NOT NULL, day TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (promo_id, day)
);
```

**Az egyetem-nevek** betűre azok legyenek, amiket az app küld: a fő repó `www/data/universities.js` listájának `name` mezői, pl. „Pannon Egyetem”. Az adminon ebből a listából lehessen választani, ne szabad szövegként.

## 2. Nyilvános végpontok (csak a `kreditplus.hu` hoston)

### `GET /api/promos?uni=<egyetem neve>&v=<app verzió>`

Csak azok az ajánlatok, amelyekre mind igaz:
- `active = 1`;
- `starts_at <= most`;
- az `ends_at` üres, vagy később van, mint most;
- az `unis` üres, vagy tartalmazza a kapott `uni` értéket.

Sorrend: `priority DESC, starts_at DESC`, legfeljebb 5.

```json
{ "ttl": 21600,
  "promos": [
    { "id": "mateking-2026-osz", "partner": "Mateking", "title": "Elakadtál matekból?",
      "text": "Videós magyarázatok minden egyetemi matek tárgyhoz, ZH-feladatokkal.",
      "discount": "15% kedvezmény", "code": "KREDITPLUS", "cta": "Megnézem",
      "url": "https://kreditplus.hu/go/mateking-2026-osz",
      "subjects": ["matematika", "analízis"],
      "from": "2026-09-19T00:00:00+02:00", "until": null } ] }
```

- Az **`url` MINDIG a saját `/go/<id>` linkünk**, nem a partner címe. Így számoljuk a kattintást, és a partner címe bármikor módosítható app-frissítés nélkül.
- A `views` számlálót itt növeld: minden visszaadott ajánlatnak +1 a mai napra. Ez közelítés (hány app-lekérés kapta meg), nem pontos megtekintés, és így jelezd az adminon is.
- A kérésből semmit ne tárolj (IP-t, verziót sem), csak a napi számlálót.
- Fejlécek:
  - `Cache-Control: public, max-age=600`;
  - `Access-Control-Allow-Origin: *` (az app natívan hívja, de a böngészős tesztekhez is kell).
- Ismeretlen vagy üres `uni` esetén csak a mindenkinek szóló ajánlatok jönnek vissza. Hiba esetén `{"ttl":3600,"promos":[]}`, 200-as kóddal.

### `GET /go/<id>`

- **302-es átirányítás** a `target_url`-re, és +1 kattintás a mai napra (`promo_stats`).
- Ismeretlen, kikapcsolt vagy lejárt azonosító: 302 a `https://kreditplus.hu/` oldalra.
- Nincs süti, és semmilyen személyes adatot nem tárolsz (IP-t sem).
- `Cache-Control: no-store`, hogy minden kattintás beérjen.

## 3. Admin felület: „Partnerajánlatok” fül

**Lista:**
- partner, cím, célzás („Minden egyetem” vagy az egyetemek listája), időszak;
- állapot: Aktív / Ütemezett / Lejárt / Kikapcsolva (a dátumokból és az `active`-ból számolva);
- az utolsó 30 nap kattintásai és lekérései.

Az állapotot szövegként jelezd, ne színes jelvénnyel (DESIGN.md).

**Új / Szerkesztés űrlap:**

| Mező | Kötelező | Megjegyzés |
|---|---|---|
| Azonosító | igen | Csak újnál. Kisbetű, szám, kötőjel; a partner nevéből ajánld fel. Utólag nem módosítható, mert a `/go/` linkben van. |
| Partner neve | igen | |
| Cím | igen | legfeljebb 60 karakter, élő számlálóval |
| Leírás | nem | legfeljebb 160 karakter |
| Kedvezmény | nem | pl. „15% kedvezmény” |
| Kuponkód | nem | az appban egy koppintással másolható |
| Link | igen | csak `https://` |
| Gomb szövege | nem | alapból „Megnézem” |
| Egyetemek | nem | többes választás a listából, alapból „Minden egyetem” |
| Tárgy-kulcsszavak | nem | vesszővel elválasztva. Csak annak jelenik meg, akinek az aktuális félévben van ilyen szót tartalmazó tárgya (a telefon dönti el, a szerver nem kapja meg a tárgyakat). |
| Kezdete | igen | dátum, alapból ma |
| Vége | nem | dátum, vagy „Visszavonásig” jelölő (ekkor NULL) |
| Sorrend | nem | szám, a nagyobb kerül előrébb |
| Aktív | igen | kapcsoló |

- **Élő előnézet** az űrlap mellett, ugyanúgy, ahogy az appban kinéz. Minta: a fő repó `www/styles.css` „Partnerajánlatok” blokkja: felül kis betűkkel „Partnerajánlat · Partner”, alatta a cím, a leírás, lent a „kedvezmény · kód” és a gomb.
- **Törlés:** csak kikapcsolás legyen (`active = 0`), a statisztika maradjon meg. Végleges törlés csak megerősítéssel.
- **Naplózás:** minden mentés és kapcsolás kerüljön az `admin_log`-ba (`promo.create` / `promo.update` / `promo.toggle` és az azonosító).
- **Admin végpontok** (csak az admin hoston, Access mögött, ahogy a többi):
  - `GET /api/admin/promos` (a lista a statisztikával);
  - `POST /api/admin/promos` (új);
  - `PUT /api/admin/promos/<id>`;
  - `POST /api/admin/promos/<id>/toggle`.
  - Mindenhol szerveroldali ellenőrzés: hosszak, https, érvényes egyetem-nevek, dátumsorrend. Minden szöveget sima szövegként tárolj, HTML-t ne engedj be (az app is szövegként jeleníti meg).

## 4. Elfogadási feltételek

1. Az adminon felvett, „Minden egyetem” célzású, aktív ajánlat 10 percen belül megjelenik az appban (a telefonon a 6 órás gyorsítótár miatt legkésőbb 6 óra múlva, vagy azonnal egy új telepítésen).
2. Az egy egyetemre célzott ajánlat a más egyetemű profilnál nem jön vissza a végpontból.
3. A lejárt, a még el nem kezdődött és a kikapcsolt ajánlat nem jön vissza.
4. A `/go/<id>` átirányít és számol. Az adminon látszik a napi kattintás.
5. A `http://` link és a túl hosszú cím mentése hibát ad.
6. A `kreditplus.hu/api/admin/promos` (publikus host) 404-et ad. A `admin.kreditplus.hu/api/promos` nem kell, hogy működjön.
7. DESIGN.md: nincs gondolatjel (– —) az admin szövegeiben sem.

## 5. Jogi megjegyzés (a legal szálnak továbbítva)

Az adatkezelési tájékoztatóba kell egy mondat: az app a partnerajánlatok lekérésekor az egyetem nevét küldi a szerverünkre. A tárgy szerinti célzás a telefonon történik, és a partner semmilyen adatot nem kap, csak a kattintások napi összesített számát. Az ajánlat mindig „Partnerajánlat” jelöléssel jelenik meg.
