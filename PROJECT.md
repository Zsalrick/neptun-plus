# Kredit+ — projekt- és szálleírás

Kredit+ egy fizetős Capacitor (Android) alkalmazás, ami a magyar egyetemek
Neptunjába lép be automatikusan, és közvetlenül a Neptun JSON API-ból olvassa ki
az órarendet, krediteket, mintatantervet, tárgyakat, vizsgákat. Fekete-fehér,
prémium dizájn, egyetlen arany akcentussal (a „+” a Kredit+ szóban).

A fejlesztés **több párhuzamos szálon (Claude Code session)** folyik. Ez a
dokumentum írja le, ki mit birtokol, hol a határ, és hogyan nem lépünk egymás
lábára.

---

## Szálak (agentek)

| Szál | Repo | Mappa / terület | Felelősség |
|------|------|-----------------|------------|
| **Telefon backend** (MAIN) | ez a repo | `www/app.js` + `www/js/*` logikai rétege, `android/`, `scripts/`, `server.js`, `capacitor.config.json` | Neptun belépés + API, adatolvasás, state, OTA + release, natív buildek, verziózás |
| **Telefon frontend** | ez a repo | `www/index.html`, `www/styles.css`, a `www/js/*` render-rétege | UI, elrendezés, navigáció, dizájn, ikonok, szövegek |
| **Weboldal** | **külön repo** | `website/` (itt **gitignore**-olva) | Marketing/landing oldal, kreditplus.hu |
| **Jog** | ez a repo | `legal/` | ÁSZF, Adatkezelési tájékoztató, jogi megfelelés |

A kód **funkciónként külön fájlokban** van (`www/app.js` + `www/js/*.js`, lásd
„Fájlok”). Egy fájlon belül a render-függvények (`render*`) a frontendé, az adat
és a logika a backendé.

---

## Fájlok (v0.285-től)

A 7000+ soros `app.js` 37 fájlra lett szétbontva. **Nincs build-lépés.**

**Hogyan működik:** az app-fájlok **sima szkriptek, közös hatókörrel** (nem ES
modulok, nincs `import`/`export`). Egy fájl felső szintű függvénye, `let`/`const`
változója minden más fájlból elérhető és írható, pontosan úgy, mint korábban az
egy fájlon belül. Mind `"use strict"`. Az `index.html` alján `defer`-rel,
**sorrendben** töltődnek be.

**Szabályok:**
- **Új fájl:** vedd fel az `index.html`-be egy `<script defer src="js/…">` taggel,
  az `init.js` ELÉ.
- **Betöltési sorrend:** ami betöltéskor azonnal lefut (nem egy függvény belsejében,
  pl. `$("x").onclick = foo;` vagy `const a = foo();`), az csak korábbi vagy
  ugyanabban a fájlban lévő dologra hivatkozhat. Függvénytörzsön belül bármi
  hivatkozhat bármire. Az indítás (`init.js`) fut utoljára.
- **Egyedi nevek:** két fájlban ne legyen azonos nevű felső szintű deklaráció
  (betöltéskor hibát dob).
- **Külső könyvtárak** (`lib/totp.js`, `lib/gauth.js`, `lib/ical.js`,
  `data/universities.js`) ES modulok: a `js/libs.js` modul teszi őket globálissá,
  és minden app-fájl előtt fut.
- **Verzió:** az `APP_VERSION` továbbra is a `www/app.js` tetején van (a
  `release.mjs` onnan olvassa).
- **Nagy könyvtárak lustán:** a pdf.js / pdf-lib / JSZip nincs az `index.html`-ben,
  az Anyagok első használatakor töltődnek be (`matPdfjs()`, `matScript()`), hogy az
  app indulása ne lassuljon. Licencek: `www/lib/THIRD-PARTY-NOTICES.txt`.

