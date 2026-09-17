// Ajánlói kód.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Ajánlói kód (egyelőre helyi mintakód; a végleges a backendtől jön az induláskor) ----
function referralCode() {
  if (state.refCode) return state.refCode;
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // félreérthető jelek nélkül (0/O, 1/I kihagyva)
  let c = ""; for (let i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)];
  state.refCode = c; saveState(); return c;
}
function referralShareText() {
  return "Csatlakozz a Kredit+ hoz az ajánlói kódommal: " + referralCode() + ". 31 nap ingyenes próba a 14 helyett. https://kreditplus.hu";
}
function renderReferral() {
  const host = $("referral-scroll"); if (!host) return;
  const code = referralCode();
  host.innerHTML = `<p class="hub-ed-intro">Oszd meg a kódod. Aki ezzel regisztrál, 31 nap ingyenes próbát kap a 14 helyett. Te pedig kapsz egy ingyen hónapot, amikor előfizet.</p>`
    + `<div class="dash-label">A te kódod</div>`
    + `<button class="card" id="ref-code" type="button" style="width:100%;text-align:center;padding:26px 16px;cursor:pointer">`
    + `<div style="font-family:var(--font-mono,monospace);font-size:38px;font-weight:700;letter-spacing:.18em;color:var(--fg)">${esc(code)}</div>`
    + `<div class="hint" style="margin-top:8px">Koppints a másoláshoz</div></button>`
    + `<div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">`
    + `<button class="btn primary lg" id="ref-share">${icon("send")} Megosztás</button>`
    + `<button class="btn tonal" id="ref-copy">${icon("copy")} Kód másolása</button></div>`
    + `<div class="hint center" style="margin-top:18px">Ez egyelőre mintakód. A végleges, működő ajánlói kódod a fizetős verzió indulásakor lesz aktív.</div>`;
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast("Kód másolva: " + code); } catch (e) { toast("Kód: " + code); } };
  { const b = $("ref-code"); if (b) b.onclick = copy; }
  { const b = $("ref-copy"); if (b) b.onclick = copy; }
  { const b = $("ref-share"); if (b) b.onclick = async () => { try { if (navigator.share) { await navigator.share({ text: referralShareText() }); return; } } catch (e) { if (e && e.name === "AbortError") return; } copy(); }; }
}
