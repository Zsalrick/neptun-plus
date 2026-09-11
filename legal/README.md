# Jogi szál — Kredit+

Ez a mappa a **kanonikus** jogi szövegek otthona. A jogi szál itt szerkeszt,
a frontend szál ülteti be az appba, a website repo a weboldalra.

## Fájlok
- `adatkezeles.md` — Adatkezelési tájékoztató (alkalmazás)
- `aszf.md` — Általános Szerződési Feltételek (fizetős előfizetés)
- `fuggetlenseg.md` — Függetlenségi és jogi nyilatkozat (Neptun/védjegy pajzs)
- `web-impresszum-adatkezeles.md` — Weboldal impresszum + adatkezelés
- `google-play-data-safety.md` — Play Console kitöltési puska (nem jogi szöveg)

## Hol jelennek meg az appban
`www/index.html`:
- `#privacy-sheet` (nyitja: `open-privacy`, `open-privacy2`) ← `adatkezeles.md`
- `#terms-sheet` (nyitja: `open-terms`, `open-terms2`) ← `aszf.md`
- Függetlenség: rövid változat az onboardingba/láblécbe ← `fuggetlenseg.md`

## Beültetési feladatok (frontend szál felé) — FONTOS
1. **ÁSZF csere:** a jelenlegi beágyazott ÁSZF azt írja „Az alkalmazás használata
   ingyenes". Ez **elavult** — az app fizetős. Az `aszf.md` új szövegét kell
   beültetni a `#terms-sheet`-be (előfizetés, Google Play számlázás, lemondás,
   elállási jog).
2. **Adatkezelés:** az `adatkezeles.md` új 5. (Fizetés) pontját át kell vezetni
   a `#privacy-sheet`-be.
3. **Függetlenség:** érdemes egy rövid, önálló nyilatkozatot is elérhetővé tenni
   (onboarding + Beállítások), az eddig ÁSZF 4. pontjában rejtett tartalom helyett.

## Kulcstények (a szövegekhez)
- Az adatok **csak az eszközön** tárolódnak (`localStorage`); a szolgáltató
  szerverére semmit nem küldünk.
- A Neptun-belépés az eszközön, a hivatalos Neptun felületen, a felhasználó
  saját adataival történik (user agent, nem jogosulatlan hozzáférés).
- Az app **független**, nem az SDA Informatika / Neptun terméke; a „Neptun"
  leíró, nominatív használat.
- **Fizetős** előfizetés Google Play Billingen keresztül; a fizetési adatokat a
  Google kezeli, nem a szolgáltató.

## Fenntartás
Ezek gondos, jogilag megalapozott vázlatok, de **nem ügyvédi tanácsadás**.
Élesítés (és különösen a fizetős/előfizetéses + Neptun-védekező részek) előtt
javasolt magyar ügyvéddel átnézetni. Az egyéni vállalkozói adatok (adószám,
nyilvántartási szám, email) helyességét a szolgáltatónak kell ellenőriznie.
