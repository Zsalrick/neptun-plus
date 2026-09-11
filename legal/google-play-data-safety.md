# Google Play — Data Safety és Store megfelelés (puska)

> Ez nem jogi szöveg, hanem kitöltési segédlet a Play Console-hoz. Itt tartjuk,
> hogy a Data Safety űrlap és a store-lista összhangban legyen a tényleges
> működéssel és az adatkezelési tájékoztatóval. A backend/kiadó szál tölti ki a
> konzolt, ez alapján.

Utolsó egyeztetés: 2026. szeptember 11.

---

## 1. Data Safety űrlap (adatbiztonsági szakasz)

**Adatgyűjtés (collect) a fejlesztő/szolgáltató felé:** NINCS.
Minden adat az eszközön marad, nem kerül a szolgáltató szerverére.

- Does your app collect or share user data? → az adatokat nem osztjuk meg és nem
  gyűjtjük be szerverre; az azonosító/jelszó/tanulmányi adat kizárólag az
  eszközön tárolódik. A Play kérdéseinél az „on-device only" jelleget kell
  tükrözni: a szolgáltató nem gyűjt személyes adatot.
- Is all user data encrypted in transit? → Igen (HTTPS a Neptun/GitHub/Google felé).
- Can users request data deletion? → Igen, az appban (Minden adat törlése) és az
  app eltávolításával; a szolgáltatónál nincs tárolt adat, amit törölni kellene.

**Fizetés:** a vásárlást a Google Play Billing kezeli. A fizetési adatokat a
Google gyűjti/kezeli, nem a szolgáltató — ezt a Google kezeli a saját Data
Safety besorolásában, a mi appunk nem gyűjt fizetési adatot.

**Figyelem:** ha később bármilyen analitika, crash-report vagy szerveroldali
funkció kerül be, ezt a szakaszt és az adatkezelési tájékoztatót is frissíteni
KELL, mielőtt kimegy a release.

## 2. Kötelező linkek a store-listában

- Privacy Policy URL: a weboldalon közzétett app adatkezelési tájékoztató
  (`adatkezeles.md` tartalma). Publikus, stabil URL kell.
- Az ÁSZF és a Függetlenségi nyilatkozat is legyen elérhető a weboldalon.

## 3. Store-lista disclaimer (rövid, a leírás elejére/végére)

> A Kredit+ önálló, nem hivatalos alkalmazás. Nem áll kapcsolatban a Neptun
> rendszer fejlesztőjével vagy jogosultjával, sem egyetlen egyetemmel. A „Neptun"
> a jogosultja védjegye, itt kizárólag leíró célból szerepel. Az alkalmazás a
> felhasználó saját fiókjához, a felhasználó saját belépési adataival nyújt
> kényelmesebb hozzáférést.

## 4. Előfizetés (Play policy) ellenőrzőlista

- [ ] Csak Google Play Billinget használ a digitális előfizetéshez (nincs külső
      fizetési átirányítás az appból).
- [ ] Az ár, az időszak, az automatikus megújulás és a lemondás módja
      egyértelműen látszik a vásárlás előtt.
- [ ] 14 napos ingyenes próbaidő feltételei egyértelműek (mit fizet, mikortól,
      hogyan mondható le a terhelés előtt) a vásárlási felületen és az ÁSZF-ben.
- [ ] Lemondás a Google Play előfizetés-kezelőn keresztül, ezt az app és az ÁSZF
      is jelzi.

## 5. Érzékeny engedélyek / megfelelés

- [ ] A háttér-hálózat, értesítés, biometria engedélyek indoklása kész.
- [ ] Nincs olyan viselkedés, ami megkerüli a Neptun biztonsági intézkedéseit;
      a belépés a hivatalos felületen, a felhasználó adataival történik.
- [ ] A hitelesítő adatok kezelése (jelszó, 2FA) csak helyben, titkosítva.
