// Anyag-megjelenítő: PDF oldalak + jegyzetréteg (toll, kiemelő, radír, szöveg), oldalkezelés, megosztás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// A jegyzetek NORMALIZÁLT (0..1) koordinátákban tárolódnak az oldal szélességéhez/magasságához képest,
// így a nagyítás és a képernyőméret nem számít. A vastagság és a betűméret is az oldal szélességéhez viszonyított.
// Elem: { t:"ink", tool:"pen"|"hl", c, w, a, pts:[x,y,p, x,y,p, ...] } | { t:"text", x, y, s, c, text }
// (a régi, "a" nélküli elemeknél: toll 1, kiemelő 0.38)
const MV_PALETTE = ["#1b1d22", "#6b7079", "#2457c5", "#3aa0ff", "#1f9d6b", "#7fd48a", "#f2d33c", "#f08a24", "#c62f2f", "#f39ac4", "#8e44ad"];
const MV_REF = 360; // a csúszkák px-értékei ekkora szélességű oldalra vonatkoznak
const MV_DEFAULTS = { pen: { c: "#1b1d22", w: 2.2 / MV_REF, a: 1 }, hl: { c: "#f2d33c", w: 12 / MV_REF, a: 0.35 }, text: { c: "#1b1d22", s: 14 / MV_REF } };
const MV_ZOOMS = [1, 1.5, 2, 3];
const MV_ZMIN = 1, MV_ZMAX = 4;
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
  mv = { id, m, doc: null, pdf: null, z: 1, tool: "pan", penSeen: false, undo: [], slots: [], io: null, saving: Promise.resolve(), draw: null, edit: null, popOpen: false };
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
// anchor: { cx, cy, mx, my, k }: nagyításnál a csípés közepe maradjon helyben (lásd mvSetZoom).
function mvLayout(anchor) {
  const pages = $("mv-pages"), scroll = $("mv-scroll");
  if (!mv || !mv.doc || !pages) return;
  mvTextCommit();
  const ratio = scroll.scrollHeight ? scroll.scrollTop / scroll.scrollHeight : 0;
  try { mv.io && mv.io.disconnect(); } catch (e) {}
  const baseW = Math.max(240, Math.min(scroll.clientWidth - 24, 900));
  const cssW = Math.round(baseW * mv.z);
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
    el.innerHTML = `<canvas class="mv-pdf"></canvas><canvas class="mv-ink"></canvas>`;
    sheet.appendChild(el);
    pages.appendChild(sheet);
    return { pg, el, sheet, cssW, cssH, pdfCv: el.children[0], inkCv: el.children[1], rendered: false, task: null };
  });
  scroll.classList.toggle("mv-drawing", mv.tool !== "pan");
  scroll.style.overflowX = mv.z > 1.001 ? "auto" : "hidden";
  mv.io = new IntersectionObserver((ents) => ents.forEach((en) => {
    const s = mv && mv.slots[+en.target.dataset.ix]; if (!s) return;
    if (en.isIntersecting) mvRenderSlot(s); else mvReleaseSlot(s);
  }), { root: scroll, rootMargin: "800px 0px" });
  mv.slots.forEach((s) => mv.io.observe(s.el));
  pages.querySelectorAll(".mv-pmenu").forEach((b) => b.onclick = () => mvPageMenu(+b.dataset.pix));
  if (anchor) { scroll.scrollLeft = anchor.cx * anchor.k - anchor.mx; scroll.scrollTop = anchor.cy * anchor.k - anchor.my; }
  else scroll.scrollTop = ratio * scroll.scrollHeight;
}
function mvDpr(s) { // a vászon ne legyen irdatlan nagy (memória): legfeljebb 2x és ~4000 px széles
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 4000 / s.cssW));
}
async function mvRenderSlot(s) {
  if (s.rendered) return;
  s.rendered = true;
  const dpr = mvDpr(s);
  for (const cv of [s.pdfCv, s.inkCv]) { cv.width = Math.round(s.cssW * dpr); cv.height = Math.round(s.cssH * dpr); }
  mvDrawInk(s);
  if (s.pg.kind !== "pdf" || !mv.pdf) return;
  try {
    const page = await mv.pdf.getPage(s.pg.n);
    const vp = page.getViewport({ scale: s.pdfCv.width / page.getViewport({ scale: 1 }).width });
    s.task = page.render({ canvasContext: s.pdfCv.getContext("2d"), viewport: vp });
    await s.task.promise;
  } catch (e) { if (!e || e.name !== "RenderingCancelledException") console.warn("pdf oldal", e); }
  s.task = null;
}
function mvReleaseSlot(s) {
  if (!s.rendered) return;
  if (mv && mv.edit && mv.edit.s === s) return; // éppen ide írnak
  try { s.task && s.task.cancel(); } catch (e) {}
  s.rendered = false;
  for (const cv of [s.pdfCv, s.inkCv]) { cv.width = 0; cv.height = 0; }
}

