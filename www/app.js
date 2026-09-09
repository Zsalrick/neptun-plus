import { generateTOTP } from "./lib/totp.js";
import { parseMigrationUri } from "./lib/gauth.js";
import { UNIVERSITIES } from "./data/universities.js";
import { parseICS } from "./lib/ical.js";

const STORE_KEY = "neptun-plus";
const APP_VERSION = "v0.045";
const $ = (id) => document.getElementById(id);

// ---------- icons (line SVG, no emoji) ----------
const P = {
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3m-3 3 2 2m-4 0 2 2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3m4 0v4m0-4h-4m4 7h-3m-4-4v4"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/>',
  building: '<path d="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M15 10h3a2 2 0 0 1 2 2v9M3 21h18M8 8h2m-2 4h2m-2 4h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 5 5 9-11"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  swap: '<path d="M4 8h13l-3-3m6 11H7l3 3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4m8-4v4"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l1.5 1.5L14 10m-5 6h6"/>',
  gear: '<path d="M4 8h9m3 0h4M4 16h4m3 0h9"/><circle cx="15" cy="8" r="2.4"/><circle cx="9" cy="16" r="2.4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14"/>',
  doc: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  fingerprint: '<path d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5v2.5M18.5 12.5a6.5 6.5 0 0 0-3.2-5.6M8.5 20.5a11 11 0 0 1-1-4.5V12a4.5 4.5 0 0 1 9 0v4a11 11 0 0 0 1 4.5M12 12v4.5"/>',
  del: '<path d="M20 5H9L3 12l6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m12 9.5 4 5m0-5-4 5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v6h-6"/>',
  pin: '<path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  note: '<path d="M5 4h14v13l-4 4H5z"/><path d="M15 21v-4h4M9 9h6M9 13h4"/>',
  book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z"/><path d="M5 4v16M18 20a2 2 0 0 1 2 2"/>',
};
function icon(name) { return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`; }
function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute("data-icon"); });
}

// ---------- state ----------
function defaultState() {
  return {
    setupComplete: false,
    legalAccepted: false,
    university: "",
    servers: UNIVERSITIES[0].servers.map((s, i) => ({ id: "u" + i, label: s.label, url: s.url })),
    activeServerId: "u0",
    username: "", password: "",
    no2fa: false,
    totp: null,
    pinHash: null,
    biometric: false,
    icsUrl: "",
    courses: null, // { fetchedAt: ISO, list: [{ code, name, credits, completed, semester, teacher, type }] }
    ics: null, // { fetchedAt: ISO, events: [{ s, e, allDay, summary, location, categories, description }] }
    manualExams: [], // [{ id, subject, title, start, end, location, note }]
    notes: [], // [{ id, kind:'subject'|'occurrence', subject, occKey, text }]
    breakMin: 20, // minimum gap (minutes) between two same-day classes to show a "Szünet" block
    // When to ask for the PIN / biometric (all on by default = most secure). If a switch is off,
    // that flow does not ask. Only meaningful when a PIN is set.
    security: { startup: true, resume: true, sensitive: true, actions: true },
  };
}
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return Object.assign(defaultState(), JSON.parse(raw)); }
  catch { /* ignore */ }
  return defaultState();
}
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
let state = loadState();

const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ---------- helpers ----------
function toast(msg, ms = 2600) {
  const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function activeServer() { return state.servers.find((s) => s.id === state.activeServerId) || state.servers[0]; }
function hasTotp() { return !!(state.totp && state.totp.secret); }
async function validateSecret(secret) { await generateTOTP(secret, {}); }

// ---------- Neptun code + PIN + biometrics ----------
function normCode(v) { return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }
function validCode(v) { return /^[A-Z0-9]{6}$/.test(v || ""); }
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
let bioOK = false;
function bioPlugin() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric; }
async function bioAvailable() { try { const NB = bioPlugin(); if (!NB) return false; const r = await NB.isAvailable(); return !!(r && r.isAvailable); } catch { return false; } }
async function bioVerify() { const NB = bioPlugin(); await NB.verifyIdentity({ reason: "Neptun+ feloldása", title: "Neptun+", subtitle: "", description: "Igazold a személyazonosságod" }); return true; }

// shared PIN pad + dots
function renderDots(el, count, total = 4) { el.innerHTML = ""; for (let i = 0; i < total; i++) { const d = document.createElement("div"); d.className = "pin-dot" + (i < count ? " filled" : ""); el.appendChild(d); } }
function buildKeypad(container, { onDigit, onBack, action }) {
  container.innerHTML = "";
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", action ? "action" : "blank", "0", "del"];
  keys.forEach((k) => {
    const b = document.createElement("button");
    if (k === "blank") { b.className = "key blank"; b.disabled = true; }
    else if (k === "action") { b.className = "key act"; b.innerHTML = icon(action.icon); b.onclick = action.onClick; }
    else if (k === "del") { b.className = "key act"; b.innerHTML = icon("del"); b.onclick = onBack; }
    else { b.className = "key"; b.textContent = k; b.onclick = () => onDigit(k); }
    container.appendChild(b);
  });
}

// generic confirm dialog -> Promise<bool>
function ask({ title, body, okText = "Igen" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title; $("ask-body").innerHTML = body; $("ask-ok").textContent = okText;
    $("ask-dialog").classList.remove("hidden");
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").onclick = null; $("ask-cancel").onclick = null; res(v); };
    $("ask-ok").onclick = () => done(true); $("ask-cancel").onclick = () => done(false);
  });
}

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
function renderUniList(container, query, selectedName, onPick) {
  const q = (query || "").trim().toLowerCase();
  const items = UNIVERSITIES.filter((u) => !q || (u.name + " " + u.city + " " + (u.alias || "")).toLowerCase().includes(q));
  container.innerHTML = "";
  if (!items.length) { container.innerHTML = `<div class="uni-empty">Nincs találat. Használd az „egyéni URL" opciót.</div>`; return; }
  items.forEach((u) => {
    const div = document.createElement("div");
    div.className = "uni-item" + (u.name === selectedName ? " selected" : "");
    div.innerHTML = `<span class="u-flag">${esc(initials(u.name))}</span>
      <span style="flex:1;min-width:0"><div class="u-name">${esc(u.name)}</div><div class="u-city">${esc(u.city)}</div></span>
      <span class="u-check">${icon("check")}</span>`;
    div.onclick = () => onPick(u);
    container.appendChild(div);
  });
}

// =====================================================================
//  ONBOARDING
// =====================================================================
const OB_LAST = 4;
let obStep = 0;
let obSel = null; // university object, or "custom", or null
let obPin = "", obFirst = null, obPinDone = false;

