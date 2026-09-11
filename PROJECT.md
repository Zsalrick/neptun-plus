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
| **Telefon backend** (MAIN) | ez a repo | `www/app.js` logikai rétege, `android/`, `scripts/`, `server.js`, `capacitor.config.json` | Neptun belépés + API, adatolvasás, state, OTA + release, natív buildek, verziózás |
| **Telefon frontend** | ez a repo | `www/index.html`, `www/styles.css`, `www/app.js` render-rétege | UI, elrendezés, navigáció, dizájn, ikonok, szövegek |
| **Weboldal** | **külön repo** | `website/` (itt **gitignore**-olva) | Marketing/landing oldal, kreditplus.hu |
| **Jog** | ez a repo | `legal/` | ÁSZF, Adatkezelési tájékoztató, jogi megfelelés |

A backend és a frontend **ugyanazt a `www/app.js`-t szerkeszti** (nincs külön
build-lépés, ami szétvágná) — a fájlon belüli szekció-határok tartják külön a
kettőt, lásd lentebb. Fizikai szétbontás jelenleg **nincs** (YAGNI): a jelenlegi
kódméretnél a merge-konfliktus kockázata kisebb, mint a refaktor kockázata.

---

## Szál részletek

### 1. Telefon backend (MAIN, ez a szál)
**Birtokol:**
- `www/app.js` logika: `P` ikon-készlet mint adat, `defaultState()`,
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
`www/styles.css` teljes egésze, és `www/app.js`-ben a **render-réteg**:
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
- Frontend/backend ugyanazt az `app.js`-t szerkeszti → a fenti szekció-felosztás
  szerint, kis diffekkel, gyakori commit/pull, hogy ne ütközzenek.
- Website külön repo → nincs itt merge-ütközés.
- Legal → a `legal/` a forrás, a beültetés a frontend feladata.

## Jelenlegi állapot
v0.122 (2026-09): dashboard Kezdőlap, Több szolgáltatás-rács, teljes képernyős
Profil/Kredit oldal, al-menükben rejtett navbar, meleg munkamenet (instant belépés),
natív hardveres/él-swipe vissza (`@capacitor/app`). Neptun API-first olvasás mindenre.
