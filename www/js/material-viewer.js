// Anyag-megjelenítő: PDF oldalak + jegyzetréteg (toll, kiemelő, radír, szövegdobozok), oldalkezelés, megosztás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// A jegyzetek NORMALIZÁLT (0..1) koordinátákban tárolódnak az oldal szélességéhez/magasságához képest,
// így a nagyítás és a képernyőméret nem számít. A vastagság és a betűméret is az oldal szélességéhez viszonyított.
// Elem: { t:"ink", tool:"pen"|"hl", c, w, a, pts:[x,y,p, ...] }
//     | { t:"text", x, y, bw, s, c, text }   (bw = a szövegdoboz szélessége, ezen belül tör sort)
// (a régi, "a" nélküli vonásoknál: toll 1, kiemelő 0.38; a régi, "bw" nélküli szövegnél a lap széléig)
const MV_PALETTE = ["#1b1d22", "#ffffff", "#6b7079", "#2457c5", "#3aa0ff", "#1f9d6b", "#7fd48a", "#f2d33c", "#f08a24", "#c62f2f", "#f39ac4", "#8e44ad"];
const MV_REF = 360; // a csúszkák px-értékei ekkora szélességű oldalra vonatkoznak
const MV_DEFAULTS = { pen: { c: "#1b1d22", w: 2 / MV_REF, a: 1 }, hl: { c: "#f2d33c", w: 12 / MV_REF, a: 0.35 }, text: { c: "#1b1d22", s: 14 / MV_REF } };
// Gyorsválasztó az eszköztár fölött (egy koppintás szín vagy vastagság váltásához, mint a GoodNotes-ban).
// sizes: toll/kiemelő vastagsága px-ben, szövegnél betűméret px-ben (MV_REF szélességű oldalra).
const MV_QUICK = {
  pen: { colors: ["#1b1d22", "#2457c5", "#c62f2f", "#1f9d6b"], k: "w", sizes: [0.8, 2, 4] },
  hl: { colors: ["#f2d33c", "#7fd48a", "#f39ac4", "#3aa0ff"], k: "w", sizes: [8, 14, 24] },
  text: { colors: ["#1b1d22", "#2457c5", "#c62f2f", "#1f9d6b"], k: "s", sizes: [11, 14, 20] },
};
const MV_ZMIN = 1, MV_ZMAX = 4;
const MV_FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
let mv = null;

// Az eszközbeállítások (szín, vastagság, átlátszóság, betűméret) megmaradnak az app újraindítása után is.
// FONTOS: helyben tölti ki a hiányzó mezőket, nem cseréli le az objektumot, különben a beállító panel
// egy már lecserélt példányt módosítana, és a változás elveszne.
function mvPrefs() {
  const p = (state.inkPrefs = state.inkPrefs || {});
  for (const k of Object.keys(MV_DEFAULTS)) {
    p[k] = p[k] || {};
    for (const f of Object.keys(MV_DEFAULTS[k])) if (p[k][f] == null) p[k][f] = MV_DEFAULTS[k][f];
  }
  return p;
}

// opt.page: a PDF ennyiedik oldalán nyíljon (pl. a quiz "Megnézem" gombja), nem az utolsó olvasási helyen.
async function openMaterial(id, opt) {
  const m = matById(id); if (!m) { toast("Ez az anyag már nincs meg."); return; }
  mvClose();
  m.opened = Date.now(); saveState();
  mv = { id, m, doc: null, pdf: null, z: 1, mode: "read", search: null, tool: "pan", penSeen: false, undo: [], redo: [], slots: [], tcache: {}, io: null, saving: Promise.resolve(), draw: null, edit: null, sel: null, ctxColors: false, popOpen: false, jumpPage: opt && opt.page };
  pushScreen("tab-mat-view");
}
function renderMatView() {
  const pages = $("mv-pages"), ttl = $("mv-title");
  if (!pages) return;
  const scr = $("tab-mat-view"); if (scr) scr.scrollTop = 0; // a fejléc mindig látszódjon
  mvWireInput();
  if (!mv) { pages.innerHTML = `<div class="dash-empty" style="padding:24px">Nincs megnyitott anyag.</div>`; return; }
  if (ttl) ttl.textContent = mv.m.title;
  mvRenderHeader();
  mvRenderPop();
  if (mv.doc) { mvLayout(); mvRenderBar(); return; } // már betöltve (pl. visszatérés)
  pages.innerHTML = `<div class="dash-empty" style="padding:24px">Betöltés…</div>`;
  mvRenderBar();
  mvLoad(mv).catch((e) => { if (mv) pages.innerHTML = `<div class="dash-empty" style="padding:24px">Nem sikerült megnyitni: ${esc(String(e && e.message || e))}</div>`; });
}
async function mvLoad(cur) {
  const doc = await matGetDoc(cur.id);
  if (!doc) throw new Error("hiányzik a jegyzetréteg");
  if (cur.m.kind === "pdf") {
    const blob = await matGetFile(cur.id);
    if (!blob) throw new Error("hiányzik a fájl");
    const lib = await matPdfjs();
    cur.pdf = await lib.getDocument(matPdfOpts(new Uint8Array(await blob.arrayBuffer()))).promise;
    for (const pg of doc.pages) { // az oldalméretek kellenek az elrendezéshez; a tartalom csak láthatóan renderelődik
      if (pg.kind !== "pdf" || pg.w) continue;
      const v = (await cur.pdf.getPage(pg.n)).getViewport({ scale: 1 });
      pg.w = v.width; pg.h = v.height; cur.sized = true;
    }
  }
  if (mv !== cur) { try { cur.pdf && cur.pdf.destroy(); } catch (e) {} return; } // közben bezárták
  cur.doc = doc; doc.items = doc.items || {};
  // A kiszámolt oldalméreteket elmentjük: egy több száz oldalas könyv így legközelebb azonnal nyílik.
  if (cur.sized) cur.saving = cur.saving.then(() => matPutDoc(cur.id, doc)).catch(() => {});
  mvLayout();
  const jx = cur.jumpPage ? cur.doc.pages.findIndex((p) => p.kind === "pdf" && p.n === cur.jumpPage) : -1;
  if (jx >= 0) mvScrollToPage(jx, true); else mvRestorePos(cur);
  mvPill();
  const pr = mvPrefs();
  if (!pr.hintRead) { pr.hintRead = 1; saveState(); toast("Olvasó mód. Jegyzeteléshez koppints a ceruzára jobb fent."); }
}
function mvClose() {
  const sb = $("mv-selbar"); if (sb) sb.remove();
  const sr = $("mv-searchbar"); if (sr) sr.remove();
  const pill = $("mv-pill"); if (pill) pill.hidden = true;
  if (!mv) return;
  mvTextCommit();
  if (mv.posT) { clearTimeout(mv.posT); saveState(); } // a még el nem mentett olvasási pozíció
  try { mv.io && mv.io.disconnect(); } catch (e) {}
  try { mv.pdf && mv.pdf.destroy(); } catch (e) {}
  mv = null;
  const pop = $("mv-pop"); if (pop) pop.classList.add("hidden");
}

// ---- Elrendezés és lusta renderelés ----
// Minden oldal fölött fejléc: "N. oldal" és a ⋯ menü, az oldalak között vékony elválasztó vonal.
// Oldalon belül: PDF vászon, tinta-vászon, és felül a szövegdobozok rétege (DOM, hogy a szerkesztővel azonos legyen).
// anchor: { pt, fx, fy }: nagyítás után a pt tartalompont (oldal + oldalon belüli arány) kerüljön az fx, fy képernyőpontra.
function mvLayout(anchor) {
  const pages = $("mv-pages"), scroll = $("mv-scroll");
  if (!mv || !mv.doc || !pages) return;
  mvTextCommit();
  const ratio = scroll.scrollHeight ? scroll.scrollTop / scroll.scrollHeight : 0;
  const baseW = Math.max(240, Math.min(scroll.clientWidth - 24, 900));
  const cssW = Math.round(baseW * mv.z);
  const sig = mv.doc.pages.map((p) => p.id).join("|");
  if (mv.slots.length && mv.layoutSig === sig && pages.contains(mv.slots[0].el)) {
    // GYORS ÚT (nagyítás, forgatás): csak méretezünk. A meglévő kép CSS-sel kinyújtva látszik,
    // amíg az éles változat a háttérben elkészül, így nincs villanás és újraépítés.
    mv.slots.forEach((sl) => {
      if (sl.det) { // az éles részlet arányosan nyúljon, amíg az új elkészül
        const k = cssW / sl.cssW, d = sl.det;
        Object.assign(d.cv.style, { left: d.lx * k + "px", top: d.ly * k + "px", width: (d.rx - d.lx) * k + "px", height: (d.ry - d.ly) * k + "px" });
        d.lx *= k; d.ly *= k; d.rx *= k; d.ry *= k; d.z = -1;
      }
      sl.cssW = cssW; sl.cssH = Math.round(cssW * (sl.pg.h / sl.pg.w));
      if (sl.selLayer) sl.selLayer.style.setProperty("--k", cssW);
      sl.sheet.style.width = cssW + "px"; sl.el.style.width = cssW + "px"; sl.el.style.height = sl.cssH + "px";
      if (sl.rendered) sl.stale = true;
      mvRenderTexts(sl);
    });
  } else {
    try { mv.io && mv.io.disconnect(); } catch (e) {}
    mv.layoutSig = sig;
    pages.innerHTML = "";
    mv.slots = mv.doc.pages.map((pg, i) => {
      const sheet = document.createElement("div");
      sheet.className = "mv-sheet"; sheet.style.width = cssW + "px";
      sheet.innerHTML = `<div class="mv-phead"><span class="mv-plabel">${mvPageLabel(pg, i)}</span>`
        + `<button class="mv-pmenu" type="button" data-pix="${i}" aria-label="${i + 1}. oldal műveletei">${icon("more")}</button></div>`
        + `<div class="mv-pnotes"></div>`;
      const el = document.createElement("div");
      el.className = "mv-page"; el.dataset.ix = i;
      const cssH = Math.round(cssW * (pg.h / pg.w));
      el.style.width = cssW + "px"; el.style.height = cssH + "px";
      el.innerHTML = `<canvas class="mv-pdf" width="0" height="0"></canvas><canvas class="mv-ink" width="0" height="0"></canvas><div class="mv-texts"></div>`;
      sheet.appendChild(el);
      pages.appendChild(sheet);
      return { pg, el, sheet, cssW, cssH, pdfCv: el.children[0], inkCv: el.children[1], textLayer: el.children[2], notesEl: sheet.querySelector(".mv-pnotes"), rendered: false, stale: false, visible: false, gen: 0 };
    });
    mv.slots.forEach(mvRenderNotes);
    mv.io = new IntersectionObserver((ents) => ents.forEach((en) => {
      const sl = mv && mv.slots[+en.target.dataset.ix]; if (!sl) return;
      sl.visible = en.isIntersecting;
      if (!sl.visible) mvReleaseSlot(sl);
      mvSchedule();
    }), { root: scroll, rootMargin: "500px 0px" });
    mv.slots.forEach((sl) => { mv.io.observe(sl.el); mvRenderTexts(sl); });
    pages.querySelectorAll(".mv-pmenu").forEach((btn) => btn.onclick = () => mvPageMenu(+btn.dataset.pix));
  }
  // A kijelölés a régi oldal-objektumra mutatna: átkötjük az újra.
  if (mv.sel) { const ns = mv.slots.find((x) => x.pg.id === mv.sel.s.pg.id); if (ns) mv.sel.s = ns; else mv.sel = null; }
  mvApplyToolClass();
  scroll.style.overflowX = mv.z > 1.001 ? "auto" : "hidden";
  const asl = anchor && anchor.pt && mv.slots[anchor.pt.i];
  if (asl) {
    const b = asl.el.getBoundingClientRect();
    scroll.scrollLeft += b.left + anchor.pt.u * b.width - anchor.fx;
    scroll.scrollTop += b.top + anchor.pt.v * b.height - anchor.fy;
  } else scroll.scrollTop = ratio * scroll.scrollHeight;
  mvSchedule();
}
function mvApplyToolClass() {
  const scroll = $("mv-scroll"); if (!scroll || !mv) return;
  scroll.classList.toggle("mv-drawing", mv.tool !== "pan" && mv.tool !== "text");
  scroll.classList.toggle("mv-textmode", mv.tool === "text");
  scroll.classList.toggle("mv-panmode", mv.tool === "pan");
}
// Pixelkeret: egy oldal vászna legfeljebb ~4 megapixel. Nagy nagyításnál kicsit lágyabb, de nem fogy el
// a memória és nem akad. (A 3-4x-es nagyítás korábban oldalanként 20+ MP-t foglalt, két vásznon.)
const MV_MAX_PX = 4e6;
function mvDpr() { return Math.min(window.devicePixelRatio || 1, 3); }
function mvScale(sl) {
  const dpr = mvDpr(), px = sl.cssW * sl.cssH * dpr * dpr;
  return px > MV_MAX_PX ? dpr * Math.sqrt(MV_MAX_PX / px) : dpr;
}
// Renderelési sor: egyszerre egy oldal, a képernyő közepéhez legközelebbi elöl.
function mvSchedule() {
  if (!mv) return;
  clearTimeout(mv.schedT);
  mv.schedT = setTimeout(mvPump, mv.pinch ? 400 : 40);
}
async function mvPump() {
  const cur = mv; if (!cur || cur.pumping || cur.pinch) return;
  cur.pumping = true;
  try {
    for (;;) {
      if (mv !== cur || cur.pinch) break;
      const sc = $("mv-scroll"), mid = sc.getBoundingClientRect().top + sc.clientHeight / 2;
      const todo = cur.slots.filter((sl) => sl.visible && (!sl.rendered || sl.stale));
      if (!todo.length) break;
      todo.sort((p, q) => Math.abs(p.el.getBoundingClientRect().top - mid) - Math.abs(q.el.getBoundingClientRect().top - mid));
      await mvRenderSlot(todo[0]);
    }
  } finally { cur.pumping = false; }
  mvDetailSchedule();
}
async function mvRenderSlot(sl) {
  const gen = ++sl.gen, scale = mvScale(sl);
  const W = Math.max(1, Math.round(sl.cssW * scale)), H = Math.max(1, Math.round(sl.cssH * scale));
  sl.rendered = true; sl.stale = false;
  sl.inkW = W; sl.inkH = H;
  mvDrawInk(sl);
  if (sl.pg.kind === "blank") return mvPaintBlank(sl, W, H);
  if (sl.pg.kind !== "pdf" || !mv.pdf) return;
  try {
    const page = await mv.pdf.getPage(sl.pg.n);
    if (gen !== sl.gen || !mv) return;
    sl.page = page; mvTextLoad(sl, page);
    // Külön vászonra renderelünk, és csak kész állapotban cseréljük: addig a régi kép látszik (nincs villanás).
    const cv = document.createElement("canvas"); cv.className = "mv-pdf"; cv.width = W; cv.height = H;
    const vp = page.getViewport({ scale: W / page.getViewport({ scale: 1 }).width });
    sl.task = page.render({ canvasContext: cv.getContext("2d", { alpha: false }), viewport: vp });
    await sl.task.promise;
    sl.task = null;
    if (gen !== sl.gen || !sl.el.contains(sl.pdfCv)) return;
    sl.el.replaceChild(cv, sl.pdfCv); sl.pdfCv = cv;
  } catch (e) { sl.task = null; if (!e || e.name !== "RenderingCancelledException") console.warn("pdf oldal", e); }
}
function mvReleaseSlot(sl) {
  if (!sl.rendered) return;
  if (mv && mv.sel && mv.sel.s === sl) return; // itt szerkesztenek
  sl.gen++;
  try { sl.task && sl.task.cancel(); } catch (e) {}
  sl.task = null; sl.rendered = false; sl.stale = false;
  for (const cv of [sl.pdfCv, sl.inkCv]) { cv.width = 0; cv.height = 0; }
  if (sl.selLayer) sl.selLayer.innerHTML = "";
  if (sl.hitLayer) sl.hitLayer.innerHTML = "";
  mvDetailDrop(sl);
}

