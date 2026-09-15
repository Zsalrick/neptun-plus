# Jogi szál — Kredit+

Ez a mappa a jogi szövegek gazdája. A weboldalon publikált változat a jogilag
hatályos, ez a mappa azzal szinkronban tartott kanonikus másolat, és innen
ülteti be a frontend szál az appba.

Legutóbbi teljes átírás: 2026. szeptember 15.

## Fájlok

| Fájl | Mit tartalmaz | Hol él élesben |
|------|---------------|----------------|
| `adatkezeles.md` | App + weboldal adatkezelés, egyben | `/adatkezeles/` és app `#privacy-sheet` |
| `aszf.md` | ÁSZF: árak, próba, ajánlói program, felelősség | `/aszf/` és app `#terms-sheet` |
| `teszteloi-program.md` | A tesztelői program rögzített döntései | `/teszteles/feltetelek/` + `/teszteles/adatkezeles/` |
| `fuggetlenseg.md` | Neptun/védjegy pajzs, user agent érvelés | lábléc minden oldalon |
| `google-play-data-safety.md` | Play Console kitöltési puska (nem jogi szöveg) | csak belső |

A weboldal jogi oldalain a szöveg a `LEGAL:*-START` és `LEGAL:*-END` HTML
kommentek között van. Módosításnál csak azt a blokkot kell cserélni.

## Ami most készült el

- A `/teszteles/feltetelek/` és `/teszteles/adatkezeles/` **üres volt**, miközben
  a jelentkezési űrlap kötelező pipája rájuk hivatkozott, és már gyűjtötte a
  neveket a D1-be. Mindkettő megírva.
- Az adatkezelési tájékoztató korábban azt állította, hogy csak szükséges sütik
  vannak. Valójában a `/api/subscribe` és `/api/tester-signup` **szerveren tárol**
  adatot (Cloudflare D1). Ez most néven nevezve szerepel, ahogy a kiszolgálói
  naplók és a Google Fonts IP-kiszivárgása is.
- Az ÁSZF-be bekerültek a tényleges árak (299 / 1 615 / 2 691 Ft), a 14 és 31
  napos próba, az ajánlói program szabályai és a tesztelői prémium.
- A jogi szöveg mostantól **kifejtve** magyaráz, nem jogszabályhelyekre hivatkozik.

## Nyitott pontok

1. **Székhely hiányzik.** Az elektronikus kereskedelmi szabályok szerint a
   szolgáltató székhelyét is közzé kell tenni, nem elég a név, adószám és e-mail.
   Jelenleg sehol nincs cím. Ha nem akarod a lakcímet kitenni, a szokásos
   megoldás egy székhelyszolgáltatás. **Döntést igényel.**
2. **Az appban még az „ingyenes" ÁSZF van.** A `www/index.html` 1026. sorában
   továbbra is az áll, hogy „Az alkalmazás használata ingyenes". Ez fizetős appnál
   félrevezető és Play-kockázat. A frontend szálnak be kell ültetnie az
   `aszf.md` és `adatkezeles.md` új szövegét.
3. **Google Fonts.** A betűtípusok külső betöltése kiviszi a látogató IP-címét a
   Google felé. Most őszintén le van írva a tájékoztatóban, de a tisztább megoldás
   a betűtípusok helyi kiszolgálása, akkor ez a bekezdés törölhető.
4. **Hírlevél leiratkozó link.** A szöveg egykattintásos leiratkozást ígér minden
   levél alján. Amikor tényleg indul a levélküldés, ennek működnie kell.
5. **Ajánlói program.** Az ÁSZF 7. pontja már leírja a szabályokat, de a rendszer
   még nincs megépítve (lásd `BACKEND.md`). Induláskor ellenőrizni, hogy a
   megvalósítás egyezik a leírttal.

## Kulcstények

- Az app adatai **csak az eszközön** vannak, a szolgáltatónak nincs róluk
  szerver oldali másolata. A weboldal űrlapjai viszont **igenis szerveren**
  tárolnak, ezt a két dolgot sosem szabad összemosni.
- A Neptun-belépés az eszközön, a hivatalos felületen, a felhasználó saját
  adataival történik. Ez a user agent érvelés alapja, lásd `fuggetlenseg.md`.
- Fizetés kizárólag Google Play Billingen, a szolgáltató kártyaadatot nem lát.
- Kapcsolattartó cím mindenhol: **info@kreditplus.hu**.

## Fenntartás

Ezek gondos, a tényleges működéshez igazított szövegek, de **nem ügyvédi
tanácsadás**. Éles indulás előtt, különösen az előfizetés, az ajánlói program és
a tesztelői örökös prémium miatt, érdemes magyar ügyvéddel átnézetni. Az egyéni
vállalkozói adatok helyességéért a szolgáltató felel.
