# Frontend brief — Pénzügyek oldal (v1)

A backend (MAIN) kész: van adatolvasó + data-sync task + állapot. A frontend feladata
az UI: a „Több" rács **Pénzügyek** csempéjét élővé tenni, és egy teljes képernyős
oldalt építeni. Prémium fekete-fehér, egy arany akcentus (mint a többi oldal).

## Adatforrás (kész, backend tölti)
`state.finance` (data-sync `finance` task tölti, `syncFinance()`):
```js
state.finance = {
  fetchedAt: ISO,
  accounts: [{ id, account, desc, balance, currency, autoPay }],  // gyűjtőszámla + egyenleg
  impositions: [ ... ]   // kiírt/befizetendő tételek NYERS tömbje (most üres [], a mezőnevek
                         //  még nem ismertek — defenzíven renderelj, lásd lentebb)
}
```
Példa `accounts[0]`: `{ account:"103000021080215300024903", desc:"HUF Pannon gyűjtőszámla", balance:2000, currency:"HUF", autoPay:false }`.

Ha `state.finance` null → üres állapot: „Még nincs beolvasva" + gomb, ami
`openDataSync(["finance"])`-et hív (vagy a meglévő data-sync). Beolvasás után
`renderFinance()` fusson újra (ahogy a kredit-oldalnál `grabProgress` után).

## Csempe (MORE_SERVICES, app.js render-réteg)
Jelenleg: `{ id:"finance", ..., soon:true }`. Tedd élővé:
`{ id:"finance", label:"Pénzügyek", sub: () => { const f=state.finance; return f&&f.accounts&&f.accounts.length ? (f.accounts.reduce((s,a)=>s+(a.balance||0),0).toLocaleString("hu")+" "+(f.accounts[0].currency||"HUF")) : "Egyenleg és tételek"; }, icon:"wallet", go:()=>showTab("tab-finance") }`
(a `wallet` ikon már létezik a `P` készletben.)

## Oldal (`#tab-finance`, teljes képernyős sub-screen)
- Vedd fel a `SUB_SCREENS`-be (`"tab-finance"`) → navbar elrejtve, back gomb visz vissza.
- `renderForTab`: `else if (id==="tab-finance") renderFinance();`
- Markup mint a Kredit-oldal: topbar `data-back` vissza gomb + „Pénzügyek" wordmark +
  jobb felül frissítés ikon (→ `openDataSync(["finance"])`), alatta `<div class="scroll" id="finance-scroll">`.

### Tartalom (renderFinance → #finance-scroll)
1. **Egyenleg hero-kártya** (a Kredit-oldal `cred-hero` mintájára):
   - Nagy szám: `accounts` egyenlegek összege + pénznem (pl. „2 000 Ft" — HUF-nál „Ft" utótag szép).
   - Alatta a számla leírása (`desc`, pl. „HUF Pannon gyűjtőszámla").
   - **Gyűjtőszámla-szám** monospace, külön sorban, **koppintásra vágólapra másol** (toast: „Számlaszám másolva") — ezt utalják a diákok, ez a leghasznosabb.
   - Ha több `accounts` van, mindegyik külön kártya.
   - `autoPay` igaz esetén egy halk chip: „Automatikus befizetés bekapcsolva".
2. **Befizetendő / kiírt tételek** szekció (`impositions`):
   - Ha üres → halk sor: „Nincs kiírt, befizetendő tétel." (ez a jó hír).
   - Ha van elem: **defenzív** render — a mezőnevek még nincsenek megerősítve (ez a diák
     fiókjában most üres volt). Amíg nem tudjuk a pontos szerkezetet, jeleníts meg minden
     elemből egy címet (első string mező) + összeget (első number mező, `... Ft`), és ne
     feltételezz konkrét kulcsneveket. Amint egy fizetős diák adata megvan, pontosítjuk.
3. **Hamarosan** szekció (halkan, letiltva): Számlák · Tranzakciók · Ösztöndíjak és
   kifizetések. Ezek végpontjai **még nincsenek felderítve** (a tippelt controllerek 404-et
   adtak, a navigációs sniff pedig befagy) — ne köss rájuk semmit, csak jelezd, hogy jön.
4. Lábléc: „Frissítve: {fmtWhen(state.finance.fetchedAt)}".

## Amit NE csinálj
- Ne írj saját Neptun-hívást a render-rétegbe; az adat a `state.finance`-ből jön (backend).
- Ne tegyél fel Számlák/Tranzakciók/Ösztöndíjak listát — nincs még hozzá végpont.

## Státusz (mi ismert)
- ✅ Egyenleg + gyűjtőszámla: `FinancialDataDashboard/GetCollectiveInvoices` (kész).
- ✅ Befizetendő blokk: `FinancialDataDashboard/GetDashboardImpostionBlockLeft` (kész, de a
  tesztfióknál üres → item-szerkezet még nyitott).
- ⏳ Számlák / Tranzakciók / Ösztöndíjak: végpont ismeretlen (backend feladat felderíteni).
Lásd a `neptun-hallgato-api` memóriát a részletekért.
