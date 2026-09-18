# kreditplus.hu/quiz/: útmutató és formátum (leírás a website agentnek)

**Cél:** a diák az appban kap egy promptot, amit a saját AI-jának ad (ChatGPT, Gemini, Claude) a PDF mellé. Az AI Kredit+ Quiz formátumban válaszol, a diák kimásolja, és az app beolvassa.

A weboldal feladata háromféle:
1. **Emberi útmutató**, hogy ez hogyan működik.
2. **Pontos, AI által is olvasható leírás a formátumról.** Van, aki csak ennyit ír az AI-nak: „a kreditplus.hu/quiz/ szabályai szerint”.
3. **Gépileg olvasható fájlok** („API”, statikus fájlként).

A formátum hivatalos leírása a fő repóban: **QUIZ-FORMAT.md** (MAIN). Innen dolgozz. A mezőket, a szabályokat és a promptszöveget szó szerint vedd át, ne fogalmazd át. Az app ugyanezeket használja.

Nincs szükség szerverre, adatbázisra, Turnstile-ra vagy belépésre. Ez minden statikus.

---

## 1. Fájlok

| Út | Tartalom | Content-Type |
|---|---|---|
| `/quiz/` | Az útmutató oldal (HTML), lásd lent. | `text/html` |
| `/quiz/prompt.txt` | Az általános AI-utasítás, **szó szerint** a QUIZ-FORMAT.md „Az általános AI-utasítás” blokkjából. | `text/plain; charset=utf-8` |
| `/quiz/schema.json` | A JSON Schema, szó szerint a QUIZ-FORMAT.md-ből. | `application/schema+json` (vagy `application/json`) |
| `/quiz/example.json` | Egy érvényes, 6 kérdéses példa: mind az 5 típus, magyarul, közgazdaságtan témában. A schema.json-nal validálva. | `application/json` |
| `/quiz/llms.txt` | Rövid, sima szöveges összefoglaló AI-knak: mi ez, és hol a prompt és a séma (a három URL). | `text/plain; charset=utf-8` |

**A négy szöveges vagy JSON fájlnál:**
- `Access-Control-Allow-Origin: *` fejléc, hogy AI-eszközök és böngészők is letölthessék;
- `Cache-Control: public, max-age=3600`.

Ezeken az utakon a Worker ne kérjen Turnstile-t, és ne irányítson át.

## 2. Az útmutató oldal (`/quiz/`)

**Fontos:** a teljes tartalom legyen **benne a HTML-ben, JavaScript nélkül is**. Az AI-ok linkolvasói többnyire nem futtatnak JS-t. Ne kép legyen a szöveg, és ne kinyíló-becsukódó elemekben (`<details>`) legyen a lényeg.

Szerkezet, sorrendben:

1. **Cím és egy mondat:** „Quiz a jegyzetedből, a saját AI-oddal”. Utána egy mondat arról, mire jó: gyakorlás ZH-ra és vizsgára, azonnali visszajelzés, ugrás a PDF oldalára.
2. **Hogyan működik, 3 lépés** (számozva, mert tényleg sorrend):
   1. A Kredit+-ban: Több, Quizek, „+”, „Quiz készítése AI-jal”. Válaszd ki a tárgyat és a PDF-et, állítsd be a kérdések számát, a típusokat és a nehézséget, majd „Prompt másolása”.
   2. Nyisd meg a ChatGPT-t, a Geminit vagy a Claude-ot, csatold a PDF-et, és illeszd be a promptot.
   3. Az AI válaszánál nyomd meg a kódblokk Másolás gombját, térj vissza a Kredit+-ba, és nyomd meg: „AI válaszának beillesztése”. Az app felismeri és elmenti a quizt.
