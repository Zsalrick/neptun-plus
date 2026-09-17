// Adatok beolvasása: feladatlista és az egyes szinkronizálók.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

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
    has: hasSemesters, run: syncSemesters, maxAge: 864e5, stamp: () => state.semesters && state.semesters.fetchedAt }, // ritkán változik → naponta
  { id: "credit",  label: "Kredit",           sub: "Kredit‑előrehaladás (teljesített / összes)",
    has: () => !!(state.progress && state.progress.total), run: syncCredit },
  { id: "courses", label: "Tárgyak (aktuális)", sub: "Felvett tárgyaid félévenként",
    has: () => !!(state.courses && state.courses.list && state.courses.list.length), run: syncCourses, maxAge: 864e5, stamp: () => state.courses && state.courses.fetchedAt }, // naponta
  { id: "curriculum", label: "Mintatanterv (összes)", sub: "Képzésed összes tárgya és a szabadon választhatók",
    has: hasCurriculum, run: syncCurriculum, maxAge: 6048e5, stamp: () => state.curriculum && state.curriculum.fetchedAt }, // szinte sose változik → hetente
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