// ---- Éles részlet nagyításkor ----
// Az oldal teljes vászna pixelkeretes, ezért nagyítva lágy. A képernyőn LÁTHATÓ részt (plusz egy kis sávot)
// külön vászonra, kijelző-felbontásban is kirajzoljuk. Ez legfeljebb képernyőnyi, a memória nem nő a nagyítással.
function mvDetailSchedule() { if (!mv) return; clearTimeout(mv.detT); mv.detT = setTimeout(mvDetailPump, 140); }
async function mvDetailPump() {
  const cur = mv; if (!cur || !cur.pdf || cur.pinch || cur.detBusy) return;
  cur.detBusy = true;
  try {
    const sc = $("mv-scroll"), R = sc.getBoundingClientRect(), dpr = mvDpr(), M = 48;
    for (const sl of cur.slots) {
      if (mv !== cur || cur.pinch) return;
      const b = sl.el.getBoundingClientRect();
      const x0 = Math.max(b.left, R.left) - b.left, y0 = Math.max(b.top, R.top) - b.top;
      const x1 = Math.min(b.right, R.right) - b.left, y1 = Math.min(b.bottom, R.bottom) - b.top;
      if (!sl.rendered || sl.pg.kind !== "pdf" || mvScale(sl) > dpr * 0.9 || x1 <= x0 || y1 <= y0) { mvDetailDrop(sl); continue; }
      const d = sl.det;
      if (d && d.z === cur.z && d.lx <= x0 && d.ly <= y0 && d.rx >= x1 && d.ry >= y1) continue; // már lefedi
      const lx = Math.max(0, Math.floor(x0 - M)), ly = Math.max(0, Math.floor(y0 - M));
      const rx = Math.min(sl.cssW, Math.ceil(x1 + M)), ry = Math.min(sl.cssH, Math.ceil(y1 + M));
      const gen = sl.detGen = (sl.detGen || 0) + 1;
      try {
        const page = await cur.pdf.getPage(sl.pg.n);
        if (mv !== cur || gen !== sl.detGen) continue;
        const cv = document.createElement("canvas"); cv.className = "mv-detail";
        cv.width = Math.round((rx - lx) * dpr); cv.height = Math.round((ry - ly) * dpr);
        Object.assign(cv.style, { left: lx + "px", top: ly + "px", width: rx - lx + "px", height: ry - ly + "px" });
        const vp = page.getViewport({ scale: (sl.cssW * dpr) / page.getViewport({ scale: 1 }).width, offsetX: -lx * dpr, offsetY: -ly * dpr });
        sl.detTask = page.render({ canvasContext: cv.getContext("2d", { alpha: false }), viewport: vp });
        await sl.detTask.promise; sl.detTask = null;
        if (mv !== cur || gen !== sl.detGen || cur.pinch) continue;
        if (sl.det) sl.det.cv.remove();
        sl.el.insertBefore(cv, sl.inkCv);
        sl.det = { cv, z: cur.z, lx, ly, rx, ry };
      } catch (e) { sl.detTask = null; if (!e || e.name !== "RenderingCancelledException") console.warn("pdf részlet", e); }
    }
  } finally { cur.detBusy = false; }
}
function mvDetailDrop(sl) {
  sl.detGen = (sl.detGen || 0) + 1;
  try { sl.detTask && sl.detTask.cancel(); } catch (e) {}
  sl.detTask = null;
  if (sl.det) { sl.det.cv.width = 0; sl.det.cv.remove(); sl.det = null; }
}

// ---- Jegyzetréteg rajzolása ----
// withText: a megjelenítőben a szöveg DOM-ban él (false); a megosztott PDF-hez vászonra kell (true).
function mvDrawItems(ctx, items, W, H, live, withText) {
  const all = items.concat(live ? [live] : []);
  ctx.clearRect(0, 0, W, H);
  if (withText) all.forEach((it) => { if (it.t === "text") mvDrawText(ctx, it, W, H); }); // a szöveg (és takarása) alul, a rajz fölötte
  all.forEach((it) => { if (it.t === "mark" && it.k === "hl") mvDrawMark(ctx, it, W, H); });
  for (const pass of ["hl", "pen"]) all.forEach((it) => { if (it.t === "ink" && it.tool === pass) mvDrawStroke(ctx, it, W, H); });
  all.forEach((it) => { if (it.t === "mark" && it.k !== "hl") mvDrawMark(ctx, it, W, H); });
}
function mvDrawMark(ctx, it, W, H) {
  ctx.save(); ctx.globalAlpha = it.a != null ? it.a : 1; ctx.fillStyle = it.c;
  for (const [x, y, w, h] of it.rects) {
    if (it.k === "hl") ctx.fillRect(x * W, y * H, w * W, h * H);
    else { const t = Math.max(1, h * H * 0.08); ctx.fillRect(x * W, (y + h * (it.k === "ul" ? 0.92 : 0.54)) * H - t / 2, w * W, t); }
  }
  ctx.restore();
}
function mvDrawStroke(ctx, it, W, H) {
  const p = it.pts; if (p.length < 3) return;
  const alpha = it.a != null ? it.a : (it.tool === "hl" ? 0.38 : 1);
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = it.c; ctx.fillStyle = it.c;
  const n = p.length / 3, X = (i) => p[i * 3] * W, Y = (i) => p[i * 3 + 1] * H;
  if (it.tool === "hl" || alpha < 0.999) {
    // Áttetsző vonás: egyetlen útvonalként, különben az átfedő szakaszok besötétednek.
    ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(0.6, it.w * W);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    if (n === 1) ctx.lineTo(X(0) + 0.1, Y(0));
    for (let i = 1; i < n; i++) {
      if (i < n - 1) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      else ctx.lineTo(X(i), Y(i));
    }
    ctx.stroke();
  } else {
    // Fedő toll: középpontos simítás, szakaszonként a nyomás szerinti vastagsággal.
    if (n === 1) { ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.6, it.w * W * (0.5 + p[2])) / 2, 0, Math.PI * 2); ctx.fill(); }
    let sx = X(0), sy = Y(0);
    for (let i = 1; i < n; i++) {
      const last = i === n - 1;
      const ex = last ? X(i) : (X(i) + X(i + 1)) / 2, ey = last ? Y(i) : (Y(i) + Y(i + 1)) / 2;
      ctx.lineWidth = Math.max(0.6, it.w * W * (0.5 + p[i * 3 + 2]));
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(X(i), Y(i), ex, ey); ctx.stroke();
      sx = ex; sy = ey;
    }
  }
  ctx.restore();
}
function mvTextBw(it) { return it.bw != null ? it.bw : Math.max(0.15, 1 - it.x - 0.02); }
function mvTextFont(it, W) { return `${it.fi ? "italic " : ""}${it.fw || 500} ${Math.max(6, it.s * W)}px ${it.f || MV_FONT}`; }
// Sortörés a vászonra (a megosztott PDF-hez), a böngésző pre-wrap tördeléséhez igazítva.
function mvWrapLines(ctx, text, maxW, firstMaxW) {
  const out = [], lim = () => (!out.length && firstMaxW != null ? firstMaxW : maxW);
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const tok of para.split(/(\s+)/)) {
      if (!tok) continue;
      if (ctx.measureText(line + tok).width <= lim() || !line.trim()) {
        if (!line && ctx.measureText(tok).width > lim()) { // egy szó is túl hosszú: karakterenként
          for (const ch of tok) { if (line && ctx.measureText(line + ch).width > lim()) { out.push(line); line = ch; } else line += ch; }
        } else line += tok;
      } else { out.push(line.replace(/\s+$/, "")); line = /^\s+$/.test(tok) ? "" : tok; }
    }
    out.push(line);
  }
  return out;
}
function mvDrawText(ctx, it, W, H) {
  const fs = it.s * W, lh = fs * (it.lh || 1.25), single = mvPdfLine(it);
  ctx.save(); ctx.font = mvTextFont(it, W);
  if (it.ls) ctx.letterSpacing = it.ls * fs + "px";
  const pl = (it.pl || 0) * W, ti = (it.ti || 0) * W, cw = single ? Infinity : mvTextBw(it) * W - pl;
  const rows = []; // a böngészővel azonos tördelés: a behúzás csak az első sorra vonatkozik
  String(it.text).split("\n").forEach((para) => {
    const first = !rows.length, parts = single ? [para] : mvWrapLines(ctx, para, cw, first ? cw - ti : cw);
    parts.forEach((t, i) => { const f = first && i === 0; rows.push({ t, dx: pl + (f ? ti : 0), w: f ? cw - ti : cw, end: i === parts.length - 1 }); });
  });
  if (it.cover) { // az eredeti PDF-szöveg kitakarása
    const c = it.cover, tw = single ? Math.max(0, ...rows.map((r) => ctx.measureText(r.t).width)) : mvTextBw(it) * W;
    let cwid = c.w * W, ch = c.h * H;
    if (single && mvCoverInPlace(it)) { cwid = Math.max(cwid, (it.x - c.x) * W + tw + 3); ch = Math.max(ch, (it.y - c.y) * H + rows.length * lh); }
    ctx.fillStyle = c.bg; ctx.fillRect(c.x * W, c.y * H, cwid, ch);
  }
  // Ugyanaz a szabály, mint a böngészőben: alapvonal = félsorköz + a betűkészlet felső kiterjedése.
  const m = ctx.measureText("Hg"), A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
  const off = A > 0 && D >= 0 ? (lh - (A + D)) / 2 + A : lh / 2 + fs * 0.35;
  ctx.fillStyle = it.c; ctx.textBaseline = "alphabetic";
  rows.forEach((r, i) => {
    const y = it.y * H + i * lh + off, x = it.x * W + r.dx;
    if (it.al === "center") { ctx.textAlign = "center"; ctx.fillText(r.t, x + r.w / 2, y); ctx.textAlign = "start"; }
    else if (it.al === "justify" && !r.end && /\S\s+\S/.test(r.t)) {
      const words = r.t.trim().split(/\s+/), total = words.reduce((a, w) => a + ctx.measureText(w).width, 0);
      const gap = (r.w - total) / (words.length - 1);
      let cx = x; words.forEach((w) => { ctx.fillText(w, cx, y); cx += ctx.measureText(w).width + gap; });
    } else ctx.fillText(r.t, x, y);
  });
  ctx.restore();
}
function mvLiveStart(d) {
  const s = d.s, cv = document.createElement("canvas");
  cv.className = "mv-live";
  cv.width = s.inkW || Math.round(s.cssW * mvScale(s)); cv.height = s.inkH || Math.round(s.cssH * mvScale(s));
  s.el.insertBefore(cv, s.textLayer);
  d.live = cv;
  d.liveCtx = cv.getContext("2d");
}
function mvLiveDraw(d) {
  if (!d.live) return;
  d.liveCtx.clearRect(0, 0, d.live.width, d.live.height);
  mvDrawStroke(d.liveCtx, d.item, d.live.width, d.live.height);
}
function mvLiveEnd(d) { if (d && d.live) { d.live.width = 0; d.live.remove(); d.live = null; } }
function mvDrawInk(s, live) {
  if (!s.rendered || !mv) return;
  const items = mv.doc.items[s.pg.id] || [];
  const need = !!live || items.some((it) => it.t === "ink" || it.t === "mark");
  const cv = s.inkCv;
  if (!need) { if (cv.width) { cv.width = 0; cv.height = 0; } return; } // üres oldalon nem foglalunk memóriát
  if (cv.width !== s.inkW || cv.height !== s.inkH) { cv.width = s.inkW; cv.height = s.inkH; }
  mvDrawItems(cv.getContext("2d"), items, cv.width, cv.height, live, false);
}

// ---- Mentés és visszavonás ----
function mvSave() {
  if (!mv) return;
  const cur = mv, doc = cur.doc;
  cur.m.upd = Date.now(); cur.m.pages = doc.pages.length; saveState();
  // Láncolva, hogy a gyors egymás utáni mentések ne előzzék meg egymást.
  cur.saving = cur.saving.then(() => matPutDoc(cur.id, doc)).catch((e) => toast("A jegyzet mentése nem sikerült: " + (e && e.message ? e.message : e)));
  const st = $("mv-sub"); if (st) st.textContent = "Mentve";
}
function mvPush(op) { mv.undo.push(op); if (mv.undo.length > 100) mv.undo.shift(); mv.redo = []; mvRenderBar(); }
// Egy művelet végrehajtása előre (fwd) vagy visszafelé. Minden művelet mindkét irányba lejátszható,
// így ugyanaz az objektum vándorol a visszavonás és az újra verem között.
function mvApplyOp(op, fwd) {
  const items = mv.doc.items, arr = (id) => (items[id] = items[id] || []);
  if (op.type === "add") {
    const a = arr(op.page);
    if (fwd) a.splice(op.ix != null ? Math.min(op.ix, a.length) : a.length, 0, op.item);
    else { const ix = a.indexOf(op.item); if (ix >= 0) { a.splice(ix, 1); op.ix = ix; } if (mv.sel && mv.sel.it === op.item) mv.sel = null; }
  } else if (op.type === "remove") {
    const a = arr(op.page);
    if (fwd) [...op.removed].sort((p, q) => q.ix - p.ix).forEach((r) => { const ix = a.indexOf(r.item); if (ix >= 0) a.splice(ix, 1); if (mv.sel && mv.sel.it === r.item) mv.sel = null; });
    else [...op.removed].sort((p, q) => p.ix - q.ix).forEach((r) => a.splice(r.ix, 0, r.item));
  } else if (op.type === "edit") { const t = op.item.text; op.item.text = op.before; op.before = t; }
  else if (op.type === "prop") { const cur = mvTextProps(op.item); Object.assign(op.item, op.before); op.before = cur; }
  else if (op.type === "bg") { op.list.forEach((e) => { const t = e.pg.bg || "plain"; e.pg.bg = e.bg; e.bg = t; }); mvSave(); mvBgRefresh(); mvRenderBar(); return; }
  else if (op.type === "addPage" || op.type === "delPage") {
    const insert = (op.type === "addPage") === fwd;
    if (insert) { mv.doc.pages.splice(op.index, 0, op.page); if (op.items) items[op.page.id] = op.items; }
    else {
      op.page = mv.doc.pages[op.index]; op.items = items[op.page.id];
      if (mv.sel && mv.sel.s.pg.id === op.page.id) mv.sel = null;
      mv.doc.pages.splice(op.index, 1); delete items[op.page.id];
    }
    mvSave(); mvLayout(); mvRenderBar(); if (insert) mvScrollToPage(op.index);
    return;
  }
  mvSave(); mvRedrawPage(op.page); mvRenderBar();
}
function mvUndo() {
  mvTextCommit();
  const op = mv && mv.undo.pop(); if (!op) return;
  mv.redo.push(op); mvApplyOp(op, false);
}
function mvRedo() {
  mvTextCommit();
  const op = mv && mv.redo.pop(); if (!op) return;
  mv.undo.push(op); mvApplyOp(op, true);
}
function mvRedrawPage(pageId) { (mv.slots || []).forEach((s) => { if (s.pg.id === pageId) { mvDrawInk(s); mvRenderTexts(s); } }); }

