// Anyagok: tárgyanként és félévenként csatolt PDF-ek és üres jegyzetek (lásd ANYAGOK.md).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Tárolás ----
// A lista (metaadat) a state.materials-ben van profilonként, hogy a képernyők szinkron rajzolhassanak.
// A fájlok (Blob) és a jegyzetrétegek IndexedDB-ben, mert a localStorage 5-10 MB-nál megtelik.
// ponytail: IndexedDB az app saját WebView-adatterülete; ha valaha iOS is lesz, ott a Filesystem biztosabb.
const MAT_DB = "kreditplus-anyagok", MAT_MAX_MB = 150;
let matDbP = null;
function matDb() {
  if (matDbP) return matDbP;
  matDbP = new Promise((res, rej) => {
    const r = indexedDB.open(MAT_DB, 1);
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore("files"); db.createObjectStore("docs"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { matDbP = null; rej(r.error); };
  });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  return matDbP;
}
async function matTx(store, mode, fn) {
  const db = await matDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => res(out && "result" in out ? out.result : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error("A mentés megszakadt (lehet, hogy megtelt a tárhely)."));
  });
}
const matPutFile = (id, blob) => matTx("files", "readwrite", (s) => s.put(blob, id));
const matGetFile = (id) => matTx("files", "readonly", (s) => s.get(id));
const matPutDoc = (id, doc) => matTx("docs", "readwrite", (s) => s.put(doc, id));
const matGetDoc = (id) => matTx("docs", "readonly", (s) => s.get(id));
async function matDeleteData(id) { await matTx("files", "readwrite", (s) => s.delete(id)); await matTx("docs", "readwrite", (s) => s.delete(id)); }
async function matClearAll() { await matTx("files", "readwrite", (s) => s.clear()); await matTx("docs", "readwrite", (s) => s.clear()); }

function mats() { return (state.materials = state.materials || []); }
// A könyvek (books.js) ugyanazt a tárolót és megjelenítőt használják, ezért itt is keresünk köztük.
function matById(id) { return mats().find((m) => m.id === id) || (state.books || []).find((m) => m.id === id) || null; }
function matSubjKey(name) { return searchNorm(name || "").replace(/\s+/g, " ").trim(); }
function matFmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }

// ---- Könyvtárak: csak az első használatkor töltődnek be ----
let matPdfjsP = null;
function matPdfjs() {
  if (!matPdfjsP) matPdfjsP = import(new URL("lib/pdfjs/pdf.min.js", document.baseURI).href).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("lib/pdfjs/pdf.worker.min.js", document.baseURI).href;
    return lib;
  }).catch((e) => { matPdfjsP = null; throw e; });
  return matPdfjsP;
}
function matPdfOpts(data) { return { data, standardFontDataUrl: new URL("lib/pdfjs/standard_fonts/", document.baseURI).href, isEvalSupported: false }; }
const matScriptP = {};
function matScript(path, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!matScriptP[path]) matScriptP[path] = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = path; s.onload = () => res(window[globalName]); s.onerror = () => { delete matScriptP[path]; rej(new Error("Nem sikerült betölteni: " + path)); };
    document.head.appendChild(s);
  });
  return matScriptP[path];
}

// ---- Félévek és tárgyak ----
function matSemesters() {
  const keys = new Set(allSemesters().map((s) => s.key));
  keys.add(currentSemesterKey());
  mats().forEach((m) => keys.add(m.sem));
  return [...keys].sort().reverse();
}
// Egy félév tárgyai: a felvett tárgyakból, az órarendből és a már csatolt anyagokból összegyűjtve.
function matSubjects(sem) {
  const out = new Map();
  const add = (name, code) => { const k = matSubjKey(name); if (!k) return; const o = out.get(k); if (!o) out.set(k, { key: k, name, code: code || "" }); else if (!o.code && code) o.code = code; };
  ((state.courses && state.courses.list) || []).filter((c) => c.semester === sem).forEach((c) => add(c.name, c.code));
  classEvents().forEach((e) => { if (semObj(e.S).key !== sem) return; const p = parseClassSummary(e.summary); if (p && p.name) add(p.name); });
  mats().filter((m) => m.sem === sem).forEach((m) => add(m.subjName));
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "hu"));
}
function matOf(sem, subjKey) { return mats().filter((m) => m.sem === sem && m.subj === subjKey).sort((a, b) => (b.upd || 0) - (a.upd || 0)); }

