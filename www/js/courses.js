// Tárgyak oldal és tárgy részletei.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
  html += `<div class="tt-updated" style="margin:2px 4px 12px">${esc(freshText(state.courses && state.courses.fetchedAt))}</div>`;
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
  html += `<div class="tt-updated" style="margin:2px 4px 12px">${esc(freshText(cur.fetchedAt))}</div>`;
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
