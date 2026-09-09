import { generateTOTP } from "./lib/totp.js";
import { parseMigrationUri } from "./lib/gauth.js";
import { UNIVERSITIES } from "./data/universities.js";
import { parseICS } from "./lib/ical.js";

const STORE_KEY = "neptun-plus";
const APP_VERSION = "v0.072";
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
    hiddenOcc: [], // occKeys of class occurrences the user chose to hide (conflict resolution)
    dlc: {}, // downloaded add-ons keyed by id: { version, title, kind, items }
    semesters: null, // { fetchedAt, list:["2025/26/2", ...] } read from Neptun (Felvett tárgyak → Szűrő)
    progress: null, // { fetchedAt, done, total, free } from Neptun (Tanulmányok → Előrehaladás)
    lastBackup: null, // yyyy-m-d of the last daily auto-backup
    breakMin: 20, // minimum gap (minutes) between two same-day classes to show a "Szünet" block
    // When to ask for the PIN / biometric (all on by default = most secure). If a switch is off,
    // that flow does not ask. Only meaningful when a PIN is set.
    security: { startup: true, resume: true, sensitive: true, actions: true },
    // Reminders per category; each has on/off and up to 3 lead times (minutes before start).
    notify: {
      classes: { enabled: false, leads: [30] },
      zh: { enabled: false, leads: [1440, 120] },
      vizsga: { enabled: false, leads: [1440] },
    },
  };
}
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return migrate(Object.assign(defaultState(), JSON.parse(raw))); }
  catch { /* ignore */ }
  return defaultState();
}
// Bring older saved shapes up to date (Object.assign is shallow, so nested objects need fixing).
function migrate(s) {
  const d = defaultState();
  if (!s.notify || typeof s.notify !== "object") s.notify = d.notify;
  // Old shape: notify:{enabled,lead}. New: per-category classes/zh/vizsga.
  if (!s.notify.classes) {
    const on = !!s.notify.enabled, lead = s.notify.lead || 30;
    s.notify = { classes: { enabled: on, leads: [lead] }, zh: d.notify.zh, vizsga: d.notify.vizsga };
  }
  ["classes", "zh", "vizsga"].forEach((c) => { if (!s.notify[c]) s.notify[c] = d.notify[c]; if (!Array.isArray(s.notify[c].leads)) s.notify[c].leads = d.notify[c].leads.slice(); });
  return s;
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
function ask({ title, body, okText = "Igen", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title; $("ask-body").innerHTML = body; $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
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
function enterApp() { $("screen-onboarding").classList.add("hidden"); $("app-shell").classList.remove("hidden"); updateScrollPad(); requestAnimationFrame(updateScrollPad); setTimeout(updateScrollPad, 350); }
// Reserve enough bottom padding in every scroll area to clear the nav bar — measured live, so it
// stays correct at any text size (large fonts make the nav taller).
function updateScrollPad() {
  const nav = document.querySelector(".nav-island"); if (!nav) return;
  const r = nav.getBoundingClientRect();
  const pad = Math.max(0, Math.round(window.innerHeight - r.top) + 24);
  if (pad > 0) document.documentElement.style.setProperty("--scroll-pad", pad + "px");
}
document.querySelectorAll(".nav-btn").forEach((b) => b.onclick = () => navTo(b.dataset.tab));
document.querySelectorAll("[data-settings]").forEach((b) => b.onclick = () => showTab("tab-settings"));
$("settings-back").onclick = () => showTab(lastMainTab);
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
  let raf = 0, pendingDx = 0, pendingSeg = 0; // pendingSeg: in-hub segment change instead of a tab change
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
    curEl = cur; nbrEl = null; dir = 0; decided = 0; lastDx = 0; pendingDx = 0; pendingSeg = 0; active = true;
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
      // On the hub, a swipe first moves between the inner segments; only cross to the next tab at the edge.
      pendingSeg = 0;
      if (curEl.id === "tab-home") {
        if (dir === 1 && hubSeg < 1) { pendingSeg = 1; nbrEl = null; }
        else if (dir === -1 && hubSeg > 0) { pendingSeg = -1; nbrEl = null; }
      }
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
    // In-hub segment swipe: switch Belépés ↔ Áttekintés (pane rubber-bands back below).
    if (pendingSeg !== 0 && Math.abs(lastDx) > w * 0.22) showHubSeg(pendingSeg > 0 ? "overview" : "login");
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
  $("home-sub").textContent = semLoading ? "Félévek beolvasása…" : (ready ? "Készen áll" : "Állítsd be a belépést");
  $("login-hint").textContent = isNative ? "Egy érintés, a többit az alkalmazás elvégzi." : "Előnézet. Az alkalmazásban ez automatikusan belép.";
  $("server-chip").style.display = state.servers.length > 1 ? "" : "none";
  renderNextClass();
  renderNextExam();
  renderProgress();
}
let hubSeg = 0; // 0 = Belépés, 1 = Áttekintés (used by the pager for in-hub swipe)
function showHubSeg(seg) {
  hubSeg = seg === "overview" ? 1 : 0;
  document.querySelectorAll("#hub-seg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.seg === seg));
  $("hub-login").hidden = seg !== "login";
  $("hub-overview").hidden = seg !== "overview";
}
document.querySelectorAll("#hub-seg .seg-btn").forEach((b) => b.onclick = () => showHubSeg(b.dataset.seg));
function renderProgress() {
  const el = $("hub-credit"); if (!el) return;
  const p = state.progress;
  if (!p || !p.total) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
  el.innerHTML = `<div class="cred-row"><div><div class="cred-big">${p.done} / ${p.total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${pct}%</div></div>`
    + `<div class="cred-bar"><div class="cred-fill" style="width:${pct}%"></div></div>`
    + `<div class="cred-free">Ebből szabadon választható: <b>${p.free || 0}</b> kredit</div>`;
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
  ((state.semesters && state.semesters.list) || []).forEach((k) => { if (k && !map[k]) map[k] = semKeyToObj(k); });
  return Object.values(map).sort((a, b) => a.start - b.start);
}
// Period options for the agenda come only from the fetched semester list (not derived from events).
function agendaSemesters() {
  return (((state.semesters && state.semesters.list) || []).map((k) => semKeyToObj(k))).sort((a, b) => a.start - b.start);
}
function allEvents() {
  return ((state.ics && state.ics.events) || []).map((e) => ({ ...e, S: new Date(e.s), E: new Date(e.e), exam: isExam(e) }));
}
// De-duplicate exact duplicate occurrences (same start+end+summary) — "on paper two, really one".
function dedupEvents(list) {
  const seen = {}, out = [];
  list.forEach((e) => { const k = (e.s || "") + "|" + (e.e || "") + "|" + (e.summary || ""); if (!seen[k]) { seen[k] = 1; out.push(e); } });
  return out;
}
function classEvents() { return dedupEvents(allEvents().filter((e) => !e.exam)); }
// Hiding is a RULE, not a single date: subject + weekday + start time + semester. So hiding one
// "XY hétfő 8:00" occurrence hides every XY Monday-08:00 class in that same semester.
// O(1) — derive the semester key straight from the date (do NOT scan allSemesters per event; that
// made hideKey O(n²) over the whole feed and froze the UI on the hide/unhide button).
function semKeyFor(d) { return semObj(d).key; }
function hideKey(e) { return (e.summary || "") + "|" + e.S.getDay() + "|" + hm(e.S) + "|" + semKeyFor(e.S); }
function isHiddenOcc(e) { return (state.hiddenOcc || []).indexOf(hideKey(e)) >= 0; }
function visibleClassEvents() { return classEvents().filter((e) => !isHiddenOcc(e)); }
function manualExamEvents() {
  return (state.manualExams || []).map((m) => ({ S: new Date(m.start), E: new Date(m.end || m.start), s: m.start, e: m.end || m.start,
    summary: m.title || m.subject || "Számonkérés", location: m.location || "", subject: m.subject || "", note: m.note || "", exam: true, manual: true, id: m.id }));
}
function examEvents() { return allEvents().filter((e) => e.exam).concat(manualExamEvents()); }
function currentClass() { const now = Date.now(); return visibleClassEvents().filter((e) => e.S.getTime() <= now && e.E.getTime() > now).sort((a, b) => a.S - b.S)[0] || null; }
function nextClass() { const now = Date.now(); return visibleClassEvents().filter((e) => e.S.getTime() > now).sort((a, b) => a.S - b.S)[0] || null; }
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
    saveState(); renderTimetable(); renderExams(); renderHome(); rescheduleNotifications(); toast(events.length + " esemény frissítve.");
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
  const sems = agendaSemesters(); // period options come from the fetched semester list (empty → only "Közelgő")
  if (filter !== "upcoming" && !sems.some((x) => x.key === filter)) filter = "upcoming"; // stale/removed semester
  const now = Date.now();
  let list;
  if (filter === "upcoming") list = items.filter((e) => e.E.getTime() >= now).sort((a, b) => a.S - b.S);
  else { const s = sems.find((x) => x.key === filter); list = s ? items.filter((e) => e.S >= s.start && e.S < s.end).sort((a, b) => a.S - b.S) : []; }
  subEl.textContent = list.length + (examMode ? " számonkérés" : " óra");
  // Highlight the ongoing class ("Jelenleg") and the soonest upcoming one ("Következő") — only in the
  // Közelgő view for the timetable (not for exams / past semesters). Computed over VISIBLE (non-hidden)
  // classes so hiding a conflict promotes the remaining one.
  const showFlags = filter === "upcoming" && !examMode;
  let nowKey = "", nextKey = "", conflictSet = new Set();
  if (!examMode) {
    const vis = list.filter((e) => !isHiddenOcc(e));
    if (showFlags) {
      const on = vis.find((e) => e.S.getTime() <= now && e.E.getTime() > now);
      const nx = vis.find((e) => e.S.getTime() > now);
      nowKey = on ? occKey(on) : ""; nextKey = nx ? occKey(nx) : "";
    }
    // Two visible classes whose time ranges overlap are a real conflict.
    for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) {
      if (vis[a].S < vis[b].E && vis[b].S < vis[a].E) { conflictSet.add(occKey(vis[a])); conflictSet.add(occKey(vis[b])); }
    }
  }

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
      const k = occKey(e);
      let flagCls = "", flagText = "";
      if (!examMode && isHiddenOcc(e)) { flagCls = " muted"; flagText = "Rejtve"; }
      else if (!examMode && conflictSet.has(k)) { flagCls = " conflict"; flagText = "Ütközés"; }
      else if (k === nowKey && nowKey) { flagCls = " now"; flagText = "Jelenleg"; }
      else if (k === nextKey && nextKey) { flagCls = " next"; flagText = "Következő"; }
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
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
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
let flowActive = false; // only one Neptun InAppBrowser flow at a time
function runNeptunFlow(buildScript, gvar) {
  return new Promise((resolve, reject) => {
    const iab = window.cordova && window.cordova.InAppBrowser;
    if (!iab) return reject(new Error("InAppBrowser plugin hiányzik"));
    if (flowActive) return reject(new Error("Már fut egy Neptun folyamat"));
    flowActive = true;
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
    const finish = (err, data) => { if (done) return; done = true; flowActive = false; flowCancel = null; clearTimeout(to); if (iv) clearInterval(iv); try { ref.close(); } catch (e) {} err ? reject(err) : resolve(data); };
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
      finish(null, Object.assign({ done: true, url: "", log: "", raw: "" }, data));
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
function neptunReadSemesters() { return runNeptunFlow(buildSemesterScript, "__sems"); }
// Read just the semester list: login → Menü → Tárgyak → Felvett tárgyak → Szűrő → Félév dropdown.
function buildSemesterScript(username, password, code) {
  return `(function(){
  if(window.__semRunning) return "running"; window.__semRunning=true; window.__sems=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(sems){ try{ window.__sems=JSON.stringify({done:true,sems:sems||[],log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({sems:sems||[],log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,200); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  var RE=/\\d{4}\\/\\d{2}\\/\\d/;
  function semTriggers(){ return nodes().filter(function(el){ return vis(el) && RE.test(el.textContent||'') && (el.textContent||'').length<48; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); }
  function collect(){ var labels=[]; nodes().forEach(function(el){ if(!vis(el)||el.children.length>1) return; var t=el.textContent||''; if(t.length>48) return; var m=t.match(RE); if(m&&labels.indexOf(m[0])<0) labels.push(m[0]); }); return labels; }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver([]); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(120);}
      log("Tárgyak"); var t=await waitFor(function(){return pick("Tárgyak");},8000); if(t){ t.click(); await sleep(120);}
      log("Felvett tárgyak"); var f=await waitFor(function(){return pick("Felvett tárgyak");},8000); if(f){ f.click(); }
      await waitFor(function(){ return /Felvett t[aá]rgyak/i.test(T()); }, 12000); await sleep(400);
      log("Szűrő"); var sz=await waitFor(function(){return pick("Szűrő");},8000); if(sz){ sz.click(); await sleep(500);}
      // open the Félév dropdown (its trigger shows a YYYY/YY/S value)
      var tr=await waitFor(function(){ var a=semTriggers(); return a.length?a[0]:null; }, 8000); if(tr){ tr.click(); await sleep(500);}
      var sems=await waitFor(function(){ var l=collect(); return l.length>=2?l:null; }, 6000); if(!sems) sems=collect();
      log("Félévek: "+(sems.join(", ")||"—"));
      deliver(sems);
    }catch(e){ log("HIBA: "+String(e)); deliver([]); }
  })();
  return "started";
})();`;
}
async function grabSemesters() {
  if (!isNative) { toast("A félévek beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let sems = [], cancelled = false;
  try {
    const res = await neptunReadSemesters();
    if (res && res.log) courseLog = res.log.split("\n");
    sems = (res && res.sems) || [];
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (sems.length) {
    state.semesters = { fetchedAt: new Date().toISOString(), list: sems };
    saveState(); syncSemStatus(); renderTimetable(); renderExams(); renderCourses();
    toast(sems.length + " félév beolvasva."); return;
  }
  await ask({ title: "Félév lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") });
}
function neptunReadProgress() { return runNeptunFlow(buildProgressScript, "__prog"); }
// Read credit progress: login → Menü → Tanulmányok → Előrehaladás → parse X/Y + szabadon választható.
function buildProgressScript(username, password, code) {
  return `(function(){
  if(window.__progRunning) return "running"; window.__progRunning=true; window.__prog=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(p){ try{ window.__prog=JSON.stringify({done:true,progress:p||null,log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({progress:p||null,log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,200); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  function parseProg(){
    var t=T(); var done=null,total=null,free=null;
    var mc=t.match(/(\\d{1,3})\\s*\\/\\s*(\\d{2,4})\\s*kredit/i); if(mc){ done=parseInt(mc[1],10); total=parseInt(mc[2],10); }
    var mf=t.match(/szabadon\\s*v[aá]laszthat[oó][^0-9]{0,30}(\\d+)/i); if(mf) free=parseInt(mf[1],10);
    if(done!=null && total!=null) return {done:done,total:total,free:(free==null?0:free)};
    return null;
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver(null); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(120);}
      log("Tanulmányok"); var t=await waitFor(function(){return pick("Tanulmányok");},8000); if(t){ t.click(); await sleep(120);}
      log("Előrehaladás"); var e=await waitFor(function(){return pick("Előrehaladás");},8000); if(e){ e.click(); }
      await waitFor(function(){ return /El[oő]rehalad[aá]s/i.test(T()) && /[oö]sszkredit|kredit/i.test(T()); }, 12000); await sleep(500);
      var p=await waitFor(parseProg, 6000); if(!p) p=parseProg();
      log(p?("Kredit: "+p.done+"/"+p.total+" (szabad: "+p.free+")"):"Nem találtam kredit adatot");
      deliver(p);
    }catch(err){ log("HIBA: "+String(err)); deliver(null); }
  })();
  return "started";
})();`;
}
async function grabProgress() {
  if (!isNative) { toast("A kredit beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let prog = null, cancelled = false;
  try {
    const res = await neptunReadProgress();
    if (res && res.log) courseLog = res.log.split("\n");
    prog = (res && res.progress) || null;
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (prog && prog.total) {
    state.progress = { fetchedAt: new Date().toISOString(), done: prog.done, total: prog.total, free: prog.free || 0 };
    saveState(); syncProgStatus(); renderHome();
    toast("Kredit beolvasva: " + prog.done + "/" + prog.total); return;
  }
  await ask({ title: "Kredit lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") });
}
function hasSemesters() { return !!(state.semesters && state.semesters.list && state.semesters.list.length); }
function canAutoLogin() { return !!(state.username && state.password && (state.no2fa || hasTotp())); }
// Startup: if there is no saved semester data yet and we can log in unattended, fetch it silently
// (no spinner, no interruption). Runs behind the lock; retries next launch if it fails.
let semLoading = false, semOffered = false;
// On launch (once), if there is no saved semester data, offer to read it now. Re-offered every
// launch until data exists. Waits until the app is unlocked and settled.
async function maybeOfferSemesters() {
  if (semOffered || !isNative || !state.setupComplete || hasSemesters() || !canAutoLogin()) return;
  if (!$("lock").classList.contains("hidden")) return; // wait until unlocked
  semOffered = true;
  const ok = await ask({ title: "Félévek beolvasása", okText: "Beolvasás", cancelText: "Majd később",
    body: "Nincs elmentve, mely féléveid vannak. Beolvassam most a Neptunból? Ez kell a naptár félév szerinti szűréséhez." });
  if (ok) grabSemesters();
}

// Grab the timetable subscription (iCal) link: login → Menü → Naptár → Naptár kezelése → read link.
async function grabIcsLink() {
  if (!isNative) { toast("Az automatikus lekérés a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
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
    // Only classes (not exams) can be hidden — for resolving overlaps ("on paper I have two").
    if (!detailExamMode) {
      const hidden = isHiddenOcc(e);
      html += `<div class="detail-add" style="margin-top:10px"><button class="btn ${hidden ? "outline" : "danger"}" id="dn-hide">${hidden ? "Mégis járok erre az órára" : "Erre az órára nem járok be"}</button></div>
        <div class="hint" style="margin:8px 2px 0">A félév összes ilyen órájára érvényes (${esc(TT_DAYS[e.S.getDay()])} ${esc(hm(e.S))}).</div>`;
    }
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
  if ($("dn-hide")) $("dn-hide").onclick = () => {
    const k = hideKey(e); state.hiddenOcc = state.hiddenOcc || [];
    const was = state.hiddenOcc.indexOf(k) >= 0;
    state.hiddenOcc = was ? state.hiddenOcc.filter((x) => x !== k) : state.hiddenOcc.concat(k);
    saveState(); renderDetail(); refreshAgendas(); toast(was ? "Újra látható." : "Elrejtve a félév ilyen óráira.");
  };
  if ($("dn-edit")) $("dn-edit").onclick = () => { $("detail-sheet").classList.add("hidden"); openExamEdit(e); };
  if ($("dn-del")) $("dn-del").onclick = () => {
    state.manualExams = (state.manualExams || []).filter((m) => m.id !== e.id); saveState();
    $("detail-sheet").classList.add("hidden"); renderExams(); renderHome(); toast("Törölve.");
  };
}
function refreshAgendas() { renderTimetable(); renderExams(); renderHome(); rescheduleNotifications(); }

// =====================================================================
//  DLC / add-ons (szak-specific downloads from GitHub)
// =====================================================================
const DLC_INDEX_URL = "https://raw.githubusercontent.com/Zsalrick/neptun-plus/main/dlc/index.json";
let dlcIndex = null;
$("btn-dlc").onclick = openDlc;
$("dlc-close").onclick = () => $("dlc-sheet").classList.add("hidden");
$("acc-close").onclick = () => $("accounts-sheet").classList.add("hidden");
async function openDlc() {
  $("dlc-sheet").classList.remove("hidden");
  renderDlcList(); // cached view first
  try { const r = await fetch(DLC_INDEX_URL, { cache: "no-store" }); if (r.ok) { dlcIndex = await r.json(); renderDlcList(); } } catch (e) { /* offline: keep cached */ }
}
function dlcMeta(id) { return ((dlcIndex && dlcIndex.dlc) || []).find((d) => d.id === id); }
function renderDlcList() {
  const host = $("dlc-list"); if (!host) return;
  const cat = (dlcIndex && dlcIndex.dlc) || [], downloaded = state.dlc || {}, seen = {}, rows = [];
  cat.forEach((d) => { seen[d.id] = 1; rows.push({ m: d, have: downloaded[d.id], newer: downloaded[d.id] && downloaded[d.id].version !== d.version }); });
  Object.keys(downloaded).forEach((id) => { if (!seen[id]) rows.push({ m: { id, title: downloaded[id].title, subtitle: "" }, have: downloaded[id] }); });
  if (!rows.length) { host.innerHTML = `<div class="hint center" style="margin:14px 0">Nincs elérhető kiegészítő. Ellenőrizd az internetkapcsolatot.</div>`; return; }
  host.innerHTML = rows.map((r) => {
    const d = r.m;
    const act = !r.have ? `<button class="btn primary narrow dlc-get" data-id="${esc(d.id)}">Letöltés</button>`
      : r.newer ? `<button class="btn primary narrow dlc-get" data-id="${esc(d.id)}">Frissítés</button>`
      : `<button class="btn tonal narrow dlc-open" data-id="${esc(d.id)}">Megnyitás</button>`;
    const open = (r.have && r.newer) ? `<button class="btn outline narrow dlc-open" data-id="${esc(d.id)}">Megnyitás</button>` : "";
    return `<div class="dlc-row"><div class="dlc-main"><div class="dlc-title">${esc(d.title || d.id)}</div><div class="dlc-sub">${esc(d.subtitle || d.for || "")}</div></div><div class="dlc-actions">${act}${open}</div></div>`;
  }).join("");
  host.querySelectorAll(".dlc-get").forEach((b) => b.onclick = () => downloadDlc(b.dataset.id));
  host.querySelectorAll(".dlc-open").forEach((b) => b.onclick = () => openDlcItem(b.dataset.id));
}
async function downloadDlc(id) {
  const meta = dlcMeta(id); if (!meta || !meta.data) return toast("Nincs letöltési forrás.");
  showBusy("Letöltés…");
  try {
    const r = await fetch(meta.data, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    state.dlc = state.dlc || {};
    state.dlc[id] = { version: meta.version || data.version || "", title: meta.title || data.title || id, kind: meta.kind || data.kind || "accounts", items: data.items || [] };
    saveState(); renderDlcList(); openDlcItem(id); toast("Letöltve: " + (meta.title || id));
  } catch (e) { toast("Letöltés sikertelen: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
}
function openDlcItem(id) {
  const d = (state.dlc || {})[id]; if (!d) return;
  if (d.kind === "accounts") openAccounts(d); else toast("Ismeretlen kiegészítő típus.");
}
// ----- accounts viewer: számlaosztály filter + search + hierarchy (lazy-rendered) -----
let accItems = [], accClass = "", accFiltered = [], accShown = 0;
const ACC_PAGE = 150; // rows rendered per chunk; more load as you scroll
const ACC_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const accDigits = (n) => n.split("-")[0];               // leading number of a range like "12-16"
const accLvl = (n) => Math.min(4, accDigits(n).length); // 1=osztály … 4=alszámla
function accClassName(c) {
  const it = accItems.find((x) => x.n === c);
  const nm = it ? it.t.replace(/^sz[aá]mlaoszt[aá]ly\s*[–-]?\s*/i, "").trim() : "";
  return c + (nm ? " · " + nm : ". számlaosztály");
}
function openAccounts(d) {
  accItems = d.items || [];
  accClass = ""; $("acc-class-lbl").textContent = "Összes osztály";
  $("acc-title").textContent = d.title || "Számlatükör";
  $("acc-search").value = "";
  $("dlc-sheet").classList.add("hidden");
  $("accounts-sheet").classList.remove("hidden");
  renderAccounts("");
}
$("acc-class").onclick = () => {
  const items = [{ value: "", label: "Összes osztály" }].concat(ACC_ORDER.filter((c) => accItems.some((x) => accDigits(x.n)[0] === c)).map((c) => ({ value: c, label: accClassName(c) })));
  openList({ title: "Számlaosztály", selected: accClass, items, onPick: (v) => { accClass = v; $("acc-class-lbl").textContent = v ? accClassName(v) : "Összes osztály"; renderAccounts($("acc-search").value); } });
};
function accRowHtml(it) {
  const lvl = accLvl(it.n);
  let rails = ""; for (let i = 1; i < lvl; i++) rails += `<span class="acc-rail"></span>`; // one vertical guide per nesting level
  return `<div class="acc-row lvl${lvl}">${rails}<span class="acc-n">${esc(it.n)}</span><span class="acc-t">${esc(it.t)}</span></div>`;
}
function renderAccounts(q) {
  q = (q || "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  accFiltered = accItems;
  if (accClass) accFiltered = accFiltered.filter((it) => accDigits(it.n)[0] === accClass);
  if (q) accFiltered = accFiltered.filter((it) => (digits && it.n.indexOf(digits) === 0) || it.t.toLowerCase().indexOf(q) >= 0);
  const host = $("acc-list"); host.scrollTop = 0; accShown = 0;
  if (!accFiltered.length) { host.innerHTML = `<div class="hint center" style="margin:16px 0">Nincs találat.</div>`; return; }
  host.innerHTML = ""; appendAccounts();
}
function appendAccounts() {
  const host = $("acc-list"); if (!host) return;
  const next = accFiltered.slice(accShown, accShown + ACC_PAGE);
  if (!next.length) return;
  host.insertAdjacentHTML("beforeend", next.map(accRowHtml).join(""));
  accShown += next.length;
}
$("acc-list").addEventListener("scroll", (e) => {
  const el = e.target;
  if (accShown < accFiltered.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) appendAccounts();
});
$("acc-search").addEventListener("input", (e) => renderAccounts(e.target.value));

// ---------- local notifications (reminders) ----------
function LN() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; }
// Human lead label: "30 perc", "1 óra", "1 ó 30 p", "1 nap", "2 nap", "1 hét".
function fmtLead(min) {
  if (min % 10080 === 0) return (min / 10080) + " hét";
  if (min % 1440 === 0) return (min / 1440) + " nap";
  return fmtDur(min * 60000);
}
// Stable 31-bit integer id from occurrence key + lead (each reminder needs its own numeric id).
function notifId(e, lead) { const s = occKey(e) + "|" + lead; let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h) % 2000000000 || 1; }
async function ensureNotifPermission() {
  const ln = LN(); if (!ln) return false;
  try { let p = await ln.checkPermissions(); if (p.display !== "granted") p = await ln.requestPermissions(); return p.display === "granted"; }
  catch (e) { return false; }
}
// Cancel everything we scheduled, then re-schedule classes + ZH + exams per their enabled reminders.
async function rescheduleNotifications() {
  const ln = LN(); if (!ln || !isNative) return;
  try {
    const pend = await ln.getPending();
    if (pend && pend.notifications && pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
  } catch (e) { /* ignore */ }
  const cfg = state.notify || {}, now = Date.now(), horizon = now + 40 * 864e5, out = [];
  const add = (events, catCfg, title, kind) => {
    if (!catCfg || !catCfg.enabled || !catCfg.leads || !catCfg.leads.length) return;
    events.forEach((e) => catCfg.leads.forEach((lead) => {
      const at = e.S.getTime() - lead * 60000;
      if (at > now + 15000 && e.S.getTime() < horizon) out.push({
        id: notifId(e, lead), title,
        body: fmtLead(lead) + " múlva: " + (e.summary || "") + (e.location ? " · " + e.location : ""),
        schedule: { at: new Date(at), allowWhileIdle: true }, smallIcon: "ic_stat_neptun",
        // carried back on tap so the app can show a detailed alert
        extra: { kind, head: title, lead, summary: e.summary || "", location: e.location || "", s: e.S.toISOString(), e: e.E ? e.E.toISOString() : "" },
      });
    }));
  };
  add(visibleClassEvents(), cfg.classes, "Közelgő óra", "class");
  const exams = examEvents();
  add(exams.filter((e) => e.manual), cfg.zh, "Közelgő ZH", "zh");
  add(exams.filter((e) => !e.manual), cfg.vizsga, "Közelgő vizsga", "vizsga");
  if (!out.length) return;
  out.sort((a, b) => a.schedule.at - b.schedule.at);
  try { await ln.schedule({ notifications: out.slice(0, 64) }); } catch (e) { /* ignore */ }
}
// Highlighted in-app alert shown when a reminder push is tapped.
function showNotifAlert(x) {
  if (!x) return;
  const S = x.s ? new Date(x.s) : null, E = x.e ? new Date(x.e) : null;
  $("notif-head").textContent = x.head || "Emlékeztető";
  $("notif-subj").textContent = x.summary || "Esemény";
  $("notif-meta").innerHTML = S ? `${icon("clock")} ${esc(dayHeading(S))} · ${hm(S)}${E && E > S ? "–" + hm(E) : ""}` : "";
  const loc = $("notif-loc"); if (x.location) { loc.hidden = false; loc.innerHTML = `${icon("pin")} ${esc(x.location)}`; } else loc.hidden = true;
  const lead = $("notif-lead"); if (x.lead) { lead.hidden = false; lead.innerHTML = `${icon("clock")} Emlékeztető ${esc(fmtLead(x.lead))} korábban`; } else lead.hidden = true;
  $("notif-sheet").classList.remove("hidden");
}
$("notif-ok").onclick = () => $("notif-sheet").classList.add("hidden");
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
  syncNotifySettings();
  syncSemStatus();
  syncProgStatus();
}
function syncSemStatus() {
  const el = $("sems-status"); if (!el) return;
  const s = state.semesters;
  el.textContent = (s && s.list && s.list.length) ? (s.list.length + " félév · " + fmtWhen(s.fetchedAt)) : "Nincs beolvasva";
}
function syncProgStatus() {
  const el = $("prog-status"); if (!el) return;
  const p = state.progress;
  el.textContent = (p && p.total) ? (p.done + "/" + p.total + " kredit · " + fmtWhen(p.fetchedAt)) : "Nincs beolvasva";
}
$("btn-prog").onclick = grabProgress;
$("btn-sems").onclick = grabSemesters;
$("btn-sems-del").onclick = async () => {
  if (!state.semesters) { toast("Nincs elmentett félév adat."); return; }
  if (!(await ask({ title: "Félév adatok törlése", okText: "Törlés", body: "Törlöd a beolvasott félév listát? Bármikor újra beolvasható." }))) return;
  state.semesters = null; saveState(); syncSemStatus(); renderTimetable(); renderExams(); renderCourses();
  toast("Félév adatok törölve.");
};
// Per-category reminder settings (Órák / ZH / Vizsgák), each: on/off + up to 3 lead times.
const NOTIFY_CATS = [["classes", "Órák"], ["zh", "ZH"], ["vizsga", "Vizsgák"]];
const CLASS_LEADS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const EXAM_LEADS = [10, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080];
function syncNotifySettings() {
  const host = $("notify-cats"); if (!host) return;
  host.innerHTML = NOTIFY_CATS.map(([key, label]) => {
    const c = (state.notify && state.notify[key]) || { enabled: false, leads: [] };
    const chips = (c.leads || []).map((m) => `<button class="lead-chip" data-cat="${key}" data-lead="${m}">${esc(fmtLead(m))} <span class="lx">${icon("x")}</span></button>`).join("");
    const canAdd = (c.leads || []).length < 3;
    return `<div class="card notify-cat"><div class="card-pad">
      <button class="check" data-nt="${key}"><span class="box"><span data-icon="check"></span></span>
        <span><span class="c-t">${esc(label)}</span><span class="c-b">Emlékeztető ${esc(label.toLowerCase())} előtt.</span></span></button>
      <div class="lead-row">${chips || `<span class="hint" style="margin:0">Nincs emlékeztető.</span>`}
        ${canAdd ? `<button class="lead-add" data-addcat="${key}">${icon("plus")} Emlékeztető</button>` : ""}</div>
    </div></div>`;
  }).join("");
  renderIcons(host);
  host.querySelectorAll("[data-nt]").forEach((b) => b.onclick = () => toggleNotifyCat(b.dataset.nt));
  host.querySelectorAll(".lead-chip").forEach((b) => b.onclick = () => { removeLead(b.dataset.cat, +b.dataset.lead); });
  host.querySelectorAll("[data-addcat]").forEach((b) => b.onclick = () => addLead(b.dataset.addcat));
  NOTIFY_CATS.forEach(([key]) => { const el = host.querySelector(`[data-nt="${key}"]`); if (el) el.classList.toggle("on", !!(state.notify[key] && state.notify[key].enabled)); });
}
async function toggleNotifyCat(key) {
  const c = state.notify[key];
  if (!c.enabled) { if (isNative && !(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell a telefon beállításaiban."); return; } c.enabled = true; }
  else c.enabled = false;
  saveState(); syncNotifySettings(); rescheduleNotifications();
}
function removeLead(key, m) { const c = state.notify[key]; c.leads = (c.leads || []).filter((x) => x !== m); saveState(); syncNotifySettings(); rescheduleNotifications(); }
$("notify-test").onclick = async () => {
  const ln = LN();
  if (!isNative || !ln) { toast("A teszt értesítés a telefonos alkalmazásban működik."); return; }
  if (!(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell."); return; }
  const start = new Date(Date.now() + 60 * 60000); // pretend a class starts in 1h
  try {
    await ln.schedule({ notifications: [{
      id: 424242, title: "Teszt értesítés", body: "Így néz ki egy emlékeztető. Koppints rá!",
      schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, smallIcon: "ic_stat_neptun",
      extra: { kind: "class", head: "Teszt értesítés", lead: 60, summary: "Teszt óra – Példa tárgy", location: "A.fsz.A1", s: start.toISOString(), e: new Date(start.getTime() + 90 * 60000).toISOString() },
    }] });
    toast("Teszt értesítés 5 másodperc múlva. Tedd háttérbe az appot!");
  } catch (e) { toast("Hiba: " + (e && e.message ? e.message : e)); }
};
function addLead(key) {
  const c = state.notify[key];
  const opts = (key === "classes" ? CLASS_LEADS : EXAM_LEADS).filter((m) => (c.leads || []).indexOf(m) < 0);
  openList({ title: "Emlékeztető ennyivel előtte", items: opts.map((m) => ({ value: String(m), label: fmtLead(m) })),
    onPick: (v) => { const m = parseInt(v, 10); if (!m) return; c.leads = (c.leads || []).concat(m).sort((a, b) => a - b).slice(0, 3); saveState(); syncNotifySettings(); rescheduleNotifications(); } });
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
async function updateUpdateStatus() {
  const el = $("update-status"), title = $("update-title");
  if (el) el.textContent = "Verzió " + APP_VERSION; // immediate, before the network check
  if (title) title.textContent = "Frissítés keresése";
  if (!isNative || !window.OTA || !window.OTA.peek) return;
  const res = await window.OTA.peek(APP_VERSION); // manifest only, no download
  if (!res || !res.ok) return; // offline / not configured → leave defaults
  if (res.available) {
    if (title) title.textContent = "Frissítés letöltése";
    if (el) el.textContent = "Verzió " + APP_VERSION + " · Új: " + res.version;
  } else {
    if (title) title.textContent = "Frissítés keresése";
    if (el) el.textContent = "Verzió " + APP_VERSION + " · Naprakész";
  }
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
  const rm = $("btn-remove-totp"); if (rm) rm.onclick = async () => {
    if (!(await requireAuthFor("actions"))) return; // guard (respects the Biztonság switch)
    if (!(await ask({ title: "2FA törlése", okText: "Törlés", body: "Biztosan törlöd a mentett 2FA kulcsot? A belépéshez újra be kell majd olvasnod." }))) return;
    state.totp = null; saveState(); renderTotpStatus(); renderHome(); toast("2FA törölve.");
  };
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

// ----- data export / import (encrypted backup & restore) -----
function FSP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }
const BACKUP_DIR = "neptunplus", BK_KEY_LS = "neptun-plus-bkkey";
function currentStateJson() { try { return localStorage.getItem(STORE_KEY) || JSON.stringify(state); } catch (e) { return JSON.stringify(state); } }
function backupTs() { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()); }
// AES-GCM key kept in its own localStorage entry (survives "Minden adat törlése", which only clears STORE_KEY).
const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// v0.067 device-key (kept only to still decrypt old .npb files).
async function backupKey() {
  let raw = null; try { raw = localStorage.getItem(BK_KEY_LS); } catch (e) {}
  if (!raw) throw new Error("nincs kulcs");
  return crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
// Passphrase (the Neptun password) → AES-GCM key via PBKDF2.
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password || ""), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptBackup(json) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(state.password || "", salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(json));
  return JSON.stringify({ app: "neptun-plus", enc: "pbkdf2-aes-gcm", v: 2, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}
async function decryptBackup(text) {
  let env; try { env = JSON.parse(text); } catch (e) { throw new Error("Sérült fájl"); }
  if (env && env.enc === "pbkdf2-aes-gcm" && env.ct) { // password-encrypted (Neptun password)
    const attempt = async (pw) => { try { const k = await deriveKey(pw, unb64(env.salt)); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, k, unb64(env.ct)); return JSON.parse(new TextDecoder().decode(pt)); } catch (e) { return null; } };
    if (state.password) { const d = await attempt(state.password); if (d) return d; }
    for (let i = 0; i < 3; i++) {
      const pw = await askPassword({ title: "Mentés jelszava", body: "Add meg a Neptun jelszavad a mentés visszafejtéséhez." });
      if (pw === null) throw new Error("Megszakítva");
      const d = await attempt(pw); if (d) return d;
      toast("Hibás jelszó.");
    }
    throw new Error("Nem sikerült visszafejteni");
  }
  if (env && env.enc === "aes-gcm" && env.ct) { // old device-key backup (back-compat)
    try { const key = await backupKey(); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
    catch (e) { throw new Error("Nem sikerült visszafejteni (régi mentés, más eszköz?)"); }
  }
  if (env && typeof env === "object" && !Array.isArray(env)) return env; // legacy plaintext backup
  throw new Error("Érvénytelen mentés");
}
function askPassword({ title, body, okText = "OK" }) {
  return new Promise((res) => {
    $("pw-title").textContent = title; $("pw-body").textContent = body || ""; $("pw-ok").textContent = okText; $("pw-input").value = "";
    $("pw-dialog").classList.remove("hidden");
    setTimeout(() => { try { $("pw-input").focus(); } catch (e) {} }, 60);
    const done = (v) => { $("pw-dialog").classList.add("hidden"); $("pw-ok").onclick = null; $("pw-cancel").onclick = null; $("pw-input").onkeydown = null; res(v); };
    $("pw-ok").onclick = () => done($("pw-input").value);
    $("pw-cancel").onclick = () => done(null);
    $("pw-input").onkeydown = (e) => { if (e.key === "Enter") done($("pw-input").value); };
  });
}
function applyImported(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) { toast("Érvénytelen mentés."); return false; }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { toast("Nem sikerült menteni."); return false; }
  location.reload(); return true;
}
async function confirmAndApply(data, name) {
  if (!(await requireAuthFor("actions"))) return;
  if (!(await ask({ title: "Adatok importálása", okText: "Felülírás", cancelText: "Mégse", body: "Visszatöltöd ezt a mentést? Minden jelenlegi adat felülíródik, és az app újraindul." + (name ? "<br><span class='mono'>" + esc(name) + "</span>" : "") }))) return;
  applyImported(data);
}
$("btn-export").onclick = async () => {
 try {
  if (!state.password) { toast("Előbb állítsd be a Neptun jelszót (azzal titkosítunk)."); return; }
  if (!(window.crypto && crypto.subtle)) { toast("A titkosítás nem elérhető ezen az eszközön."); return; }
  if (!(await requireAuthFor("sensitive"))) return; // backup contains the password + 2FA secret
  const enc = await encryptBackup(currentStateJson()), fs = FSP();
  if (fs) {
    const name = "neptun-plus-mentes-" + backupTs() + ".npb";
    await fs.writeFile({ path: BACKUP_DIR + "/" + name, data: enc, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    await ask({ title: "Mentés elkészült", okText: "OK", cancelText: "Bezárás", body: "Titkosított mentés ide:<br><span class='mono'>Dokumentumok/" + esc(BACKUP_DIR) + "/" + esc(name) + "</span><br><br>A <b>Neptun jelszavaddal</b> fejthető vissza." });
    return;
  }
  // fallback (preview / no plugin): show encrypted text + clipboard
  $("backup-title").textContent = "Adatok exportálása";
  $("backup-hint").innerHTML = "Titkosított mentés. Másold ki és mentsd el.";
  $("backup-text").value = enc; $("backup-text").readOnly = true;
  $("backup-copy").hidden = false; $("backup-import-ok").hidden = true;
  $("backup-sheet").classList.remove("hidden");
  try { await navigator.clipboard.writeText(enc); toast("Vágólapra másolva."); } catch (e) {}
 } catch (e) { toast("Export hiba: " + (e && e.message ? e.message : e)); }
};
$("btn-import").onclick = async () => {
  const fs = FSP(); let files = [];
  if (fs) { try { const r = await fs.readdir({ path: BACKUP_DIR, directory: "DOCUMENTS" }); files = (r.files || []).map((f) => f && f.name ? f.name : f).filter((n) => typeof n === "string" && /\.(npb|json)$/i.test(n)); } catch (e) {} files.sort().reverse(); }
  const items = files.map((n) => ({ value: "f:" + n, label: n })).concat([{ value: "browse", label: "Tallózás… (fájl kiválasztása)" }]);
  openList({ title: "Mentés visszatöltése", items, onPick: (v) => { if (v === "browse") $("import-file").click(); else importFromFile(v.slice(2)); } });
};
async function importFromFile(name) {
  const fs = FSP(); if (!fs) return;
  let text; try { const rf = await fs.readFile({ path: BACKUP_DIR + "/" + name, directory: "DOCUMENTS", encoding: "utf8" }); text = rf.data; } catch (e) { return toast("Nem sikerült beolvasni."); }
  let data; try { data = await decryptBackup(text); } catch (e) { return toast(e.message || "Hibás mentés."); }
  confirmAndApply(data, name);
}
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
  const r = new FileReader();
  r.onload = async () => { let data; try { data = await decryptBackup(String(r.result)); } catch (err) { return toast(err.message || "Hibás mentés."); } confirmAndApply(data, file.name); };
  r.onerror = () => toast("Nem sikerült beolvasni a fájlt.");
  r.readAsText(file);
});
$("backup-close").onclick = () => $("backup-sheet").classList.add("hidden");
$("backup-copy").onclick = async () => { try { await navigator.clipboard.writeText($("backup-text").value); toast("Vágólapra másolva."); } catch (e) { $("backup-text").select(); toast("Jelöld ki és másold."); } };
$("backup-import-ok").onclick = async () => {
  const raw = $("backup-text").value.trim(); if (!raw) return toast("Illeszd be a mentést.");
  let data; try { data = await decryptBackup(raw); } catch (e) { return toast(e.message || "Hibás mentés."); }
  confirmAndApply(data);
};
// Once a day, on first open, write an encrypted auto-backup; keep max 5 (delete the oldest).
async function dailyBackup() {
  const fs = FSP(); if (!isNative || !fs || !state.password) return;
  const d = new Date(), key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  if (state.lastBackup === key) return;
  try {
    const enc = await encryptBackup(currentStateJson());
    await fs.writeFile({ path: BACKUP_DIR + "/auto-" + backupTs() + ".npb", data: enc, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    try { const r = await fs.readdir({ path: BACKUP_DIR, directory: "DOCUMENTS" }); let autos = (r.files || []).map((f) => f && f.name ? f.name : f).filter((n) => typeof n === "string" && /^auto-.*\.npb$/i.test(n)).sort(); while (autos.length > 5) { const oldest = autos.shift(); await fs.deleteFile({ path: BACKUP_DIR + "/" + oldest, directory: "DOCUMENTS" }); } } catch (e) {}
    state.lastBackup = key; saveState();
  } catch (e) { /* silent */ }
}
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
  else { isLocked = false; $("lock").classList.add("hidden"); setTimeout(maybeOfferSemesters, 500); } // offer after cold-start unlock
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
  if (isNative) {
    const ln = LN();
    if (ln && ln.addListener) { try { ln.addListener("localNotificationActionPerformed", (ev) => { const x = ev && ev.notification && ev.notification.extra; if (x) showNotifAlert(x); }); } catch (e) {} }
    rescheduleNotifications(); // refresh reminders on every launch
    setTimeout(maybeOfferSemesters, 1600); // offer semester read if none saved (once unlocked/settled)
    if (state.setupComplete) setTimeout(dailyBackup, 2500); // one encrypted auto-backup per day
  }
  // Keep the loader visible long enough to read (min ~700ms), then reveal the app/login.
  setTimeout(hideBoot, Math.max(0, 700 - (Date.now() - bootTs)));
})();
