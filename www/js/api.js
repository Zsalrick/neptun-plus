// Közvetlen Neptun API: munkamenet, token, GET/POST, alap lekérések.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
// A saját nevünk a tokenből: a JWT claimek közt keressük a névnek látszó értéket (a 6 jegyű kód nem az).
// Magyar teljes névben van szóköz, ez jól elválasztja a felhasználónévtől és az azonosítóktól.
function tokenUserName(tok) {
  try {
    const p = JSON.parse(atob(String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const ok = (v) => typeof v === "string" && v.trim().length >= 4 && v.length <= 80
      && /\s/.test(v.trim()) && /[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(v) && !/[@\/\\{}<>]/.test(v);
    const prefer = ["printName", "PrintName", "printname", "fullName", "FullName", "displayName", "name", "unique_name"];
    for (const k of prefer) if (ok(p[k])) return p[k].trim();
    for (const k of Object.keys(p)) if (/name|nev/i.test(k) && ok(p[k])) return p[k].trim();
    return "";
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
      const sess = { base: res.base || "", token: res.token, at: Date.now(), exp: tokenExp(res.token) };
      if (!(await apiCheckIdentity(sess))) { apiSession = null; identityBlockedToast(); return null; }
      apiSession = sess;
      if (!state.identity) { // régi módszer, amíg a Neptun nem adott UserInfo-t (becslés a tokenből)
        const nc = (res.code && /^[A-Za-z0-9]{6}$/.test(res.code)) ? res.code.toUpperCase() : tokenNeptunCode(res.token);
        if (nc && nc !== state.neptunCode) { state.neptunCode = nc; saveState(); }
        const mn = tokenUserName(res.token); // a saját nevünk, hogy felismerjük magunkat a névsorokban
        if (mn && mn !== state.myName) { state.myName = mn; saveState(); }
      }
      onSessionChanged(); return apiSession;
    }
    return null;
  })();
  try { return await sessionInFlight; } finally { sessionInFlight = null; }
}
// ---------- saját Neptun-fiók (egy app = egy ember) ----------
// A név és a Neptun-kód az api/UserInfo-ból jön (ugyanonnan, ahonnan a Neptun fejléce). Az első sikeres
// belépéskor rögzítjük. A bejelentkezési azonosító átírható, de ha utána MÁSIK Neptun-kód lép be vele,
// a munkamenetet elutasítjuk. Profilonként és azonosítónként futásonként egyszer kérdezzük le.
let identityCheckedFor = "", identityToastAt = 0;
function identityKey() { return (state.activeProfileId || "") + "|" + (state.username || ""); }
async function apiCheckIdentity(sess) {
  if (identityCheckedFor === identityKey()) return true;
  let u = null;
  try { const r = await apiGet(sess, "UserInfo"); if (r && r.status === 200 && r.data) u = r.data.data || r.data; } catch (e) { u = null; }
  const code = u && /^[A-Za-z0-9]{6}$/.test(String(u.neptunCode || "")) ? String(u.neptunCode).toUpperCase() : "";
  if (!code) return true; // ponytail: nem elérhető (hálózat, más Neptun-verzió) → nem blokkolunk, a következő munkamenetnél újra
  const id = state.identity;
  if (id && id.code && id.code !== code) { state.identityMismatch = code; saveState(); return false; }
  identityCheckedFor = identityKey();
  const name = String(u.name || "").trim();
  state.identity = { code, name: name || (id && id.name) || "", at: new Date().toISOString() };
  state.identityMismatch = "";
  state.neptunCode = code;
  if (name) state.myName = name;
  saveState();
  return true;
}
function identityBlockedToast(force) {
  if (!state.identityMismatch || !state.identity) return;
  if (!force && Date.now() - identityToastAt < 20000) return;
  identityToastAt = Date.now();
  toast(`Ez a belépés egy másik Neptun-fiókhoz tartozik (${state.identityMismatch}). Ebben a profilban csak a(z) ${state.identity.code} fiók használható.`, 6000);
}
// Belépés előtt: a mostani azonosító a saját fiókunkhoz tartozik-e (ha még nem ellenőriztük).
async function identityOk() {
  if (!isNative || !state.identity || !state.identity.code) return true;
  if (identityCheckedFor === identityKey()) return !state.identityMismatch;
  const s = await getApiSession(true);
  return !(!s && state.identityMismatch);
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
// True while the boot/splash screen is on screen (logo + loading bar visible).
function bootVisible() { const b = $("boot"); return !!(b && !b.hidden && !b.classList.contains("boot--hide")); }
async function autoRefreshAll(reason) {
  if (!isNative || !state.setupComplete || !canAutoLogin()) return;
  if (autoRefreshing || flowActive) return;
  autoRefreshing = true; state.lastAutoRefresh = Date.now(); try { renderHome(); } catch (e) {}
  const onBoot = bootVisible();
  const fresh = missingTaskIds().length >= DATA_TASKS.length; // nothing cached yet → first fetch
  if (onBoot) { setBootText(fresh ? "Adatok lekérdezése" : "Adatok frissítése"); bootProgress(0, DATA_TASKS.length); }
  try {
    const sess = await getApiSession(); if (!sess) return; // no token → nothing to read
    try { seedBackgroundRunner(sess); } catch (e) {} // háttér-runner feltöltése (creds + on/off)
    let done = 0;
    for (const t of DATA_TASKS) {
      // On auto-start, skip rarely-changing topics (félévek/tárgyak/mintatanterv) if still fresh — big speedup.
      const stamp = t.maxAge && t.stamp && t.stamp();
      const skip = (reason === "start" || reason === "resume") && t.maxAge && t.has() && stamp && (Date.now() - Date.parse(stamp) < t.maxAge);
      if (!skip) { try { await totpTick(); await t.run(); } catch (e) { dbg("autoRefresh " + t.id + ": " + (e && e.message ? e.message : e)); } }
      done++; if (onBoot) bootProgress(done, DATA_TASKS.length);
      try { renderHome(); } catch (e) {}
    }
    try { refreshAgendas(); } catch (e) {}
    try { await notifyChanges(); } catch (e) {} // változás-értesítők (új jegy/üzenet/befizetendő/órarend)
    try { catchUpBrief(); } catch (e) {} // a reggeli összefoglaló bekerül az Értesítésekbe (frissen)
  } catch (e) { dbg("autoRefreshAll: " + (e && e.message ? e.message : e)); } // never reject → boot can't hang on us
  finally { autoRefreshing = false; try { renderHome(); } catch (e) {} }
}
// Visszatéréskor (az Android az appot többnyire a memóriában tartja, így ritka a hideg indítás) is frissítünk,
// ha a legutóbbi teljes frissítés 20 percnél régebbi. Enélkül a változás-értesítők (órarend, jegy, üzenet)
// csak hideg indításkor futottak le, vagyis napokig nem vettek észre semmit.
function resumeRefresh() {
  if (!state.setupComplete || autoRefreshing) return;
  if (state.lastAutoRefresh && Date.now() - state.lastAutoRefresh < 20 * 60e3) return;
  autoRefreshAll("resume");
}
// Show the boot/splash screen (Kredit+ logo + loading bar) and run a full data fetch on it, then hide it.
// Used right after onboarding / adding a profile so the first read has the same clean full-screen loader
// as a cold start — no popup. Capped so a slow network can't hold the splash forever.
async function bootFetch(reason) {
  const b = $("boot");
  if (b) { b.hidden = false; b.classList.remove("boot--hide"); }
  setBootText("Adatok lekérdezése"); bootProgress(0, DATA_TASKS.length);
  await Promise.race([autoRefreshAll(reason), new Promise((r) => setTimeout(r, 30000))]);
  hideBoot();
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
    // indexLineId = a tárgyfelvételi sor azonosítója, ez kell a LEADÁSHOZ (SubjectSignout).
    arr.forEach((s) => { out.push({ code: s.subjectCode || "", name: s.subjectName || "", credits: +s.subjectCredit || 0, completed: false, semester: t.label, teacher: "", type: s.requirementType || "", subjectId: s.subjectId || "", termId: t.id, indexLineId: s.indexLineId || s.indexlineId || "" }); });
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
  // Tanszék az oktatókhoz — a személykártyáról (email/telefon nem jár egy hallgatónak, csak szervezet).
  const tut = tutors || [];
  await Promise.all(tut.map(async (t) => {
    if (!t.employeeId) return;
    try { const d = await g("UserSearch/GetUserData", { userId: t.employeeId }); const orgs = d && d.additionalEmployeeData && d.additionalEmployeeData.organizationNames; if (orgs && orgs.length) t.org = String(orgs[orgs.length - 1] || "").trim(); } catch (e) {}
  }));
  return { course, tutors: tut, detail: detail || {}, students: students || [], reqs: reqs || [] };
}
// Subject-level detail for the Tárgyak list (no course context): GetSubjectDetails + prerequisites +
// general requirements. termId defaults to the actual term. Returns { detail, prereqs, reqs } or null.
let actualTermId = "";
async function getActualTermId(sess) {
  if (actualTermId) return actualTermId;
  try { const mt = await apiGet(sess, "MyTrainings"); const t = mt && mt.data && mt.data.data && mt.data.data[0]; actualTermId = (t && t.actualTermId) || ""; harvestMyName(t); } catch (e) {}
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
