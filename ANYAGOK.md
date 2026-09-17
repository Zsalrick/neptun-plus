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

**v0.291: teljesítmény (a telefonon akadt görgetésnél és nagyításnál)**
- Nagyítás nem építi újra az oldalakat: csak átméretez (4 ms), a régi kép kinyújtva látszik,
  amíg az éles külön vásznon elkészül, és csak kész állapotban cserélődik (nincs villanás).
- Pixelkeret oldalanként ~4 MP (korábban 3-4x-en akár 20+ MP oldalanként, két vásznon).
- Renderelési sor: egyszerre egy oldal, a képernyő közepéhez legközelebbi elöl; csípés közben szünetel.
- Tinta-vászon csak azon az oldalon, ahol tinta van (üres oldalon 0 MP).
- Oldal-árnyék helyett `contain: layout paint` (a nagy felületek átfestése akasztott).
- Fehér szín a palettán; vékonyabb minimum (toll 0,3 px, kiemelő 1,5 px).

**v0.292: kezelhetőség (mérve, 412 px széles, 2,625-ös pixelsűrűség, 4x lassított CPU)**
- Élő vonás külön vásznon: írás közben képkockánként csak a húzott vonal rajzolódik. Teleírt oldalon
  (300 vonás) 33 ms helyett 0,1 ms képkockánként.
- Két ujjal nagyítás ÉS mozgatás, minden eszközzel (tollal is görgethető, nem kell a kézre váltani).
  Elengedéskor az ujjak alatti pont helyben marad: korábban 57 px csúszás és 204 px ugrás, most 0 és 0.
- Éles nagyítás: a látható rész külön, kijelző-felbontású vásznon (`mvDetailPump`). 3x-en 58% helyett 100%.
  A pixelsűrűség plafonja 2 helyett 3 (2,6-os kijelzőn 1x-en is lágy volt).
- Dupla koppintás (olvasó módban): 250% oda, újra: vissza 100%-ra. A nagyítógomb helyett **Újra** gomb.
- Gyorsválasztó az eszköztár fölött (toll, kiemelő, szöveg): 4 szín, 3 méret, ⋯ a részletes beállításhoz.
- Tesztelés: chrome-devtools emulációval, szintetikus érintés- és toll-eseményekkel (scratchpad bench.js).
  Valódi telefonos mérés: USB-hibakeresés + `adb` (a gépen megvan), `dumpsys gfxinfo` képkocka-statisztika.

**v0.294: a PDF saját szövege**
- **Kijelölés** olvasó módban (kéz): átlátszó szövegréteg a pdf.js szövegtartalmából, hosszan nyomva kijelölhető.
  Sáv a kijelölés alatt: Másolás, Kiemelés, Aláhúzás, Áthúzás (a sorokra illesztett téglalapok, `t: "mark"`).
  A darabok szélességét a böngészőben mérjük és nyújtjuk: mérve 0,2 px eltérés a PDF-hez képest.
- **Átírás** T eszközzel: a PDF szövegére koppintva az a SOR nyílik meg szerkesztésre, a kurzor oda kerül,
  ahová koppintottál. Az eredeti sort a háttér színével kitakarjuk, fölé ugyanakkora, hasonló betű
  (a PDF betűnevéből: Arial/Helvetica, Times, Calibri, Courier; vastag, dőlt), a PDF-ből mintázott színnel,
  a sor szélességéhez igazított betűközzel, ugyanarra az alapvonalra. Változatlanul hagyva nem jön létre semmi;
  üresre törölve az eredeti szöveg eltűnik; a Törlés gomb visszahozza az eredetit.
- Korlát: a PDF beágyazott betűjét nem használjuk (általában csak a benne lévő betűket tartalmazza), ezért
  a betű nagyon hasonló, de nem mindig azonos. A megosztott PDF-ben az eredeti szöveg a takarás alatt megmarad
  (keresésnél, másolásnál az jön elő). Elforgatott, függőleges szöveg kimarad.

**v0.295: bekezdések felismerése az átíráshoz**
- A T eszközzel a koppintás egy egész BEKEZDÉST nyit meg, ha a sorok összetartoznak (`mvTextBlocks`): egymás alatti
  sorok azonos betűmérettel és -családdal, egyenletes sortávval, átfedő szélességgel, stimmelő bal széllel (vagy
  középpel). A szerkesztő tördelt doboz az eredeti szélességgel, sortávval, igazítással (balra, középre, sorkizárt)
  és behúzással (első sor behúzása, függő behúzás), így gépeléskor ugyanúgy tördel, mint a PDF.
- Kemény sortörés megmarad (felsorolás, bekezdés vége): ha a következő sor első szava még kifért volna a sor végére.
  Sor végi elválasztójel + kisbetűs folytatás: összevonva.
- Listajel (•, -, 1.) külön darabként a PDF-ben marad, csak a mellette lévő szöveg szerkeszthető; listajellel
  kezdődő sor mindig új blokk. Behúzott új bekezdés szintén új blokk.
- A bekezdés takarása nem nő lefelé (észrevétlenül eltakarná a következő sorokat); az egysoros átírásé vízszintesen igen.
- Kéz módban hosszan nyomva csak kijelölés és jelölés van, beírni nem lehet (első megnyitáskor tipp).
- Teszt: generált PDF (balra zárt, sorkizárt, felsorolás függő behúzással, középre zárt felirat, behúzott
  bekezdések): mind helyes blokk, a szerkesztőben ugyanannyi sor, mint az eredetiben. Windowsos Chrome
  emulációban a DOM kis betűméretnél hintelt szélességgel (17%-kal szélesebben) tördel; Androidon ez nincs.

### Profi irány (referenciák: Samsung Notes, GoodNotes, Flexcil, Xodo, PDF Expert)
Amit a diákok tényleg használnak, prioritás szerint:
1. ~~Szöveg kijelölése a PDF-ben~~ (v0.294, KÉSZ)
2. **Oldal-bélyegképek** oldalsávban (ugrás, átrendezés, törlés, beszúrás).
3. **Lasszó**: jegyzetek kijelölése, mozgatása, átméretezése, színezése.
4. **Keresés a PDF szövegében.**
5. **Alakzat-felismerés** (egyenes, nyíl, kör, téglalap tartásra kiegyenesedik).
6. Nagyításhoz igazodó tollvastagság; sablonos üres oldalak (vonalas, négyzethálós, pontozott).
7. ~~Kitakarás + átírás~~ (v0.294, KÉSZ: a PDF-sor átírása)

**A PDF eredeti szövegének szerkesztése** (betűnként átírni, mint egy Word-dokumentumban): ezt csak az
Adobe Acrobat Pro és a PDF Expert fizetős „Szerkesztés" módja tudja, a jegyzetelő appok (Samsung Notes,
GoodNotes, Flexcil) nem. A PDF-ben a szöveg nem folyó szöveg, hanem pozícionált betűk, gyakran
részleges (subset) betűkészlettel, ezért megbízhatóan nem szerkeszthető. A profi megoldás a 7. pont.

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
- Vektoros export (jelenleg a jegyzetréteg kép a PDF-en).
- Nyomásérzékeny vonalvastagság exportban is (most átlagos vastagság).
- Az anyagok bekerülése a napi automatikus mentésbe (most külön .zip mentés).
- Keresés a PDF szövegében.
- Tablet-elrendezés (oldalsó eszköztár).
