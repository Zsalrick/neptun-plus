# Frontend brief — Pénzügyek oldal

A backend (MAIN) kész: `syncFinance()` beolvassa az összes pénzügyi adatot és
`state.finance`-be menti, normalizált (stabil) alakban. A frontend feladata az UI:
a „Több" rács **Pénzügyek** csempéjét élővé tenni + egy teljes képernyős oldal.
Prémium fekete-fehér, egy arany akcentus.

## Adatforrás — `state.finance` (kész)
```js
state.finance = {
  fetchedAt: ISO,
  accounts: [{ id, account, balance, currency, autoPay, autoPayText, label }],
      // gyűjtőszámlák. balance lehet null (pl. EUR-nál). label pl. "HUF Pannon gyűjtőszámla".
  toPay: [{ id, name, value, currency, dueDate, term, subjectName, subjectCode }],
      // AMIT MÉG BE KELL FIZETNI (nyitott tételek). Üres = nincs tartozás.
  impositions: [{ id, name, value, currency, dueDate, paidAt, term, subjectName, subjectCode, invoiceNo }],
      // összes kiírt tétel (fizetett is): paidAt=null ha még nincs fizetve. pl. "Vizsga díj" 1000 Ft.
  transactions: [{ id, type, status, value, currency, direction, date, note, sign }],
      // tranzakció-history. sign "+"/"-". direction pl. "Befizetés"/"Kifizetés"/"Gyűjtőszámla egyenleg feltöltés".
  invoices: [{ id, number, value, currency, date, name, payer }],
      // számlák. number = számlaszám (pl. "2026/62/6559").
  scholarships: [{ id, name, amount, currency, term, date, status }],
      // ösztöndíjak/kifizetések. pl. "Jegyzetvásárlási ösztöndíj" 3600 Ft, status "Teljesített".
}
```
Ha `state.finance` null → üres állapot + gomb, ami `openDataSync(["finance"])`-et hív; utána `renderFinance()`.

## Csempe (MORE_SERVICES)
`{ id:"finance", ..., soon:false, icon:"wallet", go:()=>showTab("tab-finance"),
   sub: () => { const f=state.finance, a=f&&f.accounts&&f.accounts.find(x=>x.currency==="HUF")||(f&&f.accounts&&f.accounts[0]);
     return a&&a.balance!=null ? a.balance.toLocaleString("hu")+" Ft" : "Egyenleg, tételek, tranzakciók"; } }`

## Oldal (`#tab-finance`, teljes képernyős sub-screen)
- Vedd fel `SUB_SCREENS`-be (`"tab-finance"`); `renderForTab`: `else if(id==="tab-finance") renderFinance();`
- Markup mint a Kredit-oldal: topbar `data-back` + „Pénzügyek" + jobb felül frissítés (→ `openDataSync(["finance"])`); `<div class="scroll" id="finance-scroll">`.
- Formázás: összeg `érték.toLocaleString("hu")+" "+(currency==="HUF"?"Ft":currency)`; dátum `fmtWhen`/rövid dátum.

### renderFinance() szekciók (fentről le)
1. **Egyenleg (hero)** — az elsődleges (HUF) `accounts` egyenlege nagyban (`cred-hero` stílus).
   - Alatta a `label` („HUF Pannon gyűjtőszámla") és a **számlaszám** monospace, **koppintásra másol** (toast) — ide utalnak.
   - Ha több `accounts` (pl. EUR is), a többit külön kártyaként (a null egyenleg „—").
   - `autoPay` chip: `autoPayText` („Nem aktív"/„Aktív").
2. **Befizetendő** (`toPay`) — ha üres: „Nincs befizetendő tételed." (jó hír). Ha van:
   tételenként kártya: `name` (pl. „Vizsga díj"), `value` Ft nagyban, `subjectName` + `term`,
   határidő `dueDate` (ha lejárt, piros/hangsúlyos). Ez a legfontosabb blokk.
3. **Tranzakciók** (`transactions`) — lista, újtól régiig (`date` szerint). Soronként:
   bal: `direction`/`type` + `date`; jobb: `sign==="+"` → zöldes/hangsúlyos `+érték Ft`, `"-"` → sima `−érték Ft`.
   `note` halkan alá (ha van, pl. „NK-BLU89P"). `status` chip ha nem „Pénzügyileg igazolt".
4. **Ösztöndíjak és kifizetések** (`scholarships`) — soronként `name`, `amount` Ft, `term`, `status`, `date`.
   Üres → „Nincs ösztöndíj vagy kifizetés."
5. **Számlák** (`invoices`) — soronként `name` + `number` (számlaszám) + `value` Ft + `date`.
   Üres → „Nincs számla." (Ha később PDF-letöltés kell, van `Invoices/GetInvoiceDetailsForStudent?invoiceId=…`.)
6. Lábléc: „Frissítve: {fmtWhen(state.finance.fetchedAt)}".

Javaslat: az egyenleg + befizetendő legyen legfelül (ez érdekli a diákot), a tranzakció/ösztöndíj/számla
lehet lejjebb, akár összecsukható szekciókként, ha hosszú.

## Amit NE csinálj
- Ne írj saját Neptun-hívást a render-rétegbe; minden a `state.finance`-ből jön.
- Ne feltételezz mezőt a fentin túl; a lista-elemek pontosan a fenti kulcsokat tartalmazzák.

## Státusz — MIND kész (Pannon, valós adaton ellenőrizve)
Egyenleg/számlák, befizetendő, összes kiírt tétel, tranzakció-history, számlák, ösztöndíjak.
Endpoint-részletek: `neptun-hallgato-api` memória.
