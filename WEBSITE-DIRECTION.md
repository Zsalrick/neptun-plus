# Kredit+ weboldal — vizuális irány (legyen EGYEDI, ne sablon)

Cél: a landing legyen **összetéveszthetetlenül a miénk** és **prémium mobil-app érzetű**, ne egy
generikus SaaS-sablon és semmiképp ne egy userscript/dev-oldal (mint a konkurens). A legerősebb
egyediség-húzó: **a weboldal nézzen ki úgy, mint maga az app.**

Kötelező: olvasd a repo **DESIGN.md**-t (AI-slop tiltás) és a **WEBSITE-FEATURES.md**-t (tartalom). A
képek a `dist/showcase/` (valódi app, sötét, demó adat). Szövegben **nincs gondolatjel (– —)**.

---

## 1. Az alapelv: web = app

- Ugyanaz a **sötét, prémium paletta**, mint az appban: mély, kékesfekete alap (kb. `#0E1116`),
  kártya `#161A21`, halvány vonalak, és EGYETLEN akcentus: a **Kredit+ arany** (`#F5B221`). Ne hozz be
  új márkaszínt, ne legyen lila-kék gradient hero fehér alapon (ez a generikus alap).
- Számokhoz **monospace** karakter (ahogy az app is teszi a kreditindexnél, órarendnél). Ez egy apró,
  de ownable részlet, ami rögtön „appos" érzetet ad.
- A „+" a Kredit+ logóban legyen visszatérő motívum (elválasztó, felsorolásjel, hover-akcentus).

## 2. Hero (a legfontosabb blokk)

- **Egy valódi telefon a képernyőnkkel** (device-frame), a `home.png`-vel, mély sötét háttéren, finom
  arany fénnyel a telefon mögött (NEM tömött neon, DESIGN.md szerint visszafogott).
- Nagy, magabiztos, tömör headline (lásd WEBSITE-FEATURES.md), alatta egy alcím és **két gomb**:
  „Ingyenes próba" (elsődleges, arany) és „Funkciók" (másodlagos, szellem-gomb).
- NE egy fehér „dashboard laptopon" screenshot legyen. A hős a TELEFON.

## 3. Struktúra: görgetéses történet, nem tile-fal

- Minden fő funkció EGY teljes szekció: bal/jobb váltakozva egy **valódi telefon-screenshot** (a 7
  showcase képből) + egy rövid, benefit-mondat + 1-2 apró alpont. Egy gondolat / szekció.
- Ne legyen a klasszikus „3 oszlop kis ikonokkal" sablon feature-grid. Helyette nagy képek, sok levegő,
  erős tipográfiai hierarchia.
- A „push értesítés bárhol" szekcióhoz egy kis mozgó demó/mockup (értesítés becsúszik a telefon
  tetejére) sokat dob, ha belefér.

## 4. Profi mobil-app landing inspirációk (mit lopj el, NE másold)

- **Linear (linear.app):** feszes sötét felület, precíz térközök, tipográfia viszi a lapot, egyetlen
  akcentus. Ezt a fegyelmet és „engineered" érzetet vedd át.
- **Things 3 / Apple app-oldalak:** nyugalom, rengeteg levegő, egy üzenet szekciónként, tökéletes
  igazítás. A prémium csend.
- **Superhuman / Raycast:** a termék-screenshot a főszereplő, nagyban, középen; a sötét + egy akcentus.
  A „ez egy komoly, gyors termék" érzet.
- **Family / Cash App:** bátor nagy tipó és egy-egy játékos, mozgó pillanat. Ebből EGY merész momentum
  elég (pl. a hero vagy egy szekció), ne végig.
- **Arc / Bear:** karakteres részletek, finom textúra a sötétben, egyedi kis motívum.

A lényeg mindegyikből: **nagy valódi termékkép + sötét + egy akcentus + kevés, de erős szöveg + finom
mozgás.** Ez a profi mobil-app landing recept, és pont ez különböztet meg egy userscript-oldaltól.

## 5. Mozgás (tasteful)

- A telefon-tartalom és a szekciók lágyan úsznak be görgetéskor, **látható nyugalmi állapotból** (soha
  ne maradjon üresen, ha nincs JS/animáció). Respektáld a `prefers-reduced-motion`-t.
- Egy orchestrált hero-belépő többet ér, mint sok szórt effekt. Kevesebb több.

## 6. Egy ownable „signature" elem (válassz egyet és ismételd)

Pl.: a kreditindex/jegyek **mono-számai** mint visszatérő nagyméretű dísz; VAGY egy „indexkártya /
bizonyítvány" motívum (a mi kép-exportunkból); VAGY a „+" jel mint szekció-elválasztó. Egy motívum,
végig. Ettől lesz felismerhető és nem sablon.

## 7. Anti-generikus checklist (ezeket KERÜLD)

- Lila→kék gradient hero fehér alapon. (a leggyakoribb AI/SaaS-alap)
- Inter mindenre, középre zárt generikus hero, 3 oszlop kis ikonos kártyákkal.
- Stock illusztrációk, pörgő/pulzáló pöttyök, neon, üveg-morfózis túltolva.
- Világos téma. Mi sötét-prémium márka vagyunk, a web is az legyen.
- Laptop/böngésző mockup főszereplőként. Mi MOBIL vagyunk, ezt sugározza minden.

## 8. Konzisztencia és bizalom

- A web és az app **egy terméknek** tűnjön: ugyanaz a szín, betű, hangnem, a „·" elválasztó.
- Adatvédelem-blokk (az adatok a telefonon maradnak) rövid, megnyugtató.
- Árak: mindhárom csomag (havi/féléves/éves) a WEBSITE-FEATURES.md szerint.

## 9. Mit NE a konkurensről

- Ne hasonlíts a Neptun PowerUp oldalára (világos, utilitarian, fejlesztős). Mi consumer-prémium,
  mobil-first, sötét márka vagyunk. A megkülönböztetés maga a kinézet is.
