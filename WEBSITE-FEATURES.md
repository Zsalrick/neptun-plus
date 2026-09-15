# Kredit+ funkciók a weboldalra (értékajánlat)

Ez a lista a **valóban meglévő** app-funkciókat írja le a website agentnek, kész, benefit-orientált
magyar szövegekkel. Ezek mennek ki a landingre (miért fizet a diák 299 Ft/hó-t).

**Szövegszabályok (DESIGN.md):** soha ne használj gondolatjelet (– —) a látható szövegben. Bontsd
két mondatra ponttal, vagy vesszőt / „·" elválasztót használj. A magyar toldalék-kötőjel (pl.
„5,00-nál") rendben van. Hangnem: tömör, magabiztos, nem harsány, nincs felkiáltójel-özön.

A képek a korábban átküldött `dist/showcase/`-ból valók (home, orarend, jegyek, kredit, vizsgak,
targyak, penzugyek), mind kitalált demó adattal.

---

## A lényeg (headline + alcím javaslat)

- **Headline:** „A Neptun, ahogy lennie kéne."
- **Alcím:** „Egy érintéssel belépsz, és minden fontos egy helyen van: órarend, jegyek, kredit,
  pénzügyek. A többit az app elvégzi."
- **Hero kép:** `home.png`.

Egymondatos pitch változatok (A/B-hez):
- „Belépés egy koppintással, kétlépcsős kóddal együtt. Nincs több lassú Neptun."
- „Az egész féléved a zsebedben, offline is."

---

## Fő funkciók (ezek a landing feature-blokkjai)

### 1. Automatikus belépés · `home.png`
Egy koppintás, és bent vagy. Az app beírja az azonosítót, a jelszót és a kétlépcsős kódot is helyetted,
így másodpercek alatt látod az adataidat. A munkamenet a háttérben életben marad, a belépés azonnali.

### 2. Órarend · `orarend.png`
A heti órarended tisztán, a szünetekkel, termekkel és oktatókkal. Offline is elérhető, és egy
koppintással megnézed egy óra minden adatát. Képként is elmentheted vagy megoszthatod.

### 3. Jegyek és átlagok · `jegyek.png`
Minden féléved jegye egy helyen, félévenkénti bontásban, az átlagoddal és a kreditindexeddel együtt.
Rögtön látod, hol tartasz.

### 4. Kredit és diploma-haladás · `kredit.png`
Követi a teljesített kreditjeidet, és megmutatja, körülbelül hány félév van hátra a diplomáig. A
mintatantervedhez képest is látod, mennyi van kész.

### 5. Vizsgák és visszaszámláló · `vizsgak.png`
A közelgő vizsgáid és számonkéréseid időrendben, a hátralévő napokkal. A kezdőlapon mindig ott a
következő.

### 6. Tárgyak és mintatanterv · `targyak.png`
A felvett tárgyaid és a teljes mintatanterved kereshetően, egy helyen. Látod, mi van hátra a
képzésből.

### 7. Pénzügyek · `penzugyek.png`
Az egyenleged, a befizetendő tételeid, a tranzakcióid és az ösztöndíjaid átláthatóan, egy képernyőn.

### 8. Üzenetek
A Neptun üzeneteid az appban: elolvasod, válaszolsz, a csatolmányokat is eléred. Bekapcsolhatod, hogy
bárkitől fogadhass üzenetet.

---

## Kényelmi és prémium extrák (második blokk, „miért éri meg" érzet)

### Változás-értesítők
Szól, amikor új jegyed, üzeneted vagy befizetnivalód érkezik, vagy változik az órarended. Nem kell
folyton nézegetned a Neptunt.

### Reggeli összefoglaló
Minden reggel egy értesítés a napodról: mai óráid, az első óra időpontja és terme, vizsgák és a
befizetnivaló.

### Kezdőképernyő-widgetek
A jelenlegi és a következő órád ott van a telefon kezdőképernyőjén, megnyitás nélkül.

### Kalkulátor
Kiszámolja az átlagodat és a kreditindexedet, és megmondja, milyen jegyek kellenek egy célhoz.
Előre beírhatod a várt jegyeket is.

### Kereső
Egy mezőből rákeresel bármelyik tárgyadra, jegyedre, üzenetedre vagy beállításodra.

### Export és kép-készítő
Az órarendedből, a jegyeidből (bizonyítvány stílusban), a pénzügyeidből és sok másból szép képet vagy
CSV-t készítesz, szűrőkkel. Egy koppintással meg is osztod.

### Időszakok és határidők
Mikor nyílik a tárgyfelvétel, a vizsgajelentkezés, a jegybeírás. Egy helyen, a fontos dátumokkal.

### Testreszabás
Tizenkét színtéma, és testreszabható kezdőlap, hogy az legyen elöl, ami neked számít.

### Több egyetem egy appban
Ha több Neptun-fiókod van, mindet kezelheted, és gyorsan váltasz köztük.

---

## Biztonság és adatvédelem (bizalmi blokk, fontos a fizetéshez)

- **Az adataid a telefonodon maradnak.** Az app közvetlenül a te Neptunodhoz csatlakozik, nincs
  köztes szerver, ahova az adataid kikerülnének.
- **Beépített zár.** Igény szerint PIN-kód vagy ujjlenyomat védi az appot.
- **Nálad a kontroll.** Bármikor törlöd a mentett adatokat.

(Rövid, megnyugtató hangnem. Ez sokaknál a fizetés előtti utolsó kérdés.)

---

## Árak és csomagok (FONTOS: három csomag van, mind menjen ki)

A weboldal **mindhárom** csomagot mutassa, ne csak a havit:

| Csomag | Ár | Havi egyenérték |
|---|---|---|
| Havi | 299 Ft / hó | 299 Ft/hó |
| Féléves | 1 615 Ft / félév (−10%) | 269 Ft/hó |
| Éves | 2 691 Ft / év (−25%) | 224 Ft/hó |

- Ezek az árak véglegesek, az app onboarding csomagválasztója pontosan ezeket mutatja. A weboldal
  egyezzen velük.
- A féléves/éves csomagnál emeld ki a megtakarítást (−10% / −25%), és mutasd a havi egyenértéket is.
- Ingyenes próbaidőszakkal indul (14 nap, ajánlói kóddal 31 nap, lásd BACKEND.md).
- Folyamatosan fejlődik, az új funkciók automatikusan érkeznek.
- Egy kávénál is olcsóbb havonta, cserébe minden félévben időt és idegességet spórolsz.

(A csomagok pontos Play-felépítése és a productId-k a BACKEND.md §0-ban.)

---

## Hamarosan (opcionális roadmap-blokk, csak ha kell tartalom)

Ezeket NE ígérd késznek, csak „hamarosan":
- Tárgyfelvétel-segéd (ütközésmentes órarend-tervezés).
- Vizsgajelentkezés-figyelő.
- Ösztöndíj-becslő.

---

## Amit NE írj a weboldalra

- Ne állítsd, hogy „feltöri" vagy „megkerüli" a Neptunt. A helyes üzenet: gyorsabban és kényelmesebben
  éred el a SAJÁT adataidat.
- Ne ígérj olyat, ami még csak „Hamarosan".
- Ne tegyél a képekre valódi nevet, tárgyat, tanárt, termet, azonosítót (a demó képek már ilyenek).
- Gondolatjel tilos a látható szövegben.
