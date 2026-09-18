// Több fül: egy lap, élő értékekkel, testreszabható sorrenddel.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  MORE — one page, every feature one tap away (napló rows with a live value on the right)
// =====================================================================
// Global "Adatok frissítése" lives ONLY here (Eszközök) + the per-screen refresh icon.
const MORE_GROUPS = [
  { id: "study", label: "Tanulmányok" },
  { id: "money", label: "Pénz és üzenetek" },
  { id: "plan", label: "Tervezés és ügyintézés" },
  { id: "tools", label: "Eszközök" },
];
// val(): the live figure on the right ({ t, big, acc }) or null. desc: a one-line description.
const MORE_SERVICES = [
  { id: "grades", group: "study", label: "Jegyek", icon: "note", desc: "Korrigált kreditindex", go: () => pushScreen("tab-grades"),
    val: () => { const i = state.grades && state.grades.averages && state.grades.averages.indices; return i && i.korrigalt != null ? { t: fmtIdx(i.korrigalt), big: true } : null; } },
  { id: "courses", group: "study", label: "Tárgyak", icon: "book", desc: "Felvett tárgyak és mintatanterv", go: () => pushScreen("tab-courses"),
    val: () => { const l = (state.courses && state.courses.list) || [], k = currentSemesterKey(), n = l.filter((c) => c.semester === k).length; return n ? { t: n + " tárgy" } : null; } },
  { id: "credit", group: "study", label: "Kredit", icon: "chart", desc: "Előrehaladás", go: () => pushScreen("tab-credit"),
    val: () => { const p = state.progress; return p && p.total ? { t: p.done + " / " + p.total, big: true } : null; } },
  { id: "periods", group: "study", label: "Időszakok", icon: "clock", desc: "Mikor mettől meddig", go: () => pushScreen("tab-periods"),
    val: () => { const p = state.periods, a = p && activePeriods(p.items).length; return a ? { t: a + " aktív", acc: true } : null; } },
  { id: "materials", group: "study", label: "Anyagok", icon: "doc", desc: "PDF-ek és jegyzetek", go: () => pushScreen("tab-mats"),
    val: () => { const n = (state.materials || []).length; return n ? { t: n + " anyag" } : null; } },
  { id: "books", group: "study", label: "Könyvek", icon: "books", desc: "Olvasás, jegyzetek, ingyenes könyvek", go: () => pushScreen("tab-books"),
    val: () => { const n = (state.books || []).length; return n ? { t: n + " könyv" } : null; } },
  { id: "quizzes", group: "study", label: "Quizek", icon: "quiz", desc: "Gyakorlás ZH-ra és vizsgára", go: () => pushScreen("tab-quizzes"),
    val: () => { const n = (state.quizzes || []).length; return n ? { t: n + " quiz" } : null; } },
  { id: "finance", group: "money", label: "Pénzügyek", icon: "wallet", desc: "Gyűjtőszámla", go: () => pushScreen("tab-finance"),
    val: () => { const f = state.finance, a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); return a && a.balance != null ? { t: a.balance.toLocaleString("hu") + " Ft", big: true } : null; } },
  { id: "messages", group: "money", label: "Üzenetek", icon: "mail", desc: "Neptun üzenetek", go: () => pushScreen("tab-messages"),
    val: () => { const m = state.messages; return m && m.unread ? { t: m.unread + " új", acc: true } : null; } },
  { id: "friends", group: "money", label: "Barátok", icon: "user", desc: "Csoporttársak az óráidról", go: () => pushScreen("tab-friends"),
    val: () => { const n = Object.keys(state.friends || {}).length; return n ? { t: String(n) } : null; } },
  { id: "calc", group: "plan", label: "Kalkulátor", icon: "chart", desc: "Átlag, kreditindex, célszámítás", go: () => pushScreen("tab-calc") },
  { id: "reg-course", group: "plan", label: "Tárgyfelvétel", icon: "plus", desc: "Tervezés és felvétel", go: () => pushScreen("tab-plans"),
    val: () => { const n = (state.plans || []).length; return n ? { t: n + " tervezet" } : null; } },
  { id: "reg-exam", group: "plan", label: "Vizsgajelentkezés", icon: "clipboard", desc: "Automatikus jelentkezés", soon: true },
  { id: "export", group: "tools", label: "Export", icon: "download", desc: "Órarend, jegyek képként vagy CSV-ben", go: () => pushScreen("tab-export") },
  { id: "sync", group: "tools", label: "Adatok frissítése", icon: "refresh", desc: "Beolvasás a Neptunból", go: () => openDataSync(null) },
  { id: "dlc", group: "tools", label: "Kiegészítők", icon: "down", desc: "Szak letöltések", go: () => openDlc() },
];
// Saved order: state.moreLayout = { groups: [gid…], items: { gid: [sid…] } }. Unknown/new entries keep
// their default place at the end, so adding a feature later never hides it.
function moreLayout(src) {
  const l = src || state.moreLayout || {};
  const order = (saved, all) => (Array.isArray(saved) ? saved.filter((x) => all.includes(x)) : []).concat(all.filter((x) => !(saved || []).includes(x)));
  const groups = order(l.groups, MORE_GROUPS.map((g) => g.id));
  const items = {};
  groups.forEach((g) => { items[g] = order(l.items && l.items[g], MORE_SERVICES.filter((s) => s.group === g).map((s) => s.id)); });
  return { groups, items };
}
function moreRow(s) {
  const v = !s.soon && s.val ? s.val() : null;
  const right = s.soon ? `<span class="more-v">Hamarosan</span>` : v ? `<span class="more-v${v.big ? " big" : ""}${v.acc ? " acc" : ""}">${esc(v.t)}</span>` : `<span class="row-chev">${icon("chev")}</span>`;
  return `<button class="row more-row${s.soon ? " soon" : ""}" data-svc="${s.id}"${s.soon ? " disabled" : ""} type="button">`
    + `<span class="row-ic">${icon(s.icon)}</span>`
    + `<span class="row-main"><span class="row-title">${esc(s.label)}</span><span class="row-sub">${esc(s.desc)}</span></span>${right}</button>`;
}
function renderMore() {
  const host = $("more-scroll"); if (!host) return;
  const L = moreLayout();
  host.innerHTML = L.groups.map((g) => {
    const grp = MORE_GROUPS.find((x) => x.id === g);
    return `<h3 class="ma-h">${esc(grp.label)}</h3><div class="card">` + L.items[g].map((id) => moreRow(MORE_SERVICES.find((s) => s.id === id))).join("") + `</div>`;
  }).join("");
  host.querySelectorAll("[data-svc]").forEach((b) => { const s = MORE_SERVICES.find((x) => x.id === b.dataset.svc); if (s && s.go) b.onclick = s.go; });
}
// ---- Testreszabás: csoportok sorrendje + csoporton belüli sorrend (húzással), Mégse/Mentés ----
let moreEdit = null;
function moreDirty() { return JSON.stringify(moreEdit) !== JSON.stringify(moreLayout()); }
function updateMoreBar() { const b = $("more-savebar"); if (b) b.hidden = !moreDirty(); }
function renderMoreEdit() {
  const host = $("more-edit-scroll"); if (!host) return;
  if (!moreEdit) moreEdit = moreLayout();
  const edRow = (id, title, sub) => `<div class="row hub-ed" data-id="${esc(id)}"><span class="heb-grip" data-grip title="Húzd az átrendezéshez">${icon("grip")}</span>`
    + `<span class="row-main"><span class="row-title">${esc(title)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ""}</span></div>`;
  let h = `<p class="hub-ed-intro">Húzd a fogantyúnál, vagy tartsd lenyomva a sort az átrendezéshez. A módosítások a Mentés gombbal véglegesednek.</p>`;
  h += `<h3 class="ma-h">Csoportok sorrendje</h3><div class="card" data-sort="groups">`
    + moreEdit.groups.map((g) => edRow(g, MORE_GROUPS.find((x) => x.id === g).label, moreEdit.items[g].map((id) => MORE_SERVICES.find((s) => s.id === id).label).join(" · "))).join("") + `</div>`;
  moreEdit.groups.forEach((g) => {
    h += `<h3 class="ma-h">${esc(MORE_GROUPS.find((x) => x.id === g).label)}</h3><div class="card" data-sort="${esc(g)}">`
      + moreEdit.items[g].map((id) => edRow(id, MORE_SERVICES.find((s) => s.id === id).label, "")).join("") + `</div>`;
  });
  host.innerHTML = h;
  host.querySelectorAll("[data-sort]").forEach((card) => attachHubDrag(card, (order) => {
    if (card.dataset.sort === "groups") { moreEdit.groups = order; renderMoreEdit(); } else moreEdit.items[card.dataset.sort] = order;
    updateMoreBar();
  }));
  updateMoreBar();
}
{ const b = $("more-edit"); if (b) b.onclick = () => { moreEdit = moreLayout(); pushScreen("tab-more-edit"); }; }
{ const c = $("more-cancel"); if (c) c.onclick = () => { moreEdit = moreLayout(); renderMoreEdit(); }; }
{ const s = $("more-save"); if (s) s.onclick = () => { if (moreEdit) { state.moreLayout = JSON.parse(JSON.stringify(moreEdit)); saveState(); renderMore(); } updateMoreBar(); toast("Több menü elmentve."); }; }