function updateObProgress() {
  $("ob-bar").style.width = ((obStep + 1) / (OB_LAST + 1) * 100) + "%";
  $("ob-count").textContent = `${obStep + 1} / ${OB_LAST + 1}`;
}
function obStepValid() {
  if (obStep === 0) return state.legalAccepted;
  if (obStep === 1) {
    if (obSel === "custom") return !!$("ob-custom-url").value.trim();
    return !!obSel;
  }
  if (obStep === 2) return validCode(state.username) && !!state.password;
  if (obStep === 3) return obPinDone;
  if (obStep === 4) return hasTotp() || state.no2fa;
  return true;
}
function updateObFooter() {
  $("ob-back").style.visibility = obStep === 0 ? "hidden" : "visible";
  $("ob-next").textContent = obStep === OB_LAST ? "Befejezés" : "Tovább";
  $("ob-next").disabled = !obStepValid();
}
function renderOb() {
  document.querySelectorAll("#screen-onboarding .ob-step").forEach((el) => el.classList.toggle("active", Number(el.dataset.step) === obStep));
  $("ob-body").scrollTop = 0;
  if (obStep === 0) $("ob-legal").classList.toggle("on", state.legalAccepted);
  if (obStep === 1) renderObUni();
  if (obStep === 3) { if (state.pinHash) obPinDone = true; if (!obPinDone) { obPin = ""; obFirst = null; } renderObPin(); }
  if (obStep === 4) renderObTwoFA();
  updateObProgress(); updateObFooter();
}
function renderObPin() {
  $("ob-bio").hidden = !bioOK;
  $("ob-bio").classList.toggle("on", state.biometric);
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
  });
  $("ob-uni-custom").classList.toggle("selected", obSel === "custom");
}
let ob2faChoice = null; // 'no' | 'yes' | null
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
function commitObStep1() {
  if (obSel === "custom") applyCustom($("ob-custom-label").value.trim(), $("ob-custom-url").value.trim());
  else if (obSel) applyUniversity(obSel);
}
function finishOnboarding() {
  state.setupComplete = true; saveState();
  enterApp(); showTab("tab-home");
  toast("Beállítás kész, kezdheted.");
}
function initOnboarding() {
  $("ob-next").onclick = () => {
    if (!obStepValid()) return;
    if (obStep === 1) commitObStep1();
    if (obStep === OB_LAST) return finishOnboarding();
    obStep++; renderOb();
  };
  $("ob-back").onclick = () => { if (obStep > 0) { obStep--; renderOb(); } };
  $("ob-legal").onclick = () => { state.legalAccepted = !state.legalAccepted; saveState(); $("ob-legal").classList.toggle("on", state.legalAccepted); updateObFooter(); };
  $("open-privacy").onclick = () => $("privacy-sheet").classList.remove("hidden");
  $("open-terms").onclick = () => $("terms-sheet").classList.remove("hidden");
  $("ob-uni-search").addEventListener("input", renderObUni);
  $("ob-uni-custom").onclick = () => { obSel = "custom"; $("ob-custom-wrap").classList.remove("hidden"); renderObUni(); updateObFooter(); };
  $("ob-custom-url").addEventListener("input", updateObFooter);
  $("ob-username").addEventListener("input", (e) => {
    const v = normCode(e.target.value); e.target.value = v; state.username = v; saveState();
    $("ob-username-err").hidden = v.length === 0 || validCode(v);
    updateObFooter();
  });
  $("ob-password").addEventListener("input", (e) => { state.password = e.target.value; saveState(); updateObFooter(); });
  $("ob-bio").onclick = () => { state.biometric = !state.biometric; saveState(); $("ob-bio").classList.toggle("on", state.biometric); };
  $("ob-show-pass").onclick = async () => { const el = $("ob-password"); if (el.type !== "password") { el.type = "password"; return; } if (!(await requireAuthFor("sensitive"))) return; el.type = "text"; };
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

// =====================================================================
//  TABS
// =====================================================================
const MAIN_TABS = ["tab-home", "tab-timetable", "tab-exams", "tab-courses"];
let lastMainTab = "tab-home";
function renderForTab(id) {
  if (id === "tab-home") renderHome();
  else if (id === "tab-timetable") renderTimetable();
  else if (id === "tab-exams") renderExams();
  else if (id === "tab-courses") renderCourses();
  else if (id === "tab-settings") syncSettings();
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
function setActive(id) {
  document.querySelectorAll(".tabscreen").forEach((el) => el.classList.toggle("active", el.id === id));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  if (MAIN_TABS.includes(id)) { lastMainTab = id; moveNavIndicator(id); } else moveNavIndicator(id);
}
function showTab(id, dir) {
  const cur = document.querySelector(".tabscreen.active");
  if (dir && cur && cur.id !== id) {
    const incoming = document.getElementById(id);
    prepTab(id); // skeleton for heavy tabs (real render deferred to afterShow), full render for light ones
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    if (MAIN_TABS.includes(id)) { lastMainTab = id; moveNavIndicator(id); }
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
  const cur = document.querySelector(".tabscreen.active");
  let dir = 0;
  if (cur && MAIN_TABS.includes(id) && MAIN_TABS.includes(cur.id)) dir = MAIN_TABS.indexOf(id) > MAIN_TABS.indexOf(cur.id) ? 1 : -1;
  showTab(id, dir);
}
function enterApp() { $("screen-onboarding").classList.add("hidden"); $("app-shell").classList.remove("hidden"); }
document.querySelectorAll(".nav-btn").forEach((b) => b.onclick = () => navTo(b.dataset.tab));
document.querySelectorAll("[data-settings]").forEach((b) => b.onclick = () => showTab("tab-settings"));
$("settings-back").onclick = () => showTab(lastMainTab);
window.addEventListener("resize", () => { const a = document.querySelector(".tabscreen.active"); if (a) moveNavIndicator(a.id); });

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

// tap on the dimmed area (outside the sheet) closes any open dialog
document.querySelectorAll(".backdrop").forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.add("hidden"); }));

// full-screen busy spinner (for invisible background reads)
let flowCancel = null; // set while a runNeptunFlow is active; lets the busy "Mégse" abort it
function showBusy(text, cancelable) { $("busy-text").textContent = text || "Beolvasás…"; $("busy-cancel").hidden = !cancelable; $("busy").classList.remove("hidden"); }
function hideBusy() { $("busy").classList.add("hidden"); $("busy-cancel").hidden = true; }
$("busy-cancel").onclick = () => { if (flowCancel) flowCancel(); };

// =====================================================================
//  HOME
// =====================================================================
function renderHome() {
  const srv = activeServer();
  $("disp-username").textContent = state.username || "Nincs adat";
  $("disp-server").textContent = (state.university || "") + (srv && state.servers.length > 1 ? " · " + srv.label : "");
  const showTotp = hasTotp() && !state.no2fa;
  $("totp-tile").classList.toggle("hidden", !showTotp);
  $("chip-no2fa").classList.toggle("hidden", !state.no2fa);
  if (showTotp) $("totp-account").textContent = state.totp.name || "2FA kód";
  const ready = !!(state.username && state.password);
  $("btn-login").disabled = !ready;
  $("home-sub").textContent = ready ? "Készen áll" : "Állítsd be a belépést";
  $("login-hint").textContent = isNative ? "Egy érintés, a többit az alkalmazás elvégzi." : "Előnézet. Az alkalmazásban ez automatikusan belép.";
  $("server-chip").style.display = state.servers.length > 1 ? "" : "none";
  renderNextClass();
  renderNextExam();
}
function nextIsland(el, e, headText, tab, now) {
  if (!el) return;
  el.classList.toggle("nc-now", !!now);
  if (!e) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const time = now ? `${hm(e.S)}–${hm(e.E)}` : hm(e.S);
  el.innerHTML = `<div class="nc-head">${icon("clock")} ${headText} · ${esc(dayHeading(e.S))}</div>
    <div class="nc-row"><span class="nc-time">${time}</span><div class="nc-body"><div class="nc-title">${esc(e.summary || "")}</div>${e.location ? `<div class="nc-loc">${icon("pin")} ${esc(e.location)}</div>` : ""}</div></div>`;
  el.onclick = () => showTab(tab);
}
function renderNextClass() {
  nextIsland($("current-class"), currentClass(), "Jelenlegi óra", "tab-timetable", true);
  nextIsland($("next-class"), nextClass(), "Következő óra", "tab-timetable");
}
function renderNextExam() { nextIsland($("next-exam"), nextAssessment(), "Következő számonkérés", "tab-exams"); }
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

// =====================================================================
//  TIMETABLE (Neptun iCal feed)
// =====================================================================
const TT_DAYS = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
const TT_MON = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const pad2 = (n) => String(n).padStart(2, "0");
const hm = (d) => pad2(d.getHours()) + ":" + pad2(d.getMinutes());
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dayHeading(d) {
  const now = new Date(); const tm = new Date(now); tm.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return "Ma"; if (sameDay(d, tm)) return "Holnap";
  const name = TT_DAYS[d.getDay()]; return name.charAt(0).toUpperCase() + name.slice(1) + ", " + TT_MON[d.getMonth()] + " " + d.getDate() + ".";
}
function fmtWhen(iso) { const d = new Date(iso); const now = new Date(); return (sameDay(d, now) ? "ma " : TT_MON[d.getMonth()] + " " + d.getDate() + ". ") + hm(d); }
// Human duration for the timetable break blocks: "2 óra", "1 ó 30 p", "45 perc".
function fmtDur(ms) {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60), r = m % 60;
  if (h && r) return h + " ó " + r + " p";
  if (h) return h + " óra";
  return m + " perc";
}

