// Kiegészítők (szak letöltések) és számlatükör-néző.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  DLC / add-ons (szak-specific downloads from GitHub)
// =====================================================================
const DLC_INDEX_URL = "https://raw.githubusercontent.com/Zsalrick/neptun-plus/main/dlc/index.json";
let dlcIndex = null;
$("dlc-close").onclick = () => $("dlc-sheet").classList.add("hidden");
$("acc-close").onclick = () => $("accounts-sheet").classList.add("hidden");
async function openDlc() {
  $("dlc-sheet").classList.remove("hidden");
  renderDlcList(); // cached view first
  try { const r = await fetch(DLC_INDEX_URL, { cache: "no-store" }); if (r.ok) { dlcIndex = await r.json(); renderDlcList(); } } catch (e) { /* offline: keep cached */ }
}
function dlcMeta(id) { return ((dlcIndex && dlcIndex.dlc) || []).find((d) => d.id === id); }
function renderDlcList() {
  const host = $("dlc-list"); if (!host) return;
  const cat = (dlcIndex && dlcIndex.dlc) || [], downloaded = state.dlc || {}, seen = {}, rows = [];
  cat.forEach((d) => { seen[d.id] = 1; rows.push({ m: d, have: downloaded[d.id], newer: downloaded[d.id] && downloaded[d.id].version !== d.version }); });
  Object.keys(downloaded).forEach((id) => { if (!seen[id]) rows.push({ m: { id, title: downloaded[id].title, subtitle: "" }, have: downloaded[id] }); });
  if (!rows.length) { host.innerHTML = `<div class="hint center" style="margin:14px 0">Nincs elérhető kiegészítő. Ellenőrizd az internetkapcsolatot.</div>`; return; }
  host.innerHTML = rows.map((r) => {
    const d = r.m;
    const act = !r.have ? `<button class="btn primary narrow dlc-get" data-id="${esc(d.id)}">Letöltés</button>`
      : r.newer ? `<button class="btn primary narrow dlc-get" data-id="${esc(d.id)}">Frissítés</button>`
      : `<button class="btn tonal narrow dlc-open" data-id="${esc(d.id)}">Megnyitás</button>`;
    const open = (r.have && r.newer) ? `<button class="btn outline narrow dlc-open" data-id="${esc(d.id)}">Megnyitás</button>` : "";
    return `<div class="dlc-row"><div class="dlc-main"><div class="dlc-title">${esc(d.title || d.id)}</div><div class="dlc-sub">${esc(d.subtitle || d.for || "")}</div></div><div class="dlc-actions">${act}${open}</div></div>`;
  }).join("");
  host.querySelectorAll(".dlc-get").forEach((b) => b.onclick = () => downloadDlc(b.dataset.id));
  host.querySelectorAll(".dlc-open").forEach((b) => b.onclick = () => openDlcItem(b.dataset.id));
}
async function downloadDlc(id) {
  const meta = dlcMeta(id); if (!meta || !meta.data) return toast("Nincs letöltési forrás.");
  showBusy("Letöltés…");
  try {
    const r = await fetch(meta.data, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    state.dlc = state.dlc || {};
    state.dlc[id] = { version: meta.version || data.version || "", title: meta.title || data.title || id, kind: meta.kind || data.kind || "accounts", items: data.items || [] };
    saveState(); renderDlcList(); openDlcItem(id); toast("Letöltve: " + (meta.title || id));
  } catch (e) { toast("Letöltés sikertelen: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
}
function openDlcItem(id) {
  const d = (state.dlc || {})[id]; if (!d) return;
  if (d.kind === "accounts") openAccounts(d); else toast("Ismeretlen kiegészítő típus.");
}
// ----- accounts viewer: számlaosztály filter + search + hierarchy (lazy-rendered) -----
let accItems = [], accClass = "", accFiltered = [], accShown = 0;
const ACC_PAGE = 150; // rows rendered per chunk; more load as you scroll
const ACC_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const accDigits = (n) => n.split("-")[0];               // leading number of a range like "12-16"
const accLvl = (n) => Math.min(4, accDigits(n).length); // 1=osztály … 4=alszámla
function accClassName(c) {
  const it = accItems.find((x) => x.n === c);
  const nm = it ? it.t.replace(/^sz[aá]mlaoszt[aá]ly\s*[–-]?\s*/i, "").trim() : "";
  return c + (nm ? " · " + nm : ". számlaosztály");
}
function openAccounts(d) {
  accItems = d.items || [];
  accClass = ""; $("acc-class-lbl").textContent = "Összes osztály";
  $("acc-title").textContent = d.title || "Számlatükör";
  $("acc-search").value = "";
  $("dlc-sheet").classList.add("hidden");
  $("accounts-sheet").classList.remove("hidden");
  renderAccounts("");
}
$("acc-class").onclick = () => {
  const items = [{ value: "", label: "Összes osztály" }].concat(ACC_ORDER.filter((c) => accItems.some((x) => accDigits(x.n)[0] === c)).map((c) => ({ value: c, label: accClassName(c) })));
  openList({ title: "Számlaosztály", selected: accClass, items, onPick: (v) => { accClass = v; $("acc-class-lbl").textContent = v ? accClassName(v) : "Összes osztály"; renderAccounts($("acc-search").value); } });
};
function accRowHtml(it) {
  const lvl = accLvl(it.n);
  let rails = ""; for (let i = 1; i < lvl; i++) rails += `<span class="acc-rail"></span>`; // one vertical guide per nesting level
  return `<div class="acc-row lvl${lvl}">${rails}<span class="acc-n">${esc(it.n)}</span><span class="acc-t">${esc(it.t)}</span></div>`;
}
function renderAccounts(q) {
  q = (q || "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  accFiltered = accItems;
  if (accClass) accFiltered = accFiltered.filter((it) => accDigits(it.n)[0] === accClass);
  if (q) accFiltered = accFiltered.filter((it) => (digits && it.n.indexOf(digits) === 0) || it.t.toLowerCase().indexOf(q) >= 0);
  const host = $("acc-list"); host.scrollTop = 0; accShown = 0;
  if (!accFiltered.length) { host.innerHTML = `<div class="hint center" style="margin:16px 0">Nincs találat.</div>`; return; }
  host.innerHTML = ""; appendAccounts();
}
function appendAccounts() {
  const host = $("acc-list"); if (!host) return;
  const next = accFiltered.slice(accShown, accShown + ACC_PAGE);
  if (!next.length) return;
  host.insertAdjacentHTML("beforeend", next.map(accRowHtml).join(""));
  accShown += next.length;
}
$("acc-list").addEventListener("scroll", (e) => {
  const el = e.target;
  if (accShown < accFiltered.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) appendAccounts();
});
$("acc-search").addEventListener("input", (e) => renderAccounts(e.target.value));