// ---- Bemenet: toll, kiemelő, radír, szöveg ----
function mvSlotAt(ev) { const el = ev.target.closest && ev.target.closest(".mv-page"); return el && mv ? mv.slots[+el.dataset.ix] : null; }
function mvNorm(s, ev) { const r = s.el.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; }
function mvWireInput() {
  const scroll = $("mv-scroll"); if (!scroll || scroll.dataset.wired) return;
  scroll.dataset.wired = "1";
  $("mv-addpage").onclick = () => mvAction("addpage");
  $("mv-share").onclick = () => mvAction("share");
  mvWirePinch(scroll);
  scroll.addEventListener("scroll", () => {
    if (mv && mv.z > 1.001) mvDetailSchedule(); if ($("mv-selbar")) mvSelBar();
    if (mv && !mv.posRaf) mv.posRaf = requestAnimationFrame(() => { if (mv) { mv.posRaf = 0; mvTrackPos(); } });
  }, { passive: true });
  document.addEventListener("selectionchange", () => { if (!mv) return; clearTimeout(mv.selT); mv.selT = setTimeout(mvSelBar, 150); });
  // A billentyűzet megjelenésekor a szerkesztett doboz maradjon látható.
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => mvTextKeepVisible());
  scroll.addEventListener("pointerdown", (ev) => {
    if (!mv || !mv.doc || mv.pinch) return;
    const t = ev.target;
    if (t.closest && (t.closest(".mv-textedit") || t.closest(".mv-phead") || t.closest(".mv-tctx"))) return;
    if (mv.popOpen) { mv.popOpen = false; mvRenderPop(); mvRenderQuick(); }
    if (mv.tool === "text") return mvTextPointerDown(ev);
    if (mv.tool === "pan") { mv.tapDown = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp }; return; }
    if (ev.pointerType === "pen") mv.penSeen = true;
    const cur = mv.draw;
    if (cur) {
      // Egyszerre egy mozdulat: a második ujj vagy a tenyér nem szakítja meg a vonást.
      // De ha ELSŐDLEGES érintés jön (minden korábbi ujj fent van) vagy ugyanaz a mutató, az előző
      // felengedése elveszett: lezárjuk (a vonás megmarad), különben minden további érintés elakadna.
      if (!ev.isPrimary && ev.pointerId !== cur.id) return;
      if (ev.pointerType === "touch" && cur.pt === "pen" && ev.pointerId !== cur.id) return; // tenyér tollal írás közben
      finish(cur, null);
    }
    // Tenyér-elutasítás: ha egyszer tollat láttunk, az ujj már csak görget.
    if (ev.pointerType === "touch" && mv.penSeen) {
      mv.draw = { pan: true, id: ev.pointerId, y: ev.clientY, x: ev.clientX };
      if (!mv.penHint) { mv.penHint = 1; toast("Tollat érzékeltem: tollal rajzolsz, ujjal görgetsz."); }
      return;
    }
    const s = mvSlotAt(ev); if (!s) return;
    ev.preventDefault();
    try { scroll.setPointerCapture(ev.pointerId); } catch (e) {}
    const q = mvNorm(s, ev), pr = ev.pressure > 0 && ev.pointerType !== "mouse" ? ev.pressure : 0.5;
    if (mv.tool === "pen" || mv.tool === "hl") {
      const p = mvPrefs()[mv.tool];
      mv.draw = { id: ev.pointerId, pt: ev.pointerType, t0: ev.timeStamp, len: 0, lx: ev.clientX, ly: ev.clientY, s, item: { t: "ink", tool: mv.tool, c: p.c, w: p.w, a: p.a, pts: [q.x, q.y, pr] } };
      mvLiveStart(mv.draw); mvLiveDraw(mv.draw);
    } else if (mv.tool === "eraser") {
      mv.draw = { id: ev.pointerId, pt: ev.pointerType, t0: ev.timeStamp, len: 0, lx: ev.clientX, ly: ev.clientY, s, removed: [] }; mvErase(s, q, ev);
    }
  });
  scroll.addEventListener("pointermove", (ev) => {
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    if (d.pan) { scroll.scrollTop -= ev.clientY - d.y; scroll.scrollLeft -= ev.clientX - d.x; d.y = ev.clientY; d.x = ev.clientX; return; }
    if (d.mode) return mvTextPointerMove(ev, d);
    ev.preventDefault();
    if (d.lx != null) { d.len += Math.hypot(ev.clientX - d.lx, ev.clientY - d.ly); d.lx = ev.clientX; d.ly = ev.clientY; }
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    if (d.item) {
      for (const e2 of (evs.length ? evs : [ev])) {
        const q = mvNorm(d.s, e2), pr = e2.pressure > 0 && e2.pointerType !== "mouse" ? e2.pressure : 0.5;
        const p = d.item.pts, lx = p[p.length - 3], ly = p[p.length - 2];
        if (Math.abs(q.x - lx) + Math.abs(q.y - ly) < 0.0012) continue; // túl sűrű pontok kihagyása
        p.push(q.x, q.y, pr);
      }
      if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; if (mv && mv.draw === d) mvLiveDraw(d); });
    } else if (d.removed) mvErase(d.s, mvNorm(d.s, ev), ev);
  });
  function finish(d, ev) {
    mv.draw = null;
    if (d.pan) return;
    if (d.mode) { if (ev) mvTextPointerEnd(ev, d); return; }
    const pageId = d.s.pg.id, arr = (mv.doc.items[pageId] = mv.doc.items[pageId] || []);
    if (d.item) {
      if (d.raf) cancelAnimationFrame(d.raf);
      d.item.pts = d.item.pts.map((v) => Math.round(v * 10000) / 10000); // kisebb mentés
      arr.push(d.item); mvPush({ type: "add", page: pageId, item: d.item }); mvSave(); mvDrawInk(d.s); mvLiveEnd(d);
    } else if (d.removed) {
      if (d.removed.length) { mvPush({ type: "remove", page: pageId, removed: d.removed }); mvSave(); }
    }
  }
  const end = (ev) => {
    if (mv && mv.tool === "pan" && ev.type === "pointerup") mvTapCheck(ev);
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    finish(d, ev);
  };
  scroll.addEventListener("pointerup", end);
  scroll.addEventListener("pointercancel", end);
}
function mvTapCheck(ev) {
  const t = mv.tapDown; mv.tapDown = null;
  if (!t || t.id !== ev.pointerId || mv.pinch || ev.timeStamp - t.t > 300 || Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > 12) return;
  const last = mv.lastTap; mv.lastTap = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
  if (!last || ev.timeStamp - last.t > 320 || Math.hypot(ev.clientX - last.x, ev.clientY - last.y) > 40) return;
  mv.lastTap = null;
  mvSetZoom(mv.z > 1.05 ? 1 : 2.5, { x: ev.clientX, y: ev.clientY });
}
function mvErase(s, q, ev) {
  const arr = mv.doc.items[s.pg.id] || []; if (!arr.length) return;
  const W = s.inkW || s.cssW, H = s.inkH || s.cssH, r = 14 / s.cssW, aspect = H / W;
  const hitText = new Set();
  [...s.textLayer.children].forEach((el) => { // szövegdoboz: a tényleges (DOM) doboza alapján
    if (!el._it) return;
    const b = el.getBoundingClientRect(), tol = 14;
    if (ev.clientX >= b.left - tol && ev.clientX <= b.right + tol && ev.clientY >= b.top - tol && ev.clientY <= b.bottom + tol) hitText.add(el._it);
  });
  let changed = false, textChanged = false;
  for (let i = arr.length - 1; i >= 0; i--) {
    const it = arr[i]; let hit = false;
    if (it.t === "ink") {
      const lim = r + it.w / 2;
      for (let k = 0; k < it.pts.length; k += 3) { const dx = it.pts[k] - q.x, dy = (it.pts[k + 1] - q.y) * aspect; if (dx * dx + dy * dy < lim * lim) { hit = true; break; } }
    } else if (it.t === "text") { hit = hitText.has(it); if (hit) textChanged = true; }
    else if (it.t === "mark") { const ry = r / aspect; hit = it.rects.some(([x, y, w, h]) => q.x >= x - r && q.x <= x + w + r && q.y >= y - ry && q.y <= y + h + ry); }
    if (hit) { mv.draw.removed.push({ ix: i, item: it }); arr.splice(i, 1); changed = true; if (mv.sel && mv.sel.it === it) mv.sel = null; }
  }
  if (changed) mvDrawInk(s);
  if (textChanged) mvRenderTexts(s);
}

// =====================================================================
//  SZÖVEGDOBOZOK (a Samsung Notes szövegdobozainak mintájára)
//  - T eszköz, koppintás üres helyre: új doboz, rögtön villog a kurzor.
//  - Koppintás egy dobozra: kijelölés (keret, jobb oldali fogantyú). Húzás: mozgatás, fogantyú: szélesség.
//  - Kijelölt dobozra koppintás: szerkesztés. Lebegő mini-eszköztár a doboz fölött.
//  - NINCS mentés fókuszvesztéskor (Androidon gépelés közben is előfordul): csak Kész gombra,
//    máshova koppintásra, eszközváltásra, kilépésre.
// =====================================================================
function mvTextProps(it) { return { x: it.x, y: it.y, bw: it.bw, s: it.s, c: it.c }; }
// Egysoros átírt PDF-sor: nem tör, a szélessége a szöveggel nő. A bekezdés (bw van) normál, tördelt doboz.
function mvPdfLine(it) { return !!it.cover && it.bw == null; }
function mvStyleText(el, it, s) {
  const line = mvPdfLine(it);
  if (!it.cover && it.bw == null) it.bw = mvTextBw(it);
  Object.assign(el.style, { left: it.x * 100 + "%", top: it.y * 100 + "%", width: line ? "auto" : it.bw * 100 + "%", fontSize: it.s * s.cssW + "px", color: it.c,
    fontFamily: it.f || MV_FONT, fontWeight: it.fw || 500, fontStyle: it.fi ? "italic" : "normal", letterSpacing: it.ls ? it.ls + "em" : "normal", whiteSpace: line ? "pre" : "",
    lineHeight: it.lh ? String(it.lh) : "", textAlign: it.al || "", paddingLeft: it.pl ? it.pl * s.cssW + "px" : "", textIndent: it.ti ? it.ti * s.cssW + "px" : "" });
}
// Átírt PDF-sor: amíg a szöveg az eredeti helyén van, a takarás a hosszabb új szöveggel együtt nő.
function mvCoverInPlace(it) { return it.ox == null || (Math.abs(it.x - it.ox) < 0.003 && Math.abs(it.y - it.oy) < 0.003); }
function mvCoverFit(s, it, el) {
  const cv = [...s.textLayer.children].find((x) => x._cov === it); if (!cv) return;
  const c = it.cover;
  let w = c.w * s.cssW, h = c.h * s.cssH;
  if (el && mvPdfLine(it) && mvCoverInPlace(it)) { w = Math.max(w, (it.x - c.x) * s.cssW + el.offsetWidth + 3); h = Math.max(h, (it.y - c.y) * s.cssH + el.offsetHeight); }
  cv.style.width = w + "px"; cv.style.height = h + "px";
}
function mvTextElFor(s, it) { return [...s.textLayer.children].find((el) => el._it === it) || null; }
function mvRenderTexts(s) {
  if (!mv || !s.textLayer) return;
  s.textLayer.innerHTML = "";
  const all = (mv.doc.items[s.pg.id] || []).slice();
  if (mv.edit && mv.edit.s === s && !all.includes(mv.edit.it)) all.push(mv.edit.it); // új, még nem mentett átírás takarása
  for (const it of all) {
    if (it.t !== "text" || !it.cover) continue;
    const c = document.createElement("div");
    c.className = "mv-tcover"; c._cov = it;
    Object.assign(c.style, { left: it.cover.x * 100 + "%", top: it.cover.y * 100 + "%", width: it.cover.w * s.cssW + "px", height: it.cover.h * s.cssH + "px", background: it.cover.bg });
    s.textLayer.appendChild(c);
  }
  for (const it of mv.doc.items[s.pg.id] || []) {
    if (it.t !== "text" || (mv.edit && mv.edit.it === it)) continue;
    const el = document.createElement("div");
    const selected = mv.sel && mv.sel.it === it;
    el.className = "mv-tbox" + (selected ? " sel" : "");
    mvStyleText(el, it, s);
    el.textContent = it.text;
    el._it = it;
    if (selected && !mvPdfLine(it)) { const h = document.createElement("span"); h.className = "mv-thandle"; h.setAttribute("aria-label", "Szélesség"); el.appendChild(h); }
    s.textLayer.appendChild(el);
    if (it.cover) mvCoverFit(s, it, el);
  }
  mvRenderTextCtx();
}
function mvTextPointerDown(ev) {
  const s = mvSlotAt(ev);
  if (!s) { mvTextFinish(); return; }
  const base = { id: ev.pointerId, s, sx: ev.clientX, sy: ev.clientY };
  const handle = ev.target.closest(".mv-thandle"), box = ev.target.closest(".mv-tbox");
  if (handle && mv.sel) {
    ev.preventDefault(); try { $("mv-scroll").setPointerCapture(ev.pointerId); } catch (e) {}
    mv.draw = Object.assign(base, { mode: "resize", it: mv.sel.it, bw0: mv.sel.it.bw, before: mvTextProps(mv.sel.it) });
    return;
  }
  if (box && box._it) {
    if (mv.sel && mv.sel.it === box._it) {
      ev.preventDefault(); try { $("mv-scroll").setPointerCapture(ev.pointerId); } catch (e) {}
      mv.draw = Object.assign(base, { mode: "move", it: box._it, x0: box._it.x, y0: box._it.y, moved: false, before: mvTextProps(box._it) });
    } else mv.draw = Object.assign(base, { mode: "select", it: box._it });
    return;
  }
  mv.draw = Object.assign(base, { mode: "tap", q: mvNorm(s, ev) });
}
function mvTextPointerMove(ev, d) {
  const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
  if (d.mode === "move") {
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
    d.moved = true; ev.preventDefault();
    d.it.x = Math.max(0, Math.min(mvPdfLine(d.it) ? 0.98 : 1 - d.it.bw, d.x0 + dx / d.s.cssW));
    d.it.y = Math.max(0, Math.min(0.98, d.y0 + dy / d.s.cssH));
    const el = mvTextElFor(d.s, d.it); if (el) { el.style.left = d.it.x * 100 + "%"; el.style.top = d.it.y * 100 + "%"; if (d.it.cover) mvCoverFit(d.s, d.it, el); }
    mvPlaceTextCtx();
  } else if (d.mode === "resize") {
    ev.preventDefault();
    d.it.bw = Math.max(0.08, Math.min(1 - d.it.x, d.bw0 + dx / d.s.cssW));
    const el = mvTextElFor(d.s, d.it); if (el) el.style.width = d.it.bw * 100 + "%";
    mvPlaceTextCtx();
  }
}
function mvTextPointerEnd(ev, d) {
  const tap = ev.type === "pointerup" && Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) < 10;
  if (d.mode === "move") {
    if (!d.moved) { if (ev.type === "pointerup") mvTextEdit(d.s, d.it, false); return; }
    mvPush({ type: "prop", page: d.s.pg.id, item: d.it, before: d.before }); mvSave();
  } else if (d.mode === "resize") {
    if (d.it.bw !== d.bw0) { mvPush({ type: "prop", page: d.s.pg.id, item: d.it, before: d.before }); mvSave(); }
  } else if (d.mode === "select") {
    if (tap) { mvTextFinish(); mv.sel = { s: d.s, it: d.it }; mv.ctxColors = false; mvRenderTexts(d.s); }
  } else if (d.mode === "tap") {
    if (!tap) return;
    // Ha éppen szerkesztettél vagy ki volt jelölve valami, az első koppintás lezár (mint a Samsung Notesban).
    // PDF-szövegre koppintva viszont rögtön az a sor nyílik meg, mert egyértelmű, mit akarsz.
    const had = mv.edit || mv.sel;
    if (had) mvTextFinish();
    const cov = mvCoverAt(d.s, d.q);
    if (cov) { mv.sel = { s: d.s, it: cov }; mv.ctxColors = false; mvRenderTexts(d.s); return; }
    const ln = mvPdfBlockAt(d.s, d.q);
    if (ln) return mvTextFromPdf(d.s, ln, d.q);
    if (!had) mvTextCreate(d.s, d.q);
  }
}
function mvTextCreate(s, q) {
  const p = mvPrefs().text;
  const bw = Math.max(0.2, Math.min(0.62, 0.98 - q.x));
  const lineH = (p.s * s.cssW * 1.25) / s.cssH;
  const it = { t: "text", x: Math.max(0, Math.min(q.x, 0.98 - bw)), y: Math.max(0, Math.min(0.98, q.y - lineH / 2)), bw, s: p.s, c: p.c, text: "" };
  mvTextEdit(s, it, true);
}
// Szerkesztés indítása. Szinkron kell maradnia (koppintáson belül), különben Androidon nem nyílik meg a billentyűzet.
function mvTextEdit(s, it, isNew) {
  if (mv.edit) mvTextCommit();
  mv.sel = { s, it }; mv.ctxColors = false;
  const ta = document.createElement("textarea");
  ta.className = "mv-textedit"; ta.value = it.text; ta.spellcheck = false; ta.rows = 1;
  if (mvPdfLine(it)) ta.wrap = "off";
  ta.setAttribute("autocapitalize", "sentences"); ta.setAttribute("aria-label", "Szöveg a lapon");
  mvStyleText(ta, it, s);
  s.el.appendChild(ta);
  mv.edit = { s, it, isNew, before: it.text, ta };
  const grow = () => {
    if (mvPdfLine(it)) { ta.style.width = "1px"; ta.style.width = Math.max(ta.scrollWidth + 2, (it.cover.w - (it.x - it.cover.x)) * s.cssW) + "px"; }
    ta.style.height = "0px"; ta.style.height = Math.max(ta.scrollHeight, it.s * s.cssW * (it.lh || 1.25)) + "px";
    if (it.cover) mvCoverFit(s, it, ta);
    mvPlaceTextCtx();
  };
  ta.addEventListener("input", () => { grow(); mvTextKeepVisible(); });
  mvRenderTexts(s); // az eredeti doboz eltűnik, amíg szerkesztjük, és kirajzolódik a mini-eszköztár
  grow();
  try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
  ta.setSelectionRange(ta.value.length, ta.value.length);
  setTimeout(mvTextKeepVisible, 60);
  setTimeout(mvTextKeepVisible, 450); // a billentyűzet animációja után
}
// Lezárja a szerkesztést és ment. A kijelölés megmarad (a Kész után mozgatható, átméretezhető).
function mvTextCommit() {
  const e = mv && mv.edit; if (!e) return;
  mv.edit = null;
  const txt = e.ta.value.replace(/\s+$/, "");
  e.ta.remove();
  const pageId = e.s.pg.id, arr = (mv.doc.items[pageId] = mv.doc.items[pageId] || []);
  if (e.isNew) {
    if (e.it.cover ? txt !== e.it.orig : txt) { e.it.text = txt; arr.push(e.it); mvPush({ type: "add", page: pageId, item: e.it }); mvSave(); }
    else mv.sel = null;
  } else if (!txt && !e.it.cover) {
    const ix = arr.indexOf(e.it);
    if (ix >= 0) { arr.splice(ix, 1); mvPush({ type: "remove", page: pageId, removed: [{ ix, item: e.it }] }); mvSave(); }
    mv.sel = null;
  } else if (txt !== e.before) { mvPush({ type: "edit", page: pageId, item: e.it, before: e.before }); e.it.text = txt; mvSave(); }
  mvRenderTexts(e.s);
}
// Lezár mindent: szerkesztés mentése és a kijelölés megszüntetése.
function mvTextFinish() {
  if (!mv) return;
  const s = (mv.edit && mv.edit.s) || (mv.sel && mv.sel.s);
  mvTextCommit();
  mv.sel = null; mv.ctxColors = false;
  if (s) mvRenderTexts(s); else mvRenderTextCtx();
}
function mvTextDelete() {
  const sel = mv && mv.sel; if (!sel) return;
  if (mv.edit) { const e = mv.edit; mv.edit = null; e.ta.remove(); if (e.isNew) { mv.sel = null; mvRenderTexts(e.s); return; } }
  const arr = mv.doc.items[sel.s.pg.id] || [], ix = arr.indexOf(sel.it);
  if (ix >= 0) { arr.splice(ix, 1); mvPush({ type: "remove", page: sel.s.pg.id, removed: [{ ix, item: sel.it }] }); mvSave(); }
  mv.sel = null; mvRenderTexts(sel.s);
  toast(sel.it.cover ? "Az eredeti szöveg visszaállt." : "Szöveg törölve.");
}
// Tulajdonság (szín, méret) a kijelölt dobozra; új, még nem mentett doboznál nincs mit visszavonni.
function mvTextSetProp(fn) {
  const sel = mv && mv.sel; if (!sel) return;
  const before = mvTextProps(sel.it);
  fn(sel.it);
  const p = mvPrefs().text; p.c = sel.it.c; p.s = sel.it.s; saveState(); // a következő doboz is ilyen legyen
  const isNew = mv.edit && mv.edit.isNew && mv.edit.it === sel.it;
  if (!isNew) { mvPush({ type: "prop", page: sel.s.pg.id, item: sel.it, before }); mvSave(); }
  if (mv.edit && mv.edit.it === sel.it) { mvStyleText(mv.edit.ta, sel.it, sel.s); mv.edit.ta.dispatchEvent(new Event("input")); }
  mvRenderTexts(sel.s);
}
function mvRenderTextCtx() {
  document.querySelectorAll(".mv-tctx").forEach((x) => x.remove());
  mvRenderQuick();
  const sel = mv && mv.sel; if (!sel || mv.tool !== "text") return;
  const bar = document.createElement("div");
  bar.className = "mv-tctx";
  const b = (act, inner, label, extra) => `<button type="button" data-tx="${act}" aria-label="${label}" title="${label}"${extra || ""}>${inner}</button>`;
  if (mv.ctxColors) {
    bar.innerHTML = b("back", icon("back"), "Vissza") + MV_PALETTE.map((c) => b("color:" + c, `<span class="mv-sw-mini${c === sel.it.c ? " on" : ""}" style="background:${c}"></span>`, "Szín")).join("");
  } else {
    bar.innerHTML = (mv.edit ? b("done", icon("check") + "<span>Kész</span>", "Kész", ' class="primary"') : b("edit", icon("pencil") + "<span>Szerkesztés</span>", "Szerkesztés", ' class="primary"'))
      + b("colors", `<span class="mv-sw-mini" style="background:${sel.it.c}"></span>`, "Szín")
      + b("smaller", "A−", "Kisebb betű") + b("bigger", "A+", "Nagyobb betű")
      + b("delete", icon("trash"), "Törlés");
  }
  sel.s.el.appendChild(bar);
  // A gombok ne vegyék el a fókuszt a szerkesztőtől (különben lecsukódna a billentyűzet).
  bar.addEventListener("pointerdown", (ev) => ev.preventDefault());
  bar.querySelectorAll("[data-tx]").forEach((btn) => btn.onclick = () => mvTextCtxAction(btn.dataset.tx));
  mvPlaceTextCtx();
}
function mvPlaceTextCtx() {
  const bar = document.querySelector(".mv-tctx"), sel = mv && mv.sel; if (!bar || !sel) return;
  const el = (mv.edit && mv.edit.ta) || mvTextElFor(sel.s, sel.it); if (!el) return;
  const top = el.offsetTop, h = el.offsetHeight, left = el.offsetLeft;
  let y = top - bar.offsetHeight - 12;
  if (y < 4) y = top + h + 12;
  bar.style.top = y + "px";
  bar.style.left = Math.max(4, Math.min(left, sel.s.cssW - bar.offsetWidth - 4)) + "px";
}
function mvTextCtxAction(a) {
  const sel = mv && mv.sel; if (!sel) return;
  const PX = [9, 11, 13, 14, 16, 18, 21, 24, 28, 34, 40, 48, 56];
  if (a === "done") { mvTextCommit(); return; }
  if (a === "edit") { mvTextEdit(sel.s, sel.it, false); return; }
  if (a === "delete") return mvTextDelete();
  if (a === "colors") { mv.ctxColors = true; mvRenderTextCtx(); return; }
  if (a === "back") { mv.ctxColors = false; mvRenderTextCtx(); return; }
  if (a.startsWith("color:")) { const c = a.slice(6); mv.ctxColors = false; mvTextSetProp((it) => { it.c = c; }); return; }
  if (a === "smaller" || a === "bigger") {
    const cur = sel.it.s * MV_REF;
    const next = a === "bigger" ? (PX.find((v) => v > cur + 0.5) || PX[PX.length - 1]) : ([...PX].reverse().find((v) => v < cur - 0.5) || PX[0]);
    mvTextSetProp((it) => { it.s = next / MV_REF; });
  }
}
// A szerkesztett/kijelölt doboz a látható rész FELSŐ felébe kerüljön: a billentyűzet alulról takar,
// és nem biztos, hogy a WebView összemegy tőle (edge-to-edge Android), ezért nem arra hagyatkozunk.
function mvTextKeepVisible() {
  const sel = mv && mv.sel; if (!sel) return;
  const el = (mv.edit && mv.edit.ta) || mvTextElFor(sel.s, sel.it); if (!el) return;
  const sc = $("mv-scroll"), R = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
  const vv = window.visualViewport, visBottom = Math.min(R.bottom, vv ? vv.offsetTop + vv.height : R.bottom);
  const limit = R.top + (visBottom - R.top) * (mv.edit ? 0.5 : 0.85);
  if (r.top < R.top + 60 || r.bottom > limit) sc.scrollTop += r.top - (R.top + 70);
  const scr = $("tab-mat-view"); if (scr) scr.scrollTop = 0;
}

