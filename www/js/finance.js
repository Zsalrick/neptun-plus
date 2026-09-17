// Pénzügyek.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Full-screen Pénzügyek page. All data comes from state.finance (syncFinance); no Neptun calls here.
function ftFt(v, cur) { return (v == null ? "—" : Number(v).toLocaleString("hu")) + " " + (cur === "HUF" || !cur ? "Ft" : cur); }
function ftDate(iso) { if (!iso) return ""; const d = new Date(iso); return TT_MON[d.getMonth()] + " " + d.getDate() + "., " + d.getFullYear(); }
function renderFinance() {
  const host = $("finance-scroll"); if (!host) return;
  const f = state.finance;
  if (!f || !f.fetchedAt) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("wallet")}</div>`
      + `<h2>Nincs még pénzügyi adat</h2><p>Olvasd be a Neptunból az egyenleged, tételeid és tranzakcióid.</p>`
      + `<button class="btn primary narrow" id="fin-read" style="margin-top:4px">${icon("wallet")} Beolvasás</button></div>`;
    const b = $("fin-read"); if (b) b.onclick = () => openDataSync(["finance"]);
    return;
  }
  const accts = f.accounts || [], main = accts.find((a) => a.currency === "HUF") || accts[0];
  let html = "";
  // 1) Balance hero
  if (main) {
    html += `<div class="card cred-hero"><div class="ch-num">${ftFt(main.balance, main.currency)}</div>`
      + `<div class="ch-cap">${esc(main.label || "Egyenleg")}</div>`
      + (main.account ? `<button class="fin-acc" data-copy="${esc(main.account)}">${esc(main.account)} ${icon("copy")}</button>` : "")
      + (main.autoPayText ? `<div class="hint center" style="margin:8px 0 0">Automatikus befizetés: ${esc(main.autoPayText)}</div>` : "")
      + `</div>`;
    accts.filter((a) => a !== main).forEach((a) => {
      html += `<button class="card fin-row2" data-copy="${esc(a.account)}"><span class="row-main"><span class="row-title">${ftFt(a.balance, a.currency)}</span><span class="row-sub">${esc(a.label || a.currency)} · ${esc(a.account)}</span></span>${icon("copy")}</button>`;
    });
  }
  // 2) Sub-page rows (each opens its own full-screen page)
  const toPay = f.toPay || [], tx = f.transactions || [], sch = f.scholarships || [], inv = f.invoices || [];
  const toPaySum = toPay.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const finRow = (id, ic, title, sub, danger) => `<button class="row" data-fin="${id}" type="button">`
    + `<span class="row-ic${danger ? " danger" : ""}">${icon(ic)}</span>`
    + `<span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-chev">${icon("chev")}</span></button>`;
  html += `<div class="dash-label">Tételek</div><div class="card">`
    + finRow("tab-fin-topay", "wallet", "Befizetendő", toPay.length ? `${toPay.length} tétel · ${ftFt(toPaySum, "HUF")}` : "Nincs befizetendő", toPay.length > 0)
    + finRow("tab-fin-tx", "swap", "Tranzakciók", tx.length ? `${tx.length} tétel` : "Nincs tranzakció")
    + finRow("tab-fin-scholar", "note", "Ösztöndíjak", sch.length ? `${sch.length} tétel` : "Nincs ösztöndíj")
    + finRow("tab-fin-invoices", "doc", "Számlák", inv.length ? `${inv.length} számla` : "Nincs számla")
    + `</div>`;
  html += `<div class="hint center" style="margin-top:16px">${esc(freshText(f.fetchedAt))}</div>`;
  host.innerHTML = html;
  host.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Számlaszám másolva"); } catch (e) { toast("Számlaszám: " + b.dataset.copy); } });
  host.querySelectorAll("[data-fin]").forEach((b) => b.onclick = () => pushScreen(b.dataset.fin));
}
// ---- Pénzügyek sub-pages: all read the same state.finance, no Neptun calls ----
function finEmpty(host, msg) { if (host) host.innerHTML = `<div class="dash-empty" style="padding:22px 4px">${esc(msg)}</div>`; }
function renderFinTopay() {
  const host = $("fin-topay-scroll"); if (!host) return;
  const list = (state.finance && state.finance.toPay) || [];
  if (!list.length) return finEmpty(host, "Nincs befizetendő tételed.");
  const total = list.reduce((s, i) => s + (Number(i.value) || 0), 0);
  let html = `<div class="card cred-hero" style="padding:20px"><div class="ch-num">${ftFt(total, "HUF")}</div><div class="ch-cap">összesen befizetendő</div></div>`;
  list.forEach((i) => {
    const overdue = i.dueDate && new Date(i.dueDate) < new Date();
    html += `<div class="card fin-item"><div class="fin-item-h"><span class="fin-item-n">${esc(i.name)}</span><span class="fin-item-v">${ftFt(i.value, i.currency)}</span></div>`
      + `<div class="row-sub">${[esc(i.subjectName), esc(i.term)].filter(Boolean).join(" · ")}`
      + `${i.dueDate ? ` · <span class="${overdue ? "fin-due" : ""}">határidő ${esc(ftDate(i.dueDate))}</span>` : ""}</div></div>`;
  });
  host.innerHTML = html;
}
let finTxFilter = "all"; // "all" or a year string
function renderFinTx() {
  const host = $("fin-tx-scroll"); if (!host) return;
  const all = (state.finance && state.finance.transactions) || [];
  if (!all.length) return finEmpty(host, "Nincs tranzakció.");
  const years = Array.from(new Set(all.map((t) => t.date ? new Date(t.date).getFullYear() : null).filter(Boolean))).sort((a, b) => b - a);
  if (finTxFilter !== "all" && years.indexOf(+finTxFilter) < 0) finTxFilter = "all"; // filter no longer valid
  const list = finTxFilter === "all" ? all : all.filter((t) => t.date && new Date(t.date).getFullYear() === +finTxFilter);
  let html = `<div class="controls" style="margin-bottom:12px"><button class="period-btn" type="button"><span>${finTxFilter === "all" ? "Összes időszak" : esc(finTxFilter)}</span>${icon("down")}</button></div><div class="card">`;
  list.forEach((t) => {
    const pos = t.sign === "+";
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(t.direction || t.type)}</span><span class="row-sub">${esc(ftDate(t.date))}${t.note ? " · " + esc(t.note) : ""}</span></span>`
      + `<span class="fin-amt ${pos ? "pos" : "neg"}">${pos ? "+" : "−"}${ftFt(t.value, t.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
  const pb = host.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: finTxFilter,
    items: [{ value: "all", label: "Összes időszak" }].concat(years.map((y) => ({ value: String(y), label: String(y) }))),
    onPick: (v) => { finTxFilter = v; renderFinTx(); } });
}
function renderFinScholar() {
  const host = $("fin-scholar-scroll"); if (!host) return;
  const list = (state.finance && state.finance.scholarships) || [];
  if (!list.length) return finEmpty(host, "Nincs ösztöndíj vagy kifizetés.");
  let html = `<div class="card">`;
  list.forEach((s) => {
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${[esc(s.term), esc(s.status), esc(ftDate(s.date))].filter(Boolean).join(" · ")}</span></span><span class="fin-amt pos">${ftFt(s.amount, s.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}
function renderFinInvoices() {
  const host = $("fin-invoices-scroll"); if (!host) return;
  const list = (state.finance && state.finance.invoices) || [];
  if (!list.length) return finEmpty(host, "Nincs számla.");
  let html = `<div class="card">`;
  list.forEach((v) => {
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(v.name || v.number)}</span><span class="row-sub">${[esc(v.number), esc(ftDate(v.date))].filter(Boolean).join(" · ")}</span></span><span class="fin-amt">${ftFt(v.value, v.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}
// Refresh ONLY the finance data (topic-scoped) — used by the top-right button and pull-to-refresh.
// Uses direct HTTP (getApiSession coalesces the token fetch), so no "flow busy" blocking. A silent
// re-entrancy guard just ignores a second trigger while one is already running.
let refreshingFin = false;
async function refreshFinance(viaButton) {
  if (isOffline()) { toast("Nincs internet. A mentett adatokat látod."); return; }
  if (refreshingFin) return;
  refreshingFin = true;
  if (viaButton) showBusy("Pénzügyek frissítése…", true);
  let r; try { await totpTick(); r = await syncFinance(); } catch (e) { r = { ok: false }; }
  finally { refreshingFin = false; if (viaButton) hideBusy(); }
  renderFinance();
  toast(r && r.ok ? "Pénzügyek frissítve." : "Nem sikerült frissíteni.");
}
