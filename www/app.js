import { generateTOTP } from "./lib/totp.js";
import { parseMigrationUri } from "./lib/gauth.js";
import { UNIVERSITIES } from "./data/universities.js";
import { parseICS } from "./lib/ical.js";

const STORE_KEY = "neptun-plus";
const APP_VERSION = "v0.202";
const $ = (id) => document.getElementById(id);

// ---------- icons (line SVG, no emoji) ----------
const P = {
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3m-3 3 2 2m-4 0 2 2"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
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
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.2l1.5 2.6a7.8 7.8 0 0 1 1.9.8l3-.5 1.6 2.8-2 2.2c.1.7.1 1.4 0 2.1l2 2.2-1.6 2.8-3-.5a7.8 7.8 0 0 1-1.9.8L12 21.8l-1.5-2.6a7.8 7.8 0 0 1-1.9-.8l-3 .5-1.6-2.8 2-2.2a7.9 7.9 0 0 1 0-2.1l-2-2.2 1.6-2.8 3 .5a7.8 7.8 0 0 1 1.9-.8z"/>',
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
  up: '<path d="m6 15 6-6 6 6"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17z"/><path d="m13.5 6.5 3 3"/>',
  grip: '<circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
  note: '<path d="M5 4h14v13l-4 4H5z"/><path d="M15 21v-4h4M9 9h6M9 13h4"/>',
  book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z"/><path d="M5 4v16M18 20a2 2 0 0 1 2 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-6M12.5 20V9M17 20v-9"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h1.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>',
  clip: '<path d="M21 11.5 12 20.5a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8"/>',
};
function icon(name) { return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`; }
function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute("data-icon"); });
}

// ---------- state ----------
// Per-profile fields: everything tied to ONE Neptun identity (one university's login + its data).
// These live at the top level of `state` for the ACTIVE profile (so all existing code keeps working),
// and are mirrored into state.profiles[] on save; switching a profile swaps them in/out.
const PROFILE_FIELDS = ["university", "servers", "activeServerId", "username", "password", "no2fa", "totp", "icsUrl", "courses", "curriculum", "ics", "manualExams", "notes", "hiddenOcc", "semesters", "progress", "neptunCode", "finance", "messages", "grades", "periods"];
function defaultState() {
  return {
    setupComplete: false,
    legalAccepted: false,
    profiles: [], // [{ id, ...PROFILE_FIELDS }] — one per Neptun identity (university). Mirror of the active one lives at top level.
    activeProfileId: null,
    university: "",
    servers: UNIVERSITIES[0].servers.map((s, i) => ({ id: "u" + i, label: s.label, url: s.url })),
    activeServerId: "u0",
    username: "", password: "",
    neptunCode: "", // immutable Neptun code (read-only); the login name (username) can differ / be custom
    finance: null, // { fetchedAt, accounts, toPay, impositions, transactions, invoices, scholarships } — see FRONTEND-penzugyek.md
    no2fa: false,
    totp: null,
    pinHash: null,
    biometric: false,
    icsUrl: "",
    courses: null, // { fetchedAt: ISO, list: [{ code, name, credits, completed, semester, teacher, type }] }
    curriculum: null, // { fetchedAt, program, required:[{code,name,credits,completed,type}], free:[...] } from Előrehaladás → Hierarchikus mintatanterv
    ics: null, // { fetchedAt: ISO, events: [{ s, e, allDay, summary, location, categories, description }] }
    manualExams: [], // [{ id, subject, title, start, end, location, note }]
    notes: [], // [{ id, kind:'subject'|'occurrence', subject, occKey, text }]
    hiddenOcc: [], // occKeys of class occurrences the user chose to hide (conflict resolution)
    dlc: {}, // downloaded add-ons keyed by id: { version, title, kind, items }
    semesters: null, // { fetchedAt, list:["2025/26/2", ...] } read from Neptun (Felvett tárgyak → Szűrő)
    progress: null, // { fetchedAt, done, total, free } from Neptun (Tanulmányok → Előrehaladás)
    lastBackup: null, // day-number (Math.floor(Date.now()/86400000)) of the last auto-backup
    backupEvery: 1, // auto-backup frequency in days (0 = off)
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
  return ensureProfiles(defaultState());
}
// Guarantee at least one profile exists and activeProfileId points to a real one.
function ensureProfiles(s) {
  if (!Array.isArray(s.profiles) || !s.profiles.length) {
    const p = { id: uid() }; PROFILE_FIELDS.forEach((k) => p[k] = s[k]);
    s.profiles = [p]; s.activeProfileId = p.id;
  } else if (!s.activeProfileId || !s.profiles.some((p) => p.id === s.activeProfileId)) {
    s.activeProfileId = s.profiles[0].id;
  }
  return s;
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
  // Multi-profile migration: wrap the existing single identity as profile #1.
  ensureProfiles(s);
  // Keep catalog universities' server URLs in sync with the app's list (so fixes to
  // universities.js reach existing profiles). Custom/unknown universities are left alone.
  syncProfileServersToCatalog(s);
  const ap = s.profiles.find((p) => p.id === s.activeProfileId);
  if (ap) PROFILE_FIELDS.forEach((k) => { s[k] = ap[k]; }); // top level mirrors the active profile
  return s;
}
function syncProfileServersToCatalog(s) {
  (s.profiles || []).forEach((p) => {
    if (!p.university) return;
    const uni = UNIVERSITIES.find((u) => u.name === p.university);
    if (!uni) return; // custom / not in catalog → leave the user's URLs
    const want = uni.servers.map((sv, i) => ({ id: "u" + i, label: sv.label, url: sv.url }));
    const same = JSON.stringify((p.servers || []).map((x) => x.url)) === JSON.stringify(want.map((x) => x.url));
    if (!same) { p.servers = want; if (!want.some((x) => x.id === p.activeServerId)) p.activeServerId = "u0"; }
  });
}
function activeProfile() { return (state.profiles || []).find((p) => p.id === state.activeProfileId) || null; }
function syncActiveToProfiles() { const p = activeProfile(); if (p) PROFILE_FIELDS.forEach((k) => { p[k] = state[k]; }); }
function loadProfileToTop(p) { PROFILE_FIELDS.forEach((k) => { state[k] = p[k]; }); }
function profileLabel(p) { return (p && (p.university || (p.username ? "Neptun" : ""))) || "Új profil"; }
function saveState() { try { syncActiveToProfiles(); localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
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
async function bioVerify() { const NB = bioPlugin(); await NB.verifyIdentity({ reason: "Kredit+ feloldása", title: "Kredit+", subtitle: "", description: "Igazold a személyazonosságod" }); return true; }

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
    $("ask-ok").disabled = false;
    $("ask-dialog").classList.remove("hidden");
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").onclick = null; $("ask-cancel").onclick = null; res(v); };
    $("ask-ok").onclick = () => done(true); $("ask-cancel").onclick = () => done(false);
  });
}
// Like ask(), but the OK button unlocks only once the user types the confirmation word (e.g. IGEN).
// Used for irreversible actions (accepting/rejecting an offered grade).
function askTyped({ title, body, word = "IGEN", okText = "Megerősítés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<div class="field" style="margin-top:14px"><input class="input" id="ask-typed" placeholder="Írd be: ${esc(word)}" autocomplete="off" autocapitalize="characters" autocorrect="off" /></div>`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    const ok = $("ask-ok"), inp = $("ask-typed");
    ok.disabled = true;
    $("ask-dialog").classList.remove("hidden");
    const check = () => { ok.disabled = inp.value.trim().toLowerCase() !== String(word).toLowerCase(); };
    inp.oninput = check; setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); ok.onclick = null; $("ask-cancel").onclick = null; inp.oninput = null; ok.disabled = false; res(v); };
    ok.onclick = () => { if (!ok.disabled) done(true); }; $("ask-cancel").onclick = () => done(false);
  });
}
// Confirm dialog that requires typing a specific word (e.g. "törlés") before the action button enables.
function askConfirmText({ title, body, mustType, okText = "Törlés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<input class="input" id="ask-confirm-input" placeholder="${esc(mustType)}" autocomplete="off" autocapitalize="none" style="margin-top:12px" />`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    $("ask-dialog").classList.remove("hidden");
    const inp = $("ask-confirm-input");
    const ok = () => (inp.value || "").trim().toLowerCase() === String(mustType).toLowerCase();
    const refresh = () => { $("ask-ok").disabled = !ok(); };
    inp.oninput = refresh; refresh(); setTimeout(() => inp.focus(), 60);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").onclick = null; $("ask-cancel").onclick = null; inp.oninput = null; $("ask-ok").disabled = false; res(v); };
    $("ask-ok").onclick = () => { if (ok()) done(true); };
    $("ask-cancel").onclick = () => done(false);
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
    if (obSel === "custom") return !!$("ob-custom-url").value.trim();
    return !!obSel;
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
  });
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
    setTimeout(maybeOfferDataSync, 700);
    return;
  }
  state.setupComplete = true; saveState();
  enterApp(); showTab("tab-home");
  toast("Beállítás kész, kezdheted.");
  setTimeout(maybeOfferDataSync, 700); // right after setup, offer to read the missing data
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
  $("ob-custom-url").addEventListener("input", updateObFooter);
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

// ---------- profiles (multiple Neptun identities, one per university) ----------
function resetProfileCaches() { apiSession = null; lastCode = ""; coFilter = null; exSubjSem = null; ttFilter = "upcoming"; exFilter = "upcoming"; coSeg = "aktualis"; semLoading = false; dataSyncOffered = false; }
function switchProfile(id) {
  if (id === state.activeProfileId) return;
  const target = (state.profiles || []).find((p) => p.id === id); if (!target) return;
  syncActiveToProfiles();
  state.activeProfileId = id; loadProfileToTop(target);
  resetProfileCaches(); saveState();
  updateIcsStatus(); renderHome(); renderTimetable(); renderExams(); renderCourses();
  totpTick(); rescheduleNotifications();
  toast("Profil: " + profileLabel(target));
  warmSession("profile"); // pre-authenticate the new identity so login/reads are instant
}
function startAddProfile() {
  syncActiveToProfiles();
  const p = { id: uid() }; PROFILE_FIELDS.forEach((k) => p[k] = defaultState()[k]);
  state.profiles.push(p); state.activeProfileId = p.id; loadProfileToTop(p);
  resetProfileCaches();
  // Clear onboarding inputs for the fresh identity.
  ["ob-username", "ob-password", "ob-uni-search", "ob-secret", "ob-custom-label", "ob-custom-url"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
  obSel = null; ob2faChoice = null;
  obMode = "add"; obSeq = [1, 2, 5]; obPos = 0; obStep = obSeq[0]; // university → credentials → 2FA (legal/PIN/biometrics are global)
  showOnboardingScreen(); renderOb();
}
function cancelAddProfile() {
  const cur = state.activeProfileId;
  state.profiles = state.profiles.filter((p) => p.id !== cur);
  const back = state.profiles[state.profiles.length - 1];
  state.activeProfileId = back ? back.id : null;
  if (back) loadProfileToTop(back);
  obMode = ""; obSeq = [0, 1, 2, 3, 4, 5, 6]; obPos = 0; obStep = 0;
  resetProfileCaches(); saveState();
  enterApp(); showTab("tab-home"); renderHome();
}
// Full-screen profile page (replaces the old bottom-sheet picker): switch, add, delete.
function openProfilePicker() { pushScreen("tab-profile"); }
function renderProfilePage() {
  const host = $("profile-scroll"); if (!host) return;
  const profiles = state.profiles || [];
  const multi = profiles.length > 1;
  const rows = profiles.map((p) => {
    const active = p.id === state.activeProfileId;
    const label = profileLabel(p);
    const init = (label.trim()[0] || "K").toUpperCase();
    const right = active
      ? `<span class="row-chev pf-check">${icon("check")}</span>`
      : (multi ? `<span class="pf-del" data-del="${p.id}" title="Törlés">${icon("trash")}</span>` : `<span class="row-chev">${icon("chev")}</span>`);
    return `<button class="row" data-pf="${p.id}" type="button">`
      + `<span class="row-ic pf-badge">${esc(init)}</span>`
      + `<span class="row-main"><span class="row-title">${esc(label)}</span><span class="row-sub">${esc(p.username || "Nincs azonosító")}</span></span>`
      + right + `</button>`;
  }).join("");
  host.innerHTML = `<div class="section-label">Profilok</div><div class="card">${rows}</div>`
    + `<div class="card" style="margin-top:14px"><button class="row" id="pf-add" type="button">`
    + `<span class="row-ic">${icon("plus")}</span>`
    + `<span class="row-main"><span class="row-title">Új profil hozzáadása</span><span class="row-sub">Másik egyetem vagy Neptun azonosító</span></span>`
    + `<span class="row-chev">${icon("chev")}</span></button></div>`;
  host.querySelectorAll("[data-pf]").forEach((b) => b.onclick = () => {
    const id = b.dataset.pf;
    if (id !== state.activeProfileId) switchProfile(id);
    popScreen();
  });
  host.querySelectorAll("[data-del]").forEach((el) => el.onclick = async (e) => {
    e.stopPropagation();
    await deleteProfile(el.dataset.del);
    renderProfilePage();
  });
  const add = $("pf-add"); if (add) add.onclick = startAddProfile;
}
async function deleteProfile(id) {
  if ((state.profiles || []).length <= 1) { toast("Az utolsó profilt nem lehet törölni."); return; }
  const p = (state.profiles || []).find((x) => x.id === id); if (!p) return;
  if (!(await requireAuth())) return; // PIN / biometrics (skipped if no app-lock set)
  const ok = await askConfirmText({
    title: "Profil törlése",
    body: `Biztosan törlöd ezt a profilt?<br><b>${esc(profileLabel(p))}</b>${p.username ? " · " + esc(p.username) : ""}<br><br>Minden hozzá tartozó adat (tárgyak, órarend, kredit, félévek…) törlődik erről az eszközről. A többi profilod megmarad.<br><br>A megerősítéshez írd be: <b>törlés</b>`,
    mustType: "törlés", okText: "Törlés",
  });
  if (!ok) return;
  const wasActive = id === state.activeProfileId;
  state.profiles = state.profiles.filter((x) => x.id !== id);
  if (wasActive) { const nx = state.profiles[0]; state.activeProfileId = nx.id; loadProfileToTop(nx); resetProfileCaches(); }
  saveState();
  renderHome();
  if (wasActive) { updateIcsStatus(); renderTimetable(); renderExams(); renderCourses(); totpTick(); rescheduleNotifications(); }
  toast("Profil törölve.");
}
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

// tap on the dimmed area (outside the sheet) closes any open dialog
document.querySelectorAll(".backdrop").forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.add("hidden"); }));