// ---- Importálás és új jegyzet ----
const MAT_A4 = { w: 595, h: 842 };
async function matImportPdf(file, sem, subj) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (!isPdf) { toast("Most még csak PDF fájlt lehet importálni."); return; }
  if (file.size > MAT_MAX_MB * 1048576) { toast("Túl nagy fájl (legfeljebb " + MAT_MAX_MB + " MB)."); return; }
  showBusy("PDF beolvasása…");
  try {
    const lib = await matPdfjs();
    const pdf = await lib.getDocument(matPdfOpts(new Uint8Array(await file.arrayBuffer()))).promise;
    const n = pdf.numPages; try { pdf.destroy(); } catch (e) {}
    const id = "m" + uid();
    const doc = { v: 1, pages: Array.from({ length: n }, (_, i) => ({ id: "p" + (i + 1), kind: "pdf", n: i + 1 })), items: {} };
    await matPutFile(id, file);
    await matPutDoc(id, doc);
    const title = (file.name || "Dokumentum").replace(/\.pdf$/i, "");
    mats().push({ id, sem, subj: subj.key, subjName: subj.name, code: subj.code || "", title, kind: "pdf", pages: n, size: file.size, at: Date.now(), upd: Date.now() });
    saveState(); hideBusy();
    toast("Importálva: " + title);
    renderMatSubject();
  } catch (e) {
    hideBusy();
    const pw = e && e.name === "PasswordException";
    await ask({ title: "Nem sikerült importálni", okText: "OK", cancelText: "Bezárás", body: pw ? "Ez a PDF jelszóval védett. Nyisd meg jelszó nélkül mentve, és úgy importáld." : "A fájlt nem tudtam PDF-ként beolvasni. " + esc(String(e && e.message || e)) });
  }
}
async function matNewNote(sem, subj) {
  const t = await askText({ title: "Új jegyzet", value: "Jegyzet", placeholder: "Például: 3. előadás", body: "Üres jegyzetfüzet, amibe írhatsz és rajzolhatsz. Később új oldalakat is hozzáadhatsz." });
  if (t == null) return;
  const id = "m" + uid();
  await matPutDoc(id, { v: 1, pages: [{ id: "b" + uid(), kind: "blank", w: MAT_A4.w, h: MAT_A4.h }], items: {} });
  mats().push({ id, sem, subj: subj.key, subjName: subj.name, code: subj.code || "", title: t.trim() || "Jegyzet", kind: "note", pages: 1, size: 0, at: Date.now(), upd: Date.now() });
  saveState();
  openMaterial(id);
}
async function matDelete(id) {
  const m = matById(id); if (!m) return;
  const ok = await ask({ title: "Anyag törlése", okText: "Törlés", cancelText: "Mégse", body: `Biztosan törlöd? A fájl és a benne lévő összes jegyzet elvész.<br><b>${esc(m.title)}</b>` });
  if (!ok) return;
  try { await matDeleteData(id); } catch (e) {}
  state.materials = mats().filter((x) => x.id !== id); saveState(); renderMatSubject();
}