// =====================================================================
//  A PDF SAJÁT SZÖVEGE
//  - Olvasó módban (kéz) átlátszó szövegréteg: hosszan nyomva kijelölhető, a sávból másolás,
//    kiemelés, aláhúzás, áthúzás (a sorokra illesztve).
//  - T eszközzel a PDF szövegére koppintva a sor átírható: az eredeti sort a háttérszínnel
//    kitakarjuk, és ugyanoda, ugyanakkora, hasonló betűvel és színnel kerül a szerkeszthető szöveg.
//    ponytail: a PDF betűkészletét nem használjuk (általában csak a benne lévő betűket tartalmazza, és
//    megnyitásonként más a neve), hanem a legközelebbi rendszerbetűt. A megosztott PDF-ben az eredeti
//    szöveg a takarás alatt megmarad (kereséskor, másoláskor az jön elő).
// =====================================================================
let mvMeasureCv = null;
function mvMeasureCtx() { return (mvMeasureCv = mvMeasureCv || document.createElement("canvas")).getContext("2d"); }
function mvMul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
async function mvTextLoad(sl, page) {
  const cur = mv, n = sl.pg.n;
  const data = await mvTextFor(n, page);
  if (mv !== cur || !sl.rendered) return;
  sl.tdata = data;
  mvSelLayer(sl);
}
// Szövegdarabok oldal-arányos koordinátákban (x, w, fs: a szélességhez; top, base, h: a magassághoz), és sorokba fűzve.
function mvTextParse(tc, vp) {
  const W = vp.width, H = vp.height, raw = [];
  for (const it of tc.items) {
    if (!it.str || !it.transform) continue;
    const tx = mvMul(vp.transform, it.transform);
    if (tx[0] <= 0 || Math.abs(tx[1]) > 0.02 * tx[0]) continue; // ponytail: elforgatott, függőleges szöveg kimarad
    const fs = Math.hypot(tx[2], tx[3]); if (fs < 2) continue;
    const st = tc.styles[it.fontName] || {};
    const asc = Math.min(1.1, Math.max(0.6, st.ascent || 0.8)), desc = Math.max(-0.4, Math.min(0, st.descent || -0.2));
    raw.push({ str: it.str, font: it.fontName, fam: st.fontFamily || "sans-serif", x: tx[4], base: tx[5], top: tx[5] - fs * asc, h: fs * (asc - desc), w: it.width || 0, fs });
  }
  // Sorok: közel azonos alapvonal és betűméret, egymás után következő darabok.
  // A külön darabként álló listajel (•, -, 1.) nem része a sornak: a PDF-ben marad, csak a szöveg szerkeszthető.
  const lines = [], markOnly = /^([•◦▪●○■►‣⁃–—*-]|\d{1,2}[.)]|[a-z][.)])$/u;
  raw.slice().sort((p, q) => p.base - q.base || p.x - q.x).forEach((r) => {
    if (!r.str.trim() && !lines.length) return;
    let ln = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (r.base - l.base > l.fs * 0.4) break;
      if (Math.abs(l.base - r.base) < Math.min(l.fs, r.fs) * 0.35 && Math.max(l.fs, r.fs) / Math.min(l.fs, r.fs) < 1.3
        && r.x > l.x + l.w - l.fs * 0.4 && r.x - (l.x + l.w) < l.fs * 1.2) { ln = l; break; }
    }
    if (!ln) { if (r.str.trim()) lines.push({ ...r, mkOnly: markOnly.test(r.str.trim()) }); return; }
    const gap = r.x - (ln.x + ln.w);
    if (ln.mkOnly) {
      if (!r.str.trim()) return; // a pdf.js a rés helyére szóköz-darabot tesz
      if (gap > ln.fs * 0.25) { Object.assign(ln, { x: r.x, w: r.w, str: r.str, top: r.top, h: r.h, fs: r.fs, font: r.font, fam: r.fam, mk: true, mkOnly: false }); return; }
      ln.mkOnly = false;
    }
    if (gap > ln.fs * 0.15 && !/\s$/.test(ln.str) && !/^\s/.test(r.str)) ln.str += " ";
    ln.str += r.str;
    ln.w = Math.max(ln.w, r.x + r.w - ln.x);
    const top = Math.min(ln.top, r.top), bottom = Math.max(ln.top + ln.h, r.top + r.h);
    ln.top = top; ln.h = bottom - top;
    if (r.fs > ln.fs) { ln.fs = r.fs; ln.font = r.font; ln.fam = r.fam; }
  });
  lines.forEach((l) => { l.str = l.str.replace(/\s+$/, ""); });
  const blocks = mvTextBlocks(lines.filter((l) => l.str));
  const nx = (o) => Object.assign(o, { x: o.x / W, w: o.w / W, fs: o.fs / W, top: o.top / H, base: o.base / H, h: o.h / H });
  lines.forEach(nx);
  blocks.forEach((b) => Object.assign(b, { x: b.x / W, right: b.right / W, pl: b.pl / W, ti: b.ti / W, fs: b.fs / W, top: b.top / H, base: b.base / H, h: b.h / H }));
  return { runs: raw.map(nx), blocks };
}
// Bekezdések felismerése (oldal-egységekben, a normalizálás előtt). Egy blokkba kerülnek az egymás alatti sorok,
// ha azonos a betűméret és -család, egyenletes a sortáv, átfed a vízszintes kiterjedésük, és a bal szél
// (vagy középre igazításnál a közép) stimmel. A behúzott új bekezdés és az új felsorolás-pont ezért külön blokk.
// Kemény sortörés (lista, bekezdés vége): ha a következő sor első szava még kifért volna a sor végére.
function mvTextBlocks(lines) {
  const hard = (prev, next, right) => {
    const fw = (next.str.trim().split(/\s+/)[0] || "").length, cw = next.w / Math.max(1, next.str.length);
    return prev.x + prev.w + cw * (fw + 1) < right - prev.fs * 0.3;
  };
  const open = [], marker = /^\s*([•◦▪●○■►‣⁃–—*-]|\d{1,2}[.)]|[a-z][.)])\s/u;
  lines.slice().sort((p, q) => p.base - q.base || p.x - q.x).forEach((l) => {
    let best = null, bd = Infinity;
    if (!l.mk && !marker.test(l.str)) for (const b of open) { // listajellel kezdődő sor mindig új blokk (új felsorolás-pont)
      const last = b.lines[b.lines.length - 1], fs = last.fs, d = l.base - last.base;
      if (d < fs * 0.85 || d > fs * 1.9 || d >= bd) continue;
      if (Math.max(l.fs, fs) / Math.min(l.fs, fs) > 1.1 || l.fam !== last.fam) continue;
      if (b.lines.length > 1 && Math.abs(d - b.step) > fs * 0.2) continue;
      const ov = Math.min(b.right, l.x + l.w) - Math.max(b.left, l.x);
      if (ov < Math.min(l.w, b.right - b.left) * 0.3) continue;
      const centered = Math.abs(l.x + l.w / 2 - (last.x + last.w / 2)) < fs * 0.6;
      const leftOk = b.lines.length === 1 ? Math.abs(l.x - last.x) < fs * 2 : Math.abs(l.x - b.restX) < fs * 0.5;
      if (!leftOk && !centered) continue;
      best = b; bd = d;
    }
    if (!best) { open.push({ lines: [l], left: l.x, right: l.x + l.w, step: 0, restX: l.x }); return; }
    best.lines.push(l);
    best.left = Math.min(best.left, l.x); best.right = Math.max(best.right, l.x + l.w);
    best.restX = best.lines.length === 2 ? l.x : Math.min(best.restX, l.x);
    best.step = (l.base - best.lines[0].base) / (best.lines.length - 1);
  });
  return open.map((b) => {
    const L = b.lines, n = L.length, fs = L[0].fs, right = b.right, offs = [], soft = [];
    let text = "";
    L.forEach((l, i) => {
      offs.push(text.length); text += l.str;
      if (i === n - 1) return;
      const h = hard(l, L[i + 1], right); soft.push(!h);
      if (h) text += "\n";
      else if (/\p{L}-$/u.test(l.str) && /^\p{Ll}/u.test(L[i + 1].str)) text = text.slice(0, -1); // ponytail: elválasztójel a sor végén = szóelválasztás
      else text += " ";
    });
    const xs = L.map((l) => l.x), spread = (a) => Math.max(...a) - Math.min(...a);
    let al = "";
    if (n > 1 && spread(xs) > fs && spread(L.map((l) => l.x + l.w / 2)) < fs * 0.6) al = "center";
    else if (soft.filter(Boolean).length >= 2 && L.every((l, i) => i === n - 1 || !soft[i] || l.x + l.w > right - fs * 0.3)) al = "justify";
    const firstX = L[0].x, restX = n > 1 && al !== "center" ? Math.min(...xs.slice(1)) : firstX;
    const x = al === "center" ? Math.min(...xs) : Math.min(firstX, restX);
    const top = Math.min(...L.map((l) => l.top)), bottom = Math.max(...L.map((l) => l.top + l.h));
    return { n, text, offs, soft, lines: L, al, x, right, pl: al === "center" ? 0 : restX - x, ti: al === "center" ? 0 : firstX - restX,
      top, h: bottom - top, base: L[0].base, fs, lh: n > 1 ? b.step / fs : 0, font: L[0].font, fam: L[0].fam };
  });
}
// Átlátszó, kijelölhető szövegréteg. A betűméret CSS-változóból számol, így nagyításkor nem kell újraépíteni.
// A vízszintes nyújtást a böngészőben mérjük (a vászon mérése más betűt választhat, és elcsúszott a kijelölés).
function mvSelLayer(sl) {
  if (!sl.selLayer) { sl.selLayer = document.createElement("div"); sl.selLayer.className = "mv-seltext"; sl.el.insertBefore(sl.selLayer, sl.textLayer); }
  const L = sl.selLayer;
  L.style.setProperty("--k", sl.cssW);
  if (L.childElementCount || !sl.tdata || !sl.tdata.runs.length) { mvSearchPaint(sl); return; }
  const runs = sl.tdata.runs;
  L.innerHTML = runs.map((r) => `<span style="left:${(r.x * 100).toFixed(3)}%;top:${(r.top * 100).toFixed(3)}%;font-size:calc(var(--k) * ${r.fs.toFixed(5)}px);font-family:${r.fam}">${esc(r.str)}</span>`).join(" ");
  const spans = [...L.children], widths = spans.map((el) => el.offsetWidth); // egyetlen elrendezés, transzformációtól független
  spans.forEach((el, i) => { const target = runs[i].w * sl.cssW; if (widths[i] > 0 && target > 0) el.style.transform = `scaleX(${(target / widths[i]).toFixed(4)})`; });
  mvSearchPaint(sl);
}
function mvPdfBlockAt(s, q) {
  const d = s.tdata; if (!d) return null;
  const tx = 8 / s.cssW, ty = 8 / s.cssH;
  let best = null, ba = Infinity;
  for (const b of d.blocks) {
    if (q.x < b.x - tx || q.x > b.right + tx || q.y < b.top - ty || q.y > b.top + b.h + ty) continue;
    const area = (b.right - b.x) * b.h; if (area < ba) { ba = area; best = b; }
  }
  return best;
}
function mvCoverAt(s, q) {
  return (mv.doc.items[s.pg.id] || []).find((it) => it.t === "text" && it.cover && q.x >= it.cover.x && q.x <= it.cover.x + it.cover.w && q.y >= it.cover.y && q.y <= it.cover.y + it.cover.h) || null;
}
// A PDF betűkészletének neve alapján a legközelebbi rendszerbetű, vastagság, dőlés.
function mvPdfFont(s, l) {
  let name = "", bold = false, italic = false;
  try { const co = s.page && s.page.commonObjs; if (co && co.has(l.font)) { const f = co.get(l.font); name = String(f.name || "").replace(/^[A-Z]{6}\+/, ""); bold = !!(f.bold || f.black); italic = !!f.italic; } } catch (e) {}
  if (/bold|black|heavy|semibold|demi/i.test(name)) bold = true;
  if (/italic|oblique/i.test(name)) italic = true;
  let f;
  if (/courier|mono|consol/i.test(name) || l.fam === "monospace") f = `"Courier New", "Liberation Mono", monospace`;
  else if ((/times|georgia|garamond|cambria|palatino|minion|antiqua|serif/i.test(name) && !/sans/i.test(name)) || (!name && l.fam === "serif")) f = `"Times New Roman", "Liberation Serif", "Noto Serif", Georgia, serif`;
  else if (/calibri|carlito/i.test(name)) f = `Calibri, Carlito, "Segoe UI", Roboto, Arial, sans-serif`;
  else if (/segoe/i.test(name)) f = `"Segoe UI", Roboto, Arial, sans-serif`;
  else f = `Arial, Helvetica, Arimo, Roboto, sans-serif`;
  return { f, fw: bold ? 700 : 400, fi: italic ? 1 : 0 };
}
// Háttér- és betűszín a kirajzolt oldalból: a keret szélének medián színe a háttér, a tőle legtávolabbi a betű.
function mvSampleColors(s, l) {
  const out = { bg: "#ffffff", fg: "#1b1d22" }, cv = s.pdfCv;
  if (!cv || !cv.width) return out;
  const x = Math.max(0, Math.floor(l.x * cv.width) - 2), y = Math.max(0, Math.floor(l.top * cv.height) - 2);
  const w = Math.min(cv.width - x, Math.ceil(l.w * cv.width) + 4), h = Math.min(cv.height - y, Math.ceil(l.h * cv.height) + 4);
  if (w < 3 || h < 3) return out;
  let d;
  try { d = cv.getContext("2d").getImageData(x, y, w, h).data; } catch (e) { return out; }
  const px = (i) => [d[i], d[i + 1], d[i + 2]], edge = [];
  for (let i = 0; i < w; i++) { edge.push(px(i * 4), px(((h - 1) * w + i) * 4)); }
  for (let j = 0; j < h; j++) { edge.push(px(j * w * 4), px((j * w + w - 1) * 4)); }
  const med = [0, 1, 2].map((k) => edge.map((p) => p[k]).sort((p, q) => p - q)[edge.length >> 1]);
  const dist = (p) => Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]);
  let max = 0;
  for (let i = 0; i < d.length; i += 4) max = Math.max(max, dist(px(i)));
  const hex = (p) => "#" + p.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  out.bg = hex(med);
  if (max > 60) {
    const acc = [0, 0, 0]; let n = 0;
    for (let i = 0; i < d.length; i += 4) { const p = px(i); if (dist(p) > max * 0.75) { acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; n++; } }
    out.fg = hex(acc.map((v) => v / n));
  } else out.fg = med[0] + med[1] + med[2] > 380 ? "#1b1d22" : "#ffffff";
  return out;
}
// Átírás: egy sor vagy egy egész bekezdés. A bekezdés tördelt doboz lesz az eredeti szélességgel, sortávval,
// igazítással és behúzással, így gépeléskor ugyanúgy tördel, mint a PDF.
function mvTextFromPdf(s, b, q) {
  const font = mvPdfFont(s, b), col = mvSampleColors(s, { x: b.x, top: b.top, w: b.right - b.x, h: b.h }), aspect = s.pg.h / s.pg.w;
  const ctx = mvMeasureCtx();
  ctx.font = `${font.fi ? "italic " : ""}${font.fw} 100px ${font.f}`;
  const m = ctx.measureText("Hg");
  const A = m.fontBoundingBoxAscent > 0 ? m.fontBoundingBoxAscent / 100 : 0.92, D = m.fontBoundingBoxDescent >= 0 ? m.fontBoundingBoxDescent / 100 : 0.22;
  // Betűköz, hogy a helyettesítő betűvel is ugyanolyan széles legyen a szöveg. Sorkizártnál csak a
  // természetes szélességű sorokból (bekezdés vége), mert a széthúzott sorok szóközei torzítanának.
  let sw = 0, sn = 0, sc = 0;
  b.lines.forEach((l, i) => {
    if (b.al === "justify" && i < b.n - 1 && b.soft[i]) return;
    sw += l.w; sn += (ctx.measureText(l.str).width / 100) * l.fs; sc += l.str.length;
  });
  let ls = sc > 1 ? Math.max(-0.08, Math.min(0.08, (sw - sn) / b.fs / sc)) : 0;
  if (Math.abs(ls) < 0.01) ls = 0; // elhanyagolható, és a kerekítés miatt egyenetlen betűközt adna
  const lhf = b.n > 1 ? b.lh : 1.25;
  // Az első sor alapvonala maradjon ugyanott. CSS-ben a sordoboz tetejétől: (sortáv - (A + D)) / 2 + A betűméretnyi.
  const y = b.base - (((lhf - (A + D)) / 2 + A) * b.fs) / aspect;
  const px = 1.5 / s.cssW;
  const it = { t: "text", x: b.x, y, ox: b.x, oy: y, s: b.fs, c: col.fg, text: b.text, orig: b.text, f: font.f, fw: font.fw, fi: font.fi, ls: Math.round(ls * 1000) / 1000,
    cover: { x: b.x - px, y: b.top - px / aspect, w: b.right - b.x + 2 * px, h: b.h + (2 * px) / aspect, bg: col.bg } };
  if (b.n > 1) {
    it.bw = (b.right - b.x) * (b.al === "justify" ? 1.004 : 1.02) + 2 / s.cssW;
    it.lh = Math.round(lhf * 1000) / 1000;
    if (b.al) it.al = b.al;
    if (b.pl) it.pl = b.pl;
    if (b.ti) it.ti = b.ti;
  }
  mvTextEdit(s, it, true);
  const ta = mv.edit && mv.edit.ta;
  if (ta && q) { // a kurzor oda, ahová koppintottál: a legközelebbi sor, azon belül arányosan
    let li = 0, bd = Infinity;
    b.lines.forEach((l, i) => { const dd = Math.abs(q.y - (l.top + l.h / 2)); if (dd < bd) { bd = dd; li = i; } });
    const l = b.lines[li], end = li + 1 < b.n ? b.offs[li + 1] : b.text.length;
    const ix = Math.max(b.offs[li], Math.min(end, b.offs[li] + Math.round(((q.x - l.x) / l.w) * l.str.length)));
    ta.setSelectionRange(ix, ix);
  }
}

