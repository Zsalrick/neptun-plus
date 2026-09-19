# Új árazás a weboldalon (leírás a website agentnek)

**Mi változott (2026-09-19):** két előfizetési szint lett, a **Standard** és a **Prémium**, és az előfizetéshez **AI-kredit** jár a quiz-készítéshez. Ingyenes szint továbbra sincs, a 14 napos próba marad. Az ajánlói program jutalma is változott.

A hivatalos forrás a fő repóban a **BACKEND.md**: a §0 (árak), a §6 (ajánlás) és a §12 (kreditek). Az árak és számok betűre egyezzenek vele, az appal és az ÁSZF-fel.

## 1. Árak

| | Standard | Prémium |
|---|---|---|
| Havi | **299 Ft / hó** | **799 Ft / hó** |
| Féléves (10% kevesebb) | **1 615 Ft / félév** (havi 269 Ft) | **4 315 Ft / félév** (havi 719 Ft) |
| Éves (25% kevesebb) | **2 691 Ft / év** (havi 224 Ft) | **7 191 Ft / év** (havi 599 Ft) |
| AI-kredit | havi 5, legfeljebb 15 gyűlhet össze | havi 20, legfeljebb 60 gyűlhet össze |
| AI-quiz mérete | legfeljebb 30 kérdés, kb. 60 oldalnyi anyag | legfeljebb 50 kérdés, kb. 120 oldalnyi anyag |
| Egyéb | a teljes alkalmazás | a teljes alkalmazás, a jobb AI-modell, új funkciók elsőként |

**A Prémium ára előzetes.** Ha változik, a MAIN szól. Legyen egy helyen a kódban (egy adatobjektumban vagy egy include-ban), hogy egy helyen kelljen átírni.

**Próba:** 14 nap ingyen (ajánlói kóddal 31 nap), benne 3 AI-kredit a kipróbáláshoz.

## 2. Az `/arazas/` oldal

A meglévő stílus marad: hajszálvonalas sorok, nincs kártya, a számok monóval.

1. **Cím és lede:** „Árak és előfizetés”. A régi „Mindhárom csomag ugyanazt a teljes alkalmazást tartalmazza…” mondat helyett: „Két szint, mindkettő havi, féléves vagy éves számlázással. A Standard a teljes alkalmazás, a Prémium több AI-kreditet és nagyobb quizeket ad.”
2. **Időszakváltó:** Havi / Féléves / Éves, alapból **Éves** („Legjobb ár”).
   - JS nélkül mindhárom időszak árai látsszanak, pl. a három ár egymás alatt szintenként.
   - JS-sel a váltó csak a kijelzést szűkíti.
3. **Két sor vagy oszlop:** Standard és Prémium, az ár a választott időszak szerint. Az egyenérték mellé („havi 224 Ft-nak felel meg”) a kreditek és a quiz-méret a fenti táblázat szerint. Telefonon (360 px) egymás alatt.
4. **„Mi az AI-kredit?”** Rövid blokk, egyszerű nyelven:
   - Egy kredit egy quiz: az app a kiválasztott jegyzetedből vagy PDF-edből kérdéssort készít, csatolás és másolgatás nélkül.
   - A kredit havonta feltöltődik, és a fel nem használt összegyűlik, a Standardnál legfeljebb 15, a Prémiumnál legfeljebb 60.
   - Kredit nélkül is lehet quizt készíteni a saját AI-oddal (ChatGPT, Claude, Gemini), erről a `/quiz/` oldal szól. Linkeld.
5. **Próba mondata:** „Mindkét szint 14 napos ingyenes próbaidővel indul, benne 3 AI-kredittel. Ajánlói kóddal 31 nap.”
6. **A funkciólista** (a meglévő `.incl` lista) maradhat. Egészítsd ki két sorral: „Quizek a jegyzeteidből” és „Könyvek, olvasás, jegyzetek”.
7. **Ajánlói program:** a jobb oldali szám **„+31 nap” helyett „+10 kredit”**. A szöveg: „Minden sikeres meghívás után 10 AI-kreditet kapsz.” A bal oldal marad (31 nap próba annak, aki a kódoddal regisztrál). A lede mondata: „Ha valaki ezzel regisztrál, hosszabb próbaidőt kap, te pedig AI-krediteket.”
8. **„Miért fizetős”:** az „Az adatok a telefonon maradnak, köztes szerver nélkül.” sort cseréld erre: „A Neptun-adataid a telefonon maradnak. Csak a Kredit+ AI kapja meg annak az anyagnak a szövegét, amiből quizt kérsz, és azt sem tároljuk.”
9. **Tesztelők:** „A hivatalos tesztelők örökös Prémium hozzáférést kapnak.” (Prémium nagybetűvel, mert most már a szint neve.)
10. **Meta és og:**
    - description: „Kredit+ előfizetés: Standard 299 Ft/hó, Prémium 799 Ft/hó, féléves és éves kedvezménnyel. AI-kredit a quizekhez, 14 nap ingyenes próba.”
    - og:description: „Standard 299 Ft/hó, Prémium 799 Ft/hó. 14 nap ingyen, ajánlói kóddal 31 nap.”

## 3. Máshol a weboldalon

- **`i18n.js`:** a fenti új és módosult mondatok angol és német fordítása. A régi kulcsok („+31 nap”, „Minden sikeres meghívás után 31 nap jóváírást kapsz.”, a régi meta szövegek) törölhetők.
- **Főoldal és `/teszteles/`:** ahol „örökös prémium” szerepel, legyen „örökös Prémium”. A `/teszteles/feltetelek/` 6. pontjának tartalmához ne nyúlj, az a jogi szálé. Csak jelezd, ha ott is kell változás.
- **Az ÁSZF (`/aszf/`) és az adatkezelési oldal** a jogi szálé (LEGAL markerek), azokba ne írj. A jogi szál ugyanezt a változást megkapja (BACKEND.md §13).

## 4. Elfogadási feltételek

1. Az `/arazas/` oldalon mindkét szint mindhárom ára szerepel, JS nélkül is, és betűre egyezik a fenti táblázattal.
2. Sehol nem maradt „+31 nap” az ajánló jutalmaként, és a régi, egycsomagos meta szöveg sem.
3. A „köztes szerver nélkül” mondat sehol nem maradt.
4. Telefonon (360 px) nincs vízszintes görgetés, a két szint egymás alatt jelenik meg.
5. DESIGN.md: nincs gondolatjel (– —), elválasztónak a „·” jó.
