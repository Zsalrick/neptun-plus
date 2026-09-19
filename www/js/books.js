// Könyvek: saját könyvtár (importált vagy ingyenes forrásból letöltött PDF-ek), olvasás az Anyagok megjelenítőjével
// (folytatás onnan, ahol abbahagytad, oldaljegyzetek, tartalomjegyzék, keresés), tárgyhoz rendelés, könyvkereső.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Tárolás ----
// A lista (metaadat) a state.books-ban van profilonként, a fájl és a jegyzetréteg ugyanabban az IndexedDB-ben,
// mint az anyagoké (matPutFile / matPutDoc), ezért a megjelenítő, a megosztás és a .zip mentés is közös.
// Könyv: { id:"k…", book:true, kind:"pdf", title, author, pages, size, at, upd, opened, cover (kis JPEG data URL),
//   subjects:[{ key, name }], src:{ from:"openalex"|"mek"|"link", pdf, page, license } | null,
//   last:{ i, f, p, at } (olvasási pozíció: i/f a képernyő teteje, p a látott oldal), pnotes:[…] (oldaljegyzetek, lásd material-viewer.js) }
// A könyvek csak a forrásból a telefonra töltődnek: a Kredit+ nem tárol és nem továbbít könyvet.
function books() { return (state.books = state.books || []); }
function bookById(id) { return books().find((b) => b.id === id) || null; }
function bookSeen(b) { return Math.max(b.opened || 0, (b.last && b.last.at) || 0, b.at || 0); }
function bookProgress(b) { const n = b.pages || 0, L = b.last, i = L ? (L.p != null ? L.p : L.i) + 1 : 0; return { i, n, pct: n ? Math.round((i / n) * 100) : 0 }; }
function bookReadText(b) {
  const p = bookProgress(b);
  if (!b.last || (!b.last.i && !b.last.f)) return "Még nem kezdted el";
  return p.i >= p.n ? "Az utolsó oldalnál tartasz" : `${p.i}. oldal / ${p.n}`;
}
function bookCover(b, cls) { return b.cover ? `<img class="${cls}" src="${b.cover}" alt="">` : `<span class="${cls} bk-nocover">${icon("books")}</span>`; }
// Könyv sora (a Könyvek listán és a tárgy anyagai között is). more: ⋯ gomb a műveletekhez.
function bookRow(b, more) {
  const p = bookProgress(b), subj = (b.subjects || []).map((s) => s.name).join(", ");
  const sub = [b.author, more ? subj : "", bookReadText(b)].filter(Boolean).join(" · ");
  const started = b.last && (b.last.i || b.last.f);
  return `<div class="row bk-row" data-id="${esc(b.id)}" style="cursor:pointer">${bookCover(b, "bk-cover")}`
    + `<span class="row-main"><span class="row-title">${esc(b.title)}</span><span class="row-sub">${esc(sub)}</span>`
    + (started ? `<span class="bk-prog" aria-hidden="true"><i style="width:${Math.max(2, p.pct)}%"></i></span>` : "") + `</span>`
    + (more ? `<button class="iconbtn plain bk-more" data-id="${esc(b.id)}" type="button" aria-label="Műveletek">${icon("more")}</button>` : `<span class="row-chev">${icon("chev")}</span>`)
    + `</div>`;
}

// ---- PDF beolvasása: oldalszám, oldalméretek (hogy az első megnyitás is gyors legyen), borító, metaadat ----
async function bookPdfInfo(blob, onProgress) {
  const lib = await matPdfjs();
  const pdf = await lib.getDocument(matPdfOpts(new Uint8Array(await blob.arrayBuffer()))).promise;
  try {
    const n = pdf.numPages, sizes = [];
    for (let i = 1; i <= n; i++) {
      const v = (await pdf.getPage(i)).getViewport({ scale: 1 });
      sizes.push([v.width, v.height]);
      if (onProgress && n > 60 && i % 20 === 0) onProgress(i, n);
    }
    let cover = "";
    try {
      const pg = await pdf.getPage(1), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 132 / v0.width });
      const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      cover = cv.toDataURL("image/jpeg", 0.72); cv.width = 0; cv.height = 0;
    } catch (e) {}
    let info = {}; try { const md = await pdf.getMetadata(); info = (md && md.info) || {}; } catch (e) {}
    return { n, sizes, cover, title: String(info.Title || "").trim(), author: String(info.Author || "").trim() };
  } finally { try { pdf.destroy(); } catch (e) {} }
}
// A PDF saját címe gyakran használhatatlan ("Microsoft Word - jegyzet.doc", "untitled"): csak akkor vesszük át, ha értelmes.
function bookGoodMetaTitle(t) { return t && t.length >= 4 && !/^(microsoft|untitled|document|dokumentum|title|cím)\b/i.test(t) && !/\.(docx?|pdf|tex|indd)$/i.test(t) ? t : ""; }
async function bookImportBlob(blob, info) {
  if (blob.size > MAT_MAX_MB * 1048576) throw new Error("Túl nagy fájl (legfeljebb " + MAT_MAX_MB + " MB).");
  const pi = await bookPdfInfo(blob, (i, n) => { const t = $("busy-text"); if (t) t.textContent = "Oldalak beolvasása… " + i + " / " + n; });
  const id = "k" + uid();
  await matPutFile(id, blob);
  await matPutDoc(id, { v: 1, pages: pi.sizes.map(([w, h], i) => ({ id: "p" + (i + 1), kind: "pdf", n: i + 1, w, h })), items: {} });
  const b = { id, book: true, kind: "pdf", title: info.title || bookGoodMetaTitle(pi.title) || info.fileTitle || "Könyv", author: info.author || pi.author || "",
    pages: pi.n, size: blob.size, at: Date.now(), upd: Date.now(), subjects: [], src: info.src || null, cover: pi.cover };
  books().push(b); saveState();
  return b;
}
function bookFileTitle(name) { return String(name || "").replace(/\.pdf$/i, "").replace(/[_+]+/g, " ").replace(/\s+/g, " ").trim(); }
// Fájlok felvétele (a jobb felső gomb, vagy más appból megosztva). Utána felajánlja a tárgyhoz rendelést.
async function bookImportFiles(files) {
  const done = [];
  for (const f of files) {
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""))) { toast("Most még csak PDF-et lehet könyvként felvenni."); continue; }
    showBusy("PDF beolvasása…");
    try { done.push(await bookImportBlob(f, { fileTitle: bookFileTitle(f.name) })); hideBusy(); }
    catch (e) {
      hideBusy();
      const pw = e && e.name === "PasswordException";
      await ask({ title: "Nem sikerült felvenni", okText: "OK", cancelText: "Bezárás", body: pw ? "Ez a PDF jelszóval védett. Nyisd meg jelszó nélkül mentve, és úgy vedd fel." : "A fájlt nem tudtam PDF-ként beolvasni. " + esc(String(e && e.message || e)) });
    }
  }
  if (!done.length) return done;
  toast(done.length === 1 ? "Hozzáadva: " + done[0].title : done.length + " könyv hozzáadva.");
  bookRefresh();
  bookOfferSubject(done);
  return done;
}
function bookRefresh() {
  const cur = document.querySelector(".tabscreen.active");
  if (cur && cur.id === "tab-books") renderBooks();
  else if (cur && cur.id === "tab-book-search") bookResultsDraw();
  else if (cur && cur.id === "tab-mat-subject") renderMatSubject();
}