// ---- Kijelölés sáv (olvasó módban) ----
function mvSelRange() {
  const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0), n = r.commonAncestorContainer, el = n.nodeType === 1 ? n : n.parentElement;
  return el && el.closest && el.closest("#mv-pages") ? r : null;
}
function mvSelBar() {
  let bar = $("mv-selbar");
  const r = mv && mv.tool === "pan" && !mv.pinch && mvSelRange();
  if (!r) { if (bar) bar.remove(); return; }
  const scr = $("tab-mat-view"); if (!scr) return;
  if (!bar) {
    bar = document.createElement("div"); bar.id = "mv-selbar"; bar.className = "mv-tctx mv-selbar";
    const b = (a, label) => `<button type="button" data-sa="${a}">${label}</button>`;
    bar.innerHTML = b("copy", "Másolás") + b("hl", "Kiemelés") + b("ul", "Aláhúzás") + b("st", "Áthúzás");
    bar.addEventListener("pointerdown", (ev) => ev.preventDefault()); // a kijelölés maradjon meg
    bar.querySelectorAll("[data-sa]").forEach((x) => x.onclick = () => mvSelAction(x.dataset.sa));
    scr.appendChild(bar);
  }
  const rect = r.getBoundingClientRect(), sr = scr.getBoundingClientRect();
  // Alá tesszük: fölötte az Android saját kijelölés-menüje jelenik meg.
  let top = rect.bottom - sr.top + 34;
  if (top + bar.offsetHeight > sr.height - 90) top = rect.top - sr.top - bar.offsetHeight - 56;
  bar.style.top = Math.max(70, top) + "px";
  bar.style.left = Math.max(8, Math.min(rect.left - sr.left, sr.width - bar.offsetWidth - 8)) + "px";
}
// Egy sorba eső téglalapok összevonása (a szövegdarabok külön téglalapot adnak).
function mvMergeRects(list) {
  const out = [];
  list.sort((p, q) => p[1] - q[1] || p[0] - q[0]).forEach((r) => {
    const o = out.find((m) => Math.min(m[1] + m[3], r[1] + r[3]) - Math.max(m[1], r[1]) > Math.min(m[3], r[3]) * 0.5 && r[0] - (m[0] + m[2]) < r[3] * 0.8 && m[0] - (r[0] + r[2]) < r[3] * 0.8);
    if (!o) { out.push(r.slice()); return; }
    const x0 = Math.min(o[0], r[0]), y0 = Math.min(o[1], r[1]), x1 = Math.max(o[0] + o[2], r[0] + r[2]), y1 = Math.max(o[1] + o[3], r[1] + r[3]);
    o[0] = x0; o[1] = y0; o[2] = x1 - x0; o[3] = y1 - y0;
  });
  return out;
}
async function mvSelAction(a) {
  const r = mvSelRange(); if (!r) return;
  const sel = window.getSelection();
  if (a === "copy") {
    const t = sel.toString().replace(/[ \t]+/g, " ").trim();
    try { await navigator.clipboard.writeText(t); } catch (e) { try { document.execCommand("copy"); } catch (e2) {} }
    toast("Kimásolva.");
  } else {
    const byPage = new Map();
    for (const q of r.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      const sl = mv.slots.find((x) => { const b = x.el.getBoundingClientRect(); return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom; });
      if (!sl) continue;
      const b = sl.el.getBoundingClientRect();
      if (!byPage.has(sl)) byPage.set(sl, []);
      byPage.get(sl).push([(q.left - b.left) / b.width, (q.top - b.top) / b.height, q.width / b.width, q.height / b.height]);
    }
    const hp = mvPrefs().hl;
    for (const [sl, list] of byPage) {
      const item = { t: "mark", k: a, c: a === "hl" ? hp.c : "#c62f2f", a: a === "hl" ? Math.min(0.5, hp.a) : 1,
        rects: mvMergeRects(list).map((v) => v.map((x) => Math.round(x * 10000) / 10000)) };
      const arr = (mv.doc.items[sl.pg.id] = mv.doc.items[sl.pg.id] || []);
      arr.push(item); mvPush({ type: "add", page: sl.pg.id, item }); mvDrawInk(sl);
    }
    if (byPage.size) mvSave();
  }
  sel.removeAllRanges();
  mvSelBar();
}

// ---- Olvasó és szerkesztő mód ----
// Megnyitáskor olvasó mód (nincs eszköztár, nem lehet véletlenül beleírni). Jobb fent: ceruza = szerkesztés,
// szem = vissza olvasásra. Olvasó módban: kereső, megosztás; szerkesztőben: új oldal, megosztás.
function mvRenderHeader() {
  const share = $("mv-share"), add = $("mv-addpage"); if (!share || !mv) return;
  const mk = (id, after) => {
    let b = $(id);
    if (!b) { b = document.createElement("button"); b.id = id; b.type = "button"; b.className = "iconbtn plain"; after.insertAdjacentElement("afterend", b); }
    return b;
  };
  const find = mk("mv-find", add), mode = mk("mv-mode", share); // sorrend: új oldal, keresés, megosztás, mód
  const toc = mk("mv-toc", add); // tartalom és jegyzetek (a keresés elé kerül)
  const read = mv.mode === "read";
  toc.innerHTML = icon("toc"); toc.title = "Tartalom és jegyzetek"; toc.setAttribute("aria-label", toc.title);
  toc.style.display = read ? "" : "none";
  share.style.display = read ? "none" : ""; // olvasás közben a fejléc a címé; megosztás szerkesztő módban és a könyv ⋯ menüjében
  toc.onclick = () => openMatToc();
  find.innerHTML = icon("search"); find.title = "Keresés a PDF-ben"; find.setAttribute("aria-label", "Keresés a PDF-ben");
  find.style.display = read && mv.m.kind === "pdf" ? "" : "none";
  add.style.display = read ? "none" : "";
  mode.innerHTML = icon(read ? "pencil" : "eye");
  mode.title = read ? "Szerkesztés" : "Olvasó mód"; mode.setAttribute("aria-label", mode.title);
  find.onclick = () => mvSearchOpen();
  mode.onclick = () => mvSetMode(read ? "edit" : "read");
}
function mvSetMode(m) {
  if (!mv) return;
  mvTextFinish();
  mv.mode = m;
  if (m === "read") { if (mv.tool !== "pan") mv.lastTool = mv.tool; mv.tool = "pan"; mv.popOpen = false; }
  else {
    mvSearchClose();
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    mv.tool = mv.lastTool || "pen";
  }
  mvApplyToolClass(); mvRenderHeader(); mvRenderBar(); mvRenderPop(); mvRenderTextCtx(); mvSelBar(); mvPill();
}