// full-screen busy spinner (for invisible background reads)
let flowCancel = null; // set while a runNeptunFlow is active; lets the busy "Mégse" abort it
function showBusy(text, cancelable) { $("busy-text").textContent = text || "Beolvasás…"; $("busy-cancel").hidden = !cancelable; $("busy").classList.remove("hidden"); }
function hideBusy() { $("busy").classList.add("hidden"); $("busy-cancel").hidden = true; $("busy-bar").hidden = true; $("busy-step").hidden = true; }
// Overall progress across a multi-step read (shown beside the spinner).
function setBusyProgress(done, total, stepLabel) {
  const bar = $("busy-bar"), fill = $("busy-fill"), step = $("busy-step");
  if (total > 0) { bar.hidden = false; fill.style.width = Math.round((done / total) * 100) + "%"; }
  if (stepLabel) { step.hidden = false; step.textContent = stepLabel; } else step.hidden = true;
}
$("busy-cancel").onclick = () => { if (flowCancel) flowCancel(); };

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
  $("home-sub").textContent = autoRefreshing ? "Adatok frissítése…" : semLoading ? "Félévek beolvasása…" : warming ? "Munkamenet előkészítése…" : warm ? "Aktív munkamenet" : (ready ? "Készen áll" : "Állítsd be a belépést");
  $("login-hint").textContent = !isNative ? "Előnézet. Az alkalmazásban ez automatikusan belép."
    : warm ? "Aktív munkamenet, a belépés azonnali." : "Egy érintés, a többit az alkalmazás elvégzi.";
  $("server-chip").style.display = state.servers.length > 1 ? "" : "none";
  const hp = $("home-profile");
  if (hp) { hp.onclick = openProfilePicker; hp.classList.toggle("has-multi", (state.profiles || []).length > 1); }
  renderHub();
}
// ---- Customizable Kezdőlap hub: a registry of widgets + a saved, ordered list of the enabled ones ----
function hubCard(cls) { const b = document.createElement("button"); b.type = "button"; b.className = "card " + (cls || ""); return b; }
function openTab(tab) { if (typeof MAIN_TABS !== "undefined" && MAIN_TABS.includes(tab)) navTo(tab); else pushScreen(tab); }
const HUB_WIDGETS = [
  { id: "current-class", label: "Jelenlegi óra", desc: "A most zajló órád, amíg tart.", render(host) { const e = currentClass(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Jelenlegi óra", "tab-timetable", true); } },
  { id: "next-class", label: "Következő óra", desc: "A soron következő órád ideje és terme.", render(host) { const e = nextClass(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Következő óra", "tab-timetable"); } },
  { id: "next-exam", label: "Következő számonkérés", desc: "A legközelebbi ZH vagy vizsga.", render(host) { const e = nextAssessment(); if (!e) return; const el = hubCard("next-card"); host.appendChild(el); nextIsland(el, e, "Következő számonkérés", "tab-exams"); } },
  { id: "credit", label: "Kreditek", desc: "Teljesített kreditek aránya és mérősávja.", render(host) { const p = state.progress; if (!p || !p.total) return; const pct = Math.round(p.done / p.total * 100); const el = hubCard("cred clickable"); el.onclick = () => pushScreen("tab-credit"); el.innerHTML = `<div class="cred-row"><div><div class="cred-big">${p.done} / ${p.total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${pct}%</div></div><div class="cred-bar"><div class="cred-fill" style="width:${pct}%"></div></div>`; host.appendChild(el); } },
  { id: "messages", label: "Olvasatlan üzenetek", desc: "Hány olvasatlan Neptun üzeneted van.", render(host) { const m = state.messages; if (!m || !m.fetchedAt) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-messages"); el.innerHTML = `<span class="hs-ic">${icon("mail")}</span><span class="hs-main"><span class="hs-val">${m.unread || 0}</span><span class="hs-lbl">olvasatlan üzenet</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "balance", label: "Egyenleg", desc: "A gyűjtőszámlád aktuális egyenlege.", render(host) { const f = state.finance; const a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); if (!a || a.balance == null) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-finance"); el.innerHTML = `<span class="hs-ic">${icon("wallet")}</span><span class="hs-main"><span class="hs-val">${a.balance.toLocaleString("hu")} Ft</span><span class="hs-lbl">gyűjtőszámla egyenleg</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "grades", label: "Átlag / kreditindex", desc: "A korrigált kreditindexed egy pillantásra.", render(host) { const gr = state.grades; const i = gr && gr.averages && gr.averages.indices; if (!i || i.korrigalt == null) return; const el = hubCard("hub-stat"); el.onclick = () => pushScreen("tab-grades"); el.innerHTML = `<span class="hs-ic">${icon("note")}</span><span class="hs-main"><span class="hs-val">${esc(String(i.korrigalt))}</span><span class="hs-lbl">korrigált kreditindex${i.termName ? " · " + esc(i.termName) : ""}</span></span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } },
  { id: "sync", label: "Adatok állapota", desc: "Jelzi, ha adat hiányzik, és egy gombbal frissít.", render(host) { if (!canAutoLogin()) return; const missing = DATA_TASKS.filter((t) => !t.has()); const el = hubCard("next-card"); if (missing.length) { el.classList.add("sync-cta"); el.innerHTML = `<div class="nc-head">${icon("down")} Szükséges adatok beolvasása</div><div class="nc-title" style="margin-top:8px">Hiányzik: ${esc(missing.map((t) => t.label).join(", "))}</div><div class="nc-meta">Beolvasás egyben a Neptunból.</div>`; el.onclick = () => openDataSync(missing.map((t) => t.id)); } else { el.innerHTML = `<div class="nc-head">${icon("refresh")} Adatok frissítése</div><div class="nc-title" style="margin-top:8px">Órarend, félévek, kredit, tárgyak</div><div class="nc-meta">Válaszd ki, mit olvassak be újra.</div>`; el.onclick = () => openDataSync(null); } host.appendChild(el); } },
];
[["courses", "Tárgyak", "book", "tab-courses"], ["timetable", "Órarend", "calendar", "tab-timetable"], ["credit", "Kredit", "chart", "tab-credit"], ["messages", "Üzenetek", "mail", "tab-messages"], ["finance", "Pénzügyek", "wallet", "tab-finance"]]
  .forEach(([id, label, ic, tab]) => HUB_WIDGETS.push({ id: "sc-" + id, label: label + " gomb", desc: "Gyors ugrás a " + label + " oldalra.", render(host) { const el = hubCard("hub-shortcut"); el.onclick = () => openTab(tab); el.innerHTML = `<span class="row-ic">${icon(ic)}</span><span class="row-title">${esc(label)}</span><span class="row-chev">${icon("chev")}</span>`; host.appendChild(el); } }));
const DEFAULT_HUB = ["current-class", "next-class", "next-exam", "sync"];
function hubLayout() { const l = Array.isArray(state.hubLayout) ? state.hubLayout : DEFAULT_HUB; return l.filter((id) => HUB_WIDGETS.some((w) => w.id === id)); }
function renderHub() {
  const host = $("hub-widgets"); if (!host) return;
  host.innerHTML = "";
  hubLayout().forEach((id) => { const w = HUB_WIDGETS.find((x) => x.id === id); try { if (w) w.render(host); } catch (e) {} });
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
// =====================================================================
//  MORE (services grid) — scales to the features coming later
// =====================================================================
// Grouped so the hub is scannable (no flat wall of tiles). Global "Adatok frissítése" lives ONLY here
// (in Eszközök) + the per-screen refresh icon — the Kezdőlap stays a clean, glanceable dashboard.
const MORE_SERVICES = [
  { id: "courses", group: "Tanulmányok", label: "Tárgyak", sub: "Felvett és mintatanterv", icon: "book", go: () => pushScreen("tab-courses") },
  { id: "credit", group: "Tanulmányok", label: "Kredit", sub: () => { const p = state.progress; return (p && p.total) ? `${p.done} / ${p.total} kredit · ${Math.round(p.done / p.total * 100)}%` : "Előrehaladás"; }, icon: "chart", go: () => pushScreen("tab-credit") },
  { id: "grades", group: "Tanulmányok", label: "Jegyek", sub: () => { const gr = state.grades; const i = gr && gr.averages && gr.averages.indices; return i && i.korrigalt != null ? "Kreditindex " + i.korrigalt : "Jegyek és átlagok"; }, icon: "note", go: () => pushScreen("tab-grades") },
  { id: "finance", group: "Szolgáltatások", label: "Pénzügyek", sub: () => { const f = state.finance, a = f && f.accounts && (f.accounts.find((x) => x.currency === "HUF") || f.accounts[0]); return a && a.balance != null ? a.balance.toLocaleString("hu") + " Ft" : "Egyenleg és tételek"; }, icon: "wallet", go: () => pushScreen("tab-finance") },
  { id: "messages", group: "Szolgáltatások", label: "Üzenetek", sub: () => { const m = state.messages; return m && m.unread ? m.unread + " olvasatlan" : (m && m.fetchedAt ? "Beérkezett és elküldött" : "Neptun üzenetek"); }, icon: "mail", go: () => pushScreen("tab-messages") },
  { id: "periods", group: "Tanulmányok", label: "Időszakok", sub: () => { const p = state.periods; const a = p && activePeriods(p.items).length; return a ? a + " aktív időszak" : "Mikor mettől meddig"; }, icon: "clock", go: () => pushScreen("tab-periods") },
  { id: "dlc", group: "Eszközök", label: "Kiegészítők", sub: "Szak letöltések", icon: "down", go: () => openDlc() },
  { id: "sync", group: "Eszközök", label: "Adatok frissítése", sub: "Beolvasás a Neptunból", icon: "refresh", go: () => openDataSync(null) },
  { id: "reg-course", group: "Ügyintézés", label: "Tárgyfelvétel", sub: "Automatikus felvétel", icon: "plus", soon: true },
  { id: "reg-exam", group: "Ügyintézés", label: "Vizsgajelentkezés", sub: "Automatikus jelentkezés", icon: "clipboard", soon: true },
];
// Több is now a two-level hub: category rows → a category page with that group's tiles.
const MORE_GROUPS = ["Tanulmányok", "Szolgáltatások", "Eszközök", "Ügyintézés"];
const MORE_GROUP_ICON = { "Tanulmányok": "book", "Szolgáltatások": "grid", "Eszközök": "refresh", "Ügyintézés": "clipboard" };
let moreCat = null;
function svcTile(s) {
  return `<button class="svc${s.soon ? " soon" : ""}" data-svc="${s.id}"${s.soon ? " disabled" : ""} type="button">`
    + `<span class="svc-ic">${icon(s.icon)}</span>`
    + `<span class="svc-t">${esc(s.label)}</span>`
    + `<span class="svc-b">${esc(typeof s.sub === "function" ? s.sub() : s.sub)}</span>`
    + (s.soon ? `<span class="svc-badge">Hamarosan</span>` : "") + `</button>`;
}
function wireSvc(host) { host.querySelectorAll("[data-svc]").forEach((b) => { const s = MORE_SERVICES.find((x) => x.id === b.dataset.svc); if (s && s.go) b.onclick = s.go; }); }
function renderMore() {
  const host = $("more-scroll"); if (!host) return;
  const rows = MORE_GROUPS.map((g) => {
    const items = MORE_SERVICES.filter((s) => s.group === g); if (!items.length) return "";
    return `<button class="row" data-cat="${esc(g)}" type="button">`
      + `<span class="row-ic">${icon(MORE_GROUP_ICON[g] || "grid")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(g)}</span><span class="row-sub">${esc(items.map((s) => s.label).join(" · "))}</span></span>`
      + `<span class="row-chev">${icon("chev")}</span></button>`;
  }).join("");
  host.innerHTML = `<div class="card">${rows}</div>`;
  host.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { moreCat = b.dataset.cat; pushScreen("tab-more-cat"); });
}
// Full-screen category page: the tiles of the chosen Több category.
function renderMoreCat() {
  const host = $("more-cat-scroll"); if (!host) return;
  const g = MORE_GROUPS.indexOf(moreCat) >= 0 ? moreCat : MORE_GROUPS[0];
  const t = $("more-cat-title"); if (t) t.textContent = g;
  const items = MORE_SERVICES.filter((s) => s.group === g);
  const sub = $("more-cat-sub"); if (sub) sub.textContent = items.length + " elem";
  // Full-width row buttons — easier to read and reach than a grid of small tiles.
  const row = (s) => `<button class="row svc-row${s.soon ? " soon" : ""}" data-svc="${s.id}"${s.soon ? " disabled" : ""} type="button">`
    + `<span class="row-ic">${icon(s.icon)}</span>`
    + `<span class="row-main"><span class="row-title">${esc(s.label)}</span><span class="row-sub">${esc(typeof s.sub === "function" ? s.sub() : s.sub)}</span></span>`
    + (s.soon ? `<span class="svc-badge">Hamarosan</span>` : `<span class="row-chev">${icon("chev")}</span>`)
    + `</button>`;
  host.innerHTML = `<div class="card">${items.map(row).join("")}</div>`;
  wireSvc(host);
}
// Full-screen Kredit page (own page, not a popup).
function renderCreditPage() {
  const host = $("credit-scroll"); if (!host) return;
  const p = state.progress;
  if (!p || !p.total) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px">`
      + `<div class="empty-ic">${icon("chart")}</div>`
      + `<h2>Nincs még kredit adat</h2>`
      + `<p>Olvasd be a Neptunból a teljesített és az összes kreditet.</p>`
      + `<button class="btn primary narrow" id="cred-read" style="margin-top:4px">${icon("book")} Kredit beolvasása</button></div>`;
    const b = $("cred-read"); if (b) b.onclick = grabProgress;
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
  const free = Math.max(0, p.free || 0);
  const req = Math.max(0, p.done - free);
  const remaining = Math.max(0, p.total - p.done);
  const w = (n) => p.total > 0 ? (n / p.total * 100) : 0;
  const leg = (cls, label, val) => `<div class="cl"><span class="dot ${cls}"></span><span class="cl-t">${label}</span><span class="cl-v">${val} kr</span></div>`;
  host.innerHTML = `<div class="card cred-hero">`
    + `<div class="ch-num">${p.done} / ${p.total}</div>`
    + `<div class="ch-cap">teljesített kredit</div>`
    + `<div class="cred-bar" style="margin-top:16px"><div class="cred-fill" style="width:${pct}%"></div></div>`
    + `<div class="ch-pctline">${pct}%</div>`
    + `</div>`
    + `<div class="dash-label">Megoszlás</div>`
    + `<div class="card" style="padding:16px">`
    +   `<div class="cbar">`
    +     (req ? `<span class="cseg s-req" style="width:${w(req)}%"></span>` : "")
    +     (free ? `<span class="cseg s-free" style="width:${w(free)}%"></span>` : "")
    +     `</div>`
    +   `<div class="clegend">`
    +     leg("s-req", "Kötelező teljesített", req)
    +     leg("s-free", "Szabadon választható", free)
    +     leg("s-rem", "Hátralévő", remaining)
    +     `</div>`
    + `</div>`
    + `<div class="hint center" style="margin-top:16px">Frissítve: ${esc(fmtWhen(p.fetchedAt))}</div>`;
}
// Full-screen Pénzügyek page. All data comes from state.finance (syncFinance); no Neptun calls here.
function ftFt(v, cur) { return (v == null ? "—" : Number(v).toLocaleString("hu")) + " " + (cur === "HUF" || !cur ? "Ft" : cur); }
function ftDate(iso) { if (!iso) return ""; const d = new Date(iso); return TT_MON[d.getMonth()] + " " + d.getDate() + "., " + d.getFullYear(); }
function renderFinance() {
  const host = $("finance-scroll"); if (!host) return;
  const f = state.finance;
  if (!f || !f.fetchedAt) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("wallet")}</div>`
      + `<h2>Nincs még pénzügyi adat</h2><p>Olvasd be a Neptunból az egyenleged, tételeid és tranzakcióid.</p>`
      + `<button class="btn primary narrow" id="fin-read" style="margin-top:4px">${icon("wallet")} Beolvasás</button></div>`;
    const b = $("fin-read"); if (b) b.onclick = () => openDataSync(["finance"]);
    return;
  }
  const accts = f.accounts || [], main = accts.find((a) => a.currency === "HUF") || accts[0];
  let html = "";
  // 1) Balance hero
  if (main) {
    html += `<div class="card cred-hero"><div class="ch-num">${ftFt(main.balance, main.currency)}</div>`
      + `<div class="ch-cap">${esc(main.label || "Egyenleg")}</div>`
      + (main.account ? `<button class="fin-acc" data-copy="${esc(main.account)}">${esc(main.account)} ${icon("copy")}</button>` : "")
      + (main.autoPayText ? `<div class="hint center" style="margin:8px 0 0">Automatikus befizetés: ${esc(main.autoPayText)}</div>` : "")
      + `</div>`;
    accts.filter((a) => a !== main).forEach((a) => {
      html += `<button class="card fin-row2" data-copy="${esc(a.account)}"><span class="row-main"><span class="row-title">${ftFt(a.balance, a.currency)}</span><span class="row-sub">${esc(a.label || a.currency)} · ${esc(a.account)}</span></span>${icon("copy")}</button>`;
    });
  }
  // 2) Sub-page rows (each opens its own full-screen page)
  const toPay = f.toPay || [], tx = f.transactions || [], sch = f.scholarships || [], inv = f.invoices || [];
  const toPaySum = toPay.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const finRow = (id, ic, title, sub, danger) => `<button class="row" data-fin="${id}" type="button">`
    + `<span class="row-ic${danger ? " danger" : ""}">${icon(ic)}</span>`
    + `<span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>`
    + `<span class="row-chev">${icon("chev")}</span></button>`;
  html += `<div class="dash-label">Tételek</div><div class="card">`
    + finRow("tab-fin-topay", "wallet", "Befizetendő", toPay.length ? `${toPay.length} tétel · ${ftFt(toPaySum, "HUF")}` : "Nincs befizetendő", toPay.length > 0)
    + finRow("tab-fin-tx", "swap", "Tranzakciók", tx.length ? `${tx.length} tétel` : "Nincs tranzakció")
    + finRow("tab-fin-scholar", "note", "Ösztöndíjak", sch.length ? `${sch.length} tétel` : "Nincs ösztöndíj")
    + finRow("tab-fin-invoices", "doc", "Számlák", inv.length ? `${inv.length} számla` : "Nincs számla")
    + `</div>`;
  html += `<div class="hint center" style="margin-top:16px">Frissítve: ${esc(fmtWhen(f.fetchedAt))}</div>`;
  host.innerHTML = html;
  host.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Számlaszám másolva"); } catch (e) { toast("Számlaszám: " + b.dataset.copy); } });
  host.querySelectorAll("[data-fin]").forEach((b) => b.onclick = () => pushScreen(b.dataset.fin));
}
// ---- Pénzügyek sub-pages: all read the same state.finance, no Neptun calls ----
function finEmpty(host, msg) { if (host) host.innerHTML = `<div class="dash-empty" style="padding:22px 4px">${esc(msg)}</div>`; }
function renderFinTopay() {
  const host = $("fin-topay-scroll"); if (!host) return;
  const list = (state.finance && state.finance.toPay) || [];
  if (!list.length) return finEmpty(host, "Nincs befizetendő tételed.");
  const total = list.reduce((s, i) => s + (Number(i.value) || 0), 0);
  let html = `<div class="card cred-hero" style="padding:20px"><div class="ch-num">${ftFt(total, "HUF")}</div><div class="ch-cap">összesen befizetendő</div></div>`;
  list.forEach((i) => {
    const overdue = i.dueDate && new Date(i.dueDate) < new Date();
    html += `<div class="card fin-item"><div class="fin-item-h"><span class="fin-item-n">${esc(i.name)}</span><span class="fin-item-v">${ftFt(i.value, i.currency)}</span></div>`
      + `<div class="row-sub">${[esc(i.subjectName), esc(i.term)].filter(Boolean).join(" · ")}`
      + `${i.dueDate ? ` · <span class="${overdue ? "fin-due" : ""}">határidő ${esc(ftDate(i.dueDate))}</span>` : ""}</div></div>`;
  });
  host.innerHTML = html;
}
let finTxFilter = "all"; // "all" or a year string
function renderFinTx() {
  const host = $("fin-tx-scroll"); if (!host) return;
  const all = (state.finance && state.finance.transactions) || [];
  if (!all.length) return finEmpty(host, "Nincs tranzakció.");
  const years = Array.from(new Set(all.map((t) => t.date ? new Date(t.date).getFullYear() : null).filter(Boolean))).sort((a, b) => b - a);
  if (finTxFilter !== "all" && years.indexOf(+finTxFilter) < 0) finTxFilter = "all"; // filter no longer valid
  const list = finTxFilter === "all" ? all : all.filter((t) => t.date && new Date(t.date).getFullYear() === +finTxFilter);
  let html = `<div class="controls" style="margin-bottom:12px"><button class="period-btn" type="button"><span>${finTxFilter === "all" ? "Összes időszak" : esc(finTxFilter)}</span>${icon("down")}</button></div><div class="card">`;
  list.forEach((t) => {
    const pos = t.sign === "+";
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(t.direction || t.type)}</span><span class="row-sub">${esc(ftDate(t.date))}${t.note ? " · " + esc(t.note) : ""}</span></span>`
      + `<span class="fin-amt ${pos ? "pos" : "neg"}">${pos ? "+" : "−"}${ftFt(t.value, t.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
  const pb = host.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: finTxFilter,
    items: [{ value: "all", label: "Összes időszak" }].concat(years.map((y) => ({ value: String(y), label: String(y) }))),
    onPick: (v) => { finTxFilter = v; renderFinTx(); } });
}
function renderFinScholar() {
  const host = $("fin-scholar-scroll"); if (!host) return;
  const list = (state.finance && state.finance.scholarships) || [];
  if (!list.length) return finEmpty(host, "Nincs ösztöndíj vagy kifizetés.");
  let html = `<div class="card">`;
  list.forEach((s) => {
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${[esc(s.term), esc(s.status), esc(ftDate(s.date))].filter(Boolean).join(" · ")}</span></span><span class="fin-amt pos">${ftFt(s.amount, s.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}
function renderFinInvoices() {
  const host = $("fin-invoices-scroll"); if (!host) return;
  const list = (state.finance && state.finance.invoices) || [];
  if (!list.length) return finEmpty(host, "Nincs számla.");
  let html = `<div class="card">`;
  list.forEach((v) => {
    html += `<div class="row fin-tx"><span class="row-main"><span class="row-title">${esc(v.name || v.number)}</span><span class="row-sub">${[esc(v.number), esc(ftDate(v.date))].filter(Boolean).join(" · ")}</span></span><span class="fin-amt">${ftFt(v.value, v.currency)}</span></div>`;
  });
  html += `</div>`;
  host.innerHTML = html;
}
// Refresh ONLY the finance data (topic-scoped) — used by the top-right button and pull-to-refresh.
// Uses direct HTTP (getApiSession coalesces the token fetch), so no "flow busy" blocking. A silent
// re-entrancy guard just ignores a second trigger while one is already running.
let refreshingFin = false;
async function refreshFinance(viaButton) {
  if (refreshingFin) return;
  refreshingFin = true;
  if (viaButton) showBusy("Pénzügyek frissítése…", true);
  let r; try { await totpTick(); r = await syncFinance(); } catch (e) { r = { ok: false }; }
  finally { refreshingFin = false; if (viaButton) hideBusy(); }
  renderFinance();
  toast(r && r.ok ? "Pénzügyek frissítve." : "Nem sikerült frissíteni.");
}
// ---- Üzenetek: list (Beérkezett / Elküldött) + on-demand message view. All from state.messages. ----
let msgTab = "received"; // "received" | "sent"
let msgOpen = null; // the message currently shown in tab-msg-view
let msgQuery = "", msgSem = "all"; // list search text + semester filter (derived from message dates)
let msgAutoAt = 0; // throttle auto-load retries so a failing fetch can't tight-loop
function renderMessages() {
  const host = $("messages-scroll"); if (!host) return;
  const m = state.messages;
  if (!m || !m.fetchedAt) {
    // No data yet → auto-load silently on open (token is kept warm, so it's quick). Throttled so a
    // failed fetch shows the manual button instead of looping.
    if (isNative && canAutoLogin() && !refreshingMsg && Date.now() - msgAutoAt > 15000) {
      msgAutoAt = Date.now();
      host.innerHTML = `<div class="dash-empty" style="padding:40px 4px">Üzenetek betöltése…</div>`;
      refreshMessages(false); // re-renders when done
      return;
    }
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("mail")}</div>`
      + `<h2>Nincs még üzenet</h2><p>Olvasd be a Neptun beérkezett és elküldött üzeneteidet.</p>`
      + `<button class="btn primary narrow" id="msg-read" style="margin-top:4px">${icon("mail")} Beolvasás</button></div>`;
    const b = $("msg-read"); if (b) b.onclick = () => refreshMessages(true);
    return;
  }
  // Have (possibly stale) data → show it immediately, refresh in the background if older than 3 min.
  if (isNative && canAutoLogin() && !refreshingMsg && (Date.now() - new Date(m.fetchedAt).getTime() > 3 * 60 * 1000)) refreshMessages(false);
  const baseList = msgTab === "sent" ? (m.sent || []) : (m.received || []);
  const seg = (id, label, n) => `<button class="seg-btn${msgTab === id ? " active" : ""}" data-mtab="${id}" type="button">${label}${n ? ` <span class="seg-n">${n}</span>` : ""}</button>`;
  const sems = Array.from(new Set(baseList.map((x) => x.date ? semObj(new Date(x.date)).key : null).filter(Boolean)));
  if (msgSem !== "all" && sems.indexOf(msgSem) < 0) msgSem = "all";
  let html = `<div class="seg" style="margin-bottom:10px">`
    + seg("received", "Beérkezett", m.unread || 0)
    + seg("sent", "Elküldött", 0) + `</div>`;
  html += `<div class="msg-controls">`
    + `<div class="uni-search field-ic msg-search"><span class="ic-left" data-icon="search"></span>`
    +   `<input class="input" id="msg-search" placeholder="Keresés tárgy vagy feladó" autocomplete="off" value="${esc(msgQuery)}" /></div>`
    + `</div>`;
  html += `<div id="msg-list"></div>`;
  html += `<div class="hint center" style="margin-top:16px">Frissítve: ${esc(fmtWhen(m.fetchedAt))}</div>`;
  host.innerHTML = html;
  host.querySelectorAll("[data-mtab]").forEach((b) => b.onclick = () => { msgTab = b.dataset.mtab; msgQuery = ""; msgSem = "all"; renderMessages(); });
  const search = $("msg-search"); if (search) search.oninput = (e) => { msgQuery = e.target.value; renderMsgList(); };
  // Semester filter lives in the top bar, next to refresh.
  const semTop = $("msg-sem-top");
  if (semTop) {
    semTop.classList.toggle("on", msgSem !== "all");
    semTop.onclick = () => openList({ title: "Félév", selected: msgSem,
      items: [{ value: "all", label: "Minden félév" }].concat(sems.map((s) => ({ value: s, label: s }))),
      onPick: (v) => { msgSem = v; renderMessages(); } });
  }
  const subEl = $("messages-sub"); if (subEl) subEl.textContent = msgSem === "all" ? "Neptun üzenetek" : ("Félév: " + msgSem);
  renderMsgList();
}
// Fill just the list (keeps the search input focused while typing). Reads msgTab/msgQuery/msgSem.
function renderMsgList() {
  const wrap = $("msg-list"); if (!wrap) return;
  const m = state.messages; if (!m) return;
  let list = msgTab === "sent" ? (m.sent || []) : (m.received || []);
  const q = msgQuery.trim().toLowerCase();
  if (q) list = list.filter((x) => (x.subject || "").toLowerCase().includes(q) || (x.from || "").toLowerCase().includes(q));
  if (msgSem !== "all") list = list.filter((x) => x.date && semObj(new Date(x.date)).key === msgSem);
  if (!list.length) {
    const base = msgTab === "sent" ? "Nincs elküldött üzenet." : "Nincs beérkezett üzenet.";
    wrap.innerHTML = `<div class="dash-empty" style="padding:22px 4px">${(q || msgSem !== "all") ? "Nincs találat." : base}</div>`;
    return;
  }
  let html = `<div class="card">`;
  list.forEach((x) => {
    const who = x.sent ? (x.to ? "Címzett: " + esc(x.to) : "Elküldött") : (x.isSystem ? "Rendszerüzenet" : esc(x.from || "Ismeretlen"));
    html += `<button class="row msg-row${x.unread ? " unread" : ""}" data-msg="${esc(x.id)}" type="button">`
      + `<span class="msg-dot"></span>`
      + `<span class="row-main"><span class="row-title">${esc(x.subject)}</span>`
      + `<span class="row-sub">${[who, esc(ftDate(x.date))].filter(Boolean).join(" · ")}</span></span>`
      + `${x.hasAttachment ? `<span class="msg-clip">${icon("doc")}</span>` : ""}`
      + `<span class="row-chev">${icon("chev")}</span></button>`;
  });
  html += `</div>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll("[data-msg]").forEach((b) => b.onclick = () => {
    msgOpen = list.find((x) => x.id === b.dataset.msg) || null;
    pushScreen("tab-msg-view");
  });
}
async function renderMsgView() {
  const host = $("msg-view-scroll"); if (!host) return;
  const composeHost = $("msg-view-compose"); if (composeHost) composeHost.innerHTML = ""; // reset the floor bar each render
  const x = msgOpen;
  const sub = $("msg-view-sub");
  if (!x) { host.innerHTML = `<div class="dash-empty" style="padding:22px 4px">Nincs megnyitott üzenet.</div>`; return; }
  const party = x.sent ? (x.to || "Címzett") : (x.isSystem ? "Rendszerüzenet" : (x.from || "Neptun"));
  if (sub) sub.textContent = party;
  host.innerHTML = `<div class="card msg-head"><div class="msg-subj">${esc(x.subject)}</div>`
    + `<div class="row-sub" style="margin-top:7px">${esc(party)}</div></div>`
    + `<div id="msg-body"><div class="dash-empty" style="padding:8px 2px">Betöltés…</div></div>`;
  const body = $("msg-body");
  const res = await apiReadMessagePosts(x.id);
  if (!res) { body.innerHTML = `<div class="dash-empty" style="padding:8px 2px">Az üzenet szövege nem tölthető be.</div>`; return; }
  const posts = res.posts;
  // Mark read locally, and in the background tell Neptun we've seen it (so the web/other devices agree).
  if (x.unread && !x.sent) {
    x.unread = false;
    if (state.messages) { state.messages.unread = Math.max(0, (state.messages.unread || 1) - 1); saveState(); }
    apiMarkMessageRead(x.id, posts); // fire-and-forget; don't block the view
  }
  // Pick the text field robustly: known names first, else the longest string field that looks like a body.
  const META = { postId: 1, parentPostId: 1, senderUserId: 1, sendDate: 1, expectedAttachmentsDeletionDate: 1, plainTextPreview: 1 };
  const pickText = (p) => {
    const known = p.htmlText || p.text || p.content || p.body || p.messageText || p.postText || p.messageBody || p.htmlBody || p.htmlContent || p.messageContent || p.description || p.plainTextPreview;
    if (known) return known;
    let best = "";
    for (const k in p) { const v = p[k]; if (typeof v === "string" && v && !META[k] && !/^https?:/.test(v) && v.length > best.length) best = v; }
    return best;
  };
  // Chat bubbles: my posts (senderUserId === my id) align right; the other party's align left with their
  // name. Posts come oldest→newest, so newest sits at the bottom like a chat app (we scroll there).
  const meId = (state.messages && state.messages.meId) || "";
  const names = {}; (res.recipients || []).forEach((r) => { if (r.userId) names[r.userId] = r.printName || ""; });
  body.className = "chat";
  body.innerHTML = posts.map((p) => {
    const txt = pickText(p);
    const when = p.sendDate || p.created || p.sentDate || p.creationDate || p.postDate || p.date || null;
    const mine = !!(meId && p.senderUserId === meId);
    const name = mine ? "Te" : (names[p.senderUserId] || (x.sent ? "" : x.from) || "");
    const inner = txt ? sanitizeHtml(txt)
      : `<span style="opacity:.7">Nincs szöveg.</span> <pre style="white-space:pre-wrap;font-size:11px;color:var(--ink-3)">${esc(JSON.stringify(p, null, 1).slice(0, 800))}</pre>`;
    // Attachments after the text — each a tappable chip (download on confirm).
    const atts = (p.attachments || []).map((a) => {
      const did = a.documentationId || a.documentId || a.id || "";
      const fn = a.fileName || a.name || "Melléklet";
      const sz = a.fileSize ? " · " + fmtBytes(a.fileSize) : "";
      return `<button class="att" type="button" data-att="${esc(p.postId || "")}" data-did="${esc(did)}" data-fn="${esc(fn)}">`
        + `${icon("doc")}<span class="att-n">${esc(fn)}${sz}</span>${icon("download")}</button>`;
    }).join("");
    return `<div class="msg-bubble${mine ? " mine" : ""}">`
      + `${!mine && name ? `<div class="b-name">${esc(name)}</div>` : ""}`
      + `<div class="b-text">${inner}</div>`
      + `${atts ? `<div class="b-atts">${atts}</div>` : ""}`
      + `${when ? `<div class="b-time">${esc(ftDate(when))}</div>` : ""}</div>`;
  }).join("");
  // Attachment tap → confirm → download to Documents/neptunplus/letoltesek.
  body.querySelectorAll("[data-att]").forEach((b) => b.onclick = async () => {
    const fn = b.dataset.fn || "melléklet", postId = b.dataset.att, did = b.dataset.did;
    if (!did) { toast("Ismeretlen melléklet."); return; }
    const ok = await ask({ title: "Letöltöd a mellékletet?", okText: "Letöltés", cancelText: "Mégse", body: esc(fn) });
    if (!ok) return;
    toast("Letöltés…");
    const r = await downloadAttachment(postId, [did], fn);
    if (!r.ok) { toast("Nem sikerült letölteni" + (r.detail ? ": " + r.detail : ".")); return; }
    if (r.native) {
      const open = await ask({ title: "Letöltve", okText: "Megnyitás", cancelText: "Bezár",
        body: `A(z) <b>${esc(r.name)}</b> a <b>Letöltések</b> mappába került.` });
      if (open) { try { await DLP().open({ uri: r.uri, mime: r.mime }); } catch (e) { toast("Nem sikerült megnyitni."); } }
    } else {
      await ask({ title: "Letöltve", okText: "OK",
        body: `Elmentve ide:<br><b>${esc(r.path)}</b><br><br>Megnyitáshoz frissítsd az appot (új verzió kell a Letöltésekbe mentéshez és a megnyitáshoz).` });
    }
  });
  // Reply — a persistent chat composer pinned to the bottom, shown whenever this thread's own reply flag
  // is on (messageData.isReplyEnabled). Automated / no-reply Neptun messages have it false → no composer.
  if (res.replyEnabled) {
    const last = posts[posts.length - 1] || {};
    const lastPostId = last.postId || last.id || "";
    const MAX_FILES = 5;
    const pending = []; // { file, name }
    const bar = document.createElement("div");
    bar.className = "msg-compose";
    bar.innerHTML = `<div class="mc-files" id="mc-files" hidden></div>`
      + `<div class="mc-row">`
      + `<button class="iconbtn mc-attach" id="msg-attach" type="button" title="Csatolás">${icon("clip")}</button>`
      + `<textarea class="input" id="msg-reply-text" rows="1" placeholder="Írj üzenetet…"></textarea>`
      + `<button class="iconbtn send" id="msg-reply-send" type="button" title="Küldés">${icon("send")}</button>`
      + `</div><input type="file" id="msg-file-input" multiple hidden>`;
    (composeHost || host).appendChild(bar); // pinned to the tab floor, outside the scroll (Messenger-style)
    const ta = $("msg-reply-text"), send = $("msg-reply-send"), fileInput = $("msg-file-input"), filesWrap = $("mc-files");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; };
    ta.oninput = grow;
    const renderPending = () => {
      filesWrap.hidden = !pending.length;
      filesWrap.innerHTML = pending.map((p, i) =>
        `<span class="mc-file">${icon("doc")}<span class="mc-file-n">${esc(p.name)}</span><button class="mc-file-x" data-rm="${i}" type="button">${icon("x")}</button></span>`).join("");
      filesWrap.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { pending.splice(+b.dataset.rm, 1); renderPending(); });
    };
    $("msg-attach").onclick = () => fileInput.click();
    fileInput.onchange = () => {
      for (const f of Array.from(fileInput.files || [])) {
        if (pending.length >= MAX_FILES) { toast("Legfeljebb " + MAX_FILES + " fájl."); break; }
        pending.push({ file: f, name: f.name });
      }
      fileInput.value = ""; renderPending();
    };
    const doSend = async () => {
      const text = ta.value.trim();
      if (!text && !pending.length) return;               // need text or at least a file
      if (secOn("confirmSend")) {
        const fileList = pending.length ? `<br><b>Csatolmány:</b> ${pending.map((p) => esc(p.name)).join(", ")}` : "";
        const ok = await ask({ title: "Biztosan elküldöd?", okText: "Küldés", cancelText: "Mégse",
          body: `<b>Címzett:</b> ${esc(party)}${fileList}<br><br>${esc(text).replace(/\n/g, "<br>")}` });
        if (!ok) return;
      }
      ta.disabled = send.disabled = true;
      let fileIds = [];
      try {
        for (let i = 0; i < pending.length; i++) { send.textContent = ""; toast("Feltöltés… (" + (i + 1) + "/" + pending.length + ")"); fileIds.push(await apiUploadFile(pending[i].file)); }
      } catch (e) {
        ta.disabled = send.disabled = false;
        await ask({ title: "Feltöltés nem sikerült", okText: "OK", body: esc(e && e.message ? e.message : String(e)) });
        return;
      }
      const r = await apiSendReply(x.id, text, lastPostId, fileIds);
      if (r.ok) { toast("Elküldve."); renderMsgView(); }               // reload thread → shows the new reply at the bottom
      else { ta.disabled = send.disabled = false; toast("Nem sikerült elküldeni" + (r.detail ? ": " + r.detail : ".")); }
    };
    send.onclick = doSend;
    // Enter sends, Shift+Enter makes a new line (desktop-style chat convenience).
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } };
  }
  // Chat-style: land at the newest message (bottom), like opening a chat thread.
  requestAnimationFrame(() => { host.scrollTop = host.scrollHeight; });
}
// Message post bodies are HTML from Neptun. Allow only basic inline formatting; strip scripts/attrs.
function sanitizeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.innerHTML = String(s);
  div.querySelectorAll("script,style,iframe,object,embed").forEach((el) => el.remove());
  div.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => { if (!/^href$/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name); });
    if (el.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
  });
  return div.innerHTML;
}
let refreshingMsg = false;
async function refreshMessages(viaButton) {
  if (refreshingMsg) return;
  refreshingMsg = true;
  if (viaButton) showBusy("Üzenetek frissítése…", true);
  let r; try { await totpTick(); r = await syncMessages(); } catch (e) { r = { ok: false }; }
  finally { refreshingMsg = false; if (viaButton) hideBusy(); }
  renderMessages();
  toast(r && r.ok ? "Üzenetek frissítve." : "Nem sikerült frissíteni.");
}
// Credit refresh (topic-scoped): silent direct API via syncCredit, no "Bejelentkezés" overlay.
let refreshingCredit = false;
async function refreshCredit(viaButton) {
  if (refreshingCredit) return;
  refreshingCredit = true;
  if (viaButton) showBusy("Kredit frissítése…", true);
  let r; try { await totpTick(); r = await syncCredit(); } catch (e) { r = { ok: false }; }
  finally { refreshingCredit = false; if (viaButton) hideBusy(); }
  renderCreditPage(); renderProgress();
  toast(r && r.ok ? "Kredit frissítve." : "Nem sikerült frissíteni.");
}
// ---- Jegyek: átlagok/indexek + félévenként a jegyek ----
let gradesFilter = "all"; // "all" or a termName
// A grade badge coloured by how good the grade is (1 red → 5 green). Shows the NUMBER for any graded
// subject; only signature/"megfelelt" results (no numeric grade) show a check. Recomputes the number
// from the result text if it wasn't stored, so older reads render correctly too.
function isSignatureResult(r) { return /alá[ií]r|megfelelt|teljes[ií]t/i.test(String(r || "")); }
function gradeBox(e) {
  const v = (e.value != null) ? e.value : gradeValue(e.result);
  const g = (v >= 1 && v <= 5) ? v : 0;
  const inner = (v != null) ? String(v) : (isSignatureResult(e.result) || e.passed ? icon("check") : (e.result ? esc(e.result[0].toUpperCase()) : "–"));
  return `<span class="grade-box g${g}" title="${esc(e.result || "")}">${inner}</span>`;
}
function renderGrades() {
  const host = $("grades-scroll"); if (!host) return;
  const gr = state.grades;
  if (!gr || !gr.fetchedAt) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("note")}</div>`
      + `<h2>Nincs még jegy</h2><p>Olvasd be a vizsgajegyeidet és az átlagaidat a Neptunból.</p>`
      + `<button class="btn primary narrow" id="grades-read" style="margin-top:4px">${icon("note")} Beolvasás</button></div>`;
    const b = $("grades-read"); if (b) b.onclick = () => openDataSync(["grades"]);
    return;
  }
  const idx = gr.averages && gr.averages.indices, perTerm = (gr.averages && gr.averages.perTerm) || [];
  let html = "";
  // Megajánlott jegyek — accept/reject right here.
  const offered = gr.offered || [];
  if (offered.length) {
    html += `<div class="dash-label">Megajánlott jegyek</div>`;
    offered.forEach((o) => {
      html += `<div class="card offer-card"><div class="offer-top">`
        + `<div class="row-main"><span class="row-title">${esc(o.subject || o.code || "Tárgy")}</span><span class="row-sub">${[esc(o.code), o.deadline ? "határidő " + esc(ftDate(o.deadline)) : ""].filter(Boolean).join(" · ")}</span></div>`
        + gradeBox({ value: gradeValue(o.result), result: o.result }) + `</div>`
        + `<div class="offer-actions"><button class="btn outline" data-offrej="${esc(o.id)}" type="button">Elutasítás</button><button class="btn primary" data-offacc="${esc(o.id)}" type="button">Elfogadás</button></div></div>`;
    });
  }
  // Semester filter (Összes félév / one term).
  const terms = gr.terms || [];
  const termNames = terms.map((t) => t.termName).filter(Boolean);
  if (gradesFilter !== "all" && termNames.indexOf(gradesFilter) < 0) gradesFilter = "all";
  html += `<div class="controls" style="margin-bottom:6px"><button class="period-btn" id="grades-period" type="button"><span>${gradesFilter === "all" ? "Összes félév" : esc(gradesFilter)}</span>${icon("down")}</button></div>`;
  // Per-term averages map for the per-term stat headers.
  const avgByTerm = {}; perTerm.forEach((t) => { avgByTerm[t.termName] = t; });
  const norm = (s) => String(s || "").replace(/\s*\(.*\)\s*$/, "").trim();
  const attempts = gr.attempts || {};
  (gradesFilter === "all" ? terms : terms.filter((t) => t.termName === gradesFilter)).forEach((t) => {
    const a = avgByTerm[norm(t.termName)];
    // Highlighted header for this term with its stats (átlag / súlyozott / kreditindex).
    html += `<div class="dash-label" style="margin-top:18px">${esc(t.termName)}</div>`;
    if (a && (a.average != null || a.sumAverage != null || a.creditIndex != null)) {
      const cells = [];
      if (a.average != null) cells.push(["Átlag", a.average]);
      if (a.sumAverage != null) cells.push(["Súlyozott", a.sumAverage]);
      if (a.creditIndex != null) cells.push(["Kreditindex", a.creditIndex]);
      html += `<div class="card grade-idx">` + cells.map(([k, v], i) => `<div class="gi-cell${i ? " gi-div" : ""}"><div class="gi-v">${esc(String(v))}</div><div class="gi-k">${esc(k)}</div></div>`).join("") + `</div>`;
    }
    if (!t.subjects.length) { html += `<div class="dash-empty" style="padding:10px 4px">Nincs tárgy ebben a félévben.</div>`; return; }
    html += `<div class="card">` + t.subjects.map((s) => {
      const n = (attempts[s.subjectId] || []).length;
      const sub = [esc(s.code), s.credits ? esc(s.credits + " kr") : "", n > 1 ? esc(n + " jegy") : ""].filter(Boolean).join(" · ");
      return `<button class="row grade-row" data-sid="${esc(s.subjectId)}" type="button">`
        + `<span class="row-main"><span class="row-title">${esc(s.subject)}</span><span class="row-sub">${sub}</span></span>`
        + gradeBox(s) + `</button>`;
    }).join("") + `</div>`;
  });
  html += `<div class="hint center" style="margin-top:16px">Frissítve: ${esc(fmtWhen(gr.fetchedAt))}</div>`;
  host.innerHTML = html;
  const pb = $("grades-period");
  if (pb) pb.onclick = () => openList({ title: "Félév", selected: gradesFilter,
    items: [{ value: "all", label: "Összes félév" }].concat(termNames.map((n) => ({ value: n, label: n }))),
    onPick: (v) => { gradesFilter = v; renderGrades(); } });
  host.querySelectorAll("[data-sid]").forEach((b) => b.onclick = () => openGradeDetail(b.dataset.sid));
  host.querySelectorAll("[data-offacc]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offacc, true));
  host.querySelectorAll("[data-offrej]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offrej, false));
}
async function offeredDecide(id, accept) {
  const gr = state.grades; const o = (gr && gr.offered || []).find((x) => x.id === id); if (!o) return;
  const ok = await askTyped({ title: accept ? "Biztosan elfogadod?" : "Biztosan elutasítod?", okText: accept ? "Elfogadom" : "Elutasítom", cancelText: "Mégse", word: "IGEN",
    body: `<b>${esc(o.subject || o.code)}</b><br>Megajánlott jegy: <b>${esc(o.result || "—")}</b><br><br>${accept ? "Elfogadás után a jegy bekerül a leckekönyvbe, és ezt nem lehet visszavonni." : "Elutasítás után vizsgáznod kell a tárgyból."}<br>A megerősítéshez írd be, hogy <b>IGEN</b>.` });
  if (!ok) return;
  showBusy(accept ? "Elfogadás…" : "Elutasítás…", true);
  let r; try { r = await apiOfferedGradeDecision(id, accept); } catch (e) { r = { ok: false }; }
  if (r.ok) { try { await syncGrades(); } catch (e) {} }
  hideBusy();
  renderGrades();
  toast(r.ok ? (accept ? "Jegy elfogadva." : "Jegy elutasítva.") : ("Nem sikerült" + (r.detail ? ": " + r.detail : ".")));
}
// Tap a subject → sheet with its final grade + every recorded grade (exam attempts, retakes…).
function openGradeDetail(subjectId) {
  const gr = state.grades; if (!gr) return;
  let subj = null; (gr.terms || []).forEach((t) => t.subjects.forEach((s) => { if (s.subjectId === subjectId) subj = Object.assign({ termName: t.termName }, s); }));
  if (!subj) return;
  const list = (gr.attempts && gr.attempts[subjectId]) || [];
  let h = `<div class="sheet-title">${esc(subj.subject)}</div>`
    + `<div class="detail-meta">${[esc(subj.code), subj.credits ? esc(subj.credits + " kredit") : "", esc(subj.termName)].filter(Boolean).join(" · ")}</div>`;
  h += `<div class="grade-final">${gradeBox(subj)}<div><div class="gf-t">Végleges jegy</div><div class="gf-v">${esc(subj.result || (subj.passed ? "Teljesítve" : "—"))}</div></div></div>`;
  if (list.length) {
    h += `<div class="dash-label" style="margin-top:8px">Összes bejegyzett jegy</div><div class="card">`
      + list.map((e) => `<div class="row grade-row"><span class="row-main"><span class="row-title">${esc(e.result || "—")}</span><span class="row-sub">${[esc(e.type), e.date ? esc(ftDate(e.date)) : ""].filter(Boolean).join(" · ")}</span></span>${gradeBox(e)}</div>`).join("")
      + `</div>`;
  } else {
    h += `<div class="hint" style="margin-top:12px">Ehhez a tárgyhoz nincs külön vizsgabejegyzés — a leckekönyvi végleges jegy látszik.</div>`;
  }
  $("grade-body").innerHTML = h;
  $("grade-sheet").classList.remove("hidden");
}
let refreshingGrades = false;
async function refreshGrades(viaButton) {
  if (refreshingGrades) return;
  refreshingGrades = true;
  if (viaButton) showBusy("Jegyek frissítése…", true);
  let r; try { await totpTick(); r = await syncGrades(); } catch (e) { r = { ok: false }; }
  finally { refreshingGrades = false; if (viaButton) hideBusy(); }
  renderGrades();
  toast(r && r.ok ? "Jegyek frissítve." : "Nem sikerült frissíteni.");
}
// ---------- Időszakok (periods) ----------
let refreshingPeriods = false;
function periodState(p, now) { // -1 lezárult, 0 aktív, 1 közelgő
  const f = p.from ? new Date(p.from).getTime() : null, t = p.to ? new Date(p.to).getTime() : null;
  if (t != null && !isNaN(t) && now > t) return -1;
  if (f != null && !isNaN(f) && now < f) return 1;
  return 0;
}
function activePeriods(items) { const now = Date.now(); return (items || []).filter((p) => periodState(p, now) === 0); }
function ftDateTime(v) {
  if (!v) return "—";
  const d = new Date(v); if (isNaN(d)) return esc(String(v));
  const day = TT_MON[d.getMonth()] + " " + d.getDate() + "., " + d.getFullYear();
  const hm = d.getHours() || d.getMinutes() ? " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "";
  return day + hm;
}
let periodsStatus = "active-soon", periodsTerm = "all";
const PERIOD_STATUS = { "active-soon": "Aktív és közelgő", active: "Aktív", soon: "Közelgő", off: "Lezárult", all: "Összes" };
function periodTermOf(p) { const m = String(p.name || "").match(/(\d{4}\/\d{2}\/\d)/); return m ? m[1] : null; }
// Neptun period names arrive ALL CAPS ("MEGAJÁNLOTT JEGYEK BEÍRÁSA…") — soften to sentence case if shouty.
function periodSentence(s) {
  s = String(s || "").trim(); if (!s) return s;
  const letters = (s.match(/\p{L}/gu) || []).length, uppers = (s.match(/\p{Lu}/gu) || []).length;
  if (letters && uppers / letters > 0.6) s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s;
}
function periodShortRange(p) {
  const fmt = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? "—" : TT_MON[d.getMonth()] + " " + d.getDate() + "."; };
  return fmt(p.from) + " – " + fmt(p.to);
}
function periodBadge(p, st, now) {
  const DAY = 86400000;
  if (st === 0 && p.to) { const d = Math.ceil((new Date(p.to).getTime() - now) / DAY); return d <= 0 ? "ma zárul" : "még " + d + " nap"; }
  if (st === 1 && p.from) { const d = Math.ceil((new Date(p.from).getTime() - now) / DAY); return d <= 0 ? "ma indul" : d + " nap múlva"; }
  return "";
}
function renderPeriods() {
  const host = $("periods-scroll"); if (!host) return;
  const data = state.periods;
  if (!data || !data.items || !data.items.length) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("clock")}</div>`
      + `<h2>Nincsenek időszakok</h2><p>Olvasd be a Neptunból, hogy lásd mikor mettől meddig tartanak a beiratkozási, tárgyfelvételi és vizsgajelentkezési időszakok.</p>`
      + `<button class="btn primary narrow" id="periods-read" style="margin-top:4px">${icon("clock")} Beolvasás</button></div>`;
    const b = $("periods-read"); if (b) b.onclick = () => openDataSync(["periods"]);
    return;
  }
  const now = Date.now();
  const terms = Array.from(new Set(data.items.map(periodTermOf).filter(Boolean)));
  if (periodsTerm !== "all" && terms.indexOf(periodsTerm) < 0) periodsTerm = "all";
  const allow = (st) => periodsStatus === "all" ? true : periodsStatus === "active-soon" ? (st === 0 || st === 1)
    : periodsStatus === "active" ? st === 0 : periodsStatus === "soon" ? st === 1 : st === -1;
  const items = data.items.filter((p) => allow(periodState(p, now)) && (periodsTerm === "all" || periodTermOf(p) === periodsTerm));
  const groups = [{ key: 0, label: "Aktív" }, { key: 1, label: "Közelgő" }, { key: -1, label: "Lezárult" }].map((g) => ({ ...g, items: [] }));
  items.forEach((p) => { const g = groups.find((x) => x.key === periodState(p, now)); if (g) g.items.push(p); });
  groups[0].items.sort((a, b) => new Date(a.to || 0) - new Date(b.to || 0));
  groups[1].items.sort((a, b) => new Date(a.from || 0) - new Date(b.from || 0));
  groups[2].items.sort((a, b) => new Date(b.to || 0) - new Date(a.to || 0));
  let html = `<div class="controls" style="margin-bottom:12px">`
    + `<button class="period-btn" id="per-status" type="button"><span>${esc(PERIOD_STATUS[periodsStatus])}</span>${icon("down")}</button>`
    + (terms.length ? `<button class="period-btn view-btn" id="per-term" type="button"><span>${periodsTerm === "all" ? "Minden félév" : esc(periodsTerm)}</span>${icon("down")}</button>` : "")
    + `</div>`;
  if (!items.length) html += `<div class="dash-empty" style="padding:24px 4px">Nincs a szűrőnek megfelelő időszak.</div>`;
  groups.forEach((g) => {
    if (!g.items.length) return;
    html += `<div class="dash-label">${esc(g.label)} · ${g.items.length}</div><div class="card">`;
    g.items.forEach((p) => {
      const st = periodState(p, now), cls = st === 0 ? "on" : st === 1 ? "soon" : "off", badge = periodBadge(p, st, now);
      html += `<div class="period-row ${cls}">`
        + `<span class="pd-main"><span class="pd-name">${esc(periodSentence(p.name || p.type || "Időszak"))}</span>`
        + `<span class="pd-dates">${esc(periodShortRange(p))}</span></span>`
        + (badge ? `<span class="pd-when">${esc(badge)}</span>` : "") + `</div>`;
    });
    html += `</div>`;
  });
  host.innerHTML = html;
  const ps = $("per-status");
  if (ps) ps.onclick = () => openList({ title: "Állapot", selected: periodsStatus,
    items: Object.keys(PERIOD_STATUS).map((k) => ({ value: k, label: PERIOD_STATUS[k] })), onPick: (v) => { periodsStatus = v; renderPeriods(); } });
  const pt = $("per-term");
  if (pt) pt.onclick = () => openList({ title: "Félév", selected: periodsTerm,
    items: [{ value: "all", label: "Minden félév" }].concat(terms.map((t) => ({ value: t, label: t }))), onPick: (v) => { periodsTerm = v; renderPeriods(); } });
}
async function refreshPeriods(viaButton) {
  if (refreshingPeriods) return;
  refreshingPeriods = true;
  if (viaButton) showBusy("Időszakok frissítése…", true);
  let r; try { await totpTick(); r = await syncPeriods(); } catch (e) { r = { ok: false }; }
  finally { refreshingPeriods = false; if (viaButton) hideBusy(); }
  renderPeriods();
  toast(r && r.ok ? "Időszakok frissítve." : "Nem sikerült frissíteni.");
}
function renderProgress() {
  const el = $("hub-credit"); if (!el) return;
  const p = state.progress;
  if (!p || !p.total) { el.classList.add("hidden"); el.classList.remove("clickable"); el.onclick = null; return; }
  el.classList.remove("hidden");
  const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
  el.classList.add("clickable"); el.onclick = openCreditPopup;
  el.innerHTML = `<div class="cred-row"><div><div class="cred-big">${p.done} / ${p.total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${pct}%</div></div>`
    + `<div class="cred-bar"><div class="cred-fill" style="width:${pct}%"></div></div>`
    + `<div class="cred-free">Ebből szabadon választható: <b>${p.free || 0}</b> kredit</div>`;
}
async function openCreditPopup() {
  const p = state.progress; if (!p || !p.total) return;
  const pct = Math.round((p.done / p.total) * 100);
  const ok = await ask({ title: "Kredit előrehaladás", okText: "Frissítés", cancelText: "Mégse",
    body: "<b>" + p.done + " / " + p.total + "</b> teljesített kredit (" + pct + "%)<br>Ebből szabadon választható: <b>" + (p.free || 0) + "</b> kredit<br><br>Frissítve: " + esc(fmtWhen(p.fetchedAt)) });
  if (ok) grabProgress();
}
function nextIsland(el, e, headText, tab, now) {
  if (!el) return;
  el.classList.toggle("nc-now", !!now);
  if (!e) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const time = now ? `${hm(e.S)}–${hm(e.E)}` : hm(e.S);
  const p = e.manual ? null : parseClassSummary(e.summary);
  const title = p ? p.name : (e.summary || "");
  const meta = (p ? [p.type, p.teacher, e.location] : [e.location]).filter(Boolean).join(" · ");
  el.innerHTML = `<div class="nc-head">${headText} · ${esc(dayHeading(e.S))}</div>`
    + `<div class="nc-row"><span class="nc-time">${time}</span><div class="nc-body"><div class="nc-title">${esc(title)}</div>${meta ? `<div class="nc-meta">${esc(meta)}</div>` : ""}</div></div>`;
  el.onclick = () => navTo(tab);
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
    const cur = chips.find((c) => c.key === chipCurrent) || chips[0];
    chipsEl.innerHTML = `<button class="period-btn" id="pk-dd-btn" type="button"><span>${esc(cur ? cur.label : "")}</span>${icon("down")}</button>`
      + `<div class="pk-dd-menu hidden" id="pk-dd-menu">` + chips.map((c) => `<button class="pk-dd-item${c.key === chipCurrent ? " on" : ""}" data-k="${esc(c.key)}" type="button">${esc(c.label)}${c.key === chipCurrent ? icon("check") : ""}</button>`).join("") + `</div>`;
    const btn = chipsEl.querySelector("#pk-dd-btn"), menu = chipsEl.querySelector("#pk-dd-menu");
    btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
    menu.querySelectorAll(".pk-dd-item").forEach((el) => el.onclick = () => { menu.classList.add("hidden"); onChip(el.dataset.k); });
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
// Defensive parse of a Neptun class summary like "Tárgy ( - KÓD) - Oktató - Típus".
// Returns null unless it clearly matches, so a differently-formatted feed just shows the raw text.
function parseClassSummary(summary) {
  const s = String(summary || "").trim();
  const m = s.match(/^(.+?)\s*\(([^)]*)\)\s*(.*)$/);
  if (!m) return null;
  const name = m[1].trim();
  const code = m[2].replace(/^[\s-]+/, "").trim();          // "ONVH_00"
  const rest = m[3].replace(/^[\s-]+/, "").trim();           // "dr. X - Tanóra"
  let teacher = "", type = "";
  if (rest) { const parts = rest.split(/\s+[-–—]\s+/); if (parts.length >= 2) { type = parts[parts.length - 1].trim(); teacher = parts.slice(0, -1).join(" - ").trim(); } else { teacher = rest; } }
  // Only treat as parsed if we actually gained structure (name + at least one of code/teacher/type).
  if (!name || (!code && !teacher && !type)) return null;
  return { name, code, teacher, type };
}
// Structured inner HTML for a class event (falls back to raw summary for non-matching feeds).
function classInfoHtml(e, examMode) {
  const p = (!examMode && !e.manual) ? parseClassSummary(e.summary) : null;
  if (!p) {
    return `<div class="tt-title">${esc(e.summary || (examMode ? "Számonkérés" : "Óra"))}</div>`
      + (e.manual && e.note ? `<div class="tt-loc">${icon("note")} ${esc(e.note)}</div>` : "")
      + (e.location ? `<div class="tt-loc">${icon("pin")} ${esc(e.location)}</div>` : "");
  }
  let h = `<div class="tt-title">${esc(p.name)}</div>`;
  const meta = [p.code ? `<span class="tt-code">${esc(p.code)}</span>` : "", p.type ? `<span>${esc(p.type)}</span>` : ""].filter(Boolean).join("");
  if (meta) h += `<div class="tt-meta">${meta}</div>`;
  if (p.teacher) h += `<div class="tt-loc">${icon("user")} ${esc(p.teacher)}</div>`;
  if (e.location) h += `<div class="tt-loc">${icon("pin")} ${esc(e.location)}</div>`;
  return h;
}
function renderAgenda(scroll, subEl, refreshBtn, examMode, filter, onFilter, extraCtrl) {
  if (!scroll) return;
  extraCtrl = extraCtrl || "";
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

  let html = `<div class="controls">${periodBtn(filter)}${extraCtrl}${examMode ? `<button class="btn tonal narrow" id="add-exam">${icon("plus")} ZH</button>` : ""}</div>`;
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
          ${classInfoHtml(e, examMode)}
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
  wireViewBtn(scroll);
}
// ---- View selector (Lista / Heti) — a dropdown next to the period one, timetable only ----
let ttView = "list", ttWeekStart = null; // ttWeekStart = Monday 00:00 of the shown week
function viewBtn() {
  return `<button class="period-btn view-btn" id="tt-viewbtn" type="button"><span>${ttView === "week" ? "Heti" : "Lista"}</span>${icon("down")}</button>`;
}
function wireViewBtn(scroll) {
  const b = scroll.querySelector("#tt-viewbtn"); if (!b) return;
  b.onclick = () => openList({ title: "Nézet", selected: ttView,
    items: [{ value: "list", label: "Lista" }, { value: "week", label: "Heti" }],
    onPick: (v) => { ttView = v; renderTimetable(); } });
}
function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x; }
// Assign side-by-side columns to overlapping events within one day (interval graph, per cluster).
function layoutOverlaps(dayEvs) {
  let i = 0;
  while (i < dayEvs.length) {
    let j = i, end = dayEvs[i].E.getTime();
    while (j + 1 < dayEvs.length && dayEvs[j + 1].S.getTime() < end) { j++; end = Math.max(end, dayEvs[j].E.getTime()); }
    const cluster = dayEvs.slice(i, j + 1), colEnd = [];
    cluster.forEach((e) => { let c = 0; while (c < colEnd.length && colEnd[c] > e.S.getTime()) c++; colEnd[c] = e.E.getTime(); e._col = c; });
    cluster.forEach((e) => e._cols = colEnd.length);
    i = j + 1;
  }
}
function renderTimetableWeek() {
  const scroll = $("tt-scroll"), subEl = $("tt-sub"), refreshBtn = $("tt-refresh"); if (!scroll) return;
  const hasFeed = !!state.icsUrl;
  if (refreshBtn) refreshBtn.hidden = !hasFeed;
  if (!hasFeed) {
    subEl.textContent = "Feliratkozási link szükséges";
    scroll.innerHTML = `<div class="empty"><div class="empty-ic">${icon("calendar")}</div>`
      + `<h2>Órarend</h2><p>Add meg egyszer a Neptun feliratkozási linkjét, és onnantól egy gombbal frissül.</p>`
      + `<button class="btn primary ics-setup" style="width:auto">Feliratkozási link megadása</button></div>`;
    const b = scroll.querySelector(".ics-setup"); if (b) b.onclick = openIcs; return;
  }
  if (!ttWeekStart) ttWeekStart = mondayOf(new Date());
  const weekStart = ttWeekStart, weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const evs = classEvents().filter((e) => !isHiddenOcc(e) && e.S >= weekStart && e.S < weekEnd).sort((a, b) => a.S - b.S);
  subEl.textContent = evs.length + " óra";
  let maxDay = 4; evs.forEach((e) => { const di = (e.S.getDay() + 6) % 7; if (di > maxDay) maxDay = di; });
  const nDays = maxDay + 1;
  let minH = 8, maxH = 20;
  evs.forEach((e) => { minH = Math.min(minH, e.S.getHours()); maxH = Math.max(maxH, e.E.getHours() + (e.E.getMinutes() > 0 ? 1 : 0)); });
  const rowH = 46, hours = maxH - minH, today = new Date(), now = Date.now();
  const wkEnd = new Date(weekStart); wkEnd.setDate(wkEnd.getDate() + nDays - 1);
  const wkLabel = weekStart.getMonth() === wkEnd.getMonth()
    ? `${TT_MON[weekStart.getMonth()]} ${weekStart.getDate()}–${wkEnd.getDate()}.`
    : `${TT_MON[weekStart.getMonth()]} ${weekStart.getDate()}. – ${TT_MON[wkEnd.getMonth()]} ${wkEnd.getDate()}.`;
  const TT_DAY_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"]; // getDay() 0=V..6=Szo — distinct (Szerda≠Szombat)
  let daysHead = "";
  for (let d = 0; d < nDays; d++) { const dd = new Date(weekStart); dd.setDate(dd.getDate() + d);
    daysHead += `<div class="wk-day${sameDay(dd, today) ? " today" : ""}"><span class="wk-day-n">${esc(TT_DAY_SHORT[dd.getDay()])}</span><span class="wk-day-d">${dd.getDate()}</span></div>`; }
  let times = ""; for (let h = minH; h < maxH; h++) times += `<div class="wk-hour" style="height:${rowH}px">${h}:00</div>`;
  let cols = "";
  for (let d = 0; d < nDays; d++) {
    const dayEvs = evs.filter((e) => (e.S.getDay() + 6) % 7 === d);
    layoutOverlaps(dayEvs);
    let blocks = "";
    dayEvs.forEach((e) => {
      const startMin = (e.S.getHours() - minH) * 60 + e.S.getMinutes();
      const dur = Math.max(30, (e.E - e.S) / 60000);
      const top = startMin / 60 * rowH, height = dur / 60 * rowH;
      const w = 100 / e._cols, left = e._col * w;
      const p = e.manual ? null : parseClassSummary(e.summary);
      const isNow = e.S.getTime() <= now && e.E.getTime() > now;
      blocks += `<button class="wk-ev${isNow ? " now" : ""}" data-ek="${esc(occKey(e))}" type="button" style="top:${top}px;height:${Math.max(height - 3, 22)}px;left:${left}%;width:calc(${w}% - 3px)">`
        + `<span class="wk-ev-t">${esc(hm(e.S))}</span><span class="wk-ev-n">${esc(p ? p.name : (e.summary || "Óra"))}</span>${e.location ? `<span class="wk-ev-r">${esc(e.location)}</span>` : ""}</button>`;
    });
    const dd = new Date(weekStart); dd.setDate(dd.getDate() + d);
    cols += `<div class="wk-col${sameDay(dd, today) ? " today" : ""}" style="height:${hours * rowH}px">${blocks}</div>`;
  }
  scroll.innerHTML = `<div class="controls">`
    + `<div class="wk-nav"><button class="wk-navbtn" id="wk-prev" type="button">${icon("back")}</button>`
    +   `<button class="wk-today" id="wk-today" type="button">${esc(wkLabel)}</button>`
    +   `<button class="wk-navbtn" id="wk-next" type="button">${icon("chev")}</button></div>`
    + viewBtn() + `</div>`
    + `<div class="wk-head"><div class="wk-head-corner"></div><div class="wk-head-days" style="grid-template-columns:repeat(${nDays},1fr)">${daysHead}</div></div>`
    + `<div class="wk-grid"><div class="wk-times">${times}</div>`
    + `<div class="wk-body" style="grid-template-columns:repeat(${nDays},1fr);background-image:repeating-linear-gradient(to bottom,var(--line) 0,var(--line) 1px,transparent 1px,transparent ${rowH}px)">${cols}</div></div>`;
  wireViewBtn(scroll);
  $("wk-prev").onclick = () => { const s = new Date(weekStart); s.setDate(s.getDate() - 7); ttWeekStart = s; renderTimetable(); };
  $("wk-next").onclick = () => { const s = new Date(weekStart); s.setDate(s.getDate() + 7); ttWeekStart = s; renderTimetable(); };
  $("wk-today").onclick = () => { ttWeekStart = mondayOf(new Date()); renderTimetable(); };
  scroll.querySelectorAll(".wk-ev").forEach((el) => el.onclick = () => { const e = evs.find((x) => occKey(x) === el.dataset.ek); if (e) openDetail(e, false); });
}
function renderTimetable() {
  if (ttView === "week") return renderTimetableWeek();
  renderAgenda($("tt-scroll"), $("tt-sub"), $("tt-refresh"), false, ttFilter, (k) => { ttFilter = k; renderTimetable(); }, viewBtn());
}
function renderExams() { renderAgenda($("ex-scroll"), $("ex-sub"), $("ex-refresh"), true, exFilter, (k) => { exFilter = k; renderExams(); }); }

// ----- courses: 3 segments — Aktuális (felvett) / Összes (mintatanterv) / Szabadon választható -----
let coFilter = null;
let coSeg = "aktualis"; // aktualis | osszes | szabad
const CO_SEGS = ["aktualis", "osszes", "szabad"];
const CO_SEG_LABEL = { aktualis: "Aktuális", osszes: "Összes", szabad: "Szabadon vál." };
let courseRowSeq = 0, courseRowMap = {}; // tap-target lookup: rows carry an id → the course object
function courseRow(c) {
  const rid = "cr" + (++courseRowSeq); courseRowMap[rid] = c;
  return `<button class="course-row" data-crid="${rid}" type="button">
    <span class="cr-check ${c.completed ? "on" : ""}">${c.completed ? icon("check") : ""}</span>
    <div class="cr-main"><div class="cr-name">${esc(c.name || c.code || "Tárgy")}</div><div class="cr-sub">${esc(c.code || "")}${c.teacher ? " · " + esc(c.teacher) : ""}${c.type ? " · " + esc(c.type) : ""}</div></div>
    <span class="cr-cr">${esc(String(c.credits || 0))} kr</span><span class="row-chev">${icon("chev")}</span></button>`;
}
function creditCard(done, total, doneN, totalN) {
  return `<div class="card cred"><div class="cred-row"><div><div class="cred-big">${done} / ${total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${doneN}/${totalN} tárgy</div></div><div class="cred-bar"><div class="cred-fill" style="width:${total ? Math.round(done / total * 100) : 0}%"></div></div></div>`;
}
function coEmpty(scroll, title, text, btnText, onRead) {
  scroll.insertAdjacentHTML("beforeend", `<div class="empty"><div class="empty-ic">${icon("book")}</div>
    <h2>${esc(title)}</h2><p>${esc(text)}</p>
    <button class="btn primary co-read" style="width:auto">${esc(btnText)}</button></div>`);
  const b = scroll.querySelector(".co-read"); if (b) b.onclick = onRead;
}
function renderCourses() {
  const scroll = $("co-scroll"); if (!scroll) return;
  recomputeCourseCompletion(); // keep enrolled-subject checkmarks in sync with the curriculum
  courseRowMap = {}; // fresh tap-target lookup for this render
  // segmented control (same look as the hub)
  let html = `<div class="seg seg-3" id="co-seg">` + CO_SEGS.map((s) => `<button class="seg-btn ${s === coSeg ? "active" : ""}" data-coseg="${s}" type="button">${CO_SEG_LABEL[s]}</button>`).join("") + `</div>`;
  scroll.innerHTML = html;
  scroll.querySelectorAll("#co-seg .seg-btn").forEach((b) => b.onclick = () => { coSeg = b.dataset.coseg; renderCourses(); });

  if (coSeg === "aktualis") renderCoAktualis(scroll);
  else renderCoCurriculum(scroll, coSeg === "szabad");
  scroll.querySelectorAll("[data-crid]").forEach((b) => b.onclick = () => { const c = courseRowMap[b.dataset.crid]; if (c) openSubject(c); });
}
// ----- subject detail page (general info: credit, term, requirement, prerequisites, description) -----
let subjectCtx = null, subjectData = null, subjectErr = false;
function openSubject(c) {
  subjectCtx = c; subjectData = null; subjectErr = false;
  pushScreen("tab-subject"); renderSubject();
  if (isNative && c && c.subjectId) loadSubject(c);
}
async function loadSubject(c) {
  try { subjectData = await apiSubjectDetail(c.subjectId, c.termId); if (!subjectData || !subjectData.detail) subjectErr = true; }
  catch (e) { subjectErr = true; }
  if (subjectCtx === c && document.querySelector(".tabscreen.active#tab-subject")) renderSubject();
}
function renderSubject() {
  const host = $("subject-scroll"); if (!host) return;
  const c = subjectCtx; if (!c) { host.innerHTML = ""; return; }
  const sub = $("subject-sub"); if (sub) sub.textContent = c.code || "Tárgy adatai";
  const d = (subjectData && subjectData.detail) || {};
  const loading = !subjectData && !subjectErr && isNative && c.subjectId;
  const rows = [];
  const req = d.requirementType || c.type;
  rows.push(["Kredit", String(d.credit != null ? d.credit : (c.credits || 0))]);
  if (req) rows.push(["Követelmény", req]);
  const recTerm = d.recommendedTerm || c.term;
  if (recTerm) rows.push(["Ajánlott félév", String(recTerm)]);
  if (d.signupType) rows.push(["Felvétel típusa", d.signupType]);
  if (d.ownerPrintName) rows.push(["Tárgyfelelős", d.ownerPrintName]);
  if (d.administrativeOrganization) rows.push(["Szervezet", d.administrativeOrganization]);
  if (d.classesPerWeek) rows.push(["Heti óraszám", String(d.classesPerWeek)]);
  if (d.classesPerTerm) rows.push(["Féléves óraszám", String(d.classesPerTerm)]);
  if (d.subjectResult) rows.push(["Eredmény", d.subjectResult]);
  else if (c.completed) rows.push(["Státusz", "Teljesítve"]);
  let h = `<div class="detail-subj" style="margin:2px 2px 4px">${esc(c.code || "")}</div><div class="sheet-title" style="margin:0 2px 14px">${esc(d.subjectName || c.name || "Tárgy")}</div>`;
  h += `<div class="card kv">` + rows.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`).join("") + `</div>`;
  if (loading) h += `<div class="dash-empty" style="padding:14px 2px">További adatok betöltése…</div>`;
  // Prerequisites
  const pre = (subjectData && subjectData.prereqs || []).map((p) => p && (p.subjectName || p.name || p.description)).filter(Boolean);
  if (d.preRequirement) pre.unshift(d.preRequirement);
  if (pre.length) h += `<div class="dash-label">Előkövetelmények</div><div class="card"><div class="card-pad">` + pre.map((p) => `<div class="req-row">${esc(p)}</div>`).join("") + `</div></div>`;
  if (d.finalRequirement) h += `<div class="dash-label">Számonkérés / követelmény</div><div class="card"><div class="card-pad msg-text">${sanitizeHtml(d.finalRequirement)}</div></div>`;
  const reqs = (subjectData && subjectData.reqs || []).filter((r) => r && r.description);
  if (reqs.length) h += `<div class="dash-label">Általános követelmények</div><div class="card"><div class="card-pad">` + reqs.map((r) => `<div class="req-row">${esc(r.description)}</div>`).join("") + `</div></div>`;
  if (d.description || d.note) h += `<div class="dash-label">Leírás</div><div class="card"><div class="card-pad msg-text">${sanitizeHtml(d.description || d.note)}</div></div>`;
  if (subjectErr && !subjectData) h += `<div class="hint center" style="margin-top:14px">A további tárgyadatok nem tölthetők be.</div>`;
  host.innerHTML = h;
}
function renderCoAktualis(scroll) {
  const list = (state.courses && state.courses.list) || [];
  if (!list.length) {
    $("co-sub").textContent = "Aktuális · nincs adat";
    coEmpty(scroll, "Felvett tárgyak", "Olvasd be a felvett tárgyaidat a Neptunból: kredit, teljesítés, félév.", "Tárgyak beolvasása", scrapeCourses);
    return;
  }
  const sems = allSemesters();
  if (coFilter === null) { coFilter = currentSemesterKey(); if (!list.some((c) => c.semester === coFilter)) coFilter = "all"; }
  const items = coFilter === "all" ? list : list.filter((c) => c.semester === coFilter);
  const totalCr = items.reduce((s, c) => s + (+c.credits || 0), 0);
  const doneCr = items.filter((c) => c.completed).reduce((s, c) => s + (+c.credits || 0), 0);
  $("co-sub").textContent = "Aktuális · " + items.length + " tárgy";
  let html = `<div class="controls"><button class="period-btn" type="button"><span>${coFilter === "all" ? "Összes félév" : esc(coFilter)}</span>${icon("down")}</button></div>`;
  html += `<div class="tt-updated" style="margin:2px 4px 12px">Frissítve: ${state.courses && state.courses.fetchedAt ? fmtWhen(state.courses.fetchedAt) : "még soha"}</div>`;
  html += creditCard(doneCr, totalCr, items.filter((c) => c.completed).length, items.length);
  items.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "hu")).forEach((c) => { html += courseRow(c); });
  scroll.insertAdjacentHTML("beforeend", html);
  const pb = scroll.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: coFilter, items: [{ value: "all", label: "Összes félév" }].concat(sems.map((s) => ({ value: s.key, label: s.key }))), onPick: (v) => { coFilter = v; renderCourses(); } });
}
function renderCoCurriculum(scroll, freeOnly) {
  const cur = state.curriculum;
  const list = cur ? (freeOnly ? (cur.free || []) : (cur.required || [])) : [];
  if (!hasCurriculum()) {
    $("co-sub").textContent = (freeOnly ? "Szabadon választható" : "Összes") + " · nincs adat";
    coEmpty(scroll, freeOnly ? "Szabadon választható" : "Összes tárgy",
      "Olvasd be a képzésed mintatantervét a Neptunból (Tanulmányok → Előrehaladás → Hierarchikus mintatanterv).",
      "Mintatanterv beolvasása", scrapeCurriculum);
    return;
  }
  const totalCr = list.reduce((s, c) => s + (+c.credits || 0), 0);
  const doneCr = list.filter((c) => c.completed).reduce((s, c) => s + (+c.credits || 0), 0);
  $("co-sub").textContent = (freeOnly ? "Szabadon választható" : "Összes") + " · " + list.length + " tárgy";
  let html = "";
  if (cur.program) html += `<div class="co-program">${icon("building")} ${esc(cur.program)}</div>`;
  html += `<div class="tt-updated" style="margin:2px 4px 12px">Frissítve: ${cur.fetchedAt ? fmtWhen(cur.fetchedAt) : "még soha"}</div>`;
  if (!list.length) { html += `<div class="hint center" style="margin-top:20px">Ebben a csoportban nincs beolvasott tárgy.</div>`; scroll.insertAdjacentHTML("beforeend", html); return; }
  html += creditCard(doneCr, totalCr, list.filter((c) => c.completed).length, list.length);
  list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "hu")).forEach((c) => { html += courseRow(c); });
  scroll.insertAdjacentHTML("beforeend", html);
}
$("co-refresh").onclick = () => { if (coSeg === "aktualis") scrapeCourses(); else scrapeCurriculum(); };
let courseLog = [];
function dbg(m) { courseLog.push(m); $("busy-text").textContent = m; }
async function scrapeCourses() {
  if (!isNative) { toast("A tárgyak beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let ok = false, rawOut = "", cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) {
      $("busy-text").textContent = "Felvett tárgyak lekérése…";
      try {
        const terms = await apiReadTerms(sess);
        if (terms && terms.length) {
          state.semesters = { fetchedAt: new Date().toISOString(), list: terms.map((t) => t.label), terms };
          const list = await apiReadTakenAll(sess, terms);
          if (list && list.length) {
            state.courses = { fetchedAt: new Date().toISOString(), list, semesters: [...new Set(list.map((c) => c.semester))] };
            saveState(); syncSemStatus(); renderCourses(); renderTimetable(); ok = true; viaApi = true;
          }
        }
      } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); }
    }
    // Fallback: DOM scraping.
    if (!ok) {
      $("busy-text").textContent = "Beolvasás…";
      const res = await neptunReadCourses(); // { courses, semesters, semester, raw }
      rawOut = (res && res.raw) || "";
      if (res && res.courses && res.courses.length) {
        state.courses = { fetchedAt: new Date().toISOString(), list: res.courses, semesters: res.semesters || [] };
        coFilter = res.semester || null;
        saveState(); renderCourses(); renderTimetable(); ok = true;
        dbg("Siker: " + res.courses.length + " tárgy");
      } else { dbg("Az oldal betöltött, de 0 tárgyat ismertem fel."); }
    }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (ok) { toast(state.courses.list.length + " tárgy beolvasva" + (viaApi ? " (API)" : "") + "."); return; }
  // failure: copy raw to clipboard and show the debug log so it can be shared
  try { if (rawOut) await navigator.clipboard.writeText(rawOut); } catch (e) { /* ignore */ }
  await ask({ title: "Beolvasás napló", okText: "OK",
    body: courseLog.map((l) => esc(l)).join("<br>") + (rawOut ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
// Shared runner: open a (debug-visible) InAppBrowser, inject an in-page routine on each
// load, and poll `window.<gvar>` for a {done:true,...} result while surfacing its live log.
let flowActive = false; // only one Neptun InAppBrowser flow at a time
function runNeptunFlow(buildScript, gvar, onPartial) {
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
          if (o.v) { let res; try { res = JSON.parse(o.v); } catch (e) { return; }
            if (res && res.done) { if (res.log) courseLog = res.log.split("\n"); finish(null, res); }
            else if (res && onPartial) { try { onPartial(res); } catch (_) {} } }
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
  let sems = [], terms = null, cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) { $("busy-text").textContent = "Félévek lekérése…"; try { terms = await apiReadTerms(sess); if (terms && terms.length) { sems = terms.map((t) => t.label); viaApi = true; } } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); } }
    // Fallback: DOM scraping.
    if (!sems.length) { const res = await neptunReadSemesters(); if (res && res.log) courseLog = res.log.split("\n"); sems = (res && res.sems) || []; }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (sems.length) {
    state.semesters = terms ? { fetchedAt: new Date().toISOString(), list: sems, terms } : { fetchedAt: new Date().toISOString(), list: sems };
    saveState(); syncSemStatus(); renderTimetable(); renderExams(); renderCourses();
    toast(sems.length + " félév beolvasva" + (viaApi ? " (API)" : "") + "."); return;
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
// =====================================================================
//  DIRECT NEPTUN API (native HTTP) — reliable reads, no DOM scraping.
//  Endpoints are constants of the Neptun (SDA) software, shared across
//  institutions; only the base URL differs. Log in once via the browser to
//  grab the session token, then read via CapacitorHttp (bypasses CORS).
// =====================================================================
function CHTTP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp; }
let apiSession = null; // { base, token, at, exp }
// Read the JWT `exp` claim (ms epoch). 0 if not a parseable JWT.
function tokenExp(tok) {
  try { const p = JSON.parse(atob(String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return p && p.exp ? p.exp * 1000 : 0; }
  catch (e) { return 0; }
}
// A cached session is usable if the token is not within `marginMs` of expiring.
// Falls back to a 4-minute window from grab time when the token has no readable exp.
function apiSessionValid(marginMs) {
  if (!apiSession || !apiSession.token) return false;
  const m = marginMs == null ? 30000 : marginMs;
  return apiSession.exp ? (Date.now() < apiSession.exp - m) : ((Date.now() - apiSession.at) < 4 * 60 * 1000);
}
// Pull the immutable Neptun code out of the JWT. The login name can be customised (up to 255 chars),
// so it's not a stable identity — the code is. ponytail: claim name isn't confirmed, so match the
// classic 6-char Neptun-code shape conservatively (prefer a code-ish claim key); returns "" if unsure,
// and nothing is shown. Confirm the exact claim via API diagnostics if a real account comes back blank.
function tokenNeptunCode(tok) {
  try {
    const p = JSON.parse(atob(String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const is6 = (v) => /^[A-Za-z0-9]{6}$/.test(String(v));
    const keys = Object.keys(p);
    const named = keys.find((k) => /neptun|code|kod|login|nnr/i.test(k) && is6(p[k]));
    const k = named || keys.find((x) => is6(p[x]));
    return k ? String(p[k]).toUpperCase() : "";
  } catch (e) { return ""; }
}
// The Neptun API base for a server: `<origin>/hallgato/api/`. Prefer a base already captured from a
// real browser session (stable across token refreshes); else derive it from the server login URL.
function apiBaseFor(srv) {
  if (apiSession && apiSession.base) return apiSession.base;
  try { const u = new URL((srv && srv.url) || ""); const m = u.pathname.match(/^(.*?\/hallgato)(\/|$)/i); return u.origin + (m ? m[1] : "/hallgato") + "/api/"; }
  catch (e) { return ""; }
}
// Silent, direct (no browser) re-auth: POST Account/Authenticate via native HTTP — the response body
// carries the access token, so we get a fresh token instantly without opening the InAppBrowser.
// Returns { base, token, code } or null. This is the fast path that keeps a token always ready.
async function apiAuthenticate() {
  if (!isNative || !state.username || !state.password) return null;
  const CH = CHTTP(); if (!CH) return null;
  const base = apiBaseFor(activeServer()); if (!base) return null;
  await totpTick();
  const body = { userName: state.username, password: state.password, captcha: "", captchaIdentifier: "", token: state.no2fa ? "" : lastCode, LCID: 1038 };
  try {
    const res = await CH.post({ url: base + "Account/Authenticate", headers: { "Content-Type": "application/json", Accept: "application/json" }, data: body });
    if (!res || res.status < 200 || res.status >= 300) return null;
    let d = res.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    const tok = d && (d.accessToken || (d.data && d.data.accessToken));
    if (!tok) return null;
    return { base, token: tok, code: tokenNeptunCode(tok) };
  } catch (e) { return null; }
}
// Grab { token, base } by logging in (browser) and reading sessionStorage.access_token.
function neptunGetSession() { return runNeptunFlow(buildTokenGrabScript, "__tok"); }
function buildTokenGrabScript(username, password, code) {
  return `(function(){
  if(window.__tokRunning) return "running"; window.__tokRunning=true; window.__tok=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(o){ o=o||{}; try{ window.__tok=JSON.stringify(Object.assign({done:true,log:LOG.slice(-20).join("\\n")},o)); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({token:o.token||"",base:o.base||"",code:o.code||"",log:LOG.slice(-12).join("\\n")})); }catch(e){} }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  // Find the immutable Neptun code from the logged-in page: JWT claims first, then a scan of
  // session/localStorage (the SDA app stashes user data there). Returns "" if nothing code-shaped.
  function findCode(tok){
    try{ var b=tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); var p=JSON.parse(decodeURIComponent(escape(atob(b))));
      var prefer=['neptunCode','NeptunCode','neptun_code','NeptunKod','code','Login','login','preferred_username','unique_name','nameid','sub','name'];
      for(var i=0;i<prefer.length;i++){ var v=p[prefer[i]]; if(v && /^[A-Za-z0-9]{6}$/.test(String(v))) return String(v).toUpperCase(); }
      for(var k in p){ if(/^[A-Za-z0-9]{6}$/.test(String(p[k]))) return String(p[k]).toUpperCase(); }
    }catch(e){}
    try{ var stores=[window.sessionStorage,window.localStorage];
      for(var s=0;s<stores.length;s++){ var st=stores[s]; for(var j=0;j<st.length;j++){ var kk=st.key(j)||''; var val=st.getItem(kk)||'';
        if(/neptun|code|kod|login/i.test(kk) && /^[A-Za-z0-9]{6}$/.test(val)) return val.toUpperCase();
        if(val.length<8000){ var m=val.match(/"(?:neptunCode|NeptunCode|neptun_code|NeptunKod|code|login)"\\s*:\\s*"([A-Za-z0-9]{6})"/i); if(m) return m[1].toUpperCase(); }
      }}
    }catch(e){}
    return "";
  }
  (async function(){
    try{
      log("Bejelentkezés…");
      var tok=await waitFor(function(){ try{ return window.sessionStorage.getItem('access_token'); }catch(e){ return null; } }, 60000);
      var base=""; try{ base=new URL('api/', document.baseURI).href; }catch(e){ base=location.origin+'/hallgato/api/'; }
      log(tok?("Token megvan ("+tok.length+" kar.)"):"Nincs token a sessionStorage-ban");
      var nc=tok?findCode(tok):""; log(nc?("Neptun kód: "+nc):"Neptun kód nem található");
      deliver({token:tok||"", base:base, code:nc});
    }catch(err){ log("HIBA: "+String(err)); deliver({}); }
  })();
  return "started";
})();`;
}
let sessionInFlight = null; // coalesce concurrent token fetches so callers share one IAB flow
async function getApiSession(force) {
  if (!force && apiSessionValid()) return apiSession;
  if (sessionInFlight) return sessionInFlight; // a fetch is already running → await the same one
  sessionInFlight = (async () => {
    let res = null;
    // Fast path: silent direct HTTP auth (no browser). Fall back to the InAppBrowser grab only if it fails.
    try { res = await apiAuthenticate(); } catch (e) { res = null; }
    if (!(res && res.token)) { try { res = await neptunGetSession(); } catch (e) { return null; } }
    if (res && res.token) {
      apiSession = { base: res.base || "", token: res.token, at: Date.now(), exp: tokenExp(res.token) };
      const nc = (res.code && /^[A-Za-z0-9]{6}$/.test(res.code)) ? res.code.toUpperCase() : tokenNeptunCode(res.token);
      if (nc && nc !== state.neptunCode) { state.neptunCode = nc; saveState(); }
      onSessionChanged(); return apiSession;
    }
    return null;
  })();
  try { return await sessionInFlight; } finally { sessionInFlight = null; }
}
// ---------- keep a warm Neptun session (no manual re-login) ----------
// We hold the credentials + TOTP secret, so instead of fighting the OS to keep a token alive in the
// background, we silently (re-)authenticate on demand: at app start, on resume, and on profile switch.
// A fresh token then makes both data reads and the visible "Bejelentkezés" instant.
let warming = false, lastWarmAt = 0;
function onSessionChanged() {
  try {
    renderHome();
    const act = document.querySelector(".tabscreen.active");
    if (act && act.id === "tab-more") renderMore();
  } catch (e) {}
}
async function warmSession(reason) {
  if (!isNative || !canAutoLogin()) return;      // nothing to log in with
  if (apiSessionValid(60000)) { onSessionChanged(); return; } // already comfortably valid
  if (warming || flowActive) return;             // don't stack onto a running flow
  if (Date.now() - lastWarmAt < 45000) return;   // throttle repeated resume events
  warming = true; lastWarmAt = Date.now();
  try { renderHome(); } catch (e) {}             // show the "Munkamenet előkészítése…" loading state
  if (reason === "resume") toast("Munkamenet frissítése…", 1800); // visible on any tab, not just Home
  try { await totpTick(); await getApiSession(true); }
  catch (e) { dbg("warmSession: " + (e && e.message ? e.message : e)); }
  finally { warming = false; }
}
// Proactive keep-alive: silently re-auth (fast direct HTTP) ~90s before the token expires, so a token
// is always ready and refreshes never wait on a login. Cheap (a single POST), skips when a browser
// flow is running. Runs while the app is foregrounded; resume re-warms after any background throttle.
async function keepAlive() {
  if (!isNative || !canAutoLogin()) return;
  if (warming || flowActive) return;             // don't collide with an IAB flow
  if (apiSessionValid(90000)) return;            // still comfortably valid (>90s left)
  try { await getApiSession(true); } catch (e) { /* try again next tick */ }
}
setInterval(keepAlive, 30000);
// Full silent refresh of every data topic. Runs on cold start so the app opens fresh without the user
// having to pull-to-refresh anything. Non-blocking (no modal, no result dialog) — re-renders as each
// topic lands, and shows "Adatok frissítése…" in the Home subtitle while it works.
let autoRefreshing = false;
async function autoRefreshAll(reason) {
  if (!isNative || !state.setupComplete || !canAutoLogin()) return;
  if (autoRefreshing || flowActive) return;
  autoRefreshing = true; try { renderHome(); } catch (e) {}
  try {
    const sess = await getApiSession(); if (!sess) return; // no token → nothing to read
    for (const t of DATA_TASKS) {
      try { await totpTick(); await t.run(); } catch (e) { dbg("autoRefresh " + t.id + ": " + (e && e.message ? e.message : e)); }
      try { renderHome(); } catch (e) {}
    }
    try { refreshAgendas(); } catch (e) {}
  } finally { autoRefreshing = false; try { renderHome(); } catch (e) {} }
}
// GET a Neptun API endpoint (native HTTP → no CORS). Returns { status, data } with data parsed.
// Pass query params via `params` (object) — CapacitorHttp doesn't reliably forward a query
// string embedded in the URL, so let it build the query itself.
async function apiGet(sess, ep, params) {
  const url = (sess.base || "") + ep;
  const headers = sess.token ? { Authorization: "Bearer " + sess.token } : {};
  const CH = CHTTP();
  if (CH) {
    const opts = { url, headers };
    if (params) { opts.params = {}; Object.keys(params).forEach((k) => { opts.params[k] = String(params[k]); }); }
    const res = await CH.get(opts);
    let data = res && res.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { /* leave string */ } }
    return { status: res ? res.status : 0, data };
  }
  let u = url;
  if (params) { const qs = Object.keys(params).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&"); u += (u.indexOf("?") < 0 ? "?" : "&") + qs; }
  const r = await fetch(u, { headers, credentials: "include" });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function apiPost(sess, ep, bodyObj) {
  const url = (sess.base || "") + ep;
  const headers = { "Content-Type": "application/json" };
  if (sess.token) headers.Authorization = "Bearer " + sess.token;
  const CH = CHTTP();
  if (CH) {
    const res = await CH.post({ url, headers, data: bodyObj || {} });
    let data = res && res.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { /* leave */ } }
    return { status: res ? res.status : 0, data };
  }
  const r = await fetch(url, { method: "POST", headers, credentials: "include", body: JSON.stringify(bodyObj || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
// Read the whole curriculum via API: program + all subjects (recursing subject groups) + the
// completed free electives. Returns { program, required:[...], free:[...] } or null.
async function apiReadCurriculum(sess) {
  const tpl = await apiGet(sess, "Advancement/GetStudentCurriculumTemplates");
  const row = tpl && tpl.data && tpl.data.data && tpl.data.data[0];
  if (!row || !row.advancementRowId) return null;
  const program = row.curriculumTemplateName || "";
  const required = [], seen = {};
  async function walk(parentRowId, depth) {
    if (!parentRowId || depth > 6) return;
    const r = await apiGet(sess, "Curriculum/GetCurriculumSubjectGroupAndSubjectsData", { parentAdvancementRowId: parentRowId });
    const dd = r && r.data && r.data.data; if (!dd) return;
    (dd.mandatorySubjects || []).forEach((s) => {
      const key = s.code || s.subjectId; if (key && seen[key]) return; if (key) seen[key] = 1;
      const st = s.curriculumStatuses || {};
      required.push({ code: s.code || "", name: s.name || "", credits: parseInt(s.credit, 10) || 0, completed: !!st.isSuccessful, type: s.requirementType || "", term: s.recommendedTerm || 0, subjectId: s.subjectId || "" });
    });
    for (const g of (dd.subjectGroups || [])) { const gid = g.advancementRowId || g.parentAdvancementRowId || g.childAdvancementRowId; if (gid) await walk(gid, depth + 1); }
  }
  await walk(row.advancementRowId, 0);
  let free = [];
  try {
    const o = await apiGet(sess, "Curriculum/GetOptionalSubjectsWithoutCurriculum", { advancementRowId: row.advancementRowId });
    const list = o && o.data && o.data.data;
    if (Array.isArray(list)) free = list.map((x) => ({ code: x.subjectCode || "", name: x.subjectName || "", credits: (+x.credit) || 0, completed: true, type: x.subjectRequirement || "", subjectId: x.subjectId || "" }));
  } catch (e) { /* free electives optional */ }
  return { program, required, free };
}
// Terms/semesters via API → [{id, label}] newest-first (as Neptun returns).
async function apiReadTerms(sess) {
  const r = await apiGet(sess, "RegistrySheet/GetStudentTrainingTerms");
  const list = r && r.data && r.data.data;
  if (!Array.isArray(list)) return null;
  return list.map((t) => ({ id: t.value, label: t.text })).filter((t) => t.id && t.label);
}
// Enrolled ("felvett") subjects across the given terms → flat course list with semester labels.
// Completion is filled in later by recomputeCourseCompletion() (needs the curriculum).
async function apiReadTakenAll(sess, terms) {
  const out = [];
  for (const t of terms) {
    let r; try { r = await apiGet(sess, "TakenSubjects/GetTakenSubjects", { termId: t.id }); } catch (e) { continue; }
    const arr = r && r.data && r.data.data; if (!Array.isArray(arr)) continue;
    arr.forEach((s) => { out.push({ code: s.subjectCode || "", name: s.subjectName || "", credits: +s.subjectCredit || 0, completed: false, semester: t.label, teacher: "", type: s.requirementType || "", subjectId: s.subjectId || "", termId: t.id }); });
  }
  return out;
}
// Mark enrolled subjects completed using the curriculum (required isSuccessful + all free electives,
// which the API only lists when completed). If a subject was taken in several terms, mark only the
// LATEST one — an earlier attempt was most likely a fail. Runs whenever courses or curriculum changes.
function recomputeCourseCompletion() {
  if (!state.courses || !state.courses.list || !state.courses.list.length || !state.curriculum) return;
  const completed = {};
  (state.curriculum.required || []).forEach((c) => { if (c.completed && c.code) completed[c.code] = 1; });
  (state.curriculum.free || []).forEach((c) => { if (c.code) completed[c.code] = 1; });
  const byCode = {}, target = new Map();
  state.courses.list.forEach((c) => { target.set(c, false); (byCode[c.code] = byCode[c.code] || []).push(c); });
  Object.keys(byCode).forEach((code) => {
    if (!code || !completed[code]) return;
    const entries = byCode[code].slice().sort((a, b) => (a.semester > b.semester ? 1 : a.semester < b.semester ? -1 : 0));
    target.set(entries[entries.length - 1], true); // latest semester it appears in
  });
  let changed = false;
  state.courses.list.forEach((c) => { const t = target.get(c); if (!!c.completed !== t) { c.completed = t; changed = true; } });
  if (changed) saveState();
}
// iCal subscription link via API (replaces the calendar page scrape).
async function apiReadIcsUrl(sess) {
  const r = await apiGet(sess, "Calendar/GetLinksForCalendarExport");
  const d = r && r.data && r.data.data;
  const u = d && (d.urlForWebCalendars || d.url);
  return u ? u.replace(/^webcal:\/\//i, "https://") : "";
}

let grabbingProgress = false;
async function grabProgress() {
  if (!isNative) { toast("A kredit beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (grabbingProgress) return; // silently ignore a second trigger (e.g. double pull-to-refresh)
  grabbingProgress = true;
  try { await grabProgressInner(); } finally { grabbingProgress = false; }
}
async function grabProgressInner() {
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let prog = null, cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) {
      $("busy-text").textContent = "Kredit lekérése…";
      try {
        const r = await apiGet(sess, "advancement/creditprogress");
        const d = r && r.data && r.data.data;
        if (d && (d.requiredCredit || d.completedCredit)) {
          prog = { done: d.completedCredit || 0, total: d.requiredCredit || 0, free: d.completedOptionalSubjectCredit || 0 };
          viaApi = true;
        } else { dbg("API válasz nem tartalmazott kredit adatot (status " + (r && r.status) + ")"); }
      } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); }
    } else { dbg("Nem sikerült token — visszaesés a régi módszerre"); }
    // Fallback: DOM scraping.
    if (!prog) {
      $("busy-text").textContent = "Beolvasás…";
      const res = await neptunReadProgress();
      if (res && res.log) courseLog = res.log.split("\n");
      const p = (res && res.progress) || null;
      if (p && p.total) prog = { done: p.done, total: p.total, free: p.free || 0 };
    }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (prog && prog.total) {
    state.progress = { fetchedAt: new Date().toISOString(), done: prog.done, total: prog.total, free: prog.free || 0 };
    saveState(); syncProgStatus(); renderHome();
    { const act = document.querySelector(".tabscreen.active"); if (act && act.id === "tab-credit") renderCreditPage(); else if (act && act.id === "tab-more") renderMore(); }
    toast("Kredit beolvasva: " + prog.done + "/" + prog.total + (viaApi ? " (API)" : "")); return;
  }
  await ask({ title: "Kredit lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") });
}
// Read the curriculum (Hierarchikus mintatanterv): login → Menü → Tanulmányok → Előrehaladás →
// switch to the hierarchy view → read program name, expand the groups, parse the subject cards.
// Returns { program, required:[...], free:[...] } — "Szabadon választható" cards go to `free`.
function neptunReadCurriculum() { return runNeptunFlow(buildCurriculumScript, "__curr"); }
function buildCurriculumScript(username, password, code) {
  return `(function(){
  if(window.__currRunning) return "running"; window.__currRunning=true; window.__curr=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  // Deliver via the polling channel only (window.__curr) so the large raw HTML survives; the
  // sentinel-URL channel can't carry it, and would otherwise win the race with a raw-less payload.
  function deliver(o){ o=o||{}; try{ window.__curr=JSON.stringify(Object.assign({done:true,log:LOG.join("\\n")},o)); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,220); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button],[role=tab]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  var CODE=/\\b[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]{1,}\\b/;
  function findProgram(){
    // Preferred: the hierarchy card title (Angular: advancement-hierarchy-curriculum-card__header__data__title).
    var h=document.querySelector('.advancement-hierarchy-curriculum-card__header__data__title'); if(h && (h.innerText||'').trim()) return (h.innerText||'').trim();
    var best=""; nodes().forEach(function(el){ if(!vis(el)||el.children.length>2) return; var t=(el.textContent||'').trim();
      if(t.length<6||t.length>70) return;
      if(/\\b(BA|BSc|BProf|MA|MSc|osztatlan|szakir[aá]ny)\\b/i.test(t) && /\\d{4}/.test(t) && !/kredit|teljes/i.test(t)){ if(t.length>best.length) best=t; } });
    return best;
  }
  // Group expanders: the blue chevron buttons that open a curriculum group (id like "curriculum-1-toggle-header-btn").
  function groupToggles(){ return Array.prototype.slice.call(document.querySelectorAll('button[id*="toggle-header-btn"]')).filter(vis); }
  function collapsedToggles(){ return groupToggles().filter(function(b){ return b.getAttribute('aria-expanded')==='false'; }); }
  function spinning(){ return !!document.querySelector('.spinner, .loading-placeholder-wrapper'); }
  // The subject cards render (lazy) inside the opened group content. A card carries a code + "kredit".
  function groupTitleFor(el){ var g=el; for(var k=0;k<12&&g;k++){ g=g.parentElement; if(g&&g.classList&&g.classList.contains('advancement-hierarchy-curriculum-card')){ var tt=g.querySelector('.advancement-hierarchy-curriculum-card__header__data__title'); return tt?(tt.innerText||''):''; } } return ''; }
  function parseCards(){
    var out=[]; var seen={};
    var leaves=Array.prototype.slice.call(document.querySelectorAll('div,span,p,li,td,a')).filter(function(el){ return el.children.length===0 && CODE.test((el.textContent||'').trim()); });
    leaves.forEach(function(le){
      var codeM=(le.textContent||'').match(CODE); if(!codeM) return; var codev=codeM[0];
      var card=le; for(var k=0;k<9&&card.parentElement;k++){ card=card.parentElement; var rt=(card.innerText||''); if(/kredit/i.test(rt)&&rt.split('\\n').filter(Boolean).length>=2 && rt.length<500) break; }
      var txt=(card.innerText||''); if(!/kredit/i.test(txt)) return; var key=codev; if(seen[key]) return; seen[key]=1;
      var lines=txt.split('\\n').map(function(s){return s.trim();}).filter(Boolean);
      // name = the longest line that is not the code, not the meta (bullet-separated) line, not a lone status/credit.
      var name=''; lines.forEach(function(l){ if(l===codev) return; if(l.indexOf('•')>=0||l.indexOf('·')>=0) return; if(/^\\d+\\s*kredit/i.test(l)) return; if(/^(r[eé]szletek|t[uú]lteljes[ií]tett|teljes[ií]tett|nem teljes[ií]tett|folyamatban|akt[ií]v|hi[aá]nyz)/i.test(l)) return; if(l.length>name.length) name=l; });
      if(!name) name=lines[0]||codev;
      var crM=txt.match(/(\\d+)\\s*kredit/i); var credits=crM?parseInt(crM[1],10):0;
      var gt=groupTitleFor(le);
      var free=/szabadon\\s*v[aá]laszthat/i.test(txt) || /szabadon\\s*v[aá]laszthat/i.test(gt);
      var type=''; var tm=txt.match(/(folyamatos sz[aá]monk[eé]r[eé]s|vizsga|gyakorlati jegy|koll[oó]kvium|al[aá][ií]r[aá]s|beugr[oó])/i); if(tm) type=tm[1];
      var completed=(/t[uú]lteljes[ií]tett/i.test(txt) || /teljes[ií]tve/i.test(txt) || (/teljes[ií]tett/i.test(txt) && !/nem teljes[ií]tett/i.test(txt)));
      out.push({code:codev,name:name,credits:credits,type:type,completed:completed,free:free});
    });
    return out;
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver({}); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(150);}
      log("Tanulmányok"); var t=await waitFor(function(){return pick("Tanulmányok");},8000); if(t){ t.click(); await sleep(150);}
      log("Előrehaladás"); var e=await waitFor(function(){return pick("Előrehaladás");},8000); if(e){ e.click(); }
      await waitFor(function(){ return /El[oő]rehalad[aá]s/i.test(T()); }, 12000); await sleep(700);
      // Switch to the "Hierarchikus mintatanterv" view tab.
      var tab=Array.prototype.slice.call(document.querySelectorAll('button.tab-group__button,[role=tab],button')).filter(function(b){ return vis(b) && /Hierarchikus mintatanterv/i.test(b.textContent||''); })[0];
      if(tab){ log("Hierarchikus nézet"); try{ tab.click(); }catch(_){} await sleep(800); }
      await waitFor(function(){ return document.querySelector('.advancement-hierarchy-curriculum-card'); }, 10000);
      var program=findProgram(); log("Képzés: "+(program||"—"));
      // Expand every group; content loads lazily (spinner), and new groups appear as we scroll.
      log("Csoportok kinyitása…");
      for(var pass=0; pass<10; pass++){
        try{ window.scrollTo(0, document.body.scrollHeight); }catch(_){} await sleep(350);
        var togs=collapsedToggles(); if(!togs.length) break;
        for(var i=0;i<togs.length;i++){ try{ togs[i].scrollIntoView({block:'center'}); }catch(_){} try{ togs[i].click(); }catch(_){}
          await waitFor(function(){ return !spinning(); }, 9000); await sleep(450); }
      }
      log("Nyitott csoportok: "+groupToggles().filter(function(b){return b.getAttribute('aria-expanded')==='true';}).length+"/"+groupToggles().length);
      try{ window.scrollTo(0,0); }catch(_){}
      await sleep(500);
      var cards=await waitFor(function(){ var c=parseCards(); return c.length?c:null; }, 10000) || parseCards();
      var required=[],free=[]; cards.forEach(function(c){ (c.free?free:required).push({code:c.code,name:c.name,credits:c.credits,type:c.type,completed:c.completed}); });
      log("Tárgyak: "+required.length+" összes/kötelező, "+free.length+" szabadon választható");
      deliver({program:program, required:required, free:free, raw:(document.querySelector('main')||document.body).outerHTML.slice(0,120000)});
    }catch(err){ log("HIBA: "+String(err)); deliver({raw:(document.querySelector('main')||document.body).outerHTML.slice(0,120000)}); }
  })();
  return "started";
})();`;
}
function hasCurriculum() { return !!(state.curriculum && ((state.curriculum.required && state.curriculum.required.length) || (state.curriculum.free && state.curriculum.free.length))); }
async function scrapeCurriculum() {
  if (!isNative) { toast("A mintatanterv beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let ok = false, rawOut = "", cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) {
      $("busy-text").textContent = "Mintatanterv lekérése…";
      try {
        const cur = await apiReadCurriculum(sess);
        if (cur && (cur.required.length || cur.free.length)) {
          state.curriculum = { fetchedAt: new Date().toISOString(), program: cur.program || "", required: cur.required, free: cur.free };
          saveState(); renderCourses(); ok = true; viaApi = true;
        }
      } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); }
    }
    // Fallback: DOM scraping.
    if (!ok) {
      $("busy-text").textContent = "Beolvasás…";
      const res = await neptunReadCurriculum();
      rawOut = (res && res.raw) || "";
      if (res && res.log) courseLog = res.log.split("\n");
      const req = (res && res.required) || [], fr = (res && res.free) || [];
      if (req.length || fr.length) {
        state.curriculum = { fetchedAt: new Date().toISOString(), program: (res && res.program) || "", required: req, free: fr };
        saveState(); renderCourses(); ok = true; dbg("Siker: " + (req.length + fr.length) + " tárgy");
      } else { dbg("Betöltött, de 0 tárgyat ismertem fel a mintatantervben."); }
    }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (ok) { toast((state.curriculum.required.length + state.curriculum.free.length) + " tárgy beolvasva" + (viaApi ? " (API)" : "") + "."); return; }
  try { if (rawOut) await navigator.clipboard.writeText(rawOut); } catch (e) { /* ignore */ }
  await ask({ title: "Mintatanterv napló", okText: "OK",
    body: courseLog.map((l) => esc(l)).join("<br>") + (rawOut ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
// ---- API diagnostics: hook fetch/XHR in the logged-in webview, visit the study pages,
// and report the JSON API calls Neptun makes (auth values redacted) so we can call them directly. ----
function neptunSniffApi(onPartial) { return runNeptunFlow(buildApiSniffScript, "__apidiag", onPartial); }
function buildApiSniffScript(username, password, code) {
  return `(function(){
  if(window.__apidiagRunning) return "running"; window.__apidiagRunning=true; window.__apidiag=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  // Keep the payload small enough for the InAppBrowser executeScript bridge to return in one shot.
  function deliver(o){ o=o||{};
    function build(obj){ try{ return JSON.stringify(Object.assign({done:true,log:LOG.slice(-40).join("\\n")},obj)); }catch(e){ return ""; } }
    var LIM=35000, s=build(o);
    // Secondary data first: drop the captured-call response samples, then storage.
    if(s.length>LIM && o.calls){ o.calls.forEach(function(c){ c.resp=''; }); s=build(o); }
    if(s.length>LIM){ o.storage=[]; s=build(o); }
    // Then, if still too big, trim the direct-fetch bodies (the primary payload) progressively.
    if(s.length>LIM && o.direct){ o.direct.forEach(function(d){ if(d.body) d.body=d.body.slice(0,2000); }); s=build(o); }
    if(s.length>LIM && o.direct){ o.direct.forEach(function(d){ if(d.body) d.body=d.body.slice(0,1000); }); s=build(o); }
    if(!s) s=JSON.stringify({done:true,error:"serialize",log:LOG.slice(-20).join("\\n")});
    window.__apidiag=s; }
  // Progressive snapshot (done:false) — surfaced to the native side via onPartial so each captured
  // finance call is written to file immediately; a later hang then can't lose what already came in.
  function snap(){ try{ var o={done:false,log:LOG.slice(-40).join("\\n"),calls:collect(),storage:tokenKeys()};
    var s=JSON.stringify(o); if(s.length>35000){ o.calls.forEach(function(c){ c.resp=''; }); s=JSON.stringify(o); } if(s.length>35000){ o.storage=[]; s=JSON.stringify(o); } window.__apidiag=s; }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,220); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button],[role=tab]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  // ---- install the network hook once, as early as possible ----
  function redact(v){ v=String(v||''); if(v.length<=10) return '['+v.length+' kar.]'; return v.slice(0,10)+'…['+v.length+' kar.]'; }
  // Never capture a request body that carries credentials (login, or anything with a password field).
  function redactBody(url,b){ if(!b) return ''; b=String(b); if(/authenticate|login|password|jelsz/i.test(url||'') || /password|jelsz/i.test(b)) return '[kitakarva]'; return b.slice(0,500); }
  function redH(h){ var o={}; try{ if(h&&h.forEach){ h.forEach(function(v,k){ if(/^authorization$/i.test(k)){ window.__bearer=v; if(window.__maybeStart)window.__maybeStart(); } o[k]=/authorization|cookie|token/i.test(k)?redact(v):v; }); } else if(h&&typeof h==='object'){ Object.keys(h).forEach(function(k){ if(/^authorization$/i.test(k)){ window.__bearer=h[k]; if(window.__maybeStart)window.__maybeStart(); } o[k]=/authorization|cookie|token/i.test(k)?redact(h[k]):h[k]; }); } }catch(e){} return o; }
  if(!window.__apiHook){ window.__apiHook=true; window.__apiCalls=[]; window.__lastApi=Date.now();
    function rec(e){ try{ if(/\\/api\\//.test(e.url||'')) window.__lastApi=Date.now(); if(window.__apiCalls.length<120) window.__apiCalls.push(e); }catch(_){} }
    var of=window.fetch;
    if(of){ window.fetch=function(input,init){ init=init||{}; var url=(typeof input==='string')?input:((input&&input.url)||''); var method=(init.method||(input&&input.method)||'GET'); var reqH=redH(init.headers||(input&&input.headers)); var body=redactBody(url,init.body);
      return of.apply(this,arguments).then(function(res){ try{ var c=res.clone(); c.text().then(function(t){ rec({t:'fetch',url:url,method:method,headers:reqH,body:body,status:res.status,ct:(res.headers&&res.headers.get('content-type'))||'',resp:(t||'').slice(0,2500)}); },function(){}); }catch(e){ rec({t:'fetch',url:url,method:method,headers:reqH,body:body,status:res.status}); } return res; }); }; }
    var oOpen=XMLHttpRequest.prototype.open, oSend=XMLHttpRequest.prototype.send, oSet=XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open=function(m,u){ this.__m=m; this.__u=u; this.__h={}; return oOpen.apply(this,arguments); };
    XMLHttpRequest.prototype.setRequestHeader=function(k,v){ try{ if(/^authorization$/i.test(k)){ window.__bearer=v; if(window.__maybeStart)window.__maybeStart(); } this.__h[k]=/authorization|cookie|token/i.test(k)?redact(v):v; }catch(e){} return oSet.apply(this,arguments); };
    XMLHttpRequest.prototype.send=function(b){ var self=this; try{ this.addEventListener('load',function(){ try{ var e={t:'xhr',url:self.__u,method:self.__m,headers:self.__h,body:redactBody(self.__u,b),status:self.status,ct:self.getResponseHeader('content-type')||'',resp:(self.responseText||'').slice(0,2500)}; rec(e); if(/\\/api\\//.test(self.__u||'')) log("API: "+self.__m+" "+String(self.__u).split('/api/')[1]); }catch(_){} }); }catch(e){} return oSend.apply(this,arguments); };
    log("Hálózat-figyelő telepítve");
  }
  function tokenKeys(){ var out=[]; [['local',window.localStorage],['session',window.sessionStorage]].forEach(function(pair){ try{ var st=pair[1]; for(var i=0;i<st.length;i++){ var k=st.key(i); var v=st.getItem(k)||''; var looksTok=/token|auth|oidc|msal|bearer|jwt|access/i.test(k) || (/^ey[A-Za-z0-9_-]+\\./.test(v)); if(looksTok) out.push({store:pair[0],key:k,len:v.length,preview:redact(v)}); } }catch(e){} }); return out; }
  function interesting(c){ var u=(c.url||''); if(/\\.(js|css|png|jpe?g|svg|woff2?|ttf|ico|gif|map)(\\?|$)/i.test(u)) return false; var ct=(c.ct||''); return /json/i.test(ct) || /\\/api\\/|hallgato|kreptn|neptun|advancement|curriculum|subject|targ/i.test(u); }
  var KEYCTRL=/curriculum|credit|advancement|training|subject|myTrainings|progress|kredit|targ|finance|payment|invoice|p[eé]nz|befizet|sz[aá]ml|t[eé]tel|d[ií]j|balance|egyenleg|transaction|tranzak/i;
  function collect(){ var seen={}, out=[]; (window.__apiCalls||[]).forEach(function(c){ if(!interesting(c)) return; var key=c.method+' '+c.url; if(seen[key]) return; seen[key]=1;
    // Finance discovery: keep the response for EVERY captured /api/ call (low volume here), so each
    // finance controller's shape is visible. deliver()/snap() trim if the payload gets too big.
    out.push({method:c.method,url:c.url,status:c.status,ct:c.ct,headers:c.headers,body:c.body,resp:(c.resp||'').slice(0,1800)}); }); return out.slice(0,80); }
  // Each fetch is capped at 12s so a hanging endpoint can't stall the whole run.
  function hit(ep){ var url=new URL('api/'+ep, document.baseURI).href; var ctrl=window.AbortController?new AbortController():null; var timer;
    var run=(async function(){ try{ var r=await fetch(url,{headers: window.__bearer?{Authorization:window.__bearer}:{}, credentials:'include', signal:ctrl?ctrl.signal:undefined}); var t=await r.text(); return {ep:ep,url:url,status:r.status,ct:(r.headers&&r.headers.get('content-type'))||'',body:(t||'').slice(0,9000)}; }catch(e){ return {ep:ep,url:url,error:String(e)}; } })();
    var to=new Promise(function(res){ timer=setTimeout(function(){ if(ctrl){try{ctrl.abort();}catch(_){}} res({ep:ep,url:url,error:"timeout(12s)"}); },12000); });
    return Promise.race([run,to]).then(function(out){ try{clearTimeout(timer);}catch(_){}; log("Direct "+ep+" → "+(out.status||out.error)); return out; }); }
  // Event-driven: fire the direct study calls the moment a Bearer token is captured (active network),
  // instead of polling for login/token which the throttled hidden webview can freeze.
  // Navigate the logged-in UI into Pénzügyek and its sub-tabs so the network hook captures the real
  // finance XHRs (endpoint URLs + response shapes) — the reliable way to discover them.
  async function navFinance(){
    // Clicking a Pénzügyek sub-tab navigates and CLOSES the menu, so re-open Menü → Pénzügyek before
    // EACH tab. snap() after each so the incremental file gets every tab even if a later one stalls.
    var subs=["Áttekintés","Befizetendő","Számlák","Tranzakciók","Ösztöndíjak és kifizetések","Jóváírások"];
    for(var i=0;i<subs.length;i++){
      try{
        var m=await waitFor(function(){return pick("Menü");},6000); if(m){ m.click(); await sleep(250); }
        var pz=await waitFor(function(){return pick("Pénzügyek");},5000); if(pz){ pz.click(); await sleep(450); } else log("nincs 'Pénzügyek'");
        var s=await waitFor(function(){return pick(subs[i]);},5000); if(s){ log("→ "+subs[i]); try{ s.click(); }catch(_){} await sleep(1500); snap(); } else log("nincs: "+subs[i]);
      }catch(e){ log("nav "+subs[i]+" hiba: "+String(e)); }
    }
    await sleep(400); snap();
  }
  async function runDirect(){
    try{
      log("Bejelentkezve — Pénzügyek felderítése…");
      var direct=[]; // finance-only: no study probes, straight to the finance navigation
      await navFinance(); // triggers the real finance XHRs → captured by the hook (collect())
      log("Kész — rögzített hívások: "+((window.__apiCalls||[]).length));
      deliver({origin:location.origin, base:document.baseURI, bearer: window.__bearer?("["+String(window.__bearer).length+" kar.]"):"nincs", direct:direct, calls:collect(), storage:tokenKeys()});
    }catch(err){ log("HIBA: "+String(err)); deliver({calls:collect(),storage:tokenKeys()}); }
  }
  function maybeStart(){ if(window.__bearer && !window.__directStarted){ window.__directStarted=true; runDirect(); } }
  window.__maybeStart=maybeStart;
  log("Figyelés indul — token bevárása (eseményvezérelt)");
  maybeStart(); // in case a bearer is already available
  return "started";
})();`;
}
// Fetch a text resource (HTML/JS) natively — CapacitorHttp bypasses CORS; falls back to fetch.
async function fetchText(url) {
  const CH = CHTTP();
  if (CH) { const r = await CH.get({ url, headers: { Accept: "text/html,application/javascript,text/javascript,*/*" } }); const d = r && r.data; return typeof d === "string" ? d : (d == null ? "" : JSON.stringify(d)); }
  const r = await fetch(url, { credentials: "include" }); return await r.text();
}
// Discover finance API endpoints by grepping the app's JS bundles/lazy chunks for "<Controller>/<Action>"
// strings that look finance-related. Native fetches only → no InAppBrowser, no setTimeout freeze.
async function discoverFinanceEndpoints(base) {
  const root = String(base || "").replace(/api\/?$/, "");
  if (!root) return [];
  const EP = /[A-Z][A-Za-z0-9]{2,}\/(?:Get|Post|Create|Update|Delete|Save|List|Download|Sign|Pay|Add|Remove)[A-Za-z0-9]+/g;
  const FIN = /financ|invoice|payed|paid|payment|imposit|transacti|bonus|scholar|collective|bankaccount|d[ií]j|p[eé]nz|sz[aá]ml|message|inbox|recipient|posts?\b|[üu]zenet|level/i;
  const found = new Set(), all = new Set(), files = new Set(), fetched = new Set(), dbg = [];
  const toUrl = (f) => f.indexOf("http") === 0 ? f : root + f.replace(/^\//, "");
  // Only real Angular/esbuild bundle filenames — NOT jQuery-plugin names (widget.js, effect-*.js,
  // zone.js…) which are false positives that returned index.html and wasted fetch slots.
  const addFiles = (txt) => { (txt.match(/(?:chunk|main|polyfills|scripts|runtime)-[A-Za-z0-9]{5,}\.js/g) || []).forEach((f) => files.add(f)); };
  const grep = (txt) => { (txt.match(EP) || []).forEach((m) => { all.add(m); if (FIN.test(m)) found.add(m); }); };
  let idxLen = 0; try { const idx = await fetchText(root); idxLen = idx.length; addFiles(idx); } catch (e) { dbg.push({ f: "(index)", err: String(e && e.message || e) }); }
  dbg.push({ f: "(index)", len: idxLen, foundFiles: files.size });
  // Two passes: entry bundles first (they reveal lazy-chunk names via addFiles), then everything.
  for (let pass = 0; pass < 2; pass++) {
    for (const f of Array.from(files)) {
      const url = toUrl(f); if (fetched.has(url)) continue; if (fetched.size >= 60) break; fetched.add(url);
      $("busy-text").textContent = "JS: " + f.slice(0, 24);
      try { const js = await fetchText(url); dbg.push({ f, len: js.length }); grep(js); addFiles(js); } catch (e) { dbg.push({ f, err: String(e && e.message || e) }); }
    }
  }
  return { found: Array.from(found), debug: { root, fileCount: files.size, fetched: dbg.slice(0, 60), sample: Array.from(all).slice(0, 80) } };
}
async function runApiDiagnostics() {
  if (!isNative) { toast("Az API diagnosztika a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  const ok = await ask({ title: "Időszakok diagnosztika", okText: "Indítás", cancelText: "Mégse",
    body: "Bejelentkezik, és <b>közvetlenül</b> lekéri az időszak-végpontokat több paraméter-variánssal (GET és POST), majd a teljes JSON választ fájlba menti (Dokumentumok/neptunplus) és a vágólapra másolja. Küldd el nekem a fájlt." });
  if (!ok) return;
  await totpTick();
  showBusy("Bejelentkezés…", true);
  const results = [];
  let cancelled = false;
  try {
    const sess = await getApiSession(true);
    if (!sess || !sess.token) { hideBusy(); await ask({ title: "Jegyek diagnosztika", okText: "OK", body: "Nem sikerült tokent szerezni." }); return; }
    let termId = "", termText = "";
    try { const mt = await apiGet(sess, "MyTrainings"); const t = mt && mt.data && mt.data.data && mt.data.data[0]; termId = (t && t.actualTermId) || ""; } catch (e) {}
    try { const tr = await apiGet(sess, "RegistrySheet/GetStudentTrainingTerms"); const t0 = tr && tr.data && tr.data.data && tr.data.data[0]; termText = (t0 && t0.text) || ""; } catch (e) {}
    const page = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 50, "sortAndPage.pageSize": 50, "sortAndPage.term": termId };
    const pageNoTerm = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 50 };
    const pageTermText = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 50, "sortAndPage.term": termText };
    // Üzenetek (Messages) endpoints — names known from the v0.143 JS grep; here we probe them to learn
    // the response shapes. Direct GET via CapacitorHttp; list endpoints try both no-param and paged.
    void termId; void termText; void pageTermText; void pageNoTerm;
    // JEGYEK / ÁTLAGOK discovery. Probe the results-card, averages and exam-results endpoints with a
    // few param variants (studentTrainingId / termId) so we learn which bind and their shapes.
    let trainIds = [];
    try { const mt = await apiGet(sess, "MyTrainings"); const list = (mt && mt.data && mt.data.data) || []; trainIds = list.map((t) => t.studentTrainingId).filter(Boolean); } catch (e) {}
    const stid = trainIds[0] || "";
    results.push({ studentTrainingIds: trainIds, actualTermId: termId });
    const p500 = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500 };
    // Complete grades discovery: the leckekönyv (certificate) results + per-term taken subjects with
    // results + offered grades + mid-term task results (to cover gyakorlati/megajánlott/etc. grades).
    let termGuids = [];
    try { const tr = await apiGet(sess, "RegistrySheet/GetStudentTrainingTerms"); termGuids = ((tr && tr.data && tr.data.data) || []).map((t) => t.value).filter(Boolean); } catch (e) {}
    let sttIds = [];
    try { const ta = await apiGet(sess, "Advancement/GetTermAveragesByTraining", { studentTrainingId: stid }); sttIds = (((ta && ta.data && ta.data.data) || {}).termAveragesByTrainings || []).map((x) => x.studentTrainingTermId).filter(Boolean); } catch (e) {}
    results.push({ termGuids, sttIds });
    // IDŐSZAKOK (periods) discovery — probe Periods/GetPeriods with several param shapes (GET), plus the
    // per-module period endpoints, so we learn the true request binding + response envelope on live data.
    const wide = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500 };
    const eps = [
      ["Periods/GetPeriods", wide],
      ["Periods/GetPeriods", { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500, "request.termId": termId }],
      ["Periods/GetPeriods", { firstRow: 0, lastRow: 500 }],
      ["Periods/GetPeriods", null],
      ["Periods/GetTerms", null],
      ["FinalExams/GetActivePeriods", null],
      ["FinalExams/GetPeriodsBySelectedTabType", null],
      ["ModuleSelection/GetPeriods", null],
      ["ModuleSelection/GetActivePeriodsCount", null],
      ["DormitoryRegistration/GetActiveDormitoryPeriods", null],
    ];
    for (const [ep, params] of eps) {
      $("busy-text").textContent = ep.split("/").pop() + "…";
      try { const r = await apiGet(sess, ep, params || undefined); results.push({ ep, verb: "GET", params: params || undefined, status: r.status, data: r.data }); }
      catch (e) { results.push({ ep, verb: "GET", params: params || undefined, error: String(e && e.message || e) }); }
    }
    // POST variants for Periods/GetPeriods (in case this deployment binds a request body, not query).
    const posts = [
      ["Periods/GetPeriods", { firstRow: 0, lastRow: 500, filterModel: { termId: "" } }],
      ["Periods/GetPeriods", { request: { termId: "" }, sortAndPage: { firstRow: 0, lastRow: 500 } }],
    ];
    for (const [ep, body] of posts) {
      $("busy-text").textContent = ep.split("/").pop() + " (POST)…";
      try { const r = await apiPost(sess, ep, body); results.push({ ep, verb: "POST", body, status: r.status, data: r.data }); }
      catch (e) { results.push({ ep, verb: "POST", body, error: String(e && e.message || e) }); }
    }
    // Endpoint names already known from the v0.143 grep — skip the slow JS re-discovery this run;
    // we only need the Message list shapes above.
    let discovered = [], discDebug = "skipped (targeted message probe)";
    const known = new Set(results.map((r) => r.ep));
    for (const ep of discovered) {
      if (known.has(ep)) continue; known.add(ep);
      $("busy-text").textContent = ep.split("/").pop() + "…";
      try {
        let r = await apiGet(sess, ep);
        if (r && r.status === 400) { try { const r2 = await apiGet(sess, ep, page); if (r2 && r2.status < 400) r = r2; } catch (e) {} }
        results.push({ ep, discovered: true, status: r.status, data: r.data });
      } catch (e) { results.push({ ep, discovered: true, error: String(e && e.message || e) }); }
    }
    results.push({ discoveredEndpoints: discovered, _debug: discDebug });
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("finance diag: " + (e && e.message ? e.message : e)); }
  hideBusy();
  if (cancelled && !results.length) { toast("Megszakítva"); return; }
  const fileName = BACKUP_DIR + "/apidiag-" + backupTs() + ".json";
  const json = JSON.stringify({ base: apiSession && apiSession.base, grades: results }, null, 2);
  let fileMsg = "";
  try { const fs = FSP(); if (fs) { await fs.writeFile({ path: fileName, data: json, directory: "DOCUMENTS", encoding: "utf8", recursive: true }); fileMsg = "Fájlba mentve: <b>Dokumentumok/" + esc(fileName) + "</b>"; } }
  catch (e) { fileMsg = "Fájlba írás nem sikerült: " + esc(e && e.message ? e.message : String(e)); }
  try { await navigator.clipboard.writeText(json); } catch (e) {}
  const summary = results.filter((r) => r.ep).map((r) => `${r.discovered ? "🔎 " : ""}${esc(r.ep)} → ${r.error ? "HIBA" : r.status}`).join("<br>");
  await ask({ title: "Időszakok diagnosztika", okText: "OK", cancelText: "Bezárás", body: `${fileMsg}<br>A vágólapra is másoltam.<br><br>${summary}` });
}
$("btn-apidiag").onclick = runApiDiagnostics;
function hasSemesters() { return !!(state.semesters && state.semesters.list && state.semesters.list.length); }
function canAutoLogin() { return !!(state.username && state.password && (state.no2fa || hasTotp())); }
let semLoading = false;

// =====================================================================
//  DATA SYNC — unified "read necessary data" system
//  Each task logs into Neptun, reads one kind of data, and saves it. To add a
//  new readable data type later, just append one entry here (with has()/run()).
// =====================================================================
const DATA_TASKS = [
  { id: "ics",     label: "Órarend (naptár)", sub: "Feliratkozási link és a naptár eseményei",
    has: () => !!state.icsUrl && !!(state.ics && state.ics.events && state.ics.events.length), run: syncIcs },
  { id: "sems",    label: "Félévek",          sub: "Aktív féléveid a naptár szűréséhez",
    has: hasSemesters, run: syncSemesters },
  { id: "credit",  label: "Kredit",           sub: "Kredit‑előrehaladás (teljesített / összes)",
    has: () => !!(state.progress && state.progress.total), run: syncCredit },
  { id: "courses", label: "Tárgyak (aktuális)", sub: "Felvett tárgyaid félévenként",
    has: () => !!(state.courses && state.courses.list && state.courses.list.length), run: syncCourses },
  { id: "curriculum", label: "Mintatanterv (összes)", sub: "Képzésed összes tárgya és a szabadon választhatók",
    has: hasCurriculum, run: syncCurriculum },
  { id: "finance", label: "Pénzügyek", sub: "Egyenleg, befizetendő, tranzakciók, számlák, ösztöndíjak",
    has: () => !!(state.finance && state.finance.fetchedAt), run: syncFinance },
  { id: "messages", label: "Üzenetek", sub: "Beérkezett és elküldött üzenetek, olvasatlan darabszám",
    has: () => !!(state.messages && state.messages.fetchedAt), run: syncMessages },
  { id: "grades", label: "Jegyek", sub: "Végleges jegyek tárgyanként, félévenként, átlagok és kreditindex",
    has: () => !!(state.grades && state.grades.fetchedAt), run: syncGrades },
  { id: "periods", label: "Időszakok", sub: "Beiratkozási, tárgyfelvételi, vizsgajelentkezési időszakok",
    has: () => !!(state.periods && state.periods.fetchedAt), run: syncPeriods },
];
function dataTask(id) { return DATA_TASKS.find((t) => t.id === id); }
function missingTaskIds() { return DATA_TASKS.filter((t) => !t.has()).map((t) => t.id); }

// --- low-level readers: run one flow, save state, return {ok, detail}. No busy/ask of their own. ---
async function syncIcs() {
  let url = "";
  try { const sess = await getApiSession(); if (sess && sess.token) url = await apiReadIcsUrl(sess); } catch (e) { /* fall back */ }
  if (!url) { const res = await neptunReadIcsLink(); url = (res && res.url) ? res.url.replace(/^webcal:\/\//i, "https://") : ""; }
  if (!url) return { ok: false, detail: "nem találtam feliratkozási linket" };
  state.icsUrl = url; saveState(); updateIcsStatus();
  await fetchTimetable(); // downloads + saves the events
  const n = (state.ics && state.ics.events) ? state.ics.events.length : 0;
  return { ok: n > 0, detail: n ? (n + " esemény") : "a link mentve, de nem jött esemény" };
}
async function syncSemesters() {
  // Preferred: direct API.
  try {
    const sess = await getApiSession();
    if (sess && sess.token) { const terms = await apiReadTerms(sess); if (terms && terms.length) { state.semesters = { fetchedAt: new Date().toISOString(), list: terms.map((t) => t.label), terms }; saveState(); syncSemStatus(); return { ok: true, detail: terms.length + " félév" }; } }
  } catch (e) { /* fall back */ }
  const res = await neptunReadSemesters();
  const sems = (res && res.sems) || [];
  if (!sems.length) return { ok: false, detail: "nem találtam félévet" };
  state.semesters = { fetchedAt: new Date().toISOString(), list: sems }; saveState(); syncSemStatus();
  return { ok: true, detail: sems.length + " félév" };
}
async function syncCredit() {
  let p = null;
  // Preferred: direct API.
  try {
    const sess = await getApiSession();
    if (sess && sess.token) {
      const r = await apiGet(sess, "advancement/creditprogress");
      const d = r && r.data && r.data.data;
      if (d && (d.requiredCredit || d.completedCredit)) p = { done: d.completedCredit || 0, total: d.requiredCredit || 0, free: d.completedOptionalSubjectCredit || 0 };
    }
  } catch (e) { /* fall back */ }
  // Fallback: DOM scraping.
  if (!p || !p.total) { const res = await neptunReadProgress(); p = (res && res.progress) || null; }
  if (!p || !p.total) return { ok: false, detail: "nem találtam kredit adatot" };
  state.progress = { fetchedAt: new Date().toISOString(), done: p.done, total: p.total, free: p.free || 0 };
  saveState(); syncProgStatus();
  return { ok: true, detail: p.done + "/" + p.total + " kredit" };
}
// Finances (all discovered v0.143, direct API). Reads: collective accounts + balance, items to pay,
// all impositions (fees), transaction history, invoices, scholarship payments. Each is normalized to
// a stable shape for the frontend (see FRONTEND-penzugyek.md).
async function syncFinance() {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  const page = { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500 };
  const arr = async (ep, params) => { try { const r = await apiGet(sess, ep, params); const d = r && r.data && r.data.data; return Array.isArray(d) ? d : []; } catch (e) { return []; } };
  const reason0 = (x) => (x && x.uiDisplayState && x.uiDisplayState.reasons && x.uiDisplayState.reasons[0]) || "";

  const accounts = (await arr("CollectiveInvoices/GetCollectiveInvoicesList")).map((a) => ({
    id: a.collectiveInvoiceId, account: a.bankAccount || "", balance: a.balance == null ? null : +a.balance,
    currency: a.currency || "HUF", autoPay: !!a.automaticPayIn, autoPayText: a.automaticPayInText || "",
    label: reason0(a) || (a.currency ? a.currency + " gyűjtőszámla" : "Gyűjtőszámla"),
  }));
  const toPay = (await arr("FinancialItem/GetItemsToBePayed")).map((i) => ({
    id: i.impositionId, name: i.name || "", value: +i.value || 0, currency: i.currency || "HUF",
    dueDate: i.latestExecutionDate || null, term: i.term || "", subjectName: i.subjectName || "", subjectCode: i.subjectCode || "",
  }));
  const impositions = (await arr("FinancialItem/GetStudentImpositions")).map((i) => ({
    id: i.impositionId, name: i.name || "", value: +i.value || 0, currency: i.currency || "HUF",
    dueDate: i.latestExecutionDate || null, paidAt: i.timeOfPayment || null, term: i.term || "",
    subjectName: i.subjectName || "", subjectCode: i.subjectCode || "", invoiceNo: i.invoiceSerialnumber || "",
  }));
  const transactions = (await arr("Transactions/GetStudentPreviousTransactions", page)).map((t) => ({
    id: t.transactionId, type: t.transactionPayingType || "", status: t.transactionStatus || "",
    value: +t.transactionValue || 0, currency: t.transactionCurrency || "HUF", direction: t.transactionDirection || "",
    date: t.transferDate || null, note: t.transactionNote || "", sign: t.sign || "",
  }));
  const invoices = (await arr("Invoices/GetInvoicesForStudent", page)).map((v) => ({
    id: v.invoiceId, number: v.certificationNumber || "", value: +v.value || 0, currency: v.currency || "HUF",
    date: v.creationDate || null, name: v.impositionName || "", payer: v.payerName || "",
  }));
  const scholarships = (await arr("Scholarship/GetScholarshipPayments")).map((s) => ({
    id: s.id, name: s.name || "", amount: +s.amount || 0, currency: s.currencyName || "HUF",
    term: s.termName || "", date: s.bankDate || s.latestExecutionDate || null, status: reason0(s),
  }));

  if (!accounts.length && !toPay.length && !impositions.length && !transactions.length && !invoices.length && !scholarships.length) {
    return { ok: false, detail: "nem találtam pénzügyi adatot" };
  }
  state.finance = { fetchedAt: new Date().toISOString(), accounts, toPay, impositions, transactions, invoices, scholarships };
  saveState();
  const huf = accounts.find((a) => a.currency === "HUF");
  const bal = huf && huf.balance != null ? huf.balance : (accounts[0] && accounts[0].balance) || 0;
  return { ok: true, detail: Number(bal).toLocaleString("hu") + " Ft egyenleg · " + toPay.length + " befizetendő" };
}
// Üzenetek (discovered v0.149, direct API). Message list endpoints use FLAT firstRow/lastRow paging
// (NOT sortAndPage.*). Received list is data.receivedMessages, sent is data.messages. Normalized to a
// stable {id, from, subject, date, unread, hasAttachment, isSystem, sent} shape; body loaded on demand.
// Grade text ("Jeles"/"Jó"/"Kiválóan megfelelt (5)"/…) → numeric 1-5, or null for pass-only (aláírás).
function gradeValue(text) {
  const t = String(text || "").trim().toLowerCase();
  const m = t.match(/\((\d)\)/); if (m && +m[1] >= 1 && +m[1] <= 5) return +m[1]; // e.g. "Kiválóan megfelelt (5)"
  // Order matters. Note: \b fails around accented letters (ó), so match "jó" via a manual boundary.
  if (/elégtelen|elegtelen/.test(t)) return 1;
  if (/elégséges|elegséges|elegseges/.test(t)) return 2;
  if (/közepes|kozepes/.test(t)) return 3;
  if (/(^|[^a-z])j[óo]([^a-z]|$)/.test(t)) return 4; // "jó" / "jo" standalone
  if (/jeles|kivál/.test(t)) return 5;
  return null;
}
// Jegyek + átlagok. FINAL grades per subject come from the leckekönyv (RegistrySheet/
// GetStudentTakenSubjectsByTerm per studentTrainingTermDataId) — one row per subject with its final
// result. All exam attempts (ExamResults) are kept per subjectId for the tap-through detail. Averages/
// indices from Advancement/GetTermAveragesByTraining + Dashboard/GetAverages.
async function syncGrades() {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  const g = async (ep, params) => { try { const r = await apiGet(sess, ep, params); return r && r.data && r.data.data; } catch (e) { return null; } };
  let stid = ""; try { const mt = await apiGet(sess, "MyTrainings"); const t = mt && mt.data && mt.data.data && mt.data.data[0]; stid = (t && t.studentTrainingId) || ""; } catch (e) {}
  const ta = stid ? await g("Advancement/GetTermAveragesByTraining", { studentTrainingId: stid }) : null;
  const termText = {}; if (ta && ta.terms) ta.terms.forEach((x) => { termText[x.value] = String(x.text || "").replace(/\s*\(.*\)\s*$/, "").trim(); });
  const sttList = ((ta && ta.termAveragesByTrainings) || []).map((x) => ({ stt: x.studentTrainingTermId, termName: termText[x.termId] || "", average: x.average, creditIndex: x.creditIndex, sumAverage: x.sumAverage }));
  // Leckekönyv: one final grade per subject, per term.
  const byTerm = {};
  for (const s of sttList) {
    if (!s.stt) continue;
    const subs = await g("RegistrySheet/GetStudentTakenSubjectsByTerm", { studentTrainingTermDataId: s.stt });
    (Array.isArray(subs) ? subs : []).forEach((x) => {
      const tn = x.termName || s.termName || "";
      if (!byTerm[tn]) byTerm[tn] = { termId: x.termId || "", termName: tn, subjects: [] };
      byTerm[tn].subjects.push({
        subjectId: x.subjectId || "", subject: x.subjectName || "", code: x.subjectCode || "",
        credits: x.subjectCredits || 0, type: x.signupType || "", result: x.result || "",
        value: gradeValue(x.result), passed: !!(x.uiDisplayState && x.uiDisplayState.reasons && x.uiDisplayState.reasons[0] === "Teljesítve"),
      });
    });
  }
  const terms = Object.values(byTerm).sort((a, b) => (b.termName > a.termName ? 1 : b.termName < a.termName ? -1 : 0));
  // All exam attempts per subjectId — for the tap-through "összes jegy" detail.
  const exData = await g("ExamResults/GetExamResultsList", { "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500 });
  const attempts = {};
  (Array.isArray(exData) ? exData : []).forEach((t) => (t.examResultsList || []).forEach((e) => {
    (attempts[e.subjectId] = attempts[e.subjectId] || []).push({
      type: e.typeName || e.examType || "", result: e.resultName || "", value: (e.resultValue != null ? e.resultValue : null),
      passed: !!e.passed, date: e.gradeEnteredDate || e.toDate || null, term: e.termName || "",
    });
  }));
  Object.keys(attempts).forEach((k) => attempts[k].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
  const perTerm = sttList.filter((s) => s.average != null || s.creditIndex != null).map((s) => ({ termName: s.termName, average: s.average, creditIndex: s.creditIndex, sumAverage: s.sumAverage }));
  const dash = await g("Dashboard/GetAverages");
  const idx = {}; if (dash && dash.dashboardAverageItems) dash.dashboardAverageItems.forEach((it) => { idx[it.extraFieldTranslation] = it.index; });
  const indices = dash ? { termName: dash.termName || "", korrigalt: idx.KorrigaltKreditIndex, kreditIndex: idx.KreditIndex, osztondij: idx.SchoolarshipKey } : null;
  // Offered grades (megajánlott jegy) awaiting accept/reject.
  const offRaw = await g("OfferedGrades/GetOfferedGrades");
  const offered = (Array.isArray(offRaw) ? offRaw : (offRaw && offRaw.offeredGrades) || []).map((x) => ({
    id: x.id || x.indexLineEntryId || x.offeredGradeId || "", subject: x.subjectName || "", code: x.subjectCode || "",
    course: x.courseCode || "", result: x.resultName || x.offeredResult || x.gradeName || "", deadline: x.deadline || x.acceptanceDeadline || null,
  })).filter((x) => x.id);
  const totalSub = terms.reduce((s, t) => s + t.subjects.length, 0);
  if (!totalSub && !perTerm.length && !offered.length && !(indices && (indices.korrigalt != null || indices.kreditIndex != null))) return { ok: false, detail: "nem találtam jegyet" };
  state.grades = { fetchedAt: new Date().toISOString(), terms, attempts, offered, averages: { perTerm, indices } };
  saveState();
  return { ok: true, detail: totalSub + " tárgy" + (offered.length ? " · " + offered.length + " megajánlott" : "") + (indices && indices.korrigalt != null ? " · kreditindex " + indices.korrigalt : "") };
}
// Accept or reject an offered grade: POST OfferedGrades/AcceptOrRejectOfferedGrade {accept, indexLineEntryId}.
async function apiOfferedGradeDecision(id, accept) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  try {
    const r = await apiPost(sess, "OfferedGrades/AcceptOrRejectOfferedGrade", { accept: !!accept, indexLineEntryId: id });
    if (r && r.status >= 200 && r.status < 300) return { ok: true };
    let d = r && r.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    const msg = d && (d.message || (d.modelStateErrors && d.modelStateErrors[0] && d.modelStateErrors[0].errors && d.modelStateErrors[0].errors[0]));
    return { ok: false, detail: msg || ("hiba (" + (r && r.status) + ")") };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
// Időszakok (beiratkozás / tárgyfelvétel / vizsgajelentkezés / szorgalmi / vizsga-időszak…):
// Periods/GetPeriods (GET) REQUIRES a non-empty request.termId (empty → 400). So we fetch the term list
// (Periods/GetTerms) and query periods per term, then merge (dedupe by periodId). Response body.data is a
// plain array of { periodId, periodName, periodType, fromDate, toDate, administrationOrganizations, termName }.
async function syncPeriods() {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  const g = async (ep, params) => { try { const r = await apiGet(sess, ep, params); return r && r.data && r.data.data; } catch (e) { return null; } };
  const terms = await g("Periods/GetTerms");
  const termIds = (Array.isArray(terms) ? terms : []).map((t) => t.value).filter(Boolean);
  if (!termIds.length) return { ok: false, detail: "nem találtam félévet" };
  const byId = {};
  for (const tid of termIds) {
    const rows = await g("Periods/GetPeriods", { "request.termId": tid, "sortAndPage.firstRow": 0, "sortAndPage.lastRow": 500 });
    (Array.isArray(rows) ? rows : []).forEach((x) => {
      const id = x.periodId || x.id; if (!id || byId[id]) return;
      byId[id] = { id, name: x.periodName || "", type: x.periodType || "", from: x.fromDate || null, to: x.toDate || null,
        org: x.administrationOrganizations || "", term: x.termName || "" };
    });
  }
  const items = Object.values(byId);
  if (!items.length) return { ok: false, detail: "nem találtam időszakot" };
  state.periods = { fetchedAt: new Date().toISOString(), items };
  saveState();
  return { ok: true, detail: items.length + " időszak" };
}
async function syncMessages() {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  const page = { firstRow: 0, lastRow: 200 };
  const get = async (ep, params) => { try { const r = await apiGet(sess, ep, params); return (r && r.data && r.data.data) || null; } catch (e) { return null; } };
  const norm = (m, sent) => ({
    id: m.messageId, from: m.senderName || "", to: "", senderUserId: m.senderUserId || "",
    subject: m.subject || "(nincs tárgy)", date: m.lastPostDate || null, unread: (m.unreadedPostCount || 0) > 0,
    hasAttachment: !!m.hasAttachment, isSystem: !!m.isSystemMessage,
    isCreator: !!m.isCurrentUserMessageCreator, sent: !!sent,
  });
  const rec = await get("Message/GetReceivedMessages", page);
  const snt = await get("Message/GetSentMessages", page);
  const cnt = await get("Message/GetUnreadedMessagesCount");
  const received = (rec && rec.receivedMessages || []).map((m) => norm(m, false));
  const sentMsgs = (snt && snt.messages || []).map((m) => norm(m, true));
  const unread = (cnt && typeof cnt.count === "number") ? cnt.count : received.filter((m) => m.unread).length;
  if (!received.length && !sentMsgs.length && !unread) return { ok: false, detail: "nem találtam üzenetet" };
  // My own user id = the sender of a message I created → used to right-align my chat bubbles.
  const mine = sentMsgs.find((m) => m.isCreator) || received.find((m) => m.isCreator);
  const meId = (mine && mine.senderUserId) || "";
  // Sent-list items only carry MY name as senderName; the recipient lives in the thread's recipients[].
  // Sent threads are few, so fetch recipient names for them (capped) to show "kinek írtam" in the list.
  // ponytail: N calls for sent only, capped at 25; lazy-enrich the rest when a thread is opened.
  for (const m of sentMsgs.slice(0, 25)) {
    try { const res = await apiReadMessagePosts(m.id); if (res && res.recipients && res.recipients.length) m.to = res.recipients.map((r) => r.printName).filter(Boolean).join(", "); } catch (e) {}
  }
  const canReply = !!(rec && rec.isCommunicationEnabled);
  state.messages = { fetchedAt: new Date().toISOString(), unread, canReply, meId, received, sent: sentMsgs };
  saveState();
  return { ok: true, detail: unread + " olvasatlan · " + received.length + " beérkezett" };
}
// Read one message's posts (body) on demand. REST-style path (id is a path segment, controller is
// plural `Messages`): GET api/Messages/<id>/Posts → {data:{posts:[…], recipients:[…]}}.
async function apiReadMessagePosts(id) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return null;
  try {
    const r = await apiGet(sess, "Messages/" + encodeURIComponent(id) + "/Posts");
    const d = r && r.data && r.data.data;
    const posts = d && (Array.isArray(d) ? d : (d.posts || d.messagePosts));
    if (!posts || !posts.length) return null;
    // messageData.isReplyEnabled is the authoritative per-message reply flag (the Neptun web gates the
    // compose form on exactly this). Most automated messages have it false.
    const replyEnabled = !!(d && d.messageData && d.messageData.isReplyEnabled);
    const recipients = (d && d.recipients) || [];
    return { posts, replyEnabled, recipients };
  } catch (e) { return null; }
}
// Mark a message's posts read on the Neptun server (fire-and-forget): POST Messages/<id>/Posts/Processed {postIds}.
async function apiMarkMessageRead(id, posts) {
  const ids = (posts || []).map((p) => p.postId || p.id || p.messagePostId).filter(Boolean);
  if (!ids.length) return false;
  try {
    const sess = await getApiSession();
    if (!sess || !sess.token) return false;
    const r = await apiPost(sess, "Messages/" + encodeURIComponent(id) + "/Posts/Processed", { postIds: ids });
    return !!(r && r.status >= 200 && r.status < 300);
  } catch (e) { return false; }
}
// Send a reply into a message thread: POST Message/ReplyToPost {messageIdToReply, postIdToReply, text,
// temporaryFileIds}. postId = the post we answer (last one), "" is accepted. Returns {ok, detail}.
async function apiSendReply(messageId, text, postId, fileIds) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  try {
    const r = await apiPost(sess, "Message/ReplyToPost", { messageIdToReply: messageId, postIdToReply: postId || "", text: String(text || ""), temporaryFileIds: fileIds || [] });
    if (r && r.status >= 200 && r.status < 300) return { ok: true };
    let d = r && r.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    const msg = d && (d.message || (d.modelStateErrors && d.modelStateErrors[0] && d.modelStateErrors[0].errors && d.modelStateErrors[0].errors[0]));
    return { ok: false, detail: msg || ("hiba (" + (r && r.status) + ")") };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
// Upload one File to Neptun's temp store → returns its temporaryFileId (guid) or throws. Protocol from
// the JS bundle: FileUpStart {maxChunkSize,chunkCount,fileName,fileSize,documentationTypeId,languageId,
// description} → {guid}; FileUp multipart {chunkFile, tempFileGUID} per 1MB chunk; FileUpEnd {tempFileGUID}.
// The multipart POST uses fetch (CapacitorHttp intercepts fetch → routes native, no CORS).
const UP_CHUNK = 1048576;
let msgDocTypeId = ""; // Neptun's allowed documentation type for a new message attachment (server constant)
async function getMsgDocTypeId(sess) {
  if (msgDocTypeId) return msgDocTypeId;
  try { const r = await apiGet(sess, "Message/GetDocumentationsTypeIds"); const d = r && r.data && r.data.data; msgDocTypeId = (d && d.allowedDocumentationTypeForNewFile) || ""; } catch (e) {}
  return msgDocTypeId;
}
async function apiUploadFile(file) {
  const sess = await getApiSession();
  if (!sess || !sess.token) throw new Error("nincs munkamenet");
  const auth = "Bearer " + sess.token, base = sess.base;
  const docType = await getMsgDocTypeId(sess); // required — null type → server rejects ("nincs engedélyezve")
  const start = { maxChunkSize: UP_CHUNK, chunkCount: Math.max(1, Math.ceil(file.size / UP_CHUNK)),
    fileName: file.name, fileSize: file.size, documentationTypeId: docType || null, languageId: null, description: "" };
  const r0 = await apiPost(sess, "FileHandler/FileUpStart", start);
  let d0 = r0 && r0.data; if (typeof d0 === "string") { try { d0 = JSON.parse(d0); } catch (e) {} }
  // The guid may sit at various depths / names depending on the server; try the common ones, else the
  // body's `data` if it's itself the id string.
  const dd = d0 && d0.data;
  const guid = (d0 && (d0.guid || d0.tempFileGUID || d0.tempFileGuid || d0.id))
    || (dd && (typeof dd === "string" ? dd : (dd.guid || dd.tempFileGUID || dd.tempFileGuid || dd.id)))
    || (typeof d0 === "string" ? d0 : "");
  if (!guid) throw new Error("FileUpStart(" + (r0 && r0.status) + "): " + JSON.stringify(d0).slice(0, 260));
  for (let pos = 0; pos < file.size || pos === 0; pos += UP_CHUNK) {
    const fd = new FormData();
    fd.append("chunkFile", new File([file.slice(pos, pos + UP_CHUNK)], file.name));
    fd.append("tempFileGUID", guid);
    const rc = await fetch(base + "FileHandler/FileUp", { method: "POST", headers: { Authorization: auth }, body: fd });
    if (!rc.ok) throw new Error("FileUp hiba (" + rc.status + ")");
    if (file.size === 0) break;
  }
  await apiPost(sess, "FileHandler/FileUpEnd", { tempFileGUID: guid });
  return guid;
}
function DLP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Downloads; }
const MIMES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", rar: "application/vnd.rar", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };
function guessMime(name) { const e = (name.split(".").pop() || "").toLowerCase(); return MIMES[e] || "application/octet-stream"; }
// Download a message attachment: POST Message/DownloadAttachments {documentationIds, postId} → blob
// (CapacitorHttp returns base64). Save to the phone's public Downloads via the native Downloads plugin
// (returns a content uri, openable); if that plugin isn't in this build, fall back to Documents/neptunplus.
async function downloadAttachment(postId, documentationIds, fileName) {
  if (!isNative) return { ok: false, detail: "csak a telefonos appban" };
  const sess = await getApiSession(); const CH = CHTTP();
  if (!sess || !sess.token || !CH) return { ok: false, detail: "nincs munkamenet" };
  try {
    const res = await CH.post({ url: sess.base + "Message/DownloadAttachments",
      headers: { Authorization: "Bearer " + sess.token, "Content-Type": "application/json" },
      data: { documentationIds: documentationIds, postId: postId }, responseType: "blob" });
    if (!res || res.status < 200 || res.status >= 300) return { ok: false, detail: "hiba (" + (res && res.status) + ")" };
    let b64 = res.data; if (b64 == null || b64 === "") return { ok: false, detail: "üres fájl" };
    if (typeof b64 !== "string") b64 = String(b64);
    const cd = res.headers && (res.headers["content-disposition"] || res.headers["Content-Disposition"]) || "";
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = ((m && decodeURIComponent(m[1])) || fileName || ("melleklet-" + Date.now())).replace(/[\\/:*?"<>|]/g, "_");
    const mime = guessMime(name);
    // Preferred: native → public Letöltések (Downloads), openable.
    const dl = DLP();
    if (dl && dl.saveToDownloads) {
      const r2 = await dl.saveToDownloads({ base64: b64, fileName: name, mime });
      return { ok: true, native: true, uri: r2 && r2.uri, name, mime };
    }
    // Fallback (old APK without the plugin): app Documents folder.
    const fs = FSP(); if (!fs) return { ok: false, detail: "nincs fájlrendszer" };
    const path = BACKUP_DIR + "/letoltesek/" + name;
    await fs.writeFile({ path, data: b64, directory: "DOCUMENTS", recursive: true });
    return { ok: true, native: false, path: "Dokumentumok/" + path, mime };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
function fmtBytes(n) {
  n = +n || 0; if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
async function syncCourses() {
  // Preferred: direct API — terms, then enrolled subjects per term.
  try {
    const sess = await getApiSession();
    if (sess && sess.token) {
      const terms = await apiReadTerms(sess);
      if (terms && terms.length) {
        state.semesters = { fetchedAt: new Date().toISOString(), list: terms.map((t) => t.label), terms }; // refresh semesters too
        const list = await apiReadTakenAll(sess, terms);
        if (list && list.length) {
          state.courses = { fetchedAt: new Date().toISOString(), list, semesters: [...new Set(list.map((c) => c.semester))] };
          saveState(); syncSemStatus(); renderCourses();
          return { ok: true, detail: list.length + " tárgy" };
        }
      }
    }
  } catch (e) { /* fall back */ }
  const res = await neptunReadCourses();
  const list = (res && res.courses) || [];
  if (!list.length) return { ok: false, detail: "nem ismertem fel tárgyat" };
  state.courses = { fetchedAt: new Date().toISOString(), list, semesters: res.semesters || [] };
  saveState(); renderCourses();
  return { ok: true, detail: list.length + " tárgy" };
}
async function syncCurriculum() {
  let program = "", req = [], fr = [];
  // Preferred: direct API.
  try {
    const sess = await getApiSession();
    if (sess && sess.token) { const cur = await apiReadCurriculum(sess); if (cur && (cur.required.length || cur.free.length)) { program = cur.program; req = cur.required; fr = cur.free; } }
  } catch (e) { /* fall back */ }
  // Fallback: DOM scraping.
  if (!req.length && !fr.length) { const res = await neptunReadCurriculum(); req = (res && res.required) || []; fr = (res && res.free) || []; program = (res && res.program) || ""; }
  if (!req.length && !fr.length) return { ok: false, detail: "nem ismertem fel tárgyat" };
  state.curriculum = { fetchedAt: new Date().toISOString(), program, required: req, free: fr };
  saveState(); renderCourses();
  return { ok: true, detail: (req.length + fr.length) + " tárgy" + (program ? " · " + program : "") };
}

// --- orchestrator: run the selected tasks in sequence with an overall progress bar ---
let dataSyncOffered = false;
async function runDataSync(ids) {
  ids = (ids || []).filter(dataTask);
  if (!ids.length) return;
  if (!isNative) { toast("A beolvasás a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  const results = [];
  courseLog = []; showBusy("Bejelentkezés…", true);
  setBusyProgress(0, ids.length, `1 / ${ids.length}`);
  let cancelled = false;
  for (let i = 0; i < ids.length; i++) {
    const t = dataTask(ids[i]);
    setBusyProgress(i, ids.length, `${t.label} · ${i + 1} / ${ids.length}`);
    $("busy-text").textContent = t.label + " beolvasása…";
    try { await totpTick(); const r = await t.run(); results.push({ label: t.label, ok: r.ok, detail: r.detail }); }
    catch (e) {
      if (e && /Megszakítva/.test(e.message)) { cancelled = true; break; }
      results.push({ label: t.label, ok: false, detail: (e && e.message) ? e.message : "hiba" });
    }
  }
  setBusyProgress(ids.length, ids.length); hideBusy();
  if (cancelled && !results.length) { toast("Megszakítva"); return; }
  const okN = results.filter((r) => r.ok).length;
  const rows = results.map((r) => `<div class="sync-res${r.ok ? "" : " bad"}"><span class="sr-ic">${icon(r.ok ? "check" : "x")}</span><span><b>${esc(r.label)}</b><span class="sr-d">${esc(r.detail)}</span></span></div>`).join("");
  refreshAgendas();
  await ask({ title: cancelled ? "Beolvasás megszakítva" : (okN === results.length ? "Beolvasás kész" : "Beolvasás részben kész"),
    okText: "OK", cancelText: "Bezárás",
    body: rows + (cancelled ? "<br><br>A többi részt megszakítottad." : "") });
}

// --- selection popup: pick which parts to read (checkboxes, extensible from DATA_TASKS) ---
let syncSel = {};
function renderSyncList() {
  const wrap = $("sync-list"); wrap.innerHTML = "";
  const allOn = DATA_TASKS.every((t) => syncSel[t.id]);
  const master = document.createElement("button");
  master.type = "button"; master.className = "check sync-master" + (allOn ? " on" : "");
  master.innerHTML = `<span class="box">${icon("check")}</span><span><span class="c-t">Minden adat</span><span class="c-b">Jelöld ki az összeset egyszerre.</span></span>`;
  master.onclick = () => { const v = !DATA_TASKS.every((t) => syncSel[t.id]); DATA_TASKS.forEach((t) => syncSel[t.id] = v); renderSyncList(); };
  wrap.appendChild(master);
  DATA_TASKS.forEach((t) => {
    const on = !!syncSel[t.id];
    const b = document.createElement("button");
    b.type = "button"; b.className = "check" + (on ? " on" : "");
    const tag = t.has() ? `<span class="sync-tag have">megvan</span>` : `<span class="sync-tag miss">hiányzik</span>`;
    b.innerHTML = `<span class="box">${icon("check")}</span><span><span class="c-t">${esc(t.label)}${tag}</span><span class="c-b">${esc(t.sub)}</span></span>`;
    b.onclick = () => { syncSel[t.id] = !syncSel[t.id]; renderSyncList(); };
    wrap.appendChild(b);
  });
  $("sync-go").disabled = !DATA_TASKS.some((t) => syncSel[t.id]);
}
function openDataSync(prefill) {
  syncSel = {};
  const pre = (prefill && prefill.length) ? prefill : DATA_TASKS.map((t) => t.id);
  DATA_TASKS.forEach((t) => syncSel[t.id] = pre.indexOf(t.id) >= 0);
  renderSyncList();
  $("sync-sheet").classList.remove("hidden");
}
$("sync-cancel").onclick = () => $("sync-sheet").classList.add("hidden");
$("sync-go").onclick = () => {
  const ids = DATA_TASKS.filter((t) => syncSel[t.id]).map((t) => t.id);
  $("sync-sheet").classList.add("hidden");
  runDataSync(ids);
};

// Offer the read once per launch (and right after onboarding) when something is still missing.
async function maybeOfferDataSync() {
  if (dataSyncOffered || !isNative || !state.setupComplete || !canAutoLogin()) return;
  if (!$("lock").classList.contains("hidden")) return; // wait until unlocked
  const missing = missingTaskIds();
  if (!missing.length) return;
  dataSyncOffered = true;
  openDataSync(missing);
}

// Grab the timetable subscription (iCal) link: login → Menü → Naptár → Naptár kezelése → read link.
async function grabIcsLink() {
  if (!isNative) { toast("Az automatikus lekérés a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let url = "", raw = "", cancelled = false, viaApi = false;
  try {
    // Preferred: direct API — returns the subscription link straight away.
    const sess = await getApiSession();
    if (sess && sess.token) { $("busy-text").textContent = "Naptár link lekérése…"; try { url = await apiReadIcsUrl(sess); if (url) viaApi = true; } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); } }
    // Fallback: DOM scraping.
    if (!url) { const res = await neptunReadIcsLink(); raw = (res && res.raw) || ""; if (res && res.log) courseLog = res.log.split("\n"); if (res && res.url) { url = res.url; dbg("Link: " + url); } else dbg("Nem találtam feliratkozási linket."); }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (url) {
    const clean = url.replace(/^webcal:\/\//i, "https://");
    if (viaApi) { // API link is trustworthy → save + fetch automatically.
      state.icsUrl = clean; saveState(); updateIcsStatus(); $("ics-sheet").classList.add("hidden");
      renderTimetable(); renderExams(); await fetchTimetable(); return;
    }
    // Scraped link: fill the field, user presses Mentés.
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
  const courses = (state.courses && state.courses.list) || [];
  const sems = allSemesters(); // [{key,start,end}], oldest→newest
  if (exSubjSem === null || (exSubjSem !== "all" && !sems.some((s) => s.key === exSubjSem))) {
    exSubjSem = sems.some((s) => s.key === currentSemesterKey()) ? currentSemesterKey() : (sems.length ? sems[sems.length - 1].key : "all");
  }
  const build = () => {
    let subs;
    if (courses.length) {
      // Prefer the enrolled subjects (per semester), so the picker matches what you actually took.
      let list = courses;
      if (exSubjSem !== "all") list = list.filter((c) => c.semester === exSubjSem);
      subs = Array.from(new Set(list.map((c) => c.name).filter(Boolean)));
    } else {
      // Fallback: timetable events, filtered by the semester's date range.
      let evs = classEvents();
      if (exSubjSem !== "all") { const s = sems.find((x) => x.key === exSubjSem); if (s) evs = evs.filter((e) => e.S >= s.start && e.S < s.end); }
      subs = Array.from(new Set(evs.map((e) => e.summary).filter(Boolean)));
    }
    subs.sort((a, b) => a.localeCompare(b, "hu"));
    openList({
      title: "Tárgy választása", selected: exSubject, searchable: true, allowCustom: true,
      items: subs.map((s) => ({ value: s, label: s })),
      chips: [{ key: "all", label: "Összes" }].concat(sems.slice().reverse().map((s) => ({ key: s.key, label: s.key }))),
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

// ----- órarend/course API: match an ICS event to its calendar event (for ids) + fetch the drilldown -----
let apiEvCache = { at: 0, list: null };
async function apiCalendarEvents() {
  if (apiEvCache.list && Date.now() - apiEvCache.at < 5 * 60000) return apiEvCache.list;
  const sess = await getApiSession(); if (!sess || !sess.token) return [];
  let ids = []; try { const mt = await apiGet(sess, "MyTrainings"); ids = ((mt.data && mt.data.data) || []).map((t) => t.studentTrainingId).filter(Boolean); } catch (e) {}
  const now = Date.now(), span = 150 * 864e5;
  const params = { startDate: new Date(now - span).toISOString(), endDate: new Date(now + span).toISOString(), studentTrainingIds: ids,
    isClassesVisible: true, isExamsVisible: true, isFinalExamsVisible: true, isOnlineMeetingsVisible: true, isOtherEventsVisible: true, isPeriodsVisible: true, isTasksVisible: true };
  try { const r = await apiGet(sess, "Calendar/GetCalendarEvents", params); const list = (r.data && r.data.data) || []; apiEvCache = { at: Date.now(), list }; return list; } catch (e) { return []; }
}
function matchApiEvent(list, e) {
  if (!list || !list.length || !e || !e.S) return null;
  const kk = (d) => d.getFullYear() + "|" + d.getMonth() + "|" + d.getDate() + "|" + d.getHours() + "|" + d.getMinutes();
  const k = kk(e.S);
  let cands = list.filter((x) => x.startDate && kk(new Date(x.startDate)) === k);
  const code = (e.summary && (e.summary.match(/[A-ZÁÉÍÓÖŐÚÜŰ0-9]{3,}_[A-Z0-9]+/) || [])[0]) || "";
  if (cands.length > 1 && code) { const c2 = cands.filter((x) => (x.courseCode || "") === code); if (c2.length) cands = c2; }
  return cands[0] || null;
}
async function apiCourseBundle(ev) {
  const sess = await getApiSession(); if (!sess || !sess.token || !ev) return null;
  const g = async (ep, params) => { try { const r = await apiGet(sess, ep, params); return r && r.data && r.data.data; } catch (e) { return null; } };
  const course = (await g("Calendar/GetCourseDetails", { classInstanceId: ev.classInstanceId, webexMeetingId: ev.webexMeetingId || "", isInstitutionalCalendar: false })) || {};
  const termId = course.termId || "";
  const base = { courseId: ev.courseId, subjectId: ev.subjectId, termId };
  const [tutors, detail, students, reqs] = await Promise.all([
    g("SubjectCourse/GetSubjectCourseTutors", base),
    g("SubjectCourse/GetSubjectDetails", base),
    g("SubjectCourse/GetSubjectCourseStudents", { courseId: ev.courseId, subjectId: ev.subjectId, selectedTermId: termId, firstRow: 0, lastRow: 500 }),
    g("SubjectCourse/GetGeneralRequirements", base),
  ]);
  return { course, tutors: tutors || [], detail: detail || {}, students: students || [], reqs: reqs || [] };
}
// Subject-level detail for the Tárgyak list (no course context): GetSubjectDetails + prerequisites +
// general requirements. termId defaults to the actual term. Returns { detail, prereqs, reqs } or null.
let actualTermId = "";
async function getActualTermId(sess) {
  if (actualTermId) return actualTermId;
  try { const mt = await apiGet(sess, "MyTrainings"); const t = mt && mt.data && mt.data.data && mt.data.data[0]; actualTermId = (t && t.actualTermId) || ""; } catch (e) {}
  return actualTermId;
}
async function apiSubjectDetail(subjectId, termId) {
  const sess = await getApiSession(); if (!sess || !sess.token || !subjectId) return null;
  const tid = termId || await getActualTermId(sess);
  const g = async (ep, params) => { try { const r = await apiGet(sess, ep, params); return r && r.data && r.data.data; } catch (e) { return null; } };
  const base = { subjectId: subjectId, termId: tid };
  const [detail, prereqs, reqs] = await Promise.all([
    g("SubjectCourse/GetSubjectDetails", base),
    g("SubjectCourse/GetSubjectPrerequirements", base),
    g("SubjectCourse/GetGeneralRequirements", base),
  ]);
  return { detail: detail || null, prereqs: prereqs || [], reqs: reqs || [] };
}

// ----- event detail + notes (segmented: Tárgy / Oktatók / Diákok / Megjegyzések) -----
let detailEvent = null, detailExamMode = false, detailSeg = "info", detailCourse = null, detailCourseErr = false;
function openDetail(e, examMode) {
  if (!e) return;
  detailEvent = e; detailExamMode = examMode; detailSeg = "info"; detailCourse = null; detailCourseErr = false;
  const t = $("event-title"); if (t) t.textContent = e.manual ? "Esemény" : (examMode ? "Vizsga" : "Óra");
  pushScreen("tab-event"); // full-screen page — renderForTab runs renderDetail
  // Classes get the API drilldown (oktatók/diákok/tárgy adatai); exams/manual keep the simple view.
  if (!e.manual && !examMode && isNative) loadDetailCourse(e);
}
function detailActive() { const a = document.querySelector(".tabscreen.active"); return !!(a && a.id === "tab-event"); }
async function loadDetailCourse(e) {
  try {
    const list = await apiCalendarEvents();
    const ev = matchApiEvent(list, e);
    detailCourse = ev ? await apiCourseBundle(ev) : null;
    if (!detailCourse) detailCourseErr = true;
  } catch (err) { detailCourseErr = true; }
  if (detailEvent === e && detailActive()) renderDetail();
}
function noteAdd(e, kind) {
  const v = $("dn-input").value.trim(); if (!v) return toast("Írj be megjegyzést.");
  state.notes = state.notes || [];
  state.notes.push(kind === "subject" ? { id: uid(), kind: "subject", subject: e.summary, text: v } : { id: uid(), kind: "occurrence", occKey: occKey(e), text: v });
  saveState(); renderDetail(); refreshAgendas(); toast("Megjegyzés hozzáadva.");
}
function renderDetail() {
  const e = detailEvent; if (!e) return;
  const body = $("detail-body"), footer = $("event-footer"); if (!body) return;
  let html = `${e.subject ? `<div class="detail-subj">${esc(e.subject)}</div>` : ""}<div class="sheet-title">${esc(e.summary || "Esemény")}</div>
    <div class="detail-meta">${icon("clock")} ${esc(dayHeading(e.S))} · ${hm(e.S)}${e.E > e.S ? "–" + hm(e.E) : ""}${e.location ? ` &nbsp;·&nbsp; ${icon("pin")} ${esc(e.location)}` : ""}</div>`;
  if (e.manual) {
    const notes = e.note ? [{ text: e.note }] : [];
    html += `<div class="detail-notes">${notes.length ? notes.map((n) => `<div class="note-row"><span class="note-ic">${icon("note")}</span><span class="note-t">${esc(n.text)}</span></div>`).join("") : `<div class="dash-empty" style="padding:18px 2px">Nincs megjegyzés.</div>`}</div>`;
    body.innerHTML = html;
    if (footer) footer.innerHTML = `<div class="event-actions"><button class="btn outline" id="dn-edit">Szerkesztés</button><button class="btn danger" id="dn-del">Törlés</button></div><button class="btn tonal" id="detail-close">Bezárás</button>`;
    if ($("dn-edit")) $("dn-edit").onclick = () => { popScreen(); openExamEdit(e); };
    if ($("dn-del")) $("dn-del").onclick = () => { state.manualExams = (state.manualExams || []).filter((m) => m.id !== e.id); saveState(); popScreen(); renderExams(); renderHome(); toast("Törölve."); };
    if ($("detail-close")) $("detail-close").onclick = popScreen;
    return;
  }
  // Segmented sections for a class/exam occurrence.
  const segs = [["info", "Tárgy"], ["tutors", "Oktatók"], ["students", "Diákok"], ["notes", "Megjegyzések"]];
  html += `<div class="seg" style="margin-bottom:12px">` + segs.map(([id, l]) => `<button class="seg-btn${detailSeg === id ? " active" : ""}" data-cseg="${id}" type="button">${l}</button>`).join("") + `</div>`;
  html += `<div id="course-sec"></div>`;
  body.innerHTML = html;
  body.querySelectorAll("[data-cseg]").forEach((b) => b.onclick = () => { detailSeg = b.dataset.cseg; renderDetail(); });
  // Fixed footer (always visible): skip/attend toggle for classes, then Bezárás.
  let f = "";
  if (!detailExamMode) {
    const hidden = isHiddenOcc(e);
    f += `<button class="btn ${hidden ? "outline" : "danger"}" id="dn-hide">${hidden ? "Mégis járok erre az órára" : "Erre az órára nem járok be"}</button>`
      + `<div class="hint event-hint">A félév összes ilyen órájára érvényes (${esc(TT_DAYS[e.S.getDay()])} ${esc(hm(e.S))}).</div>`;
  }
  f += `<button class="btn tonal" id="detail-close">Bezárás</button>`;
  if (footer) footer.innerHTML = f;
  if ($("dn-hide")) $("dn-hide").onclick = () => {
    const k = hideKey(e); state.hiddenOcc = state.hiddenOcc || [];
    const was = state.hiddenOcc.indexOf(k) >= 0;
    state.hiddenOcc = was ? state.hiddenOcc.filter((x) => x !== k) : state.hiddenOcc.concat(k);
    saveState(); renderDetail(); refreshAgendas(); toast(was ? "Újra látható." : "Elrejtve a félév ilyen óráira.");
  };
  if ($("detail-close")) $("detail-close").onclick = popScreen;
  renderCourseSeg(e);
}
function renderCourseSeg(e) {
  const host = $("course-sec"); if (!host) return;
  const loading = !detailCourse && !detailCourseErr && !e.manual && !detailExamMode && isNative;
  const c = detailCourse || {};
  if (detailSeg === "notes") {
    const notes = notesForEvent(e);
    let h = notes.length
      ? `<div class="detail-notes">` + notes.map((n) => `<div class="note-row"><span class="note-ic">${icon("note")}</span><span class="note-t">${esc(n.text)}</span><button class="note-x" data-nid="${n.id}" title="Törlés">${icon("x")}</button></div>`).join("") + `</div>`
      : `<div class="dash-empty" style="padding:24px 2px">Még nincs megjegyzés ehhez az órához.</div>`;
    h += `<div class="dash-label">Új megjegyzés</div>`
      + `<div class="field"><input class="input" id="dn-input" placeholder="Például: hozz papírt, terem csere" autocomplete="off" /></div>`
      + `<div class="detail-add"><button class="btn outline" id="dn-occ">Csak erre az alkalomra</button><button class="btn tonal" id="dn-sub">Minden ilyen órára</button></div>`;
    host.innerHTML = h;
    host.querySelectorAll(".note-x").forEach((b) => b.onclick = () => { state.notes = (state.notes || []).filter((n) => n.id !== b.dataset.nid); saveState(); renderDetail(); refreshAgendas(); });
    $("dn-occ").onclick = () => noteAdd(e, "occurrence");
    $("dn-sub").onclick = () => noteAdd(e, "subject");
    return;
  }
  if (loading) { host.innerHTML = `<div class="dash-empty" style="padding:18px 2px">Betöltés…</div>`; return; }
  if (detailSeg === "tutors") {
    const list = c.tutors || [];
    host.innerHTML = list.length ? `<div class="card">` + list.map((t) => `<div class="row"><span class="row-ic">${icon("user")}</span><span class="row-main"><span class="row-title">${esc(t.printname || t.nickname || "Oktató")}</span>${t.nickname && t.nickname !== t.printname ? `<span class="row-sub">${esc(t.nickname)}</span>` : ""}</span></div>`).join("") + `</div>`
      : `<div class="dash-empty" style="padding:18px 2px">${detailCourseErr ? "Nem sikerült betölteni." : (c.course && c.course.courseTutor ? esc(c.course.courseTutor) : "Nincs megadott oktató.")}</div>`;
    return;
  }
  if (detailSeg === "students") {
    const list = c.students || [];
    if (!list.length) { host.innerHTML = `<div class="dash-empty" style="padding:18px 2px">${detailCourseErr ? "Nem sikerült betölteni." : "Nincs elérhető hallgatói névsor."}</div>`; return; }
    host.innerHTML = `<div class="hint" style="margin:0 2px 8px">${list.length} hallgató</div><div class="card">`
      + list.map((s) => { const nm = s.printname || s.name || s.studentName || s.fullName || s.nickname || "Hallgató"; return `<div class="row"><span class="row-ic">${icon("user")}</span><span class="row-main"><span class="row-title">${esc(nm)}</span></span></div>`; }).join("") + `</div>`;
    return;
  }
  // "info" — subject + course data
  const d = c.detail || {}, co = c.course || {};
  const rows = [];
  const room = co.room || e.location, tutor = co.courseTutor;
  if (tutor) rows.push(["Oktató", tutor]);
  if (room) rows.push(["Terem", room]);
  if (co.courseType) rows.push(["Típus", co.courseType]);
  if (co.teachingMethod) rows.push(["Oktatás módja", co.teachingMethod]);
  if (co.language) rows.push(["Nyelv", co.language]);
  if (co.strength != null || co.maxLimit != null) rows.push(["Létszám", (co.strength != null ? co.strength : "?") + (co.maxLimit ? " / " + co.maxLimit : "")]);
  if (d.credit != null) rows.push(["Kredit", String(d.credit)]);
  if (d.requirementType) rows.push(["Számonkérés", d.requirementType]);
  if (d.recommendedTerm) rows.push(["Ajánlott félév", String(d.recommendedTerm)]);
  if (d.preRequirement) rows.push(["Előkövetelmény", d.preRequirement]);
  if (d.ownerPrintName) rows.push(["Tárgyfelelős", d.ownerPrintName]);
  if (co.termName) rows.push(["Félév", co.termName]);
  let h = rows.length ? `<div class="card kv">` + rows.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`).join("") + `</div>` : "";
  const reqs = (c.reqs || []).filter((r) => r && r.description);
  if (reqs.length) h += `<div class="dash-label">Követelmények</div><div class="card"><div class="card-pad">` + reqs.map((r) => `<div class="req-row">${esc(r.description)}</div>`).join("") + `</div></div>`;
  if (d.description || d.note) h += `<div class="dash-label">Leírás</div><div class="card"><div class="card-pad msg-text">${sanitizeHtml(d.description || d.note)}</div></div>`;
  if (!h) h = `<div class="dash-empty" style="padding:18px 2px">${detailCourseErr ? "Nem sikerült betölteni a tárgy adatait." : "Nincs több adat."}</div>`;
  host.innerHTML = h;
}
function refreshAgendas() { renderTimetable(); renderExams(); renderHome(); rescheduleNotifications(); }

// =====================================================================
//  DLC / add-ons (szak-specific downloads from GitHub)
// =====================================================================
const DLC_INDEX_URL = "https://raw.githubusercontent.com/Zsalrick/neptun-plus/main/dlc/index.json";
let dlcIndex = null;
$("dlc-close").onclick = () => $("dlc-sheet").classList.add("hidden");
{ const gc = $("grade-close"); if (gc) gc.onclick = () => $("grade-sheet").classList.add("hidden"); }
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
      const p = (kind === "class") ? parseClassSummary(e.summary) : null;
      const short = p ? (p.name + (p.type ? " · " + p.type : "")) : (e.summary || "");
      if (at > now + 15000 && e.S.getTime() < horizon) out.push({
        id: notifId(e, lead), title,
        body: fmtLead(lead) + " múlva: " + short + (e.location ? " · " + e.location : ""),
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
  const p = (x.kind === "class") ? parseClassSummary(x.summary) : null;
  $("notif-head").textContent = x.head || "Emlékeztető";
  $("notif-subj").textContent = p ? p.name : (x.summary || "Esemény");
  $("notif-meta").innerHTML = S ? `${icon("clock")} ${esc(dayHeading(S))} · ${hm(S)}${E && E > S ? "–" + hm(E) : ""}` : "";
  const teach = $("notif-teacher");
  const tline = p ? [p.type, p.teacher].filter(Boolean).join(" · ") : "";
  if (tline) { teach.hidden = false; teach.innerHTML = `${icon("user")} ${esc(tline)}`; } else teach.hidden = true;
  const loc = $("notif-loc"); if (x.location) { loc.hidden = false; loc.innerHTML = `${icon("pin")} ${esc(x.location)}`; } else loc.hidden = true;
  const lead = $("notif-lead"); if (x.lead) { lead.hidden = false; lead.innerHTML = `${icon("clock")} Emlékeztető ${esc(fmtLead(x.lead))} korábban`; } else lead.hidden = true;
  $("notif-sheet").classList.remove("hidden");
}
$("notif-ok").onclick = () => $("notif-sheet").classList.add("hidden");

// =====================================================================
//  SETTINGS
// =====================================================================
function syncSettings() {
  $("in-username").value = state.username || "";
  $("in-username-err").hidden = !!state.username;
  { const cf = $("in-code-field"), ci = $("in-code"); if (cf && ci) { if (state.neptunCode) { ci.value = state.neptunCode; cf.hidden = false; } else cf.hidden = true; } }
  refreshAccountBar();
  updateIcsStatus();
  $("in-password").value = state.password || "";
  $("cur-uni").textContent = state.university || "Nincs kiválasztva";
  renderServersSettings();
  renderTotpStatus();
  updateUpdateStatus();
  updateBreakMinStatus();
  syncSecurityToggles();
  { const b = $("app-bootsound"); if (b) b.classList.toggle("on", bootSoundOn()); }
  renderBioSetting();
  syncNotifySettings();
  syncSemStatus();
  syncProgStatus();
  syncBackupFreq();
  // Mirror live values onto the settings hub rows.
  const mir = (from, to) => { const a = $(from), b = $(to); if (a && b) b.textContent = a.textContent; };
  mir("cur-uni", "hub-uni-sub"); mir("update-status", "hub-update-sub");
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
const SEC_TOGGLES = [["sec-startup", "startup"], ["sec-resume", "resume"], ["sec-sensitive", "sensitive"], ["sec-actions", "actions"], ["sec-confirmsend", "confirmSend"]];
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
function renderBioSetting() {
  const btn = $("set-bio"), sub = $("set-bio-sub");
  if (!btn) return;
  btn.classList.toggle("on", !!state.biometric && bioOK);
  if (!bioOK) {
    btn.classList.add("disabled");
    if (sub) sub.textContent = "Az eszközöd most nem támogatja, vagy nincs beállítva.";
  } else {
    btn.classList.remove("disabled");
    if (sub) sub.textContent = state.biometric ? "Bekapcsolva. A kód tartalékként végig működik." : "Ujjlenyomat vagy arc a kód helyett.";
  }
}
$("set-bio").onclick = async () => {
  if (!bioOK) { toast("Az eszközöd most nem támogatja a biometrikus feloldást."); return; }
  if (state.biometric) {
    // Turning OFF is a protected change: require the code or biometrics first.
    if (!(await requireAuth())) return;
    state.biometric = false;
  } else {
    // Turning ON: confirm with biometrics; if that isn't possible, fall back to the code.
    let ok = false;
    try { await bioVerify(); ok = true; } catch { ok = await requireAuth(); }
    if (!ok) return;
    state.biometric = true;
  }
  saveState(); renderBioSetting();
};
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
{ const b = $("app-bootsound"); if (b) b.onclick = () => { state.bootSound = !bootSoundOn(); saveState(); b.classList.toggle("on", bootSoundOn()); if (bootSoundOn()) playBootChime(); }; }
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
// Account page uses STAGED editing: inputs don't auto-save; a Save/Cancel bar commits, and leaving
// with unsaved edits prompts. (The onboarding fields still auto-save — different flow.)
function accountDirty() {
  const u = $("in-username"), p = $("in-password");
  if (!u || !p) return false;
  return u.value !== (state.username || "") || p.value !== (state.password || "");
}
function refreshAccountBar() { const b = $("account-savebar"); if (b) b.hidden = !accountDirty(); }
function saveAccount() {
  const u = $("in-username").value.slice(0, 255);
  if (!u) { toast("Az azonosító nem lehet üres."); return false; }
  const old = state.username || "";
  state.username = u; state.password = $("in-password").value; saveState();
  renderHome(); refreshAccountBar();
  toast(old && old !== u ? "Azonosító mentve: " + old + " → " + u : "Mentve.");
  return true;
}
$("in-username").addEventListener("input", (e) => {
  e.target.value = e.target.value.slice(0, 255);
  $("in-username-err").hidden = e.target.value.length > 0;
  refreshAccountBar();
});
$("in-password").addEventListener("input", refreshAccountBar);
{ const s = $("account-save"); if (s) s.onclick = () => saveAccount(); }
{ const c = $("account-cancel"); if (c) c.onclick = () => { $("in-username").value = state.username || ""; $("in-password").value = state.password || ""; $("in-username-err").hidden = true; refreshAccountBar(); }; }
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
const openTotpHelp = () => $("totp-help-sheet").classList.remove("hidden");
$("ob-2fa-help").onclick = openTotpHelp;
$("set-2fa-help").onclick = openTotpHelp;
$("totp-help-close").onclick = () => $("totp-help-sheet").classList.add("hidden");

// ----- data export / import (encrypted backup & restore) -----
function FSP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }
const BACKUP_DIR = "neptunplus", BK_KEY_LS = "neptun-plus-bkkey";
function currentStateJson() {
  let obj = null; try { obj = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) {}
  if (!obj || typeof obj !== "object") obj = state;
  const copy = Object.assign({}, obj); delete copy.dlc; // DLCs are re-downloadable from GitHub — keep them out of the backup
  return JSON.stringify(copy);
}
function backupTs() { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()); }
// AES-GCM key kept in its own localStorage entry (survives "Minden adat törlése", which only clears STORE_KEY).
// Chunked to avoid "Maximum call stack size exceeded" on large buffers (fromCharCode.apply limit).
function b64(buf) { const bytes = new Uint8Array(buf); let bin = ""; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(bin); }
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
  const every = (state.backupEvery == null ? 1 : state.backupEvery);
  if (!every) return; // 0 = auto-backup off
  const today = Math.floor(Date.now() / 86400000);
  if (typeof state.lastBackup === "number" && today - state.lastBackup < every) return;
  try {
    const enc = await encryptBackup(currentStateJson());
    await fs.writeFile({ path: BACKUP_DIR + "/auto-" + backupTs() + ".npb", data: enc, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    try { const r = await fs.readdir({ path: BACKUP_DIR, directory: "DOCUMENTS" }); let autos = (r.files || []).map((f) => f && f.name ? f.name : f).filter((n) => typeof n === "string" && /^auto-.*\.npb$/i.test(n)).sort(); while (autos.length > 5) { const oldest = autos.shift(); await fs.deleteFile({ path: BACKUP_DIR + "/" + oldest, directory: "DOCUMENTS" }); } } catch (e) {}
    state.lastBackup = today; saveState();
  } catch (e) { /* silent */ }
}
const BACKUP_FREQ = [{ value: "0", label: "Kikapcsolva" }, { value: "1", label: "Naponta" }, { value: "2", label: "2 naponta" }, { value: "3", label: "3 naponta" }, { value: "7", label: "Hetente" }];
function backupFreqLabel() { const e = (state.backupEvery == null ? 1 : state.backupEvery); const f = BACKUP_FREQ.find((x) => +x.value === e); return f ? f.label : (e + " naponta"); }
function syncBackupFreq() { const el = $("backup-freq-status"); if (el) el.textContent = backupFreqLabel(); }
$("btn-backup-freq").onclick = () => {
  openList({ title: "Automatikus mentés gyakorisága", selected: String(state.backupEvery == null ? 1 : state.backupEvery), items: BACKUP_FREQ,
    onPick: (v) => { state.backupEvery = parseInt(v, 10) || 0; saveState(); syncBackupFreq(); } });
};
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
  if (isNative) return nativeLogin(srv, apiSessionValid(60000) ? apiSession.token : "");
  return browserPreviewLogin(srv);
};
function nativeLogin(srv, token) {
  const iab = window.cordova && window.cordova.InAppBrowser;
  if (!iab) { toast("InAppBrowser plugin hiányzik (lásd README)."); return; }
  const code = state.no2fa ? "" : lastCode;
  // API-first login (new Neptun): authenticate via the API, drop the token in, and load the
  // dashboard already logged in — independent of the login page's layout. Falls back to filling
  // the form (works on the standard Angular login) if the API isn't there / doesn't return a token.
  // If we already hold a still-valid warm token, inject it straight in → instant, no re-auth / no 2FA.
  const script = buildLoginScript(state.username, state.password, code, token || "");
  const opts = ["location=yes", "hideurlbar=no", "hidenavigationbuttons=no", "zoom=yes", "hardwareback=yes", "footer=no",
    "toolbarcolor=#141518", "navigationbuttoncolor=#ecedee", "closebuttoncolor=#ecedee", "closebuttoncaption=Kész"].join(",");
  const ref = iab.open(srv.url, "_blank", opts);
  ref.addEventListener("loadstop", () => { try { ref.executeScript({ code: script }); } catch (e) { /* ignore */ } });
  toast(token ? "Belépés (aktív munkamenet)…" : "Belépés folyamatban…");
}
// Combined login: reuse a warm token if given, else try the Neptun API (Account/Authenticate),
// then fall back to filling the form.
function buildLoginScript(username, password, code, token) {
  const u = JSON.stringify(username), p = JSON.stringify(password), c = JSON.stringify(code || ""), t = JSON.stringify(token || "");
  return `(function(){
  if(window.__npLoginRan) return; window.__npLoginRan=true;
  function setVal(el,val){ if(!el) return false; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); return true; }
  function click(el){ if(el){ el.click(); return true;} return false; }
  function visible(el){ return el && el.offsetParent!==null && !el.disabled; }
  function waitFor(sel,timeout){ return new Promise(function(res){ var t0=Date.now(); (function poll(){ var el=(typeof sel==='function')?sel():document.querySelector(sel); if(el&&visible(el)) return res(el); if(Date.now()-t0>timeout) return res(null); setTimeout(poll,250); })(); }); }
  function findCodeField(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){ if(!visible(el)||el.value) return false; var t=(el.type||'').toLowerCase(); if(['text','tel','number','password'].indexOf(t)===-1) return false; var hay=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); if(/code|otp|token|kod|kód|hitelesít|authent|2fa|mfa|one-time/.test(hay)) return true; var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0&&ml<=8; }); }
  function findSubmit(){ return Array.prototype.slice.call(document.querySelectorAll('button, input[type=submit]')).find(function(b){ if(!visible(b)) return false; var hay=((b.id||'')+' '+(b.innerText||b.value||'')+' '+(b.getAttribute('aria-label')||'')).toLowerCase(); return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|confirm|submit|login/.test(hay); }); }
  // Username / password / submit — work on both the new Angular (#userName …) and classic MVC (#LoginName …) pages.
  function findUser(){ var el=document.querySelector('#userName, #LoginName, input[name=LoginName], input[name=UserName], input[name=userName]'); if(el&&visible(el)) return el;
    return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(i){ if(!visible(i)) return false; var t=(i.type||'text').toLowerCase(); if(['text','email','tel'].indexOf(t)===-1) return false; var h=((i.id||'')+' '+(i.name||'')+' '+(i.placeholder||'')+' '+(i.getAttribute('aria-label')||'')).toLowerCase(); if(/keres|search/.test(h)) return false; var ml=parseInt(i.getAttribute('maxlength')||'0',10); if(ml>0&&ml<=8) return false; return true; }); }
  function findPass(){ return document.querySelector('#password-form-password, #Password, input[name=Password], input[type=password]'); }
  function findLoginBtn(){ return document.querySelector('#login-button') || findSubmit(); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function domLogin(){ click(document.querySelector('#notification-bar-0-notification-button-accept')); var user=await waitFor(findUser,10000); if(user){ setVal(user, ${u}); var pw=findPass(); if(pw) setVal(pw, ${p}); await sleep(200); var sb=findLoginBtn(); if(sb) click(sb); } var CODE=${c}; if(CODE){ var codeEl=await waitFor(findCodeField,12000); if(codeEl){ setVal(codeEl,CODE); await sleep(250); setVal(codeEl,CODE); await sleep(1000); var btn=await waitFor(findSubmit,8000); if(btn){ btn.click(); await sleep(700); if(visible(btn)) btn.click(); } } } }
  (async function(){
    try{
      if(sessionStorage.getItem('__npLogged')){ return; } // already logged in via API on a previous load
      var base=document.baseURI;
      var TOKEN=${t};
      if(TOKEN){ // warm token from the app → land on the dashboard instantly, no auth round-trip
        try{ sessionStorage.setItem('access_token',TOKEN); }catch(e){}
        try{ sessionStorage.setItem('__npLogged','1'); }catch(e){}
        location.href=base; return;
      }
      var authUrl=new URL('api/Account/Authenticate', base).href;
      var r=await fetch(authUrl,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'include',body:JSON.stringify({userName:${u},password:${p},captcha:"",captchaIdentifier:"",token:${c}||"",LCID:1038})});
      if(r && r.ok){ var d=null; try{ d=await r.json(); }catch(e){}
        var tok=d&&(d.accessToken||(d.data&&d.data.accessToken));
        if(tok){ try{ sessionStorage.setItem('access_token',tok); }catch(e){}
          var exp=d&&(d.accessTokenExpiration||d.accessTokenExpirationDate||(d.data&&(d.data.accessTokenExpiration||d.data.accessTokenExpirationDate))); if(exp){ try{ sessionStorage.setItem('access_token_expiration_date',exp); }catch(e){} }
          try{ sessionStorage.setItem('__npLogged','1'); }catch(e){}
          location.href=base; return; // load the dashboard, logged in — no buttons to press
        }
      }
      await domLogin(); // API not available or no token → fill the form the old way
    }catch(e){ try{ await domLogin(); }catch(_){} }
  })();
})();`;
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
  else { isLocked = false; $("lock").classList.add("hidden"); setTimeout(maybeOfferDataSync, 500); } // offer after cold-start unlock
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
attachPTR($("credit-scroll"), $("credit-ptr"), () => refreshCredit(false));       // credit-only refresh
attachPTR($("finance-scroll"), $("finance-ptr"), () => refreshFinance(false)); // finance-only
attachPTR($("messages-scroll"), $("messages-ptr"), () => refreshMessages(false)); // messages-only
attachPTR($("grades-scroll"), $("grades-ptr"), () => refreshGrades(false)); // grades-only
attachPTR($("periods-scroll"), $("periods-ptr"), () => refreshPeriods(false)); // periods-only
// Swipe left/right inside a sub-screen with tabs → move to the prev/next segment. Sub-screens aren't
// paged by the main-tab pager (it only handles MAIN_TABS), so horizontal swipes here are free to use.
function attachSegSwipe(el, order, getCur, setCur) {
  if (!el) return;
  let x0 = 0, y0 = 0, ok = false;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest("input,textarea,.seg,.wk-grid,.controls"))) { ok = false; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; ok = true;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.8) return; // must be a clear horizontal swipe
    const list = typeof order === "function" ? order() : order;
    const i = list.indexOf(getCur()), n = i + (dx < 0 ? 1 : -1);
    if (i >= 0 && n >= 0 && n < list.length) setCur(list[n]);
  }, { passive: true });
  el.addEventListener("touchcancel", () => { ok = false; }, { passive: true });
}
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
function hideBoot() { const b = $("boot"); if (!b) return; b.classList.add("boot--hide"); setTimeout(() => { b.hidden = true; }, 420); }

(async () => {
  const bootTs = Date.now();
  if (bootSoundOn()) playBootChime(); // little satisfying chime synced to the logo letters
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
    if (state.setupComplete) { setTimeout(dailyBackup, 2500); setTimeout(() => autoRefreshAll("start"), 1200); } // cold start → refresh every topic silently, no manual update needed
    else setTimeout(maybeOfferDataSync, 1600); // first launch (pre-setup path): offer the read once set up
  }
  // Keep the splash up long enough for the logo animation to play (min ~3000ms), then reveal the app/login.
  setTimeout(hideBoot, Math.max(0, 3000 - (Date.now() - bootTs)));
})();
