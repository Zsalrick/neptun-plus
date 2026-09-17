// Navigáció: képernyők, vissza gomb, fül-váltás, húzásos lapozás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  TABS
// =====================================================================
const MAIN_TABS = ["tab-home", "tab-timetable", "tab-exams", "tab-more"];
// Sub-screens are reached from within the app (grid tiles, rows, back buttons), not the bottom nav.
// The nav bar hides while any non-main screen is open. Nesting (Beállítások → Védelem → …) is tracked
// by navStack: pushScreen remembers where we came from, popScreen / hardware-back returns there.
let lastMainTab = "tab-home";
let navStack = []; // parent screen ids below the current one; empty at a root main tab
function pushScreen(id) {
  const cur = document.querySelector(".tabscreen.active");
  if (cur && cur.id !== id) navStack.push(cur.id);
  showTab(id, 1); // slide in from the right (native push)
}
function popScreen() {
  const cur = document.querySelector(".tabscreen.active");
  if (cur && cur.id === "tab-set-account" && accountDirty()) { promptSaveAccount(); return; } // guard unsaved edits
  const prev = navStack.pop() || lastMainTab;
  showTab(prev, -1); // slide back to the left
}
// Leaving the account page with unsaved changes → ask to save or discard, then leave.
async function promptSaveAccount() {
  const u = $("in-username").value.slice(0, 255);
  const rows = [];
  if (u !== (state.username || "")) rows.push(esc(state.username || "—") + " → " + esc(u || "—"));
  if ($("in-password").value !== (state.password || "")) rows.push("jelszó módosítva");
  const ok = await ask({ title: "Mented a változásokat?", okText: "Mentés", cancelText: "Elvetés", body: rows.join("<br>") });
  if (ok) { if (!saveAccount()) return; } // save failed (empty) → stay
  else { $("in-username").value = state.username || ""; $("in-password").value = state.password || ""; $("in-username-err").hidden = true; }
  refreshAccountBar();
  const prev = navStack.pop() || lastMainTab; showTab(prev, -1);
}
function renderForTab(id) {
  if (id === "tab-home") renderHome();
  else if (id === "tab-timetable") renderTimetable();
  else if (id === "tab-exams") renderExams();
  else if (id === "tab-more") renderMore();
  else if (id === "tab-more-cat") renderMoreCat();
  else if (id === "tab-hub-edit") renderHubEdit();
  else if (id === "tab-courses") renderCourses();
  else if (id === "tab-subject") renderSubject();
  else if (id === "tab-grades") renderGrades();
  else if (id === "tab-periods") renderPeriods();
  else if (id === "tab-search") renderSearch();
  else if (id === "tab-friends") renderFriends();
  else if (id === "tab-person") renderPerson();
  else if (id === "tab-plans") renderPlans();
  else if (id === "tab-plan") renderPlan();
  else if (id === "tab-plan-pick") renderPlanPick();
  else if (id === "tab-plan-courses") renderPlanCourses();
  else if (id === "tab-mats") renderMats();
  else if (id === "tab-mat-subject") renderMatSubject();
  else if (id === "tab-mat-view") renderMatView();
  else if (id === "tab-notifs") renderNotifs();
  else if (id === "tab-notif") renderNotifDetail();
  else if (id === "tab-export") renderExport();
  else if (id === "tab-calc") renderCalc();
  else if (id === "tab-calc-goal") renderCalcGoal();
  else if (id === "tab-credit") renderCreditPage();
  else if (id === "tab-finance") renderFinance();
  else if (id === "tab-fin-topay") renderFinTopay();
  else if (id === "tab-fin-tx") renderFinTx();
  else if (id === "tab-fin-scholar") renderFinScholar();
  else if (id === "tab-fin-invoices") renderFinInvoices();
  else if (id === "tab-messages") renderMessages();
  else if (id === "tab-msg-view") renderMsgView();
  else if (id === "tab-event") renderDetail();
  else if (id === "tab-profile") renderProfilePage();
  else if (id === "tab-set-theme") renderThemePage();
  else if (id === "tab-set-referral") renderReferral();
  else if (id === "tab-set-messages") { syncSettings(); msgReceiveRefresh(); } // fetch the live setting when this page opens
  else if (id === "tab-settings" || id.indexOf("tab-set-") === 0) syncSettings();
}
// Heavy tabs rebuild a big list; show a skeleton instantly and defer the real render until AFTER
// the slide animation, so the transition never has to wait on the DOM build (no jank).
const HEAVY_TABS = { "tab-timetable": "agenda", "tab-exams": "agenda", "tab-courses": "courses" };
function scrollElFor(id) { return id === "tab-timetable" ? $("tt-scroll") : id === "tab-exams" ? $("ex-scroll") : id === "tab-courses" ? $("co-scroll") : null; }
function skeletonHTML(kind) {
  const rows = (n, cls) => Array.from({ length: n }, () => `<div class="${cls}"></div>`).join("");
  if (kind === "courses") return `<div class="sk-wrap"><div class="sk-controls"></div>${rows(6, "sk-row")}</div>`;
  return `<div class="sk-wrap"><div class="sk-controls"></div><div class="sk-day"></div>${rows(3, "sk-event")}<div class="sk-day" style="margin-top:20px"></div>${rows(2, "sk-event")}</div>`;
}
// Debounced real render: keep the skeleton while the user is still swiping; only build the real
// (heavy) content once they've rested on a tab for a moment. Swiping away cancels the pending build,
// so the expensive render never runs during an animation → no jank on fast swipes.
let renderTimer = 0;
function cancelPendingRender() { if (renderTimer) { clearTimeout(renderTimer); renderTimer = 0; } }
function scheduleRender(id, delay) {
  cancelPendingRender();
  renderTimer = setTimeout(() => {
    renderTimer = 0;
    const act = document.querySelector(".tabscreen.active");
    if (act && act.id === id) renderForTab(id); // still resting here → build it
  }, delay);
}
// Prepare a tab for display: skeleton for heavy tabs (cheap), full render for light ones.
function prepTab(id) { cancelPendingRender(); const k = HEAVY_TABS[id]; if (k) { const el = scrollElFor(id); if (el) el.innerHTML = skeletonHTML(k); } else renderForTab(id); }
// After the transition settles, build the real content only if the user stays ~0.25s.
function afterShow(id) { if (HEAVY_TABS[id]) scheduleRender(id, 250); }
function moveNavIndicator(id) {
  const ind = $("nav-ind"); if (!ind) return;
  const btn = document.querySelector(`.nav-btn[data-tab="${id}"]`);
  if (!btn) { ind.style.opacity = "0"; return; }
  ind.style.width = btn.offsetWidth + "px";
  ind.style.transform = `translate3d(${btn.offsetLeft}px,0,0)`;
  ind.style.opacity = "1";
}
function updateNavVisibility(id) {
  const sh = $("app-shell"); if (sh) sh.classList.toggle("nav-hidden", !MAIN_TABS.includes(id));
}
function setActive(id) {
  document.querySelectorAll(".tabscreen").forEach((el) => el.classList.toggle("active", el.id === id));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  if (MAIN_TABS.includes(id)) { lastMainTab = id; moveNavIndicator(id); } else moveNavIndicator(id);
  updateNavVisibility(id);
}
function showTab(id, dir) {
  const cur = document.querySelector(".tabscreen.active");
  if (dir && cur && cur.id !== id) {
    const incoming = document.getElementById(id);
    prepTab(id); // skeleton for heavy tabs (real render deferred to afterShow), full render for light ones
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    if (MAIN_TABS.includes(id)) { lastMainTab = id; moveNavIndicator(id); }
    updateNavVisibility(id); // hide the bottom nav on sub-screens (the dir/slide path skips setActive)
    incoming.classList.add("active", "sliding"); incoming.style.transform = `translateX(${dir * 100}%)`;
    cur.classList.add("sliding");
    void incoming.offsetWidth;
    incoming.style.transform = "translateX(0)"; cur.style.transform = `translateX(${-dir * 100}%)`;
    let ended = false;
    const done = () => { if (ended) return; ended = true; cur.classList.remove("active", "sliding"); cur.style.transform = ""; incoming.classList.remove("sliding"); incoming.style.transform = ""; incoming.removeEventListener("transitionend", done); afterShow(id); };
    incoming.addEventListener("transitionend", done);
    setTimeout(done, 360); // safety if transitionend misses
    return;
  }
  renderForTab(id);
  setActive(id);
}
function navTo(id) {
  navStack = []; // tapping a root tab drops any sub-screen breadcrumb
  const cur = document.querySelector(".tabscreen.active");
  let dir = 0;
  if (cur && MAIN_TABS.includes(id) && MAIN_TABS.includes(cur.id)) dir = MAIN_TABS.indexOf(id) > MAIN_TABS.indexOf(cur.id) ? 1 : -1;
  showTab(id, dir);
}
function enterApp() { $("screen-onboarding").classList.add("hidden"); $("app-shell").classList.remove("hidden"); updateScrollPad(); requestAnimationFrame(updateScrollPad); setTimeout(updateScrollPad, 350); }
function showOnboardingScreen() { $("app-shell").classList.add("hidden"); $("screen-onboarding").classList.remove("hidden"); }
// Reserve enough bottom padding in every scroll area to clear the nav bar — measured live, so it
// stays correct at any text size (large fonts make the nav taller).
function updateScrollPad() {
  const nav = document.querySelector(".nav-island"); if (!nav) return;
  const r = nav.getBoundingClientRect();
  const pad = Math.max(0, Math.round(window.innerHeight - r.top) + 24);
  if (pad > 0) document.documentElement.style.setProperty("--scroll-pad", pad + "px");
}
document.querySelectorAll(".nav-btn").forEach((b) => b.onclick = () => navTo(b.dataset.tab));
document.querySelectorAll("[data-settings]").forEach((b) => b.onclick = () => pushScreen("tab-settings"));
// The notification bell lives on every main page's topbar — wire them all once.
document.querySelectorAll(".notif-bell").forEach((b) => b.onclick = () => pushScreen("tab-notifs"));
// Every sub-screen back arrow (topbar) pops the nav stack — one handler for all of them.
document.querySelectorAll("[data-back]").forEach((b) => b.onclick = popScreen);
// Settings hub rows that open a settings sub-page.
document.querySelectorAll("[data-setpage]").forEach((b) => b.onclick = () => pushScreen(b.dataset.setpage));
{ const cr = $("credit-refresh"); if (cr) cr.onclick = () => refreshCredit(true); }
{ const fr = $("finance-refresh"); if (fr) fr.onclick = () => refreshFinance(true); }
{ const mr = $("messages-refresh"); if (mr) mr.onclick = () => refreshMessages(true); }
{ const gr = $("grades-refresh"); if (gr) gr.onclick = () => refreshGrades(true); }
{ const pr = $("periods-refresh"); if (pr) pr.onclick = () => refreshPeriods(true); }
{ const he = $("hub-edit"); if (he) he.onclick = () => { hubEdit = hubLayout().slice(); pushScreen("tab-hub-edit"); }; }
window.addEventListener("resize", () => { const a = document.querySelector(".tabscreen.active"); if (a) moveNavIndicator(a.id); updateScrollPad(); });