// ---- Tárgyhoz rendelés ----
// Választó: a félév tárgyai (felvett tárgyak, órarend, anyagok), félévváltóval, kereséssel és saját névvel.
// A könyv a tárgy NEVÉHEZ kötődik (nem félévhez), így a tárgy Anyagok oldalán minden félévben látszik.
function bookPickSubject(title, onPick) {
  const cur = currentSemesterKey(), sems = matSemesters();
  const open = (sem) => openList({ title, searchable: true, allowCustom: true,
    items: matSubjects(sem).map((s) => ({ value: s.name, label: s.name, sub: s.code || "" })),
    chips: sems.map((k) => ({ key: k, label: fmtTerm(k) + (k === cur ? " · aktuális" : "") })), chipCurrent: sem, onChip: (k) => open(k),
    onPick: (v) => { if (v && String(v).trim()) onPick(String(v).trim()); } });
  open(cur);
}
function bookAddSubject(list, name) {
  const key = matSubjKey(name); if (!key) return;
  list.forEach((b) => { b.subjects = b.subjects || []; if (!b.subjects.some((s) => s.key === key)) b.subjects.push({ key, name }); });
  saveState(); bookRefresh();
  toast((list.length === 1 ? "Hozzárendelve: " : list.length + " könyv hozzárendelve: ") + name);
}
// Felvétel után: egy lépésben a tárgyválasztó (bezárással kihagyható).
function bookOfferSubject(list) {
  if (!list.length) return;
  bookPickSubject(list.length === 1 ? "Melyik tárgyhoz tartozik?" : "Melyik tárgyhoz tartoznak?", (name) => bookAddSubject(list, name));
}

