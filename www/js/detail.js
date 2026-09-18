// Óra/számonkérés részletei: tárgy, oktatók, diákok, megjegyzések.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
// Oktató kör-avatar: valódi fotó (base64 JPEG a Neptunból) vagy színes monogram (fallback szín + kezdőbetűk).
function tutorAvatar(t) {
  const a = (t && t.avatar) || {};
  const img = a.normalImage || a.thumbnailImage;
  const base = "width:34px;height:34px;border-radius:50%;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;font-size:13px;font-weight:600;color:#fff";
  if (img) return `<span style="${base}"><img src="data:image/jpeg;base64,${img}" style="width:100%;height:100%;object-fit:cover" alt=""></span>`;
  const nm = String(a.printName || t.printname || t.nickname || "").replace(/^dr\.?\s+/i, "").trim();
  const p = nm.split(/\s+/);
  const ini = (((p[0] || "")[0] || "") + ((p[1] || "")[0] || "")).toUpperCase() || "?";
  const col = /^[0-9a-fA-F]{6}$/.test(a.fallbackColorCodeInHexa || "") ? "#" + a.fallbackColorCodeInHexa : "#6b7280";
  return `<span style="${base};background:${col}">${esc(ini)}</span>`;
}
function renderDetail() {
  const e = detailEvent; if (!e) return;
  const body = $("detail-body"), footer = $("event-footer"); if (!body) return;
  const pp = !e.manual ? parseClassSummary(e.summary) : null; // "Tárgy ( - KÓD) - Oktató - Típus" → név a címben
  const sub = e.subject || (pp ? [pp.type, pp.teacher].filter(Boolean).join(" · ") : "");
  let html = `${sub ? `<div class="detail-subj">${esc(sub)}</div>` : ""}<div class="sheet-title">${esc((pp && pp.name) || e.summary || "Esemény")}</div>
    <div class="detail-meta">${icon("clock")} ${esc(dayHeading(e.S))} · ${hm(e.S)}${e.E > e.S ? "-" + hm(e.E) : ""}${e.location ? ` &nbsp;·&nbsp; ${icon("pin")} ${esc(e.location)}` : ""}</div>`;
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
  const frN = detailCourse && detailCourse.students ? friendsInRoster(detailCourse.students) : 0;
  const segs = [["info", "Tárgy"], ["tutors", "Oktatók"], ["students", frN ? "Diákok · " + frN : "Diákok"], ["notes", "Megjegyzések"]];
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
    const norm = (s) => String(s || "").replace(/^dr\.?\s+/i, "").trim().toLowerCase();
    const owner = norm(c.detail && c.detail.ownerPrintName);
    host.innerHTML = list.length ? `<div class="card">` + list.map((t) => {
      const isOwner = owner && norm(t.printname) === owner;
      const sub = [];
      if (t.nickname && t.nickname !== t.printname) sub.push(esc(t.nickname));
      if (t.org) sub.push(esc(t.org));
      return `<div class="row"><span class="row-ic" style="padding:0">${tutorAvatar(t)}</span><span class="row-main"><span class="row-title">${esc(t.printname || t.nickname || "Oktató")}${isOwner ? ` <span style="color:var(--muted);font-weight:400">· Tárgyfelelős</span>` : ""}</span>${sub.length ? `<span class="row-sub">${sub.join(" · ")}</span>` : ""}</span></div>`;
    }).join("") + `</div>`
      : `<div class="dash-empty" style="padding:18px 2px">${detailCourseErr ? "Nem sikerült betölteni." : (c.course && c.course.courseTutor ? esc(c.course.courseTutor) : "Nincs megadott oktató.")}</div>`;
    return;
  }
  if (detailSeg === "students") {
    const list = c.students || [];
    if (!list.length) { host.innerHTML = `<div class="dash-empty" style="padding:18px 2px">${detailCourseErr ? "Nem sikerült betölteni." : "Nincs elérhető hallgatói névsor."}</div>`; return; }
    const me = list.filter(isMe);
    const fr = list.filter((s) => !isMe(s) && isFriend(s));
    const other = list.filter((s) => !isMe(s) && !isFriend(s));
    const row = (s, opts) => {
      const f = isFriend(s), k = friendId(s);
      const self = !!(opts && opts.self);
      return `<div class="row${self ? "" : " st-row"}"${self ? "" : ` data-fk="${esc(k)}" style="cursor:pointer"`}><span class="row-ic">${icon("user")}</span>`
        + `<span class="row-main"><span class="row-title">${f ? `<span style="color:var(--ok)">● </span>` : ""}${esc(studentName(s))}</span>`
        + (s.nickname && !self && searchNorm(s.nickname) !== searchNorm(studentName(s)) ? `<span class="row-sub">${esc(s.nickname)}</span>` : "")
        + `</span>${self ? "" : icon("chev")}</div>`;
    };
    let h = fr.length
      ? `<div class="hint" style="margin:0 2px 8px">${list.length} hallgató · ${fr.length} barátod jár ide</div>`
      : `<div class="hint" style="margin:0 2px 8px">${list.length} hallgató</div>`;
    if (me.length) h += `<div class="dash-label">Én</div><div class="card">` + me.map((s) => row(s, { self: true })).join("") + `</div>`;
    if (fr.length) h += `<div class="dash-label">Barátok · ${fr.length}</div><div class="card">` + fr.map((s) => row(s)).join("") + `</div>`;
    if (other.length) h += `<div class="dash-label">Hallgatók · ${other.length}</div><div class="card">` + other.map((s) => row(s)).join("") + `</div>`;
    host.innerHTML = h;
    host.querySelectorAll(".st-row").forEach((b) => b.onclick = () => {
      const s = list.find((x) => friendId(x) === b.dataset.fk);
      if (s) openPerson(b.dataset.fk, { n: studentName(s), id: s.studentId || s.id || "", nk: s.nickname || "", c: [] });
    });
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
  host.innerHTML = matDetailLink(e) + h;
  const ml = $("dn-mats"); if (ml) ml.onclick = () => openMatSubject(ml.dataset.sem, ml.dataset.name);
}
