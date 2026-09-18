// Alap: verzió, ikonok, állapot és profilok tárolása, apró segédfüggvények, biometria.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

const STORE_KEY = "neptun-plus";
const APP_VERSION = "v0.311";
const $ = (id) => document.getElementById(id);

// ---------- icons (line SVG, no emoji) ----------
const P = {
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3m-3 3 2 2m-4 0 2 2"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
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
  theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
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
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V12m0-4.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.9-2.6L4.3 14a1.6 1.6 0 0 1 2.6-1.8L8 13.5"/>',
  marker: '<path d="m9 15 7.5-10.5a1.8 1.8 0 0 1 2.9 2.2L12 17l-3.5.5L9 15Z"/><path d="M8.5 17.5 6 20h5M4 21h16"/>',
  eraser: '<path d="m7 21-4.3-4.3a1.5 1.5 0 0 1 0-2.1l9.9-9.9a1.5 1.5 0 0 1 2.1 0l5.6 5.6a1.5 1.5 0 0 1 0 2.1L12 21Z"/><path d="M21 21H7M5.5 12.5l6 6"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  zoomin: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomout: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
};
function icon(name) { return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`; }
function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute("data-icon"); });
}

// ---------- state ----------
// Per-profile fields: everything tied to ONE Neptun identity (one university's login + its data).
// These live at the top level of `state` for the ACTIVE profile (so all existing code keeps working),
// and are mirrored into state.profiles[] on save; switching a profile swaps them in/out.
const PROFILE_FIELDS = ["university", "servers", "activeServerId", "username", "password", "no2fa", "totp", "icsUrl", "courses", "curriculum", "ics", "manualExams", "notes", "hiddenOcc", "semesters", "progress", "neptunCode", "finance", "messages", "grades", "periods", "calcGoals", "calcPreds", "seen", "notifLog", "refCode", "friends", "people", "myName", "myId", "myTraining", "plans", "materials", "identity", "identityMismatch"];
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
    identity: null, // { code, name, at }: a Neptun api/UserInfo szerinti saját fiók, az első sikeres belépéskor rögzítve
    identityMismatch: "",
    ui: null, // { sem, v: { gradesFilter, coFilter, ttView, ... } }: a képernyők szűrői (init.js saveUiState), eszközszintű // ha a mentett azonosítóval MÁSIK Neptun-kód lép be, annak kódja (a munkamenetet elutasítjuk)
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
      periods: { enabled: false, leads: [1440, 60] }, // időszak nyitása/zárulása előtt (1 nap + 1 óra)
      changes: { enabled: false }, // új jegy / üzenet / befizetendő / órarend-változás appnyitáskor (nincs lead)
      brief: { enabled: false, time: "07:00" }, // reggeli összefoglaló egy adott időpontban
    },
    seen: null, // { gradeKeys, offered, msgs, toPay, classes:[{k,t}], at } — a legutóbb "látott" állapot a változás-értesítőkhöz
    notifLog: [], // [{ id, at, read, kind, title, body, detail, target }] — in-app értesítési központ (30 nap)
    refCode: "", // ajánlói kód (egyelőre helyi mintakód; a végleges a backendtől jön)
    calcGoals: {}, // { "<félév>": { type:"ki"|"suly", val:Number } } — mentett cél a kalkulátorhoz
    calcPreds: {}, // { "<félév>": { "<tárgykulcs>": jegy } } — a kalkulátorban beállított becsült jegyek
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
  ["classes", "zh", "vizsga", "periods"].forEach((c) => { if (!s.notify[c]) s.notify[c] = { enabled: d.notify[c].enabled, leads: d.notify[c].leads.slice() }; if (!Array.isArray(s.notify[c].leads)) s.notify[c].leads = d.notify[c].leads.slice(); });
  if (!Array.isArray(s.notifLog)) s.notifLog = [];
  if (!s.notify.changes) s.notify.changes = { enabled: false };
  if (!s.notify.brief) s.notify.brief = { enabled: false, time: "07:00" };
  if (!s.calcGoals || typeof s.calcGoals !== "object") s.calcGoals = {};
  if (!s.calcPreds || typeof s.calcPreds !== "object") s.calcPreds = {};
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
function uid() { return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
