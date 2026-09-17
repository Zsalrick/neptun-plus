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
const MV_DEFAULTS = { pen: { c: "#1b1d22", w: 2.2 / MV_REF, a: 1 }, hl: { c: "#f2d33c", w: 12 / MV_REF, a: 0.35 }, text: { c: "#1b1d22", s: 14 / MV_REF } };
const MV_ZOOMS = [1, 1.5, 2, 3];
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

async function openMaterial(id) {
  const m = matById(id); if (!m) { toast("Ez az anyag már nincs meg."); return; }
  mvClose();
  mv = { id, m, doc: null, pdf: null, z: 1, tool: "pan", penSeen: false, undo: [], slots: [], io: null, saving: Promise.resolve(), draw: null, edit: null, sel: null, ctxColors: false, popOpen: false };
  pushScreen("tab-mat-view");
}
function renderMatView() {
  const pages = $("mv-pages"), ttl = $("mv-title");
  if (!pages) return;
  const scr = $("tab-mat-view"); if (scr) scr.scrollTop = 0; // a fejléc mindig látszódjon
  mvWireInput();
  if (!mv) { pages.innerHTML = `<div class="dash-empty" style="padding:24px">Nincs megnyitott anyag.</div>`; return; }
  if (ttl) ttl.textContent = mv.m.title;
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
      pg.w = v.width; pg.h = v.height;
    }
  }
  if (mv !== cur) { try { cur.pdf && cur.pdf.destroy(); } catch (e) {} return; } // közben bezárták
  cur.doc = doc; doc.items = doc.items || {};
  mvLayout();
}
function mvClose() {
  if (!mv) return;
  mvTextCommit();
  try { mv.io && mv.io.disconnect(); } catch (e) {}
  try { mv.pdf && mv.pdf.destroy(); } catch (e) {}
  mv = null;
  const pop = $("mv-pop"); if (pop) pop.classList.add("hidden");
}

