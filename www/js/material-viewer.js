// Anyag-megjelenítő: PDF oldalak + jegyzetréteg (toll, kiemelő, radír, szöveg), új oldal, megosztás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// A jegyzetek NORMALIZÁLT (0..1) koordinátákban tárolódnak az oldal szélességéhez/magasságához képest,
// így a nagyítás és a képernyőméret nem számít. A vastagság is az oldal szélességéhez viszonyított.
// Elem: { t:"ink", tool:"pen"|"hl", c, w, pts:[x,y,p, x,y,p, ...] } | { t:"text", x, y, s, c, text }
const MV_COLORS = { pen: ["#1b1d22", "#2457c5", "#c62f2f"], hl: ["#f2d33c", "#7fd48a", "#f39ac4"], text: ["#1b1d22", "#2457c5", "#c62f2f"] };
const MV_WIDTH = { pen: 0.0055, hl: 0.04 };
const MV_ZOOMS = [1, 1.5, 2, 3];
let mv = null;

async function openMaterial(id) {
  const m = matById(id); if (!m) { toast("Ez az anyag már nincs meg."); return; }
  mvClose();
  mv = { id, m, doc: null, pdf: null, z: 1, tool: "pan", color: { pen: 0, hl: 0, text: 0 }, penSeen: false, undo: [], slots: [], io: null, saving: Promise.resolve(), draw: null };
  pushScreen("tab-mat-view");
}
function renderMatView() {
  const pages = $("mv-pages"), ttl = $("mv-title");
  if (!pages) return;
  const scr = $("tab-mat-view"); if (scr) scr.scrollTop = 0; // a fejléc mindig látszódjon
  mvWireInput();
  if (!mv) { pages.innerHTML = `<div class="dash-empty" style="padding:24px">Nincs megnyitott anyag.</div>`; return; }
  if (ttl) ttl.textContent = mv.m.title;
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
  try { mv.io && mv.io.disconnect(); } catch (e) {}
  try { mv.pdf && mv.pdf.destroy(); } catch (e) {}
  mv = null;
}

// ---- Elrendezés és lusta renderelés ----
// anchor: { cx, cy, mx, my, k } a nagyítás a csípés közepén maradjon (lásd mvSetZoom).
function mvLayout(anchor) {
  const pages = $("mv-pages"), scroll = $("mv-scroll");
  if (!mv || !mv.doc || !pages) return;
  const ratio = scroll.scrollHeight ? scroll.scrollTop / scroll.scrollHeight : 0;
  try { mv.io && mv.io.disconnect(); } catch (e) {}
  const baseW = Math.max(240, Math.min(scroll.clientWidth - 24, 900));
  const cssW = Math.round(baseW * mv.z);
  pages.innerHTML = "";
  mv.slots = mv.doc.pages.map((pg, i) => {
    const el = document.createElement("div");
    el.className = "mv-page"; el.dataset.ix = i;
    const cssH = Math.round(cssW * (pg.h / pg.w));
    el.style.width = cssW + "px"; el.style.height = cssH + "px";
    el.innerHTML = `<canvas class="mv-pdf"></canvas><canvas class="mv-ink"></canvas><button class="mv-num" type="button" data-pix="${i}" aria-label="${i + 1}. oldal műveletei">${i + 1} ${icon("more")}</button>`;
    pages.appendChild(el);
    return { pg, el, cssW, cssH, pdfCv: el.children[0], inkCv: el.children[1], rendered: false, task: null };
  });
  scroll.classList.toggle("mv-drawing", mv.tool !== "pan");
  scroll.style.overflowX = mv.z > 1.001 ? "auto" : "hidden";
  mv.io = new IntersectionObserver((ents) => ents.forEach((en) => {
    const s = mv && mv.slots[+en.target.dataset.ix]; if (!s) return;
    if (en.isIntersecting) mvRenderSlot(s); else mvReleaseSlot(s);
  }), { root: scroll, rootMargin: "800px 0px" });
  mv.slots.forEach((s) => mv.io.observe(s.el));
  pages.querySelectorAll(".mv-num").forEach((b) => b.onclick = () => mvPageMenu(+b.dataset.pix));
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
  try { s.task && s.task.cancel(); } catch (e) {}
  s.rendered = false;
  for (const cv of [s.pdfCv, s.inkCv]) { cv.width = 0; cv.height = 0; }
}