// An exam-like event is detected from its summary / category / description.
function isExam(e) {
  const s = ((e.summary || "") + " " + (e.categories || "") + " " + (e.description || "")).toLowerCase();
  return /vizsga|z[aá]rthelyi|\bzh\b|besz[aá]mol|kollokvium|szigorlat|megaj[aá]nl|p[oó]tl[oó]|exam/.test(s);
}
// Hungarian semester of a date: autumn (1) Aug..Jan, spring (2) Feb..Jul.
function semObj(d) {
  const y = d.getFullYear(), m = d.getMonth();
  let ay, sem; if (m >= 7) { ay = y; sem = 1; } else { ay = y - 1; sem = 2; }
  const key = ay + "/" + pad2((ay + 1) % 100) + "/" + sem;
  const start = sem === 1 ? new Date(ay, 7, 1) : new Date(ay + 1, 1, 1);
  const end = sem === 1 ? new Date(ay + 1, 1, 1) : new Date(ay + 1, 7, 1);
  return { key, start, end };
}
function semKeyToObj(key) {
  const p = key.split("/"); const ay = +p[0]; const sem = +p[2];
  const start = sem === 1 ? new Date(ay, 7, 1) : new Date(ay + 1, 1, 1);
  const end = sem === 1 ? new Date(ay + 1, 1, 1) : new Date(ay + 1, 7, 1);
  return { key, start, end };
}
// All known semesters, unioned from timetable/exam dates AND read courses (so older terms show up).
function allSemesters() {
  const map = {};
  classEvents().concat(examEvents()).forEach((e) => { const s = semObj(e.S); map[s.key] = s; });
  const co = state.courses || {};
  (co.list || []).forEach((c) => { if (c.semester && !map[c.semester]) map[c.semester] = semKeyToObj(c.semester); });
  (co.semesters || []).forEach((k) => { if (k && !map[k]) map[k] = semKeyToObj(k); });
  return Object.values(map).sort((a, b) => a.start - b.start);
}
function allEvents() {
  return ((state.ics && state.ics.events) || []).map((e) => ({ ...e, S: new Date(e.s), E: new Date(e.e), exam: isExam(e) }));
}
function classEvents() { return allEvents().filter((e) => !e.exam); }
function manualExamEvents() {
  return (state.manualExams || []).map((m) => ({ S: new Date(m.start), E: new Date(m.end || m.start), s: m.start, e: m.end || m.start,
    summary: m.title || m.subject || "Számonkérés", location: m.location || "", subject: m.subject || "", note: m.note || "", exam: true, manual: true, id: m.id }));
}
function examEvents() { return allEvents().filter((e) => e.exam).concat(manualExamEvents()); }
function currentClass() { const now = Date.now(); return classEvents().filter((e) => e.S.getTime() <= now && e.E.getTime() > now).sort((a, b) => a.S - b.S)[0] || null; }
function nextClass() { const now = Date.now(); return classEvents().filter((e) => e.S.getTime() > now).sort((a, b) => a.S - b.S)[0] || null; }
function nextAssessment() { const now = Date.now(); return examEvents().filter((e) => e.E.getTime() >= now).sort((a, b) => a.S - b.S)[0] || null; }
function subjects() {
  const set = new Set();
  classEvents().forEach((e) => { if (e.summary) set.add(e.summary); });
  (state.manualExams || []).forEach((m) => { if (m.subject) set.add(m.subject); });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "hu"));
}
function occKey(e) { return (e.summary || "") + "@" + (e.s || (e.S && e.S.toISOString()) || ""); }
function notesForEvent(e) {
  return (state.notes || []).filter((n) => (n.kind === "subject" && n.subject === e.summary) || (n.kind === "occurrence" && n.occKey === occKey(e)));
}
function uid() { return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function currentSemesterKey() { return semObj(new Date()).key; }

// ---------- custom pickers (replace native selects / date / time) ----------
function openList({ title, items, selected, onPick, searchable, allowCustom, chips, chipCurrent, onChip }) {
  $("pk-title").textContent = title;
  const chipsEl = $("pk-chips");
  if (chips && chips.length) {
    chipsEl.hidden = false;
    chipsEl.innerHTML = chips.map((c) => `<button class="chip-sel${c.key === chipCurrent ? " on" : ""}" data-k="${esc(c.key)}">${esc(c.label)}</button>`).join("");
    chipsEl.querySelectorAll(".chip-sel").forEach((el) => el.onclick = () => onChip(el.dataset.k));
  } else { chipsEl.hidden = true; chipsEl.innerHTML = ""; }
  const sw = $("pk-search-wrap");
  const draw = (q) => {
    const query = (q || "").trim().toLowerCase();
    const list = items.filter((it) => !query || it.label.toLowerCase().includes(query));
    let html = list.map((it) => `<div class="uni-item${it.value === selected ? " selected" : ""}" data-v="${esc(it.value)}"><span style="flex:1;min-width:0"><div class="u-name">${esc(it.label)}</div>${it.sub ? `<div class="u-city">${esc(it.sub)}</div>` : ""}</span><span class="u-check">${icon("check")}</span></div>`).join("");
    if (allowCustom && query && !list.some((it) => it.label.toLowerCase() === query)) html += `<div class="uni-item" data-custom="1"><span style="flex:1"><div class="u-name">„${esc(q.trim())}" hozzáadása</div></span>${icon("plus")}</div>`;
    if (!html) html = `<div class="uni-empty">Nincs találat.</div>`;
    $("pk-list").innerHTML = html;
    $("pk-list").querySelectorAll(".uni-item").forEach((el) => el.onclick = () => { const v = el.dataset.custom ? $("pk-search").value.trim() : el.dataset.v; $("picker-sheet").classList.add("hidden"); onPick(v); });
  };
  if (searchable) { sw.hidden = false; $("pk-search").value = ""; $("pk-search").oninput = () => draw($("pk-search").value); } else sw.hidden = true;
  draw("");
  $("picker-sheet").classList.remove("hidden");
}
$("pk-close").onclick = () => $("picker-sheet").classList.add("hidden");

let tpH = 8, tpM = 0, tpCb = null;
function openTime(current, onPick) {
  tpCb = onPick;
  const [h, m] = (current || "08:00").split(":").map(Number);
  tpH = isNaN(h) ? 8 : h; tpM = isNaN(m) ? 0 : m;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const drawH = () => { $("tp-hours").innerHTML = hours.map((x) => `<button class="time-cell${x === tpH ? " on" : ""}" data-h="${x}">${pad2(x)}</button>`).join(""); $("tp-hours").querySelectorAll(".time-cell").forEach((b) => b.onclick = () => { tpH = +b.dataset.h; drawH(); }); };
  const drawM = () => { $("tp-mins").innerHTML = mins.map((x) => `<button class="time-cell${x === tpM ? " on" : ""}" data-m="${x}">${pad2(x)}</button>`).join(""); $("tp-mins").querySelectorAll(".time-cell").forEach((b) => b.onclick = () => { tpM = +b.dataset.m; drawM(); }); };
  drawH(); drawM();
  $("time-sheet").classList.remove("hidden");
  setTimeout(() => { const a = $("tp-hours").querySelector(".on"); if (a) a.scrollIntoView({ block: "center" }); const b = $("tp-mins").querySelector(".on"); if (b) b.scrollIntoView({ block: "center" }); }, 30);
}
$("tp-cancel").onclick = () => $("time-sheet").classList.add("hidden");
$("tp-ok").onclick = () => { $("time-sheet").classList.add("hidden"); if (tpCb) tpCb(pad2(tpH) + ":" + pad2(tpM)); };

let calView = null, calSel = null, calCb = null;
function openCalendar(current, onPick) {
  calCb = onPick; calSel = current || null;
  const base = current || new Date();
  calView = new Date(base.getFullYear(), base.getMonth(), 1);
  drawCal(); $("cal-sheet").classList.remove("hidden");
}
function drawCal() {
  const y = calView.getFullYear(), m = calView.getMonth();
  $("cal-title").textContent = y + ". " + TT_MON[m];
  const start = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  let html = "";
  for (let i = 0; i < start; i++) html += `<span class="cal-cell empty"></span>`;
  for (let d = 1; d <= days; d++) {
    const dd = new Date(y, m, d);
    html += `<button class="cal-cell${calSel && sameDay(dd, calSel) ? " sel" : ""}${sameDay(dd, today) ? " today" : ""}" data-d="${d}">${d}</button>`;
  }
  $("cal-grid").innerHTML = html;
  $("cal-grid").querySelectorAll(".cal-cell[data-d]").forEach((b) => b.onclick = () => { const dd = new Date(y, m, +b.dataset.d); $("cal-sheet").classList.add("hidden"); if (calCb) calCb(dd); });
}
$("cal-prev").onclick = () => { calView.setMonth(calView.getMonth() - 1); drawCal(); };
$("cal-next").onclick = () => { calView.setMonth(calView.getMonth() + 1); drawCal(); };
$("cal-cancel").onclick = () => $("cal-sheet").classList.add("hidden");

function openIcs() { $("ics-input").value = state.icsUrl || ""; $("ics-sheet").classList.remove("hidden"); }
$("ics-cancel").onclick = () => $("ics-sheet").classList.add("hidden");
$("ics-save").onclick = () => {
  const v = $("ics-input").value.trim();
  if (!v) return toast("Illeszd be a feliratkozási linket.");
  state.icsUrl = v; saveState(); $("ics-sheet").classList.add("hidden");
  updateIcsStatus(); renderTimetable(); renderExams(); fetchTimetable();
};
$("btn-ics").onclick = openIcs;
$("tt-refresh").onclick = fetchTimetable;
$("ex-refresh").onclick = fetchTimetable;
function updateIcsStatus() { const s = $("ics-status"); if (s) s.textContent = state.icsUrl ? "Beállítva" : "Nincs beállítva"; }

async function fetchTimetable() {
  if (!state.icsUrl) return openIcs();
  $("tt-sub").textContent = "Frissítés folyamatban"; $("ex-sub").textContent = "Frissítés folyamatban";
  try {
    const url = state.icsUrl.replace(/^webcal:\/\//i, "https://");
    const res = await fetch(url);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("a link nem naptár adatot adott vissza");
    const events = parseICS(text);
    state.ics = { fetchedAt: new Date().toISOString(),
      events: events.map((e) => ({ s: e.start.toISOString(), e: e.end.toISOString(), allDay: !!e.allDay, summary: e.summary || "", location: e.location || "", categories: e.categories || "", description: e.description || "" })) };
    saveState(); renderTimetable(); renderExams(); renderHome(); toast(events.length + " esemény frissítve.");
  } catch (err) {
    toast("Nem sikerült letölteni. " + (err && err.message ? err.message : ""));
    renderTimetable(); renderExams();
  }
}

// Generic agenda for either classes or exams, with a period dropdown.
let ttFilter = "upcoming", exFilter = "upcoming";
function periodBtn(cur) {
  return `<button class="period-btn" type="button"><span>${esc(cur === "upcoming" ? "Közelgő" : cur)}</span>${icon("down")}</button>`;
}
function renderAgenda(scroll, subEl, refreshBtn, examMode, filter, onFilter) {
  if (!scroll) return;
  const hasFeed = !!state.icsUrl;
  if (refreshBtn) refreshBtn.hidden = !hasFeed;
  // Classes need the feed; exams can also come from manual entries.
  if (!examMode && !hasFeed) {
    subEl.textContent = "Feliratkozási link szükséges";
    scroll.innerHTML = `<div class="empty"><div class="empty-ic">${icon("calendar")}</div>
      <h2>Órarend</h2><p>Add meg egyszer a Neptun feliratkozási linkjét, és onnantól egy gombbal frissül.</p>
      <button class="btn primary ics-setup" style="width:auto">Feliratkozási link megadása</button></div>`;
    const b = scroll.querySelector(".ics-setup"); if (b) b.onclick = openIcs;
    return;
  }
  const items = examMode ? examEvents() : classEvents();
  const sems = allSemesters();
  const now = Date.now();
  let list;
  if (filter === "upcoming") list = items.filter((e) => e.E.getTime() >= now).sort((a, b) => a.S - b.S);
  else { const s = sems.find((x) => x.key === filter); list = s ? items.filter((e) => e.S >= s.start && e.S < s.end).sort((a, b) => a.S - b.S) : []; }
  subEl.textContent = list.length + (examMode ? " számonkérés" : " óra");
  // Highlight the ongoing class ("Jelenleg") and the soonest upcoming one ("Következő") — only in the
  // Közelgő view for the timetable (not for exams / past semesters).
  const showFlags = filter === "upcoming" && !examMode;
  const nowIdx = showFlags ? list.findIndex((e) => e.S.getTime() <= now && e.E.getTime() > now) : -1;
  const nextIdx = showFlags ? list.findIndex((e) => e.S.getTime() > now) : -1;

  let html = `<div class="controls">${periodBtn(filter)}${examMode ? `<button class="btn tonal narrow" id="add-exam">${icon("plus")} ZH</button>` : ""}</div>`;
  if (hasFeed) html += `<div class="tt-updated" style="margin:2px 4px 12px">Frissítve: ${state.ics && state.ics.fetchedAt ? fmtWhen(state.ics.fetchedAt) : "még soha"}</div>`;
  else html += `<div style="height:10px"></div>`;
  if (!list.length) {
    html += `<div class="hint center" style="margin-top:20px">${filter === "upcoming" ? (examMode ? "Nincs közelgő számonkérés." : "Nincs közelgő óra.") : "Nincs esemény ebben az időszakban."}</div>`;
  } else {
    // Group events by day into a bounded block with a left "spine" so day boundaries are obvious.
    const now = new Date(), tmr = new Date(now); tmr.setDate(now.getDate() + 1);
    const dayMain = (d) => sameDay(d, now) ? "Ma" : sameDay(d, tmr) ? "Holnap" : (TT_DAYS[d.getDay()].charAt(0).toUpperCase() + TT_DAYS[d.getDay()].slice(1));
    const dayDate = (d) => TT_MON[d.getMonth()] + " " + d.getDate() + ".";
    let lastDay = "", prevEnd = null, open = false;
    list.forEach((e, i) => {
      const dh = dayHeading(e.S);
      if (dh !== lastDay) {
        if (open) html += `</div></div>`; // close previous .tt-daybody + .tt-daygroup
        html += `<div class="tt-daygroup${sameDay(e.S, now) ? " today" : ""}">
          <div class="tt-day"><span class="tt-day-main">${esc(dayMain(e.S))}</span><span class="tt-day-date">${esc(dayDate(e.S))}</span></div>
          <div class="tt-daybody">`;
        open = true; lastDay = dh; prevEnd = null;
      }
      // A gap between two classes on the same day reads as an inset "break", never a new day.
      if (!examMode && prevEnd) {
        const gap = e.S.getTime() - prevEnd.getTime();
        if (gap >= (state.breakMin || 20) * 60000) html += `<div class="tt-gap"><span class="tt-gap-label">Szünet · ${fmtDur(gap)} · ${hm(prevEnd)}–${hm(e.S)}</span></div>`;
      }
      if (!examMode) prevEnd = (!prevEnd || e.E > prevEnd) ? e.E : prevEnd;
      let flagCls = "", flagText = "";
      if (i === nowIdx) { flagCls = " now"; flagText = "Jelenleg"; }
      else if (i === nextIdx) { flagCls = " next"; flagText = "Következő"; }
      const noteCount = e.manual ? (e.note ? 1 : 0) : notesForEvent(e).length;
      html += `<div class="tt-event${flagCls}" data-idx="${i}">
        <div class="tt-time"><span>${hm(e.S)}</span>${examMode ? "" : `<span class="tt-time-e">${hm(e.E)}</span>`}</div>
        <div class="tt-info">
          ${e.subject && e.subject !== e.summary ? `<div class="tt-subj">${esc(e.subject)}</div>` : ""}
          <div class="tt-title">${esc(e.summary || (examMode ? "Számonkérés" : "Óra"))}</div>
          ${e.manual && e.note ? `<div class="tt-loc">${icon("note")} ${esc(e.note)}</div>` : ""}
          ${e.location ? `<div class="tt-loc">${icon("pin")} ${esc(e.location)}</div>` : ""}
          <div class="tt-tags">${e.manual ? `<span class="tag">saját</span>` : ""}${!e.manual && noteCount ? `<span class="tag note">${icon("note")} ${noteCount}</span>` : ""}</div>
        </div>
        ${flagText ? `<span class="tt-flag">${flagText}</span>` : ""}</div>`;
    });
    if (open) html += `</div></div>`;
  }
  scroll.innerHTML = html;
  const pb = scroll.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: filter,
    items: [{ value: "upcoming", label: "Közelgő" }].concat(sems.map((s) => ({ value: s.key, label: s.key }))),
    onPick: (v) => onFilter(v) });
  const add = scroll.querySelector("#add-exam"); if (add) add.onclick = openExamSheet;
  scroll.querySelectorAll(".tt-event").forEach((el) => el.onclick = () => openDetail(list[+el.dataset.idx], examMode));
}
function renderTimetable() { renderAgenda($("tt-scroll"), $("tt-sub"), $("tt-refresh"), false, ttFilter, (k) => { ttFilter = k; renderTimetable(); }); }
function renderExams() { renderAgenda($("ex-scroll"), $("ex-sub"), $("ex-refresh"), true, exFilter, (k) => { exFilter = k; renderExams(); }); }

