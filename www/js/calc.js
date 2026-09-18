// Átlag- és kreditindex-kalkulátor.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---------- Átlag / kreditindex kalkulátor ----------
// No combinatorics: forward (pick a predicted grade per subject → live indices) + backward
// (enter a target index → the single average needed across the remaining credits).
let calcTerm = null, calcTargetType = "ki", calcTargetVal = null;
let calcSession = {}; // { term: { key: grade } } — what-if overrides for ALREADY-graded subjects; in-memory only (revert on restart)
// Predictions for not-yet-graded subjects persist per term (state.calcPreds); overrides of real grades don't.
function calcSetGrade(r, g) {
  if (!r) return;
  if (r.actual != null) { (calcSession[calcTerm] || (calcSession[calcTerm] = {}))[r.key] = g; } // session-only, not saved
  else { const m = (state.calcPreds || (state.calcPreds = {})); (m[calcTerm] || (m[calcTerm] = {}))[r.key] = g; saveState(); }
}
function calcTermList() {
  const s = new Set();
  ((state.courses && state.courses.list) || []).forEach((c) => { if (c.semester) s.add(c.semester); });
  ((state.grades && state.grades.terms) || []).forEach((t) => { if (t.termName) s.add(t.termName); });
  return [...s].sort((a, b) => (b > a ? 1 : b < a ? -1 : 0)); // newest first
}
function calcRows(term) {
  const rows = [], seen = new Set();
  const gTerm = ((state.grades && state.grades.terms) || []).find((t) => t.termName === term);
  const byCode = {}; if (gTerm) gTerm.subjects.forEach((x) => { if (x.code) byCode[x.code] = x; });
  ((state.courses && state.courses.list) || []).filter((c) => c.semester === term).forEach((c) => {
    const g = c.code ? byCode[c.code] : null;
    const v = g ? (g.value != null ? g.value : gradeValue(g.result)) : null;
    if (c.code) seen.add(c.code);
    rows.push({ key: c.code || c.subjectId || c.name, name: c.name || (g && g.subject) || "Tárgy", code: c.code || "", credits: +c.credits || 0, actual: (v >= 1 && v <= 5) ? v : null });
  });
  if (gTerm) gTerm.subjects.forEach((x) => {
    if (x.code && seen.has(x.code)) return;
    const v = x.value != null ? x.value : gradeValue(x.result);
    rows.push({ key: x.code || x.subjectId || x.subject, name: x.subject || "Tárgy", code: x.code || "", credits: +x.credits || 0, actual: (v >= 1 && v <= 5) ? v : null });
  });
  return rows;
}
function calcGradeOf(r) {
  if (r.actual != null) { const s = (calcSession[calcTerm] || {})[r.key]; return (s >= 1 && s <= 5) ? s : r.actual; }
  const p = ((state.calcPreds || {})[calcTerm] || {})[r.key]; return (p >= 1 && p <= 5) ? p : 4;
}
function calcCompute(rows) {
  let n = 0, sumG = 0, cAll = 0, cDone = 0, ptsDone = 0;
  // 0-credit subjects (criterion, e.g. testnevelés) carry no weight and no numeric grade → skip entirely.
  rows.forEach((r) => { const c = r.credits; if (!c) return; const g = calcGradeOf(r); if (!g) return; n++; sumG += g; cAll += c; if (g >= 2) { cDone += c; ptsDone += c * g; } });
  return { n, cAll, cDone, atlag: n ? sumG / n : 0, suly: cDone ? ptsDone / cDone : 0, ki: ptsDone / 30, kki: cAll ? (ptsDone / 30) * (cDone / cAll) : 0 };
}
// Assume every subject passes (grade>=2). locked = has a real grade; open = predicted.
function calcTargetSolve(rows, type, target) {
  let cAll = 0, lockedPts = 0, openCr = 0, openN = 0;
  rows.forEach((r) => { const c = r.credits; if (!c) return; cAll += c; if (r.actual != null) lockedPts += c * r.actual; else { openCr += c; openN++; } });
  if (openCr <= 0) return { none: true };
  const needPts = (type === "suly") ? (target * cAll - lockedPts) : (30 * target - lockedPts);
  const reqAvg = needPts / openCr;
  return { reqAvg, openCr, openN, feasible: reqAvg <= 5.0001, trivial: reqAvg <= 1.0001 };
}
const cf2 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(".", ","); // kijelzés: magyar tizedesvessző
function renderCalc() {
  const host = $("calc-scroll"); if (!host) return;
  const gbtn = $("calc-goal-btn"); if (gbtn) gbtn.hidden = true; // shown only once real subjects exist
  const terms = calcTermList();
  if (!terms.length) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("chart")}</div>`
      + `<h2>Nincs adat</h2><p>Előbb olvasd be a tárgyaidat és jegyeidet, hogy számolni tudjak.</p>`
      + `<button class="btn primary narrow" id="calc-read" style="margin-top:4px">${icon("chart")} Beolvasás</button></div>`;
    const b = $("calc-read"); if (b) b.onclick = () => openDataSync(["courses", "grades"]);
    return;
  }
  if (!calcTerm || terms.indexOf(calcTerm) < 0) calcTerm = terms[0];
  const rows = calcRows(calcTerm), c = calcCompute(rows);
  let html = `<div class="controls dd-row"><button class="period-btn dd" id="calc-term" type="button"><span>${esc(fmtTerm(calcTerm))}</span>${icon("down")}</button></div>`;
  html += `<div class="stat-hero">`
    + `<div class="stat-hero-v">${cf2(c.suly)}</div><div class="stat-hero-l">Súlyozott átlag</div>`
    + `<div class="stat-hero-sub">`
    + `<div class="chs"><span class="chs-v">${cf2(c.atlag)}</span><span class="chs-l">Átlag</span></div>`
    + `<div class="chs"><span class="chs-v">${cf2(c.ki)}</span><span class="chs-l">Kreditindex</span></div>`
    + `<div class="chs"><span class="chs-v">${cf2(c.kki)}</span><span class="chs-l">Korrigált</span></div>`
    + `</div></div>`;
  // Saved goal for this term → coloured status (Elérve / Haladó / Nem érhető el).
  const goal = (state.calcGoals || {})[calcTerm];
  if (goal && goal.val != null) {
    const st = calcGoalStatus(rows, c, goal);
    html += `<button class="calc-goal ${st.cls}" id="calc-goal-status" type="button">`
      + `<span class="cg-l">Cél · ${goal.type === "suly" ? "Súlyozott" : "Kreditindex"} ${cf2(goal.val)}</span>`
      + `<span class="cg-s">${st.label}</span></button>`;
  }
  if (!rows.length) { host.innerHTML = html + `<div class="dash-empty" style="padding:20px 4px">Ehhez a félévhez nincs tárgy.</div>`; wireCalcTerm(terms); wireGoalBtn(gbtn); return; }
  html += `<div class="dash-label">Tárgyak · ${rows.length}</div><div class="card">`;
  rows.forEach((r) => {
    const zero = !r.credits;
    const g = calcGradeOf(r);
    const flag = zero ? "" : (r.actual == null ? "Becslés" : (g === r.actual ? "Meglévő jegy" : "Módosítva"));
    const body = zero
      ? `<div class="cg-zero">0 kredites tárgy · nem számít az átlagba</div>`
      : `<div class="cg-seg">${[1, 2, 3, 4, 5].map((n) => `<button class="cg-o${n === g ? " on" : ""}${n === r.actual ? " act" : ""}" data-cg="${esc(r.key)}" data-g="${n}" type="button">${n}</button>`).join("")}</div>`;
    html += `<div class="calc-row"><div class="cr-top"><div class="cr-main"><span class="cr-name">${esc(r.name)}</span>`
      + `<span class="cr-sub">${[r.code ? esc(r.code) : "", r.credits ? esc(r.credits + " kr") : "0 kr"].filter(Boolean).join(" · ")}</span></div>`
      + (flag ? `<span class="cr-flag${r.actual != null && g === r.actual ? " set" : ""}">${flag}</span>` : "") + `</div>`
      + body + `</div>`;
  });
  html += `</div>`;
  { const cAt = state.courses && state.courses.fetchedAt, gAt = state.grades && state.grades.fetchedAt; const newest = [cAt, gAt].filter(Boolean).sort().pop(); html += `<div class="hint center" style="margin-top:14px">${esc(freshText(newest))}</div>`; }
  host.innerHTML = html;
  wireCalcTerm(terms);
  const byKey = {}; rows.forEach((r) => { byKey[r.key] = r; });
  host.querySelectorAll("[data-cg]").forEach((b) => b.onclick = () => { calcSetGrade(byKey[b.dataset.cg], +b.dataset.g); renderCalc(); });
  const gs = $("calc-goal-status"); if (gs) gs.onclick = () => openCalcGoal();
  wireGoalBtn(gbtn);
}
function wireGoalBtn(gbtn) { if (gbtn) { gbtn.hidden = false; gbtn.onclick = openCalcGoal; } }
// Open the goal sub-page, prefilling from the saved goal for this term (if any).
function openCalcGoal() {
  const g = (state.calcGoals || {})[calcTerm];
  if (g) { calcTargetType = g.type; calcTargetVal = g.val; }
  pushScreen("tab-calc-goal");
}
// Status of the saved goal vs the current (predicted) index: reached / in progress / out of reach.
function calcGoalStatus(rows, c, goal) {
  const cur = goal.type === "suly" ? c.suly : c.ki;
  if (cur + 1e-9 >= goal.val) return { cls: "gs-ok", label: "Elérve" };
  const r = calcTargetSolve(rows, goal.type, goal.val);
  if (r.none || !r.feasible) return { cls: "gs-bad", label: "Nem érhető el" };
  return { cls: "gs-mid", label: "Haladó" };
}
// Goal / backward calculator — its own sub-page (opened from the target icon on the Kalkulátor topbar).
function renderCalcGoal() {
  const host = $("calc-goal-scroll"); if (!host) return;
  const terms = calcTermList();
  if (!terms.length || !calcTerm) { host.innerHTML = `<div class="dash-empty" style="padding:24px 4px">Előbb nyisd meg a Kalkulátort és válassz félévet.</div>`; return; }
  const rows = calcRows(calcTerm), c = calcCompute(rows);
  const typeLabel = calcTargetType === "suly" ? "Súlyozott átlag" : "Kreditindex";
  const curVal = calcTargetType === "suly" ? c.suly : c.ki;
  let html = `<div class="card card-pad goal-form">`
    + `<label class="goal-field"><span class="goal-flabel">Mit célzol meg?</span><button class="period-btn" id="calc-tt" type="button"><span>${typeLabel}</span>${icon("down")}</button></label>`
    + `<label class="goal-field"><span class="goal-flabel">Célérték</span><input class="input" id="calc-tv" inputmode="decimal" placeholder="pl. 4.5" value="${calcTargetVal != null ? calcTargetVal : ""}"></label>`
    + `<div class="goal-cur">Jelenlegi ${esc(typeLabel.toLowerCase())}: <b>${cf2(curVal)}</b></div></div>`;
  html += `<div id="calc-target-out" class="calc-out"></div>`;
  html += `<div class="goal-note">Kiszámolja, milyen átlagot kell hoznod a hátralévő tárgyaidra, hogy ezt a célt elérd ebben a félévben (${esc(calcTerm)}).</div>`;
  const saved = (state.calcGoals || {})[calcTerm];
  html += `<div class="goal-actions"><button class="btn primary" id="calc-goal-save" type="button">${saved ? "Cél frissítése" : "Cél mentése erre a félévre"}</button>`
    + (saved ? `<button class="btn outline" id="calc-goal-del" type="button">Cél törlése</button>` : "") + `</div>`;
  host.innerHTML = html;
  $("calc-tt").onclick = () => openList({ title: "Cél típusa", selected: calcTargetType, items: [{ value: "ki", label: "Kreditindex" }, { value: "suly", label: "Súlyozott átlag" }], onPick: (v) => { calcTargetType = v; renderCalcGoal(); } });
  const tvEl = $("calc-tv");
  tvEl.oninput = () => { const v = parseFloat(tvEl.value.replace(",", ".")); calcTargetVal = isFinite(v) ? v : null; renderCalcTarget(rows); };
  $("calc-goal-save").onclick = () => {
    // Súlyozott átlag max 5; a kreditindex viszont lehet 5 fölött is (Σ kredit×jegy / 30), ezért csak
    // a súlyozottnál korlátozzuk 5-re. A tényleges elérhetőséget úgyis a színes állapot jelzi.
    const max = calcTargetType === "suly" ? 5 : 30;
    if (calcTargetVal == null || calcTargetVal < 1 || calcTargetVal > max) { toast(calcTargetType === "suly" ? "Adj meg egy célértéket 1 és 5 között." : "Adj meg egy 1-nél nagyobb célértéket."); return; }
    if (!state.calcGoals) state.calcGoals = {};
    state.calcGoals[calcTerm] = { type: calcTargetType, val: calcTargetVal };
    saveState(); toast("Cél elmentve erre a félévre."); popScreen();
  };
  const del = $("calc-goal-del"); if (del) del.onclick = () => { if (state.calcGoals) delete state.calcGoals[calcTerm]; saveState(); toast("Cél törölve."); popScreen(); };
  renderCalcTarget(rows);
}
function wireCalcTerm(terms) { const b = $("calc-term"); if (b) b.onclick = () => openList({ title: "Félév", selected: calcTerm, items: terms.map((t) => ({ value: t, label: t })), onPick: (v) => { calcTerm = v; renderCalc(); } }); }
function renderCalcTarget(rows) {
  const out = $("calc-target-out"); if (!out) return;
  if (calcTargetVal == null) { out.innerHTML = `<div class="goal-res hint-state">Írd be a célértéket, és megmutatom, milyen átlag kell a hátralévő tárgyakra.</div>`; return; }
  const r = calcTargetSolve(rows, calcTargetType, calcTargetVal);
  if (r.none) { out.innerHTML = `<div class="goal-res">Ehhez a félévhez már minden jegy megvan, nincs mit tervezni.</div>`; return; }
  if (!r.feasible) {
    out.innerHTML = `<div class="goal-res bad"><div class="goal-res-state">Nem érhető el</div>`
      + `<div class="goal-res-lbl">Ezen a féléven már nem hozható ki. 5,00 fölötti átlag kellene a hátralévő ${r.openCr} kreditre.</div></div>`;
    return;
  }
  // Feasible. Is the current predicted index already at/above the target?
  const c = calcCompute(rows);
  const cur = calcTargetType === "suly" ? c.suly : c.ki;
  const reached = cur + 1e-9 >= calcTargetVal;
  if (r.trivial) {
    out.innerHTML = `<div class="goal-res ok"><div class="goal-res-state">Elérve</div>`
      + `<div class="goal-res-lbl">Elég átmenned a hátralévő ${r.openN} tárgyon (${r.openCr} kredit).</div></div>`;
    return;
  }
  const cls = reached ? "ok" : "mid", word = reached ? "Elérve" : "Haladó";
  out.innerHTML = `<div class="goal-res ${cls}"><div class="goal-res-state">${word}</div>`
    + `<div class="goal-res-num">${cf2(r.reqAvg)}+</div>`
    + `<div class="goal-res-lbl">ennyi átlag kell a hátralévő <b>${r.openN} tárgyra</b> (${r.openCr} kredit). ${reached ? "A mostani jegyeiddel már megvan." : "A mostani jegyeiddel még nincs meg."}</div></div>`;
}
