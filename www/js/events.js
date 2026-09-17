// Idő- és eseménymodell: dátum-segédek, félévek, órák és számonkérések listája.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
function isOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }
// Unified freshness line used on every data screen: online → "Frissítve: …", offline → an explicit
// "Offline · a mentett adatok: …" so it's clear the numbers may be stale.
function freshText(iso) {
  const when = iso ? fmtWhen(iso) : null;
  if (isOffline()) return when ? ("Offline · a mentett adatok: " + when) : "Offline · nincs mentett adat";
  return when ? ("Frissítve: " + when) : "Frissítve: még soha";
}
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
function currentSemesterKey() { return semObj(new Date()).key; }
