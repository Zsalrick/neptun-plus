// Élő 2FA kód és szerverválasztó.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

let lastCode = "";
async function totpTick() {
  if (!hasTotp() || state.no2fa) return;
  try {
    const { code, secondsRemaining, period } = await generateTOTP(state.totp.secret, { digits: state.totp.digits || 6, period: state.totp.period || 30, algorithm: state.totp.algorithm || "SHA1" });
    lastCode = code;
    if ($("totp-code")) {
      $("totp-code").textContent = code.replace(/(\d{3})(\d+)/, "$1 $2");
      $("totp-seconds").textContent = secondsRemaining;
      $("ring-fg").style.strokeDashoffset = (2 * Math.PI * 19) * (1 - secondsRemaining / period);
    }
  } catch { lastCode = ""; if ($("totp-code")) $("totp-code").textContent = "hiba"; }
}
setInterval(totpTick, 1000);
$("btn-copy-code").onclick = async () => { if (!lastCode) return; try { await navigator.clipboard.writeText(lastCode); toast("Kód másolva: " + lastCode); } catch { toast("Kód: " + lastCode); } };

// server switch sheet
$("server-chip").onclick = () => {
  const list = $("server-sheet-list"); list.innerHTML = "";
  state.servers.forEach((s) => {
    const b = document.createElement("button"); b.className = "opt" + (s.id === state.activeServerId ? " selected" : ""); b.type = "button";
    b.innerHTML = `<span class="o-radio"></span><span class="o-main"><span class="o-t">${esc(s.label)}</span><span class="o-b">${esc(s.url)}</span></span>`;
    b.onclick = () => { state.activeServerId = s.id; saveState(); renderHome(); $("server-sheet").classList.add("hidden"); };
    list.appendChild(b);
  });
  $("server-sheet").classList.remove("hidden");
};
$("server-sheet-close").onclick = () => $("server-sheet").classList.add("hidden");
