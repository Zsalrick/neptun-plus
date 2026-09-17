# Anyagok: tárgyanyagok és jegyzetelés

## Az ötlet

A tárgyaidhoz fájlokat csatolhatsz (PDF, később DOCX és Excel), féléves bontásban.
A PDF-ekbe írhatsz és rajzolhatsz (toll, kiemelő, radír, szövegdoboz), új üres
oldalt szúrhatsz be, és a jegyzetekkel együtt megoszthatod.

**Pozicionálás:** nem a Samsung Notes / GoodNotes ellenfele, hanem *„a tárgyaid
anyagai egy helyen, gyors jegyzeteléssel"*. A különbség: az anyagok automatikusan
a valódi Neptun tárgyaid és féléveid szerint rendeződnek, nem neked kell mappákat
gyártani. Minden a telefonon marad.

**Miért éri meg:** naponta nyitnák meg az appot (órán is), nem csak jegynézéskor.
Havi előfizetésnél ez tartja meg a felhasználót. A Moodle-integrációval együtt
(az anyagok maguktól megjelennek) erős eladási érv.

**Kockázatok:**
- A rajzolás minőségi léce magas. Ha akad vagy csúnyán húz, senki nem használja.
- Az adatvesztés itt a legsúlyosabb hiba (egy félévnyi jegyzet). A mentés kötelező.
- Telefonon kicsi a hely a kézíráshoz; a komoly jegyzetelők tableten írnak.

---

## Lépések

### 1. PDF alapverzió (v0.286, KÉSZ)
- Több → Tanulmányok → **Anyagok**: félévválasztó, alatta a félév tárgyai.
- Tárgyonként anyaglista, **PDF importálás** és **üres jegyzet** létrehozása.
- Az óra részleteinél (Tárgy fül) link a tárgy anyagaihoz.
- Megjelenítő: oldalak egymás alatt, csak a látható oldalak renderelődnek.
- Eszköztár (alul, 375 px széles telefonon is kifér): görgetés, toll, kiemelő,
  radír (egész vonást töröl), szövegdoboz, szín (3-3), visszavonás, nagyítás
  (lépked: 100, 150, 200, 300%).
- A fejlécben: **új üres oldal** (a legjobban látható oldal után) és **megosztás**.

