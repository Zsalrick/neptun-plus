// Alkalmazászár (PIN, biometria).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  APP LOCK (PIN + biometrics, relock on focus)
// =====================================================================
let isLocked = false, lockEntry = "", lockVerifyCb = null;
function lockActive() { return !!(state.setupComplete && state.pinHash); }
function lockNow() {
  if (!lockActive() || isLocked || lockVerifyCb) return;
  isLocked = true; lockEntry = ""; $("lock-cancel").hidden = true;
  const hint = $("lock-hint"); hint.classList.remove("err"); hint.textContent = "Add meg a kódot a folytatáshoz.";
  $("lock").classList.remove("hidden");
  renderLock(); maybeBio();
}
// Is this security gate switched on? (defaults to on when unset)
function secOn(kind) { return !state.security || state.security[kind] !== false; }
// Ask for auth only if a PIN exists AND this gate is enabled; otherwise pass through.
function requireAuthFor(kind) { return (!state.pinHash || !secOn(kind)) ? Promise.resolve(true) : requireAuth(); }
// Ask for PIN or biometric without treating the app as locked (used before deleting data).
function requireAuth() {
  return new Promise((resolve) => {
    if (!state.pinHash) { resolve(true); return; }
    lockVerifyCb = resolve; lockEntry = "";
    const hint = $("lock-hint"); hint.classList.remove("err"); hint.textContent = "Igazold magad a folytatáshoz.";
    $("lock-cancel").hidden = false;
    $("lock").classList.remove("hidden");
    renderLock(); maybeBio();
  });
}
function lockSuccess() {
  if (lockVerifyCb) { const cb = lockVerifyCb; lockVerifyCb = null; $("lock-cancel").hidden = true; if (!isLocked) $("lock").classList.add("hidden"); cb(true); }
  else { isLocked = false; $("lock").classList.add("hidden"); } // data already auto-fetched on the splash — no popup
}
function renderLock() {
  const useBio = state.biometric && bioOK;
  buildKeypad($("lock-keypad"), { onDigit: lockDigit, onBack: lockBack, action: useBio ? { icon: "fingerprint", onClick: maybeBio } : null });
  renderDots($("lock-dots"), lockEntry.length);
}
function lockDigit(d) { if (lockEntry.length >= 4) return; lockEntry += d; renderDots($("lock-dots"), lockEntry.length); if (lockEntry.length === 4) setTimeout(lockCheck, 110); }
function lockBack() { lockEntry = lockEntry.slice(0, -1); renderDots($("lock-dots"), lockEntry.length); }
async function lockCheck() {
  const h = await sha256hex(lockEntry);
  if (h === state.pinHash) { lockSuccess(); }
  else { lockEntry = ""; renderDots($("lock-dots"), 0); const el = $("lock-hint"); el.classList.add("err"); el.textContent = "Hibás kód, próbáld újra."; }
}
async function maybeBio() { if (!(state.biometric && bioOK)) return; try { await bioVerify(); lockSuccess(); } catch { /* fall back to PIN */ } }
$("lock-cancel").onclick = () => { if (lockVerifyCb) { const cb = lockVerifyCb; lockVerifyCb = null; $("lock-cancel").hidden = true; if (!isLocked) $("lock").classList.add("hidden"); cb(false); } };
// Anyag olvasása vagy jegyzetelése közben a visszatérés NE zároljon (gyors appváltás, fájlválasztó,
// megosztás): a zárolás elhalasztódik, és akkor jön, amikor a felhasználó kilép az Anyagokból.
const LOCK_DEFER_SCREENS = ["tab-mats", "tab-mat-subject", "tab-mat-view", "tab-mat-toc", "tab-books", "tab-book-search"];
let lockDeferred = false;
function lockOnResume() {
  if (!secOn("resume")) return;
  const cur = document.querySelector(".tabscreen.active");
  if (cur && LOCK_DEFER_SCREENS.includes(cur.id)) { if (lockActive()) lockDeferred = true; return; }
  lockNow();
}
// A navigáció hívja: ha el volt halasztva a zárolás, és az Anyagokon KÍVÜLRE lépünk, most zárolunk.
function lockCheckDeferred(nextScreenId) {
  if (!lockDeferred || LOCK_DEFER_SCREENS.includes(nextScreenId)) return;
  lockDeferred = false; lockNow();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") lockOnResume(); });