// ----- courses (Felvett tárgyak) + credit watcher -----
let coFilter = null;
function renderCourses() {
  const scroll = $("co-scroll"); if (!scroll) return;
  const list = (state.courses && state.courses.list) || [];
  if (!list.length) {
    $("co-sub").textContent = state.courses ? "Nincs adat" : "Beolvasás szükséges";
    scroll.innerHTML = `<div class="empty"><div class="empty-ic">${icon("book")}</div>
      <h2>Tárgyak</h2><p>Olvasd be a felvett tárgyaidat a Neptunból: kredit, teljesítés és tanár. A jobb felső frissítés gombbal.</p>
      <button class="btn primary co-read" style="width:auto">Tárgyak beolvasása</button></div>`;
    const b = scroll.querySelector(".co-read"); if (b) b.onclick = scrapeCourses;
    return;
  }
  const sems = allSemesters();
  if (coFilter === null) { coFilter = currentSemesterKey(); if (!list.some((c) => c.semester === coFilter)) coFilter = "all"; }
  const items = coFilter === "all" ? list : list.filter((c) => c.semester === coFilter);
  const totalCr = items.reduce((s, c) => s + (+c.credits || 0), 0);
  const doneCr = items.filter((c) => c.completed).reduce((s, c) => s + (+c.credits || 0), 0);
  $("co-sub").textContent = items.length + " tárgy";
  let html = `<div class="controls"><button class="period-btn" type="button"><span>${coFilter === "all" ? "Összes" : esc(coFilter)}</span>${icon("down")}</button></div>`;
  html += `<div class="tt-updated" style="margin:2px 4px 12px">Frissítve: ${state.courses && state.courses.fetchedAt ? fmtWhen(state.courses.fetchedAt) : "még soha"}</div>`;
  html += `<div class="card cred"><div class="cred-row"><div><div class="cred-big">${doneCr} / ${totalCr}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${items.filter((c) => c.completed).length}/${items.length} tárgy</div></div><div class="cred-bar"><div class="cred-fill" style="width:${totalCr ? Math.round(doneCr / totalCr * 100) : 0}%"></div></div></div>`;
  items.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "hu")).forEach((c) => {
    html += `<div class="course-row">
      <span class="cr-check ${c.completed ? "on" : ""}">${c.completed ? icon("check") : ""}</span>
      <div class="cr-main"><div class="cr-name">${esc(c.name || c.code || "Tárgy")}</div><div class="cr-sub">${esc(c.code || "")}${c.teacher ? " · " + esc(c.teacher) : ""}</div></div>
      <span class="cr-cr">${esc(String(c.credits || 0))} kr</span></div>`;
  });
  scroll.innerHTML = html;
  const pb = scroll.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: coFilter, items: [{ value: "all", label: "Összes" }].concat(sems.map((s) => ({ value: s.key, label: s.key }))), onPick: (v) => { coFilter = v; renderCourses(); } });
}
$("co-refresh").onclick = scrapeCourses;
let courseLog = [];
function dbg(m) { courseLog.push(m); $("busy-text").textContent = m; }
async function scrapeCourses() {
  if (!isNative) { toast("A tárgyak beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let ok = false, rawOut = "", cancelled = false;
  try {
    const res = await neptunReadCourses(); // { courses, semesters, semester, raw }
    rawOut = (res && res.raw) || "";
    if (res && res.courses && res.courses.length) {
      state.courses = { fetchedAt: new Date().toISOString(), list: res.courses, semesters: res.semesters || [] };
      coFilter = res.semester || null;
      saveState(); renderCourses(); renderTimetable(); ok = true;
      dbg("Siker: " + res.courses.length + " tárgy");
    } else { dbg("Az oldal betöltött, de 0 tárgyat ismertem fel."); }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (ok) { toast(state.courses.list.length + " tárgy beolvasva."); return; }
  // failure: copy raw to clipboard and show the debug log so it can be shared
  try { if (rawOut) await navigator.clipboard.writeText(rawOut); } catch (e) { /* ignore */ }
  await ask({ title: "Beolvasás napló", okText: "OK",
    body: courseLog.map((l) => esc(l)).join("<br>") + (rawOut ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
// Shared runner: open a (debug-visible) InAppBrowser, inject an in-page routine on each
// load, and poll `window.<gvar>` for a {done:true,...} result while surfacing its live log.
function runNeptunFlow(buildScript, gvar) {
  return new Promise((resolve, reject) => {
    const iab = window.cordova && window.cordova.InAppBrowser;
    if (!iab) return reject(new Error("InAppBrowser plugin hiányzik"));
    const srv = activeServer();
    const loginScript = buildInjectScript(state.username, state.password, state.no2fa ? "" : lastCode);
    const script = buildScript(state.username, state.password, state.no2fa ? "" : lastCode);
    dbg("Böngésző megnyitása…");
    // Same base options as the working hub login (nativeLogin) — but hidden=yes so the user only
    // sees the busy spinner (the "Kész" vs "Mégse" opts difference was what made login work).
    const opts = ["location=yes", "hidden=yes", "hideurlbar=no", "hidenavigationbuttons=no", "zoom=yes", "hardwareback=yes", "footer=no",
      "toolbarcolor=#141518", "navigationbuttoncolor=#ecedee", "closebuttoncolor=#ecedee", "closebuttoncaption=Kész"].join(",");
    const ref = iab.open(srv.url, "_blank", opts);
    let done = false, polling = false, iv = null;
    const finish = (err, data) => { if (done) return; done = true; flowCancel = null; clearTimeout(to); if (iv) clearInterval(iv); try { ref.close(); } catch (e) {} err ? reject(err) : resolve(data); };
    flowCancel = () => finish(new Error("Megszakítva")); // wired to the busy "Mégse" button
    const to = setTimeout(() => finish(new Error("időtúllépés (90s)")), 90000);
    const startPoll = () => {
      if (polling) return; polling = true;
      iv = setInterval(() => {
        ref.executeScript({ code: "(function(){return JSON.stringify({v:window." + gvar + "||'',log:window.__ncLog||''});})()" }, (r) => {
          const s = Array.isArray(r) ? r[0] : r; if (!s || typeof s !== "string") return;
          let o; try { o = JSON.parse(s); } catch (e) { return; }
          if (o.log) { const parts = o.log.split("\n"); courseLog = parts; $("busy-text").textContent = parts[parts.length - 1] || "Beolvasás…"; }
          if (o.v) { let res; try { res = JSON.parse(o.v); } catch (e) { return; } if (res && res.done) { if (res.log) courseLog = res.log.split("\n"); finish(null, res); } }
        });
      }, 700);
    };
    // Reliable result channel: the injected script navigates to a sentinel URL carrying the payload.
    const onNav = (ev) => {
      const u = (ev && ev.url) || "";
      if (u.indexOf("neptunplus.done") < 0) return;
      let data = {};
      try { const q = (u.split("?d=")[1] || u.split("#d=")[1] || ""); data = JSON.parse(decodeURIComponent(q)); } catch (e) {}
      if (data && data.log) courseLog = String(data.log).split("\n");
      finish(null, { done: true, url: data.url || "", log: data.log || "", raw: "" });
    };
    ref.addEventListener("loadstart", onNav);
    ref.addEventListener("loaderror", (ev) => { onNav(ev); dbg("Betöltési hiba: " + ((ev && ev.message) || "")); });
    ref.addEventListener("exit", () => finish(new Error("a böngészőt bezárták")));
    ref.addEventListener("loadstop", (ev) => {
      onNav(ev); dbg("Betöltött: " + ((ev && ev.url) || "").replace(srv.url, ""));
      try { ref.executeScript({ code: loginScript }); } catch (e) {} // 1:1 hub login
      try { ref.executeScript({ code: script }); } catch (e) {}       // flow waits for login then navigates
      startPoll();
    });
  });
}
function neptunReadCourses() { return runNeptunFlow(buildFullReadScript, "__nc"); }
function neptunReadIcsLink() { return runNeptunFlow(buildIcsGrabScript, "__ics"); }

// Grab the timetable subscription (iCal) link: login → Menü → Naptár → Naptár kezelése → read link.
async function grabIcsLink() {
  if (!isNative) { toast("Az automatikus lekérés a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let url = "", raw = "", cancelled = false;
  try {
    const res = await neptunReadIcsLink();
    raw = (res && res.raw) || "";
    if (res && res.log) courseLog = res.log.split("\n");
    if (res && res.url) { url = res.url; dbg("Link: " + url); } else dbg("Nem találtam feliratkozási linket.");
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (url) {
    // Only fill the field — the user presses Mentés manually.
    const clean = url.replace(/^webcal:\/\//i, "https://");
    if ($("ics-input")) $("ics-input").value = clean;
    $("ics-sheet").classList.remove("hidden");
    toast("Link beírva. Nyomd meg a Mentést."); return;
  }
  try { if (raw) await navigator.clipboard.writeText(raw); } catch (e) { /* ignore */ }
  await ask({ title: "Lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") + (raw ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
$("ics-auto").onclick = grabIcsLink;
function buildIcsGrabScript(username, password, code) {
  const U = JSON.stringify(username), P = JSON.stringify(password), C = JSON.stringify(code || "");
  return `(function(){
  if(window.__icsRunning) return "running"; window.__icsRunning=true; window.__ics=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(u){ try{ window.__ics=JSON.stringify({done:true,url:u||"",log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({url:u||"",log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function setVal(el,val){ if(!el) return; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=button]')); }
  function clickText(txt){ var el=pick(txt); if(el){ el.click(); return true; } return false; }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function findIcsUrl(){
    var urls=[]; var html=document.body.innerHTML||''; var m=html.match(/(webcal:\\/\\/|https?:\\/\\/)[^\\s"'<>\\\\)]+/gi); if(m) urls=urls.concat(m);
    Array.prototype.slice.call(document.querySelectorAll('input,textarea,[data-clipboard-text]')).forEach(function(el){ if(el.value) urls.push(el.value); var c=el.getAttribute&&el.getAttribute('data-clipboard-text'); if(c) urls.push(c); });
    var pri=urls.filter(function(u){ return /webcal:|\\.ics|ical|icalendar|calendar|napt[aá]r|feed|subscri/i.test(u); });
    return pri[0]||"";
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre (a hub-login intézi)…");
      var inOk=await waitFor(loggedIn, 60000);
      log(inOk?"Bejelentkezve":"Nem sikerült időben bejelentkezni");
      if(!inOk){ deliver(""); return; }
      // Faster than fixed sleeps: click each target the moment it becomes clickable (poll, no long waits).
      log("Menü"); var mEl=await waitFor(function(){return pick("Menü");},8000); if(mEl){ mEl.click(); await sleep(120);} else log("Nem találom: Menü");
      log("Naptár"); var nEl=await waitFor(function(){return pick("Naptár");},8000); if(nEl){ nEl.click(); await sleep(120);} else log("Nem találom: Naptár");
      log("Naptár kezelése"); var kEl=await waitFor(function(){return pick("Naptár kezelése");},8000); if(kEl){ kEl.click(); await sleep(120);} else log("Nem találom: Naptár kezelése");
      log("Feliratkozás link másolása"); var fEl=await waitFor(function(){return pick("Feliratkozás link másolása");},8000); if(fEl){ fEl.click();} else log("Nem találom: Feliratkozás link másolása");
      var url=await waitFor(findIcsUrl,8000); if(!url) url=findIcsUrl(); log(url?("Talált link"):("Nincs link a modalban"));
      try{ clickText("Bezárás"); }catch(e){}
      deliver(url);
    }catch(e){ log("HIBA: "+String(e)); deliver(""); }
  })();
  return "started";
})();`;
}
// One in-page routine: log in, click through Menü→Tárgyak→Felvett tárgyak, iterate the FÉLÉV filter, scrape.
function buildFullReadScript(username, password, code) {
  const U = JSON.stringify(username), P = JSON.stringify(password), C = JSON.stringify(code || "");
  return `(function(){
  if(window.__ncRunning) return "running"; window.__ncRunning=true; window.__nc=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function setVal(el,val){ if(!el) return; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function clickText(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); if(els[0]){ els[0].click(); return true; } return false; }
  function findSubmit(){ return nodes().filter(function(b){ if(!vis(b)) return false; var h=((b.id||'')+' '+(b.innerText||b.value||'')).toLowerCase(); return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|submit|login/.test(h); })[0]; }
  function findCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){ if(!vis(el)||el.value) return false; var t=(el.type||'').toLowerCase(); if(['text','tel','number','password'].indexOf(t)===-1) return false; var h=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); if(/code|otp|token|kod|k[oó]d|hiteles[ií]t|authent|2fa|mfa/.test(h)) return true; var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0&&ml<=8; }); }
  function parseRows(sem){ var main=document.querySelector('main')||document.body; var out=[],seen={};
    var ces=Array.prototype.slice.call(main.querySelectorAll('*')).filter(function(el){ return el.children.length===0 && /^[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]*$/.test((el.textContent||'').trim()); });
    ces.forEach(function(ce){ var codev=(ce.textContent||'').trim(); if(seen[codev]) return; var row=ce;
      for(var k=0;k<8&&row.parentElement;k++){ row=row.parentElement; var rt=(row.innerText||''); if(rt.length>codev.length+8 && rt.split('\\n').length>=2) break; }
      var parts=(row.innerText||'').split('\\n').map(function(s){return s.trim();}).filter(Boolean); var ci=parts.indexOf(codev); if(ci<0) return;
      var name=parts[0]||codev; var status=(parts.find(function(s){return /^(teljes|nem teljes|al[aá][ií]r|folyamatban|akt[ií]v)/i.test(s);})||'');
      var credit=0; for(var j=ci+1;j<parts.length;j++){ if(/^\\d{1,2}$/.test(parts[j])){ credit=parseInt(parts[j],10); break; } }
      var req=(parts.find(function(s){return /(jegy|kollokvium|vizsga|al[aá][ií]r[aá]s|sz[aá]monk[eé]r[eé]s)/i.test(s);})||'');
      seen[codev]=1; out.push({code:codev,name:name,credits:credit,completed:/^teljes/i.test(status),semester:sem||'',teacher:'',type:req});
    }); return out; }
  function curSem(){ var m=T().match(/\\d{4}\\/\\d{2}\\/\\d/); return m?m[0]:''; }
  function semTriggers(){ return nodes().filter(function(el){ return vis(el) && /\\d{4}\\/\\d{2}\\/\\d/.test(el.textContent||'') && (el.textContent||'').length<44; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); }
  async function readSemesters(){ clickText("Szűrő"); await sleep(700); var tr=semTriggers(); if(tr[0]){ tr[0].click(); await sleep(600); } var opts=nodes().filter(function(el){ return vis(el)&&el.children.length<=1&&/\\d{4}\\/\\d{2}\\/\\d/.test(el.textContent||'')&&(el.textContent||'').length<44; }); var labels=[]; opts.forEach(function(el){ var m=(el.textContent||'').match(/\\d{4}\\/\\d{2}\\/\\d/); if(m&&labels.indexOf(m[0])<0) labels.push(m[0]); }); if(tr[0]) tr[0].click(); await sleep(300); return labels; }
  async function selectSem(key){ clickText("Szűrő"); await sleep(600); var tr=semTriggers(); if(tr[0]){ tr[0].click(); await sleep(600); } var opt=nodes().filter(function(el){ return vis(el)&&el.children.length<=1&&(el.textContent||'').indexOf(key)>=0&&(el.textContent||'').length<44; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); if(!opt[0]) return false; opt[0].click(); await sleep(400); clickText("Lista szűrése"); await sleep(1500); return true; }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre (a hub-login intézi)…");
      var inOk=await waitFor(function(){ return !document.querySelector('#userName') && /Men[üu]/i.test(T()); }, 60000);
      log(inOk?"Bejelentkezve":"Nem sikerült időben bejelentkezni");
      if(!inOk){ window.__nc=JSON.stringify({done:true,courses:[],log:LOG.join("\\n"),raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)}); return; }
      await sleep(900);
      log("Menü megnyitása");
      if(!clickText("Menü")) log("Nem találom: Menü"); await sleep(900);
      log("Tárgyak menü"); if(!clickText("Tárgyak")) log("Nem találom: Tárgyak"); await sleep(900);
      log("Felvett tárgyak"); if(!clickText("Felvett tárgyak")) log("Nem találom: Felvett tárgyak"); await sleep(1500);
      var loaded=await waitFor(function(){ return /Felvett tárgyak/i.test(T()) && parseRows("").length>0; }, 15000);
      if(!loaded) log("A Felvett tárgyak lista nem jelent meg");
      var all=[]; var cs=curSem(); var first=parseRows(cs); log("Aktuális ("+cs+"): "+first.length+" tárgy"); all=all.concat(first);
      var sems=[]; try{ sems=await readSemesters(); }catch(e){ log("Félév-olvasás hiba: "+e); }
      log("Félévek: "+(sems.join(", ")||"—"));
      for(var i=0;i<sems.length;i++){ if(sems[i]===cs) continue; log("Váltás: "+sems[i]); var ok=false; try{ ok=await selectSem(sems[i]); }catch(e){ log("hiba: "+e); } if(!ok){ log("Sikertelen: "+sems[i]); continue; } var rows=parseRows(sems[i]); log(sems[i]+": "+rows.length+" tárgy"); all=all.concat(rows); }
      var seen={}, ded=[]; all.forEach(function(c){ var k=c.code+"|"+c.semester; if(c.code&&!seen[k]){ seen[k]=1; ded.push(c); } });
      window.__nc=JSON.stringify({done:true, courses:ded, semesters:sems.length?sems:(cs?[cs]:[]), log:LOG.join("\\n"), raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)});
    }catch(e){ window.__nc=JSON.stringify({done:true, courses:[], error:String(e), log:LOG.join("\\n"), raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)}); }
  })();
  return "started";
})();`;
}

// ----- manual exam add -----
let exSubject = "", exDate = null, exTime = "", exSubjSem = null, editingExamId = null;
function openExamSheet() {
  editingExamId = null;
  exSubject = ""; exDate = null; exTime = ""; exSubjSem = null;
  $("ex-subject-lbl").textContent = "Válassz tárgyat";
  $("ex-loc").value = ""; $("ex-note").value = "";
  $("ex-date-lbl").textContent = "Válassz dátumot";
  $("ex-time-lbl").textContent = "--:--";
  document.querySelector("#exam-sheet .sheet-title").textContent = "Számonkérés hozzáadása";
  $("exam-sheet").classList.remove("hidden");
}
function openExamEdit(e) {
  const m = (state.manualExams || []).find((x) => x.id === e.id); if (!m) return;
  editingExamId = m.id;
  exSubject = m.subject || ""; exDate = new Date(m.start); exTime = hm(new Date(m.start)); exSubjSem = null;
  $("ex-subject-lbl").textContent = m.subject || "Válassz tárgyat";
  $("ex-loc").value = m.location || ""; $("ex-note").value = m.note || "";
  $("ex-date-lbl").textContent = exDate.getFullYear() + ". " + TT_MON[exDate.getMonth()] + " " + exDate.getDate() + ".";
  $("ex-time-lbl").textContent = exTime;
  document.querySelector("#exam-sheet .sheet-title").textContent = "Számonkérés szerkesztése";
  $("exam-sheet").classList.remove("hidden");
}
function openSubjectPicker() {
  const sems = availableSemesters(classEvents().concat(examEvents()));
  if (exSubjSem === null) { exSubjSem = currentSemesterKey(); if (!sems.some((s) => s.key === exSubjSem)) exSubjSem = sems.length ? sems[sems.length - 1].key : "all"; }
  const build = () => {
    let evs = classEvents();
    if (exSubjSem !== "all") { const s = sems.find((x) => x.key === exSubjSem); if (s) evs = evs.filter((e) => e.S >= s.start && e.S < s.end); }
    const subs = Array.from(new Set(evs.map((e) => e.summary).filter(Boolean))).sort((a, b) => a.localeCompare(b, "hu"));
    openList({
      title: "Tárgy választása", selected: exSubject, searchable: true, allowCustom: true,
      items: subs.map((s) => ({ value: s, label: s })),
      chips: [{ key: "all", label: "Összes" }].concat(sems.map((s) => ({ key: s.key, label: s.key }))),
      chipCurrent: exSubjSem, onChip: (k) => { exSubjSem = k; build(); },
      onPick: (v) => { exSubject = v; $("ex-subject-lbl").textContent = v; },
    });
  };
  build();
}
$("ex-subject-btn").onclick = openSubjectPicker;
$("ex-date-btn").onclick = () => openCalendar(exDate || new Date(), (d) => { exDate = d; $("ex-date-lbl").textContent = d.getFullYear() + ". " + TT_MON[d.getMonth()] + " " + d.getDate() + "."; });
$("ex-time-btn").onclick = () => openTime(exTime || "08:00", (t) => { exTime = t; $("ex-time-lbl").textContent = t; });
$("exam-cancel").onclick = () => $("exam-sheet").classList.add("hidden");
$("exam-save").onclick = () => {
  const subject = exSubject.trim();
  if (!subject) return toast("Válassz tárgyat.");
  if (!exDate) return toast("Válassz dátumot.");
  const [h, m] = (exTime || "00:00").split(":").map(Number);
  const start = new Date(exDate.getFullYear(), exDate.getMonth(), exDate.getDate(), h || 0, m || 0, 0);
  const data = { subject, title: subject, start: start.toISOString(), end: start.toISOString(), location: $("ex-loc").value.trim(), note: $("ex-note").value.trim() };
  state.manualExams = state.manualExams || [];
  if (editingExamId) {
    const m = state.manualExams.find((x) => x.id === editingExamId);
    if (m) Object.assign(m, data);
  } else {
    state.manualExams.push({ id: uid(), ...data });
  }
  saveState(); $("exam-sheet").classList.add("hidden"); renderExams(); renderHome();
  toast(editingExamId ? "Számonkérés frissítve." : "Számonkérés hozzáadva.");
  editingExamId = null;

};

// ----- event detail + notes -----
let detailEvent = null, detailExamMode = false;
function openDetail(e, examMode) {
  if (!e) return;
  detailEvent = e; detailExamMode = examMode;
  renderDetail();
  $("detail-sheet").classList.remove("hidden");
}
function renderDetail() {
  const e = detailEvent; if (!e) return;
  const notes = e.manual ? (e.note ? [{ id: "m", text: e.note, manualNote: true }] : []) : notesForEvent(e);
  let html = `${e.subject ? `<div class="detail-subj">${esc(e.subject)}</div>` : ""}<div class="sheet-title">${esc(e.summary || "Esemény")}</div>
    <div class="detail-meta">${icon("clock")} ${esc(dayHeading(e.S))} · ${hm(e.S)}${e.E > e.S ? "–" + hm(e.E) : ""}${e.location ? ` &nbsp;·&nbsp; ${icon("pin")} ${esc(e.location)}` : ""}</div>`;
  html += `<div class="detail-notes">`;
  if (notes.length) notes.forEach((n) => {
    html += `<div class="note-row"><span>${esc(n.text)}</span>${n.manualNote ? "" : `<button class="note-x" data-nid="${n.id}">${icon("x")}</button>`}</div>`;
  });
  else html += `<div class="hint" style="margin:0">Nincs megjegyzés.</div>`;
  html += `</div>`;
  if (!e.manual) {
    html += `<div class="field" style="margin-top:14px"><input class="input" id="dn-input" placeholder="Új megjegyzés, például hozz papírt" autocomplete="off" /></div>
      <div class="detail-add"><button class="btn outline" id="dn-occ">Csak erre az alkalomra</button><button class="btn outline" id="dn-sub">Minden ilyen órára</button></div>`;
  } else {
    html += `<div class="detail-add" style="margin-top:14px"><button class="btn outline" id="dn-edit">Szerkesztés</button><button class="btn danger" id="dn-del">Törlés</button></div>`;
  }
  $("detail-body").innerHTML = html;
  $("detail-body").querySelectorAll(".note-x").forEach((b) => b.onclick = () => {
    state.notes = (state.notes || []).filter((n) => n.id !== b.dataset.nid); saveState(); renderDetail(); refreshAgendas();
  });
  const add = (kind) => {
    const v = $("dn-input").value.trim(); if (!v) return toast("Írj be megjegyzést.");
    state.notes = state.notes || [];
    state.notes.push(kind === "subject"
      ? { id: uid(), kind: "subject", subject: e.summary, text: v }
      : { id: uid(), kind: "occurrence", occKey: occKey(e), text: v });
    saveState(); renderDetail(); refreshAgendas(); toast("Megjegyzés hozzáadva.");
  };
  if ($("dn-occ")) $("dn-occ").onclick = () => add("occurrence");
  if ($("dn-sub")) $("dn-sub").onclick = () => add("subject");
  if ($("dn-edit")) $("dn-edit").onclick = () => { $("detail-sheet").classList.add("hidden"); openExamEdit(e); };
  if ($("dn-del")) $("dn-del").onclick = () => {
    state.manualExams = (state.manualExams || []).filter((m) => m.id !== e.id); saveState();
    $("detail-sheet").classList.add("hidden"); renderExams(); renderHome(); toast("Törölve.");
  };
}
function refreshAgendas() { renderTimetable(); renderExams(); renderHome(); }
$("detail-close").onclick = () => $("detail-sheet").classList.add("hidden");

// =====================================================================
//  SETTINGS
// =====================================================================
function syncSettings() {
  $("in-username").value = state.username || "";
  $("in-username-err").hidden = !state.username || validCode(state.username);
  updateIcsStatus();
  $("in-password").value = state.password || "";
  $("cur-uni").textContent = state.university || "Nincs kiválasztva";
  renderServersSettings();
  renderTotpStatus();
  updateUpdateStatus();
  updateBreakMinStatus();
  syncSecurityToggles();
}
const SEC_TOGGLES = [["sec-startup", "startup"], ["sec-resume", "resume"], ["sec-sensitive", "sensitive"], ["sec-actions", "actions"]];
function syncSecurityToggles() { SEC_TOGGLES.forEach(([id, key]) => { const el = $(id); if (el) el.classList.toggle("on", secOn(key)); }); }
SEC_TOGGLES.forEach(([id, key]) => {
  $(id).onclick = async () => {
    // Changing a security switch is itself a protected action.
    if (!(await requireAuthFor("actions"))) return;
    if (!state.security) state.security = { startup: true, resume: true, sensitive: true, actions: true };
    state.security[key] = !secOn(key);
    saveState(); syncSecurityToggles();
  };
});
function updateBreakMinStatus() { const el = $("breakmin-status"); if (el) el.textContent = (state.breakMin || 20) + " perc"; }
$("btn-breakmin").onclick = () => {
  const items = [];
  for (let m = 5; m <= 120; m += 5) items.push({ value: String(m), label: m + " perc" });
  openList({
    title: "Szünet minimum hossza",
    selected: String(state.breakMin || 20),
    items,
    onPick: (v) => { state.breakMin = parseInt(v, 10) || 20; saveState(); updateBreakMinStatus(); renderTimetable(); },
  });
};
function updateUpdateStatus() {
  const el = $("update-status"); if (!el) return;
  let s = "Verzió " + APP_VERSION;
  const last = window.OTA && window.OTA.lastStatus && window.OTA.lastStatus();
  if (last && last.s) s += " · " + last.s;
  el.textContent = s;
}
$("btn-check-update").onclick = async () => {
  if (!isNative) { toast("A frissítés a telefonos alkalmazásban működik."); return; }
  if (!window.OTA) { toast("A frissítő nem elérhető."); return; }
  showBusy("Frissítés keresése…");
  let res;
  try { res = await window.OTA.check({ current: APP_VERSION, apply: "now" }); }
  catch (e) { res = { ok: false, reason: "exception", error: String(e) }; }
  finally { hideBusy(); }
  updateUpdateStatus();
  if (res && res.ok && res.updated) toast("Új verzió letöltve, frissítés…"); // set() reloads
  else if (res && res.ok) toast("Az alkalmazás naprakész (" + APP_VERSION + ").");
  else toast("Frissítés nem sikerült: " + ((res && (res.error || res.reason)) || "ismeretlen"));
};
$("in-username").addEventListener("input", (e) => {
  const v = normCode(e.target.value); e.target.value = v; state.username = v; saveState();
  $("in-username-err").hidden = v.length === 0 || validCode(v);
});
$("in-password").addEventListener("input", (e) => { state.password = e.target.value; saveState(); });
$("btn-show-pass").onclick = async () => { const el = $("in-password"); if (el.type !== "password") { el.type = "password"; return; } if (!(await requireAuthFor("sensitive"))) return; el.type = "text"; };

function renderServersSettings() {
  const list = $("server-list"); list.innerHTML = "";
  state.servers.forEach((s) => {
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<span class="row-ic">${icon("swap")}</span>
      <span class="row-main"><span class="row-title">${esc(s.label)}</span><span class="row-sub">${esc(s.url)}</span></span>
      ${s.id === state.activeServerId ? '<span class="row-val">aktív</span>' : ""}`;
    row.querySelector(".row-main").onclick = () => { state.activeServerId = s.id; saveState(); renderServersSettings(); };
    list.appendChild(row);
  });
}
$("btn-change-uni").onclick = () => openUniSheet();
function openUniSheet() {
  const render = () => renderUniList($("uni-sheet-list"), $("uni-sheet-search").value, state.university, (u) => {
    applyUniversity(u); $("uni-sheet").classList.add("hidden"); syncSettings(); renderHome(); toast(u.name + " beállítva");
  });
  $("uni-sheet-search").value = ""; render();
  $("uni-sheet-search").oninput = render;
  $("uni-sheet").classList.remove("hidden");
}
$("uni-sheet-close").onclick = () => $("uni-sheet").classList.add("hidden");

function renderTotpStatus() {
  const box = $("totp-status");
  if (state.no2fa && hasTotp()) box.innerHTML = `<div class="status-pill neutral">2FA kikapcsolva (kulcs elmentve: ${esc(state.totp.name)})</div>`;
  else if (state.no2fa) box.innerHTML = `<div class="status-pill neutral">2FA kikapcsolva (nincs a sulinál)</div>`;
  else if (hasTotp()) box.innerHTML = `<div class="status-pill ok">${icon("check")} Beállítva: ${esc(state.totp.name)}</div><button class="btn ghost narrow" id="btn-remove-totp" style="margin-top:8px">2FA törlése</button>`;
  else box.innerHTML = `<div class="status-pill neutral">Nincs beállítva</div>`;
  const rm = $("btn-remove-totp"); if (rm) rm.onclick = () => { state.totp = null; saveState(); renderTotpStatus(); renderHome(); toast("2FA törölve."); };
  $("toggle-no2fa").classList.toggle("on", state.no2fa);
}
$("in-qr").addEventListener("change", (e) => handleQrPick(e, $("qr-result"), () => { renderTotpStatus(); renderHome(); totpTick(); }));
$("btn-save-secret").onclick = async () => {
  const secret = $("in-secret").value.replace(/\s+/g, "").toUpperCase();
  if (!secret) return toast("Írd be a Base32 kulcsot.");
  try { await validateSecret(secret); state.totp = { secret, digits: 6, period: 30, algorithm: "SHA1", name: "Kézi kulcs" }; state.no2fa = false; saveState(); $("in-secret").value = ""; renderTotpStatus(); renderHome(); totpTick(); toast("2FA kulcs mentve"); }
  catch (err) { toast("Érvénytelen kulcs: " + err.message); }
};
// FIX: keep the uploaded key when toggling; just flip the flag.
$("toggle-no2fa").onclick = () => { state.no2fa = !state.no2fa; saveState(); renderTotpStatus(); renderHome(); totpTick(); };

// legal document sheets (settings + close buttons)
$("open-privacy2").onclick = () => $("privacy-sheet").classList.remove("hidden");
$("open-terms2").onclick = () => $("terms-sheet").classList.remove("hidden");
$("privacy-close").onclick = () => $("privacy-sheet").classList.add("hidden");
$("terms-close").onclick = () => $("terms-sheet").classList.add("hidden");

$("btn-reset").onclick = () => { $("reset-delpin").classList.remove("on"); $("confirm-dialog").classList.remove("hidden"); };
$("reset-delpin").onclick = () => $("reset-delpin").classList.toggle("on");
$("confirm-cancel").onclick = () => $("confirm-dialog").classList.add("hidden");
$("confirm-ok").onclick = async () => {
  const delPin = $("reset-delpin").classList.contains("on");
  $("confirm-dialog").classList.add("hidden");
  const ok = await requireAuthFor("actions");
  if (!ok) return;
  const keep = (!delPin && state.pinHash) ? { pinHash: state.pinHash, biometric: state.biometric } : null;
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  if (keep) { const s = defaultState(); s.pinHash = keep.pinHash; s.biometric = keep.biometric; try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
  location.reload();
};

// =====================================================================
//  LOGIN ENGINE (unchanged behaviour)
// =====================================================================
$("btn-login").onclick = async () => {
  if (!state.username || !state.password) return toast("Hiányoznak a belépési adatok.");
  await totpTick();
  const srv = activeServer();
  if (isNative) return nativeLogin(srv);
  return browserPreviewLogin(srv);
};
function nativeLogin(srv) {
  const iab = window.cordova && window.cordova.InAppBrowser;
  if (!iab) { toast("InAppBrowser plugin hiányzik (lásd README)."); return; }
  const code = state.no2fa ? "" : lastCode;
  const script = buildInjectScript(state.username, state.password, code);
  const opts = ["location=yes", "hideurlbar=no", "hidenavigationbuttons=no", "zoom=yes", "hardwareback=yes", "footer=no",
    "toolbarcolor=#141518", "navigationbuttoncolor=#ecedee", "closebuttoncolor=#ecedee", "closebuttoncaption=Kész"].join(",");
  const ref = iab.open(srv.url, "_blank", opts);
  ref.addEventListener("loadstop", () => { try { ref.executeScript({ code: script }); } catch (e) { /* ignore */ } });
  toast("Neptun megnyitása, automatikus kitöltés folyamatban.");
}
function browserPreviewLogin(srv) {
  const code = state.no2fa ? "" : lastCode;
  $("login-modal-body").innerHTML = `A böngészős előnézet nem tud közvetlenül belépni, mert a böngésző ezt biztonsági okból nem engedi. A kész alkalmazás ezt automatikusan elvégzi:
    <ol style="padding-left:18px;line-height:1.7;margin:8px 0 0">
      <li>Megnyitja ezt a címet: <span class="mono">${esc(srv.url)}</span></li>
      <li>Kitölti az azonosítót, ${esc(state.username)}, és a jelszót</li>
      <li>Belép, majd beírja a 2FA kódot: <b class="mono">${code || "nincs"}</b></li>
      <li>Megnyomja a Bejelentkezést</li></ol>`;
  $("login-modal").classList.remove("hidden");
  $("lm-open").onclick = async () => { try { await navigator.clipboard.writeText(code || state.password); toast(code ? "2FA kód a vágólapon: " + code : "Jelszó a vágólapon."); } catch { /* ignore */ } window.open(srv.url, "_blank", "noopener"); };
}
$("login-modal-close").onclick = () => $("login-modal").classList.add("hidden");

function buildInjectScript(username, password, code) {
  const u = JSON.stringify(username), p = JSON.stringify(password), c = JSON.stringify(code || "");
  return `(function(){
  function setVal(el, val){ if(!el) return false;
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el, val);
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); return true; }
  function click(el){ if(el){ el.click(); return true;} return false; }
  function visible(el){ return el && el.offsetParent !== null && !el.disabled; }
  function waitFor(sel, timeout){ return new Promise(function(res){ var t0=Date.now();
    (function poll(){ var el=(typeof sel==='function')?sel():document.querySelector(sel);
      if(el && visible(el)) return res(el); if(Date.now()-t0>timeout) return res(null); setTimeout(poll,250); })(); }); }
  function findCodeField(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){
    if(!visible(el)||el.value) return false; var t=(el.type||'').toLowerCase();
    if(['text','tel','number','password'].indexOf(t)===-1) return false;
    var hay=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase();
    if(/code|otp|token|kod|kód|hitelesít|authent|2fa|mfa|one-time/.test(hay)) return true;
    var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0 && ml<=8; }); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function findSubmit(){ return Array.prototype.slice.call(document.querySelectorAll('button, input[type=submit]')).find(function(b){
    if(!visible(b)) return false; var hay=((b.id||'')+' '+(b.innerText||b.value||'')+' '+(b.getAttribute('aria-label')||'')).toLowerCase();
    return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|confirm|submit|login/.test(hay); }); }
  (async function(){
    click(document.querySelector('#notification-bar-0-notification-button-accept'));
    var user = await waitFor('#userName', 8000);
    if(user){ setVal(user, ${u}); setVal(document.querySelector('#password-form-password'), ${p}); await sleep(150); click(document.querySelector('#login-button')); }
    var CODE = ${c};
    if(CODE){ var codeEl = await waitFor(findCodeField, 12000);
      if(codeEl){ setVal(codeEl, CODE); await sleep(250); setVal(codeEl, CODE); await sleep(1000);
        var btn = await waitFor(findSubmit, 8000);
        if(btn){ btn.click(); await sleep(700); if(visible(btn)) btn.click(); } } }
  })();
})();`;
}
window.buildNeptunInjectScript = buildInjectScript;

// ---------- pull to refresh ----------
function attachPTR(scrollEl, ptrEl, onRefresh) {
  if (!scrollEl || !ptrEl) return;
  let startY = 0, pulling = false, dy = 0, ready = false;
  const TH = 68;
  const reset = () => { ptrEl.classList.remove("ready"); ptrEl.style.opacity = "0"; ptrEl.style.transform = "translate(-50%,0)"; };
  scrollEl.addEventListener("touchstart", (e) => { if (scrollEl.scrollTop <= 0 && !ptrEl.classList.contains("spin")) { startY = e.touches[0].clientY; pulling = true; dy = 0; ready = false; } }, { passive: true });
  scrollEl.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scrollEl.scrollTop > 0) { reset(); return; }
    e.preventDefault();
    const d = Math.min(dy, 120);
    ptrEl.style.opacity = String(Math.min(1, d / TH));
    ptrEl.style.transform = `translate(-50%, ${d * 0.5}px) rotate(${d * 3}deg)`;
    ready = d >= TH; ptrEl.classList.toggle("ready", ready);
  }, { passive: false });
  const end = () => {
    if (!pulling) return; pulling = false;
    if (ready) { ptrEl.classList.add("spin"); Promise.resolve(onRefresh()).finally(() => { ptrEl.classList.remove("spin"); reset(); }); }
    else reset();
    ready = false;
  };
  scrollEl.addEventListener("touchend", end);
  scrollEl.addEventListener("touchcancel", end);
}

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
  else { isLocked = false; $("lock").classList.add("hidden"); }
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
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && secOn("resume")) lockNow(); });

// =====================================================================
//  INIT
// =====================================================================
renderIcons(document);
$("version-tag").textContent = APP_VERSION;
attachPTR($("tt-scroll"), $("tt-ptr"), fetchTimetable);
attachPTR($("ex-scroll"), $("ex-ptr"), fetchTimetable);
if (isNative) { document.body.classList.add("native"); document.querySelectorAll("[data-preview-only]").forEach((el) => el.remove()); }
initOnboarding();
function setBootText(t) { const b = $("boot-text"); if (b) b.textContent = t; }
function hideBoot() { const b = $("boot"); if (!b) return; b.classList.add("boot--hide"); setTimeout(() => { b.hidden = true; }, 420); }

(async () => {
  const bootTs = Date.now();
  bioOK = await bioAvailable(); // resolve BEFORE the first lock so biometrics is offered on cold start
  // Cold start: behind the loading screen, check for an OTA update and apply it before login.
  if (isNative && window.OTA && window.OTA.configured()) {
    setBootText("Frissítés keresése");
    try {
      await Promise.race([
        window.OTA.check({ current: APP_VERSION, apply: "now", onFound: () => setBootText("Új verzió letöltése"),
          onError: (e) => setBootText("Frissítés kihagyva") }),
        new Promise((r) => setTimeout(r, 12000)), // don't let a slow network hold the app hostage
      ]);
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
  // Keep the loader visible long enough to read (min ~700ms), then reveal the app/login.
  setTimeout(hideBoot, Math.max(0, 700 - (Date.now() - bootTs)));
})();
