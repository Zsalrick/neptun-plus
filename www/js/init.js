// Indítás: ez fut utoljára, minden más fájl után.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---------- szűrők megjegyzése (state.ui) ----------
// A képernyők szűrői (félév, nézet, szegmens) modul-szintű változókban élnek. Háttérbe lépéskor elmentjük
// őket, induláskor visszaállítjuk, így újraindítás után is az marad kiválasztva, amit a felhasználó hagyott.
// A félévhez kötött választás csak ugyanabban a félévben él: új félév kezdetén alaphelyzetbe áll, különben
// a tavalyi félévet mutatná. Az érvénytelen értéket (pl. másik profil félévét) a render maga is "Összes"-re állítja.
const UI_KEYS = {
  gradesFilter: [() => gradesFilter, (v) => { gradesFilter = v; }, true],
  coFilter: [() => coFilter, (v) => { coFilter = v; }, true],
  coSeg: [() => coSeg, (v) => { coSeg = v; }, false],
  ttFilter: [() => ttFilter, (v) => { ttFilter = v; }, true],
  exFilter: [() => exFilter, (v) => { exFilter = v; }, true],
  ttView: [() => ttView, (v) => { ttView = v; }, false],
  finTxFilter: [() => finTxFilter, (v) => { finTxFilter = v; }, false],
  periodsStatus: [() => periodsStatus, (v) => { periodsStatus = v; }, false],
  periodsTerm: [() => periodsTerm, (v) => { periodsTerm = v; }, true],
  matSem: [() => matSem, (v) => { matSem = v; }, true],
  calcTerm: [() => calcTerm, (v) => { calcTerm = v; }, true],
  msgSem: [() => msgSem, (v) => { msgSem = v; }, true],
};
function saveUiState() {
  const v = {};
  Object.keys(UI_KEYS).forEach((k) => { const x = UI_KEYS[k][0](); if (x !== null && x !== undefined && x !== "") v[k] = x; });
  state.ui = { sem: currentSemesterKey(), v };
  // CSAK a ui mezőt írjuk a tárolt állapotba, nem az egészet (nem saveState): az oldal elhagyásakor fut, és
  // ha előtte alaphelyzetbe állították vagy mentést töltöttek vissza (localStorage csere + reload), a régi
  // memóriabeli állapot különben visszaírná magát. Ha nincs tárolt állapot (épp törölték), nem írunk semmit.
  try {
    const raw = localStorage.getItem(STORE_KEY); if (!raw) return;
    const st = JSON.parse(raw); st.ui = state.ui; localStorage.setItem(STORE_KEY, JSON.stringify(st));
  } catch (e) { /* ignore */ }
}
function restoreUiState() {
  const u = state.ui; if (!u || !u.v) return;
  const sameSem = u.sem === currentSemesterKey();
  Object.keys(u.v).forEach((k) => {
    const d = UI_KEYS[k]; if (!d || (d[2] && !sameSem)) return;
    try { d[1](u.v[k]); } catch (e) {}
  });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveUiState(); });
window.addEventListener("pagehide", saveUiState);

// =====================================================================
//  INIT
// =====================================================================
renderIcons(document);
$("version-tag").textContent = APP_VERSION;
restoreUiState();
// Re-render the freshness lines + Home status when connectivity flips (offline ⇄ online).
["online", "offline"].forEach((ev) => window.addEventListener(ev, () => { try { renderHome(); const a = document.querySelector(".tabscreen.active"); if (a) renderForTab(a.id); } catch (e) {} }));
attachPTR($("tt-scroll"), $("tt-ptr"), fetchTimetable);
attachPTR($("ex-scroll"), $("ex-ptr"), fetchTimetable);
attachPTR($("credit-scroll"), $("credit-ptr"), () => refreshCredit(false));       // credit-only refresh
attachPTR($("finance-scroll"), $("finance-ptr"), () => refreshFinance(false)); // finance-only
attachPTR($("messages-scroll"), $("messages-ptr"), () => refreshMessages(false)); // messages-only
attachPTR($("grades-scroll"), $("grades-ptr"), () => refreshGrades(false)); // grades-only
attachPTR($("periods-scroll"), $("periods-ptr"), () => refreshPeriods(false)); // periods-only
attachSegSwipe($("co-scroll"), () => CO_SEGS, () => coSeg, (v) => { coSeg = v; renderCourses(); });
attachSegSwipe($("messages-scroll"), ["received", "sent"], () => msgTab, (v) => { msgTab = v; msgQuery = ""; msgSem = "all"; renderMessages(); });
attachSegSwipe(document.querySelector("#detail-sheet .sheet"), ["info", "tutors", "students", "notes"], () => detailSeg, (v) => { detailSeg = v; renderDetail(); });
if (isNative) { document.body.classList.add("native"); document.querySelectorAll("[data-preview-only]").forEach((el) => el.remove()); }
initOnboarding();