// ---- Könyvek képernyő ----
let bookFilter = ""; // tárgy kulcsa, "" = minden könyv
function renderBooks() {
  const host = $("books-scroll"); if (!host) return;
  mvClose(); // a megnyitott PDF memóriáját elengedjük
  $("book-import").onclick = () => { const f = $("book-file"); f.value = ""; f.click(); };
  $("book-search").onclick = () => pushScreen("tab-book-search");
  const all = books().slice().sort((a, b) => bookSeen(b) - bookSeen(a));
  if (!all.length) {
    host.innerHTML = `<div class="dash-empty" style="padding:22px 2px 18px">Még nincs könyved. Vegyél fel egy PDF-et a jobb felső gombbal, vagy keress ingyenes egyetemi jegyzetet és tankönyvet.</div>`
      + `<div class="card">`
      + `<button class="row" type="button" id="bk-e-search"><span class="row-ic">${icon("search")}</span><span class="row-main"><span class="row-title">Ingyenes könyvek keresése</span><span class="row-sub">Egyetemi jegyzetek, tankönyvek, a MEK könyvei</span></span><span class="row-chev">${icon("chev")}</span></button>`
      + `<button class="row" type="button" id="bk-e-import"><span class="row-ic">${icon("download")}</span><span class="row-main"><span class="row-title">PDF felvétele a telefonról</span><span class="row-sub">Például az oktató jegyzete vagy egy letöltött tankönyv</span></span><span class="row-chev">${icon("chev")}</span></button>`
      + `</div>` + bookFootHint();
    $("bk-e-search").onclick = () => pushScreen("tab-book-search");
    $("bk-e-import").onclick = $("book-import").onclick;
    return;
  }
  const subs = new Map(); all.forEach((b) => (b.subjects || []).forEach((s) => { if (!subs.has(s.key)) subs.set(s.key, s.name); }));
  if (bookFilter && !subs.has(bookFilter)) bookFilter = "";
  const list = bookFilter ? all.filter((b) => (b.subjects || []).some((s) => s.key === bookFilter)) : all;
  let h = "";
  const recent = !bookFilter && all.find((b) => b.last && (b.last.i || b.last.f));
  if (recent) {
    const p = bookProgress(recent);
    h += `<div class="dash-label" style="margin-top:4px">Folytatás</div>`
      + `<button class="bk-hero" type="button" data-id="${esc(recent.id)}">${bookCover(recent, "bk-hero-cover")}<span class="bk-hero-main">`
      + `<span class="bk-hero-t">${esc(recent.title)}</span>${recent.author ? `<span class="bk-hero-a">${esc(recent.author)}</span>` : ""}`
      + `<span class="bk-hero-p">${esc(bookReadText(recent))} · ${p.pct}%</span><span class="bk-prog" aria-hidden="true"><i style="width:${Math.max(2, p.pct)}%"></i></span></span></button>`;
  }
  if (subs.size) h += `<div class="controls dd-row"><button class="period-btn dd" id="book-filter" type="button"><span>${esc(bookFilter ? subs.get(bookFilter) : "Minden könyv")}</span>${icon("down")}</button></div>`;
  h += `<div class="dash-label">${bookFilter ? "Ehhez a tárgyhoz" : "Könyveim"} · ${list.length}</div><div class="card">` + list.map((b) => bookRow(b, true)).join("") + `</div>` + bookFootHint();
  host.innerHTML = h;
  const hero = host.querySelector(".bk-hero"); if (hero) hero.onclick = () => openMaterial(hero.dataset.id);
  host.querySelectorAll(".bk-row").forEach((r) => r.onclick = (ev) => { if (!ev.target.closest(".bk-more")) openMaterial(r.dataset.id); });
  host.querySelectorAll(".bk-more").forEach((b) => b.onclick = () => bookMenu(b.dataset.id));
  const fb = $("book-filter");
  if (fb) fb.onclick = async () => {
    const v = await askPick({ title: "Tárgy", options: [{ label: "Minden könyv", sub: all.length + " könyv", value: "*" }]
      .concat([...subs].sort((a, b) => a[1].localeCompare(b[1], "hu")).map(([k, name]) => ({ label: name, sub: all.filter((b) => (b.subjects || []).some((s) => s.key === k)).length + " könyv", value: k }))) });
    if (v) { bookFilter = v === "*" ? "" : v; renderBooks(); }
  };
}
function bookFootHint() { return `<div class="hint" style="margin:10px 2px">A könyvek ezen a telefonon vannak. Az Anyagok oldalon lévő mentés (.zip) a könyveket és a jegyzeteidet is elmenti.</div>`; }
async function bookMenu(id) {
  const b = bookById(id); if (!b) return;
  const subj = (b.subjects || []).map((s) => s.name).join(", ");
  const opts = [
    { icon: "books", label: "Olvasás", sub: bookReadText(b), value: "open" },
    { icon: "book", label: "Tárgyhoz rendelés", sub: subj ? "Most: " + subj : "Még nincs tárgyhoz rendelve", value: "assign" }];
  if (subj) opts.push({ icon: "x", label: "Leválasztás tárgyról", sub: subj, value: "unassign" });
  opts.push({ icon: "pencil", label: "Átnevezés", value: "rename" });
  if (b.src && b.src.page) opts.push({ icon: "ext", label: "Forrás megnyitása", sub: bookHostName(b.src.page), value: "src" });
  opts.push({ icon: "download", label: "Letöltés a telefonra", sub: "A Letöltések mappába, a jegyzeteiddel együtt", value: "dl" });
  opts.push({ icon: "send", label: "Megosztás jegyzetekkel", sub: "PDF-ként, a rajzokkal és szövegekkel együtt", value: "share" });
  opts.push({ icon: "trash", label: "Törlés", danger: true, value: "del" });
  const a = await askPick({ title: b.title, body: `<div class="hint">${esc([b.author, b.pages + " oldal", b.size ? matFmtSize(b.size) : ""].filter(Boolean).join(" · "))}</div>`, options: opts });
  if (a === "open") openMaterial(b.id);
  else if (a === "assign") bookPickSubject("Tárgyhoz rendelés", (name) => bookAddSubject([b], name));
  else if (a === "unassign") {
    let key = b.subjects[0].key;
    if (b.subjects.length > 1) key = await askPick({ title: "Melyik tárgyról?", options: b.subjects.map((s) => ({ label: s.name, value: s.key })) });
    if (!key) return;
    b.subjects = b.subjects.filter((s) => s.key !== key); saveState(); renderBooks();
  } else if (a === "rename") {
    const t = await askText({ title: "Átnevezés", value: b.title });
    if (t != null && t.trim()) { b.title = t.trim(); saveState(); renderBooks(); }
  } else if (a === "src") openWeb(b.src.page);
  else if (a === "share") matSharePdf(b.id);
  else if (a === "dl") matDownloadPdfs([b.id]);
  else if (a === "del") {
    const ok = await ask({ title: "Könyv törlése", okText: "Törlés", cancelText: "Mégse", danger: true,
      body: `Biztosan törlöd erről a telefonról? A benne lévő jegyzeteid és kiemeléseid is elvesznek.<br><b>${esc(b.title)}</b>` });
    if (!ok) return;
    try { await matDeleteData(b.id); } catch (e) {}
    state.books = books().filter((x) => x.id !== b.id); saveState(); renderBooks();
  }
}

// ---- Könyvkereső: saját könyvek + ingyenes, legálisan letölthető források ----
// Mind nyilvános, belépés nélkül letölthető anyag; a letöltés a forrásból közvetlenül a telefonra megy.
//  DTK, Digitális Tankönyvtár (dtk.tankonyvtar.hu, Oktatási Hivatal): magyar felsőoktatási tankönyvek, jegyzetek.
//    DSpace: a /discover Solr-keresője mezőnként is keres (dc.title, dc.creator, dc.publisher, dc.language,
//    dc.format:pdf); az adatokat és a PDF-et a REST-ből olvassuk (/rest/handle/…). Böngésző-UA nélkül 403.
//  OpenAlex (api.openalex.org): nyílt katalógus, csak nyílt hozzáférésű könyv közvetlen PDF-linkkel
//    (MTA REAL, Corvinus, ELTE EDIT, nemzetközi kiadók). Kulcs nélküli, nyilvános API.
//  MEK (mek.oszk.hu): nincs API, a nyilvános keresőt olvassuk (cím, szerző, tárgyszó); a PDF a könyv oldaláról.
//  OpenStax (openstax.org): angol nyelvű egyetemi tankönyvek (CC BY); a lista egyszer töltődik le, helyben szűrünk.
//  MeRSZ: fizetős, csak a saját oldalán olvasható, ezért csak megnyitjuk.
const DTK = "https://dtk.tankonyvtar.hu";
const BOOK_HOSTS = { "real.mtak.hu": "MTA REAL", "real-eod.mtak.hu": "MTA REAL", "real-d.mtak.hu": "MTA REAL", "unipub.lib.uni-corvinus.hu": "Corvinus",
  "edit.elte.hu": "ELTE EDIT", "mek.oszk.hu": "MEK", "dtk.tankonyvtar.hu": "DTK", "assets.openstax.org": "OpenStax", "openstax.org": "OpenStax",
  "library.oapen.org": "OAPEN", "directory.doabooks.org": "DOAB" };
