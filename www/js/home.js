// Kezdőlap: widgetek, szerkesztés, következő óra/számonkérés sor.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  HOME
// =====================================================================
function renderHome() {
  const srv = activeServer();
  // Show the Neptun code (immutable, tidy) rather than the login name, which can be a long custom string.
  $("disp-username").textContent = state.neptunCode || state.username || "Nincs adat";
  { const cap = document.querySelector("#tab-home .hero-cap"); if (cap) cap.textContent = state.neptunCode ? "Neptun kód" : "Azonosító"; }
  $("disp-server").textContent = (state.university || "") + (srv && state.servers.length > 1 ? " · " + srv.label : "");
  const showTotp = hasTotp() && !state.no2fa;
  $("totp-tile").classList.toggle("hidden", !showTotp);
  $("chip-no2fa").classList.toggle("hidden", !state.no2fa);
  if (showTotp) $("totp-account").textContent = state.totp.name || "2FA kód";
  const ready = !!(state.username && state.password);
  $("btn-login").disabled = !ready;
  const warm = isNative && apiSessionValid(60000);
  $("home-sub").textContent = isOffline() ? "Offline · mentett adatok" : autoRefreshing ? "Adatok frissítése…" : semLoading ? "Félévek beolvasása…" : warming ? "Munkamenet előkészítése…" : warm ? "Aktív munkamenet" : (ready ? "Készen áll" : "Állítsd be a belépést");
  $("server-chip").style.display = state.servers.length > 1 ? "" : "none";
  const hp = $("home-profile");
  if (hp) { hp.onclick = openProfilePicker; hp.classList.toggle("has-multi", (state.profiles || []).length > 1); }
  wireHubSearch();
  try { if (isNative) catchUpBrief(); } catch (e) {} // a mai reggeli összefoglaló bekerül az Értesítésekbe
  updateNotifBell();
  renderHub();
  renderHubSearch(); // a kereső nézet szinkronban a mező tartalmával (üres → főmenü)
}
// ---- Customizable Kezdőlap hub: a registry of widgets + a saved, ordered list of the enabled ones ----
// Napló koncepció: minden widget ugyanabból a sor-primitívből épül (bal oldali idő/dátum sáv, cím, meta,
// hajszálvonal). Az egymás utáni, azonos szakaszba tartozó widgetek egy fejléc alá kerülnek.
P.sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
function openTab(tab) { if (typeof MAIN_TABS !== "undefined" && MAIN_TABS.includes(tab)) navTo(tab); else pushScreen(tab); }
const HU_MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const HU_NUM = ["nulla", "egy", "két", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc", "tíz"];
const huNum = (n) => HU_NUM[n] || String(n);
const huDec = (v) => String(v).replace(".", ",");
const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Bal oldali sáv: ma → óra:perc, holnap → "holnap", később → "szept. 22."
function railWhen(d) { const n = daysUntil(d); return n === 0 ? hm(d) : n === 1 ? "holnap" : TT_MON[d.getMonth()] + " " + d.getDate() + "."; }
// Egy napló sor. `o.onclick` esetén gomb.
function maRow(o) {
  const el = document.createElement(o.onclick ? "button" : "div");
  if (o.onclick) { el.type = "button"; el.onclick = o.onclick; }
  el.className = "r" + (o.kv ? " r-kv" : "") + (o.cls ? " " + o.cls : "");
  el.innerHTML = (o.kv ? "" : `<span class="r-t">${o.t || ""}</span>`)
    + `<span class="r-b"><span class="r-n">${o.n}</span>${o.m ? `<span class="r-m">${o.m}</span>` : ""}</span>`
    + `<span class="r-x">${o.x || ""}</span>`;
  return el;
}
// A host utolsó szakasza, ha azonos kulcsú; különben új fejléc + lista.
function maSection(host, key, title) {
  const last = host.lastElementChild;
  if (last && last.classList.contains("rows") && last.dataset.sec === key) return last;
  const h = document.createElement("h3"); h.className = "ma-h"; h.textContent = title; host.appendChild(h);
  const rows = document.createElement("div"); rows.className = "rows"; rows.dataset.sec = key; host.appendChild(rows);
  return rows;
}
function classTitle(e) { const p = e.manual ? null : parseClassSummary(e.summary); return { name: p ? p.name : (e.summary || ""), type: p ? p.type : "", teacher: p ? p.teacher : "" }; }
function todaysClasses() { const now = new Date(); return visibleClassEvents().filter((e) => sameDay(e.S, now)).sort((a, b) => a.S - b.S); }
// Mai órák idővonala: a lezajlottak halványak, a "most" vonal a véget nem ért órák elé kerül.
function renderTodayTimeline(host) {
  if (host.querySelector('[data-sec="today"]')) return; // a két óra-widget egy közös idővonalat ad
  const list = todaysClasses(), now = Date.now();
  if (!list.length) {
    const e = nextClass(); if (!e) return;
    const t = classTitle(e);
    const rows = maSection(host, "today", "Következő óra");
    rows.appendChild(maRow({ t: esc(railWhen(e.S)), n: esc(t.name), m: esc([t.type, hm(e.S), e.location].filter(Boolean).join(" · ")), onclick: () => navTo("tab-timetable") }));
    return;
  }
  const rows = maSection(host, "today", "Mai órák");
  let lined = false;
  const nowLine = () => { const d = document.createElement("div"); d.className = "now-line"; d.innerHTML = `<b>${hm(new Date())}</b><i></i>`; rows.appendChild(d); lined = true; };
  list.forEach((e) => {
    const past = e.E.getTime() <= now, live = e.S.getTime() <= now && !past;
    if (!past && !lined) nowLine();
    const t = classTitle(e);
    const meta = live ? `<span class="live">Most tart</span> · ${esc([e.location, hm(e.E) + "-ig"].filter(Boolean).join(" · "))}` : esc([t.type, e.location].filter(Boolean).join(" · "));
    rows.appendChild(maRow({ t: hm(e.S), n: esc(t.name), m: meta, cls: past ? "past" : "", onclick: () => navTo("tab-timetable") }));
  });
  if (!lined) nowLine();
}
function statRow(host, label, value, meta, go) {
  maSection(host, "stats", "Áttekintés").appendChild(maRow({ kv: true, n: esc(label), m: meta ? esc(meta) : "", x: `<span class="r-v">${esc(value)}</span>`, onclick: go }));
}
const HUB_WIDGETS = [
  { id: "current-class", label: "Jelenlegi óra", desc: "A most zajló órád, amíg tart.", render(host) { renderTodayTimeline(host); } },
  { id: "next-class", label: "Következő óra", desc: "A soron következő órád ideje és terme.", render(host) { renderTodayTimeline(host); } },
  { id: "next-exam", label: "Következő számonkérés", desc: "A legközelebbi ZH vagy vizsga, hátralévő napokkal.", render(host) { const e = nextAssessment(); if (!e) return; const t = classTitle(e); maSection(host, "exam", "Hamarosan").appendChild(maRow({ t: esc(railWhen(e.S)), n: esc(t.name), m: esc([countdownPhrase(e.S), hm(e.S), e.location].filter(Boolean).join(" · ")), onclick: () => navTo("tab-exams") })); } },
  { id: "credit", label: "Kreditek", desc: "Teljesített kreditek aránya és mérősávja.", render(host) { const p = state.progress; if (!p || !p.total) return; statRow(host, "Teljesített kredit", `${p.done} / ${p.total}`, Math.round(p.done / p.total * 100) + "%", () => pushScreen("tab-credit")); } },
  { id: "messages", label: "Olvasatlan üzenetek", desc: "Hány olvasatlan Neptun üzeneted van.", render(host) { const m = state.messages; if (!m || !m.fetchedAt) return; statRow(host, "Olvasatlan üzenet", String(m.unread || 0), "", () => pushScreen("tab-messages")); } },
  { id: "balance", label: "Egyenleg", desc: "A gyűjtőszámlád aktuális egyenlege.", render(host) { const f = state.finance; const a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); if (!a || a.balance == null) return; statRow(host, "Gyűjtőszámla", a.balance.toLocaleString("hu") + " Ft", "egyenleg", () => pushScreen("tab-finance")); } },
  { id: "grades", label: "Átlag / kreditindex", desc: "A korrigált kreditindexed egy pillantásra.", render(host) { const gr = state.grades; const i = gr && gr.averages && gr.averages.indices; if (!i || i.korrigalt == null) return; statRow(host, "Korrigált kreditindex", huDec(i.korrigalt), i.termName || "", () => pushScreen("tab-grades")); } },
  { id: "sync", label: "Adatok állapota", desc: "Jelzi, ha adat hiányzik, és egy gombbal frissít.", render(host) { if (!canAutoLogin()) return; const missing = DATA_TASKS.filter((t) => !t.has()); const rows = maSection(host, "sync", "Adatok"); if (missing.length) rows.appendChild(maRow({ kv: true, cls: "r-cta", n: "Szükséges adatok beolvasása", m: "Hiányzik: " + esc(missing.map((t) => t.label).join(", ")), x: icon("down"), onclick: () => openDataSync(missing.map((t) => t.id)) })); else rows.appendChild(maRow({ kv: true, n: "Adatok frissítése", m: "Órarend, félévek, kredit, tárgyak", x: icon("refresh"), onclick: () => openDataSync(null) })); } },
];
[["courses", "Tárgyak", "book", "tab-courses"], ["timetable", "Órarend", "calendar", "tab-timetable"], ["credit", "Kredit", "chart", "tab-credit"], ["messages", "Üzenetek", "mail", "tab-messages"], ["finance", "Pénzügyek", "wallet", "tab-finance"]]
  .forEach(([id, label, ic, tab]) => HUB_WIDGETS.push({ id: "sc-" + id, label: label + " gomb", desc: "Gyors ugrás a " + label + " oldalra.", render(host) { maSection(host, "go", "Ugrás").appendChild(maRow({ kv: true, n: esc(label), x: icon("chev"), onclick: () => openTab(tab) })); } }));
