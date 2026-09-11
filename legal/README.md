# Jogi szál — Kredit+

Ez a mappa a **kanonikus** jogi szövegek otthona. A jogi agent itt szerkeszt,
a frontend agent ülteti be az appba.

## Fájlok
- `adatkezeles.md` — Adatkezelési tájékoztató
- `aszf.md` — Általános Szerződési Feltételek (ÁSZF)

## Hol jelennek meg az appban
`www/index.html`:
- `#privacy-sheet` (nyitja: `open-privacy` az onboardingban, `open-privacy2` a Beállításokban)
- `#terms-sheet` (nyitja: `open-terms`, `open-terms2`)

Jelenleg a szöveg **be van ágyazva** az `index.html`-be. Feladat: ezt a mappát
tenni a mértékadó forrássá, és innen szinkronizálni az `index.html` sheetekbe
(a beültetés a frontend szál dolga).

## Kulcstények (a szövegekhez)
- Az adatok **csak az eszközön** tárolódnak (`localStorage`), semmit nem küldünk külső szerverre.
- A Neptun-belépés az eszközön, a hivatalos Neptun oldalon történik.
- Az app **független**, nem az SDA Informatika / Neptun terméke.
- Fizetős előfizetés (a részletek az ÁSZF-be jönnek).
