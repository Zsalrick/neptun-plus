# Kredit+ widget koncepciók

Két külön dolog van, ne keverjük:

- **(A) Kezdőlap widgetek** = az appon belüli Kezdőlap dashboard kártyák (`HUB_WIDGETS` az app.js-ben,
  testreszabhatók a „Kezdőlap testreszabása" alatt). **Ezt a FRONTEND építi** (render réteg). MAIN utána
  ellenőrzi.
- **(B) Kezdőképernyő widgetek** = Android home-screen widgetek (RemoteViews, natív). **Ezt MAIN építi**
  (android/, APK). A 2FA-copy ötlet ide tartozik.

Design: DESIGN.md szerint (nincs AI-slop: se pulzáló pötty, se neon, se gradient, se ALL-CAPS; állapot
csoportosítással + tipográfiával). Szövegben nincs gondolatjel (– —), „·" az elválasztó. Minden adat a
`state`-ből jön (offline is), tehát új adatforrás nem kell.

---

## (A) Kezdőlap widgetek — a FRONTEND építi

Minden widget: `{ id, label, desc, render(host) }` a `HUB_WIDGETS` tömbben; ha nincs adat, a render ne
tegyen ki semmit (a hub üres-állapota kezeli). Kártya-koppintás a megfelelő oldalra visz.

### Már léteznek (dokumentálva)
1. **Jelenlegi óra** (`current-class`) · a most zajló óra, amíg tart. → Órarend.
2. **Következő óra** (`next-class`) · a soron következő óra ideje, terme. → Órarend.
3. **Következő számonkérés** (`next-exam`) · a legközelebbi ZH/vizsga, hátralévő napokkal. → Vizsgák.
4. **Kreditek** (`credit`) · teljesített/összes kredit + mérősáv. → Kredit.
5. **Olvasatlan üzenetek** (`messages`) · olvasatlan Neptun üzenetek száma. → Üzenetek.
6. **Egyenleg** (`balance`) · gyűjtőszámla egyenleg. → Pénzügyek.
7. **Átlag / kreditindex** (`grades`) · korrigált kreditindex. → Jegyek.
8. **Adatok állapota** (`sync`) · jelzi a hiányzó adatot, egy gombbal frissít.
9. **Gyors gombok** (`sc-*`) · ugrás Tárgyak/Órarend/Kredit/Üzenetek/Pénzügyek oldalra.

### Új koncepciók (építendő)
10. **Mai nap** (`today`) · „3 óra 08:00–16:00 · első: Vállalati gazdaságtan (A.6)". A `morningBriefBody`
    logikájából. → Órarend. *Adat: state.ics.*
11. **Vizsga-visszaszámláló** (`exam-countdown`) · nagy szám: „4 nap" a következő vizsgáig, alatta a
    tárgy és dátum. (Fókuszáltabb, mint a next-exam sziget.) → Vizsgák. *Adat: examEvents.*
12. **Diploma-haladás** (`diploma`) · „≈ 3 félév van hátra · 53%" + vékony sáv. → Kredit.
    *Adat: state.progress + curriculum (a Kredit oldal diploma-blokkjából).*
13. **Kreditindex-trend** (`gpa-trend`) · az utolsó 3-4 félév kreditindexe apró oszlop/spark formában,
    a végén az aktuális. → Jegyek. *Adat: state.grades.averages.perTerm.*
14. **Legutóbbi jegy** (`last-grade`) · a legfrissebb jegy: tárgy · eredmény · mikor. → Jegyek.
    *Adat: state.grades (a legutóbbi dátum szerint).*
15. **Befizetendő** (`to-pay`) · összeg + legközelebbi határidő „· 5 nap múlva esedékes". → Pénzügyek.
    *Adat: state.finance.toPay.*
16. **Következő határidő / időszak** (`next-period`) · a legközelebb nyíló vagy záruló időszak (pl.
    vizsgajelentkezés) + hátralévő idő. → Időszakok. *Adat: state.periods.*
17. **Olvasatlan értesítések** (`notif-count`) · hány olvasatlan van az Értesítések központban, koppintás
    → Értesítések. *Adat: state.notifLog.*
18. **Gyors export** (`sc-export`) · ugrás a Kép-készítőre. (mint a többi sc- gomb.)

Megjegyzés: a 10–17 mind meglévő stílusokból építhető: `hub-stat` (ikon + nagy érték + felirat + chev)
a számos widgeteknek (11,14,15,16,17), a `cred`-szerű sáv a 12-nek, a `next-card` a 10-nek.

---

## (B) Kezdőképernyő widgetek — MAIN építi (natív, APK)

A meglévő infra: `WidgetRender.java` + `WidgetPlugin` (JS→SharedPreferences híd), `AppWidgetProvider`-ek.
Az app írja ki az adatot (mint a `setClasses`), a widget a SharedPreferences-ből olvas és rajzol.

### Már léteznek
1. **Jelenlegi óra** · a most zajló óra a kezdőképernyőn.
2. **Következő óra** · a következő óra ideje, terme. (Stackelhető az előzővel.)

### Új koncepciók (építendő, APK)
3. **2FA kód + Másolás** (`totp-widget`) ⭐ (a te ötleted) · a widgeten egy „2FA · Másolás" gomb; a
   gombra koppintva a widget **kiszámolja az aktuális TOTP kódot és a vágólapra másolja** (PendingIntent
   → BroadcastReceiver, ami a SharedPreferences-ben tárolt secretből számol, mint a background runner
   pure-JS TOTP-je, csak Java-ban), és egy rövid Toast: „Kód másolva". Opcionálisan kiírja a kódot is,
   de akkor ~30 mp-enként frissíteni kell (AlarmManager), ezért az egyszerűbb és biztonságosabb a
   **másolás-koppintásra** verzió, élő kód kiírása nélkül.
   - *Feltétel:* a secretet az appnak ki kell írnia a widget SharedPreferences-ébe (a runner KV-mintára).
   - *Adatvédelmi megjegyzés:* egy 2FA-widget a kezdőképernyőn azt jelenti, hogy aki látja a telefonod
     képernyőjét, egy koppintással a vágólapra teheti a kódot. Ezért: NE írjuk ki élőben a kódot,
     csak másolás-koppintásra adjuk, és tegyük a widgetet opcionálissá.
4. **Kreditindex** (`gpa-widget`) · nagy szám (korrigált kreditindex) + félév. Tap → app.
5. **Egyenleg** (`balance-widget`) · gyűjtőszámla egyenleg + „X befizetendő". Tap → Pénzügyek.
6. **Következő vizsga** (`exam-widget`) · visszaszámláló (N nap) + tárgy. Tap → Vizsgák.
7. **Mai nap** (`today-widget`) · a mai órák tömör listája (idő + tárgy), 2-3 sor. Tap → Órarend.

Mind ugyanazt a mintát követi: az app egy `Widget.setX(...)`-szel kiírja a friss adatot (a
refreshAgendas/autoRefreshAll végén), a widget onnan rajzol. Sötét lekerekített kártya (widget_bg),
accent a `--brand-plus`-ból (mint a class-widgetnél), theme-hez igazodó szín.

---

## Munkamenet
1. **Frontend:** az (A) 10–18 widgetek megépítése a `HUB_WIDGETS`-be, a meglévő stílusokkal.
2. **MAIN:** a (B) 3–7 natív widgetek (APK), a 2FA-copy-val kezdve, ha a user kéri.
3. **MAIN ellenőrzés:** az (A) elkészülte után böngészőben átnézem (render, üres-állapot, tap-célok,
   DESIGN.md, nincs gondolatjel).

Nyitott kérdés a userhez: a (B) natív widgetek közül melyik legyen az első (a 2FA-copy, vagy pl. a
kreditindex/egyenleg)?
