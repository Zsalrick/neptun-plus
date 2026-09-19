// Quizek: gyakorló kérdéssorok ZH-ra és vizsgára. Készülhet AI-jal (a felhasználó saját AI-ja: az app promptot ad,
// az AI a Kredit+ Quiz formátumban válaszol, azt beillesztjük), vagy kézzel. Lejátszás: gyakorlás (azonnali
// visszajelzés, magyarázat, ugrás a PDF oldalára) és vizsga mód (értékelés a végén). Formátum: QUIZ-FORMAT.md.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Tárolás ----
// Metaadat: state.quizzes (profilonként): { id:"q…", quiz:true, title, n, types:{…}, subjects:[{key,name}], mid (forrás
//   anyag/könyv id), at, upd, stats:{ attempts, best, last, lastAt }, wrong:[kérdés-indexek az utolsó körből] }.
// A kérdések az anyagok IndexedDB "docs" tárolójában (matPutDoc), mert egy 100 kérdéses quiz ~60 KB, és a state minden
// mentéskor egészben íródik. A .zip mentés és a profil törlése ezért közös az anyagokéval.
const QUIZ_URL = "https://kreditplus.hu/quiz/";
const QUIZ_TYPES = { single: "A, B, C, D", multi: "Több jó válasz", number: "Szám", truefalse: "Igaz vagy hamis", text: "Rövid válasz" };
const QUIZ_MAX_Q = 300;
function quizzes() { return (state.quizzes = state.quizzes || []); }
function quizById(id) { return quizzes().find((q) => q.id === id) || null; }
const QUIZ_LETTERS = "ABCDEFGH";