// Interactive pager: pages follow the finger, and the nav indicator tracks the drag.
// Smoothness: nav-button geometry is cached at gesture start (no per-frame layout reads),
// all writes are batched into one requestAnimationFrame, and panes ride their own GPU layer
// (translate3d + will-change via .dragging) so the browser only composites — never reflows.
(function () {
  const host = document.querySelector(".tab-host"); if (!host) return;
  const swErr = (t) => t.closest(".chips, input, textarea");
  let navRects = {};
  const cacheNavRects = () => { navRects = {}; document.querySelectorAll(".nav-btn").forEach((b) => { navRects[b.dataset.tab] = { left: b.offsetLeft, w: b.offsetWidth }; }); };
  window.addEventListener("resize", cacheNavRects);
  let active = false, startX = 0, startY = 0, decided = 0, curEl = null, nbrEl = null, dir = 0, w = 0, curIdx = 0, lastDx = 0;
  let raf = 0, pendingDx = 0;
  // A settle animation runs for 300ms after release. If a new gesture starts during it, snap that
  // animation to its end first — otherwise two panes hold `.active` and the next drag grabs the wrong one.
  let pendingFin = null, pendingTimer = 0;
  const runPending = () => { const f = pendingFin; pendingFin = null; if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; } if (f) f(); };

  const applyFrame = () => {
    raf = 0;
    if (!active || !decided) return;
    const d = nbrEl ? pendingDx : pendingDx * 0.3; // rubber-band when there's no neighbour
    curEl.style.transform = "translate3d(" + d + "px,0,0)";
    if (nbrEl) nbrEl.style.transform = "translate3d(" + (dir * w + d) + "px,0,0)";
    // The bottom-bar indicator is NOT dragged frame-by-frame (that stutters); it glides on its own
    // CSS transition toward the target tab, decided in touchmove — smooth and decoupled from the page.
  };

  host.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || swErr(e.target)) { active = false; return; }
    if (document.querySelector(".backdrop:not(.hidden)") || !$("lock").classList.contains("hidden")) { active = false; return; }
    runPending(); // finish any in-flight slide so the DOM has exactly one active pane
    cancelPendingRender(); // if a heavy render was queued, drop it — we're moving again
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const cur = document.querySelector(".tabscreen.active"); curIdx = MAIN_TABS.indexOf(cur ? cur.id : "");
    if (curIdx < 0) { active = false; return; }
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; w = host.offsetWidth || 360;
    curEl = cur; nbrEl = null; dir = 0; decided = 0; lastDx = 0; pendingDx = 0; active = true;
    cacheNavRects();
  }, { passive: true });

  host.addEventListener("touchmove", (e) => {
    if (!active) return;
    const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if (!decided) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        decided = 1;
        curEl.style.transition = "none"; curEl.classList.add("dragging");
        // leave the nav indicator's CSS transition intact so it glides smoothly
      } else if (Math.abs(dy) > 8) { active = false; return; } else return;
    }
    e.preventDefault();
    lastDx = dx;
    const ndir = dx < 0 ? 1 : -1;
    if (dir !== ndir) {
      if (nbrEl) { nbrEl.classList.remove("active", "dragging"); nbrEl.style.transition = ""; nbrEl.style.transform = ""; }
      dir = ndir;
      const ni = curIdx + dir;
      nbrEl = (ni >= 0 && ni < MAIN_TABS.length) ? document.getElementById(MAIN_TABS[ni]) : null;
      if (nbrEl) { prepTab(nbrEl.id); nbrEl.classList.add("active", "dragging"); nbrEl.style.transition = "none"; nbrEl.style.transform = "translate3d(" + (dir * w) + "px,0,0)"; }
      moveNavIndicator((nbrEl || curEl).id); // glide the pill toward the destination tab (CSS transition)
    }
    pendingDx = dx;
    if (!raf) raf = requestAnimationFrame(applyFrame); // coalesce all moves into one paint per frame
  }, { passive: false });

  const settle = () => {
    if (!active) return; active = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const ind = $("nav-ind"); if (ind) ind.style.transition = "";
    if (!decided) { if (curEl) curEl.classList.remove("dragging"); return; }
    const commit = nbrEl && Math.abs(lastDx) > w * 0.25;
    curEl.style.transition = ""; curEl.classList.add("sliding");
    if (nbrEl) { nbrEl.style.transition = ""; nbrEl.classList.add("sliding"); }
    const from = curEl, to = nbrEl;
    let done = false;
    const clear = (el) => { if (el) { el.classList.remove("sliding", "dragging"); el.style.transform = ""; el.style.transition = ""; } };
    if (commit) {
      from.style.transform = "translate3d(" + (-dir * w) + "px,0,0)"; to.style.transform = "translate3d(0,0,0)";
      const fin = () => {
        if (done) return; done = true; if (pendingFin === fin) pendingFin = null;
        to.removeEventListener("transitionend", fin);
        from.classList.remove("active"); clear(from); clear(to);
        lastMainTab = to.id; document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === to.id)); moveNavIndicator(to.id);
        afterShow(to.id); // swap the skeleton for the real content now that the slide is done
      };
      pendingFin = fin; to.addEventListener("transitionend", fin); pendingTimer = setTimeout(fin, 340);
    } else {
      from.style.transform = "translate3d(0,0,0)"; if (to) to.style.transform = "translate3d(" + (dir * w) + "px,0,0)";
      const fin = () => {
        if (done) return; done = true; if (pendingFin === fin) pendingFin = null;
        from.removeEventListener("transitionend", fin);
        clear(from); if (to) { to.classList.remove("active"); clear(to); }
        moveNavIndicator(from.id);
      };
      pendingFin = fin; from.addEventListener("transitionend", fin); pendingTimer = setTimeout(fin, 340);
    }
  };
  host.addEventListener("touchend", settle, { passive: true });
  host.addEventListener("touchcancel", settle, { passive: true });
})();
