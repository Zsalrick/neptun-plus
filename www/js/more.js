// Több fül: szolgáltatás-rács és kategóriák.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  MORE (services grid) — scales to the features coming later
// =====================================================================
// Grouped so the hub is scannable (no flat wall of tiles). Global "Adatok frissítése" lives ONLY here
// (in Eszközök) + the per-screen refresh icon — the Kezdőlap stays a clean, glanceable dashboard.
const MORE_SERVICES = [
  { id: "materials", group: "Tanulmányok", label: "Anyagok", sub: () => { const n = (state.materials || []).length; return n ? n + " anyag" : "PDF-ek és jegyzetek a tárgyaidhoz"; }, icon: "doc", go: () => pushScreen("tab-mats") },
  { id: "courses", group: "Tanulmányok", label: "Tárgyak", sub: "Felvett és mintatanterv", icon: "book", go: () => pushScreen("tab-courses") },
  { id: "credit", group: "Tanulmányok", label: "Kredit", sub: () => { const p = state.progress; return (p && p.total) ? `${p.done} / ${p.total} kredit · ${Math.round(p.done / p.total * 100)}%` : "Előrehaladás"; }, icon: "chart", go: () => pushScreen("tab-credit") },
  { id: "grades", group: "Tanulmányok", label: "Jegyek", sub: () => { const gr = state.grades; const i = gr && gr.averages && gr.averages.indices; return i && i.korrigalt != null ? "Kreditindex " + i.korrigalt : "Jegyek és átlagok"; }, icon: "note", go: () => pushScreen("tab-grades") },
  { id: "finance", group: "Szolgáltatások", label: "Pénzügyek", sub: () => { const f = state.finance, a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); return a && a.balance != null ? a.balance.toLocaleString("hu") + " Ft" : "Egyenleg és tételek"; }, icon: "wallet", go: () => pushScreen("tab-finance") },
  { id: "messages", group: "Szolgáltatások", label: "Üzenetek", sub: () => { const m = state.messages; return m && m.unread ? m.unread + " olvasatlan" : (m && m.fetchedAt ? "Beérkezett és elküldött" : "Neptun üzenetek"); }, icon: "mail", go: () => pushScreen("tab-messages") },
  { id: "friends", group: "Szolgáltatások", label: "Barátok", sub: () => { const n = Object.keys(state.friends || {}).length; return n ? n + " barát" : "Csoporttársak az óráidról"; }, icon: "user", go: () => pushScreen("tab-friends") },
  { id: "export", group: "Szolgáltatások", label: "Export", sub: "Órarend, jegyek mentése (kép, CSV)", icon: "download", go: () => pushScreen("tab-export") },
  { id: "periods", group: "Tanulmányok", label: "Időszakok", sub: () => { const p = state.periods; const a = p && activePeriods(p.items).length; return a ? a + " aktív időszak" : "Mikor mettől meddig"; }, icon: "clock", go: () => pushScreen("tab-periods") },
  { id: "calc", group: "Tanulmányok", label: "Kalkulátor", sub: "Átlag, kreditindex, célszámítás", icon: "chart", go: () => pushScreen("tab-calc") },
  { id: "dlc", group: "Eszközök", label: "Kiegészítők", sub: "Szak letöltések", icon: "down", go: () => openDlc() },
  { id: "sync", group: "Eszközök", label: "Adatok frissítése", sub: "Beolvasás a Neptunból", icon: "refresh", go: () => openDataSync(null) },
  { id: "reg-course", group: "Ügyintézés", label: "Tárgyfelvétel", sub: () => { const n = (state.plans || []).length; return n ? n + " tervezet" : "Tervezés és felvétel"; }, icon: "plus", go: () => pushScreen("tab-plans") },
  { id: "reg-exam", group: "Ügyintézés", label: "Vizsgajelentkezés", sub: "Automatikus jelentkezés", icon: "clipboard", soon: true },
];
// Több is now a two-level hub: category rows → a category page with that group's tiles.
const MORE_GROUPS = ["Tanulmányok", "Szolgáltatások", "Eszközök", "Ügyintézés"];
const MORE_GROUP_ICON = { "Tanulmányok": "book", "Szolgáltatások": "grid", "Eszközök": "refresh", "Ügyintézés": "clipboard" };
let moreCat = null;
function svcTile(s) {
  return `<button class="svc${s.soon ? " soon" : ""}" data-svc="${s.id}"${s.soon ? " disabled" : ""} type="button">`
    + `<span class="svc-ic">${icon(s.icon)}</span>`
    + `<span class="svc-t">${esc(s.label)}</span>`
    + `<span class="svc-b">${esc(typeof s.sub === "function" ? s.sub() : s.sub)}</span>`
    + (s.soon ? `<span class="svc-badge">Hamarosan</span>` : "") + `</button>`;
}
function wireSvc(host) { host.querySelectorAll("[data-svc]").forEach((b) => { const s = MORE_SERVICES.find((x) => x.id === b.dataset.svc); if (s && s.go) b.onclick = s.go; }); }
function renderMore() {
  const host = $("more-scroll"); if (!host) return;
  const rows = MORE_GROUPS.map((g) => {
    const items = MORE_SERVICES.filter((s) => s.group === g); if (!items.length) return "";
    return `<button class="row" data-cat="${esc(g)}" type="button">`
      + `<span class="row-ic">${icon(MORE_GROUP_ICON[g] || "grid")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(g)}</span><span class="row-sub">${esc(items.map((s) => s.label).join(" · "))}</span></span>`
      + `<span class="row-chev">${icon("chev")}</span></button>`;
  }).join("");
  host.innerHTML = `<div class="card">${rows}</div>`;
  host.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { moreCat = b.dataset.cat; pushScreen("tab-more-cat"); });
}
// Full-screen category page: the tiles of the chosen Több category.
function renderMoreCat() {
  const host = $("more-cat-scroll"); if (!host) return;
  const g = MORE_GROUPS.indexOf(moreCat) >= 0 ? moreCat : MORE_GROUPS[0];
  const t = $("more-cat-title"); if (t) t.textContent = g;
  const items = MORE_SERVICES.filter((s) => s.group === g);
  const sub = $("more-cat-sub"); if (sub) sub.textContent = items.length + " elem";
  // Full-width row buttons — easier to read and reach than a grid of small tiles.
  const row = (s) => `<button class="row svc-row${s.soon ? " soon" : ""}" data-svc="${s.id}"${s.soon ? " disabled" : ""} type="button">`
    + `<span class="row-ic">${icon(s.icon)}</span>`
    + `<span class="row-main"><span class="row-title">${esc(s.label)}</span><span class="row-sub">${esc(typeof s.sub === "function" ? s.sub() : s.sub)}</span></span>`
    + (s.soon ? `<span class="svc-badge">Hamarosan</span>` : `<span class="row-chev">${icon("chev")}</span>`)
    + `</button>`;
  host.innerHTML = `<div class="card">${items.map(row).join("")}</div>`;
  wireSvc(host);
}
