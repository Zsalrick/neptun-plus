// Fejlesztői API diagnosztika.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
// A JWT claimjei olvasható formában (a hosszú értékeket, pl. aláírásokat, kihagyjuk).
function jwtClaims(tok) {
  try {
    const p = JSON.parse(atob(String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const out = {};
    Object.keys(p).forEach((k) => { const v = p[k]; out[k] = (typeof v === "string" && v.length > 120) ? "[hosszú érték kihagyva]" : v; });
    return out;
  } catch (e) { return null; }
}
// A base64 profilképeket kidobjuk a diagból: valódi emberek arcképei, és a fájl javát ők teszik ki.
function stripAvatars(o) {
  return JSON.parse(JSON.stringify(o, (k, v) => ((k === "normalImage" || k === "thumbnailImage") && v) ? "[kép kihagyva]" : v));
}
async function runApiDiagnostics() {
  if (!isNative) { toast("Az API diagnosztika a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  const ok = await ask({ title: "Oktató diagnosztika", okText: "Indítás", cancelText: "Mégse",
    body: "Bejelentkezik, és <b>csak lekéri</b> (nem küld és nem módosít semmit) egy tárgyad oktatóinak adatait, a személykártyát, a fogadóórát, valamint a saját azonosítóidat és egy diák-névsor első pár sorát, majd a JSON választ fájlba menti (Dokumentumok/neptunplus) és a vágólapra másolja.<br><br>A fájl <b>valódi személyes adatokat</b> tartalmaz (a neved, a Neptun-kódod és néhány csoporttársad neve). A profilképeket kihagyom belőle. Csak akkor küldd tovább, ha ezzel rendben vagy." });
  if (!ok) return;
  await totpTick();
  showBusy("Bejelentkezés…", true);
  const results = [];
  let cancelled = false;
  try {
    const sess = await getApiSession(true);
    if (!sess || !sess.token) { hideBusy(); await ask({ title: "Oktató diagnosztika", okText: "OK", body: "Nem sikerült tokent szerezni." }); return; }
    const probe = async (ep, params) => {
      $("busy-text").textContent = ep.split("/").pop() + "…";
      try { const r = await apiGet(sess, ep, params); results.push({ ep, verb: "GET", params: params || undefined, status: r.status, data: r.data }); return r.data && r.data.data; }
      catch (e) { results.push({ ep, verb: "GET", params: params || undefined, error: String(e && e.message || e) }); return null; }
    };
    // ---- TANÁR / OKTATÓ felderítés (csak olvas) ----
    // 1) egy valós kurzus (courseId + subjectId + termId) az órarendből, hogy a tanár-végpontok kössenek
    let ev = null, cTermId = "";
    try {
      let ids = []; try { const mt = await apiGet(sess, "MyTrainings"); ids = ((mt.data && mt.data.data) || []).map((t) => t.studentTrainingId).filter(Boolean); } catch (e) {}
      const now = Date.now(), span = 150 * 864e5;
      const cp = { startDate: new Date(now - span).toISOString(), endDate: new Date(now + span).toISOString(), studentTrainingIds: ids, isClassesVisible: true, isExamsVisible: false, isFinalExamsVisible: false, isOnlineMeetingsVisible: false, isOtherEventsVisible: false, isPeriodsVisible: false, isTasksVisible: false };
      const r = await apiGet(sess, "Calendar/GetCalendarEvents", cp);
      ev = ((r.data && r.data.data) || []).find((x) => x.courseId && x.subjectId) || null;
    } catch (e) {}
    results.push({ pickedEvent: ev ? { courseId: ev.courseId, subjectId: ev.subjectId, classInstanceId: ev.classInstanceId, courseTutor: ev.courseTutor, summary: ev.summary } : null });
    if (ev) { try { const cd = await apiGet(sess, "Calendar/GetCourseDetails", { classInstanceId: ev.classInstanceId, webexMeetingId: ev.webexMeetingId || "", isInstitutionalCalendar: false }); cTermId = (cd.data && cd.data.data && cd.data.data.termId) || ""; } catch (e) {} }
    const base = ev ? { courseId: ev.courseId, subjectId: ev.subjectId, termId: cTermId } : null;
    // 2) tanár-listás végpontok — a NYERS objektumot dumpoljuk, hogy MINDEN mezőt lássunk (email/tel?)
    let firstTutor = null;
    if (base) {
      const tutors = await probe("SubjectCourse/GetSubjectCourseTutors", base);
      if (Array.isArray(tutors) && tutors.length) firstTutor = tutors[0];
      await probe("SubjectCourse/GetSubjectDetails", base);
    }
    results.push({ firstTutorFields: firstTutor ? Object.keys(firstTutor) : null });
    // 3) egy tanár személykártyája — jár-e email/telefon egy hallgatónak?
    const tId = firstTutor && (firstTutor.employeeId || firstTutor.userId || firstTutor.id);
    if (tId) {
      await probe("UserSearch/GetUserData", { userId: tId });
      await probe("UserSearch/GetUserData", { userId: tId, personGroupId: "" });
    }
    // 4) fogadóóra / konzultáció (csak olvas + listáz)
    let consTerm = "";
    try { const r = await apiGet(sess, "Consultation/GetTerms"); const arr = (r.data && r.data.data) || []; consTerm = (arr[0] && (arr[0].value || arr[0].id)) || ""; results.push({ ep: "Consultation/GetTerms", status: r.status, data: r.data }); } catch (e) { results.push({ ep: "Consultation/GetTerms", error: String(e && e.message || e) }); }
    await probe("Consultation/GetConsultations", consTerm ? { termId: consTerm } : undefined);
    // ---- 5) SAJÁT NÉV felderítés: mi azonosít minket, és milyen mezői vannak a diák-névsornak? ----
    const self = {};
    self.neptunCode = state.neptunCode || "";
    self.jwtClaims = jwtClaims(sess.token);
    try { const mt = await apiGet(sess, "MyTrainings"); self.myTrainings = (mt.data && mt.data.data) || null; } catch (e) { self.myTrainingsError = String(e && e.message || e); }
    if (ev) {
      $("busy-text").textContent = "Diák névsor…";
      try {
        const r = await apiGet(sess, "SubjectCourse/GetSubjectCourseStudents", { courseId: ev.courseId, subjectId: ev.subjectId, selectedTermId: cTermId, firstRow: 0, lastRow: 5 });
        const list = (r.data && r.data.data) || [];
        self.studentCount = list.length;
        self.studentFields = list[0] ? Object.keys(list[0]) : null;
        self.students = list.slice(0, 5);
        const sid = list[0] && (list[0].userId || list[0].studentId || list[0].id);
        if (sid) { try { const u = await apiGet(sess, "UserSearch/GetUserData", { userId: sid }); self.studentUserData = u.data && u.data.data; } catch (e) {} }
      } catch (e) { self.studentsError = String(e && e.message || e); }
    }
    results.push({ self });
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("finance diag: " + (e && e.message ? e.message : e)); }
  hideBusy();
  if (cancelled && !results.length) { toast("Megszakítva"); return; }
  const fileName = BACKUP_DIR + "/apidiag-" + backupTs() + ".json";
  const json = JSON.stringify(stripAvatars({ base: apiSession && apiSession.base, grades: results }), null, 2);
  let fileMsg = "";
  try { const fs = FSP(); if (fs) { await fs.writeFile({ path: fileName, data: json, directory: "DOCUMENTS", encoding: "utf8", recursive: true }); fileMsg = "Fájlba mentve: <b>Dokumentumok/" + esc(fileName) + "</b>"; } }
  catch (e) { fileMsg = "Fájlba írás nem sikerült: " + esc(e && e.message ? e.message : String(e)); }
  try { await navigator.clipboard.writeText(json); } catch (e) {}
  const summary = results.filter((r) => r.ep).map((r) => `${r.discovered ? "🔎 " : ""}${esc(r.ep)} → ${r.error ? "HIBA" : r.status}`).join("<br>");
  await ask({ title: "Oktató diagnosztika", okText: "OK", cancelText: "Bezárás", body: `${fileMsg}<br>A vágólapra is másoltam.<br><br>${summary}` });
}
$("btn-apidiag").onclick = runApiDiagnostics;