// ---- Jegyzetréteg rajzolása ----
function mvDrawItems(ctx, items, W, H, live, skip) {
  const all = (skip ? items.filter((it) => it !== skip) : items).concat(live ? [live] : []);
  ctx.clearRect(0, 0, W, H);
  for (const pass of ["hl", "pen"]) all.forEach((it) => { if (it.t === "ink" && it.tool === pass) mvDrawStroke(ctx, it, W, H); });
  all.forEach((it) => { if (it.t === "text") mvDrawText(ctx, it, W, H); });
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
    // Fedő toll: középpontos simítás (felezőponttól felezőpontig, a pont a kontrollpont), szakaszonként a
    // nyomás szerinti vastagsággal. A kerek végek miatt a szakaszok hézag nélkül illeszkednek.
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
const MV_FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
function mvTextFont(it, W) { return `600 ${Math.max(6, it.s * W)}px ${MV_FONT}`; }
// A szöveg sorai "middle" alapvonallal: így esik egybe a szerkesztő (textarea) sorközepével.
function mvDrawText(ctx, it, W, H) {
  const lh = it.s * W * 1.25;
  ctx.save(); ctx.fillStyle = it.c; ctx.font = mvTextFont(it, W); ctx.textBaseline = "middle";
  String(it.text).split("\n").forEach((ln, i) => ctx.fillText(ln, it.x * W, it.y * H + (i + 0.5) * lh));
  ctx.restore();
}
function mvDrawInk(s, live) {
  if (!s.rendered || !mv) return;
  const ctx = s.inkCv.getContext("2d");
  mvDrawItems(ctx, mv.doc.items[s.pg.id] || [], s.inkCv.width, s.inkCv.height, live, mv.edit && mv.edit.s === s ? mv.edit.it : null);
}
function mvTextBox(it, W, H, ctx) { // a szöveg befoglaló téglalapja normalizált koordinátákban
  ctx.save(); ctx.font = mvTextFont(it, W);
  const lines = String(it.text).split("\n");
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) / W;
  ctx.restore();
  return { x: it.x, y: it.y, w, h: (lines.length * it.s * W * 1.25) / H };
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
  if (op.type === "add") { const arr = items[op.page] || []; const ix = arr.indexOf(op.item); if (ix >= 0) arr.splice(ix, 1); }
  else if (op.type === "remove") { const arr = (items[op.page] = items[op.page] || []); op.removed.sort((a, b) => a.ix - b.ix).forEach((r) => arr.splice(r.ix, 0, r.item)); }
  else if (op.type === "edit") { op.item.text = op.before; }
  else if (op.type === "addPage") { mv.doc.pages.splice(op.index, 1); delete items[op.pageId]; mvSave(); mvLayout(); mvRenderBar(); return; }
  else if (op.type === "delPage") { mv.doc.pages.splice(op.index, 0, op.page); if (op.items) items[op.page.id] = op.items; mvSave(); mvLayout(); mvRenderBar(); mvScrollToPage(op.index); return; }
  mvSave(); mvRedrawPage(op.page); mvRenderBar();
}
function mvRedrawPage(pageId) { (mv.slots || []).forEach((s) => { if (s.pg.id === pageId) mvDrawInk(s); }); }