3. **Tippek:**
   - Egyszerre legfeljebb 30-50 kérdést kérj. Ha a válasz félbeszakad, írd az AI-nak, hogy „folytasd”, vagy kérj kevesebbet.
   - Hosszú jegyzetnél kérj fejezetenként külön quizt („csak a 3. fejezetből”).
   - Az AI tévedhet. Ha egy válasz gyanús, nézd meg az oldalszámnál, és javítsd az appban (Szerkesztés).
   - A PDF-et az AI-szolgáltató kapja meg, a Kredit+ nem. Csak olyan anyagot adj az AI-nak, amihez jogod van, és nézd meg az AI-szolgáltató adatkezelését.
4. **Ha nincs kéznél az app**, akkor elég ennyit írni az AI-nak: „Olvasd el a https://kreditplus.hu/quiz/prompt.txt utasítást, és a csatolt PDF-ből készíts quizt.” Mellé egy **Másolás** gomb.
5. **A formátum** (ez a rész az AI-oknak is szól, legyen teljes):
   - a felső szint mezői;
   - az 5 kérdéstípus a mezőikkel;
   - kérdéstípusonként egy rövid példa kódblokkban.
   
   Mindezt a QUIZ-FORMAT.md szerint. Emeld ki: **a helyes választ betűvel kell megadni** (`"B"`, nem `1`), a `page` pedig a **PDF-fájl** oldalszáma.
6. **Amit az app elnézően kezel:** rövid lista a QUIZ-FORMAT.md-ből (kódblokk, magyarázó szöveg, záró vessző stb.), hogy a felhasználó ne ijedjen meg.
7. **Gépileg olvasható fájlok:** a négy link (`prompt.txt`, `schema.json`, `example.json`, `llms.txt`) egy-egy mondattal.
8. **Gyakori kérdések:**
   - „Nem sikerült beolvasni”: mit jelent, és mit csinálj.
   - „Ingyenes?”: igen, a saját AI-od ingyenes keretét használod.
   - „Meg tudom osztani?”: igen, a quiz ⋯ menüjében „Másolás megosztáshoz”. Linkes megosztás később jön.
   - „Kézzel is lehet?”: igen, az appban „Kézi szerkesztés”.

## 3. Megjelenés és szöveg

- **A meglévő weboldal stílusa:** sötét, editorial, Fraunces címek, porcelán gomb, kódblokkok IBM Plex Monóval.
- **Kódblokkok:** vízszintesen görgethetők, telefonon is olvashatók, mindegyik mellett Másolás gomb (JS nélkül is látszik a kód).
- **DESIGN.md:** nincs gondolatjel (– —) a szövegben. Két mondat vagy vessző. Elválasztónak a „·” jó.
- **Navigáció:** a menüben vagy a láblécben legyen link a Quiz oldalra.
- **Kereső-előnézet:** `<title>` „Quiz a jegyzetedből | Kredit+”, meta description, og:title és og:description.

## 4. Elfogadási feltételek

1. A `/quiz/` oldal JS kikapcsolásával is teljes szöveggel olvasható: a lépések, a formátum és a példák.
2. A `curl https://kreditplus.hu/quiz/prompt.txt` az utasítást adja, UTF-8-ban, jó ékezetekkel, CORS-fejléccel.
3. A `schema.json` érvényes JSON Schema, és az `example.json` átmegy rajta (bármilyen online validátorral ellenőrizve).
4. Az `example.json` szövegét az appba beillesztve (Quizek, „+”, „AI válaszának beillesztése”) a quiz hiba nélkül betöltődik. Ha kell, a MAIN szál ellenőrzi.
5. A prompt.txt szövege betűre egyezik a QUIZ-FORMAT.md blokkjával.
6. Telefonon (360 px) nincs vízszintes görgetés, csak a kódblokkokon belül.

## 5. Később (most NE építsd)

**Linkes megosztás** (`kreditplus.hu/q/<kód>`): a quiz tartalma D1-ben, előnézeti oldal letöltés gombbal, és Android App Links, hogy a link az appot nyissa meg. Erről külön leírás jön, ha a MAIN szál odaér. Ehhez kell majd egy `POST /api/quiz` és egy `GET /api/quiz/<kód>`, korlátozással és jelentés gombbal.
