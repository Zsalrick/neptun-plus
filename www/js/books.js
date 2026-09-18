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
  else if (cur && cur.id === "tab-book-search") bookSearchDraw();
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
  else if (a === "del") {
    const ok = await ask({ title: "Könyv törlése", okText: "Törlés", cancelText: "Mégse", danger: true,
      body: `Biztosan törlöd erről a telefonról? A benne lévő jegyzeteid és kiemeléseid is elvesznek.<br><b>${esc(b.title)}</b>` });
    if (!ok) return;
    try { await matDeleteData(b.id); } catch (e) {}
    state.books = books().filter((x) => x.id !== b.id); saveState(); renderBooks();
  }
}

// ---- Könyvkereső: saját könyvek + ingyenes, legálisan letölthető források ----
// OpenAlex (api.openalex.org): nyílt tudományos katalógus, csak nyílt hozzáférésű könyvek közvetlen PDF-linkkel
//   (pl. Corvinus, MTA REAL, egyetemi repozitóriumok). Kulcs nélküli, nyilvános API.
// MEK (mek.oszk.hu): a Magyar Elektronikus Könyvtár, személyes használatra szabadon letölthető. Nincs API:
//   a nyilvános címkereső HTML-jét olvassuk, a PDF-et a könyv oldaláról keressük ki letöltéskor.
// MeRSZ: fizetős (egyetemi előfizetés), csak a saját oldalán olvasható, ezért csak megnyitjuk.
const BOOK_HOSTS = { "real.mtak.hu": "MTA REAL", "unipub.lib.uni-corvinus.hu": "Corvinus", "mek.oszk.hu": "MEK", "library.oapen.org": "OAPEN", "directory.doabooks.org": "DOAB" };
function bookHostName(url) { let h = ""; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {} return BOOK_HOSTS[h] || h; }
const bks = { q: "", token: 0, res: null, err: "", loading: false, t: 0 };
async function bookGetJson(url) {
  const CH = CHTTP();
  if (isNative && CH) {
    const r = await CH.get({ url, headers: { Accept: "application/json" } });
    if (!r || r.status < 200 || r.status >= 300) throw new Error("HTTP " + (r && r.status));
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(url, { headers: { Accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function bookGetText(url) {
  const CH = CHTTP();
  if (isNative && CH) {
    const r = await CH.get({ url, headers: { Accept: "text/html,*/*" } });
    if (!r || r.status < 200 || r.status >= 300) throw new Error("HTTP " + (r && r.status));
    return typeof r.data === "string" ? r.data : "";
  }
  const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return r.text();
}
function bookAuthors(list) {
  const n = (list || []).map((a) => a && a.author && a.author.display_name).filter(Boolean);
  return n.slice(0, 2).join(", ") + (n.length > 2 ? " és mtsai" : "");
}
async function bookSearchOpenAlex(q) {
  const j = await bookGetJson("https://api.openalex.org/works?search=" + encodeURIComponent(q)
    + "&filter=type:book,is_oa:true&per-page=25&select=id,display_name,publication_year,language,authorships,best_oa_location,open_access");
  return (j.results || []).map((w) => {
    const loc = w.best_oa_location || {}, oa = (w.open_access && w.open_access.oa_url) || "";
    const pdf = loc.pdf_url || (/\.pdf($|\?)/i.test(oa) ? oa : "");
    if (!pdf || !w.display_name) return null;
    return { from: "openalex", title: w.display_name, author: bookAuthors(w.authorships), year: w.publication_year || "", lang: w.language || "",
      pdf, page: loc.landing_page_url || pdf, license: loc.license || "", host: bookHostName(pdf) };
  }).filter(Boolean);
}
async function bookSearchMek(q) {
  const html = await bookGetText("https://mek.oszk.hu/hu/search/elfull/?dc_title=" + encodeURIComponent(q) + "&size=20");
  const d = new DOMParser().parseFromString(html, "text/html");
  return [...d.querySelectorAll("a.itemlink")].slice(0, 20).map((a) => {
    const href = (a.getAttribute("href") || "").replace(/^http:/, "https:");
    const t = ((a.querySelector(".dctitle") || {}).textContent || "").trim(), au = ((a.querySelector(".dcauthor") || {}).textContent || "").trim();
    if (!/^https:\/\/mek\.oszk\.hu\/\d+\/\d+/.test(href) || !t) return null;
    return { from: "mek", title: t, author: au, year: "", lang: "hu", pdf: "", page: href.replace(/\/?$/, "/"), license: "", host: "MEK" };
  }).filter(Boolean);
}
async function bookSearchRun(q) {
  q = String(q || "").trim();
  const tok = ++bks.token; bks.q = q; bks.err = ""; bks.res = null;
  if (q.length < 3) { bks.res = null; bks.loading = false; bookSearchDraw(); return; }
  bks.loading = true; bookSearchDraw();
  const [oa, mek] = await Promise.allSettled([bookSearchOpenAlex(q), bookSearchMek(q)]);
  if (tok !== bks.token) return;
  bks.loading = false;
  const o = oa.status === "fulfilled" ? oa.value : [], m = mek.status === "fulfilled" ? mek.value : [];
  // Sorrend: magyar nyelvű nyílt könyvek, a MEK találatai, végül a többi nyelv.
  bks.res = o.filter((r) => r.lang === "hu").concat(m, o.filter((r) => r.lang !== "hu"));
  if (oa.status === "rejected" && mek.status === "rejected") bks.err = "Nem sikerült elérni a könyvtárakat. Nézd meg, van-e internet, és próbáld újra.";
  bookSearchDraw();
}
function bookHave(r) { return books().find((b) => b.src && ((r.pdf && b.src.pdf === r.pdf) || (r.page && b.src.page === r.page))) || null; }
function renderBookSearch() {
  const inp = $("bks-q");
  if (!inp.dataset.wired) {
    inp.dataset.wired = "1";
    inp.addEventListener("input", () => { clearTimeout(bks.t); bks.t = setTimeout(() => bookSearchRun(inp.value), 450); bookSearchDraw(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(bks.t); bookSearchRun(inp.value); try { inp.blur(); } catch (x) {} } });
  }
  bookSearchDraw();
  if (!inp.value) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 300);
}
function bookSearchDraw() {
  const host = $("bks-scroll"), inp = $("bks-q"); if (!host || !inp) return;
  const q = inp.value.trim(), nq = searchNorm(q), hint = (t) => `<div class="hint" style="margin:0 2px 6px">${t}</div>`;
  let h = "";
  if (q) {
    const mine = books().filter((b) => searchNorm([b.title, b.author, (b.subjects || []).map((s) => s.name).join(" ")].join(" ")).includes(nq));
    if (mine.length) h += `<div class="dash-label" style="margin-top:4px">Könyveim</div><div class="card">` + mine.map((b) => bookRow(b, false)).join("") + `</div>`;
    h += `<div class="dash-label"${mine.length ? "" : ` style="margin-top:4px"`}>Ingyenes könyvek</div>`;
    if (q.length < 3) h += hint("Írj be legalább 3 betűt az ingyenes könyvek kereséséhez.");
    else if (bks.loading || bks.q !== q || !bks.res) h += hint("Keresés az OpenAlexben és a Magyar Elektronikus Könyvtárban…");
    else if (bks.err) h += hint(esc(bks.err));
    else if (!bks.res.length) h += hint("Nincs ingyenes, letölthető találat. Próbáld rövidebb vagy más szóval, vagy nézd meg a MeRSZ-en.");
    else h += `<div class="card">` + bks.res.map((r, i) => {
      const have = bookHave(r), sub = [r.author, r.year, r.host].filter(Boolean).join(" · ");
      return `<button class="row bks-hit" type="button" data-ix="${i}"><span class="row-ic">${icon(have ? "books" : "download")}</span>`
        + `<span class="row-main"><span class="row-title">${esc(r.title)}</span><span class="row-sub">${esc(sub)}</span></span>${have ? `<span class="more-v">Megvan</span>` : ""}</button>`;
    }).join("") + `</div>`;
  } else h += hint("Keress cím, szerző vagy téma szerint. A saját könyveid mellett ingyenes, nyílt hozzáférésű könyveket is mutatok: egyetemi jegyzeteket, tankönyveket és tanulmányköteteket az OpenAlexből és a Magyar Elektronikus Könyvtárból.");
  h += `<div class="dash-label">Más források</div><div class="card">`
    + `<button class="row" type="button" id="bks-mersz"><span class="row-ic">${icon("ext")}</span><span class="row-main"><span class="row-title">Keresés a MeRSZ-en</span><span class="row-sub">Az Akadémiai Kiadó könyvei, egyetemi hozzáféréssel, a böngészőben olvashatók</span></span><span class="row-chev">${icon("chev")}</span></button>`
    + `<button class="row" type="button" id="bks-link"><span class="row-ic">${icon("clip")}</span><span class="row-main"><span class="row-title">PDF hozzáadása linkről</span><span class="row-sub">Például egy jegyzet oldaláról, ha nem kell hozzá belépés</span></span><span class="row-chev">${icon("chev")}</span></button>`
    + `</div>` + `<div class="hint" style="margin:10px 2px">A könyv a forrásból közvetlenül a telefonodra töltődik, a Kredit+ nem tárol és nem továbbít könyveket. Csak olyat tölts le, amihez jogod van.</div>`;
  host.innerHTML = h;
  host.querySelectorAll(".bk-row").forEach((r) => r.onclick = () => openMaterial(r.dataset.id));
  host.querySelectorAll(".bks-hit").forEach((r) => r.onclick = () => { const x = bks.res && bks.res[+r.dataset.ix]; if (x) bookResultMenu(x); });
  $("bks-mersz").onclick = () => bookOpenMersz(q);
  $("bks-link").onclick = () => bookFromLink();
}
async function bookResultMenu(r) {
  const have = bookHave(r);
  const lic = r.from === "mek" ? "Magyar Elektronikus Könyvtár, személyes használatra szabadon letölthető"
    : "Nyílt hozzáférés" + (r.license ? " · " + r.license.toUpperCase().replace(/-/g, " ") : "");
  const a = await askPick({ title: r.title, body: `<div class="hint">${esc([r.author, r.year].filter(Boolean).join(" · "))}${r.author || r.year ? "<br>" : ""}${esc(r.host)} · ${esc(lic)}</div>`, options: [
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
      const r = await CH.get({ url: u, responseType: "blob", headers: { Accept: "application/pdf,*/*" } });
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
