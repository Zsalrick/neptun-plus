// Tárgyfelvétel tervező és órarend-generátor.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  TÁRGYFELVÉTEL TERVEZŐ
//  A tervezetek HELYIEK (több is lehet), a Neptunhoz csak a tényleges felvételkor nyúlunk.
//  Végpontok (a publikus Neptun bundle-ből): SubjectApplication/{Terms,SystemParameters,
//  GetSubjectsCourses,SubjectSignin}. A felvétel törzse:
//  { courseIds, curriculumTemplateId, curriculumTemplateLineId, subjectId, termId }
// =====================================================================
function plans() { return (state.plans = state.plans || []); }
function planById(id) { return plans().find((p) => p.id === id) || null; }
function planCredits(p) { return (p.items || []).reduce((s, i) => s + (+i.credits || 0), 0); }
function planNew(name) {
  const p = { id: "p" + Date.now().toString(36), name: name || "Új tervezet", items: [], at: new Date().toISOString() };
  plans().unshift(p); saveState(); return p;
}
// Felvehető tárgyak: a mintatantervből, ami még nincs teljesítve. Offline is működik.
function planCandidates() {
  const req = (state.curriculum && state.curriculum.required) || [];
  return req.filter((s) => !s.completed && (s.name || s.code));
}
// Egy tárgy már benne van a tervezetben?
function planHas(p, s) { return (p.items || []).some((i) => (i.subjectId && i.subjectId === s.subjectId) || (i.code && i.code === s.code)); }

let planKey = "", planPickQuery = "";
function openPlan(id) { planKey = id; pushScreen("tab-plan"); }