// ---- Elrendezés és lusta renderelés ----
// Minden oldal fölött fejléc: "N. oldal" és a ⋯ menü, az oldalak között vékony elválasztó vonal.
// Oldalon belül: PDF vászon, tinta-vászon, és felül a szövegdobozok rétege (DOM, hogy a szerkesztővel azonos legyen).
// anchor: { cx, cy, mx, my, k }: nagyításnál a csípés közepe maradjon helyben (lásd mvSetZoom).
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
      sl.cssW = cssW; sl.cssH = Math.round(cssW * (sl.pg.h / sl.pg.w));
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
      const kind = pg.kind === "blank" ? " · üres oldal" : "";
      sheet.innerHTML = `<div class="mv-phead"><span class="mv-plabel">${i + 1}. oldal${kind}</span>`
        + `<button class="mv-pmenu" type="button" data-pix="${i}" aria-label="${i + 1}. oldal műveletei">${icon("more")}</button></div>`;
      const el = document.createElement("div");
      el.className = "mv-page"; el.dataset.ix = i;
      const cssH = Math.round(cssW * (pg.h / pg.w));
      el.style.width = cssW + "px"; el.style.height = cssH + "px";
      el.innerHTML = `<canvas class="mv-pdf" width="0" height="0"></canvas><canvas class="mv-ink" width="0" height="0"></canvas><div class="mv-texts"></div>`;
      sheet.appendChild(el);
      pages.appendChild(sheet);
      return { pg, el, sheet, cssW, cssH, pdfCv: el.children[0], inkCv: el.children[1], textLayer: el.children[2], rendered: false, stale: false, visible: false, gen: 0 };
    });
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
  if (anchor) { scroll.scrollLeft = anchor.cx * anchor.k - anchor.mx; scroll.scrollTop = anchor.cy * anchor.k - anchor.my; }
  else scroll.scrollTop = ratio * scroll.scrollHeight;
  mvSchedule();
}
function mvApplyToolClass() {
  const scroll = $("mv-scroll"); if (!scroll || !mv) return;
  scroll.classList.toggle("mv-drawing", mv.tool !== "pan" && mv.tool !== "text");
  scroll.classList.toggle("mv-textmode", mv.tool === "text");
}
// Pixelkeret: egy oldal vászna legfeljebb ~4 megapixel. Nagy nagyításnál kicsit lágyabb, de nem fogy el
// a memória és nem akad. (A 3-4x-es nagyítás korábban oldalanként 20+ MP-t foglalt, két vásznon.)
const MV_MAX_PX = 4e6;
function mvScale(sl) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), px = sl.cssW * sl.cssH * dpr * dpr;
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
}
async function mvRenderSlot(sl) {
  const gen = ++sl.gen, scale = mvScale(sl);
  const W = Math.max(1, Math.round(sl.cssW * scale)), H = Math.max(1, Math.round(sl.cssH * scale));
  sl.rendered = true; sl.stale = false;
  sl.inkW = W; sl.inkH = H;
  mvDrawInk(sl);
  if (sl.pg.kind !== "pdf" || !mv.pdf) return;
  try {
    const page = await mv.pdf.getPage(sl.pg.n);
    if (gen !== sl.gen || !mv) return;
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
}

// ---- Jegyzetréteg rajzolása ----
// withText: a megjelenítőben a szöveg DOM-ban él (false); a megosztott PDF-hez vászonra kell (true).
function mvDrawItems(ctx, items, W, H, live, withText) {
  const all = items.concat(live ? [live] : []);
  ctx.clearRect(0, 0, W, H);
  for (const pass of ["hl", "pen"]) all.forEach((it) => { if (it.t === "ink" && it.tool === pass) mvDrawStroke(ctx, it, W, H); });
  if (withText) all.forEach((it) => { if (it.t === "text") mvDrawText(ctx, it, W, H); });
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
function mvTextFont(it, W) { return `500 ${Math.max(6, it.s * W)}px ${MV_FONT}`; }
// Sortörés a vászonra (a megosztott PDF-hez), a böngésző pre-wrap tördeléséhez igazítva.
function mvWrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const tok of para.split(/(\s+)/)) {
      if (!tok) continue;
      if (ctx.measureText(line + tok).width <= maxW || !line.trim()) {
        if (!line && ctx.measureText(tok).width > maxW) { // egy szó is túl hosszú: karakterenként
          for (const ch of tok) { if (line && ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
        } else line += tok;
      } else { out.push(line.replace(/\s+$/, "")); line = /^\s+$/.test(tok) ? "" : tok; }
    }
    out.push(line);
  }
  return out;
}
function mvDrawText(ctx, it, W, H) {
  const lh = it.s * W * 1.25;
  ctx.save(); ctx.fillStyle = it.c; ctx.font = mvTextFont(it, W); ctx.textBaseline = "middle";
  mvWrapLines(ctx, it.text, mvTextBw(it) * W).forEach((ln, i) => ctx.fillText(ln, it.x * W, it.y * H + (i + 0.5) * lh));
  ctx.restore();
}
function mvDrawInk(s, live) {
  if (!s.rendered || !mv) return;
  const items = mv.doc.items[s.pg.id] || [];
  const need = !!live || items.some((it) => it.t === "ink");
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
function mvPush(op) { mv.undo.push(op); if (mv.undo.length > 100) mv.undo.shift(); mvRenderBar(); }
function mvUndo() {
  mvTextCommit();
  const op = mv && mv.undo.pop(); if (!op) return;
  const items = mv.doc.items;
  if (op.type === "add") { const arr = items[op.page] || []; const ix = arr.indexOf(op.item); if (ix >= 0) arr.splice(ix, 1); if (mv.sel && mv.sel.it === op.item) mv.sel = null; }
  else if (op.type === "remove") { const arr = (items[op.page] = items[op.page] || []); op.removed.sort((a, b) => a.ix - b.ix).forEach((r) => arr.splice(r.ix, 0, r.item)); }
  else if (op.type === "edit") { op.item.text = op.before; }
  else if (op.type === "prop") { Object.assign(op.item, op.before); }
  else if (op.type === "addPage") { mv.doc.pages.splice(op.index, 1); delete items[op.pageId]; mvSave(); mvLayout(); mvRenderBar(); return; }
  else if (op.type === "delPage") { mv.doc.pages.splice(op.index, 0, op.page); if (op.items) items[op.page.id] = op.items; mvSave(); mvLayout(); mvRenderBar(); mvScrollToPage(op.index); return; }
  mvSave(); mvRedrawPage(op.page); mvRenderBar();
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
  // A billentyűzet megjelenésekor a szerkesztett doboz maradjon látható.
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => mvTextKeepVisible());
  scroll.addEventListener("pointerdown", (ev) => {
    if (!mv || !mv.doc || mv.pinch) return;
    const t = ev.target;
    if (t.closest && (t.closest(".mv-textedit") || t.closest(".mv-phead") || t.closest(".mv-tctx"))) return;
    if (mv.popOpen) { mv.popOpen = false; mvRenderPop(); mvRenderBar(); }
    if (mv.tool === "text") return mvTextPointerDown(ev);
    if (mv.tool === "pan") return;
    if (ev.pointerType === "pen") mv.penSeen = true;
    // Tenyér-elutasítás: ha egyszer tollat láttunk, az ujj már csak görget.
    if (ev.pointerType === "touch" && mv.penSeen) { mv.draw = { pan: true, id: ev.pointerId, y: ev.clientY, x: ev.clientX }; return; }
    if (mv.draw) return; // egyszerre egy mozdulat
    const s = mvSlotAt(ev); if (!s) return;
    ev.preventDefault();
    try { scroll.setPointerCapture(ev.pointerId); } catch (e) {}
    const q = mvNorm(s, ev), pr = ev.pressure > 0 && ev.pointerType !== "mouse" ? ev.pressure : 0.5;
    if (mv.tool === "pen" || mv.tool === "hl") {
      const p = mvPrefs()[mv.tool];
      mv.draw = { id: ev.pointerId, s, item: { t: "ink", tool: mv.tool, c: p.c, w: p.w, a: p.a, pts: [q.x, q.y, pr] } };
      mvDrawInk(s, mv.draw.item);
    } else if (mv.tool === "eraser") {
      mv.draw = { id: ev.pointerId, s, removed: [] }; mvErase(s, q, ev);
    }
  });
  scroll.addEventListener("pointermove", (ev) => {
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    if (d.pan) { scroll.scrollTop -= ev.clientY - d.y; scroll.scrollLeft -= ev.clientX - d.x; d.y = ev.clientY; d.x = ev.clientX; return; }
    if (d.mode) return mvTextPointerMove(ev, d);
    ev.preventDefault();
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    if (d.item) {
      for (const e2 of (evs.length ? evs : [ev])) {
        const q = mvNorm(d.s, e2), pr = e2.pressure > 0 && e2.pointerType !== "mouse" ? e2.pressure : 0.5;
        const p = d.item.pts, lx = p[p.length - 3], ly = p[p.length - 2];
        if (Math.abs(q.x - lx) + Math.abs(q.y - ly) < 0.0012) continue; // túl sűrű pontok kihagyása
        p.push(q.x, q.y, pr);
      }
      if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; if (mv && mv.draw === d) mvDrawInk(d.s, d.item); });
    } else if (d.removed) mvErase(d.s, mvNorm(d.s, ev), ev);
  });
  const end = (ev) => {
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    mv.draw = null;
    if (d.pan) return;
    if (d.mode) return mvTextPointerEnd(ev, d);
    const pageId = d.s.pg.id, arr = (mv.doc.items[pageId] = mv.doc.items[pageId] || []);
    if (d.item) {
      if (d.raf) cancelAnimationFrame(d.raf);
      d.item.pts = d.item.pts.map((v) => Math.round(v * 10000) / 10000); // kisebb mentés
      arr.push(d.item); mvPush({ type: "add", page: pageId, item: d.item }); mvSave(); mvDrawInk(d.s);
    } else if (d.removed) {
      if (d.removed.length) { mvPush({ type: "remove", page: pageId, removed: d.removed }); mvSave(); }
    }
  };
  scroll.addEventListener("pointerup", end);
  scroll.addEventListener("pointercancel", end);
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
function mvStyleText(el, it, s) {
  if (it.bw == null) it.bw = mvTextBw(it);
  Object.assign(el.style, { left: it.x * 100 + "%", top: it.y * 100 + "%", width: it.bw * 100 + "%", fontSize: it.s * s.cssW + "px", color: it.c, fontFamily: MV_FONT });
}
function mvTextElFor(s, it) { return [...s.textLayer.children].find((el) => el._it === it) || null; }
function mvRenderTexts(s) {
  if (!mv || !s.textLayer) return;
  s.textLayer.innerHTML = "";
  for (const it of mv.doc.items[s.pg.id] || []) {
    if (it.t !== "text" || (mv.edit && mv.edit.it === it)) continue;
    const el = document.createElement("div");
    const selected = mv.sel && mv.sel.it === it;
    el.className = "mv-tbox" + (selected ? " sel" : "");
    mvStyleText(el, it, s);
    el.textContent = it.text;
    el._it = it;
    if (selected) { const h = document.createElement("span"); h.className = "mv-thandle"; h.setAttribute("aria-label", "Szélesség"); el.appendChild(h); }
    s.textLayer.appendChild(el);
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
    d.it.x = Math.max(0, Math.min(1 - d.it.bw, d.x0 + dx / d.s.cssW));
    d.it.y = Math.max(0, Math.min(0.98, d.y0 + dy / d.s.cssH));
    const el = mvTextElFor(d.s, d.it); if (el) { el.style.left = d.it.x * 100 + "%"; el.style.top = d.it.y * 100 + "%"; }
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
    // Ha éppen szerkesztettél vagy ki volt jelölve valami, az első koppintás csak lezár (mint a Samsung Notesban).
    if (mv.edit || mv.sel) mvTextFinish();
    else mvTextCreate(d.s, d.q);
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
  ta.setAttribute("autocapitalize", "sentences"); ta.setAttribute("aria-label", "Szöveg a lapon");
  mvStyleText(ta, it, s);
  s.el.appendChild(ta);
  mv.edit = { s, it, isNew, before: it.text, ta };
  const grow = () => { ta.style.height = "0px"; ta.style.height = Math.max(ta.scrollHeight, it.s * s.cssW * 1.25) + "px"; mvPlaceTextCtx(); };
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
    if (txt) { e.it.text = txt; arr.push(e.it); mvPush({ type: "add", page: pageId, item: e.it }); mvSave(); }
    else mv.sel = null;
  } else if (!txt) {
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
  toast("Szöveg törölve.");
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

// ---- Eszköztár és beállítások ----
function mvRenderBar() {
  const bar = $("mv-bar"); if (!bar) return;
  if (!mv) { bar.innerHTML = ""; return; }
  const t = mv.tool, pr = mvPrefs()[t];
  const btn = (id, ic, label, on) => `<button class="mv-tool${on ? " on" : ""}" data-mv="${id}" type="button" aria-label="${label}" title="${label}">${icon(ic)}</button>`;
  bar.innerHTML = btn("pan", "hand", "Görgetés", t === "pan") + btn("pen", "pencil", "Toll", t === "pen") + btn("hl", "marker", "Kiemelő", t === "hl")
    + btn("eraser", "eraser", "Radír", t === "eraser") + btn("text", "text", "Szöveg", t === "text")
    + (pr ? `<button class="mv-tool${mv.popOpen ? " on" : ""}" data-mv="color" type="button" aria-label="Szín és vastagság" title="Szín és vastagság"><span class="mv-swatch" style="background:${pr.c};opacity:${pr.a != null ? Math.max(0.35, pr.a) : 1}"></span></button>` : "")
    + `<span class="mv-sep"></span>`
    + `<button class="mv-tool" data-mv="undo" type="button" aria-label="Visszavonás" title="Visszavonás"${mv.undo.length ? "" : " disabled"}>${icon("undo")}</button>`
    + btn("zoom", MV_ZOOMS.some((z) => z > mv.z + 0.01) ? "zoomin" : "zoomout", "Nagyítás: " + Math.round(mv.z * 100) + "%", mv.z > 1.001);
  bar.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => mvAction(b.dataset.mv));
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
  pop.querySelectorAll(".mv-sw").forEach((b) => b.onclick = () => { p.c = b.dataset.c; saveState(); mvRenderPop(); mvRenderBar(); });
  pop.querySelectorAll("input[type=range]").forEach((inp) => inp.oninput = () => {
    const k = inp.dataset.k, v = +inp.value;
    if (k === "a") p.a = v / 100; else p[k] = v / MV_REF;
    const lbl = pop.querySelector(`[data-v="${k}"]`); if (lbl) lbl.textContent = k === "a" ? v + "%" : (k === "s" ? Math.round(v) : v) + " px";
    const pv = pop.querySelector(".mv-prev span"); if (pv) { pv.style.height = Math.max(1, px(p.w)) + "px"; pv.style.opacity = p.a; }
    const tv = pop.querySelector(".mv-prev-text"); if (tv) tv.style.fontSize = Math.min(28, px(p.s)) + "px";
    saveState(); mvRenderBar();
  });
}
function mvAction(a) {
  if (!mv) return;
  if (["pan", "pen", "hl", "eraser", "text"].includes(a)) {
    // Az aktív rajzeszközre újra koppintva nyílik/csukódik a beállító panel.
    if (a === mv.tool && ["pen", "hl", "text"].includes(a)) mv.popOpen = !mv.popOpen;
    else { mv.popOpen = false; if (mv.tool === "text" && a !== "text") mvTextFinish(); }
    mv.tool = a; mvApplyToolClass();
    mvRenderBar(); mvRenderPop(); mvRenderTextCtx(); return;
  }
  if (a === "color") { mv.popOpen = !mv.popOpen; mvRenderBar(); mvRenderPop(); return; }
  if (a === "undo") return mvUndo();
  if (!mv.doc) return;
  if (a === "zoom") { // a következő lépcsőre (100, 150, 200, 300%), a tetejéről vissza 100%-ra
    mvSetZoom(MV_ZOOMS.find((z) => z > mv.z + 0.01) || 1);
    toast("Nagyítás: " + Math.round(mv.z * 100) + "%");
    return;
  }
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
function mvScrollToPage(ix) {
  const scroll = $("mv-scroll"), s = mv && mv.slots[ix]; if (!s) return;
  const top = scroll.scrollTop + s.sheet.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 4;
  scroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
// Új üres oldal a megadott oldal UTÁN, annak méretével.
function mvAddPage(ix) {
  const ref = mv.doc.pages[ix] || MAT_A4;
  const pg = { id: "b" + uid(), kind: "blank", w: ref.w || MAT_A4.w, h: ref.h || MAT_A4.h };
  mv.doc.pages.splice(ix + 1, 0, pg);
  mvPush({ type: "addPage", index: ix + 1, pageId: pg.id });
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
  const ok = await ask({ title: `A(z) ${ix + 1}. oldal törlése`, okText: "Törlés", cancelText: "Mégse", body: `${warn}<br><br>Amíg nyitva van az anyag, a Visszavonás gombbal visszahozható.` });
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
  mv.undo = []; // ponytail: a visszaállítás után a visszavonási lista törlődik (a korábbi oldal-indexek elcsúsznának)
  mvSave(); mvLayout(); mvRenderBar();
  toast(miss.length + " eredeti oldal visszaállítva.");
}
async function mvPageMenu(ix) {
  if (!mv || !mv.doc) return;
  mvTextFinish();
  const miss = mvMissingPdfPages();
  const opts = [
    { label: "Új üres oldal ez után", value: "add" },
    { label: "Oldal törlése", sub: mv.doc.pages.length <= 1 ? "Az utolsó oldal nem törölhető" : "", value: "del" }];
  if (miss.length) opts.push({ label: "Törölt eredeti oldalak visszaállítása", sub: miss.length + " oldal: " + miss.slice(0, 6).join(", ") + (miss.length > 6 ? "…" : ""), value: "restore" });
  const act = await askPick({ title: (ix + 1) + ". oldal", options: opts });
  if (!mv) return;
  if (act === "add") mvAddPage(ix);
  else if (act === "del") mvDeletePage(ix);
  else if (act === "restore") mvRestorePdfPages();
}

// ---- Két ujjas csípés-nagyítás ----
// Gesztus közben csak CSS-transzformációval nagyítunk (gyors), elengedéskor rendereljük újra a valódi méretben.
function mvSetZoom(z, focus) {
  const scroll = $("mv-scroll"); if (!mv || !mv.doc) return;
  z = Math.max(MV_ZMIN, Math.min(MV_ZMAX, z));
  const r = scroll.getBoundingClientRect();
  const mx = focus ? focus.x - r.left : scroll.clientWidth / 2, my = focus ? focus.y - r.top : scroll.clientHeight / 2;
  const anchor = { cx: scroll.scrollLeft + mx, cy: scroll.scrollTop + my, mx, my, k: z / mv.z };
  mv.z = z; mvLayout(anchor); mvRenderBar();
}
function mvWirePinch(scroll) {
  const pages = $("mv-pages");
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const midpt = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
  scroll.addEventListener("touchstart", (ev) => {
    if (!mv || !mv.doc || ev.touches.length !== 2 || mv.edit) return;
    if (mv.draw && mv.draw.item && mv.draw.s) { const s = mv.draw.s; mv.draw = null; mvDrawInk(s); } // félbehagyott vonás eldobása
    else mv.draw = null;
    const r = scroll.getBoundingClientRect(), m = midpt(ev.touches);
    mv.pinch = { d0: dist(ev.touches), k: 1, m, ox: scroll.scrollLeft + m.x - r.left, oy: scroll.scrollTop + m.y - r.top };
    pages.style.transformOrigin = mv.pinch.ox + "px " + mv.pinch.oy + "px";
    pages.style.willChange = "transform";
  }, { passive: true });
  scroll.addEventListener("touchmove", (ev) => {
    const p = mv && mv.pinch; if (!p || ev.touches.length !== 2) return;
    ev.preventDefault();
    p.k = Math.max(MV_ZMIN / mv.z, Math.min(MV_ZMAX / mv.z, dist(ev.touches) / p.d0));
    p.m = midpt(ev.touches);
    pages.style.transform = "scale(" + p.k + ")";
  }, { passive: false });
  const end = (ev) => {
    const p = mv && mv.pinch; if (!p || ev.touches.length >= 2) return;
    mv.pinch = null;
    pages.style.transform = ""; pages.style.transformOrigin = ""; pages.style.willChange = "";
    mvSchedule();
    if (Math.abs(p.k - 1) > 0.03) mvSetZoom(mv.z * p.k, p.m);
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
    const PDFLib = await matScript("lib/pdf-lib.min.js", "PDFLib");
    const doc = (mv && mv.id === id && mv.doc) || await matGetDoc(id);
    const out = await PDFLib.PDFDocument.create();
    let src = null, pdfjsDoc = null;
    if (m.kind === "pdf") {
      const bytes = new Uint8Array(await (await matGetFile(id)).arrayBuffer());
      src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    for (let i = 0; i < doc.pages.length; i++) {
      $("busy-text").textContent = "PDF készítése… " + (i + 1) + " / " + doc.pages.length;
      const pg = doc.pages[i], items = doc.items[pg.id] || [];
      let page;
      if (pg.kind === "pdf" && src) {
        const rot = src.getPage(pg.n - 1).getRotation().angle % 360;
        if (rot === 0) { const [cp] = await out.copyPages(src, [pg.n - 1]); page = out.addPage(cp); }
        else {
          // ponytail: elforgatott oldalt képként teszünk át (a jegyzetekkel együtt), a vektoros forgatás-számolás helyett.
          if (!pdfjsDoc) pdfjsDoc = await (await matPdfjs()).getDocument(matPdfOpts(new Uint8Array(await (await matGetFile(id)).arrayBuffer()))).promise;
          const cv = await mvComposePage(pdfjsDoc, pg, items);
          page = out.addPage([pg.w, pg.h]);
          page.drawImage(await out.embedPng(await mvCanvasBytes(cv)), { x: 0, y: 0, width: pg.w, height: pg.h });
          continue;
        }
      } else page = out.addPage([pg.w || MAT_A4.w, pg.h || MAT_A4.h]);
      if (items.length) {
        const { width, height } = page.getSize();
        const cv = document.createElement("canvas"); cv.width = Math.round(width * 2); cv.height = Math.round(height * 2);
        mvDrawItems(cv.getContext("2d"), items, cv.width, cv.height, null, true);
        page.drawImage(await out.embedPng(await mvCanvasBytes(cv)), { x: 0, y: 0, width, height });
      }
    }
    try { pdfjsDoc && pdfjsDoc.destroy(); } catch (e) {}
    const blob = new Blob([await out.save()], { type: "application/pdf" });
    hideBusy();
    await matShareBlob(blob, slugName(m.title) + ".pdf", "application/pdf", "PDF");
  } catch (e) { hideBusy(); await ask({ title: "Nem sikerült a PDF", okText: "OK", body: esc(String(e && e.message || e)) }); }
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
