# Árazás a weboldalon: AI-kredit és új ajánlói jutalom (leírás a website agentnek)

**Mi változott (2026-09-19):**
- Az **árak NEM változnak**: egy előfizetés van, havi 299 Ft, féléves 1 615 Ft, éves 2 691 Ft, 14 napos próbával. Egy korábbi kétszintes (Prémium) tervet elvetettünk. Ha abból már bármit elkezdtél, azt dobd el.
- **Újdonság: AI-kredit.** Az előfizetéshez havi 5 AI-kredit jár a quiz-készítéshez, legfeljebb 15 gyűlhet össze. A próbában 3 kredit van.
- **Az ajánló jutalma „+31 nap” helyett „+10 AI-kredit”.** Aki a kóddal regisztrál, továbbra is 31 nap próbát kap.

Hivatalos forrás a fő repóban: **BACKEND.md** §0 (árak), §6 (ajánlás), §12 (kreditek).

## 1. Az `/arazas/` oldal

A meglévő szerkezet és stílus marad (hajszálvonalas sorok, három csomag). Csak ezek változnak:

1. **Próba mondata:** „Mindhárom csomag 14 napos ingyenes próbaidővel indul, benne 3 AI-kredittel. Ajánlói kóddal 31 nap.”
2. **Új rövid blokk a csomagok alatt: „AI-kredit a quizekhez”:**
   - Az előfizetéshez havonta 5 AI-kredit jár. Egy kredit egy quiz: az app a kiválasztott jegyzetedből vagy PDF-edből kérdéssort készít, csatolás és másolgatás nélkül.
   - A fel nem használt kredit összegyűlik, legfeljebb 15-ig.
   - Kredit nélkül is készíthetsz quizt a saját AI-oddal (ChatGPT, Claude, Gemini). Linkeld a `/quiz/` oldalt.
3. **A funkciólista** (`.incl`) kapjon két új sort: „Quizek a jegyzeteidből, AI-kredittel” és „Könyvek, olvasás, jegyzetek”.
4. **Ajánlói program:**
   - A jobb oldali szám **„+31 nap” helyett „+10 kredit”**, a szövege: „Minden sikeres meghívás után 10 AI-kreditet kapsz.”
   - A bal oldal marad (31 nap próba).
   - A lede mondata: „Ha valaki ezzel regisztrál, hosszabb próbaidőt kap, te pedig AI-krediteket.”
5. **„Miért fizetős”:** az „Az adatok a telefonon maradnak, köztes szerver nélkül.” sort cseréld erre: „A Neptun-adataid a telefonon maradnak. Csak a Kredit+ AI kapja meg annak az anyagnak a szövegét, amiből quizt kérsz, és azt sem tároljuk.”
6. **Meta:** a description végére „AI-kredit a quizekhez.” kerüljön. Az árak a meta szövegekben változatlanok.

## 2. Máshol

- **`i18n.js`:** az új és módosult mondatok angol és német fordítása. A régi „+31 nap” és „Minden sikeres meghívás után 31 nap jóváírást kapsz.” kulcsok törölhetők.
- **A tesztelők** „örökös prémium hozzáférése” maradhat így, kisbetűvel. Nincs Prémium nevű szint, a teljes előfizetést jelenti.
- **Az ÁSZF és az adatkezelési oldal** a jogi szálé (LEGAL markerek), azokba ne írj.

## 3. Elfogadási feltételek

1. Az árak betűre a régiek (299 / 1 615 / 2 691 Ft). Sehol nincs Prémium szint vagy 799 Ft.
2. Sehol nem maradt „+31 nap” az ajánló jutalmaként.
3. A „köztes szerver nélkül” mondat sehol nem maradt.
4. Telefonon (360 px) nincs vízszintes görgetés. DESIGN.md: nincs gondolatjel (– —).