// ---- Kurzus-modell (a Neptun GetSubjectsCourses válaszából) ----
// Egy TÁRGY alatt több kurzustípus van (Elmélet, Gyakorlat), típusonként több kurzus,
// egy kurzus alatt pedig több időpont (classInstanceInfos).
const PLAN_DAYS = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];
const PLAN_DAYS_ON = ["vasárnap", "hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton"];
function planDayIdx(info) {
  const n = info.dayOfWeek;
  if (typeof n === "number" && n >= 0 && n <= 6) return n;
  const t = searchNorm(info.dayOfWeekText || "");
  const i = PLAN_DAYS.findIndex((d) => searchNorm(d) === t);
  return i >= 0 ? i : -1;
}
function planMin(s) { // "08:00" → 480
  const m = String(s || "").match(/(\d{1,2})[:.](\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : -1;
}
// Egy kurzus időpontjai. Ha a kurzus nem heti rendszerességű, üres listát ad (nem tudjuk ütköztetni).
function courseSlots(c) {
  const infos = (c && c.classInstanceInfos) || [];
  if (!infos.length || infos[0].repetition === false) return [];
  return infos.map((x) => ({ d: planDayIdx(x), f: planMin(x.startTime), t: planMin(x.endTime) }))
    .filter((s) => s.d >= 0 && s.f >= 0 && s.t > s.f);
}
function courseTimeLabel(c) {
  const infos = (c && c.classInstanceInfos) || [];
  if (!infos.length) return "Nincs megadott időpont";
  if (infos[0].repetition === false) return "Változó időpontokban";
  return infos.map((x) => `${x.dayOfWeekText || PLAN_DAYS[planDayIdx(x)] || ""} ${x.startTime}-${x.endTime}`).join(" · ");
}
function slotsOverlap(a, b) { return a.d === b.d && a.f < b.t && b.f < a.t; }
function coursesConflict(a, b) {
  const sa = courseSlots(a), sb = courseSlots(b);
  for (const x of sa) for (const y of sb) if (slotsOverlap(x, y)) return true;
  return false;
}
// Egy tárgy kurzusai típusonként csoportosítva: { "Elmélet": [...], "Gyakorlat": [...] }
function courseGroups(item) {
  const out = {};
  ((item && item.courses) || []).forEach((c) => { const t = c.courseType || "Kurzus"; (out[t] = out[t] || []).push(c); });
  return out;
}
// Minden kitöltendő hely: tárgyanként és kurzustípusonként egy választás.
function planSlots(p) {
  const out = [];
  (p.items || []).forEach((i) => {
    const g = courseGroups(i);
    Object.keys(g).forEach((type) => out.push({ item: i, type, options: g[type] }));
  });
  return out;
}
function planSettings(p) { return (p.gen = p.gen || { conflicts: "none", avoidDays: [] }); }

// A választható félévek. Élesben a Neptuntól, különben a már beolvasott félévlistából.
async function planTerms() {
  if (isNative) {
    try {
      const sess = await getApiSession();
      if (sess && sess.token) {
        const r = await apiGet(sess, "SubjectApplication/Terms");
        const arr = (r && r.data && r.data.data) || [];
        const out = arr.map((t) => ({ id: t.value || t.id, label: t.text || t.label })).filter((t) => t.id && t.label);
        if (out.length) return out;
      }
    } catch (e) {}
  }
  const sems = (state.courses && state.courses.semesters) || [];
  return sems.map((s) => ({ id: "", label: s }));
}
// Új tervezet: ELŐBB félévet választunk, a név ebből jön, és a kurzusokat is erre kérjük le.
async function planNewFlow() {
  const terms = await planTerms();
  if (!terms.length) { toast("Nem találtam félévet. Olvasd be az adatokat a Neptunból."); return; }
  const pick = await askPick({ title: "Melyik félévre tervezel?",
    body: "A kurzusokat és a meghirdetett tárgyakat erre a félévre kérem le.",
    options: terms.map((t) => ({ label: t.label, value: t })) });
  if (!pick) return;
  const p = planNew(pick.label);
  p.termId = pick.id || ""; p.termLabel = pick.label;
  saveState(); renderPlans(); openPlan(p.id);
}
// Egy tárgy kurzusainak letöltése (típusonként több kurzus, kurzusonként több időpont).
async function planFetchCourses(sess, p, item) {
  const r = await apiGet(sess, "SubjectApplication/GetSubjectsCourses", flatParams({
    curriculumTemplateId: item.curriculumTemplateId || "", curriculumTemplateLineId: item.curriculumTemplateLineId || "",
    id: item.subjectId || "", termId: p.termId || "",
  }));
  const arr = (r && r.data && r.data.data) || (r && r.data) || [];
  item.courses = (Array.isArray(arr) ? arr : []).map((c) => ({
    id: c.id || c.courseId || "", courseCode: c.courseCode || c.code || "", courseType: c.courseType || "Kurzus",
    tutorName: c.tutorName || c.courseTutor || "", isFull: !!c.isFull,
    registeredStudentsCount: c.registeredStudentsCount, maxLimit: c.maxLimit, minLimit: c.minLimit,
    classInstanceInfos: c.classInstanceInfos || [],
  }));
  return item.courses.length;
}
async function planFetchAll(p) {
  if (!isNative) { toast("A kurzusok letöltése a telefonos alkalmazásban működik."); return; }
  const items = p.items || []; if (!items.length) return;
  showBusy("Kurzusok…", true);
  try {
    const sess = await getApiSession();
    if (!sess || !sess.token) throw new Error("Nincs kapcsolat a Neptunnal.");
    let got = 0, empty = [];
    for (const i of items) {
      $("busy-text").textContent = (i.name || "Tárgy") + "…";
      try { const n = await planFetchCourses(sess, p, i); if (n) got++; else empty.push(i.name || i.code); }
      catch (e) { empty.push(i.name || i.code); }
    }
    saveState(); hideBusy(); renderPlan();
    if (!got) await ask({ title: "Kurzusok", okText: "OK", body: "Egyik tárgyhoz sem találtam meghirdetett kurzust erre a félévre. Lehet, hogy ebben a félévben nincsenek meghirdetve, vagy a félév rosszul van kiválasztva." });
    else if (empty.length) toast(got + " tárgy kurzusai betöltve, " + empty.length + " tárgyhoz nincs meghirdetés.");
    else toast("Kurzusok betöltve.");
  } catch (e) { hideBusy(); await ask({ title: "Kurzusok", okText: "OK", body: "Nem sikerült: " + esc(String(e && e.message || e)) }); }
}
// A generálás eredményének beírása a tervezetbe (tárgyanként a kiválasztott kurzusok).
function planApplyPicks(p, picks) {
  (p.items || []).forEach((i) => { i.pick = {}; i.courseIds = []; });
  picks.forEach((x) => {
    const it = (p.items || []).find((i) => (i.subjectId && i.subjectId === x.subjectId) || (i.code && i.code === x.code));
    if (!it) return;
    it.pick = it.pick || {}; it.pick[x.type] = x.course.id;
    it.courseIds = Object.values(it.pick).filter(Boolean);
  });
  saveState();
}

// ---- ÓRAREND GENERÁTOR ----
// Tárgyanként/típusonként egy kurzust választ úgy, hogy teljesüljenek a beállítások.
// Visszatér: { ok, picks, conflicts } vagy { ok:false, reason } érthető magyarázattal.
function planGenerate(p) {
  const st = planSettings(p);
  const avoid = st.avoidDays || [];
  const slots = planSlots(p);
  if (!slots.length) return { ok: false, reason: "Nincs betöltött kurzus. Előbb töltsd be a tárgyak kurzusait." };
  // 1) Kiszűrjük a tiltott napokra eső kurzusokat, és megnézzük, marad-e választható.
  const prepared = slots.map((s) => {
    const all = s.options;
    const kept = all.filter((c) => { const sl = courseSlots(c); return !sl.some((x) => avoid.includes(x.d)); });
    return Object.assign({}, s, { kept, all });
  });
  const dead = prepared.find((s) => !s.kept.length);
  if (dead) {
    const days = new Set();
    dead.all.forEach((c) => courseSlots(c).forEach((x) => { if (avoid.includes(x.d)) days.add(x.d); }));
    const ds = [...days];
    const on = ds.map((d) => PLAN_DAYS_ON[d]).join(", ");       // szerdán
    const nom = ds.map((d) => PLAN_DAYS[d].toLowerCase()).join(", "); // szerda
    return { ok: false, reason: ds.length
      ? `A(z) „${dead.item.name}” tárgy ${dead.type} kurzusa csak ${on} van meghirdetve, ezért ${ds.length > 1 ? `ezek közül legalább egyet engedned kell: ${nom}` : `a ${nom} nem hagyható ki`}. Engedd vissza a napot, vagy vedd ki a tárgyat a tervezetből.`
      : `A(z) „${dead.item.name}” tárgy ${dead.type} kurzusához nincs használható időpont a beállításaiddal.` };
  }
  // 2) Legkevesebb választási lehetőség előre: így hamar kiderül, ha nincs megoldás.
  const order = prepared.slice().sort((a, b) => a.kept.length - b.kept.length);
  let best = null;
  const chosen = [];
  const limit = 20000; let steps = 0;
  function conflictsWith(c) { let n = 0; for (const x of chosen) if (coursesConflict(c, x.course)) n++; return n; }
  function search(ix, acc) {
    if (steps++ > limit) return;
    if (best && best.conflicts === 0) return;
    if (ix >= order.length) {
      if (!best || acc < best.conflicts) best = { conflicts: acc, picks: chosen.map((x) => ({ subjectId: x.slot.item.subjectId, code: x.slot.item.code, type: x.slot.type, course: x.course })) };
      return;
    }
    if (best && acc >= best.conflicts) return; // nem lesz jobb
    const s = order[ix];
    // A kevesebb ütközést okozó kurzust nézzük előbb.
    const opts = s.kept.slice().sort((a, b) => conflictsWith(a) - conflictsWith(b));
    for (const c of opts) {
      const add = conflictsWith(c);
      if (st.conflicts === "none" && add > 0) continue;
      chosen.push({ slot: s, course: c });
      search(ix + 1, acc + add);
      chosen.pop();
      if (best && best.conflicts === 0) return;
    }
  }
  search(0, 0);
  if (!best) {
    return { ok: false, reason: "Nem állítható össze ütközésmentes órarend ezekből a tárgyakból. Állítsd az ütközést „minél kevesebb”-re, vagy vegyél ki egy tárgyat a tervezetből." };
  }
  return { ok: true, picks: best.picks, conflicts: best.conflicts };
}
// A Neptun lista-végpontjai ?request.x=..&sortAndPage.firstRow=.. alakot várnak.
function flatParams(obj, out, prefix) {
  out = out || {}; prefix = prefix || "";
  Object.keys(obj || {}).forEach((k) => {
    const v = obj[k], key = prefix ? prefix + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatParams(v, out, key);
    else if (v != null) out[key] = v;
  });
  return out;
}
// A LEGFRISSEBB félévre felvett tárgyaid (ez a "jelenleg a Neptunban" állapot).
function currentTermCourses() {
  const list = (state.courses && state.courses.list) || [];
  if (!list.length) return [];
  // A félévlista a Neptuntól legfrissebb-elöl sorrendben jön, tehát az első a mostani.
  const sems = (state.courses && state.courses.semesters) || [];
  const newest = sems.length ? sems[0] : (list[0] && list[0].semester);
  return list.filter((c) => c.semester === newest);
}
function planItemFrom(c) {
  return { subjectId: c.subjectId || "", code: c.code || "", name: c.name || "", credits: +c.credits || 0,
    type: c.type || "", term: c.term || 0, courseIds: [], indexLineId: c.indexLineId || "", reg: true };
}
function sameSubject(a, b) { return (a.subjectId && a.subjectId === b.subjectId) || (a.code && a.code === b.code); }
// Tervezet vs a Neptunban ténylegesen felvett tárgyak. Ez adja a "mit kell csinálni" listát.
function planDiff(p) {
  const cur = currentTermCourses();
  const items = p.items || [];
  const add = items.filter((i) => !cur.some((c) => sameSubject(i, c)));
  const drop = cur.filter((c) => !items.some((i) => sameSubject(i, c)));
  const keep = items.filter((i) => cur.some((c) => sameSubject(i, c)));
  return { add, drop, keep, cur };
}
// Importálás: a jelenleg felvett tárgyakból készít tervezetet, hogy onnan lehessen átszabni.
function planImportRegistered() {
  const cur = currentTermCourses();
  if (!cur.length) { toast("Nincs beolvasott felvett tárgy. Frissítsd az adatokat."); return null; }
  const p = planNew("Jelenlegi félév");
  p.items = cur.map(planItemFrom); saveState(); return p;
}
// Importálás a Neptun SAJÁT tervezőjéből (ha tettél oda tárgyakat a böngészőben).
async function planImportNeptun() {
  if (!isNative) { toast("Ez az importálás a telefonos alkalmazásban működik."); return; }
  showBusy("Neptun tervezője…", true);
  try {
    const sess = await getApiSession();
    if (!sess || !sess.token) throw new Error("Nincs kapcsolat a Neptunnal.");
    let termId = "";
    try { const t = await apiGet(sess, "SubjectApplication/Terms"); const a = (t && t.data && t.data.data) || []; termId = (a[0] && (a[0].value || a[0].id)) || ""; } catch (e) {}
    if (!termId) termId = await getActualTermId(sess);
    const r = await apiGet(sess, "SubjectApplication/ScheduledSubjectsWithScheduledCourses",
      flatParams({ request: { termId, withRegisteredSubjects: true }, sortAndPage: { firstRow: 0, lastRow: 200 } }));
    const arr = (r && r.data && r.data.data) || [];
    hideBusy();
    if (!Array.isArray(arr) || !arr.length) { await ask({ title: "Neptun tervezője", okText: "OK", body: "A Neptun tervezőjében nem találtam tárgyat, vagy ez a végpont nem elérhető ezen az egyetemen." }); return; }
    const p = planNew("Neptun tervezőből");
    p.items = arr.map((x) => ({
      subjectId: x.subjectId || x.id || "", code: x.subjectCode || x.code || "", name: x.subjectName || x.name || "Tárgy",
      credits: +(x.credit || x.subjectCredit) || 0, type: x.requirementType || "", term: x.recommendedTerm || 0,
      courseIds: (x.courses || []).map((c) => c.id || c.courseId).filter(Boolean),
      curriculumTemplateId: x.curriculumTemplateId || "", curriculumTemplateLineId: x.curriculumTemplateLineId || "",
      indexLineId: x.indexLineId || x.indexlineId || "",
    }));
    saveState(); renderPlans(); openPlan(p.id);
  } catch (e) { hideBusy(); await ask({ title: "Neptun tervezője", okText: "OK", body: "Nem sikerült: " + esc(String(e && e.message || e)) }); }
}

function renderPlans() {
  const host = $("plans-scroll"); if (!host) return;
  const list = plans();
  let h = `<div class="hint" style="margin:0 2px 10px">A tervezetek csak nálad vannak. A Neptunhoz csak akkor nyúlunk, amikor tényleg felveszed a tárgyakat.</div>`;
  h += `<div class="detail-add" style="margin-bottom:10px"><button class="btn tonal" id="plan-new">${icon("plus")} Új tervezet</button></div>`;
  h += `<div class="dash-label">Importálás</div><div class="card">`
    + `<div class="row" id="plan-imp-reg" style="cursor:pointer"><span class="row-ic">${icon("book")}</span><span class="row-main"><span class="row-title">A jelenlegi félévemből</span><span class="row-sub">A most felvett tárgyaidból készít tervezetet, amit átszabhatsz</span></span>${icon("chev")}</div>`
    + `<div class="row" id="plan-imp-np" style="cursor:pointer"><span class="row-ic">${icon("down")}</span><span class="row-main"><span class="row-title">A Neptun tervezőjéből</span><span class="row-sub">Amit a Neptun saját tervezőjébe tettél</span></span>${icon("chev")}</div></div>`;
  if (!list.length) h += `<div class="dash-empty" style="padding:24px 2px">Még nincs tervezeted. Készíts egyet, és tedd össze előre a következő féléved.</div>`;
  else h += `<div class="card">` + list.map((p) => {
    const n = (p.items || []).length, kr = planCredits(p);
    return `<div class="row pl-row" data-pid="${esc(p.id)}" style="cursor:pointer"><span class="row-ic">${icon("clipboard")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(p.name)}</span>`
      + `<span class="row-sub">${n} tárgy · ${kr} kredit</span></span>${icon("chev")}</div>`;
  }).join("") + `</div>`;
  host.innerHTML = h;
  $("plan-new").onclick = planNewFlow;
  host.querySelectorAll(".pl-row").forEach((b) => b.onclick = () => openPlan(b.dataset.pid));
  $("plan-imp-reg").onclick = () => { const p = planImportRegistered(); if (p) { renderPlans(); openPlan(p.id); } };
  $("plan-imp-np").onclick = planImportNeptun;
}

function renderPlan() {
  const host = $("plan-scroll"); if (!host) return;
  const p = planById(planKey);
  const ttl = $("plan-title");
  if (!p) { if (ttl) ttl.textContent = "Tervezet"; host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Ez a tervezet már nincs meg.</div>`; return; }
  if (ttl) ttl.textContent = p.name;
  const items = p.items || [], kr = planCredits(items.length ? p : p);
  let h = `<div class="card kv"><div class="kv-row"><span class="kv-k">Tárgyak</span><span class="kv-v">${items.length}</span></div>`
    + `<div class="kv-row"><span class="kv-k">Kredit összesen</span><span class="kv-v">${kr}</span></div></div>`;
  h += `<div class="detail-add" style="margin-top:12px"><button class="btn tonal" id="plan-add">${icon("plus")} Tárgy hozzáadása</button></div>`;
  const { add, drop, cur } = planDiff(p);
  const isReg = (i) => cur.some((c) => sameSubject(i, c));
  if (items.length) {
    h += `<div class="dash-label">A tervezetben</div><div class="card">` + items.map((i, ix) => {
      const reg = isReg(i);
      const g = courseGroups(i), types = Object.keys(g);
      const picked = types.map((t) => {
        const cid = i.pick && i.pick[t];
        const c = cid && (i.courses || []).find((x) => x.id === cid);
        return c ? `${t}: ${courseTimeLabel(c)}` : null;
      }).filter(Boolean);
      const line2 = [i.code, (i.credits ? i.credits + " kr" : ""), reg ? "már felvéve" : "felveendő"].filter(Boolean).join(" · ");
      const line3 = picked.length ? picked.join(" · ")
        : (types.length ? types.length + " kurzustípus, válassz időpontot" : "Kurzusok nincsenek betöltve");
      return `<div class="row pl-item" data-ix="${ix}" style="cursor:pointer"><span class="row-ic">${icon("book")}</span>`
        + `<span class="row-main"><span class="row-title">${esc(i.name || "Tárgy")}</span>`
        + `<span class="row-sub">${esc(line2)}</span>`
        + `<span class="row-sub">${esc(line3)}</span></span>`
        + `<button class="iconbtn plain pl-del" data-ix="${ix}" type="button" title="Levétel a tervezetből">${icon("x")}</button></div>`;
    }).join("") + `</div>`;
    // ---- Órarend generátor ----
    const st = planSettings(p);
    h += `<div class="dash-label">Órarend</div><div class="card"><div class="card-pad">`
      + `<div class="hint" style="margin:0 0 10px">Ütközés</div>`
      + `<div class="seg" style="margin-bottom:14px">`
      + `<button class="seg-btn${st.conflicts === "none" ? " active" : ""}" data-cf="none" type="button">Nulla</button>`
      + `<button class="seg-btn${st.conflicts === "min" ? " active" : ""}" data-cf="min" type="button">Minél kevesebb</button></div>`
      + `<div class="hint" style="margin:0 0 8px">Ezeken a napokon ne legyen órám</div><div class="lead-row" style="padding:0">`
      + [1, 2, 3, 4, 5].map((d) => `<button class="lead-chip${(st.avoidDays || []).includes(d) ? " on" : ""}" data-day="${d}" type="button"`
        + `${(st.avoidDays || []).includes(d) ? ' style="border-color:var(--ink-2);color:var(--ink)"' : ""}>${PLAN_DAYS[d]}</button>`).join("")
      + `</div></div></div>`;
    h += `<div class="detail-add" style="margin-top:12px"><button class="btn tonal" id="plan-load">${icon("down")} Kurzusok betöltése a Neptunból</button></div>`;
    h += `<div class="detail-add" style="margin-top:8px"><button class="btn tonal" id="plan-gen">${icon("refresh")} Órarend összeállítása</button></div>`;
  }
  if (drop.length) {
    h += `<div class="dash-label">Leadásra jelölve</div><div class="card">` + drop.map((c) => {
      const sub = [c.code, (c.credits ? c.credits + " kr" : ""), "most fel van véve"].filter(Boolean).join(" · ");
      return `<div class="row"><span class="row-ic">${icon("x")}</span>`
        + `<span class="row-main"><span class="row-title">${esc(c.name || "Tárgy")}</span><span class="row-sub">${esc(sub)}</span></span>`
        + `<button class="iconbtn plain pl-keep" data-code="${esc(c.code || "")}" data-sid="${esc(c.subjectId || "")}" type="button" title="Mégis maradjon">${icon("plus")}</button></div>`;
    }).join("") + `</div>`;
    h += `<div class="hint" style="margin:8px 2px">Ezek most fel vannak véve a Neptunban, de nincsenek a tervezetben. Az alkalmazáskor leadom őket. A plusz gombbal visszateheted.</div>`;
  }
  if (items.length || drop.length) {
    const what = [add.length ? add.length + " felvétel" : "", drop.length ? drop.length + " leadás" : ""].filter(Boolean).join(" · ") || "nincs teendő";
    h += `<div class="detail-add" style="margin-top:14px"><button class="btn tonal friend-btn" id="plan-apply">${icon("check")} Tervezet alkalmazása · ${esc(what)}</button></div>`;
    h += `<div class="hint" style="margin:8px 2px">Csak a különbséget hajtom végre. Ami már jól van, azt nem bántom. Időszakon kívül a Neptun hibát ad, ez normális.</div>`;
  }
  h += `<div class="dash-label">Tervezet</div><div class="card">`
    + `<div class="row" id="plan-rename" style="cursor:pointer"><span class="row-ic">${icon("note")}</span><span class="row-main"><span class="row-title">Átnevezés</span></span>${icon("chev")}</div>`
    + `<div class="row" id="plan-delete" style="cursor:pointer"><span class="row-ic">${icon("x")}</span><span class="row-main"><span class="row-title" style="color:var(--danger)">Tervezet törlése</span></span></div></div>`;
  host.innerHTML = h;
  $("plan-add").onclick = () => { planPickQuery = ""; const q = $("plan-pick-q"); if (q) q.value = ""; pushScreen("tab-plan-pick"); };
  host.querySelectorAll(".pl-del").forEach((b) => b.onclick = () => { p.items.splice(+b.dataset.ix, 1); saveState(); renderPlan(); });
  $("plan-rename").onclick = async () => {
    const nm = await askText({ title: "Tervezet átnevezése", value: p.name, placeholder: "Név" });
    if (nm == null) return; p.name = nm.trim() || p.name; saveState(); renderPlan();
  };
  $("plan-delete").onclick = async () => {
    const ok = await ask({ title: "Tervezet törlése", okText: "Törlés", cancelText: "Mégse", body: `Biztosan törlöd?<br><b>${esc(p.name)}</b>` });
    if (!ok) return;
    state.plans = plans().filter((x) => x.id !== p.id); saveState(); popScreen(); renderPlans();
  };
  host.querySelectorAll(".pl-keep").forEach((b) => b.onclick = () => {
    const c = cur.find((x) => (b.dataset.sid && x.subjectId === b.dataset.sid) || (b.dataset.code && x.code === b.dataset.code));
    if (c) { p.items.push(planItemFrom(c)); saveState(); renderPlan(); }
  });
  host.querySelectorAll(".pl-item").forEach((b) => b.onclick = (ev) => {
    if (ev.target.closest(".pl-del")) return; // a törlés gomb ne nyissa meg
    planItemIx = +b.dataset.ix; pushScreen("tab-plan-courses");
  });
  host.querySelectorAll("[data-cf]").forEach((b) => b.onclick = () => { planSettings(p).conflicts = b.dataset.cf; saveState(); renderPlan(); });
  host.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => {
    const st = planSettings(p), d = +b.dataset.day;
    st.avoidDays = (st.avoidDays || []).includes(d) ? st.avoidDays.filter((x) => x !== d) : (st.avoidDays || []).concat(d);
    saveState(); renderPlan();
  });
  const lb = $("plan-load"); if (lb) lb.onclick = () => planFetchAll(p);
  const gb = $("plan-gen"); if (gb) gb.onclick = async () => {
    const r = planGenerate(p);
    if (!r.ok) { await ask({ title: "Nem sikerült összeállítani", okText: "OK", cancelText: "Bezárás", body: esc(r.reason) }); return; }
    planApplyPicks(p, r.picks);
    renderPlan();
    const lines = r.picks.map((x) => `· ${esc(x.code || "")} ${esc(x.type)}: ${esc(courseTimeLabel(x.course))}`).join("<br>");
    await ask({ title: r.conflicts ? "Kész, " + r.conflicts + " ütközéssel" : "Kész, ütközésmentes", okText: "OK", cancelText: "Bezárás",
      body: (r.conflicts ? "Ütközésmentesen nem ment, ennyi maradt: <b>" + r.conflicts + "</b>.<br><br>" : "") + lines });
  };
  const ab = $("plan-apply"); if (ab) ab.onclick = () => planApply(p);
}

// Egy tárgy kurzusai: típusonként (Elmélet, Gyakorlat) választhatsz időpontot.
let planItemIx = -1;
function renderPlanCourses() {
  const host = $("plan-courses-scroll"); if (!host) return;
  const p = planById(planKey);
  const item = p && (p.items || [])[planItemIx];
  const ttl = $("plan-courses-title");
  if (!item) { if (ttl) ttl.textContent = "Kurzusok"; host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Nincs adat.</div>`; return; }
  if (ttl) ttl.textContent = item.name || "Tárgy";
  const g = courseGroups(item), types = Object.keys(g);
  if (!types.length) {
    host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Ehhez a tárgyhoz nincsenek betöltve a kurzusok.</div>`
      + `<div class="detail-add" style="margin-top:12px"><button class="btn tonal" id="plc-load">${icon("down")} Kurzusok betöltése</button></div>`;
    $("plc-load").onclick = async () => {
      if (!isNative) { toast("A kurzusok letöltése a telefonos alkalmazásban működik."); return; }
      showBusy("Kurzusok…", true);
      try { const sess = await getApiSession(); await planFetchCourses(sess, p, item); saveState(); hideBusy(); renderPlanCourses(); }
      catch (e) { hideBusy(); toast("Nem sikerült betölteni."); }
    };
    return;
  }
  let h = "";
  types.forEach((t) => {
    h += `<div class="dash-label">${esc(t)}</div><div class="card">` + g[t].map((c) => {
      const on = item.pick && item.pick[t] === c.id;
      const meta = [c.courseCode, c.tutorName, (c.isFull ? "betelt" : ""),
        (c.registeredStudentsCount != null && c.maxLimit != null ? c.registeredStudentsCount + "/" + c.maxLimit : "")].filter(Boolean).join(" · ");
      return `<div class="row plc-row" data-type="${esc(t)}" data-cid="${esc(c.id)}" style="cursor:pointer"><span class="row-ic">${icon("clock")}</span>`
        + `<span class="row-main"><span class="row-title">${on ? `<span style="color:var(--ok)">● </span>` : ""}${esc(courseTimeLabel(c))}</span>`
        + (meta ? `<span class="row-sub">${esc(meta)}</span>` : "") + `</span>`
        + `<span style="color:var(--muted);padding:6px">${icon(on ? "check" : "plus")}</span></div>`;
    }).join("") + `</div>`;
  });
  host.innerHTML = h;
  host.querySelectorAll(".plc-row").forEach((b) => b.onclick = () => {
    item.pick = item.pick || {};
    if (item.pick[b.dataset.type] === b.dataset.cid) delete item.pick[b.dataset.type];
    else item.pick[b.dataset.type] = b.dataset.cid;
    item.courseIds = Object.values(item.pick).filter(Boolean);
    saveState(); renderPlanCourses();
  });
}
function renderPlanPick() {
  const host = $("plan-pick-scroll"); if (!host) return;
  const p = planById(planKey);
  const q = $("plan-pick-q");
  if (q && !q.dataset.wired) { q.dataset.wired = "1"; q.oninput = () => { planPickQuery = q.value; renderPlanPick(); }; }
  const norm = searchNorm(planPickQuery);
  let list = planCandidates();
  if (!list.length) { host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Nincs mintatanterv adat. Olvasd be a Neptunból az Adatok frissítésével.</div>`; return; }
  if (norm) list = list.filter((s) => searchNorm(s.name).includes(norm) || searchNorm(s.code).includes(norm));
  // Ajánlott félév szerint csoportosítva, mert a tervezéshez ez a leghasznosabb rendezés.
  const byTerm = {};
  list.forEach((s) => { const t = s.term || 0; (byTerm[t] = byTerm[t] || []).push(s); });
  const terms = Object.keys(byTerm).map(Number).sort((a, b) => a - b);
  let h = `<div class="hint" style="margin:0 2px 8px">${list.length} felvehető tárgy a mintatantervedből</div>`;
  terms.forEach((t) => {
    h += `<div class="dash-label">${t ? t + ". ajánlott félév" : "Nincs ajánlott félév"}</div><div class="card">`
      + byTerm[t].map((s) => {
        const inp = p && planHas(p, s);
        const sub = [s.code, (s.credits ? s.credits + " kr" : ""), s.type].filter(Boolean).join(" · ");
        return `<div class="row pk-row" data-sid="${esc(s.subjectId || "")}" data-code="${esc(s.code || "")}" style="cursor:pointer"><span class="row-ic">${icon("book")}</span>`
          + `<span class="row-main"><span class="row-title">${inp ? `<span style="color:var(--ok)">● </span>` : ""}${esc(s.name || "Tárgy")}</span>`
          + (sub ? `<span class="row-sub">${esc(sub)}</span>` : "") + `</span>`
          + `<span style="color:var(--muted);padding:6px">${icon(inp ? "check" : "plus")}</span></div>`;
      }).join("") + `</div>`;
  });
  host.innerHTML = h;
  host.querySelectorAll(".pk-row").forEach((b) => b.onclick = () => {
    if (!p) return;
    const s = planCandidates().find((x) => (b.dataset.sid && x.subjectId === b.dataset.sid) || (b.dataset.code && x.code === b.dataset.code));
    if (!s) return;
    if (planHas(p, s)) p.items = p.items.filter((i) => !((i.subjectId && i.subjectId === s.subjectId) || (i.code && i.code === s.code)));
    else p.items.push({ subjectId: s.subjectId || "", code: s.code || "", name: s.name || "", credits: +s.credits || 0, type: s.type || "", term: s.term || 0, courseIds: [] });
    saveState(); renderPlanPick();
  });
}

// A Neptun válaszából kiolvasott üzenet (a hibát is így adja vissza).
function planNote(r) {
  const d = r && r.data;
  const n = d && (d.notification || d.notifications);
  if (Array.isArray(n) && n.length) return String(n[0].message || n[0].text || n[0] || "");
  if (d && typeof d.message === "string") return d.message;
  return "";
}
// Egy tárgy leadása. indexLineId kell hozzá; ha nincs elmentve, megpróbáljuk kikeresni.
async function planDropOne(sess, c) {
  let ilid = c.indexLineId || "";
  if (!ilid && c.subjectId && c.termId) {
    try {
      const d = await apiGet(sess, "SubjectCourse/GetSubjectDetails", { courseId: "", subjectId: c.subjectId, termId: c.termId });
      ilid = (d && d.data && d.data.data && (d.data.data.indexlineId || d.data.data.indexLineId)) || "";
    } catch (e) {}
  }
  if (!ilid) return { ok: false, note: "nincs meg a felvételi sor azonosítója" };
  const r = await apiPost(sess, "SubjectApplication/SubjectSignout", { indexLineId: ilid });
  const note = planNote(r);
  return { ok: !!(r && r.status >= 200 && r.status < 300 && !note), note: note || (r ? "HTTP " + r.status : "hiba") };
}
// A tervezet ALKALMAZÁSA: felveszi, ami hiányzik, és leadja, ami már nem kell.
// Ez kezeli a meggondolást és az újratervezést is, nem csak a hozzáadást.
async function planApply(p) {
  if (!isNative) { toast("A felvétel a telefonos alkalmazásban működik."); return; }
  const { add, drop } = planDiff(p);
  if (!add.length && !drop.length) { await ask({ title: "Nincs teendő", okText: "OK", body: "A tervezet megegyezik azzal, ami a Neptunban most fel van véve." }); return; }
  const body = `A Neptunban ezt csinálom:<br><br>`
    + (add.length ? `<b>Felvétel (${add.length})</b><br>` + add.map((i) => "· " + esc(i.name || i.code)).join("<br>") + "<br><br>" : "")
    + (drop.length ? `<b>Leadás (${drop.length})</b><br>` + drop.map((i) => "· " + esc(i.name || i.code)).join("<br>") + "<br><br>" : "")
    + `Ez éles művelet. A leadás nem vonható vissza egy gombbal, és időszakon kívül mindkettő hibát ad.`;
  const ok = await ask({ title: "Tervezet alkalmazása", okText: "Végrehajtás", cancelText: "Mégse", body });
  if (!ok) return;
  showBusy("Alkalmazás…", true);
  const sess = await getApiSession();
  if (!sess || !sess.token) { hideBusy(); await ask({ title: "Alkalmazás", okText: "OK", body: "Nem sikerült kapcsolódni a Neptunhoz." }); return; }
  let termId = "";
  try { const t = await apiGet(sess, "SubjectApplication/Terms"); const arr = (t && t.data && t.data.data) || []; termId = (arr[0] && (arr[0].value || arr[0].id)) || ""; } catch (e) {}
  if (!termId) termId = await getActualTermId(sess);
  const lines = [];
  for (const c of drop) { // előbb a leadás, hogy felszabaduljon a keret és a létszámhely
    $("busy-text").textContent = "Leadás: " + (c.name || "") ;
    try { const r = await planDropOne(sess, c); lines.push(`${r.ok ? "✓" : "✗"} Leadás · ${esc(c.name || c.code)}${r.ok ? "" : " · " + esc(String(r.note).slice(0, 80))}`); }
    catch (e) { lines.push(`✗ Leadás · ${esc(c.name || c.code)} · ${esc(String(e && e.message || e).slice(0, 70))}`); }
  }
  for (const i of add) {
    $("busy-text").textContent = "Felvétel: " + (i.name || "");
    try {
      const r = await apiPost(sess, "SubjectApplication/SubjectSignin", {
        courseIds: i.courseIds || [], curriculumTemplateId: i.curriculumTemplateId || "",
        curriculumTemplateLineId: i.curriculumTemplateLineId || "", subjectId: i.subjectId || "", termId,
      });
      const note = planNote(r);
      const good = r && r.status >= 200 && r.status < 300 && !note;
      lines.push(`${good ? "✓" : "✗"} Felvétel · ${esc(i.name || i.code)}${good ? "" : " · " + esc((note || "HTTP " + (r ? r.status : "?")).slice(0, 80))}`);
    } catch (e) { lines.push(`✗ Felvétel · ${esc(i.name || i.code)} · ${esc(String(e && e.message || e).slice(0, 70))}`); }
  }
  hideBusy();
  await ask({ title: "Eredmény", okText: "OK", cancelText: "Bezárás", body: lines.join("<br>") + "<br><br><span style='color:var(--ink-3)'>Az Adatok frissítésével ellenőrizd, mi lett a végeredmény a Neptunban.</span>" });
}