// ---- Keresés a PDF szövegében ----
// Kis- és nagybetű, valamint ékezet nélkül is talál ("statisztika" = "Statisztika", "fuggveny" = "függvény").
// A találatok a kijelölő réteg betűire illesztve jelennek meg, az aktuális erősebben.
function mvTextFor(n, page) {
  const cur = mv;
  if (!cur.tcache[n]) cur.tcache[n] = (page ? Promise.resolve(page) : cur.pdf.getPage(n))
    .then((p) => p.getTextContent().then((tc) => mvTextParse(tc, p.getViewport({ scale: 1 }))))
    .catch(() => ({ runs: [], blocks: [] }));
  return cur.tcache[n];
}
function mvFold(c) { return c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(); }
// Oldalszöveg a kereséshez: összefűzött, egyszerűsített szöveg, és minden karakteréhez a [darab, karakter] helye.
function mvSearchIndex(data) {
  if (data.idx) return data.idx;
  let str = ""; const map = [];
  data.runs.forEach((r, ri) => {
    const prev = data.runs[ri - 1];
    if (prev && Math.abs(prev.base - r.base) > 0.002 && str && !str.endsWith(" ")) { str += " "; map.push(null); } // sorváltás = szóköz
    for (let ci = 0; ci < r.str.length; ci++) {
      const c = r.str[ci];
      if (/\s/.test(c)) { if (str && !str.endsWith(" ")) { str += " "; map.push([ri, ci]); } continue; }
      for (const f of mvFold(c)) { str += f; map.push([ri, ci]); }
    }
  });
  return (data.idx = { str, map });
}
function mvSearchOpen() {
  if (!mv || !mv.pdf) return;
  let bar = $("mv-searchbar");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "mv-searchbar"; bar.className = "mv-searchbar";
    bar.innerHTML = `<input type="search" id="mv-q" placeholder="Keresés a PDF-ben" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Keresés a PDF-ben">`
      + `<span class="mv-scount" id="mv-scount" aria-live="polite"></span>`
      + `<button class="iconbtn plain" type="button" data-sq="prev" aria-label="Előző találat" title="Előző">${icon("up")}</button>`
      + `<button class="iconbtn plain" type="button" data-sq="next" aria-label="Következő találat" title="Következő">${icon("down")}</button>`
      + `<button class="iconbtn plain" type="button" data-sq="close" aria-label="Keresés bezárása" title="Bezárás">${icon("x")}</button>`;
    const sc = $("mv-scroll"); sc.parentNode.insertBefore(bar, sc);
    const inp = $("mv-q");
    inp.addEventListener("input", () => { clearTimeout(mv.searchT); mv.searchT = setTimeout(() => mvSearchRun(inp.value), 220); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const S = mv.search; if (S && S.q === inp.value) mvSearchGo(S.cur + (e.shiftKey ? -1 : 1)); else mvSearchRun(inp.value); } });
    bar.querySelectorAll("[data-sq]").forEach((b) => b.onclick = () => {
      const S = mv && mv.search, a = b.dataset.sq;
      if (a === "close") return mvSearchClose();
      if (S && S.hits.length) mvSearchGo(S.cur + (a === "next" ? 1 : -1));
    });
  }
  mv.search = mv.search || { q: "", hits: [], cur: -1, done: true };
  mvSearchStatus();
  const inp = $("mv-q"); try { inp.focus(); inp.select(); } catch (e) {}
}
function mvSearchClose() {
  const bar = $("mv-searchbar"); if (bar) bar.remove();
  if (!mv) return;
  mv.search = null;
  mv.slots.forEach((sl) => mvSearchPaint(sl));
}
async function mvSearchRun(q) {
  const cur = mv; if (!cur || !cur.search) return;
  const S = cur.search, token = {};
  const qq = [...q.trim()].map((c) => (/\s/.test(c) ? " " : mvFold(c))).join("").replace(/ +/g, " ");
  Object.assign(S, { q, token, hits: [], cur: -1, done: !qq });
  cur.slots.forEach((sl) => mvSearchPaint(sl));
  mvSearchStatus();
  if (!qq) return;
  for (let i = 0; i < cur.doc.pages.length; i++) {
    const pg = cur.doc.pages[i]; if (pg.kind !== "pdf") continue;
    const data = await mvTextFor(pg.n);
    if (mv !== cur || cur.search !== S || S.token !== token) return;
    const { str, map } = mvSearchIndex(data);
    for (let at = str.indexOf(qq); at >= 0; at = str.indexOf(qq, at + qq.length)) {
      const parts = new Map();
      for (let k = at; k < at + qq.length; k++) { const m = map[k]; if (!m) continue; const p = parts.get(m[0]); if (!p) parts.set(m[0], [m[1], m[1] + 1]); else p[1] = m[1] + 1; }
      const list = [...parts].map(([ri, [a, b]]) => ({ ri, a, b })), r = data.runs[list[0].ri];
      S.hits.push({ i, parts: list, x: r.x + (r.w * list[0].a) / Math.max(1, r.str.length), y: r.top });
    }
    if (S.cur < 0 && S.hits.length) mvSearchGo(0); // az első találatra rögtön odaugrik
    else { mvSearchStatus(); const sl = cur.slots[i]; if (sl) mvSearchPaint(sl); }
  }
  S.done = true; mvSearchStatus();
}
function mvSearchGo(k) {
  const S = mv && mv.search; if (!S || !S.hits.length) return;
  S.cur = (k + S.hits.length) % S.hits.length;
  const h = S.hits[S.cur], sl = mv.slots[h.i]; if (!sl) return;
  const sc = $("mv-scroll"), b = sl.el.getBoundingClientRect(), R = sc.getBoundingClientRect();
  sc.scrollTop += b.top + h.y * b.height - (R.top + R.height * 0.35);
  if (mv.z > 1.001) sc.scrollLeft += b.left + h.x * b.width - (R.left + R.width * 0.3);
  mvSearchStatus();
  mv.slots.forEach((x) => mvSearchPaint(x));
}
function mvSearchStatus() {
  const el = $("mv-scount"), S = mv && mv.search; if (!el || !S) return;
  const n = S.hits.length;
  el.textContent = !S.q.trim() ? "" : n ? `${S.cur + 1} / ${n}${S.done ? "" : "…"}` : S.done ? "Nincs találat" : "Keresés…";
  document.querySelectorAll("#mv-searchbar [data-sq=prev], #mv-searchbar [data-sq=next]").forEach((b) => { b.disabled = !n; });
}
// Kiemelések egy oldalon: a kijelölő réteg betűiből mérve (pontos), ezért csak kirajzolt oldalon.
function mvSearchPaint(sl) {
  const S = mv && mv.search, ix = +sl.el.dataset.ix;
  const hits = S ? S.hits.filter((h) => h.i === ix) : [];
  if (!hits.length || !sl.selLayer || !sl.selLayer.childElementCount) { if (sl.hitLayer) sl.hitLayer.innerHTML = ""; return; }
  if (!sl.hitLayer) { sl.hitLayer = document.createElement("div"); sl.hitLayer.className = "mv-hits"; sl.el.insertBefore(sl.hitLayer, sl.textLayer); }
  const b = sl.el.getBoundingClientRect(), spans = sl.selLayer.children, pc = (v) => (v * 100).toFixed(3) + "%";
  let html = "";
  for (const h of hits) {
    const on = S.hits[S.cur] === h ? ' class="on"' : "";
    for (const p of h.parts) {
      const t = spans[p.ri] && spans[p.ri].firstChild; if (!t) continue;
      const rg = document.createRange(); rg.setStart(t, Math.min(p.a, t.length)); rg.setEnd(t, Math.min(p.b, t.length));
      for (const q of rg.getClientRects()) html += `<i${on} style="left:${pc((q.left - b.left) / b.width)};top:${pc((q.top - b.top) / b.height)};width:${pc(q.width / b.width)};height:${pc(q.height / b.height)}"></i>`;
    }
  }
  sl.hitLayer.innerHTML = html;
}

// ---- Eszköztár és beállítások ----
function mvRenderBar() {
  const bar = $("mv-bar"); if (!bar) return;
  if (!mv || mv.mode === "read") { bar.innerHTML = ""; mvRenderQuick(); return; } // olvasó módban nincs eszköztár
  const t = mv.tool;
  const btn = (id, ic, label, on, dis, cls) => `<button class="mv-tool${on ? " on" : ""}${cls || ""}" data-mv="${id}" type="button" aria-label="${label}" title="${label}"${dis ? " disabled" : ""}>${icon(ic)}</button>`;
  bar.innerHTML = btn("pan", "hand", "Olvasás és görgetés", t === "pan") + btn("pen", "pencil", "Toll", t === "pen") + btn("hl", "marker", "Kiemelő", t === "hl")
    + btn("eraser", "eraser", "Radír", t === "eraser") + btn("text", "text", "Szöveg", t === "text")
    + `<span class="mv-sep"></span>`
    + btn("undo", "undo", "Visszavonás", false, !mv.undo.length) + btn("redo", "undo", "Újra", false, !mv.redo.length, " mv-redo");
  bar.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => mvAction(b.dataset.mv));
  mvRenderQuick();
}
// Gyorsválasztó: 4 szín és 3 méret egy koppintásra, a ⋯ nyitja a részletes beállítást.
function mvRenderQuick() {
  let q = $("mv-quick");
  const bar = $("mv-bar"); if (!bar) return;
  if (!q) { q = document.createElement("div"); q.id = "mv-quick"; q.className = "mv-quick"; bar.insertAdjacentElement("beforebegin", q); }
  const t = mv && mv.tool, cfg = MV_QUICK[t];
  if (!cfg || mv.popOpen || (t === "text" && mv.sel)) { q.innerHTML = ""; q.classList.add("hidden"); return; }
  const p = mvPrefs()[t], cur = Math.round(p[cfg.k] * MV_REF * 10) / 10;
  const colors = cfg.colors.includes(p.c) ? cfg.colors : cfg.colors.concat(p.c);
  const near = cfg.sizes.reduce((best, v) => Math.abs(v - cur) < Math.abs(best - cur) ? v : best, cfg.sizes[0]);
  const names = ["Vékony", "Közepes", "Vastag"];
  q.innerHTML = colors.map((c) => `<button class="mv-qc${c === p.c ? " on" : ""}" data-qc="${c}" type="button" aria-label="Szín"><span style="background:${c}"></span></button>`).join("")
    + `<span class="mv-sep"></span>`
    + cfg.sizes.map((v, i) => `<button class="mv-qs${v === near ? " on" : ""}" data-qs="${v}" type="button" aria-label="${names[i]}">`
      + (cfg.k === "s" ? `<span class="mv-qa" style="font-size:${12 + i * 4}px">A</span>` : `<span class="mv-qd" style="width:${5 + i * 5}px;height:${5 + i * 5}px"></span>`) + `</button>`).join("")
    + `<button class="mv-qs" data-qmore="1" type="button" aria-label="További beállítások">${icon("more")}</button>`;
  q.classList.remove("hidden");
  q.querySelectorAll("[data-qc]").forEach((b) => b.onclick = () => { p.c = b.dataset.qc; saveState(); mvRenderQuick(); });
  q.querySelectorAll("[data-qs]").forEach((b) => b.onclick = () => { p[cfg.k] = +b.dataset.qs / MV_REF; saveState(); mvRenderQuick(); });
  q.querySelector("[data-qmore]").onclick = () => { mv.popOpen = true; mvRenderPop(); mvRenderQuick(); };
}
// Beállító panel az eszköztár fölött: szín, vastagság, átlátszóság (szövegnél betűméret az ÚJ dobozokhoz).
function mvRenderPop() {
  const pop = $("mv-pop"); if (!pop) return;
  const t = mv && mv.tool;
  if (!mv || !mv.popOpen || !["pen", "hl", "text"].includes(t)) { pop.classList.add("hidden"); return; }
  const p = mvPrefs()[t];
  const title = { pen: "Toll", hl: "Kiemelő", text: "Szöveg (új dobozokhoz)" }[t];
  const px = (v) => Math.round(v * MV_REF * 10) / 10;
  let h = `<div class="mv-pop-title">${title}</div><div class="mv-swatches">`
    + MV_PALETTE.map((c) => `<button class="mv-sw${c === p.c ? " on" : ""}" data-c="${c}" type="button" style="background:${c}" aria-label="Szín ${c}"></button>`).join("") + `</div>`;
  if (t === "text") {
    h += `<label class="mv-range"><span>Betűméret</span><input type="range" data-k="s" min="8" max="56" step="1" value="${px(p.s)}"><b data-v="s">${Math.round(px(p.s))} px</b></label>`
      + `<div class="mv-prev mv-prev-text" style="color:${p.c};font-size:${Math.min(28, px(p.s))}px">Minta szöveg</div>`;
  } else {
    const wmin = t === "hl" ? 1.5 : 0.3, wmax = t === "hl" ? 40 : 14;
    h += `<label class="mv-range"><span>Vastagság</span><input type="range" data-k="w" min="${wmin}" max="${wmax}" step="0.1" value="${px(p.w)}"><b data-v="w">${px(p.w)} px</b></label>`
      + `<label class="mv-range"><span>Átlátszatlanság</span><input type="range" data-k="a" min="10" max="100" step="5" value="${Math.round(p.a * 100)}"><b data-v="a">${Math.round(p.a * 100)}%</b></label>`
      + `<div class="mv-prev"><span style="height:${Math.max(1, px(p.w))}px;background:${p.c};opacity:${p.a}"></span></div>`;
  }
  pop.innerHTML = h;
  pop.classList.remove("hidden");
  pop.querySelectorAll(".mv-sw").forEach((b) => b.onclick = () => { p.c = b.dataset.c; saveState(); mvRenderPop(); });
  pop.querySelectorAll("input[type=range]").forEach((inp) => inp.oninput = () => {
    const k = inp.dataset.k, v = +inp.value;
    if (k === "a") p.a = v / 100; else p[k] = v / MV_REF;
    const lbl = pop.querySelector(`[data-v="${k}"]`); if (lbl) lbl.textContent = k === "a" ? v + "%" : (k === "s" ? Math.round(v) : v) + " px";
    const pv = pop.querySelector(".mv-prev span"); if (pv) { pv.style.height = Math.max(1, px(p.w)) + "px"; pv.style.opacity = p.a; }
    const tv = pop.querySelector(".mv-prev-text"); if (tv) tv.style.fontSize = Math.min(28, px(p.s)) + "px";
    saveState();
  });
}
function mvAction(a) {
  if (!mv) return;
  if (["pan", "pen", "hl", "eraser", "text"].includes(a)) {
    // Az aktív rajzeszközre újra koppintva nyílik/csukódik a beállító panel.
    if (a === mv.tool && ["pen", "hl", "text"].includes(a)) mv.popOpen = !mv.popOpen;
    else {
      mv.popOpen = false; if (mv.tool === "text" && a !== "text") mvTextFinish();
      if (a !== "pan") { try { window.getSelection().removeAllRanges(); } catch (e) {} }
      const pr = mvPrefs();
      if (a === "text" && !pr.hintText) { pr.hintText = 1; saveState(); toast("Koppints a PDF szövegére az átíráshoz, vagy üres helyre új szöveghez."); }
    }
    mv.tool = a; mvApplyToolClass();
    mvRenderBar(); mvRenderPop(); mvRenderTextCtx(); return;
  }
  if (a === "undo") return mvUndo();
  if (a === "redo") return mvRedo();
  if (!mv.doc) return;
  if (a === "addpage") return mvAddPage(mvVisibleIx());
  if (a === "share") { mvTextCommit(); return matSharePdf(mv.id); }
}

