// Kézi számonkérés felvétele és szerkesztése.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
