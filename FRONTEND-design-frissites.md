# Design frissítés (a 2 új képernyőtervhez) — leírás a frontendnek

A két új terv (Ma / Órarend / Jegyek / Tárgy, plusz a témák: Éjfekete, Erdő, Papír) jó, mehet.
Ez a lista azt gyűjti össze, mit érdemes még finomítani. **Csak a kinézet változzon, a logika ne.**
A szűrők, a szeparátorok (·), a gondolatjel-tiltás (– —) a DESIGN.md szerint maradnak.

Fontos alapszabály: **a meglévő szűrőket és állapotokat ne felejtsd el a designban.** Minden jelenlegi
vezérlő (félévválasztó, szegmens-váltó, „Összes félév" stb.) maradjon meg, csak nézzen ki jobban. Ha egy
képernyőt átrajzolsz, előtte nézd meg, milyen vezérlők vannak rajta most, és mind kerüljön vissza.

---

## 1. Átlagok olvashatósága (Jegyek) — a legfontosabb

Most: **4,12 korrigált kreditindex** hatalmas, a **súlyozott átlag (4,31)** viszont egy mondatba rejtve
(„Súlyozott átlagod 4,31, eddig 36 kreditet…"). A diákot általában a súlyozott átlag érdekli a legjobban,
és most az a kevésbé látható.

Kérés: a nagy szám mellé vagy alá egy **második, ugyanolyan olvasható stat, címkével**. Két szám egymás
mellett, alattuk halványan a kredit:

```
Korrigált kreditindex   Súlyozott átlag
        4,12                  4,31
        36 kredit teljesítve ebben a félévben
```

- Ez tisztán elrendezési kérdés, **az adat már megvan**: `state.grades.averages.indices`
  (`korrigalt`, `kreditIndex`, `osztondij`) és `state.grades.averages.perTerm[]`
  (`{ termName, average, creditIndex, sumAverage }`). Nem kell új lekérés, a render dönt.
- Ne színezd érték szerint a számokat (DESIGN.md tiltja a jegy-színkódolást). A jegyek (5/4/4/3) maradjanak
  semlegesek, a „jeles/jó/közepes" halványan alattuk, ahogy most.

## 2. Félévszűrő a Jegyeknél: szöveg + legördítő nyíl (logika marad)

Ötlet: maradjon a „2026/27/1 félév" szöveg, de mellette egy kis **legördítő nyíl**, amivel félévet lehet
váltani. Ezt **NE új logikával** csináld, a szűrő már megvan:

- `www/js/grades.js`: `gradesFilter` (érték: `"all"` vagy egy `termName`), a `#grades-period`
  `period-btn`, és `openList({ title: "Félév", selected, items, onPick })` nyitja a választót.
- Vagyis csak a **megjelenést** cseréld: a mostani külön „Összes félév" gomb helyett a fejléc félév-szövege
  legyen maga a kattintható, nyílas legördítő (ugyanaz az `openList` hívás mögötte). A „Összes félév"
  opció maradjon benne a listában.
- Ugyanez a minta a **Tárgyak** (`coFilter`, `www/js/courses.js`) és a **Vizsgák** szűrőinél is: egységes
  legördítő-nézet, változatlan logika.

**A szűrők ne felejtődjenek el:** most a szűrők (`gradesFilter`, `coFilter`, `coSeg`) csak a memóriában
élnek, app-újraindításkor alaphelyzetbe állnak. Kérés: a választott félév/szegmens **maradjon meg
újraindítás után is**. Ehhez tedd őket a `state`-be (pl. `state.ui = { gradesFilter, coFilter, coSeg }`),
és a render onnan olvassa. Ez app-logika, úgyhogy ha kell, a backend (én) előkészítem a `state.ui`
mezőt és a mentést, csak szólj. A lényeg: a felhasználó ne veszítse el a szűrését.

## 3. Világos téma (Papír) — elsőrangú témaként

Tetszik, mehet, de nem ráadásként:

- **Másodlagos szürke szöveg** (időpontok, „Tanóra · A.fsz.A1") krémszínű háttéren könnyen alacsony
  kontrasztú lesz. A törzsszövegre a cél **WCAG AA** (legalább 4,5:1). Ez ugyanaz, mint az 1. pont: halvány
  szöveg világos alapon még halványabb.
- Az **akcentus** (a Papír témában sötét terrakotta) jó, olvasható, tartsd meg. Ne világosodjon ki krém
  háttéren.
- **Minden képernyőt** nézz végig világosban, nem csak a Ma-t (Jegyek, Órarend, Tárgy, Anyagok
  megjelenítő, beállítások, párbeszédablakok). A teszt-felület megduplázódik, ez a téma fő költsége.
- A `theme.js` mostantól a `theme-color` metát is állítja (a státuszsáv színe), tehát a Papír témánál a
  világos háttér-szín kerül oda. Ellenőrizd, hogy a rendszer státuszsáv szövege (óra, akku) olvasható
  marad-e világos sávon (Androidon a `theme-color` világos értéknél sötét ikonokat kér).

## 4. Belépés-chip a Papír témában

A Ma nézet alján a belépés-chip (092 897 / Belépés) a világos témában majdnem elveszik: világos chip
világos háttéren. Kell rá egy hajszálnyi erősebb elválasztás (keret vagy kissé eltérő felület-szín), hogy
elváljon a lap hátterétől. Sötét témákban ez most jó.

## 5. Félév-formátum egységesen

A Jegyek fejlécében „2026/27/1 félév", a Tárgy nézetben „VEGTSTB111 · kötelező tárgy" (ez utóbbi jó, a
kettős perjeles Neptun-formát szépen feloldottad). Kérés: a félév-formátum végig egységes legyen, ahol
megjelenik (Jegyek, Órarend, szűrők).

---

## Ami jó, ne rontsd el

- A **„most tart" idővonal** (10:24, akcentus-pont a vonalon) a Ma és Órarend nézetben kiemelkedő. Marad.
- Visszafogott akcentus (csak a „most"-ot jelöli), sok levegő, nincs doboz a dobozban. DESIGN.md-konform.
- A Tárgy nézet adatlapja és az „Anyagok" sor jó, marad.

## Fájlok (render réteg, a frontendé)

`www/index.html`, `www/styles.css`, és a render-függvények: `renderGrades` (`www/js/grades.js`),
`renderHome` (`www/js/home.js`), `renderTimetable` (`www/js/timetable.js`), `renderCourses`
(`www/js/courses.js`), `applyTheme`/`renderThemePage` (`www/js/theme.js`). A logikát (`gradesFilter`,
`coFilter`, `state.grades.averages`) ne írd át, csak a megjelenítést. Ha a szűrő-megőrzéshez `state`-mező
kell, a backend előkészíti.