// ---- Oldalak kezelése ----
// A képernyő közepéhez legközelebbi oldal indexe.
function mvVisibleIx() {
  const scroll = $("mv-scroll"), mid = scroll.getBoundingClientRect().top + scroll.clientHeight / 2;
  let ix = mv.slots.length - 1, best = Infinity;
  mv.slots.forEach((s, i) => { const r = s.el.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < best) { best = d; ix = i; } });
  return ix;
}
// Csak a PDF-listát görgetjük (a scrollIntoView a teljes képernyőt is elgörgette, és eltűnt a fejléc).
function mvScrollToPage(ix, instant) {
  const scroll = $("mv-scroll"), s = mv && mv.slots[ix]; if (!s) return;
  const top = scroll.scrollTop + s.sheet.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 4;
  scroll.scrollTo({ top: Math.max(0, top), behavior: instant ? "auto" : "smooth" });
}
// Új üres oldal a megadott oldal UTÁN, annak méretével.
function mvAddPage(ix) {
  const ref = mv.doc.pages[ix] || MAT_A4;
  const pg = { id: "b" + uid(), kind: "blank", w: ref.w || MAT_A4.w, h: ref.h || MAT_A4.h, bg: (ref.kind === "blank" && ref.bg) || mvPrefs().pageBg || "plain" };
  mv.doc.pages.splice(ix + 1, 0, pg);
  mvPush({ type: "addPage", index: ix + 1, page: pg });
  mvSave(); mvLayout();
  setTimeout(() => mvScrollToPage(ix + 1), 50);
  toast("Új oldal beszúrva a(z) " + (ix + 1) + ". oldal után.");
}
async function mvDeletePage(ix) {
  const pages = mv.doc.pages, pg = pages[ix]; if (!pg) return;
  if (pages.length <= 1) { toast("Az utolsó oldalt nem lehet törölni."); return; }
  const items = mv.doc.items[pg.id];
  const warn = pg.kind === "pdf"
    ? "Ez az eredeti PDF egyik oldala. Maga a fájl nem változik, később a menüből vissza is hozható."
    : (items && items.length ? "A rajta lévő jegyzetek is törlődnek." : "Üres oldal.");
  const ok = await ask({ title: `A(z) ${ix + 1}. oldal törlése`, okText: "Törlés", cancelText: "Mégse", danger: true, body: `${warn}<br><br>Amíg nyitva van az anyag, a Visszavonás gombbal visszahozható.` });
  if (!ok || !mv) return;
  if (mv.sel && mv.sel.s.pg.id === pg.id) mv.sel = null;
  pages.splice(ix, 1); delete mv.doc.items[pg.id];
  mvPush({ type: "delPage", index: ix, page: pg, items });
  mvSave(); mvLayout();
  toast("Oldal törölve.");
}
// Az eredeti PDF azon oldalai, amik már nincsenek a nézetben (a fájlban megvannak).
function mvMissingPdfPages() {
  if (!mv || !mv.pdf) return [];
  const have = new Set(mv.doc.pages.filter((p) => p.kind === "pdf").map((p) => p.n)), out = [];
  for (let n = 1; n <= mv.pdf.numPages; n++) if (!have.has(n)) out.push(n);
  return out;
}
async function mvRestorePdfPages() {
  const miss = mvMissingPdfPages(); if (!miss.length) return;
  for (const n of miss) {
    let at = 0; // az utolsó olyan oldal után, aminek kisebb a PDF-beli sorszáma
    mv.doc.pages.forEach((p, i) => { if (p.kind === "pdf" && p.n < n) at = i + 1; });
    const v = (await mv.pdf.getPage(n)).getViewport({ scale: 1 });
    mv.doc.pages.splice(at, 0, { id: "p" + n, kind: "pdf", n, w: v.width, h: v.height });
  }
  mv.undo = []; mv.redo = []; // ponytail: a visszaállítás után a visszavonási lista törlődik (a korábbi oldal-indexek elcsúsznának)
  mvSave(); mvLayout(); mvRenderBar();
  toast(miss.length + " eredeti oldal visszaállítva.");
}
async function mvPageMenu(ix) {
  if (!mv || !mv.doc) return;
  mvTextFinish();
  const miss = mvMissingPdfPages(), pg = mv.doc.pages[ix], only = mv.doc.pages.length <= 1;
  const list = miss.slice(0, 6).join(", ") + (miss.length > 6 ? "…" : "");
  const opts = [{ icon: "note", label: "Jegyzet ehhez az oldalhoz", sub: "Rövid megjegyzés, az oldal fölött látszik", value: "note" },
    { icon: "plus", label: "Új üres oldal ez után", sub: "Ugyanakkora, mint ez az oldal", value: "add" }];
  if (pg && pg.kind === "blank") opts.push({ icon: "grid", label: "Oldal háttere", sub: MV_BG_NAMES[pg.bg || "plain"], value: "bg" });
  if (miss.length) opts.push({ icon: "refresh", label: miss.length === 1 ? "Törölt eredeti oldal visszaállítása" : "Törölt eredeti oldalak visszaállítása",
    sub: (miss.length === 1 ? "Az eredeti PDF " : "Az eredeti PDF oldalai: ") + list + (miss.length === 1 ? ". oldala" : ""), value: "restore" });
  opts.push({ icon: "trash", label: "Oldal törlése", danger: true, disabled: only, sub: only ? "Az egyetlen oldal nem törölhető" : "Visszavonással visszahozható", value: "del" });
  const kind = pg && pg.kind === "blank" ? "Saját oldal" : "PDF-oldal";
  const act = await askPick({ title: (ix + 1) + ". oldal", body: `<div class="hint">${kind} · ${mv.doc.pages.length} oldalból</div>`, options: opts });
  if (!mv) return;
  if (act === "note") mvNoteEdit(pg.id, null);
  else if (act === "add") mvAddPage(ix);
  else if (act === "del") mvDeletePage(ix);
  else if (act === "restore") mvRestorePdfPages();
  else if (act === "bg") mvPageBgMenu(ix);
}

// ---- Saját oldalak háttere: sima, vonalas, kockás ----
// A minta a lap szélességéhez arányos (vonalköz 8 mm, kocka 5 mm egy A4-es lapon), így nagyítva és a megosztott
// PDF-ben is ugyanott vannak a vonalak. A megjelenítőben az oldal (egyébként üres) PDF-vásznára rajzolódik.
const MV_BG_NAMES = { plain: "Sima", lines: "Vonalas", grid: "Kockás" };
const MV_BG_STEP = { lines: 8 / 210, grid: 5 / 210 };
function mvPageLabel(pg, i) {
  if (pg.kind !== "blank") return `${i + 1}. oldal`;
  return `${i + 1}. oldal · saját oldal${pg.bg && pg.bg !== "plain" ? " · " + MV_BG_NAMES[pg.bg].toLowerCase() : ""}`;
}
// A minta vonalai: [x0, y0, x1, y1] a lap szélességének arányában (y is szélesség-egységben, lefelé).
function mvPatternLines(bg, aspect) {
  const st = MV_BG_STEP[bg], out = []; if (!st) return out;
  for (let y = bg === "lines" ? st * 2 : st; y < aspect; y += st) out.push([0, y, 1, y]);
  if (bg === "grid") for (let x = st; x < 1; x += st) out.push([x, 0, x, aspect]);
  return out;
}
function mvPaintBlank(sl, W, H) {
  const bg = sl.pg.bg || "plain", cv = sl.pdfCv;
  if (!MV_BG_STEP[bg]) { if (cv.width) { cv.width = 0; cv.height = 0; } return; }
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"), lw = Math.max(1, Math.round(W / 700));
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bg === "lines" ? "#c5cfdc" : "#d9e0e8";
  for (const [x0, y0, x1, y1] of mvPatternLines(bg, H / W)) {
    if (y0 === y1) ctx.fillRect(0, Math.round(y0 * W - lw / 2), W, lw);
    else ctx.fillRect(Math.round(x0 * W - lw / 2), 0, lw, H);
  }
}
function mvBgRefresh() {
  mv.slots.forEach((sl, i) => {
    if (sl.pg.kind !== "blank") return;
    const lab = sl.sheet.querySelector(".mv-plabel"); if (lab) lab.textContent = mvPageLabel(sl.pg, i);
    if (sl.rendered) sl.stale = true;
  });
  mvSchedule();
}
async function mvPageBgMenu(ix) {
  const pg = mv.doc.pages[ix]; if (!pg) return;
  const cur = pg.bg || "plain";
  const bg = await askPick({ title: "Oldal háttere", body: `<div class="hint">${ix + 1}. oldal</div>`,
    options: Object.keys(MV_BG_NAMES).map((k) => ({ label: MV_BG_NAMES[k], sub: k === cur ? "Jelenlegi" : "", value: k })) });
  if (!bg || !mv) return;
  const blanks = mv.doc.pages.filter((p) => p.kind === "blank");
  let targets = [pg];
  if (blanks.length > 1) {
    const scope = await askPick({ title: MV_BG_NAMES[bg] + " háttér", options: [
      { label: "Csak erre az oldalra", sub: (ix + 1) + ". oldal", value: "one" },
      { label: "Az összes saját oldalra", sub: blanks.length + " oldal", value: "all" }] });
    if (!scope || !mv) return;
    if (scope === "all") targets = blanks;
  }
  const list = targets.filter((p) => (p.bg || "plain") !== bg).map((p) => ({ pg: p, bg: p.bg || "plain" }));
  mvPrefs().pageBg = bg; saveState(); // az új oldalak is ilyenek lesznek
  if (!list.length) return;
  list.forEach((e) => { e.pg.bg = bg; });
  mvPush({ type: "bg", list });
  mvSave(); mvBgRefresh();
  toast(list.length === 1 ? `Háttér: ${MV_BG_NAMES[bg].toLowerCase()}.` : `Háttér: ${MV_BG_NAMES[bg].toLowerCase()}, ${list.length} oldalon.`);
}

// ---- Két ujjal: nagyítás és mozgatás (minden eszközzel, így rajzolás közben sem kell a kézre váltani) ----
// Gesztus közben csak CSS-transzformáció (gyors), elengedéskor valódi méretezés, és az ujjak alatti pont
// pontosan ott marad, ahol a gesztus végén volt.
// A képernyőpont alatti tartalom: oldal indexe + oldalon belüli arány (a lapok közti résre a legközelebbi oldal).
function mvPointAt(x, y) {
  let best = null, bd = Infinity;
  mv.slots.forEach((sl, i) => {
    const b = sl.el.getBoundingClientRect(), d = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
    if (d < bd) { bd = d; best = { i, u: (x - b.left) / b.width, v: (y - b.top) / b.height }; }
  });
  return best;
}
function mvSetZoom(z, focus, pt) {
  const scroll = $("mv-scroll"); if (!mv || !mv.doc) return;
  z = Math.max(MV_ZMIN, Math.min(MV_ZMAX, z));
  const r = scroll.getBoundingClientRect();
  const fx = focus ? focus.x : r.left + scroll.clientWidth / 2, fy = focus ? focus.y : r.top + scroll.clientHeight / 2;
  pt = pt || mvPointAt(fx, fy);
  mv.z = z; mvLayout({ pt, fx, fy }); mvRenderBar();
}
function mvWirePinch(scroll) {
  const pages = $("mv-pages");
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const midpt = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
  const reset = () => { pages.style.transform = ""; pages.style.transformOrigin = ""; pages.style.willChange = ""; };
  scroll.addEventListener("touchstart", (ev) => {
    if (!mv || !mv.doc || mv.edit) return;
    const fingers = [...ev.touches].filter((t) => t.touchType !== "stylus"); // az S Pen is küld érintést
    if (fingers.length !== 2 || fingers.length !== ev.touches.length) return;
    const d = mv.draw;
    // Ha a vonás már elindult (több mint 250 ms vagy 16 px), a második érintés tenyér vagy véletlen: rajzolunk tovább.
    if (d && (d.item || d.removed) && (d.pt === "pen" || ev.timeStamp - d.t0 > 250 || d.len > 16)) return;
    mv.draw = null; mv.tapDown = null;
    if (d && d.item) mvLiveEnd(d); // félbehagyott vonás eldobása
    const m = midpt(ev.touches), pr = pages.getBoundingClientRect();
    mv.pinch = { d0: dist(ev.touches), k: 1, m0: m, m, pt: mvPointAt(m.x, m.y) };
    pages.style.transformOrigin = (m.x - pr.left) + "px " + (m.y - pr.top) + "px";
    pages.style.willChange = "transform";
  }, { passive: true });
  scroll.addEventListener("touchmove", (ev) => {
    const p = mv && mv.pinch; if (!p || ev.touches.length !== 2) return;
    // ponytail: ha a böngésző már görget (egy ujjal kezdett görgetéshez jött a második), nem vesszük át a gesztust
    if (!ev.cancelable) { mv.pinch = null; reset(); return; }
    ev.preventDefault();
    p.k = Math.max(MV_ZMIN / mv.z, Math.min(MV_ZMAX / mv.z, dist(ev.touches) / p.d0));
    p.m = midpt(ev.touches);
    pages.style.transform = `translate(${p.m.x - p.m0.x}px, ${p.m.y - p.m0.y}px) scale(${p.k})`;
  }, { passive: false });
  const end = (ev) => {
    const p = mv && mv.pinch; if (!p || ev.touches.length >= 2) return;
    mv.pinch = null;
    reset();
    if (Math.abs(p.k - 1) > 0.02) mvSetZoom(mv.z * p.k, p.m, p.pt);
    else { scroll.scrollLeft -= p.m.x - p.m0.x; scroll.scrollTop -= p.m.y - p.m0.y; mvSchedule(); }
  };
  scroll.addEventListener("touchend", end);
  scroll.addEventListener("touchcancel", end);
}