// ---------- hardware / gesture back navigation ----------
// One place decides what "back" means. Returns true if it consumed the back (stay in app),
// false only at the true root (first-run onboarding, or the home tab with nothing open) → app may exit.
function onBackNav() {
  const openBd = document.querySelector(".backdrop:not(.hidden)");
  if (openBd) { document.querySelectorAll(".backdrop:not(.hidden)").forEach((b) => b.classList.add("hidden")); return true; }
  if (!$("lock").classList.contains("hidden")) return true; // locked → ignore
  if (!$("screen-onboarding").classList.contains("hidden")) {
    if (obPos > 0) { const bk = $("ob-back"); if (bk) bk.click(); return true; }
    if (obMode === "add") { cancelAddProfile(); return true; }
    return false; // first-run onboarding, step 0 → allow exit
  }
  if (navStack.length) { popScreen(); return true; } // nested sub-screen → up one level
  const act = document.querySelector(".tabscreen.active");
  const id = act ? act.id : "";
  if (id && id !== "tab-home") { navTo("tab-home"); return true; }
  return false; // home, nothing open → allow exit
}
// Prefer the native App plugin (clean exitApp) when it's present in the APK; otherwise fall back to
// the History API, which Capacitor's WebView routes the hardware back button through — works OTA,
// no native rebuild needed.
(function setupBackButton() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) {
    App.addListener("backButton", () => { if (!onBackNav()) App.exitApp(); });
    return;
  }
  let exitHint = 0;
  window.addEventListener("popstate", () => {
    if (onBackNav()) { try { history.pushState(null, ""); } catch (e) {} return; }
    if (Date.now() - exitHint < 2000) return; // second press within 2s → let it exit
    exitHint = Date.now(); toast("Nyomd meg újra a kilépéshez"); try { history.pushState(null, ""); } catch (e) {}
  });
  try { history.pushState(null, ""); } catch (e) {}
})();

// Re-warm the Neptun session when the app returns to the foreground (resume). Real background
// keep-alive isn't reliable on Android (the WebView's timers freeze), so we simply re-authenticate
// silently on resume — fast because we hold the credentials + TOTP.
(function setupResumeWarm() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) { try { App.addListener("appStateChange", (s) => { if (s && s.isActive) warmSession("resume"); }); } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") warmSession("resume"); });
})();

// A tiny synthesized chime for the boot logo — one soft pluck per letter (ascending pentatonic),
// then a bright triad "sparkle" on the +. Web Audio only (no asset), best-effort under autoplay policy.
function playBootChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(); if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const master = ctx.createGain(); master.gain.value = 0.95; master.connect(ctx.destination);
    // short white-noise buffer reused for every "crack"
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const ch = nb.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const t0 = ctx.currentTime + 0.03;
    // One "chocolate snap": a fast bandpassed noise crack + a quick woody body pitch-drop.
    const snap = (at, bpFreq, bodyFreq, gain) => {
      const s = t0 + at;
      const src = ctx.createBufferSource(); src.buffer = nb;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = bpFreq; bp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1700; lp.Q.value = 0.5; // roll off the sharp highs → duller crack
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, s);
      ng.gain.linearRampToValueAtTime(gain, s + 0.004);              // slightly softer crack (less click)
      ng.gain.exponentialRampToValueAtTime(0.0001, s + 0.10);         // a touch longer, rounder tail
      src.connect(bp); bp.connect(lp); lp.connect(ng); ng.connect(master);
      src.start(s); src.stop(s + 0.14);
      const o = ctx.createOscillator(), og = ctx.createGain();        // woody resonance under the crack
      o.type = "triangle"; o.frequency.setValueAtTime(bodyFreq, s); o.frequency.exponentialRampToValueAtTime(bodyFreq * 0.45, s + 0.07);
      og.gain.setValueAtTime(0.0001, s); og.gain.linearRampToValueAtTime(gain * 0.8, s + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
      o.connect(og); og.connect(master); o.start(s); o.stop(s + 0.14);
    };
    // A soft-but-present snap per letter K r e d i t (CSS delays .10–.45s), slight variation.
    const times = [0.10, 0.17, 0.24, 0.31, 0.38, 0.45];
    const bp = [1400, 1300, 1550, 1350, 1600, 1450], body = [320, 290, 350, 310, 370, 330];
    times.forEach((t, i) => snap(t, bp[i], body[i], 0.5));
    snap(0.60, 1200, 230, 0.75); // the "+" — the big satisfying break
  } catch (e) {}
}
function bootSoundOn() { return state.bootSound !== false; } // default on
function setBootText(t) { const b = $("boot-text"); if (b) b.textContent = t; }
// Switch the boot loading bar to a determinate fill (0..total) that grows as each data topic lands.
function bootProgress(done, total) {
  const rule = $("boot-rule"); if (!rule) return;
  rule.classList.add("boot-rule--det");
  const fill = rule.querySelector("i"); if (!fill) return;
  const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
  fill.style.width = pct + "%";
}
function hideBoot() { const b = $("boot"); if (!b) return; b.classList.add("boot--hide"); setTimeout(() => { b.hidden = true; }, 420); }