function bookHostName(url) { let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {} return BOOK_HOSTS[h] || h; }
// Natívan CapacitorHttp (nincs CORS). Böngészőként jelentkezünk: több könyvtár a "gépi" kéréseket elutasítja.
function bookHeaders(accept) { return { Accept: accept, "User-Agent": navigator.userAgent }; }
async function bookGetJson(url) {
  const CH = CHTTP();
  if (isNative && CH) {
    const r = await CH.get({ url, headers: bookHeaders("application/json") });
    if (!r || r.status < 200 || r.status >= 300) throw new Error("HTTP " + (r && r.status));
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(url, { headers: { Accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function bookGetText(url) {
  const CH = CHTTP();
  if (isNative && CH) {
    const r = await CH.get({ url, headers: bookHeaders("text/html,*/*") });
    if (!r || r.status < 200 || r.status >= 300) throw new Error("HTTP " + (r && r.status));
    return typeof r.data === "string" ? r.data : "";
  }
  const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return r.text();
}
// Egyszerre legfeljebb n kérés (a DTK-nál találatonként egy REST-kérés megy).
async function bookPool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}
function bookHas(hay, needle) { const h = searchNorm(hay); return searchNorm(needle).split(/\s+/).filter(Boolean).every((w) => h.includes(w)); }
function bookYearOk(r, Q) { return (!Q.y1 || (r.year && r.year >= Q.y1)) && (!Q.y2 || (r.year && r.year <= Q.y2)); }
function bookSolrWords(s) { return String(s || "").replace(/[+\-&|!(){}[\]^"~*?:\\/,;.]/g, " ").split(/\s+/).filter(Boolean); }

async function bookSearchDtk(Q) {
  const parts = [];
  const grp = (field, s) => { const w = bookSolrWords(s); if (w.length) parts.push((field ? field + ":" : "") + "(" + w.join(" AND ") + ")"); };
  grp("", Q.q); grp("dc.title", Q.title); grp("dc.creator", Q.author); grp("dc.publisher", Q.publisher);
  if (!parts.length) return { skip: "nincs mire keresni" };
  if (Q.lang) parts.push("dc.language:" + Q.lang);
  parts.push("dc.format:pdf");
  const html = await bookGetText(DTK + "/discover?rpp=40&query=" + encodeURIComponent(parts.join(" AND ")));
  const d = new DOMParser().parseFromString(html, "text/html");
  const handles = [...new Set([...d.querySelectorAll(".ds-artifact-item a[href*='/handle/']")].map((a) => (/\/handle\/(\d+\/\d+)/.exec(a.getAttribute("href")) || [])[1]).filter(Boolean))].slice(0, 30);
  const items = await bookPool(handles, 8, (h) => bookGetJson(DTK + "/rest/handle/" + h + "?expand=metadata,bitstreams").catch(() => null));
  const out = [];
  for (const it of items) {
    if (!it || it.type !== "item") continue;
    const md = (k) => (it.metadata || []).filter((m) => m.key === k).map((m) => String(m.value || "").trim()).filter(Boolean);
    const pdf = (it.bitstreams || []).find((b) => b.bundleName === "ORIGINAL" && /pdf/i.test((b.mimeType || "") + " " + (b.name || "")));
    if (!pdf) continue; // csomagolt e-learning (zip) vagy más formátum: nem PDF
    const au = [...new Set(md("dc.creator").concat(md("dc.contributor.author")).map((n) => n.replace(/^([^,]+),\s*(.+)$/, "$1 $2")))]; // "Kovács, Péter" → "Kovács Péter"
    out.push({ from: "dtk", title: md("dc.title")[0] || it.name || "", author: au.slice(0, 3).join(", ") + (au.length > 3 ? " és mtsai" : ""),
      publisher: md("dc.publisher")[0] || "", year: parseInt((md("dc.date.issued")[0] || md("dc.date")[0] || "").slice(0, 4), 10) || "", lang: md("dc.language")[0] || "",
      pdf: DTK + pdf.retrieveLink, page: DTK + "/handle/" + it.handle, size: pdf.sizeBytes || 0, license: "", host: "DTK", kind: md("dc.type")[0] || "" });
  }
  return { list: out.filter((r) => bookYearOk(r, Q)) };
}
function bookAuthors(list) {
  const n = (list || []).map((a) => a && a.author && a.author.display_name).filter(Boolean);
  return n.slice(0, 3).join(", ") + (n.length > 3 ? " és mtsai" : "");
}
async function bookSearchOpenAlex(Q) {
  if (!Q.q && !Q.title && !Q.author) return { skip: "csak kiadóra nem tud keresni" };
  const clean = (s) => s.replace(/[,|:]/g, " ").replace(/\s+/g, " ").trim(), f = ["type:book", "is_oa:true"];
  if (Q.title) f.push("title.search:" + clean(Q.title));
  if (Q.author) f.push("raw_author_name.search:" + clean(Q.author));
  if (Q.lang) f.push("language:" + Q.lang);
  if (Q.y1 || Q.y2) f.push("publication_year:" + (Q.y1 && Q.y2 ? Q.y1 + "-" + Q.y2 : Q.y1 ? ">" + (Q.y1 - 1) : "<" + (Q.y2 + 1)));
  const j = await bookGetJson("https://api.openalex.org/works?" + (Q.q ? "search=" + encodeURIComponent(Q.q) + "&" : "") + "filter=" + encodeURIComponent(f.join(","))
    + "&per-page=40&select=display_name,publication_year,language,authorships,best_oa_location,open_access,primary_location");
  const list = (j.results || []).map((w) => {
    const loc = w.best_oa_location || {}, oa = (w.open_access && w.open_access.oa_url) || "", src = (w.primary_location && w.primary_location.source) || {};
    const pdf = loc.pdf_url || (/\.pdf($|\?)/i.test(oa) ? oa : "");
    if (!pdf || !w.display_name) return null;
    return { from: "openalex", title: w.display_name, author: bookAuthors(w.authorships), publisher: "", where: [src.display_name, src.host_organization_name].filter(Boolean).join(" "),
      year: w.publication_year || "", lang: w.language || "", pdf, page: loc.landing_page_url || pdf, license: loc.license || "", host: bookHostName(pdf) };
  }).filter(Boolean);
  // Kiadó: az OpenAlex a könyveknél ritkán tudja; a tárhely és a forrás nevében keressük.
  return { list: Q.publisher ? list.filter((r) => bookHas(r.where + " " + r.host, Q.publisher)) : list };
}
async function bookSearchMek(Q) {
  if (Q.publisher) return { skip: "kiadóra nem lehet benne keresni" };
  if (Q.lang && Q.lang !== "hu") return { skip: "csak magyar könyvek vannak benne" };
  if (Q.y1 || Q.y2) return { skip: "évre nem lehet benne szűrni" };
  const url = (o) => "https://mek.oszk.hu/hu/search/elfull/?size=20" + Object.keys(o).filter((k) => o[k]).map((k) => "&" + k + "=" + encodeURIComponent(o[k])).join("");
  const urls = Q.q ? [url({ dc_title: [Q.q, Q.title].filter(Boolean).join(" "), dc_creator: Q.author }), url({ dc_subject: Q.q, dc_title: Q.title, dc_creator: Q.author })]
    : [url({ dc_title: Q.title, dc_creator: Q.author })];
  const pages = await Promise.all(urls.map((u) => bookGetText(u).catch(() => null)));
  if (pages.every((p) => p == null)) throw new Error("A MEK nem elérhető.");
  const seen = new Set(), out = [];
  for (const html of pages) {
    if (!html) continue;
    const d = new DOMParser().parseFromString(html, "text/html");
    for (const a of d.querySelectorAll("a.itemlink")) {
      const href = (a.getAttribute("href") || "").replace(/^http:/, "https:");
      const t = ((a.querySelector(".dctitle") || {}).textContent || "").trim(), au = ((a.querySelector(".dcauthor") || {}).textContent || "").trim();
      if (!/^https:\/\/mek\.oszk\.hu\/\d+\/\d+/.test(href) || !t) continue;
      const page = href.replace(/\/?$/, "/"); if (seen.has(page)) continue; seen.add(page);
      out.push({ from: "mek", title: t, author: au, publisher: "", year: "", lang: "hu", pdf: "", page, license: "", host: "MEK" });
    }
  }
  return { list: out };
}
let bookStaxP = null;
async function bookSearchOpenStax(Q) {
  if (Q.lang && Q.lang !== "en") return { skip: "csak angol nyelvű tankönyvek" };
  if (!bookStaxP) bookStaxP = bookGetJson("https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=title,high_resolution_pdf_url,book_state,authors,publish_date&limit=250")
    .catch((e) => { bookStaxP = null; throw e; });
  const j = await bookStaxP;
  const list = (j.items || []).filter((b) => b.book_state === "live" && b.high_resolution_pdf_url).map((b) => {
    const au = (b.authors || []).map((a) => a.value || {}), top = au.filter((a) => a.senior_author);
    return { from: "openstax", title: b.title, author: (top.length ? top : au).slice(0, 3).map((a) => a.name).join(", "), publisher: "OpenStax, Rice University",
      year: parseInt(String(b.publish_date || "").slice(0, 4), 10) || "", lang: "en", pdf: b.high_resolution_pdf_url,
      page: (b.meta && b.meta.html_url) || "https://openstax.org/subjects", license: "cc-by", host: "OpenStax" };
  });
  return { list: list.filter((r) => (!Q.q || bookHas(r.title + " " + r.author, Q.q)) && (!Q.title || bookHas(r.title, Q.title))
    && (!Q.author || bookHas(r.author, Q.author)) && (!Q.publisher || bookHas(r.publisher, Q.publisher)) && bookYearOk(r, Q)) };
}
// Sorrend = fontosság ("Relevancia" rendezésnél): a magyar egyetemi tankönyvek elöl.
const BKS_SRC = [
  { id: "dtk", label: "Digitális Tankönyvtár", short: "DTK", sub: "Magyar egyetemi tankönyvek és jegyzetek", fn: bookSearchDtk },
  { id: "openalex", label: "OpenAlex", short: "OpenAlex", sub: "Nyílt könyvek egyetemi és tudományos tárhelyekről", fn: bookSearchOpenAlex },
  { id: "mek", label: "Magyar Elektronikus Könyvtár", short: "MEK", sub: "Magyar e-könyvek, személyes használatra", fn: bookSearchMek },
  { id: "openstax", label: "OpenStax", short: "OpenStax", sub: "Angol nyelvű egyetemi tankönyvek", fn: bookSearchOpenStax },
];
const BKS_LANGS = [["", "Mind"], ["hu", "Magyar"], ["en", "Angol"], ["de", "Német"]];
const BKS_SORTS = [["rel", "Relevancia"], ["new", "Legújabb elöl"], ["title", "Cím szerint"]];
const bks = { token: 0, Q: null, per: null, loading: false, lang: "", src: new Set(BKS_SRC.map((s) => s.id)), sort: "rel", adv: false };
function bookQuery() {
  const v = (id) => ($(id) ? $(id).value.trim() : ""), yr = (s) => { const n = parseInt(s, 10); return n >= 1000 && n <= 2100 ? n : null; };
  return { q: v("bks-q"), title: v("bks-title"), author: v("bks-author"), publisher: v("bks-pub"), y1: yr(v("bks-y1")), y2: yr(v("bks-y2")), lang: bks.lang, src: new Set(bks.src) };
}
function bookAdvCount() { const Q = bookQuery(); return [Q.title, Q.author, Q.publisher, Q.y1 || Q.y2, Q.lang].filter(Boolean).length + (bks.src.size < BKS_SRC.length ? 1 : 0); }
// Az összes forrás találatai egy listában: forrásonként beérkezve, ismétlés nélkül (ugyanaz a könyv több helyen is lehet).
function bookMerged() {
  const seen = new Set(), all = [];
  BKS_SRC.forEach((s) => { const r = bks.per && bks.per[s.id]; (r && r.list || []).forEach((x) => {
    const k = searchNorm(x.title).replace(/[^a-z0-9]+/g, "") + "|" + searchNorm(x.author).split(/[\s,]+/)[0];
    if (!seen.has(k)) { seen.add(k); all.push(x); }
  }); });
  if (bks.sort === "new") all.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (bks.sort === "title") all.sort((a, b) => a.title.localeCompare(b.title, "hu"));
  return all;
}
async function bookSearchRun() {
  const Q = bookQuery();
  if (!Q.q && !Q.title && !Q.author && !Q.publisher) { toast("Írj be egy keresőszót, címet, szerzőt vagy kiadót."); return; }
  if (!Q.src.size) { toast("Válassz ki legalább egy forrást."); return; }
  try { document.activeElement && document.activeElement.blur(); } catch (e) {}
  bookSetAdv(false); // a szűrők megmaradnak (a felirat mutatja, hány), a találatok feljebb kerülnek
  const tok = ++bks.token;
  Object.assign(bks, { Q, per: {}, loading: true });
  bookResultsDraw();
  const box = $("bks-results"), sc = $("bks-scroll");
  if (box && sc) sc.scrollTo({ top: Math.max(0, box.offsetTop - 8), behavior: "smooth" });
  await Promise.all(BKS_SRC.filter((s) => Q.src.has(s.id)).map(async (s) => {
    let r; try { r = await s.fn(Q); } catch (e) { r = { err: true }; }
    if (tok !== bks.token) return;
    bks.per[s.id] = r; bookResultsDraw(); // forrásonként megjelenik, nem kell a leglassabbra várni
  }));
  if (tok !== bks.token) return;
  bks.loading = false; bookResultsDraw();
}
function bookHave(r) { return books().find((b) => b.src && ((r.pdf && b.src.pdf === r.pdf) || (r.page && b.src.page === r.page))) || null; }
function renderBookSearch() {
  const host = $("bks-scroll"); if (!host) return;
  if (!$("bks-form")) {
    const inp = (id, label, ph, extra) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" placeholder="${ph}" autocomplete="off" autocorrect="off" spellcheck="false"${extra || ""}></div>`;
    host.innerHTML = `<form id="bks-form" class="bks-form" autocomplete="off" novalidate>`
      + `<input class="input" id="bks-q" type="search" enterkeyhint="search" placeholder="Cím, szerző vagy téma" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Keresés">`
      + `<button type="button" class="bks-adv-t" id="bks-adv-t" aria-expanded="false" aria-controls="bks-adv"><span id="bks-adv-l">Részletes keresés</span>${icon("down")}</button>`
      + `<div class="bks-adv" id="bks-adv" hidden>`
      + inp("bks-title", "Cím", "Például: A mikroökonómia alapjai") + inp("bks-author", "Szerző", "Például: Kerekes Sándor") + inp("bks-pub", "Kiadó", "Például: Szegedi Tudományegyetem")
      + `<div class="field"><label for="bks-y1">Megjelenés éve</label><div class="bks-yr">`
      + `<input class="input" id="bks-y1" inputmode="numeric" maxlength="4" placeholder="Ettől, pl. 2010" autocomplete="off" aria-label="Megjelenés éve ettől">`
      + `<input class="input" id="bks-y2" inputmode="numeric" maxlength="4" placeholder="Eddig" autocomplete="off" aria-label="Megjelenés éve eddig"></div></div>`
      + `<div class="field"><label>Nyelv</label><div class="seg" id="bks-lang">` + BKS_LANGS.map(([k, l]) => `<button type="button" class="seg-btn${bks.lang === k ? " active" : ""}" data-lang="${k}">${l}</button>`).join("") + `</div></div>`
      + `<div class="field"><label>Források</label><div class="bks-src">` + BKS_SRC.map((s) => `<button type="button" class="check${bks.src.has(s.id) ? " on" : ""}" data-src="${s.id}" aria-pressed="${bks.src.has(s.id)}">`
        + `<span class="box">${icon("check")}</span><span><span class="c-t">${s.label}</span><span class="c-b">${s.sub}</span></span></button>`).join("") + `</div></div>`
      + `<button type="button" class="btn ghost narrow" id="bks-clear">Szűrők törlése</button>`
      + `</div>`
      + `<button type="submit" class="btn primary lg bks-go" id="bks-go">${icon("search")}Keresés</button></form>`
      + `<div id="bks-results"></div>`;
    $("bks-adv-t").onclick = () => bookSetAdv(!bks.adv);
    $("bks-form").addEventListener("submit", (e) => { e.preventDefault(); bookSearchRun(); });
    $("bks-form").addEventListener("input", () => bookAdvLabel());
    host.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { bks.lang = b.dataset.lang; host.querySelectorAll("[data-lang]").forEach((x) => x.classList.toggle("active", x === b)); bookAdvLabel(); });
    host.querySelectorAll("[data-src]").forEach((b) => b.onclick = () => {
      const on = !bks.src.has(b.dataset.src); if (on) bks.src.add(b.dataset.src); else bks.src.delete(b.dataset.src);
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); bookAdvLabel();
    });
    $("bks-clear").onclick = () => {
      ["bks-title", "bks-author", "bks-pub", "bks-y1", "bks-y2"].forEach((id) => { $(id).value = ""; });
      bks.lang = ""; bks.src = new Set(BKS_SRC.map((s) => s.id));
      host.querySelectorAll("[data-lang]").forEach((x) => x.classList.toggle("active", !x.dataset.lang));
      host.querySelectorAll("[data-src]").forEach((x) => { x.classList.add("on"); x.setAttribute("aria-pressed", "true"); });
      bookAdvLabel();
    };
    bookAdvLabel();
  }
  bookResultsDraw();
  if (!bks.Q) setTimeout(() => { try { $("bks-q").focus(); } catch (e) {} }, 300);
}
function bookSetAdv(open) {
  const p = $("bks-adv"), t = $("bks-adv-t"); if (!p || !t) return;
  bks.adv = open; p.hidden = !open; t.setAttribute("aria-expanded", String(open)); t.classList.toggle("open", open); bookAdvLabel();
}
function bookAdvLabel() { const n = bookAdvCount(), l = $("bks-adv-l"); if (l) l.textContent = "Részletes keresés" + (n ? " · " + n + " szűrő" : ""); }
function bookResultsDraw() {
  const box = $("bks-results"); if (!box) return;
  const Q = bks.Q, hint = (t) => `<div class="hint" style="margin:0 2px 6px">${t}</div>`;
  let h = "";
  if (!Q) h += hint("Keress cím, szerző vagy téma szerint, vagy nyisd le a részletes keresést (kiadó, év, nyelv, források). "
    + "Ingyenes, legálisan letölthető könyveket mutatok: magyar egyetemi tankönyveket és jegyzeteket (Digitális Tankönyvtár), nyílt tudományos könyveket (OpenAlex), a MEK könyveit és angol egyetemi tankönyveket (OpenStax).");
  else {
    const mine = books().filter((b) => { const all = [b.title, b.author, (b.subjects || []).map((s) => s.name).join(" ")].join(" ");
      return (!Q.q || bookHas(all, Q.q)) && (!Q.title || bookHas(b.title, Q.title)) && (!Q.author || bookHas(b.author, Q.author)) && !Q.publisher; });
    if (mine.length) h += `<div class="dash-label" style="margin-top:6px">Könyveim</div><div class="card">` + mine.map((b) => bookRow(b, false)).join("") + `</div>`;
    const list = bookMerged(), srcs = BKS_SRC.filter((s) => Q.src.has(s.id)), done = srcs.filter((s) => bks.per[s.id]).length;
    h += `<div class="bks-head"><div class="dash-label">Ingyenes könyvek${list.length ? " · " + list.length : ""}</div>`
      + (list.length > 1 ? `<button class="period-btn dd" id="bks-sort" type="button"><span>${BKS_SORTS.find((s) => s[0] === bks.sort)[1]}</span>${icon("down")}</button>` : "") + `</div>`;
    // Forrásonként: hány találat, vagy miért nem keresett benne.
    h += `<div class="bks-sum">` + srcs.map((s) => { const r = bks.per[s.id];
      return `<span>${esc(s.short)} ${!r ? "keresés…" : r.err ? "nem elérhető" : r.skip ? "(" + esc(r.skip) + ")" : r.list.length}</span>`; }).join(" · ") + `</div>`;
    if (!list.length) h += hint(bks.loading ? "Keresés a könyvtárakban… (" + done + " / " + srcs.length + " kész)"
      : "Nincs ingyenes, letölthető találat. Próbálj kevesebb vagy más szót, vagy nézd meg a MeRSZ-en.");
    else h += `<div class="card">` + list.map((r, i) => {
      const have = bookHave(r), meta = [r.publisher, r.year, r.lang && r.lang !== "hu" ? r.lang.toUpperCase() : "", r.host].filter(Boolean).join(" · ");
      return `<button class="row bks-hit" type="button" data-ix="${i}"><span class="row-ic">${icon(have ? "books" : "download")}</span>`
        + `<span class="row-main"><span class="row-title">${esc(r.title)}</span>${r.author ? `<span class="row-sub">${esc(r.author)}</span>` : ""}<span class="row-sub bks-meta">${esc(meta)}</span></span>`
        + (have ? `<span class="more-v">Megvan</span>` : "") + `</button>`;
    }).join("") + `</div>`;
    if (list.length && bks.loading) h += hint("Még keresek: " + done + " / " + srcs.length + " forrás kész.");
    bks.shown = list;
  }
  h += `<div class="dash-label">Más források</div><div class="card">`
    + `<button class="row" type="button" id="bks-mersz"><span class="row-ic">${icon("ext")}</span><span class="row-main"><span class="row-title">Keresés a MeRSZ-en</span><span class="row-sub">Az Akadémiai Kiadó könyvei, egyetemi hozzáféréssel, a böngészőben olvashatók</span></span><span class="row-chev">${icon("chev")}</span></button>`
    + `<button class="row" type="button" id="bks-link"><span class="row-ic">${icon("clip")}</span><span class="row-main"><span class="row-title">PDF hozzáadása linkről</span><span class="row-sub">Például egy jegyzet oldaláról, ha nem kell hozzá belépés</span></span><span class="row-chev">${icon("chev")}</span></button>`
    + `</div><div class="hint" style="margin:10px 2px 16px">A könyv a forrásból közvetlenül a telefonodra töltődik, a Kredit+ nem tárol és nem továbbít könyveket. Csak olyat tölts le, amihez jogod van.</div>`;
  box.innerHTML = h;
  box.querySelectorAll(".bk-row").forEach((r) => r.onclick = () => openMaterial(r.dataset.id));
  box.querySelectorAll(".bks-hit").forEach((r) => r.onclick = () => { const x = bks.shown && bks.shown[+r.dataset.ix]; if (x) bookResultMenu(x); });
  const so = $("bks-sort");
  if (so) so.onclick = async () => { const v = await askPick({ title: "Rendezés", options: BKS_SORTS.map(([k, l]) => ({ label: l, sub: k === bks.sort ? "Jelenlegi" : "", value: k })) }); if (v) { bks.sort = v; bookResultsDraw(); } };
  $("bks-mersz").onclick = () => bookOpenMersz(Q ? [Q.q, Q.title, Q.author].filter(Boolean).join(" ") : "");
  $("bks-link").onclick = () => bookFromLink();
}
async function bookResultMenu(r) {
  const have = bookHave(r);
  const lic = r.from === "mek" ? "Magyar Elektronikus Könyvtár, személyes használatra szabadon letölthető"
    : r.from === "dtk" ? "Digitális Tankönyvtár (Oktatási Hivatal), nyilvánosan letölthető tananyag"
    : "Nyílt hozzáférés" + (r.license ? " · " + r.license.toUpperCase().replace(/-/g, " ") : "");
  const lines = [r.author, [r.publisher, r.year].filter(Boolean).join(", "), [r.host, r.size ? matFmtSize(r.size) : ""].filter(Boolean).join(" · "), lic].filter(Boolean);
  const a = await askPick({ title: r.title, body: `<div class="hint">${lines.map(esc).join("<br>")}</div>`, options: [
    have ? { icon: "books", label: "Megnyitás", sub: "Már a könyveid között van", value: "open" }
      : { icon: "download", label: "Letöltés a könyveim közé", sub: "A PDF a forrásból közvetlenül a telefonodra kerül", value: "dl" },
    { icon: "ext", label: "Megnyitás a forrás oldalán", sub: r.host, value: "web" }] });
  if (a === "open") openMaterial(have.id);
  else if (a === "dl") bookDownload(r);
  else if (a === "web") openWeb(r.page || r.pdf);
}
async function bookOpenMersz(q) {
  if (q) { try { await navigator.clipboard.writeText(q); toast("A keresett szót kimásoltam, a MeRSZ keresőjébe beillesztheted."); } catch (e) {} }
  openWeb("https://mersz.hu/");
}
async function bookFromLink() {
  const t = await askText({ title: "PDF hozzáadása linkről", placeholder: "https://…/jegyzet.pdf", okText: "Letöltés",
    body: `<div class="hint">Egy PDF-re mutató link. Belépést igénylő oldalról (Moodle, Teams) töltsd le a fájlt, és a Könyvek oldalon a jobb felső gombbal vedd fel.</div>` });
  if (t == null) return;
  const url = t.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) { toast("Ez nem egy link."); return; }
  let name = ""; try { name = bookFileTitle(decodeURIComponent(new URL(url).pathname.split("/").pop() || "")); } catch (e) {}
  bookDownload({ from: "link", title: "", fileTitle: name, author: "", pdf: url, page: url, license: "", host: bookHostName(url) });
}

// ---- Letöltés a forrásból ----
// Natívan CapacitorHttp (nincs CORS), a választ base64-ben adja. Az Android nem követi a http→https átirányítást,
// és titkosítatlan http-t sem enged, ezért https-sel kérünk, és az átirányítást mi követjük.
function bookB64Bytes(b64) { const bin = atob(b64), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function bookHdr(r, name) { const h = (r && r.headers) || {}; const k = Object.keys(h).find((x) => x.toLowerCase() === name); return k ? h[k] : ""; }
async function bookFetchBytes(url) {
  let u = url.replace(/^http:\/\//i, "https://");
  const CH = CHTTP();
  if (isNative && CH) {
    for (let hop = 0; hop < 6; hop++) {
      const r = await CH.get({ url: u, responseType: "blob", headers: bookHeaders("application/pdf,*/*") });
      const st = r && r.status;
      if (st >= 300 && st < 400) { const loc = bookHdr(r, "location"); if (!loc) break; u = new URL(loc, u).href.replace(/^http:\/\//i, "https://"); continue; }
      if (!(st >= 200 && st < 300)) throw new Error("A forrás nem adta ki a fájlt (" + st + ").");
      if (typeof r.data !== "string" || !r.data) throw Object.assign(new Error("nem PDF"), { noPdf: true });
      return bookB64Bytes(r.data);
    }
    throw new Error("A link túl sokszor irányított tovább.");
  }
  const r = await fetch(u); if (!r.ok) throw new Error("A forrás nem adta ki a fájlt (" + r.status + ").");
  return new Uint8Array(await r.arrayBuffer());
}
function bookIsPdf(bytes) { return String.fromCharCode.apply(null, bytes.subarray(0, 1024)).indexOf("%PDF") >= 0; }
async function bookDownload(r) {
  const have = bookHave(r); if (have) { openMaterial(have.id); return; }
  showBusy("Letöltés: " + r.host + "…");
  let pdf = r.pdf;
  try {
    if (!pdf && r.from === "mek") { // a MEK-könyv oldaláról a PDF (/12300/12345/12345.pdf); nem minden könyvnek van
      const m = /href="([^"]*\/\d+\/\d+\/[^"\/]+\.pdf)"/i.exec(await bookGetText(r.page));
      if (!m) throw Object.assign(new Error("nincs PDF"), { noPdf: true });
      pdf = new URL(m[1], r.page).href;
    }
    const bytes = await bookFetchBytes(pdf);
    if (!bookIsPdf(bytes)) throw Object.assign(new Error("nem PDF"), { noPdf: true });
    $("busy-text").textContent = "PDF beolvasása…";
    const b = await bookImportBlob(new Blob([bytes], { type: "application/pdf" }),
      { title: r.title, author: r.author, fileTitle: r.fileTitle, src: { from: r.from, pdf, page: r.page, license: r.license || "" } });
    hideBusy();
    toast("Letöltve: " + b.title);
    bookRefresh();
    bookOfferSubject([b]);
  } catch (e) {
    hideBusy();
    const noPdf = e && e.noPdf;
    const go = await ask({ title: noPdf ? "Nincs letölthető PDF" : "Nem sikerült letölteni", okText: "Megnyitás a böngészőben", cancelText: "Bezárás",
      body: noPdf ? "Ennél a könyvnél a forrás nem ad PDF-et. Lehet, hogy csak más formátumban vagy csak a weboldalon olvasható."
        : esc(String(e && e.message || e)) + "<br><br>A forrás oldalán kézzel is megpróbálhatod letölteni." });
    if (go) openWeb(r.page || pdf);
  }
}

$("book-file").addEventListener("change", (e) => { const fs = [...(e.target.files || [])]; if (fs.length) bookImportFiles(fs); });