// ---- Megosztás jegyzetekkel (új PDF, az eredeti érintetlen) ----
// A jegyzetréteg oldalanként átlátszó PNG-ként kerül a PDF-re: így az ékezetes szöveg és a kiemelő
// átlátszósága is pontosan megmarad, a PDF saját szövege pedig vektoros marad.
async function matSharePdf(id) {
  const m = matById(id); if (!m) return;
  showBusy("PDF készítése…");
  try {
    const blob = await matBuildPdf(id);
    hideBusy();
    await matShareBlob(blob, slugName(m.title) + ".pdf", "application/pdf", "PDF");
  } catch (e) { hideBusy(); await ask({ title: "Nem sikerült a PDF", okText: "OK", body: esc(String(e && e.message || e)) }); }
}
// A PDF a jegyzetekkel együtt (Blob). Ha nincs rajta semmi módosítás, az eredeti fájl megy (gyors, kisebb).
async function matBuildPdf(id) {
  const m = matById(id); if (!m) throw new Error("Az anyag már nincs meg.");
  const doc = (mv && mv.id === id && mv.doc) || await matGetDoc(id);
  if (m.kind === "pdf" && doc) {
    const untouched = doc.pages.every((p, i) => p.kind === "pdf" && p.n === i + 1) && !Object.values(doc.items || {}).some((a) => a && a.length);
    const orig = await matGetFile(id);
    if (untouched && orig) { // a végéről törölt oldal is "érintetlennek" tűnne: az oldalszámot a fájlból ellenőrizzük
      let n = 0; try { const d = await (await matPdfjs()).getDocument(matPdfOpts(new Uint8Array(await orig.arrayBuffer()))).promise; n = d.numPages; d.destroy(); } catch (e) {}
      if (n === doc.pages.length) return orig;
    }
  }
  {
    const PDFLib = await matScript("lib/pdf-lib.min.js", "PDFLib");
    const out = await PDFLib.PDFDocument.create();
    let src = null, pdfjsDoc = null;
    if (m.kind === "pdf") {
      const bytes = new Uint8Array(await (await matGetFile(id)).arrayBuffer());
      src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    // Az oldalakat EGYETLEN copyPages hívással másoljuk: így a közös betűtípusok és képek egyszer kerülnek át.
    // (Oldalanként másolva egy 3 MB-os, 250 oldalas könyvből 60 MB lett.)
    const flat = src ? doc.pages.filter((pg) => pg.kind === "pdf" && src.getPage(pg.n - 1).getRotation().angle % 360 === 0) : [];
    const copied = flat.length ? await out.copyPages(src, flat.map((pg) => pg.n - 1)) : [];
    const copiedOf = new Map(flat.map((pg, k) => [pg, copied[k]]));
    for (let i = 0; i < doc.pages.length; i++) {
      $("busy-text").textContent = "PDF készítése… " + (i + 1) + " / " + doc.pages.length;
      const pg = doc.pages[i], items = doc.items[pg.id] || [];
      let page;
      if (pg.kind === "pdf" && src) {
        const rot = src.getPage(pg.n - 1).getRotation().angle % 360;
        if (rot === 0) page = out.addPage(copiedOf.get(pg));
        else {
          // ponytail: elforgatott oldalt képként teszünk át (a jegyzetekkel együtt), a vektoros forgatás-számolás helyett.
          if (!pdfjsDoc) pdfjsDoc = await (await matPdfjs()).getDocument(matPdfOpts(new Uint8Array(await (await matGetFile(id)).arrayBuffer()))).promise;
          const cv = await mvComposePage(pdfjsDoc, pg, items);
          page = out.addPage([pg.w, pg.h]);
          page.drawImage(await out.embedPng(await mvCanvasBytes(cv)), { x: 0, y: 0, width: pg.w, height: pg.h });
          continue;
        }
      } else {
        page = out.addPage([pg.w || MAT_A4.w, pg.h || MAT_A4.h]);
        const { width, height } = page.getSize(), bg = pg.bg || "plain"; // háttérminta vektoros vonalakként
        const color = bg === "lines" ? PDFLib.rgb(0.773, 0.812, 0.863) : PDFLib.rgb(0.851, 0.878, 0.91), thickness = Math.max(0.5, width / 700);
        for (const [x0, y0, x1, y1] of mvPatternLines(bg, height / width)) page.drawLine({ start: { x: x0 * width, y: height - y0 * width }, end: { x: x1 * width, y: height - y1 * width }, thickness, color });
      }
      if (items.length) {
        const { width, height } = page.getSize();
        const cv = document.createElement("canvas"); cv.width = Math.round(width * 2); cv.height = Math.round(height * 2);
        mvDrawItems(cv.getContext("2d"), items, cv.width, cv.height, null, true);
        page.drawImage(await out.embedPng(await mvCanvasBytes(cv)), { x: 0, y: 0, width, height });
      }
    }
    try { pdfjsDoc && pdfjsDoc.destroy(); } catch (e) {}
    return new Blob([await out.save()], { type: "application/pdf" });
  }
}
async function mvComposePage(pdfjsDoc, pg, items) {
  const page = await pdfjsDoc.getPage(pg.n);
  const vp = page.getViewport({ scale: 2 });
  const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const ink = document.createElement("canvas"); ink.width = cv.width; ink.height = cv.height;
  mvDrawItems(ink.getContext("2d"), items, ink.width, ink.height, null, true);
  ctx.drawImage(ink, 0, 0);
  return cv;
}
async function mvCanvasBytes(cv) {
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---- Olvasási pozíció: ahol abbahagytad, onnan folytatja (anyagoknál és könyveknél is) ----
// m.last = { i: a képernyő tetején lévő oldal indexe, f: azon belül hol (0..1), at }.
// Az oldalt bináris kereséssel keressük (egy több száz oldalas könyvnél görgetés közben is olcsó).
function mvIxAt(y) {
  const S = mv.slots; let lo = 0, hi = S.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (S[mid].sheet.getBoundingClientRect().bottom <= y) lo = mid + 1; else hi = mid; }
  return lo;
}
function mvTrackPos() {
  if (!mv || !mv.doc || !mv.slots.length || mv.pinch) return;
  const sc = $("mv-scroll"); if (!sc || !sc.clientHeight) return; // elrejtett képernyőn nem mérünk
  const R = sc.getBoundingClientRect(), i = mvIxAt(R.top + 1), r = mv.slots[i].sheet.getBoundingClientRect();
  const f = Math.max(0, Math.min(1, (R.top - r.top) / Math.max(1, r.height)));
  mvPill(); // p: a képernyő közepén lévő oldal, ezt mutatjuk ("hányadik oldalnál tartasz")
  mv.m.last = { i, f: Math.round(f * 1000) / 1000, p: mv.curIx != null ? mv.curIx : i, at: Date.now() };
  clearTimeout(mv.posT); mv.posT = setTimeout(() => { if (mv) mv.posT = 0; saveState(); }, 1200);
}
function mvRestorePos(cur) {
  const L = cur.m.last, sl = L && cur.slots[L.i], sc = $("mv-scroll");
  if (!sl || !sc || (!L.i && !L.f)) return;
  sc.scrollTop += sl.sheet.getBoundingClientRect().top - sc.getBoundingClientRect().top + (L.f || 0) * sl.sheet.offsetHeight;
  const p = L.p != null ? L.p : L.i;
  if (p > 0) toast("Folytatás a(z) " + (p + 1) + ". oldaltól");
}
// Oldalszám-jelző olvasó módban (lent középen). Koppintásra: jegyzet, ugrás, tartalom.
function mvPill() {
  let p = $("mv-pill");
  if (!p) {
    const bar = $("mv-bar"); if (!bar) return;
    p = document.createElement("button"); p.id = "mv-pill"; p.type = "button"; p.className = "mv-pill";
    bar.insertAdjacentElement("beforebegin", p);
    p.onclick = () => mvPillMenu();
  }
  const show = !!(mv && mv.doc && mv.mode === "read" && mv.slots.length > 1);
  p.hidden = !show; if (!show) return;
  const sc = $("mv-scroll"); if (!sc.clientHeight) return;
  const R = sc.getBoundingClientRect();
  mv.curIx = mvIxAt(R.top + R.height / 2);
  p.textContent = `${mv.curIx + 1} / ${mv.slots.length}`;
  p.setAttribute("aria-label", `${mv.curIx + 1}. oldal, összesen ${mv.slots.length}. Koppints az oldal műveleteihez.`);
}
async function mvPillMenu() {
  if (!mv || !mv.doc) return;
  const cur = mv, i = cur.curIx || 0, nn = mvNoteList(cur).length;
  const a = await askPick({ title: `${i + 1}. oldal`, body: `<div class="hint">${cur.slots.length} oldalból</div>`, options: [
    { icon: "note", label: "Jegyzet ehhez az oldalhoz", value: "note" },
    { icon: "doc", label: "Ugrás oldalra", value: "go" },
    { icon: "toc", label: "Tartalom és jegyzetek", sub: nn ? nn + " jegyzet" : "Tartalomjegyzék és az összes jegyzet", value: "toc" }] });
  if (mv !== cur) return;
  if (a === "note") mvNoteEdit(cur.doc.pages[i].id, null);
  else if (a === "go") mvGoToPage();
  else if (a === "toc") openMatToc();
}
async function mvGoToPage(after) {
  const cur = mv; if (!cur || !cur.doc) return;
  const n = cur.doc.pages.length;
  const t = await askText({ title: "Ugrás oldalra", value: "", placeholder: "1 és " + n + " között", okText: "Ugrás", body: `<div class="hint">Most: ${(cur.curIx || 0) + 1}. oldal · ${n} oldalból</div>` });
  if (t == null || mv !== cur) return;
  const k = parseInt(String(t).replace(/\D+/g, ""), 10);
  if (!(k >= 1 && k <= n)) { toast("Nincs ilyen oldal (1 és " + n + " között)."); return; }
  if (after) after();
  setTimeout(() => mvScrollToPage(k - 1, true), after ? 90 : 0);
}

// ---- Oldaljegyzetek: rövid szöveg egy oldalhoz, az oldal fölött látszik ----
// m.pnotes = [{ id, pid: a doc oldal-azonosítója, text, at }] a metaadatban (kis szöveg, a mentésben is benne van).
function mvNoteList(cur) {
  const ids = new Map(cur.doc.pages.map((p, i) => [p.id, i]));
  return (cur.m.pnotes || []).filter((n) => ids.has(n.pid)).map((n) => ({ n, ix: ids.get(n.pid) })).sort((a, b) => a.ix - b.ix || a.n.at - b.n.at);
}
function mvRenderNotes(sl) {
  const box = sl.notesEl; if (!box || !mv) return;
  const list = (mv.m.pnotes || []).filter((n) => n.pid === sl.pg.id);
  box.innerHTML = list.map((n) => `<button class="mv-pnote" type="button" data-nid="${esc(n.id)}">${icon("note")}<span>${esc(n.text)}</span></button>`).join("");
  box.querySelectorAll("[data-nid]").forEach((b) => b.onclick = () => mvNoteMenu(b.dataset.nid));
}
function mvRefreshNotes(pid) { if (mv) mv.slots.forEach((sl) => { if (sl.pg.id === pid) mvRenderNotes(sl); }); }
// Többsoros szövegmező a közös párbeszédablakban (mint az askText, csak textarea).
function askLong({ title, body = "", value = "", placeholder = "", okText = "Mentés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<div class="field" style="margin-top:14px"><textarea class="input mv-notearea" id="ask-long" rows="5" placeholder="${esc(placeholder)}"></textarea></div>`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    const ok = $("ask-ok"), inp = $("ask-long");
    inp.value = value || ""; ok.disabled = false;
    $("ask-dialog").classList.remove("hidden");
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); ok.onclick = null; $("ask-cancel").onclick = null; res(v); };
    ok.onclick = () => done(inp.value); $("ask-cancel").onclick = () => done(null);
  });
}
async function mvNoteEdit(pid, note) {
  const cur = mv; if (!cur || !cur.doc) return;
  const ix = cur.doc.pages.findIndex((p) => p.id === pid);
  const t = await askLong({ title: note ? `Jegyzet · ${ix + 1}. oldal` : `Jegyzet a(z) ${ix + 1}. oldalhoz`, value: note ? note.text : "",
    placeholder: "Például: ez kell a ZH-hoz, 3. tétel" });
  if (t == null || mv !== cur) return;
  const arr = (cur.m.pnotes = cur.m.pnotes || []), text = t.trim();
  if (note && !text) arr.splice(arr.indexOf(note), 1);
  else if (note) { note.text = text; note.at = Date.now(); }
  else if (text) arr.push({ id: "n" + uid(), pid, text, at: Date.now() });
  else return;
  saveState(); mvRefreshNotes(pid);
  if (!note && text) toast("Jegyzet mentve.");
}
async function mvNoteMenu(nid) {
  const cur = mv; if (!cur) return;
  const note = (cur.m.pnotes || []).find((n) => n.id === nid); if (!note) return;
  const a = await askPick({ title: "Jegyzet", body: `<div class="mv-note-prev">${esc(note.text)}</div>`, options: [
    { icon: "pencil", label: "Szerkesztés", value: "edit" }, { icon: "trash", label: "Törlés", danger: true, value: "del" }] });
  if (mv !== cur) return;
  if (a === "edit") mvNoteEdit(note.pid, note);
  else if (a === "del") {
    cur.m.pnotes = cur.m.pnotes.filter((n) => n !== note); saveState(); mvRefreshNotes(note.pid);
    if ($("tab-mat-toc").classList.contains("active")) renderMatToc();
  }
}

// ---- Tartalom: ugrás oldalra, jegyzetek listája, a PDF tartalomjegyzéke ----
function openMatToc() { if (!mv || !mv.doc) return; mvTextFinish(); pushScreen("tab-mat-toc"); }
// A PDF beépített tartalomjegyzéke (könyvjelzők), laposítva, legfeljebb 4 szint és 400 elem.
async function mvOutline(cur) {
  if (cur.toc) return cur.toc;
  const out = [];
  let raw = null; try { raw = cur.pdf ? await cur.pdf.getOutline() : null; } catch (e) {}
  const walk = async (items, depth) => {
    for (const it of items || []) {
      if (out.length >= 400) return;
      let n = null;
      try {
        let d = it.dest; if (typeof d === "string") d = await cur.pdf.getDestination(d);
        if (Array.isArray(d) && d[0] != null) n = typeof d[0] === "number" ? d[0] + 1 : (await cur.pdf.getPageIndex(d[0])) + 1;
      } catch (e) {}
      const ix = n ? cur.doc.pages.findIndex((p) => p.kind === "pdf" && p.n === n) : -1;
      out.push({ t: String(it.title || "").trim() || "(cím nélkül)", depth, ix });
      if (depth < 3) await walk(it.items, depth + 1);
    }
  };
  await walk(raw, 0);
  return (cur.toc = out);
}
function mvTocJump(ix) { popScreen(); setTimeout(() => mvScrollToPage(ix, true), 90); }
async function renderMatToc() {
  const host = $("mat-toc-scroll"); if (!host) return;
  const sub = $("mat-toc-sub");
  if (!mv || !mv.doc) { host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Nincs megnyitott könyv vagy anyag.</div>`; if (sub) sub.textContent = ""; return; }
  const cur = mv, n = cur.doc.pages.length, at = cur.curIx || 0, notes = mvNoteList(cur);
  if (sub) sub.textContent = cur.m.title;
  const row = (attrs, ic, title, s, right) => `<button class="row" type="button" ${attrs}><span class="row-ic">${icon(ic)}</span>`
    + `<span class="row-main"><span class="row-title">${title}</span>${s ? `<span class="row-sub">${s}</span>` : ""}</span>${right || `<span class="row-chev">${icon("chev")}</span>`}</button>`;
  let h = `<div class="card">` + row(`id="mt-go"`, "doc", "Ugrás oldalra", `Most: ${at + 1}. oldal · ${n} oldalból`)
    + row(`id="mt-note"`, "note", `Jegyzet a(z) ${at + 1}. oldalhoz`, "Rövid megjegyzés, az oldal fölött látszik") + `</div>`;
  h += `<div class="dash-label">Jegyzetek${notes.length ? " · " + notes.length : ""}</div>`;
  h += notes.length ? `<div class="card">` + notes.map((x) => row(`data-mt-ix="${x.ix}"`, "note", esc(x.n.text), "", `<span class="mt-pg">${x.ix + 1}. oldal</span>`)).join("") + `</div>`
    : `<div class="hint" style="margin:0 2px">Még nincs jegyzet. Az oldalszámra vagy az oldal ⋯ menüjére koppintva adhatsz hozzá.</div>`;
  h += `<div class="dash-label">Tartalomjegyzék</div><div id="mt-outline"><div class="hint" style="margin:0 2px">Betöltés…</div></div>`;
  host.innerHTML = h;
  $("mt-go").onclick = () => mvGoToPage(() => popScreen());
  $("mt-note").onclick = async () => { await mvNoteEdit(cur.doc.pages[at].id, null); if (mv === cur && $("tab-mat-toc").classList.contains("active")) renderMatToc(); };
  host.querySelectorAll("[data-mt-ix]").forEach((b) => b.onclick = () => mvTocJump(+b.dataset.mtIx));
  const ol = await mvOutline(cur);
  const box = $("mt-outline"); if (!box || mv !== cur) return;
  if (!ol.length) { box.innerHTML = `<div class="hint" style="margin:0 2px">Ebben a PDF-ben nincs beépített tartalomjegyzék. A nagyítóval kereshetsz a szövegben.</div>`; return; }
  box.innerHTML = `<div class="card">` + ol.map((o, k) => `<button class="row mt-ol" type="button" data-ol="${k}" style="padding-left:${o.depth * 16}px"${o.ix < 0 ? " disabled" : ""}>`
    + `<span class="row-main"><span class="row-title${o.depth ? " mt-sub" : ""}">${esc(o.t)}</span></span>${o.ix >= 0 ? `<span class="mt-pg">${o.ix + 1}</span>` : ""}</button>`).join("") + `</div>`;
  box.querySelectorAll("[data-ol]").forEach((b) => b.onclick = () => { const o = ol[+b.dataset.ol]; if (o && o.ix >= 0) mvTocJump(o.ix); });
}