// ---- Bemenet: toll, kiemelő, radír, szöveg ----
function mvSlotAt(ev) { const el = ev.target.closest && ev.target.closest(".mv-page"); return el && mv ? mv.slots[+el.dataset.ix] : null; }
function mvNorm(s, ev) { const r = s.el.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; }
function mvWireInput() {
  const scroll = $("mv-scroll"); if (!scroll || scroll.dataset.wired) return;
  scroll.dataset.wired = "1";
  $("mv-addpage").onclick = () => mvAction("addpage");
  $("mv-share").onclick = () => mvAction("share");
  mvWirePinch(scroll);
  scroll.addEventListener("pointerdown", (ev) => {
    if (!mv || !mv.doc || mv.pinch) return;
    if (ev.target.closest && (ev.target.closest(".mv-textedit") || ev.target.closest(".mv-phead"))) return;
    if (mv.popOpen) { mv.popOpen = false; mvRenderPop(); mvRenderBar(); }
    if (mv.tool === "pan") { mvTextCommit(); return; }
    if (ev.pointerType === "pen") mv.penSeen = true;
    // Tenyér-elutasítás: ha egyszer tollat láttunk, az ujj már csak görget.
    if (ev.pointerType === "touch" && mv.penSeen) { mv.draw = { pan: true, id: ev.pointerId, y: ev.clientY, x: ev.clientX }; return; }
    if (mv.draw) return; // egyszerre egy mozdulat
    const s = mvSlotAt(ev); if (!s) return;
    ev.preventDefault();
    mvTextCommit(); // ha máshova koppintunk, a nyitott szöveg lezárul
    try { scroll.setPointerCapture(ev.pointerId); } catch (e) {}
    const q = mvNorm(s, ev), pr = ev.pressure > 0 && ev.pointerType !== "mouse" ? ev.pressure : 0.5;
    if (mv.tool === "pen" || mv.tool === "hl") {
      const p = mvPrefs()[mv.tool];
      mv.draw = { id: ev.pointerId, s, item: { t: "ink", tool: mv.tool, c: p.c, w: p.w, a: p.a, pts: [q.x, q.y, pr] } };
      mvDrawInk(s, mv.draw.item);
    } else if (mv.tool === "eraser") {
      mv.draw = { id: ev.pointerId, s, removed: [] }; mvErase(s, q);
    } else if (mv.tool === "text") {
      mv.draw = { id: ev.pointerId, s, q, x0: ev.clientX, y0: ev.clientY, text: true };
    }
  });
  scroll.addEventListener("pointermove", (ev) => {
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    if (d.pan) { scroll.scrollTop -= ev.clientY - d.y; scroll.scrollLeft -= ev.clientX - d.x; d.y = ev.clientY; d.x = ev.clientX; return; }
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
    } else if (d.removed) mvErase(d.s, mvNorm(d.s, ev));
  });
  const end = (ev) => {
    const d = mv && mv.draw; if (!d || d.id !== ev.pointerId) return;
    mv.draw = null;
    if (d.pan) return;
    const pageId = d.s.pg.id, arr = (mv.doc.items[pageId] = mv.doc.items[pageId] || []);
    if (d.item) {
      if (d.raf) cancelAnimationFrame(d.raf);
      d.item.pts = d.item.pts.map((v) => Math.round(v * 10000) / 10000); // kisebb mentés
      arr.push(d.item); mvPush({ type: "add", page: pageId, item: d.item }); mvSave(); mvDrawInk(d.s);
    } else if (d.removed) {
      if (d.removed.length) { mvPush({ type: "remove", page: pageId, removed: d.removed }); mvSave(); }
    } else if (d.text && ev.type === "pointerup" && Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 10) {
      mvTextTap(d.s, d.q); // szinkron: a billentyűzet csak felhasználói mozdulaton belüli fókuszra nyílik meg
    }
  };
  scroll.addEventListener("pointerup", end);
  scroll.addEventListener("pointercancel", end);
}
function mvErase(s, q) {
  const arr = mv.doc.items[s.pg.id] || []; if (!arr.length) return;
  const W = s.inkCv.width || s.cssW, H = s.inkCv.height || s.cssH, r = 14 / s.cssW;
  const ctx = s.inkCv.getContext("2d");
  let changed = false;
  for (let i = arr.length - 1; i >= 0; i--) {
    const it = arr[i]; let hit = false;
    if (it.t === "ink") {
      const lim = r + it.w / 2, aspect = H / W;
      for (let k = 0; k < it.pts.length; k += 3) { const dx = it.pts[k] - q.x, dy = (it.pts[k + 1] - q.y) * aspect; if (dx * dx + dy * dy < lim * lim) { hit = true; break; } }
    } else if (it.t === "text") {
      const b = mvTextBox(it, W, H, ctx); hit = q.x >= b.x - r && q.x <= b.x + b.w + r && q.y >= b.y - r && q.y <= b.y + b.h + r;
    }
    if (hit) { mv.draw.removed.push({ ix: i, item: it }); arr.splice(i, 1); changed = true; }
  }
  if (changed) mvDrawInk(s);
}

