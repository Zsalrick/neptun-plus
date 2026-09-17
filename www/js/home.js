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
function hubCard(cls) { const b = document.createElement("button"); b.type = "button"; b.className = "card " + (cls || ""); return b; }
function openTab(tab) { if (typeof MAIN_TABS !== "undefined" && MAIN_TABS.includes(tab)) navTo(tab); else pushScreen(tab); }
const HUB_WIDGETS = [
  { id: "current-class", label: "Jelenlegi óra", desc: "A most zajló órád, amíg tart.", render(host) { const e = currentClass(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Jelenlegi óra", "tab-timetable", true); } },
  { id: "next-class", label: "Következő óra", desc: "A soron következő órád ideje és terme.", render(host) { const e = nextClass(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Óra", "tab-timetable"); } },
  { id: "next-exam", label: "Következő számonkérés", desc: "A legközelebbi ZH vagy vizsga, hátralévő napokkal.", render(host) { const e = nextAssessment(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Számonkérés", "tab-exams", false, true); } },
  { id: "credit", label: "Kreditek", desc: "Teljesített kreditek aránya és mérősávja.", render(host) { const p = state.progress; if (!p || !p.total) return; const pct = Math.round(p.done / p.total * 100); const el = hubCard("cred clickable"); el.onclick = () => pushScreen("tab-credit"); el.innerHTML = `<div class="cred-row"><div><div class="cred-big">${p.done} / ${p.total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${pct}%</div></div><div class="cred-bar"><div class="cred-fill" style="width:${pct}%"></div></div>`; host.appendChild(el); } },
  { id: "messages", label: "Olvasatlan üzenetek", desc: "Hány olvasatlan Neptun üzeneted van.", render(host) { const m = state.messages; if (!m || !m.fetchedAt) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-messages"); el.innerHTML = `<span class="hs-ic">${icon("mail")}</span><span class="hs-main"><span class="hs-val">${m.unread || 0}</span><span class="hs-lbl">olvasatlan üzenet</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "balance", label: "Egyenleg", desc: "A gyűjtőszámlád aktuális egyenlege.", render(host) { const f = state.finance; const a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); if (!a || a.balance == null) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-finance"); el.innerHTML = `<span class="hs-ic">${icon("wallet")}</span><span class="hs-main"><span class="hs-val">${a.balance.toLocaleString("hu")} Ft</span><span class="hs-lbl">gyűjtőszámla egyenleg</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "grades", label: "Átlag / kreditindex", desc: "A korrigált kreditindexed egy pillantásra.", render(host) { const gr = state.grades; const i = gr && gr.averages && gr.averages.indices; if (!i || i.korrigalt == null) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-grades"); el.innerHTML = `<span class="hs-ic">${icon("note")}</span><span class="hs-main"><span class="hs-val">${esc(String(i.korrigalt))}</span><span class="hs-lbl">korrigált kreditindex${i.termName ? " · " + esc(i.termName) : ""}</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "sync", label: "Adatok állapota", desc: "Jelzi, ha adat hiányzik, és egy gombbal frissít.", render(host) { if (!canAutoLogin()) return; const missing = DATA_TASKS.filter((t) => !t.has()); const el = hubCard("next-card"); const row = (ic, head, title, meta) => `<div class="nc-row"><span class="nc-time nc-ic">${icon(ic)}</span><div class="nc-body"><div class="nc-head">${head}</div><div class="nc-title">${title}</div><div class="nc-meta">${meta}</div></div><span class="nc-chev">${icon("chev")}</span></div>`; if (missing.length) { el.classList.add("sync-cta"); el.innerHTML = row("down", "Adatok", "Szükséges adatok beolvasása", "Hiányzik: " + esc(missing.map((t) => t.label).join(", "))); el.onclick = () => openDataSync(missing.map((t) => t.id)); } else { el.innerHTML = row("refresh", "Adatok", "Adatok frissítése", "Órarend, félévek, kredit, tárgyak"); el.onclick = () => openDataSync(null); } host.appendChild(el); } },
];
[["courses", "Tárgyak", "book", "tab-courses"], ["timetable", "Órarend", "calendar", "tab-timetable"], ["credit", "Kredit", "chart", "tab-credit"], ["messages", "Üzenetek", "mail", "tab-messages"], ["finance", "Pénzügyek", "wallet", "tab-finance"]]
  .forEach(([id, label, ic, tab]) => HUB_WIDGETS.push({ id: "sc-" + id, label: label + " gomb", desc: "Gyors ugrás a " + label + " oldalra.", render(host) { const el = hubCard("hub-shortcut"); el.onclick = () => openTab(tab); el.innerHTML = `<span class="row-ic">${icon(ic)}</span><span class="row-title">${esc(label)}</span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } }));
const DEFAULT_HUB = ["current-class", "next-class", "next-exam", "sync"];
function hubLayout() { const l = Array.isArray(state.hubLayout) ? state.hubLayout : DEFAULT_HUB; return l.filter((id) => HUB_WIDGETS.some((w) => w.id === id)); }
function renderHub() {
  const host = $("hub-widgets"); if (!host) return;
  host.innerHTML = "";
  hubLayout().forEach((id) => { const w = HUB_WIDGETS.find((x) => x.id === id); try { if (w) w.render(host); } catch (e) {} });
  // Egymás utáni lista-jellegű widgetek egy közös, halvány felületre kerülnek (belül vonalakkal), nem külön kártyákba.
  let group = null;
  [...host.children].forEach((el) => {
    if (!el.matches(".next-card, .hub-stat, .hub-shortcut")) { group = null; return; }
    if (!group) { group = document.createElement("div"); group.className = "hub-group"; host.insertBefore(group, el); }
    el.classList.remove("card"); group.appendChild(el);
  });
  if (!host.children.length) host.innerHTML = `<div class="dash-empty" style="padding:24px 20px 6px">Nincs megjeleníthető adat. Olvasd be a Neptunból, vagy szabd testre a kezdőlapot.</div>`;
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
function attachHubDrag(card) {
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
    if (active) { hubEdit = [...card.querySelectorAll(".hub-ed")].map((r) => r.dataset.id); updateHubBar(); }
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