| Fájl | Tartalom |
|------|----------|
| `app.js` | Alap: verzió, ikonok, állapot és profilok tárolása, segédfüggvények, biometria |
| `js/libs.js` | Modul: a külső könyvtárak globálissá tétele |
| `js/events.js` | Idő- és eseménymodell: dátum-segédek, félévek, órák, számonkérések |
| `js/ui.js` | Párbeszédablakok, töltésjelző, választók, lehúzásos frissítés, szegmens-lapozás |
| `js/onboarding.js` | Első indítás: egyetem, 2FA/QR, PIN |
| `js/nav.js` | Navigáció, képernyők, vissza gomb, húzásos lapozás |
| `js/theme.js` | Színtémák |
| `js/search.js` | Kereső |
| `js/referral.js` | Ajánlói kód |
| `js/profiles.js` | Több profil |
| `js/twofa.js` | Élő 2FA kód, szerverválasztó |
| `js/home.js` | Kezdőlap widgetek és szerkesztés |
| `js/more.js` | Több fül |
| `js/credit.js` | Kredit oldal, diploma-haladás |
| `js/finance.js` | Pénzügyek |
| `js/messages.js` | Üzenetek (lista, olvasás, válasz, csatolmány, fogadási beállítás) |
| `js/grades.js` | Jegyek, felajánlott jegyek |
| `js/periods.js` | Időszakok |
| `js/calc.js` | Átlag- és kreditindex-kalkulátor |
| `js/widgets.js` | Híd a natív kezdőképernyő-widgetekhez |
| `js/timetable.js` | Órarend és vizsgák nézet, iCal |
| `js/export.js` | Kép-készítő, CSV |
| `js/exams.js` | Kézi számonkérés |
| `js/courses.js` | Tárgyak oldal |
| `js/api.js` | Neptun API: munkamenet, token, GET/POST, alap lekérések |
| `js/neptun-flow.js` | Böngészős Neptun folyamatok (befecskendezett szkriptek) |
| `js/diagnostics.js` | API diagnosztika |
| `js/sync.js` | Adatok beolvasása (szinkronizálók) |
| `js/detail.js` | Óra részletei: tárgy, oktatók, diákok, megjegyzések |
| `js/friends.js` | Barátok, önfelismerés, hallgató adatlap |
| `js/planner.js` | Tárgyfelvétel tervező, órarend-generátor |
| `js/dlc.js` | Kiegészítők, számlatükör-néző |
| `js/materials.js` | Anyagok: tárolás (IndexedDB), PDF importálás, listák, .zip mentés (lásd ANYAGOK.md) |
| `js/material-viewer.js` | Anyag-megjelenítő: PDF oldalak, toll/kiemelő/radír/szöveg, új oldal, megosztás jegyzetekkel, olvasási pozíció, oldaljegyzetek, Tartalom képernyő |
| `js/books.js` | Könyvek: saját könyvtár, könyvkereső (OpenAlex, MEK, MeRSZ link), letöltés, tárgyhoz rendelés (lásd ANYAGOK.md) |
| `js/quiz.js` | Quizek: formátum-beolvasó, AI-prompt, beillesztés, kézi szerkesztő, gyakorló és vizsga mód (lásd QUIZ-FORMAT.md) |
| `js/promos.js` | Partnerajánlatok a Kezdőlap alján (lekérés a kreditplus.hu/api/promos-ról, célzás, elrejtés; lásd WEBSITE-ADMIN-PROMO.md) |
| `js/notifications.js` | Értesítések, változás-riasztások, értesítési központ, reggeli összefoglaló |
| `js/settings.js` | Beállítások |
| `js/backup.js` | Mentés és visszaállítás |
| `js/login.js` | Belépés a Neptunba |
| `js/lock.js` | Alkalmazászár |
| `js/init.js` | Indítás (utolsó) |

---

## Szál részletek

### 1. Telefon backend (MAIN, ez a szál)
**Birtokol:**
- Logika (`app.js`, `js/api.js`, `js/neptun-flow.js`, `js/sync.js`, `js/login.js`, …): `P` ikon-készlet mint adat, `defaultState()`,
  `PROFILE_FIELDS`, `migrate()`, `saveState()`, profilkezelés, `CHTTP()`,
  `apiSession`/`getApiSession`/`apiGet`/`apiRead*`, a `buildLoginScript` /
  `runNeptunFlow` / `nativeLogin` belépési lánc, `warmSession`, `grab*` /
  `sync*` adatolvasók, OTA (`window.OTA`, `update.js`), diagnosztika.