**v0.288-289 javítások (telefonos teszt alapján):**
- Két ujjas csípés-nagyítás 1x és 4x között (gesztus közben CSS előnézet).
- Minden oldal FÖLÖTT fejléc („N. oldal · üres oldal" + ⋯), az oldalak között vékony vonal,
  mert az oldal alatti ⋯ miatt véletlenül rossz oldal törlődött. Menü: új oldal ez után,
  oldal törlése (megerősítés, a címben az oldalszám), **törölt eredeti PDF-oldalak
  visszaállítása** (a fájlban megvannak, így újranyitás után is visszahozhatók).
- ~~Szöveg közvetlenül a lapra (v0.289)~~ → a telefonon bugos volt, v0.290-ben átépítve:

**v0.290: szövegdobozok a Samsung Notes mintájára**
- T eszköz, koppintás üres helyre: új doboz, rögtön villog a kurzor. A doboznak szélessége
  van (`bw`), a szöveg sort tör benne.
- Koppintás dobozra: **kijelölés** (kék keret + jobb oldali fogantyú). Húzás: mozgatás,
  fogantyú: szélesség. Kijelölt dobozra koppintás: **szerkesztés**.
- Lebegő mini-eszköztár a doboz FÖLÖTT: Kész / Szerkesztés, szín, A−, A+, Törlés.
  A gombok `pointerdown`-ja preventDefault, hogy ne vegyék el a fókuszt (billentyűzet marad).
- Üres helyre koppintás: ha szerkesztés vagy kijelölés van, az első koppintás csak lezár,
  a második hoz létre új dobozt.
- **Nincs mentés fókuszvesztéskor** (a v0.289 így csinálta; Androidon gépelés közben is jöhet
  blur, és bezárta a szerkesztőt). Csak Kész, máshova koppintás, eszközváltás, kilépés ment.
- A kész szöveg DOM rétegben él (`.mv-texts`), ugyanazzal a CSS-sel, mint a szerkesztő:
  mérve 0 px eltérés. A megosztott PDF-hez vászonra rajzolódik saját sortöréssel (`mvWrapLines`).
- Szerkesztéskor a doboz a látható rész felső felébe görget, mert a billentyűzet alulról
  takar, és edge-to-edge Androidon nem biztos, hogy a WebView összemegy
  (`visualViewport` resize is figyelve).
- Toll, kiemelő, szöveg beállításai (az aktív eszközre újra koppintva vagy a színkörre):
  11 szín, vastagság, átlátszatlanság, betűméret. `state.inkPrefs`-ben megmaradnak.
  Áttetsző tollvonás egy útvonalként rajzolódik, hogy ne sötétedjen be az átfedéseknél.
- Anyagokban visszatéréskor nem kér PIN-t/biometriát, kilépéskor igen.
- S Pen: ha egyszer tollat érzékel, onnantól **a toll rajzol, az ujj görget**
  (tenyér-elutasítás).
- Automatikus mentés minden változás után.
- **Megosztás jegyzetekkel:** új PDF készül (pdf-lib), a jegyzetréteg oldalanként
  képként kerül rá, így a magyar ékezetek és a kiemelő átlátszósága is megmarad.
  Az eredeti PDF érintetlen.
- **Mentés és visszaállítás:** az összes anyag és jegyzet egy .zip fájlba.

**Tárolás:** a fájlok és a jegyzetrétegek IndexedDB-ben (Blob, base64 nélkül),
a lista (metaadat) a `state.materials`-ben profilonként. Androidon a WebView
IndexedDB az app saját adatterülete, csak az app adatainak törlésekor vész el.
`navigator.storage.persist()` kérve. A jegyzetek normalizált (0..1) koordinátákban
vannak, így nagyítástól független.

**Könyvtárak (www/lib, helyben, offline is megy):** pdf.js (Apache-2.0, legacy
build a régebbi WebView-k miatt), pdf-lib (MIT), JSZip (MIT). Csak az Anyagok
első megnyitásakor töltődnek be, az app indulását nem lassítják.

### 2. Mérés
Használják-e? Hány anyag, hány jegyzet, mennyi idő a megjelenítőben.

### 3. DOCX és Excel csak nézetként
- DOCX: `mammoth.js` (olvasható HTML nézet).
- Excel: `SheetJS` (táblázat nézet, munkalap-váltó).
- Beleírni nem lehet; mellé lehet üres jegyzetoldalt tenni.

### 4. „Megosztás a Kredit+-ba" más appokból (v0.287, APK versionCode 16, KÉSZ)
Gmail, Letöltések, fájlkezelő: Megosztás → **Kredit+ Anyagok**, vagy „Megnyitás ezzel".
- Natív: `ShareReceiverPlugin.java` + `intent-filter` (SEND, SEND_MULTIPLE, VIEW;
  `application/pdf`). A megosztott URI olvasási joga ideiglenes, ezért a fájl azonnal
  a cache-be másolódik (háttérszálon, max 150 MB), és "shared" esemény megy a JS-nek,
  **megtartva**, amíg fel nem iratkozik (hidegindításnál sem vész el).
- JS (`materials.js`): a menü csak akkor ugrik fel, ha az app használható (be van
  állítva, nincs zárolva, eltűnt az indítóképernyő). Tárgyválasztó: az aktuális félév
  tárgyai, „Másik félév", „Új tárgy megadása". Több PDF egyszerre is mehet.
  Importálás után a tárgy anyaglistája nyílik meg; a cache-másolat törlődik.

### 5. Moodle automatikus behúzás
A tárgy Moodle-anyagai (lásd a Moodle-elemzést) maguktól megjelennek az Anyagok
alatt, és beléjük lehet jegyzetelni.

### További ötletek (később)
- Kétujjas csípés-nagyítás a megjelenítőben (az 1. lépésben gombos nagyítás van).
- Vektoros export (jelenleg a jegyzetréteg kép a PDF-en).
- Nyomásérzékeny vonalvastagság exportban is (most átlagos vastagság).
- Az anyagok bekerülése a napi automatikus mentésbe (most külön .zip mentés).
- Keresés a PDF szövegében.
- Tablet-elrendezés (oldalsó eszköztár).