// ---- Jegyzetréteg rajzolása ----
function mvDrawItems(ctx, items, W, H, live) {
  const all = live ? items.concat([live]) : items;
  ctx.clearRect(0, 0, W, H);
  for (const pass of ["hl", "pen"]) all.forEach((it) => { if (it.t === "ink" && it.tool === pass) mvDrawStroke(ctx, it, W, H); });
  all.forEach((it) => { if (it.t === "text") mvDrawText(ctx, it, W, H); });
}
function mvDrawStroke(ctx, it, W, H) {
  const p = it.pts; if (p.length < 3) return;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = it.c;
  if (it.tool === "hl") {
    // Egy darabban húzzuk, hogy az átfedő szakaszok ne sötétedjenek be.
    ctx.globalAlpha = 0.38; ctx.lineWidth = it.w * W;
    ctx.beginPath(); ctx.moveTo(p[0] * W, p[1] * H);
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i] * W, p[i + 1] * H);
    if (p.length === 3) ctx.lineTo(p[0] * W + 0.1, p[1] * H);
    ctx.stroke();
  } else {
    // Toll: középpontos simítás (felezőponttól felezőpontig, a pont a kontrollpont), szakaszonként a
    // nyomás szerinti vastagsággal. A kerek végek miatt a szakaszok hézag nélkül illeszkednek.
    const n = p.length / 3, X = (i) => p[i * 3] * W, Y = (i) => p[i * 3 + 1] * H;
    if (n === 1) { ctx.fillStyle = it.c; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(0.6, it.w * W * (0.5 + p[2])) / 2, 0, Math.PI * 2); ctx.fill(); }
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
function mvTextFont(it, W) { return `600 ${Math.max(6, it.s * W)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; }
function mvDrawText(ctx, it, W, H) {
  ctx.save(); ctx.fillStyle = it.c; ctx.font = mvTextFont(it, W); ctx.textBaseline = "top";
  String(it.text).split("\n").forEach((ln, i) => ctx.fillText(ln, it.x * W, it.y * H + i * it.s * W * 1.25));
  ctx.restore();
}
function mvDrawInk(s, live) {
  if (!s.rendered) return;
  const ctx = s.inkCv.getContext("2d");
  mvDrawItems(ctx, mv.doc.items[s.pg.id] || [], s.inkCv.width, s.inkCv.height, live);
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
  const op = mv && mv.undo.pop(); if (!op) return;
  const items = mv.doc.items;
  if (op.type === "add") { const arr = items[op.page] || []; const ix = arr.indexOf(op.item); if (ix >= 0) arr.splice(ix, 1); }
  else if (op.type === "remove") { const arr = (items[op.page] = items[op.page] || []); op.removed.sort((a, b) => a.ix - b.ix).forEach((r) => arr.splice(r.ix, 0, r.item)); }
  else if (op.type === "edit") { op.item.text = op.before; }
  else if (op.type === "addPage") { mv.doc.pages.splice(op.index, 1); delete items[op.pageId]; mvSave(); mvLayout(); mvRenderBar(); return; }
  else if (op.type === "delPage") { mv.doc.pages.splice(op.index, 0, op.page); if (op.items) items[op.page.id] = op.items; mvSave(); mvLayout(); mvRenderBar(); return; }
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
  mvWirePinch(scroll);
  $("mv-share").onclick = () => mvAction("share");
  scroll.addEventListener("pointerdown", (ev) => {
    if (!mv || !mv.doc || mv.tool === "pan" || mv.pinch) return;
    if (ev.target.closest && ev.target.closest(".mv-num")) return;
    if (ev.pointerType === "pen") mv.penSeen = true;
    // Tenyér-elutasítás: ha egyszer tollat láttunk, az ujj már csak görget.
    if (ev.pointerType === "touch" && mv.penSeen) { mv.draw = { pan: true, id: ev.pointerId, y: ev.clientY, x: ev.clientX }; return; }
    if (mv.draw) return; // egyszerre egy mozdulat
    const s = mvSlotAt(ev); if (!s) return;
    ev.preventDefault();
    try { scroll.setPointerCapture(ev.pointerId); } catch (e) {}
    const q = mvNorm(s, ev), pr = ev.pressure > 0 && ev.pointerType !== "mouse" ? ev.pressure : 0.5;
    if (mv.tool === "pen" || mv.tool === "hl") {
      mv.draw = { id: ev.pointerId, s, item: { t: "ink", tool: mv.tool, c: MV_COLORS[mv.tool][mv.color[mv.tool]], w: MV_WIDTH[mv.tool], pts: [q.x, q.y, pr] } };
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
  const end = async (ev) => {
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
    } else if (d.text && Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 10) {
      await mvTextAt(d.s, d.q);
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
async function mvTextAt(s, q) {
  const arr = (mv.doc.items[s.pg.id] = mv.doc.items[s.pg.id] || []);
  const W = s.inkCv.width || s.cssW, H = s.inkCv.height || s.cssH, ctx = s.inkCv.getContext("2d");
  const hit = arr.find((it) => { if (it.t !== "text") return false; const b = mvTextBox(it, W, H, ctx); return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h; });
  if (hit) {
    const t = await askText({ title: "Szöveg szerkesztése", value: hit.text, body: "Ürítsd ki a mezőt a törléshez." });
    if (t == null || !mv) return;
    if (!t.trim()) { const ix = arr.indexOf(hit); arr.splice(ix, 1); mvPush({ type: "remove", page: s.pg.id, removed: [{ ix, item: hit }] }); }
    else { mvPush({ type: "edit", page: s.pg.id, item: hit, before: hit.text }); hit.text = t; }
    mvSave(); mvDrawInk(s); return;
  }
  const t = await askText({ title: "Szöveg", placeholder: "Írd be a szöveget", body: "" });
  if (t == null || !t.trim() || !mv) return;
  const item = { t: "text", x: q.x, y: q.y, s: 0.034, c: MV_COLORS.text[mv.color.text], text: t };
  arr.push(item); mvPush({ type: "add", page: s.pg.id, item }); mvSave(); mvDrawInk(s);
}

// ---- Eszköztár ----
function mvRenderBar() {
  const bar = $("mv-bar"); if (!bar) return;
  if (!mv) { bar.innerHTML = ""; return; }
  const t = mv.tool, col = MV_COLORS[t] ? MV_COLORS[t][mv.color[t]] : null;
  const btn = (id, ic, label, on) => `<button class="mv-tool${on ? " on" : ""}" data-mv="${id}" type="button" aria-label="${label}" title="${label}">${icon(ic)}</button>`;
  bar.innerHTML = btn("pan", "hand", "Görgetés", t === "pan") + btn("pen", "pencil", "Toll", t === "pen") + btn("hl", "marker", "Kiemelő", t === "hl")
    + btn("eraser", "eraser", "Radír", t === "eraser") + btn("text", "text", "Szöveg", t === "text")
    + (col ? `<button class="mv-tool" data-mv="color" type="button" aria-label="Szín" title="Szín"><span class="mv-swatch" style="background:${col}"></span></button>` : "")
    + `<span class="mv-sep"></span>`
    + `<button class="mv-tool" data-mv="undo" type="button" aria-label="Visszavonás" title="Visszavonás"${mv.undo.length ? "" : " disabled"}>${icon("undo")}</button>`
    + btn("zoom", MV_ZOOMS.some((z) => z > mv.z + 0.01) ? "zoomin" : "zoomout", "Nagyítás: " + Math.round(mv.z * 100) + "%", mv.z > 1.001);
  bar.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => mvAction(b.dataset.mv));
}
function mvAction(a) {
  if (!mv) return;
  if (["pan", "pen", "hl", "eraser", "text"].includes(a)) {
    mv.tool = a; $("mv-scroll").classList.toggle("mv-drawing", a !== "pan"); mvRenderBar(); return;
  }
  if (a === "color") { mv.color[mv.tool] = (mv.color[mv.tool] + 1) % MV_COLORS[mv.tool].length; mvRenderBar(); return; }
  if (a === "undo") return mvUndo();
  if (!mv.doc) return;
  if (a === "zoom") { // a következő lépcsőre (100, 150, 200, 300%), a tetejéről vissza 100%-ra
    mvSetZoom(MV_ZOOMS.find((z) => z > mv.z + 0.01) || 1);
    toast("Nagyítás: " + Math.round(mv.z * 100) + "%");
    return;
  }
  if (a === "addpage") return mvAddPage(mvVisibleIx());
  if (a === "share") return matSharePdf(mv.id);
}
// A képernyő közepéhez legközelebbi oldal indexe.
function mvVisibleIx() {
  const scroll = $("mv-scroll"), mid = scroll.getBoundingClientRect().top + scroll.clientHeight / 2;
  let ix = mv.slots.length - 1, best = Infinity;
  mv.slots.forEach((s, i) => { const r = s.el.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < best) { best = d; ix = i; } });
  return ix;
}
// Csak a PDF-listát görgetjük. A scrollIntoView a teljes képernyőt is elgörgette, és eltűnt a fejléc.
function mvScrollToPage(ix) {
  const scroll = $("mv-scroll"), s = mv && mv.slots[ix]; if (!s) return;
  const top = scroll.scrollTop + s.el.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 12;
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
  const warn = pg.kind === "pdf" ? "Ez az eredeti PDF egyik oldala. Csak itt és a megosztott változatban tűnik el, maga a fájl nem változik." : (items && items.length ? "A rajta lévő jegyzetek is törlődnek." : "Üres oldal.");
  const ok = await ask({ title: "Oldal törlése", okText: "Törlés", cancelText: "Mégse", body: `Törlöd a(z) ${ix + 1}. oldalt?<br>${warn}<br><br>A Visszavonás gombbal visszahozható.` });
  if (!ok || !mv) return;
  pages.splice(ix, 1); delete mv.doc.items[pg.id];
  mvPush({ type: "delPage", index: ix, page: pg, items });
  mvSave(); mvLayout();
  toast("Oldal törölve.");
}
async function mvPageMenu(ix) {
  if (!mv || !mv.doc) return;
  const act = await askPick({ title: (ix + 1) + ". oldal", options: [
    { label: "Új üres oldal ez után", value: "add" },
    { label: "Oldal törlése", sub: mv.doc.pages.length <= 1 ? "Az utolsó oldal nem törölhető" : "", value: "del" }] });
  if (!mv) return;
  if (act === "add") mvAddPage(ix);
  else if (act === "del") mvDeletePage(ix);
}

// ---- Két ujjas csípés-nagyítás ----
// Gesztus közben csak CSS-transzformációval nagyítunk (gyors), elengedéskor rendereljük újra a valódi méretben.
const MV_ZMIN = 1, MV_ZMAX = 4;
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