(async () => {
  const bootTs = Date.now();
  let firstEver = false; // true only on a truly fresh install (no cached data) → hold the splash longer
  // Absolute safety net: no matter what throws or hangs below, the splash MUST come down. Without this a
  // rejected/hanging await could leave the app stuck on the loading screen forever (v0.204 regression).
  const safety = setTimeout(hideBoot, 14000);
  try {
    if (bootSoundOn()) playBootChime(); // little satisfying chime synced to the logo letters
    try { bioOK = await bioAvailable(); } catch (e) { bioOK = false; } // must not block boot if the plugin stalls
    // Cold start: behind the loading screen, check for an OTA update and apply it before login.
    if (isNative && window.OTA && window.OTA.configured()) {
      setBootText("Frissítés keresése");
      try {
        let otaFound = false;
        const checkP = window.OTA.check({ current: APP_VERSION, apply: "now",
          onFound: () => { otaFound = true; setBootText("Új verzió letöltése"); },
          onError: (e) => setBootText("Frissítés kihagyva") });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        // If GitHub hasn't answered (no update found) within 5s, stop waiting and go into the app.
        await Promise.race([checkP, wait(5000)]);
        // But if an update WAS found and is downloading, give it more time to finish + apply.
        if (otaFound) await Promise.race([checkP, wait(20000)]);
      } catch (e) { /* proceed into the app regardless */ }
    }
    setBootText("Betöltés");
    if (state.setupComplete) { enterApp(); showTab("tab-home"); if (secOn("startup")) lockNow(); }
    else {
      obStep = 0;
      obSel = state.university ? (UNIVERSITIES.find((u) => u.name === state.university) || null) : null;
      $("ob-username").value = state.username || "";
      $("ob-password").value = state.password || "";
      renderOb();
    }
    totpTick();
    if (isNative) {
      const ln = LN();
      if (ln && ln.addListener) { try { ln.addListener("localNotificationActionPerformed", (ev) => {
        const x = ev && ev.notification && ev.notification.extra; if (!x) return;
        // MINDEN értesítés az Értesítések központban nyílik meg. Ha van már napló-bejegyzése → azt;
        // ha csak "tappolásra naplózandó" (brief, emlékeztető) → most naplózzuk, majd megnyitjuk.
        let id = (x.notifId && logHas(x.notifId)) ? x.notifId : null;
        if (!id && x.logOnTap) { try { id = logNotif(Object.assign({ key: x.key }, x.logOnTap)); } catch (e) {} }
        if (id) { try { detailNotifId = id; pushScreen("tab-notif"); } catch (e) {} return; }
        try { pushScreen("tab-notifs"); } catch (e) {} // bármi más → az Értesítések lista
      }); } catch (e) {} }
      rescheduleNotifications(); // refresh reminders on every launch
      updateClassWidget(); // seed the home-screen widget from cached schedule (refreshed again after sync)
      updateStatWidgets(); // seed the stat widgets (kreditindex, egyenleg, mai órák, következő számonkérés)
      if (state.setupComplete) {
        setTimeout(dailyBackup, 2500);
        firstEver = missingTaskIds().length >= DATA_TASKS.length; // truly nothing cached (first ever launch)
        // First launch → hold the splash with the progress bar until the initial read (nothing to show yet).
        // Returning user → the app already renders last session's cached data, so reveal it immediately and
        // refresh in the background (Home shows "Adatok frissítése…"); no 2-3s wait on the network.
        if (firstEver) { try { await Promise.race([autoRefreshAll("start"), new Promise((r) => setTimeout(r, 12000))]); } catch (e) {} }
        else { autoRefreshAll("start"); } // fire-and-forget
      }
    }
  } catch (e) { try { dbg("boot: " + (e && e.message ? e.message : e)); } catch (_) {} }
  finally {
    clearTimeout(safety);
    // Let the logo animation play, then reveal. Returning users don't wait on the network so keep it snappy;
    // a fresh install just finished its blocking read above, so a touch longer is fine.
    setTimeout(hideBoot, Math.max(0, (firstEver ? 2600 : 1800) - (Date.now() - bootTs)));
  }
})();