- `android/`, `capacitor.config.json`, `scripts/release.mjs`, `server.js`,
  `data/universities.js`.
- **Verzió + kiadás:** kizárólag a backend bumpolja az `APP_VERSION`-t és futtatja
  a `node scripts/release.mjs`-t. Minden más szál változása is ezen keresztül megy ki.

**Ne nyúlj hozzá (más szálé):** `index.html` markup, `styles.css`, `legal/`.

### 2. Telefon frontend
**Birtokol:** `www/index.html` (app-shell, tabscreenek, sheetek markup),
`www/styles.css` teljes egésze, és a `www/js/*` fájlokban a **render-réteg**:
`renderHome`, `renderMore`, `renderCreditPage`, `renderProfilePage`,
`renderTimetable`/`renderExams`/`renderCourses` HTML-generálása, `MORE_SERVICES`,
`icon()` használat, `showTab`/nav/`onBackNav` viselkedés finomhangolása.

**Szerződés a backend felé:** a backend adja a state-et és az adatokat
(`state.progress`, `state.ics`, `state.courses`, …); a frontend csak rajzol.
Új adatra van szükség? Kérd a backendtől (issue / a MAIN szálon), ne írj saját
Neptun-hívást a render-rétegbe.

### 3. Weboldal (külön repo, `website/` gitignore-olva)
Landing/marketing oldal (kreditplus.hu). Külön repóban él, ezért a `website/`
mappa itt gitignore-olt — csak lokális munkakönyvtár. A meglévő homepage-vázlat
alapja: `scratchpad`-ben lévő `kreditplus.html` (dark/light, Bricolage + Hanken +
IBM Plex Mono, arany akcentus, független-a-Neptuntól jogi lábléc).

### 4. Jog (`legal/`)
ÁSZF + Adatkezelési tájékoztató a kanonikus forrás. **Jelenleg** a szövegek az
appban be vannak ágyazva: `www/index.html` → `#privacy-sheet` és `#terms-sheet`
(gombok: `open-privacy`/`open-terms` az onboardingban, `open-privacy2`/
`open-terms2` a Beállításokban). A jogi szál a `legal/`-ban tartja a mértékadó
verziót, és a frontend szál ülteti be az `index.html`-be.

---

## Közös szerződések (mindenki tartsa be)

- **State kulcs:** `localStorage["neptun-plus"]`. Alakja: `defaultState()` +
  `PROFILE_FIELDS` (profil-tükrözés). Mezőt hozzáadni csak backend + `migrate()` frissítéssel.
- **Neptun API:** lásd a memóriát (`neptun-hallgato-api.md`). A base per-egyetem,
  az endpointok szoftver-konstansok. Token ~5 perc, `warmSession` tartja frissen.
- **Márka:** fekete-fehér, `--brand-plus` arany csak a „+”-on és 1 akcentusként.
  Betű: Bricolage Grotesque a címekre. Ne vigyél be új színt/emojit.
- **Verziózás:** `APP_VERSION` a `www/app.js` tetején; minden kiadás
  `node scripts/release.mjs` (GitHub Release + OTA manifest). www-only változás
  OTA-n megy; natív változás (plugin) új APK-t igényel (`npm i && npx cap sync` + gradle).
- **Nyelv:** magyar UI. Kerüld a felesleges kötőjelet (—) és emojit a UI-szövegben.

## Koordináció
- A MAIN (backend) a „release gazda”: ő bumpol verziót és publikál.
- Frontend/backend funkciónként külön fájlokban dolgozik (lásd „Fájlok”). Ugyanazon
  a fájlon belül a render a frontendé, a logika a backendé: kis diffek, gyakori commit.
- Website külön repo → nincs itt merge-ütközés.
- Legal → a `legal/` a forrás, a beültetés a frontend feladata.

## Jelenlegi állapot
v0.122 (2026-09): dashboard Kezdőlap, Több szolgáltatás-rács, teljes képernyős
Profil/Kredit oldal, al-menükben rejtett navbar, meleg munkamenet (instant belépés),
natív hardveres/él-swipe vissza (`@capacitor/app`). Neptun API-first olvasás mindenre.