// ---- Szöveg közvetlenül a lapra ----
// T eszközzel koppintva ott nyílik egy szerkesztő (villogó kurzorral), meglévő szövegre koppintva azt szerkeszti.
// Máshova koppintva, eszközt váltva vagy kilépve lezárul és mentődik; üresen hagyva törlődik.
function mvTextTap(s, q) {
  const arr = mv.doc.items[s.pg.id] || [];
  const W = s.inkCv.width || s.cssW, H = s.inkCv.height || s.cssH, ctx = s.inkCv.getContext("2d");
  const hit = arr.slice().reverse().find((it) => { if (it.t !== "text") return false; const b = mvTextBox(it, W, H, ctx); return q.x >= b.x - 0.01 && q.x <= b.x + b.w + 0.01 && q.y >= b.y - 0.01 && q.y <= b.y + b.h + 0.01; });
  const p = mvPrefs().text;
  mvTextEdit(s, hit || { t: "text", x: q.x, y: Math.max(0, q.y - (p.s * 1.25 * s.cssW) / 2 / s.cssH), s: p.s, c: p.c, text: "" }, !!hit);
}
function mvTextEdit(s, it, existing) {
  mvTextCommit();
  const ta = document.createElement("textarea");
  ta.className = "mv-textedit";
  ta.value = it.text; ta.spellcheck = false; ta.rows = 1;
  ta.setAttribute("autocapitalize", "sentences"); ta.setAttribute("aria-label", "Szöveg a lapon");
  const fs = it.s * s.cssW;
  Object.assign(ta.style, { left: it.x * 100 + "%", top: it.y * 100 + "%", fontSize: fs + "px", color: it.c, fontFamily: MV_FONT });
  s.el.appendChild(ta);
  mv.edit = { s, it, existing, before: existing ? it.text : null, ta };
  const fit = () => {
    ta.style.width = "0px"; ta.style.height = "0px";
    ta.style.width = Math.min(s.cssW * (1 - it.x), ta.scrollWidth + fs * 0.6) + "px";
    ta.style.height = ta.scrollHeight + "px";
  };
  ta.addEventListener("input", fit);
  ta.addEventListener("blur", () => mvTextCommit());
  fit();
  mvDrawInk(s); // a szerkesztett szöveg ne látsszon duplán
  try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
  ta.setSelectionRange(ta.value.length, ta.value.length);
  // A fókusz ne görgesse el a képernyőt (a fejléc eltűnne); csak a PDF-listát igazítjuk, ha a szerkesztő kilóg.
  setTimeout(() => {
    const scr = $("tab-mat-view"); if (scr) scr.scrollTop = 0;
    const sc = $("mv-scroll"); if (!sc || !mv || !mv.edit || mv.edit.ta !== ta) return;
    const r = ta.getBoundingClientRect(), R = sc.getBoundingClientRect();
    if (r.bottom > R.bottom - 90) sc.scrollTop += r.bottom - R.bottom + 120;
    else if (r.top < R.top + 10) sc.scrollTop -= R.top - r.top + 40;
  }, 350);
}
function mvTextCommit() {
  const e = mv && mv.edit; if (!e) return;
  mv.edit = null;
  const txt = e.ta.value.replace(/\s+$/, "");
  e.ta.remove();
  const pageId = e.s.pg.id, arr = (mv.doc.items[pageId] = mv.doc.items[pageId] || []);
  if (e.existing) {
    if (!txt) { const ix = arr.indexOf(e.it); if (ix >= 0) { arr.splice(ix, 1); mvPush({ type: "remove", page: pageId, removed: [{ ix, item: e.it }] }); mvSave(); } }
    else if (txt !== e.before) { mvPush({ type: "edit", page: pageId, item: e.it, before: e.before }); e.it.text = txt; mvSave(); }
  } else if (txt) { e.it.text = txt; arr.push(e.it); mvPush({ type: "add", page: pageId, item: e.it }); mvSave(); }
  mvDrawInk(e.s);
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
// Beállító panel az eszköztár fölött: szín, vastagság, átlátszóság (szövegnél betűméret).
function mvRenderPop() {
  const pop = $("mv-pop"); if (!pop) return;
  const t = mv && mv.tool;
  if (!mv || !mv.popOpen || !["pen", "hl", "text"].includes(t)) { pop.classList.add("hidden"); return; }
  const p = mvPrefs()[t];
  const title = { pen: "Toll", hl: "Kiemelő", text: "Szöveg" }[t];
  const px = (v) => Math.round(v * MV_REF * 10) / 10;
  let h = `<div class="mv-pop-title">${title}</div><div class="mv-swatches">`
    + MV_PALETTE.map((c) => `<button class="mv-sw${c === p.c ? " on" : ""}" data-c="${c}" type="button" style="background:${c}" aria-label="Szín ${c}"></button>`).join("") + `</div>`;
  if (t === "text") {
    h += `<label class="mv-range"><span>Betűméret</span><input type="range" data-k="s" min="8" max="44" step="1" value="${px(p.s)}"><b data-v="s">${Math.round(px(p.s))} px</b></label>`
      + `<div class="mv-prev mv-prev-text" style="color:${p.c};font-size:${Math.min(28, px(p.s))}px">Minta szöveg</div>`;
  } else {
    const wmin = t === "hl" ? 4 : 0.8, wmax = t === "hl" ? 40 : 14;
    h += `<label class="mv-range"><span>Vastagság</span><input type="range" data-k="w" min="${wmin}" max="${wmax}" step="0.2" value="${px(p.w)}"><b data-v="w">${px(p.w)} px</b></label>`
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
    else { mv.popOpen = false; if (a !== "text") mvTextCommit(); }
    mv.tool = a; $("mv-scroll").classList.toggle("mv-drawing", a !== "pan");
    mvRenderBar(); mvRenderPop(); return;
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
  mvTextCommit();
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
    if (!mv || !mv.doc || ev.touches.length !== 2) return;
    if (mv.draw && !mv.draw.pan && mv.draw.s) { const s = mv.draw.s; mv.draw = null; mvDrawInk(s); } // félbehagyott vonás eldobása
    const r = scroll.getBoundingClientRect(), m = midpt(ev.touches);
    mv.pinch = { d0: dist(ev.touches), k: 1, m, ox: scroll.scrollLeft + m.x - r.left, oy: scroll.scrollTop + m.y - r.top };
    pages.style.transformOrigin = mv.pinch.ox + "px " + mv.pinch.oy + "px";
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
    pages.style.transform = ""; pages.style.transformOrigin = "";
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
        mvDrawItems(cv.getContext("2d"), items, cv.width, cv.height);
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
  mvDrawItems(ink.getContext("2d"), items, ink.width, ink.height);
  ctx.drawImage(ink, 0, 0);
  return cv;
}
async function mvCanvasBytes(cv) {
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}
