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

### 4. „Megosztás a Kredit+-ba" más appokból (APK kell)
Android share intent (pl. Gmailből egy PDF egy koppintással a tárgyhoz).
Natív `intent-filter` + a fájl átadása a WebView-nak, utána tárgyválasztó.

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