// ---- Formátum: beolvasás és ellenőrzés (az AI-k válaszára elnézően) ----
// Elfogad: ```json kódblokkot, előtte/utána magyarázó szöveget, csak kérdéstömböt, záró vesszőt, "okos" idézőjeleket.
function quizExtractJson(text) {
  let s = String(text || "").replace(/^﻿/, "").trim();
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(s);
  if (fence && /[{[]/.test(fence[1])) s = fence[1].trim();
  // Jelöltek: az első "{"-tól az utolsó "}"-ig (objektum), és az első "["-től az utolsó "]"-ig (csak kérdéstömb).
  const cands = [["{", "}"], ["[", "]"]].map(([o, c]) => { const a = s.indexOf(o), b = s.lastIndexOf(c); return a >= 0 && b > a ? s.slice(a, b + 1) : null; }).filter(Boolean);
  if (!cands.length) throw new Error(/[{[]/.test(s) ? "A quiz vége hiányzik. Lehet, hogy az AI válasza félbeszakadt: kérd meg, hogy folytassa, vagy kérj kevesebb kérdést."
    : "Nem találtam benne quizt. Az AI teljes válaszát (a kódblokkot) másold ki.");
  for (const c of cands) {
    const fixed = c.replace(/,(\s*[}\]])/g, "$1"); // záró vessző
    for (const t of [c, fixed, fixed.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")]) { try { return JSON.parse(t); } catch (e) {} }
  }
  const open = (s.match(/[{[]/g) || []).length, close = (s.match(/[}\]]/g) || []).length;
  if (open > close) throw new Error("A quiz vége hiányzik, az AI válasza valószínűleg félbeszakadt. Kérd meg, hogy folytassa, vagy kérj kevesebb kérdést, és másold ki újra.");
  throw new Error("A quiz formátuma hibás. Kérd meg az AI-t, hogy pontosan a megadott JSON formátumban válaszoljon, vagy másold ki újra a teljes kódblokkot.");
}
function quizLetter(v, n) {
  if (typeof v !== "string") return null;
  const m = /^\s*\(?([A-Ha-h])[).:]?\s*$/.exec(v); if (!m) return null;
  const L = m[1].toUpperCase(); return QUIZ_LETTERS.indexOf(L) < n ? L : null;
}
function quizNum(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.replace(/\s| /g, "").replace(/[^\d,.\-+eE]/g, "").replace(",", ".");
  return t && isFinite(+t) ? +t : null;
}
// Egy kérdés egységes alakra hozása. Visszaad: { q } vagy { err }.
function quizNormQ(raw) {
  if (!raw || typeof raw !== "object") return { err: "nem kérdés" };
  const pick = (...ks) => { for (const k of ks) if (raw[k] != null && raw[k] !== "") return raw[k]; return undefined; };
  const text = String(pick("q", "question", "kerdes", "kérdés", "text") || "").trim();
  if (!text) return { err: "hiányzik a kérdés szövege" };
  if (text.length > 2000) return { err: "túl hosszú a kérdés" };
  let type = String(pick("type", "tipus", "típus") || "").toLowerCase().trim();
  const alias = { abcd: "single", choice: "single", mc: "single", one: "single", multiple: "multi", checkbox: "multi", tf: "truefalse", boolean: "truefalse",
    igazhamis: "truefalse", "true_false": "truefalse", numeric: "number", szam: "number", "szám": "number", short: "text", open: "text", szoveg: "text", "szöveg": "text" };
  type = alias[type] || type;
  let opts = pick("options", "choices", "valaszok", "válaszok");
  const ans = pick("answer", "answers", "correct", "valasz", "válasz", "helyes");
  if (!QUIZ_TYPES[type]) type = Array.isArray(opts) ? (Array.isArray(ans) ? "multi" : "single") : typeof ans === "boolean" ? "truefalse" : typeof ans === "number" ? "number" : "text";
  const out = { type, q: text };
  const ex = pick("explain", "explanation", "magyarazat", "magyarázat"); if (ex) out.explain = String(ex).trim().slice(0, 3000);
  const pg = parseInt(pick("page", "oldal"), 10); if (pg > 0 && pg < 100000) out.page = pg;
  if (type === "single" || type === "multi") {
    if (!Array.isArray(opts)) return { err: "hiányoznak a válaszlehetőségek" };
    opts = opts.map((o) => String(o && typeof o === "object" ? (o.text || o.label || "") : o).trim());
    // "A) szöveg" alakú válaszok: a betűt levágjuk, ha mindegyik így kezdődik
    if (opts.length && opts.every((o, i) => new RegExp("^\\(?" + QUIZ_LETTERS[i] + "[).:]\\s+", "i").test(o))) opts = opts.map((o) => o.replace(/^\(?[A-H][).:]\s+/i, ""));
    if (opts.length < 2 || opts.length > 8) return { err: "2 és 8 közötti számú válasz kell" };
    if (opts.some((o) => !o)) return { err: "üres válaszlehetőség" };
    const toL = (v) => quizLetter(v, opts.length) || (typeof v === "string" ? (QUIZ_LETTERS[opts.findIndex((o) => searchNorm(o) === searchNorm(v))] || null) : null);
    out.options = opts;
    if (type === "single") {
      if (typeof ans === "number") return { err: "a helyes választ betűvel kell megadni (A, B, C, D)" };
      const L = toL(Array.isArray(ans) ? ans[0] : ans); if (!L) return { err: "hiányzik vagy hibás a helyes válasz betűje" };
      out.answer = L;
    } else {
      const arr = (Array.isArray(ans) ? ans : [ans]).map(toL);
      if (!arr.length || arr.some((x) => !x)) return { err: "a helyes válaszokat betűkkel kell megadni, pl. [\"A\", \"C\"]" };
      out.answer = [...new Set(arr)].sort();
    }
  } else if (type === "number") {
    const n = quizNum(ans); if (n == null) return { err: "a helyes válasz nem szám" };
    out.answer = n;
    const tol = quizNum(pick("tolerance", "tolerancia", "elteres", "eltérés")); if (tol != null && tol > 0) out.tolerance = Math.abs(tol);
    const u = pick("unit", "mertekegyseg", "mértékegység"); if (u) out.unit = String(u).trim().slice(0, 20);
  } else if (type === "truefalse") {
    const v = typeof ans === "boolean" ? ans : /^(igaz|true|i|igen|t)$/i.test(String(ans).trim()) ? true : /^(hamis|false|h|nem|f)$/i.test(String(ans).trim()) ? false : null;
    if (v == null) return { err: "a helyes válasz true vagy false legyen" };
    out.answer = v;
  } else {
    const arr = (Array.isArray(ans) ? ans : [ans]).map((x) => String(x == null ? "" : x).trim()).filter(Boolean);
    if (!arr.length) return { err: "hiányzik az elfogadott válasz" };
    out.answer = arr.slice(0, 20);
  }
  return { q: out };
}
// Az egész quiz: { quiz: { title, questions }, skipped: ["5. kérdés: …"] } vagy kivétel.
function quizParse(text) {
  const j = quizExtractJson(text);
  const list = Array.isArray(j) ? j : Array.isArray(j.questions) ? j.questions : Array.isArray(j.kerdesek) ? j.kerdesek : null;
  if (!list) throw new Error("Nincs benne kérdéslista (\"questions\").");
  const questions = [], skipped = [];
  list.slice(0, QUIZ_MAX_Q).forEach((raw, i) => { const r = quizNormQ(raw); if (r.q) questions.push(r.q); else skipped.push((i + 1) + ". kérdés: " + r.err); });
  if (list.length > QUIZ_MAX_Q) skipped.push("Legfeljebb " + QUIZ_MAX_Q + " kérdés fér egy quizbe, a többit kihagytam.");
  if (!questions.length) throw new Error("Egyik kérdés sem volt jó. " + skipped.slice(0, 3).join(" "));
  const title = String((!Array.isArray(j) && (j.title || j.cim || j.cím)) || "").trim().slice(0, 120);
  const subject = String((!Array.isArray(j) && (j.subject || j.targy || j.tárgy)) || "").trim().slice(0, 120);
  return { quiz: { title, subject, questions }, skipped };
}
// Kiírás a formátumban (megosztáshoz, mentéshez): pontosan az, amit a quizParse visszaolvas.
function quizExport(meta, questions) {
  return JSON.stringify({ kreditplus_quiz: 1, title: meta.title, subject: (meta.subjects && meta.subjects[0] && meta.subjects[0].name) || undefined, questions }, null, 1);
}
function quizTypeCounts(questions) { const c = {}; questions.forEach((q) => { c[q.type] = (c[q.type] || 0) + 1; }); return c; }
const QUIZ_TYPE_ADJ = { single: "egy jó válaszos", multi: "több jó válaszos", number: "számolós", truefalse: "igaz-hamis", text: "rövid válaszos" };
function quizTypeLine(c) { return Object.keys(QUIZ_TYPES).filter((k) => c[k]).map((k) => c[k] + " " + QUIZ_TYPE_ADJ[k]).join(", "); }

// ---- Válasz ellenőrzése ----
function quizTextNorm(s) { return searchNorm(s).replace(/[.,;:!?"'„”()\-–—_/]/g, " ").replace(/\s+/g, " ").trim(); } // "Pareto-hatékonyság" = "pareto hatekonysag"
function quizCheck(q, v) {
  if (v == null) return false;
  if (q.type === "single") return v === q.answer;
  if (q.type === "multi") { const a = [...v].sort().join(), b = [...q.answer].sort().join(); return a === b; }
  if (q.type === "number") { const n = quizNum(v); return n != null && Math.abs(n - q.answer) <= (q.tolerance || 0) + 1e-9 * Math.max(1, Math.abs(q.answer)); }
  if (q.type === "truefalse") return v === q.answer;
  return q.answer.some((a) => quizTextNorm(a) === quizTextNorm(v));
}
function quizFmtNum(n) { return String(n).replace(".", ","); }
function quizAnswerText(q) {
  if (q.type === "single") return q.answer + ") " + q.options[QUIZ_LETTERS.indexOf(q.answer)];
  if (q.type === "multi") return q.answer.map((L) => L + ") " + q.options[QUIZ_LETTERS.indexOf(L)]).join(", ");
  if (q.type === "number") return quizFmtNum(q.answer) + (q.unit ? " " + q.unit : "") + (q.tolerance ? " (± " + quizFmtNum(q.tolerance) + ")" : "");
  if (q.type === "truefalse") return q.answer ? "Igaz" : "Hamis";
  return q.answer.join(" / ");
}

// ---- Mentés ----
async function quizSave(meta, questions) {
  meta.n = questions.length; meta.types = quizTypeCounts(questions); meta.upd = Date.now();
  await matPutDoc(meta.id, { v: 1, questions });
  if (!quizById(meta.id)) quizzes().push(meta);
  saveState();
}
async function quizLoad(id) { const d = await matGetDoc(id); return (d && d.questions) || []; }
function quizNewMeta(title, subjects, mid) {
  return { id: "q" + uid(), quiz: true, title: title || "Quiz", n: 0, types: {}, subjects: subjects || [], mid: mid || "", at: Date.now(), upd: Date.now(), stats: { attempts: 0, best: null, last: null, lastAt: 0 }, wrong: [] };
}
function quizRefresh() {
  const cur = document.querySelector(".tabscreen.active");
  if (cur && cur.id === "tab-quizzes") renderQuizzes();
  else if (cur && cur.id === "tab-mat-subject") renderMatSubject();
}

// ---- Quizek képernyő ----
let quizFilter = "";
function quizSubLine(m, withSubj) {
  const s = m.stats || {};
  return [m.n + " kérdés", withSubj ? (m.subjects || []).map((x) => x.name).join(", ") : "", s.best != null ? "legjobb " + s.best + "%" : "még nem próbáltad"].filter(Boolean).join(" · ");
}
function quizRow(m, more) {
  return `<div class="row qz-row" data-id="${esc(m.id)}" style="cursor:pointer"><span class="row-ic">${icon("quiz")}</span>`
    + `<span class="row-main"><span class="row-title">${esc(m.title)}</span><span class="row-sub">${esc(quizSubLine(m, more))}</span></span>`
    + (more ? `<button class="iconbtn plain qz-more" data-id="${esc(m.id)}" type="button" aria-label="Műveletek">${icon("more")}</button>` : `<span class="row-chev">${icon("chev")}</span>`) + `</div>`;
}
function quizNewOptions() {
  return [
    { icon: "send", label: "Quiz készítése AI-jal", sub: "Promptot kapsz a ChatGPT-hez, a Geminihez vagy a Claude-hoz", value: "ai" },
    { icon: "clip", label: "AI válaszának beillesztése", sub: "Ha már megvan az AI által írt quiz", value: "paste" },
    { icon: "pencil", label: "Kézi szerkesztés", sub: "Kérdések és válaszok egyenként", value: "manual" },
  ];
}
function quizNewAction(v) { if (v === "ai") pushScreen("tab-quiz-ai"); else if (v === "paste") quizPasteFlow(); else if (v === "manual") quizEditOpen(null); }
function renderQuizzes() {
  const host = $("quizzes-scroll"); if (!host) return;
  $("quiz-new").onclick = async () => quizNewAction(await askPick({ title: "Új quiz", options: quizNewOptions() }));
  const all = quizzes().slice().sort((a, b) => Math.max(b.upd || 0, (b.stats && b.stats.lastAt) || 0) - Math.max(a.upd || 0, (a.stats && a.stats.lastAt) || 0));
  if (!all.length) {
    host.innerHTML = `<div class="dash-empty" style="padding:22px 2px 18px">Még nincs quized. Készíts egyet AI-jal a jegyzetedből, vagy írd meg kézzel a kérdéseket.</div>`
      + `<div class="card">` + quizNewOptions().map((o) => `<button class="row" type="button" data-new="${o.value}"><span class="row-ic">${icon(o.icon)}</span><span class="row-main"><span class="row-title">${o.label}</span><span class="row-sub">${o.sub}</span></span><span class="row-chev">${icon("chev")}</span></button>`).join("") + `</div>`
      + quizFootHint();
    host.querySelectorAll("[data-new]").forEach((b) => b.onclick = () => quizNewAction(b.dataset.new));
    $("qz-guide").onclick = () => openWeb(QUIZ_URL);
    return;
  }
  const subs = new Map(); all.forEach((m) => (m.subjects || []).forEach((s) => { if (!subs.has(s.key)) subs.set(s.key, s.name); }));
  if (quizFilter && !subs.has(quizFilter)) quizFilter = "";
  const list = quizFilter ? all.filter((m) => (m.subjects || []).some((s) => s.key === quizFilter)) : all;
  let h = subs.size ? `<div class="controls dd-row"><button class="period-btn dd" id="quiz-filter" type="button"><span>${esc(quizFilter ? subs.get(quizFilter) : "Minden quiz")}</span>${icon("down")}</button></div>` : "";
  h += `<div class="dash-label"${subs.size ? "" : ` style="margin-top:4px"`}>${quizFilter ? "Ehhez a tárgyhoz" : "Quizeim"} · ${list.length}</div><div class="card">` + list.map((m) => quizRow(m, true)).join("") + `</div>` + quizFootHint();
  host.innerHTML = h;
  host.querySelectorAll(".qz-row").forEach((r) => r.onclick = (ev) => { if (!ev.target.closest(".qz-more")) quizStartMenu(r.dataset.id); });
  host.querySelectorAll(".qz-more").forEach((b) => b.onclick = () => quizMenu(b.dataset.id));
  $("qz-guide").onclick = () => openWeb(QUIZ_URL);
  const fb = $("quiz-filter");
  if (fb) fb.onclick = async () => {
    const v = await askPick({ title: "Tárgy", options: [{ label: "Minden quiz", sub: all.length + " quiz", value: "*" }]
      .concat([...subs].sort((a, b) => a[1].localeCompare(b[1], "hu")).map(([k, name]) => ({ label: name, sub: all.filter((m) => (m.subjects || []).some((s) => s.key === k)).length + " quiz", value: k }))) });
    if (v) { quizFilter = v === "*" ? "" : v; renderQuizzes(); }
  };
}
function quizFootHint() { return `<button class="row qz-guide" type="button" id="qz-guide"><span class="row-ic">${icon("ext")}</span><span class="row-main"><span class="row-title">Hogyan működik?</span><span class="row-sub">Útmutató és a quiz formátuma: kreditplus.hu/quiz</span></span><span class="row-chev">${icon("chev")}</span></button>`; }
async function quizStartMenu(id) {
  const m = quizById(id); if (!m) return;
  const w = (m.wrong || []).length;
  const opts = [{ icon: "check", label: "Gyakorlás", sub: "Azonnali visszajelzés és magyarázat minden kérdés után", value: "practice" },
    { icon: "clock", label: "Vizsga mód", sub: "Kevert sorrend, értékelés csak a végén", value: "exam" }];
  if (w) opts.push({ icon: "refresh", label: "Csak a hibásak", sub: w + " kérdés az utolsó körből", value: "wrong" });
  const a = await askPick({ title: m.title, body: `<div class="hint">${esc(quizSubLine(m, true))}</div>`, options: opts });
  if (a) quizPlayStart(id, a);
}
async function quizMenu(id) {
  const m = quizById(id); if (!m) return;
  const subj = (m.subjects || []).map((s) => s.name).join(", "), src = m.mid && matById(m.mid);
  const opts = [
    { icon: "check", label: "Indítás", sub: "Gyakorlás vagy vizsga mód", value: "start" },
    { icon: "pencil", label: "Szerkesztés", sub: "Kérdések, válaszok, cím", value: "edit" },
    { icon: "book", label: "Tárgyhoz rendelés", sub: subj ? "Most: " + subj : "Még nincs tárgyhoz rendelve", value: "assign" },
    { icon: "doc", label: "Forrás PDF", sub: src ? src.title : "Ha megadod, a kérdésből a PDF oldalára ugorhatsz", value: "src" },
    { icon: "copy", label: "Másolás megosztáshoz", sub: "A quiz szövegként a vágólapra, a másik fél beillesztheti", value: "copy" },
    { icon: "trash", label: "Törlés", danger: true, value: "del" }];
  const a = await askPick({ title: m.title, body: `<div class="hint">${esc(quizSubLine(m, true))}</div>`, options: opts });
  if (a === "start") quizStartMenu(id);
  else if (a === "edit") quizEditOpen(id);
  else if (a === "assign") bookPickSubject("Tárgyhoz rendelés", (name) => { quizAddSubject(m, name); });
  else if (a === "src") quizPickSource(m);
  else if (a === "copy") quizCopy(m);
  else if (a === "del") {
    const ok = await ask({ title: "Quiz törlése", okText: "Törlés", cancelText: "Mégse", danger: true, body: `Biztosan törlöd? Az eredményeid is elvesznek.<br><b>${esc(m.title)}</b>` });
    if (!ok) return;
    try { await matDeleteData(m.id); } catch (e) {}
    state.quizzes = quizzes().filter((x) => x.id !== m.id); saveState(); quizRefresh();
  }
}
function quizAddSubject(m, name) {
  const key = matSubjKey(name); if (!key) return;
  m.subjects = m.subjects || []; if (!m.subjects.some((s) => s.key === key)) m.subjects.push({ key, name });
  saveState(); quizRefresh(); toast("Hozzárendelve: " + name);
}
// Forrás PDF: az anyagok és a könyvek közül (a tárgy anyagai elöl).
async function quizPickSource(m) {
  const keys = new Set((m.subjects || []).map((s) => s.key));
  const pdfs = mats().filter((x) => x.kind === "pdf").concat(books())
    .sort((a, b) => (keys.has(b.subj) || (b.subjects || []).some((s) => keys.has(s.key)) ? 1 : 0) - (keys.has(a.subj) || (a.subjects || []).some((s) => keys.has(s.key)) ? 1 : 0));
  if (!pdfs.length) { toast("Még nincs PDF az Anyagok vagy a Könyvek között."); return; }
  const v = await askPick({ title: "Forrás PDF", options: [{ label: "Nincs forrás", value: "-" }].concat(pdfs.slice(0, 40).map((x) => ({ icon: x.book ? "books" : "doc", label: x.title, sub: x.book ? "Könyv" : (x.subjName || "Anyag"), value: x.id }))) });
  if (!v) return;
  m.mid = v === "-" ? "" : v; saveState(); toast(m.mid ? "Forrás beállítva." : "Forrás törölve.");
}
async function quizCopy(m) {
  const qs = await quizLoad(m.id), text = quizExport(m, qs);
  try { await navigator.clipboard.writeText(text); toast("Kimásolva (" + qs.length + " kérdés). Küldd el, a másik fél a Beillesztéssel veheti fel."); }
  catch (e) { await askLong({ title: "Másold ki", value: text, okText: "Kész", body: `<div class="hint">Jelöld ki és másold ki a szöveget.</div>` }); }
}

// ---- Beillesztés (az AI válasza vagy egy megosztott quiz) ----
async function quizReadClipboard() { try { return await navigator.clipboard.readText(); } catch (e) { return ""; } }
function quizLooksLike(t) { return /"questions"|kreditplus_quiz/.test(t || ""); }
async function quizPasteFlow(pre) {
  let text = pre || "";
  if (!text) { const c = await quizReadClipboard(); if (quizLooksLike(c)) text = c; }
  if (!text) {
    const t = await askLong({ title: "AI válaszának beillesztése", okText: "Beolvasás", placeholder: "Nyomj hosszan ide, majd Beillesztés",
      body: `<div class="hint">Az AI válaszánál nyomd meg a kódblokk Másolás gombját, majd illeszd be ide. Elég a teljes válasz is, a quizt kikeresem belőle.</div>` });
    if (t == null || !t.trim()) return;
    text = t;
  }
  let r;
  try { r = quizParse(text); }
  catch (e) {
    const again = await ask({ title: "Nem sikerült beolvasni", okText: "Újra", cancelText: "Bezárás", body: esc(String(e && e.message || e)) });
    if (again) quizPasteFlow();
    return;
  }
  const ctx = state.quizCtx && Date.now() - state.quizCtx.at < 12 * 3600e3 ? state.quizCtx : null; // az AI-lapon összerakott kérés adatai
  const title = r.quiz.title || (ctx && ctx.subject ? ctx.subject + " quiz" : "Quiz");
  const skip = r.skipped.length ? `<div class="hint" style="margin-top:10px">${r.skipped.length} kérdést kihagytam:<br>${r.skipped.slice(0, 6).map(esc).join("<br>")}${r.skipped.length > 6 ? "<br>…" : ""}</div>` : "";
  const ok = await ask({ title: "Quiz beolvasva", okText: "Mentés", cancelText: "Mégse",
    body: `<b>${esc(title)}</b><br>${r.quiz.questions.length} kérdés: ${esc(quizTypeLine(quizTypeCounts(r.quiz.questions)))}${skip}` });
  if (!ok) return;
  const subjName = (ctx && ctx.subject) || r.quiz.subject || "";
  const meta = quizNewMeta(title, subjName ? [{ key: matSubjKey(subjName), name: subjName }] : [], ctx && ctx.mid);
  await quizSave(meta, r.quiz.questions);
  if (ctx) { state.quizCtx = null; saveState(); }
  quizLastClip = text;
  toast("Quiz mentve: " + meta.title);
  const act = document.querySelector(".tabscreen.active");
  if (act && act.id === "tab-quiz-ai") popScreen();
  setTimeout(() => {
    if (!document.querySelector(".tabscreen.active") || document.querySelector(".tabscreen.active").id !== "tab-quizzes") pushScreen("tab-quizzes"); else renderQuizzes();
    if (!meta.subjects.length) bookPickSubject("Melyik tárgyhoz tartozik?", (name) => quizAddSubject(meta, name));
  }, 120);
}
// Visszatérés az AI-appból: ha a vágólapon quiz van, felajánljuk (csak az AI-lapon, és egy szöveget csak egyszer).
let quizLastClip = "";
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) return;
  const act = document.querySelector(".tabscreen.active"); if (!act || act.id !== "tab-quiz-ai") return;
  const t = await quizReadClipboard();
  if (!quizLooksLike(t) || t === quizLastClip) return;
  quizLastClip = t;
  const ok = await ask({ title: "Quizt találtam a vágólapon", okText: "Beolvasás", cancelText: "Most nem", body: "Az AI válasza a vágólapon van. Beolvassam?" });
  if (ok) quizPasteFlow(t);
});

// ---- Quiz készítése AI-jal: prompt összeállítása ----
const QZ = { subject: "", mid: "", n: 20, types: new Set(["single"]), level: "kozepes", extra: "", from: null, to: null };
const QZ_LEVELS = [["konnyu", "Könnyű"], ["kozepes", "Közepes"], ["nehez", "Nehéz"]];
// withText: az anyag szövegét a prompt után illesztjük be (oldalanként jelölve), ezért nem "csatolt" anyagról beszélünk.
function quizPrompt(withText) {
  const src = QZ.mid && matById(QZ.mid);
  const types = [...QZ.types];
  const lvl = { konnyu: "könnyű (alapfogalmak, definíciók)", kozepes: "közepes (fogalmak és összefüggések, egyszerű számolás)", nehez: "nehéz (alkalmazás, számolás, összetett összefüggések)" }[QZ.level];
  const tdesc = {
    single: `- "single": egy helyes válasz. "options": 4 válaszlehetőség (csak a szöveg, betű nélkül), "answer": a helyes válasz betűje ("A", "B", "C" vagy "D").`,
    multi: `- "multi": több helyes válasz. "options": 4-6 válaszlehetőség, "answer": a helyes válaszok betűi, pl. ["A", "C"].`,
    number: `- "number": a válasz egy szám. "answer": szám tizedesponttal (pl. 12.5), "tolerance": megengedett eltérés (pl. 0.1, kerekítéshez), "unit": mértékegység, ha van (pl. "Ft", "%").`,
    truefalse: `- "truefalse": igaz vagy hamis állítás. "q": maga az állítás, "answer": true vagy false.`,
    text: `- "text": rövid, egy-három szavas válasz (fogalom, név). "answer": az elfogadott válaszok listája, pl. ["Pareto-hatékony", "Pareto-optimális"].`,
  };
  const ex = [];
  if (QZ.types.has("single")) ex.push(`    { "type": "single", "q": "Mit mutat a kereslet árrugalmassága?", "options": ["A kereslet változását a jövedelem változására", "A keresett mennyiség százalékos változását az ár 1%-os változására", "Az ár változását a kínálat változására", "A termelési költség változását"], "answer": "B", "explain": "Az árrugalmasság a keresett mennyiség relatív változása osztva az ár relatív változásával.", "page": 12 }`);
  if (QZ.types.has("number")) ex.push(`    { "type": "number", "q": "Ha az ár 100 Ft-ról 110 Ft-ra nő, és a keresett mennyiség 50-ről 45-re csökken, mekkora az árrugalmasság abszolút értéke?", "answer": 1, "tolerance": 0.01, "explain": "A mennyiség 10%-kal csökken, az ár 10%-kal nő: 10% / 10% = 1.", "page": 14 }`);
  if (QZ.types.has("truefalse")) ex.push(`    { "type": "truefalse", "q": "A tökéletesen rugalmatlan kereslet görbéje vízszintes.", "answer": false, "explain": "Függőleges: a mennyiség nem változik az árral.", "page": 13 }`);
  if (!ex.length && QZ.types.has("multi")) ex.push(`    { "type": "multi", "q": "Melyek a termelési tényezők?", "options": ["Munka", "Tőke", "Infláció", "Föld"], "answer": ["A", "B", "D"], "explain": "A klasszikus termelési tényezők a munka, a tőke és a föld.", "page": 3 }`);
  if (!ex.length) ex.push(`    { "type": "text", "q": "Hogy nevezzük azt az állapotot, amikor senki helyzete nem javítható más rontása nélkül?", "answer": ["Pareto-hatékonyság", "Pareto-optimum"], "explain": "Ez a Pareto-hatékonyság definíciója.", "page": 22 }`);
  return [
    withText ? `Készíts egy gyakorló quizt a Kredit+ egyetemi app számára az alábbi anyagból (${src.title}). Az anyag szövege a prompt végén van, oldalanként jelölve, pl. "=== 12. oldal ===".`
      : `Készíts egy gyakorló quizt a Kredit+ egyetemi app számára a csatolt anyagból${src ? ` (${src.title})` : ""}.`,
    ``,
    `Beállítások:`,
    QZ.subject ? `- Tárgy: ${QZ.subject}` : null,
    `- Kérdések száma: ${QZ.n}`,
    `- Kérdéstípusok: ${types.map((t) => '"' + t + '"').join(", ")}${types.length > 1 ? " (vegyesen)" : ""}`,
    `- Nehézség: ${lvl}`,
    QZ.extra.trim() ? `- Kérés: ${QZ.extra.trim()}` : null,
    ``,
    `Szabályok:`,
    `1. Csak ${withText ? "a megadott" : "a csatolt"} anyag tartalmából kérdezz, ne találj ki tényeket. A kérdések a teljes anyagot fedjék le, ne csak az elejét.`,
    `2. Minden kérdésnek egyértelmű, az anyag alapján ellenőrizhető helyes válasza legyen.`,
    `3. A rossz válaszok legyenek hihetők, de egyértelműen rosszak. A helyes válasz betűje legyen változatos.`,
    withText ? `4. Minden kérdéshez írj rövid magyarázatot ("explain"), és add meg az oldalszámot ("page"): annak a "=== N. oldal ===" jelölésnek a számát, amelyik alatt a válasz található.`
      : `4. Minden kérdéshez írj rövid magyarázatot ("explain"), és add meg a PDF-fájl oldalszámát ("page", az 1 a fájl első oldala), ahol a válasz megtalálható.`,
    `5. A válaszod CSAK egy JSON kódblokk legyen, pontosan az alábbi formátumban, előtte és utána semmilyen szöveg nélkül.`,
    `6. Ha nem tudsz ennyi jó kérdést írni az anyagból, írj kevesebbet.`,
    ``,
    `Kérdéstípusok:`,
    ...types.map((t) => tdesc[t]),
    `Minden kérdés mezői: "type", "q" (a kérdés), a típus mezői, "explain", "page".`,
    ``,
    `Formátum (példa):`,
    "```json",
    `{`,
    `  "kreditplus_quiz": 1,`,
    `  "title": "${(QZ.subject || "Tárgy").replace(/"/g, "'")} gyakorló quiz",`,
    `  "questions": [`,
    ex.join(",\n"),
    `  ]`,
    `}`,
    "```",
    ``,
    `A formátum teljes leírása: ${QUIZ_URL}`,
  ].filter((x) => x != null).join("\n");
}
// Az AI-ok webcímei: telepített appnál az Android az appot nyitja meg (App Links), különben a böngészőt.
// Belépést és beillesztést NEM automatizálunk (a szolgáltatók tiltják, és a beágyazott Google-belépés sem működik):
// a prompt és az anyag szövege a vágólapra kerül, a felhasználó beilleszti.
const QUIZ_AIS = [["ChatGPT", "https://chatgpt.com/"], ["Claude", "https://claude.ai/new"], ["Gemini", "https://gemini.google.com/app"]];
function renderQuizAi() {
  const host = $("quiz-ai-scroll"); if (!host) return;
  const src = QZ.mid && matById(QZ.mid);
  if (QZ.mid && !src) QZ.mid = "";
  const seg = (id, items, cur) => `<div class="seg" id="${id}">` + items.map(([k, l]) => `<button type="button" class="seg-btn${String(cur) === String(k) ? " active" : ""}" data-v="${k}">${l}</button>`).join("") + `</div>`;
  const row = (id, ic, title, sub) => `<button class="row" type="button" id="${id}"><span class="row-ic">${icon(ic)}</span><span class="row-main"><span class="row-title">${title}</span><span class="row-sub">${sub}</span></span><span class="row-chev">${icon("chev")}</span></button>`;
  const steps = src ? ["Állítsd be a quizt, és koppints az AI nevére lent.", "A prompt és az anyag szövege a vágólapra kerül, és megnyílik az AI. Illeszd be, és küldd el. Csatolni semmit nem kell.", "Az AI válaszát másold ki (a kódblokk Másolás gombjával), gyere vissza, és nyomd meg a Beillesztést."]
    : ["Válassz anyagot a PDF-jeid közül, így a szövegét az app illeszti a prompt mellé. Vagy hagyd üresen, és a PDF-et az AI-ban csatolod.", "Koppints az AI nevére: a prompt a vágólapra kerül, és megnyílik az AI. Illeszd be (és csatold a PDF-et).", "Az AI válaszát másold ki (a kódblokk Másolás gombjával), gyere vissza, és nyomd meg a Beillesztést."];
  host.innerHTML = `<div class="qa-steps">` + steps.map((t, i) => `<div class="qa-step"><b>${i + 1}.</b> ${t}</div>`).join("") + `</div>`
    + `<div class="card">` + row("qa-subj", "book", "Tárgy", esc(QZ.subject || "Nincs megadva")) + row("qa-src", "doc", "Anyag", esc(src ? src.title + " · " + src.pages + " oldal" : "Nincs kiválasztva")) + `</div>`
    + (src ? `<div class="field"><label for="qa-from">Oldalak (nem kötelező)</label><div class="bks-yr">`
      + `<input class="input" id="qa-from" inputmode="numeric" autocomplete="off" placeholder="Ettől: 1" value="${QZ.from || ""}" aria-label="Első oldal">`
      + `<input class="input" id="qa-to" inputmode="numeric" autocomplete="off" placeholder="Eddig: ${src.pages}" value="${QZ.to || ""}" aria-label="Utolsó oldal"></div></div>` : "")
    + `<div class="field"><label>Kérdések száma</label>${seg("qa-n", [[10, "10"], [20, "20"], [30, "30"], [50, "50"]], QZ.n)}</div>`
    + `<div class="field"><label>Kérdéstípusok</label><div class="bks-src">` + Object.keys(QUIZ_TYPES).map((k) => `<button type="button" class="check${QZ.types.has(k) ? " on" : ""}" data-t="${k}" aria-pressed="${QZ.types.has(k)}"><span class="box">${icon("check")}</span><span><span class="c-t">${QUIZ_TYPES[k]}</span></span></button>`).join("") + `</div></div>`
    + `<div class="field"><label>Nehézség</label>${seg("qa-lvl", QZ_LEVELS, QZ.level)}</div>`
    + `<div class="field"><label for="qa-extra">Külön kérés (nem kötelező)</label><input class="input" id="qa-extra" placeholder="Például: csak a 3. fejezetből" autocomplete="off" value="${esc(QZ.extra)}"></div>`
    + `<div class="field"><label>${src ? "Prompt és anyag másolása, majd" : "Prompt másolása, majd"}</label><div class="qa-ais">`
    + QUIZ_AIS.map(([n], i) => `<button class="btn tonal lg" type="button" data-ai="${i}">${esc(n)}</button>`).join("") + `</div></div>`
    + `<div class="qa-btns"><button class="btn tonal lg" type="button" id="qa-copy">${icon("copy")}${src ? "Csak másolás" : "Prompt másolása"}</button>`
    + (src ? `<button class="btn tonal lg" type="button" id="qa-dl">${icon("download")}PDF mentése a Letöltésekbe</button>` : "")
    + `<button class="btn primary lg" type="button" id="qa-paste">${icon("clip")}AI válaszának beillesztése</button></div>`
    + `<button class="bks-adv-t" type="button" id="qa-prev-t" aria-expanded="false"><span>A prompt megtekintése</span>${icon("down")}</button><pre class="qa-prev" id="qa-prev" hidden></pre>`
    + `<div class="hint" style="margin:10px 2px 16px">A quizt a te AI-od készíti, a Kredit+ nem küld sehova semmit, csak a vágólapra másol. Az AI tévedhet: ha egy válasz gyanús, nézd meg az oldalszámnál, és javítsd a Szerkesztésben.</div>`;
  $("qa-subj").onclick = () => bookPickSubject("Tárgy", (name) => { QZ.subject = name; renderQuizAi(); });
  $("qa-src").onclick = async () => {
    const keyS = matSubjKey(QZ.subject), pdfs = mats().filter((x) => x.kind === "pdf" || x.kind === "note").concat(books());
    pdfs.sort((a, b) => ((b.subj === keyS || (b.subjects || []).some((s) => s.key === keyS)) ? 1 : 0) - ((a.subj === keyS || (a.subjects || []).some((s) => s.key === keyS)) ? 1 : 0));
    if (!pdfs.length) { toast("Még nincs PDF az Anyagok vagy a Könyvek között. Az AI-ban is csatolhatod."); return; }
    const v = await askPick({ title: "Melyik anyagból?", options: [{ label: "Nincs kiválasztva", sub: "A PDF-et az AI-ban csatolod", value: "-" }]
      .concat(pdfs.slice(0, 40).map((x) => ({ icon: x.book ? "books" : x.kind === "note" ? "note" : "doc", label: x.title, sub: (x.book ? "Könyv" : (x.subjName || "Anyag")) + " · " + x.pages + " oldal", value: x.id }))) });
    if (!v) return;
    QZ.mid = v === "-" ? "" : v; QZ.from = QZ.to = null;
    const m = QZ.mid && matById(QZ.mid);
    if (m && !QZ.subject) QZ.subject = m.subjName || ((m.subjects || [])[0] || {}).name || "";
    renderQuizAi();
  };
  const num = (id) => { const n = parseInt(($(id) || {}).value, 10); return n > 0 ? n : null; };
  if (src) { $("qa-from").oninput = () => { QZ.from = num("qa-from"); }; $("qa-to").oninput = () => { QZ.to = num("qa-to"); }; }
  host.querySelectorAll("#qa-n [data-v]").forEach((b) => b.onclick = () => { QZ.n = +b.dataset.v; renderQuizAi(); });
  host.querySelectorAll("#qa-lvl [data-v]").forEach((b) => b.onclick = () => { QZ.level = b.dataset.v; renderQuizAi(); });
  host.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => {
    const t = b.dataset.t; if (QZ.types.has(t)) { if (QZ.types.size === 1) { toast("Legalább egy típus kell."); return; } QZ.types.delete(t); } else QZ.types.add(t);
    renderQuizAi();
  });
  $("qa-extra").oninput = (e) => { QZ.extra = e.target.value; };
  host.querySelectorAll("[data-ai]").forEach((b) => b.onclick = async () => { const [, url] = QUIZ_AIS[+b.dataset.ai]; if (await quizCopyAll()) openWeb(url); });
  $("qa-copy").onclick = () => quizCopyAll();
  const dl = $("qa-dl"); if (dl) dl.onclick = () => matDownloadPdfs([src.id]);
  $("qa-paste").onclick = () => quizPasteFlow();
  $("qa-prev-t").onclick = () => { const p = $("qa-prev"), open = p.hidden; p.hidden = !open; if (open) p.textContent = quizPrompt(!!src) + (src ? "\n\n---\nANYAG: " + src.title + "\n\n(itt következik az anyag szövege oldalanként)" : ""); $("qa-prev-t").classList.toggle("open", open); $("qa-prev-t").setAttribute("aria-expanded", String(open)); };
}
// Az anyag szövege oldalszámokkal ("=== 12. oldal ===", a PDF-fájl oldalszáma, erre ugrik a "Megnézem" gomb) és a saját
// szövegdobozokkal együtt. from/to a megjelenítő oldalsorszáma (ahogy a felhasználó látja).
async function quizMaterialText(mid, from, to) {
  const m = matById(mid), doc = m && await matGetDoc(mid);
  if (!doc) throw new Error("Az anyag nem található.");
  let pdf = null;
  if (m.kind === "pdf") { const f = await matGetFile(mid); if (f) pdf = await (await matPdfjs()).getDocument(matPdfOpts(new Uint8Array(await f.arrayBuffer()))).promise; }
  const parts = [], a = Math.max(1, from || 1), b = Math.min(doc.pages.length, to || doc.pages.length);
  let pdfPages = 0, textPages = 0;
  try {
    for (let i = a - 1; i < b; i++) {
      const pg = doc.pages[i];
      if (i % 10 === 0) { const t = $("busy-text"); if (t) t.textContent = "Az anyag szövegének kiolvasása… " + (i + 1) + " / " + b; }
      let t = "";
      if (pg.kind === "pdf" && pdf) {
        pdfPages++;
        const tc = await (await pdf.getPage(pg.n)).getTextContent();
        t = tc.items.map((it) => (it.str || "") + (it.hasEOL ? "\n" : " ")).join("").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        if (t.replace(/\s/g, "").length > 20) textPages++;
      }
      const own = ((doc.items || {})[pg.id] || []).filter((it) => it.t === "text" && String(it.text || "").trim()).map((it) => "[Saját jegyzet] " + String(it.text).trim());
      if (!t && !own.length) continue;
      parts.push((pg.kind === "pdf" ? `=== ${pg.n}. oldal ===` : `=== Saját jegyzetoldal (${i + 1}. a sorban) ===`) + "\n" + [t].concat(own).filter(Boolean).join("\n"));
    }
  } finally { try { pdf && pdf.destroy(); } catch (e) {} }
  return { text: parts.join("\n\n"), pdfPages, textPages };
}
async function quizClip(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { await askLong({ title: "Másold ki", value: text, okText: "Kész", body: `<div class="hint">Nem tudtam automatikusan kimásolni. Jelöld ki az egészet, és másold ki.</div>` }); return false; }
}
// Prompt (és ha van kiválasztott anyag, a szövege) a vágólapra. Igaz, ha sikerült, és mehet az AI megnyitása.
async function quizCopyAll() {
  state.quizCtx = { subject: QZ.subject, mid: QZ.mid, at: Date.now() }; saveState(); // a beillesztéskor ehhez rendeljük
  const src = QZ.mid && matById(QZ.mid);
  if (!src) { const ok = await quizClip(quizPrompt(false)); if (ok) toast("Prompt kimásolva. Az AI-ban csatold mellé a PDF-et."); return ok; }
  showBusy("Az anyag szövegének kiolvasása…");
  let r;
  try { r = await quizMaterialText(src.id, QZ.from, QZ.to); }
  catch (e) { hideBusy(); toast("Nem sikerült kiolvasni: " + (e && e.message || e)); return false; }
  hideBusy();
  if (!r.text || (r.pdfPages && r.textPages < r.pdfPages * 0.3)) { // szkennelt PDF: nincs benne szöveg
    const go = await ask({ title: "Ebben a PDF-ben alig van szöveg", okText: "PDF a Letöltésekbe", cancelText: "Mégse",
      body: "Valószínűleg szkennelt képekből áll, ezért a szövegét nem tudom kimásolni. Mentsd a Letöltésekbe, és csatold fájlként az AI-ban. A prompt a vágólapra kerül." });
    await quizClip(quizPrompt(false));
    if (go) await matDownloadPdfs([src.id]);
    return false;
  }
  if (r.text.length > 150000) {
    const go = await ask({ title: "Nagyon hosszú anyag", okText: "Másolás így is", cancelText: "Mégse",
      body: `Kb. ${Math.round(r.text.length / 1000)} ezer karakter. Az ingyenes AI-k ekkora szöveget gyakran nem dolgoznak fel teljesen. Érdemes oldaltartományt megadni (pl. egy fejezetet).` });
    if (!go) return false;
  }
  const ok = await quizClip(quizPrompt(true) + "\n\n---\nANYAG: " + src.title + "\n\n" + r.text);
  if (ok) toast("A prompt és az anyag szövege kimásolva (" + Math.max(1, Math.round(r.text.length / 1000)) + " ezer karakter). Illeszd be az AI-ba.");
  return ok;
}

// ---- Kézi szerkesztő ----
let qe = null; // { id|null, title, subjects, mid, questions, dirty }
async function quizEditOpen(id) {
  const m = id && quizById(id);
  qe = m ? { id, title: m.title, subjects: (m.subjects || []).slice(), mid: m.mid || "", questions: JSON.parse(JSON.stringify(await quizLoad(id))), dirty: false }
    : { id: null, title: "", subjects: [], mid: "", questions: [], dirty: false };
  pushScreen("tab-quiz-edit");
}
function renderQuizEdit() {
  const host = $("quiz-edit-scroll"); if (!host) return;
  if (!qe) { host.innerHTML = `<div class="dash-empty">Nincs megnyitott quiz.</div>`; return; }
  const subj = qe.subjects.map((s) => s.name).join(", ");
  host.innerHTML = `<div class="field"><label for="qe-title">Cím</label><input class="input" id="qe-title" placeholder="Például: Mikroökonómia 1. ZH" autocomplete="off" value="${esc(qe.title)}"></div>`
    + `<div class="card"><button class="row" type="button" id="qe-subj"><span class="row-ic">${icon("book")}</span><span class="row-main"><span class="row-title">Tárgy</span><span class="row-sub">${esc(subj || "Nincs megadva")}</span></span><span class="row-chev">${icon("chev")}</span></button></div>`
    + `<div class="dash-label">Kérdések · ${qe.questions.length}</div>`
    + (qe.questions.length ? `<div class="card">` + qe.questions.map((q, i) => `<button class="row" type="button" data-qi="${i}"><span class="qe-num">${i + 1}.</span>`
      + `<span class="row-main"><span class="row-title qe-q">${esc(q.q)}</span><span class="row-sub">${esc(QUIZ_TYPES[q.type])} · ${esc(quizAnswerText(q))}</span></span><span class="row-chev">${icon("chev")}</span></button>`).join("") + `</div>`
      : `<div class="hint" style="margin:0 2px 10px">Még nincs kérdés. Adj hozzá egyet lent.</div>`)
    + `<button class="btn tonal lg qe-add" type="button" id="qe-add">${icon("plus")}Új kérdés</button>`;
  $("qe-title").oninput = (e) => { qe.title = e.target.value; qe.dirty = true; };
  $("qe-subj").onclick = () => bookPickSubject("Tárgy", (name) => { const key = matSubjKey(name); qe.subjects = [{ key, name }]; qe.dirty = true; renderQuizEdit(); });
  host.querySelectorAll("[data-qi]").forEach((b) => b.onclick = () => quizQOpen(+b.dataset.qi));
  $("qe-add").onclick = () => quizQOpen(-1);
  $("qe-save").onclick = () => quizEditSave();
}
async function quizEditSave() {
  if (!qe) return;
  const title = qe.title.trim();
  if (!title) { toast("Adj címet a quiznek."); try { $("qe-title").focus(); } catch (e) {} return; }
  if (!qe.questions.length) { toast("Legalább egy kérdés kell."); return; }
  let meta = qe.id && quizById(qe.id);
  if (!meta) meta = quizNewMeta(title, qe.subjects, qe.mid);
  Object.assign(meta, { title, subjects: qe.subjects, mid: qe.mid });
  if (qe.id) meta.wrong = []; // a kérdések változhattak: a "hibásak" listája már nem érvényes
  await quizSave(meta, qe.questions);
  qe.id = meta.id; qe.dirty = false;
  toast("Quiz mentve.");
  popScreen();
}
// Egy kérdés szerkesztése (külön képernyő). qeq = { ix (-1 = új), d: piszkozat }
let qeq = null;
function quizQOpen(ix) {
  const src = ix >= 0 ? qe.questions[ix] : null;
  const d = src ? JSON.parse(JSON.stringify(src)) : { type: "single", q: "", options: ["", "", "", ""], answer: "A" };
  if (d.type === "text") d.answerText = d.answer.join("\n");
  qeq = { ix, d };
  pushScreen("tab-quiz-q");
}
function renderQuizQ() {
  const host = $("quiz-q-scroll"); if (!host) return;
  if (!qeq) { host.innerHTML = ""; return; }
  const d = qeq.d, t = d.type, ttl = $("quiz-q-title"); if (ttl) ttl.textContent = qeq.ix >= 0 ? (qeq.ix + 1) + ". kérdés" : "Új kérdés";
  const seg = (id, items, cur) => `<div class="seg qe-seg" id="${id}">` + items.map(([k, l]) => `<button type="button" class="seg-btn${String(cur) === String(k) ? " active" : ""}" data-v="${k}">${l}</button>`).join("") + `</div>`;
  let h = `<div class="field"><label>Típus</label>${seg("qq-type", [["single", "Egy jó"], ["multi", "Több jó"], ["number", "Szám"], ["truefalse", "Igaz-hamis"], ["text", "Szöveg"]], t)}</div>`
    + `<div class="field"><label for="qq-q">${t === "truefalse" ? "Állítás" : "Kérdés"}</label><textarea class="input mv-notearea" id="qq-q" rows="3" placeholder="${t === "truefalse" ? "Például: A tökéletesen rugalmatlan kereslet görbéje vízszintes." : "Írd be a kérdést"}">${esc(d.q || "")}</textarea></div>`;
  if (t === "single" || t === "multi") {
    const on = (L) => (t === "single" ? d.answer === L : (d.answer || []).includes(L));
    h += `<div class="field"><label>Válaszok · koppints a betűre a ${t === "single" ? "helyes" : "helyesek"} megjelöléséhez</label><div class="qe-opts">`
      + d.options.map((o, i) => `<div class="qe-opt"><button type="button" class="qe-mark${on(QUIZ_LETTERS[i]) ? " on" : ""}" data-mark="${i}" aria-pressed="${on(QUIZ_LETTERS[i])}" aria-label="${QUIZ_LETTERS[i]} helyes">${QUIZ_LETTERS[i]}</button>`
        + `<input class="input" data-opt="${i}" placeholder="${QUIZ_LETTERS[i]} válasz" autocomplete="off" value="${esc(o)}">`
        + (d.options.length > 2 ? `<button type="button" class="iconbtn plain" data-del="${i}" aria-label="${QUIZ_LETTERS[i]} válasz törlése">${icon("x")}</button>` : "") + `</div>`).join("")
      + `</div>` + (d.options.length < 8 ? `<button type="button" class="btn ghost narrow" id="qq-addopt">${icon("plus")}Válasz hozzáadása</button>` : "") + `</div>`;
  } else if (t === "number") {
    h += `<div class="bks-yr"><div class="field"><label for="qq-num">Helyes szám</label><input class="input" id="qq-num" inputmode="decimal" autocomplete="off" value="${d.answer != null && d.answer !== "" ? esc(quizFmtNum(d.answer)) : ""}" placeholder="Például: 12,5"></div>`
      + `<div class="field"><label for="qq-tol">Megengedett eltérés</label><input class="input" id="qq-tol" inputmode="decimal" autocomplete="off" value="${d.tolerance ? esc(quizFmtNum(d.tolerance)) : ""}" placeholder="Például: 0,1"></div></div>`
      + `<div class="field"><label for="qq-unit">Mértékegység (nem kötelező)</label><input class="input" id="qq-unit" autocomplete="off" value="${esc(d.unit || "")}" placeholder="Például: Ft"></div>`;
  } else if (t === "truefalse") {
    h += `<div class="field"><label>Helyes válasz</label>${seg("qq-tf", [["true", "Igaz"], ["false", "Hamis"]], String(d.answer === true))}</div>`;
  } else {
    h += `<div class="field"><label for="qq-txt">Elfogadott válaszok, soronként egy</label><textarea class="input mv-notearea" id="qq-txt" rows="3" placeholder="Pareto-hatékonyság&#10;Pareto-optimum">${esc(d.answerText || "")}</textarea><div class="hint">A kis- és nagybetű, az ékezet és az írásjelek nem számítanak.</div></div>`;
  }
  h += `<div class="field"><label for="qq-x">Magyarázat (nem kötelező)</label><textarea class="input mv-notearea" id="qq-x" rows="3" placeholder="Miért ez a helyes válasz?">${esc(d.explain || "")}</textarea></div>`
    + `<div class="field"><label for="qq-p">Oldal a forrás PDF-ben (nem kötelező)</label><input class="input" id="qq-p" inputmode="numeric" autocomplete="off" value="${d.page || ""}" placeholder="Például: 23"></div>`
    + (qeq.ix >= 0 ? `<button type="button" class="btn danger lg qe-del" id="qq-delete">${icon("trash")}Kérdés törlése</button>` : "");
  host.innerHTML = h;
  const grab = () => { // az űrlap értékei a piszkozatba (típusváltás előtt is, hogy ne vesszen el semmi)
    const v = (id) => ($(id) ? $(id).value : undefined);
    if (v("qq-q") != null) d.q = v("qq-q");
    host.querySelectorAll("[data-opt]").forEach((inp) => { d.options[+inp.dataset.opt] = inp.value; });
    if (v("qq-num") != null) { d.answer = quizNum(v("qq-num")); d.tolerance = quizNum(v("qq-tol")) || 0; d.unit = v("qq-unit").trim(); }
    if (v("qq-txt") != null) d.answerText = v("qq-txt");
    d.explain = v("qq-x"); const p = parseInt(v("qq-p"), 10); d.page = p > 0 ? p : undefined;
  };
  host.querySelectorAll("#qq-type [data-v]").forEach((b) => b.onclick = () => {
    grab(); const nt = b.dataset.v; if (nt === d.type) return;
    if ((nt === "single" || nt === "multi") && !Array.isArray(d.options)) d.options = ["", "", "", ""];
    if (nt === "single") d.answer = Array.isArray(d.answer) ? (d.answer[0] || "A") : QUIZ_LETTERS.includes(d.answer) && typeof d.answer === "string" ? d.answer : "A";
    else if (nt === "multi") d.answer = typeof d.answer === "string" && d.answer.length === 1 ? [d.answer] : Array.isArray(d.answer) && d.answer.every((x) => /^[A-H]$/.test(x)) ? d.answer : [];
    else if (nt === "number") d.answer = typeof d.answer === "number" ? d.answer : null;
    else if (nt === "truefalse") d.answer = d.answer === true;
    else d.answerText = d.answerText || "";
    d.type = nt; renderQuizQ();
  });
  host.querySelectorAll("[data-mark]").forEach((b) => b.onclick = () => {
    grab(); const L = QUIZ_LETTERS[+b.dataset.mark];
    if (d.type === "single") d.answer = L;
    else { const s = new Set(d.answer || []); if (s.has(L)) s.delete(L); else s.add(L); d.answer = [...s].sort(); }
    renderQuizQ();
  });
  host.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
    grab(); const i = +b.dataset.del, L = QUIZ_LETTERS[i];
    d.options.splice(i, 1);
    const shift = (x) => { const k = QUIZ_LETTERS.indexOf(x); return k > i ? QUIZ_LETTERS[k - 1] : x; }; // a törölt utáni betűk eggyel előrébb
    if (d.type === "single") d.answer = d.answer === L ? "A" : shift(d.answer);
    else d.answer = (d.answer || []).filter((x) => x !== L).map(shift);
    renderQuizQ();
  });
  const add = $("qq-addopt"); if (add) add.onclick = () => { grab(); d.options.push(""); renderQuizQ(); setTimeout(() => { const l = host.querySelectorAll("[data-opt]"); try { l[l.length - 1].focus(); } catch (e) {} }, 30); };
  host.querySelectorAll("#qq-tf [data-v]").forEach((b) => b.onclick = () => { grab(); d.answer = b.dataset.v === "true"; renderQuizQ(); });
  const del = $("qq-delete");
  if (del) del.onclick = async () => {
    const ok = await ask({ title: "Kérdés törlése", okText: "Törlés", cancelText: "Mégse", danger: true, body: esc(d.q || "") });
    if (!ok || !qeq) return;
    qe.questions.splice(qeq.ix, 1); qe.dirty = true; qeq = null; popScreen();
  };
  $("qq-save").onclick = () => {
    grab();
    const raw = Object.assign({}, d); if (d.type === "text") raw.answer = String(d.answerText || "").split(/\n+/);
    if (d.type === "single" || d.type === "multi") raw.options = d.options.map((o) => String(o || "").trim());
    delete raw.answerText;
    const r = quizNormQ(raw);
    if (!r.q) { toast("Hiba: " + r.err + "."); return; }
    if (qeq.ix >= 0) qe.questions[qeq.ix] = r.q; else qe.questions.push(r.q);
    qe.dirty = true; qeq = null; popScreen();
  };
}

// ---- Lejátszás ----
// qp = { id, meta, qs (kérdések), order (indexek), mode, i, sel (aktuális jelölés), done (ellenőrizve), res: [{ ix, ok, v }], t0 }
let qp = null;
async function quizPlayStart(id, mode) {
  const meta = quizById(id); if (!meta) return;
  const qs = await quizLoad(id); if (!qs.length) { toast("Ebben a quizben nincs kérdés."); return; }
  let order = qs.map((_, i) => i);
  if (mode === "wrong") order = (meta.wrong || []).filter((i) => i < qs.length);
  if (!order.length) order = qs.map((_, i) => i);
  if (mode !== "practice") for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  qp = { id, meta, qs, order, mode, full: mode !== "wrong" && order.length === qs.length, i: 0, sel: null, done: false, res: [], t0: Date.now(), finished: false };
  pushScreen("tab-quiz-play");
}
function quizPlayCur() { return qp && qp.qs[qp.order[qp.i]]; }
function renderQuizPlay() {
  const host = $("quiz-play-scroll"); if (!host) return;
  if (!qp) { host.innerHTML = `<div class="dash-empty">Nincs elindított quiz.</div>`; return; }
  $("quiz-play-title").textContent = qp.meta.title;
  $("quiz-play-sub").textContent = qp.mode === "exam" ? "Vizsga mód" : qp.mode === "wrong" ? "Csak a hibásak" : "Gyakorlás";
  if (qp.finished) return quizRenderResult(host);
  const q = quizPlayCur(), n = qp.order.length, exam = qp.mode === "exam", done = qp.done, ok = done && quizCheck(q, qp.sel);
  let h = `<div class="qp-top"><span class="qp-count">${qp.i + 1} / ${n}</span><span class="qp-type">${esc(QUIZ_TYPES[q.type])}</span></div>`
    + `<div class="qp-bar" aria-hidden="true"><i style="width:${Math.round((qp.i / n) * 100)}%"></i></div>`
    + `<div class="qp-q">${esc(q.q)}</div>`;
  if (q.type === "single" || q.type === "multi") {
    h += `<div class="qp-opts">` + q.options.map((o, i) => {
      const L = QUIZ_LETTERS[i], picked = q.type === "single" ? qp.sel === L : (qp.sel || []).includes(L);
      const right = q.type === "single" ? q.answer === L : q.answer.includes(L);
      const cls = done ? (right ? " right" : picked ? " wrong" : " dim") : picked ? " on" : "";
      return `<button type="button" class="qp-opt${cls}" data-l="${L}" aria-pressed="${picked}"${done ? " disabled" : ""}><span class="qp-L">${L}</span><span class="qp-ot">${esc(o)}</span>`
        + (done && right ? `<span class="qp-mark">${icon("check")}</span>` : done && picked ? `<span class="qp-mark">${icon("x")}</span>` : "") + `</button>`;
    }).join("") + `</div>`;
    if (q.type === "multi" && !done) h += `<div class="hint" style="margin:0 2px 8px">Több helyes válasz is lehet. Jelöld be mindet, majd Ellenőrzés.</div>`;
  } else if (q.type === "truefalse") {
    h += `<div class="qp-tf">` + [[true, "Igaz"], [false, "Hamis"]].map(([v, l]) => {
      const picked = qp.sel === v, right = q.answer === v;
      const cls = done ? (right ? " right" : picked ? " wrong" : " dim") : picked ? " on" : "";
      return `<button type="button" class="qp-opt qp-tfb${cls}" data-tf="${v}"${done ? " disabled" : ""}><span class="qp-ot">${l}</span></button>`;
    }).join("") + `</div>`;
  } else {
    const val = qp.sel == null ? "" : String(qp.sel);
    h += `<div class="qp-inrow"><input class="input qp-in${done ? (ok ? " right" : " wrong") : ""}" id="qp-in" ${q.type === "number" ? `inputmode="decimal"` : ""} autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${q.type === "number" ? "Írd be a számot" : "Írd be a választ"}" value="${esc(val)}"${done ? " disabled" : ""}>${q.unit ? `<span class="qp-unit">${esc(q.unit)}</span>` : ""}</div>`;
  }
  if (done && !exam) {
    h += `<div class="qp-fb ${ok ? "right" : "wrong"}"><div class="qp-fb-t">${icon(ok ? "check" : "x")}${ok ? "Helyes" : "Nem jó"}</div>`
      + (!ok ? `<div class="qp-fb-a">Helyes válasz: <b>${esc(quizAnswerText(q))}</b></div>` : "")
      + (q.explain ? `<div class="qp-fb-x">${esc(q.explain)}</div>` : "")
      + (q.page && qp.meta.mid && matById(qp.meta.mid) ? `<button type="button" class="btn ghost narrow qp-page" id="qp-page">${icon("doc")}Megnézem: ${q.page}. oldal</button>` : q.page ? `<div class="qp-fb-p">Forrás: ${q.page}. oldal</div>` : "")
      + `</div>`;
  }
  const needCheck = !done && (q.type === "multi" || q.type === "number" || q.type === "text");
  const last = qp.i === n - 1;
  h += `<div class="qp-actions">` + (needCheck ? `<button type="button" class="btn primary lg" id="qp-check">${exam ? (last ? "Befejezés" : "Tovább") : "Ellenőrzés"}</button>`
    : done ? `<button type="button" class="btn primary lg" id="qp-next">${last ? "Eredmény" : "Következő"}</button>` : "")
    + (!done ? `<button type="button" class="btn ghost narrow" id="qp-skip">${exam ? "Kihagyom" : "Nem tudom"}</button>` : "") + `</div>`;
  host.innerHTML = h;
  // Válasz rögzítése: egyszerű típusnál a koppintás maga a válasz (gyakorlásban azonnal ellenőriz, vizsgában továbblép).
  const commit = () => { qp.done = true; qp.res[qp.i] = { ix: qp.order[qp.i], ok: quizCheck(q, qp.sel), v: qp.sel }; if (exam) quizNext(); else renderQuizPlay(); };
  host.querySelectorAll("[data-l]").forEach((b) => b.onclick = () => {
    const L = b.dataset.l;
    if (q.type === "single") { qp.sel = L; commit(); }
    else { const s = new Set(qp.sel || []); if (s.has(L)) s.delete(L); else s.add(L); qp.sel = [...s].sort(); renderQuizPlay(); }
  });
  host.querySelectorAll("[data-tf]").forEach((b) => b.onclick = () => { qp.sel = b.dataset.tf === "true"; commit(); });
  const inp = $("qp-in");
  if (inp && !done) {
    inp.oninput = () => { qp.sel = inp.value; };
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const c = $("qp-check"); if (c) c.click(); } };
    if (!exam || qp.i > 0) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  }
  const chk = $("qp-check");
  if (chk) chk.onclick = () => {
    if (q.type === "multi" && !(qp.sel || []).length) { toast("Jelölj be legalább egy választ."); return; }
    if ((q.type === "number" || q.type === "text") && !String(qp.sel || "").trim()) { toast("Írd be a választ."); return; }
    if (q.type === "number" && quizNum(qp.sel) == null) { toast("Számot írj be."); return; }
    commit();
  };
  const nx = $("qp-next"); if (nx) nx.onclick = () => quizNext();
  const sk = $("qp-skip"); if (sk) sk.onclick = () => { qp.sel = null; commit(); };
  const pg = $("qp-page"); if (pg) pg.onclick = () => openMaterial(qp.meta.mid, { page: q.page });
  const sc = $("quiz-play-scroll"); if (sc && !done) sc.scrollTop = 0;
}
function quizNext() {
  if (!qp) return;
  if (qp.i < qp.order.length - 1) { qp.i++; qp.sel = null; qp.done = false; renderQuizPlay(); return; }
  quizFinish();
}
function quizFinish() {
  const res = qp.res.filter(Boolean), good = res.filter((r) => r.ok).length, pct = Math.round((good / qp.order.length) * 100);
  qp.finished = true; qp.pct = pct; qp.good = good; qp.secs = Math.round((Date.now() - qp.t0) / 1000);
  const m = qp.meta, st = (m.stats = m.stats || { attempts: 0, best: null });
  st.attempts = (st.attempts || 0) + 1; st.last = pct; st.lastAt = Date.now();
  if (qp.full) st.best = st.best == null ? pct : Math.max(st.best, pct);
  // A "hibásak" listája: teljes körnél az újak, a hibás-körnél a még mindig rosszak maradnak benne.
  const wrongNow = res.filter((r) => !r.ok).map((r) => r.ix);
  m.wrong = qp.full ? wrongNow : [...new Set(wrongNow.concat((m.wrong || []).filter((i) => !qp.order.includes(i))))];
  saveState();
  renderQuizPlay();
}
function quizRenderResult(host) {
  const n = qp.order.length, wrong = qp.res.filter((r) => r && !r.ok);
  const mm = Math.floor(qp.secs / 60), ss = qp.secs % 60;
  let h = `<div class="qp-res"><div class="qp-res-pct">${qp.pct}%</div><div class="qp-res-l">${qp.good} / ${n} helyes · ${mm ? mm + " perc " : ""}${ss} mp</div>`
    + (qp.meta.stats && qp.meta.stats.best != null && qp.full ? `<div class="qp-res-b">Legjobb eredményed: ${qp.meta.stats.best}%</div>` : "") + `</div>`;
  h += `<div class="qp-actions">` + (wrong.length ? `<button type="button" class="btn primary lg" id="qp-again-wrong">${icon("refresh")}Hibásak újra (${wrong.length})</button>` : "")
    + `<button type="button" class="btn tonal lg" id="qp-again">Újra az egész</button><button type="button" class="btn ghost narrow" id="qp-done">Kész</button></div>`;
  if (wrong.length) h += `<div class="dash-label">Ezeket érdemes átnézni</div><div class="card">` + wrong.map((r) => {
    const q = qp.qs[r.ix], yours = r.v == null || r.v === "" || (Array.isArray(r.v) && !r.v.length) ? "nem válaszoltál"
      : q.type === "truefalse" ? (r.v ? "Igaz" : "Hamis") : Array.isArray(r.v) ? r.v.join(", ") : String(r.v);
    return `<div class="row qp-wr"><span class="row-main"><span class="row-title">${esc(q.q)}</span>`
      + `<span class="qp-wr-l">Helyes: <b>${esc(quizAnswerText(q))}</b></span><span class="qp-wr-l">Te: ${esc(yours)}</span>`
      + (q.explain ? `<span class="qp-wr-x">${esc(q.explain)}</span>` : "") + (q.page ? `<span class="qp-wr-l">Forrás: ${q.page}. oldal</span>` : "") + `</span></div>`;
  }).join("") + `</div>`;
  host.innerHTML = h;
  // Újraindítás ugyanazon a képernyőn (a pushScreen ugyanarra a képernyőre nem tesz új elemet a vissza-verembe).
  const aw = $("qp-again-wrong"); if (aw) aw.onclick = () => quizPlayStart(qp.id, "wrong");
  $("qp-again").onclick = () => quizPlayStart(qp.id, qp.mode === "wrong" ? "practice" : qp.mode);
  $("qp-done").onclick = () => { qp = null; popScreen(); };
  host.scrollTop = 0;
}
// Kilépés játék közben (vissza nyíl, hardveres vissza): rákérdezünk, ha már válaszolt és még nincs vége.
let quizLeaving = false;
function quizPlayGuard() {
  if (quizLeaving) return false;
  if (!qp || qp.finished || !qp.res.some(Boolean)) { qp = null; return false; }
  ask({ title: "Kilépsz a quizből?", okText: "Kilépés", cancelText: "Folytatom", body: "Az eddigi válaszaid nem mentődnek." }).then((ok) => {
    if (!ok) return;
    qp = null; quizLeaving = true; popScreen(); quizLeaving = false;
  });
  return true;
}
// Szerkesztőből kilépés mentés nélkül: rákérdezünk.
function quizEditGuard() {
  if (quizLeaving || !qe || !qe.dirty) return false;
  ask({ title: "Elveted a változásokat?", okText: "Elvetés", cancelText: "Maradok", danger: true, body: "A quiz módosításai nincsenek mentve." }).then((ok) => {
    if (!ok) return;
    qe = null; quizLeaving = true; popScreen(); quizLeaving = false;
  });
  return true;
}