// ---- Képernyők ----
let matSem = "", matSubjCur = null;
function openMatSubject(sem, name, code) {
  matSem = sem; matSubjCur = { key: matSubjKey(name), name, code: code || "" };
  pushScreen("tab-mat-subject");
}
function renderMats() {
  const host = $("mats-scroll"); if (!host) return;
  mvClose();
  if (!matSem) matSem = currentSemesterKey();
  const subs = matSubjects(matSem);
  let h = `<div class="controls dd-row"><button class="period-btn dd" id="mat-sem" type="button"><span>${esc(fmtTerm(matSem))}</span>${icon("down")}</button></div>`;
  if (!subs.length) h += `<div class="dash-empty" style="padding:24px 2px">Ehhez a félévhez nem találtam tárgyat. Olvasd be a tárgyaidat vagy az órarendet a Neptunból.</div>`;
  else h += `<div class="card">` + subs.map((s) => {
    const list = matOf(matSem, s.key), n = list.length;
    const sub = n ? n + " anyag · utoljára " + fmtWhen(new Date(list[0].upd)) : "Még nincs anyag";
    return `<div class="row mat-subj" data-name="${esc(s.name)}" data-code="${esc(s.code)}" style="cursor:pointer"><span class="row-ic">${icon("book")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${esc(sub)}</span></span>${icon("chev")}</div>`;
  }).join("") + `</div>`;
  h += `<div class="dash-label">Mentés</div><div class="card">`
    + `<div class="row" id="mat-backup" style="cursor:pointer"><span class="row-ic">${icon("download")}</span><span class="row-main"><span class="row-title">Anyagok mentése</span><span class="row-sub">Minden fájl és jegyzet egy .zip fájlba</span></span>${icon("chev")}</div>`
    + `<div class="row" id="mat-restore" style="cursor:pointer"><span class="row-ic">${icon("refresh")}</span><span class="row-main"><span class="row-title">Visszaállítás mentésből</span><span class="row-sub">Egy korábbi .zip mentés betöltése</span></span>${icon("chev")}</div></div>`
    + `<div class="hint" style="margin:8px 2px">Az anyagok nincsenek benne az app napi automatikus mentésében, ezért időnként mentsd el őket külön.</div>`;
  host.innerHTML = h;
  $("mat-sem").onclick = async () => {
    const v = await askPick({ title: "Félév", options: matSemesters().map((k) => ({ label: k, sub: k === currentSemesterKey() ? "Aktuális félév" : "", value: k })) });
    if (v) { matSem = v; renderMats(); }
  };
  host.querySelectorAll(".mat-subj").forEach((b) => b.onclick = () => openMatSubject(matSem, b.dataset.name, b.dataset.code));
  $("mat-backup").onclick = matBackup;
  $("mat-restore").onclick = () => { const f = $("mat-zip"); f.value = ""; f.click(); };
}
function renderMatSubject() {
  const host = $("mat-subject-scroll"); if (!host || !matSubjCur) return;
  mvClose(); // a megnyitott PDF memóriáját elengedjük
  const ttl = $("mat-subject-title"); if (ttl) ttl.textContent = matSubjCur.name;
  const sub = $("mat-subject-sub"); if (sub) sub.textContent = matSem + (matSubjCur.code ? " · " + matSubjCur.code : "");
  const list = matOf(matSem, matSubjCur.key);
  // Importálás és új jegyzet: ikonok a fejléc jobb oldalán (#mat-import, #mat-note).
  let h = "";
  if (!list.length) h += `<div class="dash-empty" style="padding:24px 2px">Még nincs anyag ehhez a tárgyhoz. Importálj egy PDF-et, vagy kezdj egy üres jegyzetet a jobb felső gombokkal.</div>`;
  else h += `<div class="card">` + list.map((m) => {
    const meta = [m.kind === "pdf" ? "PDF" : "Jegyzet", m.pages + " oldal", m.size ? matFmtSize(m.size) : "", fmtWhen(new Date(m.upd))].filter(Boolean).join(" · ");
    return `<div class="row mat-row" data-id="${esc(m.id)}" style="cursor:pointer"><span class="row-ic">${icon(m.kind === "pdf" ? "doc" : "note")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(m.title)}</span><span class="row-sub">${esc(meta)}</span></span>`
      + `<button class="iconbtn plain mat-more" data-id="${esc(m.id)}" type="button" aria-label="Műveletek">${icon("more")}</button></div>`;
  }).join("") + `</div>`;
  if (list.length) h += `<div class="card"><button class="row" type="button" id="mat-dl-all"><span class="row-ic">${icon("download")}</span><span class="row-main">`
    + `<span class="row-title">${list.length === 1 ? "Anyag letöltése a telefonra" : "Anyagok letöltése a telefonra"}</span><span class="row-sub">${list.length === 1 ? "PDF" : list.length + " PDF"} a Letöltések mappába, a jegyzeteiddel együtt</span></span><span class="row-chev">${icon("chev")}</span></button></div>`;
  // A tárgyhoz rendelt könyvek (books.js): félévtől függetlenül, a tárgy neve alapján.
  const bks = (state.books || []).filter((b) => (b.subjects || []).some((s) => s.key === matSubjCur.key));
  if (bks.length) h += `<div class="dash-label">Könyvek</div><div class="card">` + bks.map((b) => bookRow(b, false)).join("") + `</div>`;
  const qzs = (state.quizzes || []).filter((q) => (q.subjects || []).some((s) => s.key === matSubjCur.key));
  if (qzs.length) h += `<div class="dash-label">Quizek</div><div class="card">` + qzs.map((q) => quizRow(q, false)).join("") + `</div>`;
  host.innerHTML = h;
  host.querySelectorAll(".bk-row").forEach((b) => b.onclick = () => openMaterial(b.dataset.id));
  host.querySelectorAll(".qz-row").forEach((b) => b.onclick = () => quizStartMenu(b.dataset.id));
  const dla = $("mat-dl-all"); if (dla) dla.onclick = () => matDownloadPdfs(list.map((m) => m.id));
  $("mat-import").onclick = () => { const f = $("mat-file"); f.value = ""; f.click(); };
  $("mat-note").onclick = () => matNewNote(matSem, matSubjCur);
  host.querySelectorAll(".mat-row").forEach((b) => b.onclick = (ev) => { if (!ev.target.closest(".mat-more")) openMaterial(b.dataset.id); });
  host.querySelectorAll(".mat-more").forEach((b) => b.onclick = async () => {
    const m = matById(b.dataset.id); if (!m) return;
    const act = await askPick({ title: m.title, options: [
      { label: "Megnyitás", value: "open" }, { label: "Átnevezés", value: "rename" },
      { label: "Letöltés a telefonra", sub: "A Letöltések mappába, a jegyzeteiddel együtt", value: "dl" },
      { label: "Megosztás jegyzetekkel", sub: "PDF-ként, a rajzokkal és szövegekkel együtt", value: "share" }, { label: "Törlés", value: "delete" }] });
    if (act === "open") openMaterial(m.id);
    else if (act === "rename") { const t = await askText({ title: "Átnevezés", value: m.title }); if (t != null && t.trim()) { m.title = t.trim(); saveState(); renderMatSubject(); } }
    else if (act === "share") matSharePdf(m.id);
    else if (act === "dl") matDownloadPdfs([m.id]);
    else if (act === "delete") matDelete(m.id);
  });
}
// Link az óra részleteiből a tárgy anyagaihoz.
function matDetailLink(e) {
  const p = e && !e.manual ? parseClassSummary(e.summary) : null;
  const name = (p && p.name) || (e && (e.subject || e.summary)) || "";
  if (!name || !e.S) return "";
  const sem = semObj(e.S).key, n = matOf(sem, matSubjKey(name)).length;
  return `<div class="card" style="margin-bottom:12px"><div class="row" id="dn-mats" data-sem="${esc(sem)}" data-name="${esc(name)}" style="cursor:pointer"><span class="row-ic">${icon("doc")}</span>`
    + `<span class="row-main"><span class="row-title">Anyagok</span><span class="row-sub">${n ? n + " anyag ehhez a tárgyhoz" : "PDF-ek és jegyzetek ehhez a tárgyhoz"}</span></span>${icon("chev")}</div></div>`;
}