const DEFAULT_HUB = ["current-class", "next-class", "next-exam", "sync"];
function hubLayout() { const l = Array.isArray(state.hubLayout) ? state.hubLayout : DEFAULT_HUB; return l.filter((id) => HUB_WIDGETS.some((w) => w.id === id)); }
// Egy mondat a napról, csak tényekből (órarend + számonkérések). Ha nincs órarend, nincs mondat.
function dayLede() {
  const parts = [];
  if ((state.ics && (state.ics.events || []).length)) {
    const list = todaysClasses(), now = Date.now();
    const live = list.find((e) => e.S.getTime() <= now && e.E.getTime() > now);
    const next = list.find((e) => e.S.getTime() > now);
    if (!list.length) parts.push("Ma nincs órád.");
    else if (live) parts.push(`${capFirst(huNum(list.length))} órád van ma, <b>${list.length === 1 ? "éppen most tart" : "egy éppen most tart"}.</b>`);
    else if (next) parts.push(`${capFirst(huNum(list.length))} órád van ma, a következő <b>${hm(next.S)}-kor</b> kezdődik.`);
    else parts.push(`Mára végeztél, ${huNum(list.length)} órád volt.`);
  }
  const ex = nextAssessment();
  if (ex) parts.push(`A következő számonkérés ${daysUntil(ex.S) <= 1 ? "<b>" + countdownPhrase(ex.S) + "</b>" : countdownPhrase(ex.S)}.`);
  return parts.join(" ");
}
function renderHub() {
  const host = $("hub-widgets"); if (!host) return;
  const d = new Date();
  host.innerHTML = `<div class="ma-date">${capFirst(TT_DAYS[d.getDay()])}<span>${HU_MONTHS[d.getMonth()]} ${d.getDate()}.</span></div>`;
  const lede = dayLede(); if (lede) host.insertAdjacentHTML("beforeend", `<p class="ma-lede">${lede}</p>`);
  const before = host.children.length;
  hubLayout().forEach((id) => { const w = HUB_WIDGETS.find((x) => x.id === id); try { if (w) w.render(host); } catch (e) {} });
  if (host.children.length === before) host.insertAdjacentHTML("beforeend", `<div class="dash-empty">Nincs megjeleníthető adat. Olvasd be a Neptunból, vagy szabd testre a kezdőlapot a ceruzával.</div>`);
}
// Staged editing: `hubEdit` is a working copy; only Save writes state.hubLayout. Reorder by dragging
// the grip; a floating Mégse/Mentés bar appears while the working copy differs from what's saved.
let hubEdit = null;
function hubDirty() { return JSON.stringify(hubEdit || []) !== JSON.stringify(hubLayout()); }
function updateHubBar() { const b = $("hub-savebar"); if (b) b.hidden = !hubDirty(); }
function renderHubEdit() {
  const host = $("hub-edit-scroll"); if (!host) return;
  if (!hubEdit) hubEdit = hubLayout().slice();
  const enabled = hubEdit.map((id) => HUB_WIDGETS.find((w) => w.id === id)).filter(Boolean);
  const disabled = HUB_WIDGETS.filter((w) => hubEdit.indexOf(w.id) < 0);
  const descLine = (w) => w.desc ? `<span class="row-sub hub-ed-desc">${esc(w.desc)}</span>` : "";
  let h = `<p class="hub-ed-intro">Húzd a fogantyúnál a sorrend átrendezéséhez. A módosítások a Mentés gombbal véglegesednek.</p>`;
  h += `<div class="dash-label">Megjelenő elemek</div>`;
  if (!enabled.length) h += `<div class="dash-empty" style="padding:16px 4px">Nincs bekapcsolt elem. Adj hozzá lentről egyet.</div>`;
  else {
    h += `<div class="card" id="hub-enabled">`;
    enabled.forEach((w) => { h += `<div class="row hub-ed" data-id="${esc(w.id)}">`
      + `<span class="heb-grip" data-grip title="Húzd az átrendezéshez">${icon("grip")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(w.label)}</span>${descLine(w)}</span>`
      + `<button class="iconbtn plain heb heb-off" data-off="${esc(w.id)}" title="Elrejtés">${icon("x")}</button>`
      + `</div>`; });
    h += `</div>`;
  }
  if (disabled.length) { h += `<div class="dash-label">Hozzáadható elemek</div><div class="card">`
    + disabled.map((w) => `<button class="row" data-on="${esc(w.id)}" type="button"><span class="row-ic">${icon("plus")}</span><span class="row-main"><span class="row-title">${esc(w.label)}</span>${descLine(w)}</span><span class="row-chev">${icon("chev")}</span></button>`).join("")
    + `</div>`; }
  host.innerHTML = h;
  host.querySelectorAll("[data-off]").forEach((b) => b.onclick = () => { hubEdit = hubEdit.filter((id) => id !== b.dataset.off); renderHubEdit(); updateHubBar(); });
  host.querySelectorAll("[data-on]").forEach((b) => b.onclick = () => { hubEdit = hubEdit.concat(b.dataset.on); renderHubEdit(); updateHubBar(); });
  const card = $("hub-enabled"); if (card) attachHubDrag(card);
  updateHubBar();
}
// Touch drag-to-reorder within the enabled card. Start a drag either by grabbing the grip (immediate)
// or by LONG-PRESSING anywhere on the row (~350ms; cancelled if the finger moves first, so normal
// scrolling still works). The lifted row live-swaps past neighbours as the finger crosses their
// midpoints; on release the working copy is rebuilt from the DOM order.
function attachHubDrag(card, onDone) { // onDone(order) → a hívó kezeli; nélküle a Kezdőlap szerkesztője
  let active = false, startY = 0, row = null, moveDoc = null, endDoc = null;
  const swap = (y) => {
    for (const sib of card.querySelectorAll(".hub-ed")) {
      if (sib === row) continue;
      const r = sib.getBoundingClientRect(), mid = r.top + r.height / 2;
      const after = row.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (after && y > mid) { card.insertBefore(row, sib.nextSibling); startY = y; row.style.transform = ""; break; }
      if (!after && y < mid) { card.insertBefore(row, sib); startY = y; row.style.transform = ""; break; }
    }
  };
  const finish = () => {
    if (moveDoc) document.removeEventListener("touchmove", moveDoc, { passive: false });
    document.removeEventListener("touchend", endDoc); document.removeEventListener("touchcancel", endDoc);
    if (row) { row.classList.remove("drag-lift"); row.style.transform = ""; }
    if (active) { const order = [...card.querySelectorAll(".hub-ed")].map((r) => r.dataset.id); if (onDone) onDone(order); else { hubEdit = order; updateHubBar(); } }
    active = false; row = null; moveDoc = null; endDoc = null;
  };
  const begin = (r, y) => {
    if (active) return;
    active = true; row = r; startY = y; r.classList.add("drag-lift");
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    moveDoc = (ev) => { ev.preventDefault(); const cy = ev.touches[0].clientY; row.style.transform = "translateY(" + (cy - startY) + "px)"; swap(cy); };
    endDoc = finish;
    document.addEventListener("touchmove", moveDoc, { passive: false });
    document.addEventListener("touchend", endDoc); document.addEventListener("touchcancel", endDoc);
  };
  card.querySelectorAll(".hub-ed").forEach((r) => {
    r.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || active) return;
      const grip = e.target.closest && e.target.closest("[data-grip]");
      if (grip) { e.preventDefault(); begin(r, e.touches[0].clientY); return; }
      if (e.target.closest && e.target.closest("[data-off]")) return; // let the × button work
      // Long-press anywhere else on the row starts the drag; a finger move first cancels it (= scroll).
      const sx = e.touches[0].clientX, sy = e.touches[0].clientY;
      let timer = setTimeout(() => { timer = 0; cleanup(); begin(r, sy); }, 350);
      const onMove = (ev) => { const t = ev.touches[0]; if (Math.abs(t.clientY - sy) > 10 || Math.abs(t.clientX - sx) > 10) { if (timer) { clearTimeout(timer); timer = 0; } cleanup(); } };
      const cleanup = () => { r.removeEventListener("touchmove", onMove); r.removeEventListener("touchend", onEnd); r.removeEventListener("touchcancel", onEnd); };
      const onEnd = () => { if (timer) { clearTimeout(timer); timer = 0; } cleanup(); };
      r.addEventListener("touchmove", onMove, { passive: true });
      r.addEventListener("touchend", onEnd); r.addEventListener("touchcancel", onEnd);
    }, { passive: false });
  });
}
{ const c = $("hub-cancel"); if (c) c.onclick = () => { hubEdit = hubLayout().slice(); renderHubEdit(); updateHubBar(); }; }
{ const s = $("hub-save"); if (s) s.onclick = () => { if (hubEdit) { state.hubLayout = hubEdit.slice(); saveState(); renderHub(); } updateHubBar(); toast("Kezdőlap elmentve."); }; }
function daysUntil(d) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(d); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }
function countdownPhrase(d) { const n = daysUntil(d); return n <= 0 ? "ma" : n === 1 ? "holnap" : n + " nap múlva"; }
function dueDaysSuffix(d) { const n = daysUntil(d); return n < 0 ? " · lejárt" : n === 0 ? " · ma esedékes" : n === 1 ? " · holnap esedékes" : " · " + n + " nap múlva esedékes"; }
function nextIsland(el, e, headText, tab, now, countdown) {
  if (!el) return;
  el.classList.toggle("nc-now", !!now);
  if (!e) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const time = now ? `${hm(e.S)}-${hm(e.E)}` : hm(e.S);
  const p = e.manual ? null : parseClassSummary(e.summary);
  const title = p ? p.name : (e.summary || "");
  let meta = (p ? [p.type, p.teacher, e.location] : [e.location]).filter(Boolean).join(" · ");
  // Számonkérésnél a fejlécben "N nap múlva", a dátum a meta sorba kerül.
  let head = `${headText} · ${dayHeading(e.S)}`;
  if (countdown) { head = `${headText} · ${countdownPhrase(e.S)}`; meta = [dayHeading(e.S), meta].filter(Boolean).join(" · "); }
  el.innerHTML = `<div class="nc-row"><span class="nc-time">${time}</span>`
    + `<div class="nc-body"><div class="nc-head">${esc(head)}</div><div class="nc-title">${esc(title)}</div>${meta ? `<div class="nc-meta">${esc(meta)}</div>` : ""}</div>`
    + `<span class="nc-chev">${icon("chev")}</span></div>`;
  el.onclick = () => navTo(tab);
}
function renderNextClass() {
  nextIsland($("current-class"), currentClass(), "Jelenlegi óra", "tab-timetable", true);
  nextIsland($("next-class"), nextClass(), "Következő óra", "tab-timetable");
}
function renderNextExam() { nextIsland($("next-exam"), nextAssessment(), "Következő számonkérés", "tab-exams", false, true); }
