// Első indítás: egyetem, 2FA/QR beolvasás, PIN, beállítási lépések.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Egy fiókban egy egyetem csak egyszer lehet (a képzésváltás a profilon belül megy), és létrehozás után
// az egyetem és az azonosító nem módosítható: így egy app nem adható körbe több embernek.
function otherProfiles() { return (state.profiles || []).filter((p) => p.id !== state.activeProfileId); }
function uniTaken(name) { return otherProfiles().some((p) => p.university === name); }
function hostOf(url) { try { return new URL(/^https?:\/\//.test(url) ? url : "https://" + url).hostname.toLowerCase(); } catch (e) { return ""; } }
function hostTaken(url) { const h = hostOf(url); return !!h && otherProfiles().some((p) => (p.servers || []).some((s) => hostOf(s.url) === h)); }
// A profil létrejött (a belépés ellenőrzése után): az azonosító innentől csak látható. Az egyetem akkor, ha már
// be van állítva (régebbi profiloknál üres lehet, azt egyszer még ki lehet választani).
function profileLocked() { return !!state.setupComplete && obMode !== "add" && !!state.username; }
function uniLocked() { return profileLocked() && !!state.university; }
function applyUniversity(uni) {
  state.servers = uni.servers.map((s, i) => ({ id: "u" + i, label: s.label, url: s.url }));
  state.activeServerId = "u0";
  state.university = uni.name;
  saveState();
}
function applyCustom(label, url) {
  if (!/^https?:\/\//.test(url)) url = "https://" + url;
  state.servers = [{ id: "custom", label: label || "Egyéni", url }];
  state.activeServerId = "custom";
  state.university = label || "Egyéni";
  saveState();
}

// ---------- QR ----------
async function decodeQrFile(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const res = window.jsQR(img.data, w, h);
  if (!res) throw new Error("Nem sikerült QR‑kódot beolvasni a képből.");
  return parseMigrationUri(res.data);
}
// A single tappable "találat" card. Tapping asks for confirmation, then sets the 2FA key.
function makeAcctCard(a, after) {
  const div = document.createElement("div");
  div.className = "acct";
  div.innerHTML = `<div style="flex:1;min-width:0"><div class="a-t">${esc(a.name || a.issuer || "(névtelen)")}</div>
    <div class="a-b">${a.issuer ? esc(a.issuer) + " · " : ""}${a.digits || 6} számjegy · ${esc(a.algorithm || "SHA1")}</div></div>${icon("chev")}`;
  div.onclick = async () => {
    const label = a.name || a.issuer || "kiválasztott";
    const ok = await ask({ title: "Neptun 2FA beállítása",
      body: `A(z) <b>${esc(label)}</b> fiókot állítod be a Neptun bejelentkezés 2FA kódjához. Jó lesz?`,
      okText: "Igen, beállítom" });
    if (!ok) return;
    state.totp = { secret: a.secret, digits: a.digits || 6, period: 30, algorithm: a.algorithm || "SHA1", name: a.name || a.issuer || "2FA" };
    state.no2fa = false; saveState();
    after && after(); toast("2FA fiók beállítva.");
  };
  return div;
}
function renderQrAccounts(container, accounts, after) {
  container.innerHTML = `<div class="hint">${accounts.length} fiók a képen, koppints a Neptunhoz tartozóra:</div>`;
  accounts.forEach((a) => container.appendChild(makeAcctCard(a, after)));
}
async function handleQrPick(e, container, after) {
  const file = e.target.files[0]; if (!file) return;
  container.innerHTML = `<div class="hint">Feldolgozás…</div>`;
  try {
    const accounts = await decodeQrFile(file);
    if (!accounts.length) throw new Error("Nem található TOTP fiók a képen.");
    renderQrAccounts(container, accounts, after);
  } catch (err) { container.innerHTML = `<div class="hint err">Hiba: ${esc(err.message)}</div>`; }
  finally { e.target.value = ""; }
}

// ---------- university list rendering (shared) ----------
function initials(name) {
  const map = { "Pannon Egyetem": "PE", "Eötvös Loránd Tudományegyetem": "ELTE", "Budapesti Műszaki és Gazdaságtudományi Egyetem": "BME",
    "Szegedi Tudományegyetem": "SZTE", "Debreceni Egyetem": "DE", "Pécsi Tudományegyetem": "PTE", "Budapesti Corvinus Egyetem": "BCE",
    "Óbudai Egyetem": "ÓE", "Széchenyi István Egyetem": "SZE", "Miskolci Egyetem": "ME" };
  if (map[name]) return map[name];
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
// taken(u): igaz, ha az egyetem nem választható (már van ilyen profil); szürkén, magyarázattal jelenik meg.
function renderUniList(container, query, selectedName, onPick, taken) {
  const q = (query || "").trim().toLowerCase();
  const items = UNIVERSITIES.filter((u) => !q || (u.name + " " + u.city + " " + (u.alias || "")).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));
  container.innerHTML = "";
  if (!items.length) { container.innerHTML = `<div class="uni-empty">Nincs találat. Használd az „egyéni URL" opciót.</div>`; return; }
  items.forEach((u) => {
    const div = document.createElement("div");
    const off = !!(taken && taken(u));
    div.className = "uni-item" + (u.name === selectedName ? " selected" : "") + (off ? " off" : "");
    div.innerHTML = `<span class="u-flag">${esc(initials(u.name))}</span>
      <span style="flex:1;min-width:0"><div class="u-name">${esc(u.name)}</div><div class="u-city">${esc(off ? "Már van ilyen profilod" : u.city)}</div></span>
      <span class="u-check">${icon("check")}</span>`;
    if (off) div.setAttribute("aria-disabled", "true");
    div.onclick = () => { if (off) toast("Ehhez az egyetemhez már van profilod. A képzést a profilon belül tudod váltani."); else onPick(u); };
    container.appendChild(div);
  });
}

// =====================================================================
//  ONBOARDING
// =====================================================================
let obSeq = [0, 1, 2, 3, 4, 5, 6]; // data-step sequence; add-profile mode uses a shorter one (no payment)
let obPos = 0;                  // index into obSeq
let obStep = 0;                 // = obSeq[obPos]
let obMode = "";                // "" normal setup, "add" adding another profile
let obSel = null; // university object, or "custom", or null
let obPin = "", obFirst = null, obPinDone = false;
let obPlan = null; // "monthly" | "semester" | "annual" — placeholder plan pick (not persisted yet)

function updateObProgress() {
  $("ob-bar").style.width = ((obPos + 1) / obSeq.length * 100) + "%";
  $("ob-count").textContent = `${obPos + 1} / ${obSeq.length}`;
}
function obStepValid() {
  if (obStep === 0) return state.legalAccepted;
  if (obStep === 1) {
    if (obSel === "custom") { const url = $("ob-custom-url").value.trim(); return !!url && !hostTaken(url); }
    return !!obSel && !uniTaken(obSel.name);
  }
  if (obStep === 2) return !!state.username && !!state.password;
  if (obStep === 3) return obPinDone;
  if (obStep === 4) return true; // biometrics is optional
  if (obStep === 5) return hasTotp() || state.no2fa;
  if (obStep === 6) return !!obPlan;
  return true;
}
function updateObFooter() {
  $("ob-back").style.visibility = (obPos === 0 && obMode !== "add") ? "hidden" : "visible";
  $("ob-next").textContent = obStep === 6 ? "Ingyenes próbaidőszak indítása"
    : (obPos === obSeq.length - 1) ? "Befejezés" : "Tovább";
  $("ob-next").disabled = !obStepValid();
}
function renderOb() {
  document.querySelectorAll("#screen-onboarding .ob-step").forEach((el) => el.classList.toggle("active", Number(el.dataset.step) === obStep));
  $("ob-body").scrollTop = 0;
  if (obStep === 0) $("ob-legal").classList.toggle("on", state.legalAccepted);
  if (obStep === 1) renderObUni();
  if (obStep === 3) { if (state.pinHash) obPinDone = true; if (!obPinDone) { obPin = ""; obFirst = null; } renderObPin(); }
  if (obStep === 4) renderObBio();
  if (obStep === 5) renderObTwoFA();
  if (obStep === 6) renderObPlan();
  updateObProgress(); updateObFooter();
}
function renderObBio() {
  const note = $("ob-bio-note");
  const yes = $("ob-bio-yes");
  if (!bioOK) {
    // Device can't do biometrics right now: force off, disable the "yes" choice, explain why.
    if (state.biometric) { state.biometric = false; saveState(); }
    yes.disabled = true; yes.classList.add("disabled");
    note.hidden = false;
  } else {
    yes.disabled = false; yes.classList.remove("disabled");
    note.hidden = true;
  }
  yes.classList.toggle("selected", state.biometric);
  $("ob-bio-no").classList.toggle("selected", !state.biometric);
}
function renderObPin() {
  if (obPinDone) {
    renderDots($("ob-pin-dots"), 4);
    $("ob-pin-sub").textContent = "A kód beállítva. Léphetsz tovább.";
    buildKeypad($("ob-keypad"), { onDigit: () => {}, onBack: () => { obPinDone = false; obPin = ""; obFirst = null; renderObPin(); updateObFooter(); } });
    return;
  }
  buildKeypad($("ob-keypad"), { onDigit: obPinDigit, onBack: obPinBack });
  renderDots($("ob-pin-dots"), obPin.length);
  $("ob-pin-sub").textContent = obFirst === null
    ? "Adj meg egy 4 számjegyű kódot. Ezt kéri majd az app minden megnyitáskor."
    : "Írd be újra a kódot a megerősítéshez.";
}
function obPinDigit(d) { if (obPin.length >= 4) return; obPin += d; renderDots($("ob-pin-dots"), obPin.length); if (obPin.length === 4) setTimeout(obPinComplete, 130); }
function obPinBack() { obPin = obPin.slice(0, -1); renderDots($("ob-pin-dots"), obPin.length); }
async function obPinComplete() {
  if (obFirst === null) { obFirst = obPin; obPin = ""; renderDots($("ob-pin-dots"), 0); $("ob-pin-sub").textContent = "Írd be újra a kódot a megerősítéshez."; }
  else if (obPin === obFirst) { state.pinHash = await sha256hex(obPin); obPinDone = true; saveState(); renderObPin(); updateObFooter(); toast("Kód beállítva."); }
  else { obFirst = null; obPin = ""; renderDots($("ob-pin-dots"), 0); $("ob-pin-sub").textContent = "A két kód nem egyezett, kezdd elölről."; }
}
function renderObUni() {
  const selName = (obSel && obSel !== "custom") ? obSel.name : null;
  renderUniList($("ob-uni-list"), $("ob-uni-search").value, selName, (u) => {
    obSel = u; $("ob-custom-wrap").classList.add("hidden");
    $("ob-uni-custom").classList.remove("selected");
    renderObUni(); updateObFooter();
  }, (u) => uniTaken(u.name));
  $("ob-uni-custom").classList.toggle("selected", obSel === "custom");
}
let ob2faChoice = null; // 'no' | 'yes' | null
let obDevSkipAuth = false; // DEV: skip the live Neptun login check on the 2FA step
function renderObStatus() {
  $("ob-2fa-status").innerHTML = hasTotp() ? `<div class="status-pill ok">${icon("check")} Beállítva: ${esc(state.totp.name)}</div>` : "";
}
function renderObTwoFA() {
  if (ob2faChoice === null) ob2faChoice = state.no2fa ? "no" : (hasTotp() ? "yes" : null);
  $("ob-2fa-no").classList.toggle("selected", ob2faChoice === "no");
  $("ob-2fa-yes").classList.toggle("selected", ob2faChoice === "yes");
  $("ob-2fa-setup").classList.toggle("hidden", ob2faChoice !== "yes");
  renderObStatus();
}
function renderObPlan() {
  if (obPlan === null) obPlan = "annual"; // preselect the best-value plan
  document.querySelectorAll("#ob-plans .plan").forEach((b) => b.classList.toggle("selected", b.dataset.plan === obPlan));
}
function commitObStep1() {
  if (obSel === "custom") applyCustom($("ob-custom-label").value.trim(), $("ob-custom-url").value.trim());
  else if (obSel) applyUniversity(obSel);
}
function finishOnboarding() {
  if (obMode === "add") {
    obMode = ""; obSeq = [0, 1, 2, 3, 4, 5, 6]; obPos = 0; obStep = 0;
    dataSyncOffered = false; saveState();
    enterApp(); showTab("tab-home"); renderHome();
    toast("Profil hozzáadva.");
    setTimeout(() => bootFetch("account"), 400); // new profile → auto-read everything on the splash, no popup
    return;
  }
  state.setupComplete = true; saveState();
  enterApp(); showTab("tab-home");
  toast("Beállítás kész, kezdheted.");
  setTimeout(() => bootFetch("start"), 400); // first setup → auto-read everything on the splash, no popup
}
function initOnboarding() {
  $("ob-next").onclick = async () => {
    if (!obStepValid()) return;
    // After the 2FA step we have the full credentials — try a real Neptun login before proceeding.
    // Success also fetches + stores the immutable Neptun code (getApiSession). DEV checkbox skips it.
    if (obStep === 5 && !obDevSkipAuth && isNative) {
      showBusy("Belépés ellenőrzése…", true);
      let ok = false;
      try { await totpTick(); const sess = await getApiSession(true); ok = !!(sess && sess.token); }
      catch (e) { ok = false; }
      finally { hideBusy(); }
      if (!ok) { toast("A belépés nem sikerült. Ellenőrizd az azonosítót, a jelszót és a 2FA kódot."); return; }
    }
    if (obStep === 1) commitObStep1();
    if (obPos === obSeq.length - 1) return finishOnboarding();
    obPos++; obStep = obSeq[obPos]; renderOb();
  };
  $("ob-back").onclick = () => {
    if (obPos > 0) { obPos--; obStep = obSeq[obPos]; renderOb(); }
    else if (obMode === "add") cancelAddProfile();
  };
  $("ob-legal").onclick = () => { state.legalAccepted = !state.legalAccepted; saveState(); $("ob-legal").classList.toggle("on", state.legalAccepted); updateObFooter(); };
  { const d = $("ob-dev-skip"); if (d) d.onclick = () => { obDevSkipAuth = !obDevSkipAuth; d.classList.toggle("on", obDevSkipAuth); }; }
  $("open-privacy").onclick = () => $("privacy-sheet").classList.remove("hidden");
  $("open-terms").onclick = () => $("terms-sheet").classList.remove("hidden");
  $("ob-uni-search").addEventListener("input", renderObUni);
  $("ob-uni-custom").onclick = () => { obSel = "custom"; $("ob-custom-wrap").classList.remove("hidden"); renderObUni(); updateObFooter(); };
  $("ob-custom-url").addEventListener("input", () => {
    updateObFooter();
    if (hostTaken($("ob-custom-url").value.trim())) toast("Ehhez a Neptun-címhez már van profilod.");
  });
  $("ob-username").addEventListener("input", (e) => {
    const v = e.target.value.slice(0, 255); e.target.value = v; state.username = v; saveState();
    $("ob-username-err").hidden = v.length > 0;
    updateObFooter();
  });
  $("ob-password").addEventListener("input", (e) => { state.password = e.target.value; saveState(); updateObFooter(); });
  $("ob-bio-yes").onclick = () => { if (!bioOK) return; state.biometric = true; saveState(); renderObBio(); };
  $("ob-bio-no").onclick = () => { state.biometric = false; saveState(); renderObBio(); };
  $("ob-show-pass").onclick = async () => { const el = $("ob-password"); if (el.type !== "password") { el.type = "password"; return; } if (!(await requireAuthFor("sensitive"))) return; el.type = "text"; };
  document.querySelectorAll("#ob-plans .plan").forEach((b) => b.onclick = () => { obPlan = b.dataset.plan; renderObPlan(); updateObFooter(); });
  $("ob-2fa-no").onclick = () => { ob2faChoice = "no"; state.no2fa = true; saveState(); renderObTwoFA(); updateObFooter(); };
  $("ob-2fa-yes").onclick = () => { ob2faChoice = "yes"; state.no2fa = false; saveState(); renderObTwoFA(); updateObFooter(); };
  const obAfter2fa = () => { renderObStatus(); updateObFooter(); };
  $("ob-qr").addEventListener("change", (e) => handleQrPick(e, $("ob-qr-result"), obAfter2fa));
  $("ob-secret-save").onclick = async () => {
    const secret = $("ob-secret").value.replace(/\s+/g, "").toUpperCase();
    if (!secret) return toast("Írd be a titkos kulcsot.");
    try {
      await validateSecret(secret);
      $("ob-secret").value = "";
      $("ob-qr-result").appendChild(makeAcctCard({ name: "Kézi kulcs", secret, digits: 6, algorithm: "SHA1" }, obAfter2fa));
      toast("Hozzáadva a találatokhoz, koppints rá a beállításhoz.");
    } catch (err) { toast("Érvénytelen kulcs: " + err.message); }
  };
}