// ---- Fájl mentése / megosztása (PDF, zip) ----
async function matShareBlob(blob, name, mime, what) {
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Kredit+" }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const dl = DLP();
  if (isNative && dl && dl.saveToDownloads) {
    try {
      const r = await dl.saveToDownloads({ base64: b64(await blob.arrayBuffer()), fileName: name, mime });
      const open = await ask({ title: what + " mentve", okText: "Megnyitás", cancelText: "Kész", body: "Elmentve a Letöltések közé: <b>" + esc(name) + "</b>." });
      if (open && r && r.uri) { try { await dl.open({ uri: r.uri, mime }); } catch (e) { toast("Nem sikerült megnyitni."); } }
    } catch (e) { toast("Nem sikerült menteni: " + (e && e.message ? e.message : e)); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Letöltés a telefon Letöltések mappájába, a jegyzetekkel és szerkesztésekkel együtt (matBuildPdf), hogy más appban
// (pl. egy AI-ban) csatolni lehessen. Böngészőben sima letöltés.
async function matDownloadPdfs(ids) {
  const list = ids.map(matById).filter(Boolean); if (!list.length) return;
  const dl = DLP(), saved = [];
  showBusy("PDF készítése…");
  try {
    for (let i = 0; i < list.length; i++) {
      const m = list[i], name = slugName(m.title) + ".pdf";
      const blob = await matBuildPdf(m.id);
      $("busy-text").textContent = list.length > 1 ? "Mentés… " + (i + 1) + " / " + list.length : "Mentés…";
      if (isNative && dl && dl.saveToDownloads) { const r = await dl.saveToDownloads({ base64: b64(await blob.arrayBuffer()), fileName: name, mime: "application/pdf" }); saved.push({ name, uri: r && r.uri }); }
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); saved.push({ name }); }
    }
    hideBusy();
  } catch (e) { hideBusy(); await ask({ title: "Nem sikerült menteni", okText: "OK", cancelText: "Bezárás", body: esc(String(e && e.message || e)) }); return; }
  const one = saved.length === 1 ? saved[0] : null;
  const open = await ask({ title: one ? "PDF mentve" : saved.length + " PDF mentve", okText: one && one.uri ? "Megnyitás" : "Rendben", cancelText: "Kész",
    body: "A Letöltések mappába" + (one ? `: <b>${esc(one.name)}</b>` : ":<br>" + saved.map((s) => esc(s.name)).join("<br>")) + "<br><br>Más appban (pl. egy AI-ban) innen csatolhatod. A jegyzeteid és a szerkesztéseid is benne vannak." });
  if (open && one && one.uri) { try { await dl.open({ uri: one.uri, mime: "application/pdf" }); } catch (e) {} }
}

// ---- Mentés és visszaállítás (.zip) ----
async function matBackup() {
  const list = mats(), bookList = state.books || [], quizList = state.quizzes || [];
  if (!list.length && !bookList.length && !quizList.length) { toast("Még nincs mit menteni."); return; }
  showBusy("Mentés készítése…");
  try {
    const JSZip = await matScript("lib/jszip.min.js", "JSZip");
    const zip = new JSZip(), docs = {};
    for (const m of list.concat(bookList, quizList)) {
      docs[m.id] = await matGetDoc(m.id);
      if (m.kind === "pdf") { const f = await matGetFile(m.id); if (f) zip.file("files/" + m.id + ".pdf", f); }
    }
    zip.file("anyagok.json", JSON.stringify({ app: "Kredit+", v: 1, at: new Date().toISOString(), materials: list, books: bookList, quizzes: quizList, docs }));
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
    hideBusy();
    await matShareBlob(blob, "kreditplus-anyagok-" + backupTs() + ".zip", "application/zip", "Mentés");
  } catch (e) { hideBusy(); toast("Nem sikerült a mentés: " + (e && e.message ? e.message : e)); }
}
async function matRestore(file) {
  if (!file) return;
  showBusy("Mentés beolvasása…");
  try {
    const JSZip = await matScript("lib/jszip.min.js", "JSZip");
    const zip = await JSZip.loadAsync(file);
    const j = zip.file("anyagok.json");
    if (!j) throw new Error("Ez nem Kredit+ anyag-mentés.");
    const data = JSON.parse(await j.async("string"));
    const incoming = (data.materials || []).concat((data.books || []).map((b) => Object.assign({}, b, { book: true })),
      (data.quizzes || []).map((q) => Object.assign({}, q, { quiz: true }))).filter((m) => m && m.id);
    hideBusy();
    const have = new Set(mats().concat(state.books || [], state.quizzes || []).map((m) => m.id));
    const fresh = incoming.filter((m) => !have.has(m.id));
    const nb = incoming.filter((m) => m.book || m.quiz).length;
    const ok = await ask({ title: "Visszaállítás", okText: "Visszaállítás", cancelText: "Mégse",
      body: `A mentésben <b>${incoming.length - nb}</b> anyag${nb ? ` és <b>${nb}</b> könyv vagy quiz` : ""} van, ebből <b>${fresh.length}</b> új. A már meglévőket nem írom felül.` });
    if (!ok || !fresh.length) return;
    showBusy("Visszaállítás…");
    for (const m of fresh) {
      if (m.kind === "pdf") {
        const f = zip.file("files/" + m.id + ".pdf");
        if (!f) continue;
        await matPutFile(m.id, new Blob([await f.async("uint8array")], { type: "application/pdf" }));
      }
      await matPutDoc(m.id, (data.docs && data.docs[m.id]) || { v: 1, pages: [], items: {} });
      if (m.book) (state.books = state.books || []).push(m); else if (m.quiz) (state.quizzes = state.quizzes || []).push(m); else mats().push(m);
    }
    saveState(); hideBusy(); renderMats();
    toast(fresh.length + (nb ? " anyag és könyv" : " anyag") + " visszaállítva.");
  } catch (e) { hideBusy(); await ask({ title: "Nem sikerült", okText: "OK", body: esc(String(e && e.message || e)) }); }
}
// ---- Megosztás a Kredit+-ba (Android: PDF más appokból, lásd ShareReceiverPlugin) ----
// A natív oldal a fájlt a cache-be másolja és "shared" eseményt küld (megtartva, amíg fel nem iratkozunk).
// Csak akkor kérdezünk rá a tárgyra, ha az app már használható: be van állítva, nincs zárolva, nincs indítóképernyő.
const matIncoming = [];
let matIncomingBusy = false;
function matShareReceiver() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ShareReceiver; }
// Az isLocked a lock.js-ben van, ami KÉSŐBB töltődik be: typeof-fal nézzük, hogy korai esemény se dobjon hibát.
function matAppReady() { const b = $("boot"); return !!state.setupComplete && typeof isLocked !== "undefined" && !isLocked && (!b || b.hidden); }
async function matProcessIncoming() {
  if (matIncomingBusy || !matIncoming.length) return;
  if (!state.setupComplete) { matIncoming.length = 0; toast("A PDF fogadásához előbb állítsd be az appot."); return; }
  if (!matAppReady()) { setTimeout(matProcessIncoming, 700); return; }
  matIncomingBusy = true;
  try {
    const batch = matIncoming.splice(0), files = [];
    for (const f of batch) {
      try {
        const res = await fetch(window.Capacitor.convertFileSrc("file://" + f.path));
        files.push(new File([await res.blob()], f.name || "dokumentum.pdf", { type: "application/pdf" }));
      } catch (e) {}
    }
    if (!files.length) { toast("Nem sikerült beolvasni a megosztott PDF-et."); return; }
    await matAssignIncoming(files);
  } finally {
    matIncomingBusy = false;
    try { const P = matShareReceiver(); if (P && P.clear) P.clear(); } catch (e) {}
    if (matIncoming.length) matProcessIncoming();
  }
}
// Tárgyválasztó al-oldal a beérkezett PDF-ekhez: fent félévválasztó (alapból a legújabb), alatta a félév tárgyai.
// A visszaadott Promise a választáskor (true) vagy elvetéskor (false) teljesül; elvetés = Mégse, vissza nyíl vagy hardveres vissza.
let matShare = null; // { files, sem, resolve }
function matAssignIncoming(files) {
  return new Promise((resolve) => {
    matShare = { files, sem: matSemesters()[0] || currentSemesterKey(), resolve };
    renderMatShare();
    pushScreen("tab-mat-share");
  });
}
function matShareFinish(result) { const s = matShare; if (!s) return; matShare = null; s.resolve(result); }
function renderMatShare() {
  const host = $("mat-share-scroll"); if (!host || !matShare) return;
  const { files, sem } = matShare, cur = currentSemesterKey();
  $("mat-share-sub").textContent = files.length === 1 ? files[0].name : files.length + " PDF";
  const subs = matSubjects(sem);
  let h = `<div class="card"><button class="row" type="button" id="mat-share-book"><span class="row-ic">${icon("books")}</span>`
    + `<span class="row-main"><span class="row-title">Mentés a Könyvek közé</span><span class="row-sub">Olvasás, folytatás és oldaljegyzetek, tárgyhoz később is rendelhető</span></span><span class="row-chev">${icon("chev")}</span></button></div>`
    + `<div class="dash-label">Vagy anyagként egy tárgyhoz, félév</div>`
    + `<button class="period-btn" id="mat-share-sem" type="button" style="width:100%"><span>${esc(sem)}${sem === cur ? " · aktuális" : ""}</span>${icon("down")}</button>`
    + `<div class="dash-label">Tárgy</div>`;
  if (!subs.length) h += `<div class="hint" style="margin:0 2px 10px">Ebben a félévben nem találtam tárgyat. Válassz másik félévet, vagy add meg a tárgy nevét.</div>`;
  h += `<div class="card">` + subs.map((s) => {
    const n = matOf(sem, s.key).length;
    return `<button class="row" type="button" data-share-subj="${esc(s.key)}"><span class="row-ic">${icon("book")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${n ? n + " anyag" : "Még nincs anyag"}</span></span><span class="row-chev">${icon("chev")}</span></button>`;
  }).join("")
    + `<button class="row" type="button" id="mat-share-custom"><span class="row-ic">${icon("plus")}</span>`
    + `<span class="row-main"><span class="row-title">Új tárgy megadása</span><span class="row-sub">Ha a tárgy nincs a listában</span></span><span class="row-chev">${icon("chev")}</span></button></div>`;
  host.innerHTML = h;
  $("mat-share-sem").onclick = () => openList({ title: "Félév", selected: sem,
    items: matSemesters().map((k) => ({ value: k, label: k, sub: k === cur ? "Aktuális félév" : "" })),
    onPick: (v) => { if (matShare) { matShare.sem = v; renderMatShare(); } } });
  host.querySelectorAll("[data-share-subj]").forEach((b) => b.onclick = () => { const s = subs.find((x) => x.key === b.dataset.shareSubj); if (s) matShareImport(s); });
  $("mat-share-book").onclick = async () => {
    const s = matShare; if (!s) return;
    matShare = null; // innen az oldal elhagyása már nem elvetés
    await bookImportFiles(s.files);
    pushScreen("tab-books");
    navStack = navStack.filter((id) => id !== "tab-mat-share");
    s.resolve(true);
  };
  $("mat-share-custom").onclick = async () => {
    const t = await askText({ title: "Tárgy neve", placeholder: "Például: Statisztika", body: "A tárgy ezzel a névvel jelenik meg az Anyagok között." });
    if (t == null || !t.trim()) return;
    matShareImport({ key: matSubjKey(t), name: t.trim(), code: "" });
  };
}
async function matShareImport(subj) {
  const s = matShare; if (!s) return;
  matShare = null; // innen az oldal elhagyása már nem elvetés
  for (const f of s.files) await matImportPdf(f, s.sem, subj);
  openMatSubject(s.sem, subj.name, subj.code);
  navStack = navStack.filter((id) => id !== "tab-mat-share"); // a tárgy oldaláról vissza ne a megosztás-oldalra vigyen
  s.resolve(true);
}
$("mat-share-cancel").onclick = () => popScreen();
// Ha a megosztás-oldal bármiként bezárul (Mégse, vissza nyíl, hardveres vissza) választás nélkül, az elvetés.
new MutationObserver(() => { if (!$("tab-mat-share").classList.contains("active")) matShareFinish(false); })
  .observe($("tab-mat-share"), { attributes: true, attributeFilter: ["class"] });
(function matInitShareReceiver() {
  const P = matShareReceiver();
  if (!isNative || !P || !P.addListener) return;
  P.addListener("shared", (d) => { (d && d.files || []).forEach((f) => matIncoming.push(f)); matProcessIncoming(); });
})();

$("mat-file").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f && matSubjCur) matImportPdf(f, matSem, matSubjCur); });
$("mat-zip").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) matRestore(f); });
