// Kép-készítő és CSV export.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Megnyitja az Export képernyőt egy adott típussal előválasztva (pl. az órarend kép-gombjáról).
function openExportAt(id) { if (typeof EXPORTS !== "undefined" && EXPORTS.some((e) => e.id === id)) { exportCfg.what = id; exportCfg.f = exportDefaults(exportDef()); } pushScreen("tab-export"); }
// ---- Órarend képként (a heti nézet PNG-be, megosztható) ----
function weekClassesFrom(mon) { // mondayOf() lentebb van definiálva (függvénydeklaráció → hoistolódik)
  const end = new Date(mon); end.setDate(mon.getDate() + 7);
  return { mon, list: (visibleClassEvents() || []).filter((e) => e.S >= mon && e.S < end).sort((a, b) => a.S - b.S) };
}
function currentWeekClasses() { return weekClassesFrom(mondayOf(new Date())); }
function cvRoundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function cvClip(ctx, text, maxW) { text = String(text || ""); if (ctx.measureText(text).width <= maxW) return text; while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1); return text + "…"; }
function cvWrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text || "").split(/\s+/); let line = "", n = 0;
  for (let i = 0; i < words.length; i++) {
    const t = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y + n * lineH); n++; line = words[i]; if (n === maxLines - 1) { line = cvClip(ctx, line + " " + words.slice(i + 1).join(" "), maxW); break; } }
    else line = t;
  }
  ctx.fillText(cvClip(ctx, line, maxW), x, y + n * lineH);
}
async function saveTimetableImage() {
  const cv = timetableCanvas();
  if (!cv) { toast("Ezen a héten nincs órád."); return; }
  const { mon } = currentWeekClasses();
  await saveCanvasPng(cv, "orarend-" + mon.getFullYear() + "-" + (mon.getMonth() + 1) + "-" + mon.getDate() + ".png");
}
function timetableCanvas(monArg) {
  const { mon, list } = weekClassesFrom(monArg ? mondayOf(monArg) : mondayOf(new Date()));
  if (!list.length) return null;
  let maxDow = 4; // legalább hétfő-péntek
  list.forEach((e) => { const d = (e.S.getDay() + 6) % 7; if (d > maxDow) maxDow = d; });
  const days = maxDow + 1;
  let minH = 8, maxH = 20;
  list.forEach((e) => { minH = Math.min(minH, e.S.getHours()); maxH = Math.max(maxH, e.E.getHours() + (e.E.getMinutes() > 0 ? 1 : 0)); });
  minH = Math.max(0, minH); maxH = Math.min(24, Math.max(maxH, minH + 4));
  const scale = 2, pad = 16, gutter = 50, colW = 150, headH = 60, hourH = 56;
  const W = pad * 2 + gutter + days * colW, H = pad * 2 + headH + (maxH - minH) * hourH + 10;
  const cv = document.createElement("canvas"); cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext("2d"); ctx.scale(scale, scale);
  const cs = getComputedStyle(document.documentElement);
  const col = (n, d) => { const v = (cs.getPropertyValue(n) || "").trim(); return v || d; };
  const bg = col("--bg", "#0e1116"), card = col("--card", "#161a21"), fg = col("--fg", "#e8eaed"), muted = col("--muted", "#9aa0a6"), line = col("--line", "#2a2f37");
  const accent = (typeof widgetAccentHex === "function" ? widgetAccentHex() : "") || "#f5b221";
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg; ctx.font = "700 18px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("Órarend · " + TT_MON[mon.getMonth()] + " " + mon.getDate() + ".", pad, pad + 14);
  const gridX = pad + gutter, gridY = pad + headH;
  ctx.textBaseline = "middle";
  for (let h = minH; h <= maxH; h++) {
    const y = gridY + (h - minH) * hourH;
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gridX, y + 0.5); ctx.lineTo(W - pad, y + 0.5); ctx.stroke();
    ctx.fillStyle = muted; ctx.font = "12px sans-serif"; ctx.textAlign = "right"; ctx.fillText((h < 10 ? "0" : "") + h + ":00", gridX - 8, y);
  }
  const DAYS = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  for (let d = 0; d < days; d++) {
    const x = gridX + d * colW;
    ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x + 0.5, gridY); ctx.lineTo(x + 0.5, H - pad); ctx.stroke();
    const dd = new Date(mon); dd.setDate(mon.getDate() + d);
    ctx.textAlign = "center"; ctx.fillStyle = fg; ctx.font = "600 13px sans-serif"; ctx.fillText(DAYS[d], x + colW / 2, pad + headH / 2 + 2);
    ctx.fillStyle = muted; ctx.font = "11px sans-serif"; ctx.fillText(TT_MON[dd.getMonth()] + " " + dd.getDate() + ".", x + colW / 2, pad + headH / 2 + 20);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  list.forEach((e) => {
    const d = (e.S.getDay() + 6) % 7; if (d >= days) return;
    const startH = e.S.getHours() + e.S.getMinutes() / 60, endH = e.E.getHours() + e.E.getMinutes() / 60;
    const x = gridX + d * colW + 3, y = gridY + (startH - minH) * hourH + 2;
    const bh = Math.max(28, (endH - startH) * hourH - 4), bw = colW - 6;
    cvRoundRect(ctx, x, y, bw, bh, 8); ctx.fillStyle = card; ctx.fill();
    ctx.fillStyle = accent; cvRoundRect(ctx, x, y, 4, bh, 2); ctx.fill();
    const p = parseClassSummary(e.summary);
    ctx.fillStyle = fg; ctx.font = "600 12px sans-serif"; cvWrap(ctx, (p && p.name) || e.summary || "Óra", x + 10, y + 7, bw - 16, 14, 2);
    if (bh > 42) { ctx.fillStyle = muted; ctx.font = "11px sans-serif"; ctx.fillText(cvClip(ctx, hm(e.S) + "–" + hm(e.E) + (e.location ? " · " + e.location : ""), bw - 16), x + 10, y + bh - 17); }
  });
  ctx.fillStyle = muted; ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  ctx.fillText("Kredit+", W - pad, H - pad + 4);
  return cv;
}
// Közös mentés: PNG a Letöltések közé (natív), vagy <a> letöltés a böngészős előnézetben.
async function saveCanvasPng(cv, name) {
  const dataUrl = cv.toDataURL("image/png");
  const dl = DLP();
  if (isNative && dl && dl.saveToDownloads) {
    try {
      const r = await dl.saveToDownloads({ base64: dataUrl.split(",")[1], fileName: name, mime: "image/png" });
      const open = await ask({ title: "Kép mentve", okText: "Megnyitás", cancelText: "Kész", body: "Elmentve a Letöltések közé: <b>" + esc(name) + "</b>. Onnan meg tudod osztani." });
      if (open && r && r.uri) { try { await dl.open({ uri: r.uri, mime: "image/png" }); } catch (e) { toast("Nem sikerült megnyitni."); } }
    } catch (e) { toast("Nem sikerült menteni: " + (e && e.message ? e.message : e)); }
  } else {
    try { const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click(); toast("Kép letöltve."); } catch (e) { toast("A kép mentése a telefonos alkalmazásban működik."); }
  }
}
// CSV (pontosvesszős, HU Excel-barát, UTF-8 BOM-mal).
function csvCell(s) { s = String(s == null ? "" : s); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function buildCsv(rows) { return rows.map((r) => r.map(csvCell).join(";")).join("\r\n"); }
async function saveCsv(name, csv) {
  const data = "﻿" + csv, b64 = btoa(unescape(encodeURIComponent(data)));
  const dl = DLP();
  if (isNative && dl && dl.saveToDownloads) {
    try {
      const r = await dl.saveToDownloads({ base64: b64, fileName: name, mime: "text/csv" });
      const open = await ask({ title: "CSV mentve", okText: "Megnyitás", cancelText: "Kész", body: "Elmentve a Letöltések közé: <b>" + esc(name) + "</b>." });
      if (open && r && r.uri) { try { await dl.open({ uri: r.uri, mime: "text/csv" }); } catch (e) { toast("Nem sikerült megnyitni."); } }
    } catch (e) { toast("Nem sikerült menteni: " + (e && e.message ? e.message : e)); }
  } else {
    try { const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(data); a.download = name; a.click(); toast("CSV letöltve."); } catch (e) { toast("A mentés a telefonos alkalmazásban működik."); }
  }
}
function slugName(s) { return searchNorm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export"; }
// Kanvasz témaszínek az app CSS-változóiból (a kép a választott témát követi).
function exPalette() {
  const cs = getComputedStyle(document.documentElement); const col = (n, d) => { const v = (cs.getPropertyValue(n) || "").trim(); return v || d; };
  return { bg: col("--bg", "#0e1116"), card: col("--card", "#161a21"), fg: col("--fg", "#e8eaed"), muted: col("--muted", "#9aa0a6"), line: col("--line", "#2a2f37"), accent: (typeof widgetAccentHex === "function" ? widgetAccentHex() : "") || "#f5b221" };
}
// Megosztható képre SOHA nem tesszük rá a Neptun kódot/belépési nevet — csak az egyetemet.
function exWho() { return state.university || ""; }
// Bizonyítvány-kép egy félév jegyeiről: fejléc + tárgytáblázat (Kód · Tárgy · Kr · Jegy) + átlag lábléc.
// ---- Generikus dokumentum-kép: fejléc + táblázat. Minden lista-export ezt használja. ----
function exFmtDate(d) { if (!d) return ""; const x = new Date(d); return isNaN(x) ? "" : x.getFullYear() + ". " + TT_MON[x.getMonth()] + " " + x.getDate() + "."; }
function exDoc(spec) {
  const cols = spec.columns || [], rows = spec.rows || [];
  const scale = 2, W = 880, pad = 30, rowH = 32, headTop = 118, footH = spec.footer ? 56 : 18;
  const H = pad * 2 + headTop + (Math.max(rows.length, 1) + 1) * rowH + footH;
  const cv = document.createElement("canvas"); cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext("2d"); ctx.scale(scale, scale);
  const P = exPalette();
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = P.accent; ctx.font = "700 13px sans-serif"; ctx.fillText("KREDIT+", pad, pad + 12);
  ctx.fillStyle = P.fg; ctx.font = "700 24px sans-serif"; ctx.fillText(cvClip(ctx, spec.title || "", W - pad * 2), pad, pad + 42);
  ctx.fillStyle = P.muted; ctx.font = "13px sans-serif";
  ctx.fillText(cvClip(ctx, [spec.subtitle, exWho()].filter(Boolean).join(" · "), W - pad * 2), pad, pad + 64);
  // oszlopszélességek: a fix w-k után a maradékon a rugalmas oszlopok osztoznak
  const avail = W - pad * 2, fixed = cols.reduce((s, c) => s + (c.w || 0), 0), flex = cols.filter((c) => !c.w).length;
  const flexW = flex ? Math.max(80, (avail - fixed - 12 * (cols.length - 1)) / flex) : 0;
  let x = pad; const xs = cols.map((c) => { const w = c.w || flexW; const at = x; x += w + 12; return { at, w }; });
  const y = pad + headTop;
  ctx.font = "600 11px sans-serif"; ctx.fillStyle = P.muted;
  cols.forEach((c, i) => { const g = xs[i]; ctx.textAlign = c.align === "right" ? "right" : "left"; ctx.fillText(String(c.label || "").toUpperCase(), c.align === "right" ? g.at + g.w : g.at, y - 9); });
  ctx.textAlign = "left";
  ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y + 0.5); ctx.lineTo(W - pad, y + 0.5); ctx.stroke();
  if (!rows.length) { ctx.fillStyle = P.muted; ctx.font = "13px sans-serif"; ctx.fillText("Nincs megjeleníthető adat.", pad, y + 22); }
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    cols.forEach((c, ci) => {
      const g = xs[ci];
      ctx.fillStyle = c.dim ? P.muted : P.fg;
      ctx.font = (c.strong ? "700 13px" : "13px") + " sans-serif";
      ctx.textAlign = c.align === "right" ? "right" : "left";
      const val = (r[ci] == null || r[ci] === "") ? "–" : String(r[ci]);
      ctx.fillText(cvClip(ctx, val, g.w), c.align === "right" ? g.at + g.w : g.at, ry + 21);
    });
    ctx.textAlign = "left";
    ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(pad, ry + rowH + 0.5); ctx.lineTo(W - pad, ry + rowH + 0.5); ctx.stroke();
  });
  if (spec.footer) {
    ctx.fillStyle = P.fg; ctx.font = "600 14px sans-serif";
    ctx.fillText(cvClip(ctx, spec.footer, W - pad * 2), pad, y + Math.max(rows.length, 1) * rowH + 36);
  }
  return cv;
}
// ---- Export típusok ----
function exGradeTerms() { return (state.grades && state.grades.terms) || []; }
function exCourseSems() { const c = state.courses || {}; const s = (c.semesters && c.semesters.length) ? c.semesters : [...new Set((c.list || []).map((x) => x.semester))]; return s.filter(Boolean); }
function exSemList() { try { return (typeof allSemesters === "function" ? allSemesters() : []).slice().sort((a, b) => a.start - b.start); } catch (e) { return []; } }
function exSemRange(sem) { if (!sem) return null; try { return semKeyToObj(sem); } catch (e) { return null; } }
function exInSem(d, sem) { const r = exSemRange(sem); return !r || (d >= r.start && d < r.end); }
function exWeeks(sem) { const seen = {}; (visibleClassEvents() || []).forEach((e) => { if (!exInSem(e.S, sem)) return; seen[mondayOf(e.S).getTime()] = 1; }); return Object.keys(seen).map(Number).sort((a, b) => a - b); }
function exWeekLabel(ts, i) { const m = new Date(ts); return (i + 1) + ". hét · " + TT_MON[m.getMonth()] + " " + m.getDate() + "."; }
function exDays(sem) { const seen = {}; (visibleClassEvents() || []).forEach((e) => { if (!exInSem(e.S, sem)) return; const d = new Date(e.S); d.setHours(0, 0, 0, 0); seen[d.getTime()] = 1; }); return Object.keys(seen).map(Number).sort((a, b) => a - b); }
function exSemFilter() { return { id: "sem", label: "Félév", options: () => exSemList().map((s) => ({ v: s.key, label: s.key })) }; }
function exSemFilterAll() { return { id: "sem", label: "Félév", options: () => [{ v: "", label: "Mind" }].concat(exSemList().map((s) => ({ v: s.key, label: s.key }))) }; }
// Pénzügyi/időszak tétel egy félévbe esik-e: elsődlegesen a term mező, különben a megadott dátum tartomány szerint.
function exItemInSem(term, dateVal, sem) { if (!sem) return true; if (term && term === sem) return true; if (term && exSemList().some((s) => s.key === term)) return false; const d = dateVal ? new Date(dateVal) : null; return d && !isNaN(d) ? exInSem(d, sem) : false; }
function exGradeOf(code) { let hit = null; if (!code) return null; exGradeTerms().forEach((t) => (t.subjects || []).forEach((s) => { if (s.code === code) hit = s; })); return hit; }
const EXPORTS = [
  { id: "orarend-het", label: "Órarend · heti", group: "Órarend",
    filters: [exSemFilter(), { id: "week", label: "Hét", options: (f) => exWeeks(f.sem).map((ts, i) => ({ v: String(ts), label: exWeekLabel(ts, i) })) }],
    ok: () => exWeeks().length > 0,
    canvas: (f) => timetableCanvas(new Date(+f.week)),
    name: (f) => "orarend-" + exFmtDate(new Date(+f.week)) },
  { id: "orarend-nap", label: "Órarend · napi", group: "Órarend",
    filters: [exSemFilter(), { id: "day", label: "Nap", options: (f) => exDays(f.sem).map((ts) => ({ v: String(ts), label: exFmtDate(ts) })) }],
    ok: () => exDays().length > 0,
    doc: (f) => {
      const d0 = new Date(+f.day), d1 = new Date(d0); d1.setDate(d0.getDate() + 1);
      const list = (visibleClassEvents() || []).filter((e) => e.S >= d0 && e.S < d1).sort((a, b) => a.S - b.S);
      return { title: "Órarend · " + exFmtDate(d0), subtitle: list.length + " óra",
        columns: [{ label: "Idő", w: 110, strong: true }, { label: "Tárgy" }, { label: "Terem", w: 150 }, { label: "Oktató", w: 190, dim: true }],
        rows: list.map((e) => { const p = parseClassSummary(e.summary); return [hm(e.S) + " " + hm(e.E), (p && p.name) || e.summary, e.location, (p && p.teacher) || ""]; }) };
    },
    name: (f) => "orarend-" + exFmtDate(new Date(+f.day)) },
  { id: "vizsgak", label: "Vizsgák, számonkérések", group: "Órarend",
    filters: [exSemFilterAll(), { id: "scope", label: "Mit", options: () => [{ v: "next", label: "Csak a közelgők" }, { v: "all", label: "Összes" }] }],
    ok: () => (examEvents() || []).length > 0,
    doc: (f) => {
      const now = Date.now();
      let list = (examEvents() || []).slice().sort((a, b) => a.S - b.S);
      if (f.sem) list = list.filter((e) => exInSem(e.S, f.sem));
      if (f.scope !== "all") list = list.filter((e) => e.E.getTime() >= now);
      return { title: "Vizsgák, számonkérések", subtitle: [f.sem || "Minden félév", f.scope === "all" ? "összes" : "közelgő"].join(" · "),
        columns: [{ label: "Dátum", w: 150, strong: true }, { label: "Idő", w: 100 }, { label: "Esemény" }, { label: "Hely", w: 160, dim: true }],
        rows: list.map((e) => { const p = e.manual ? null : parseClassSummary(e.summary); return [exFmtDate(e.S), hm(e.S), (p && p.name) || e.summary, e.location]; }) };
    },
    name: (f) => "vizsgak" + (f.sem ? "-" + f.sem : "") },
  { id: "jegyek-felev", label: "Jegyek · félév", group: "Tanulmányok",
    filters: [{ id: "term", label: "Félév", options: () => exGradeTerms().map((t) => ({ v: t.termName, label: t.termName })) }],
    ok: () => exGradeTerms().length > 0,
    doc: (f) => {
      const t = exGradeTerms().find((x) => x.termName === f.term) || exGradeTerms()[0];
      const per = (((state.grades || {}).averages || {}).perTerm || []).find((p) => p.termName === t.termName);
      const foot = per ? [per.average != null ? "Átlag " + per.average : "", per.sumAverage != null ? "Súlyozott " + per.sumAverage : "", per.creditIndex != null ? "Kreditindex " + per.creditIndex : ""].filter(Boolean).join("      ") : "";
      return { title: "Jegyek · " + t.termName, subtitle: (t.subjects || []).length + " tárgy",
        columns: [{ label: "Kód", w: 130, dim: true }, { label: "Tárgy" }, { label: "Kr", w: 50, align: "right", dim: true }, { label: "Jegy", w: 120, align: "right", strong: true }],
        rows: (t.subjects || []).map((s) => [s.code, s.subject, s.credits || "", s.result || s.value || ""]), footer: foot };
    },
    name: (f) => "jegyek-" + (f.term || "") },
  { id: "jegyek-mind", label: "Tanulmányi kivonat", group: "Tanulmányok",
    filters: [], ok: () => exGradeTerms().length > 0,
    doc: () => {
      const rows = [];
      exGradeTerms().forEach((t) => (t.subjects || []).forEach((s) => rows.push([t.termName, s.code, s.subject, s.credits || "", s.result || s.value || ""])));
      const cr = exGradeTerms().reduce((a, t) => a + (t.subjects || []).reduce((b, s) => b + (+s.credits || 0), 0), 0);
      return { title: "Tanulmányi kivonat", subtitle: rows.length + " tárgy · " + exGradeTerms().length + " félév",
        columns: [{ label: "Félév", w: 110, dim: true }, { label: "Kód", w: 130, dim: true }, { label: "Tárgy" }, { label: "Kr", w: 50, align: "right", dim: true }, { label: "Jegy", w: 110, align: "right", strong: true }],
        rows, footer: "Összes felvett kredit " + cr };
    },
    name: () => "tanulmanyi-kivonat" },
  { id: "atlagok", label: "Átlagok félévenként", group: "Tanulmányok",
    filters: [], ok: () => ((((state.grades || {}).averages || {}).perTerm) || []).length > 0,
    doc: () => {
      const per = (((state.grades || {}).averages || {}).perTerm) || [];
      return { title: "Átlagok félévenként", subtitle: per.length + " félév",
        columns: [{ label: "Félév", strong: true }, { label: "Átlag", w: 130, align: "right" }, { label: "Súlyozott", w: 140, align: "right" }, { label: "Kreditindex", w: 150, align: "right" }],
        rows: per.map((p) => [p.termName, p.average, p.sumAverage, p.creditIndex]) };
    },
    name: () => "atlagok" },
  { id: "felvett", label: "Felvett tárgyak", group: "Tanulmányok",
    filters: [{ id: "sem", label: "Félév", options: () => exCourseSems().map((s) => ({ v: s, label: s })) }],
    ok: () => exCourseSems().length > 0,
    doc: (f) => {
      const list = (((state.courses || {}).list) || []).filter((c) => c.semester === f.sem);
      const cr = list.reduce((a, c) => a + (+c.credits || 0), 0);
      return { title: "Felvett tárgyak · " + (f.sem || ""), subtitle: list.length + " tárgy",
        columns: [{ label: "Kód", w: 140, dim: true }, { label: "Tárgy" }, { label: "Kr", w: 50, align: "right", dim: true }, { label: "Típus", w: 170, dim: true }],
        rows: list.map((c) => [c.code, c.name, c.credits || "", c.type || ""]), footer: "Összesen " + cr + " kredit" };
    },
    name: (f) => "felvett-targyak-" + (f.sem || "") },
  { id: "targy", label: "Tárgy adatlap", group: "Tanulmányok",
    filters: [
      { id: "sem", label: "Félév", options: () => exCourseSems().map((s) => ({ v: s, label: s })) },
      { id: "code", label: "Tárgy", options: (f) => (((state.courses || {}).list) || []).filter((c) => c.semester === f.sem).map((c) => ({ v: c.code || c.name, label: c.name || c.code })) },
    ],
    ok: () => exCourseSems().length > 0,
    doc: (f) => {
      const c = (((state.courses || {}).list) || []).find((x) => x.semester === f.sem && (x.code || x.name) === f.code);
      if (!c) return { title: "Tárgy adatlap", subtitle: "", columns: [{ label: "Mező", w: 220, dim: true }, { label: "Érték", strong: true }], rows: [] };
      const g = exGradeOf(c.code);
      const occ = (visibleClassEvents() || []).filter((e) => (c.code && (e.summary || "").indexOf(c.code) >= 0) || (c.name && (e.summary || "").indexOf(c.name) >= 0));
      const slots = [...new Set(occ.map((e) => TT_DAYS[e.S.getDay()] + " " + hm(e.S) + " " + hm(e.E) + (e.location ? " · " + e.location : "")))].slice(0, 6);
      const rows = [["Tárgynév", c.name], ["Tárgykód", c.code], ["Kredit", c.credits || ""], ["Típus", c.type || ""], ["Félév", c.semester || ""]];
      if (c.teacher) rows.push(["Oktató", c.teacher]);
      if (g) rows.push(["Eredmény", g.result || g.value || ""]);
      slots.forEach((s, i) => rows.push([i === 0 ? "Órarend" : "", s]));
      return { title: c.name || c.code || "Tárgy", subtitle: "Tárgy adatlap · " + (c.semester || ""),
        columns: [{ label: "Mező", w: 220, dim: true }, { label: "Érték", strong: true }], rows };
    },
    name: (f) => "targy-" + (f.code || "") },
  { id: "mintatanterv", label: "Mintatanterv", group: "Tanulmányok",
    filters: [{ id: "st", label: "Állapot", options: () => [{ v: "all", label: "Mind" }, { v: "done", label: "Teljesített" }, { v: "todo", label: "Hiányzó" }] }],
    ok: () => !!(state.curriculum && (((state.curriculum.required || []).length) || ((state.curriculum.free || []).length))),
    doc: (f) => {
      let list = [...(((state.curriculum || {}).required) || []), ...(((state.curriculum || {}).free) || [])];
      if (f.st === "done") list = list.filter((c) => c.completed);
      if (f.st === "todo") list = list.filter((c) => !c.completed);
      const cr = list.reduce((a, c) => a + (+c.credits || 0), 0);
      return { title: "Mintatanterv", subtitle: (f.st === "done" ? "Teljesített" : f.st === "todo" ? "Hiányzó" : "Összes") + " · " + list.length + " tárgy",
        columns: [{ label: "Kód", w: 140, dim: true }, { label: "Tárgy" }, { label: "Kr", w: 50, align: "right", dim: true }, { label: "Ajánlott", w: 100, align: "right", dim: true }, { label: "Állapot", w: 130, align: "right", strong: true }],
        rows: list.map((c) => [c.code, c.name, c.credits || "", c.term || "", c.completed ? "Teljesítve" : "Hiányzik"]), footer: "Összesen " + cr + " kredit" };
    },
    name: (f) => "mintatanterv-" + (f.st || "all") },
  { id: "penzugy", label: "Pénzügyi kivonat", group: "Pénzügy",
    filters: [{ id: "kind", label: "Mit", options: () => [{ v: "topay", label: "Befizetendő" }, { v: "imp", label: "Kiírt tételek" }, { v: "tx", label: "Tranzakciók" }, { v: "inv", label: "Számlák" }] }, exSemFilterAll()],
    ok: () => !!(state.finance && state.finance.fetchedAt),
    doc: (f) => {
      const fi = state.finance || {}, semTag = f.sem ? " · " + f.sem : "";
      if (f.kind === "tx") { const list = (fi.transactions || []).filter((t) => exItemInSem(null, t.date, f.sem));
        return { title: "Tranzakciók" + semTag, subtitle: list.length + " tétel",
          columns: [{ label: "Dátum", w: 150, dim: true }, { label: "Megnevezés" }, { label: "Állapot", w: 150, dim: true }, { label: "Összeg", w: 140, align: "right", strong: true }],
          rows: list.map((t) => [exFmtDate(t.date), t.note || t.type || "", t.status || "", (t.sign || "") + ftFt(t.value, t.currency)]) }; }
      if (f.kind === "inv") { const list = (fi.invoices || []).filter((v) => exItemInSem(null, v.date, f.sem));
        return { title: "Számlák" + semTag, subtitle: list.length + " db",
          columns: [{ label: "Dátum", w: 150, dim: true }, { label: "Megnevezés" }, { label: "Sorszám", w: 190, dim: true }, { label: "Összeg", w: 140, align: "right", strong: true }],
          rows: list.map((v) => [exFmtDate(v.date), v.name || "", v.number || "", ftFt(v.value, v.currency)]) }; }
      if (f.kind === "imp") { const list = (fi.impositions || []).filter((i) => exItemInSem(i.term, i.dueDate, f.sem));
        return { title: "Kiírt tételek" + semTag, subtitle: list.length + " tétel",
          columns: [{ label: "Megnevezés" }, { label: "Félév", w: 110, dim: true }, { label: "Határidő", w: 140, dim: true }, { label: "Állapot", w: 110, dim: true }, { label: "Összeg", w: 130, align: "right", strong: true }],
          rows: list.map((i) => [i.name, i.term || "", exFmtDate(i.dueDate), i.paidAt ? "Rendezve" : "Nyitott", ftFt(i.value, i.currency)]) }; }
      const tp = (fi.toPay || []).filter((i) => exItemInSem(i.term, i.dueDate, f.sem));
      return { title: "Befizetendő" + semTag, subtitle: tp.length + " tétel",
        columns: [{ label: "Megnevezés" }, { label: "Tárgy", w: 200, dim: true }, { label: "Határidő", w: 150, dim: true }, { label: "Összeg", w: 130, align: "right", strong: true }],
        rows: tp.map((i) => [i.name, i.subjectName || "", exFmtDate(i.dueDate), ftFt(i.value, i.currency)]),
        footer: "Összesen " + ftFt(tp.reduce((a, i) => a + (+i.value || 0), 0), "HUF") };
    },
    name: (f) => "penzugy-" + (f.kind || "topay") + (f.sem ? "-" + f.sem : "") },
  { id: "osztondij", label: "Ösztöndíjak, kifizetések", group: "Pénzügy",
    filters: [exSemFilterAll()], ok: () => !!(state.finance && (state.finance.scholarships || []).length),
    doc: (f) => {
      const s = (((state.finance || {}).scholarships) || []).filter((x) => exItemInSem(x.term, x.date, f.sem));
      return { title: "Ösztöndíjak, kifizetések" + (f.sem ? " · " + f.sem : ""), subtitle: s.length + " tétel",
        columns: [{ label: "Megnevezés" }, { label: "Félév", w: 120, dim: true }, { label: "Dátum", w: 150, dim: true }, { label: "Összeg", w: 140, align: "right", strong: true }],
        rows: s.map((x) => [x.name, x.term || "", exFmtDate(x.date), ftFt(x.amount, x.currency)]),
        footer: "Összesen " + ftFt(s.reduce((a, x) => a + (+x.amount || 0), 0), "HUF") };
    },
    name: (f) => "osztondijak" + (f.sem ? "-" + f.sem : "") },
  { id: "idoszakok", label: "Időszakok, határidők", group: "Egyéb",
    filters: [exSemFilterAll(), { id: "scope", label: "Mit", options: () => [{ v: "open", label: "Aktív és közelgő" }, { v: "all", label: "Összes" }] }],
    ok: () => !!(state.periods && (state.periods.items || []).length),
    doc: (f) => {
      const now = Date.now();
      let list = (((state.periods || {}).items) || []).slice().sort((a, b) => new Date(a.from) - new Date(b.from));
      if (f.sem) list = list.filter((p) => exItemInSem(p.termName || p.term, p.from, f.sem));
      if (f.scope !== "all") list = list.filter((p) => !p.to || new Date(p.to).getTime() >= now);
      return { title: "Időszakok, határidők" + (f.sem ? " · " + f.sem : ""), subtitle: [f.sem || "Minden félév", f.scope === "all" ? "összes" : "aktív és közelgő"].join(" · "),
        columns: [{ label: "Időszak", strong: true }, { label: "Típus", w: 230, dim: true }, { label: "Kezdet", w: 150 }, { label: "Vége", w: 150 }],
        rows: list.map((p) => [p.name || p.type, p.type || "", exFmtDate(p.from), exFmtDate(p.to)]) };
    },
    name: (f) => "idoszakok-" + (f.sem ? f.sem + "-" : "") + (f.scope || "open") },
];
// ---- Export képernyő: összeállító + élő előnézet ----
let exportCfg = { what: "orarend-het", f: {} };
function exportDef() { return EXPORTS.find((e) => e.id === exportCfg.what) || EXPORTS[0]; }
function exportEnsureFilters() {
  const def = exportDef(), f = exportCfg.f || (exportCfg.f = {});
  (def.filters || []).forEach((fl) => {
    const opts = fl.options(f) || [];
    if (!opts.some((o) => o.v === f[fl.id])) f[fl.id] = opts.length ? opts[0].v : "";
  });
}
// Ésszerű kezdőérték: az aktuális félév, azon belül az aktuális (vagy az első olyan) hét/nap, ahol van óra.
function exportDefaults(def) {
  const f = {};
  (def.filters || []).forEach((fl) => {
    const opts = fl.options(f) || [];
    if (fl.id === "sem") {
      if (opts.some((o) => o.v === "")) { f.sem = ""; } // van "Mind" opció (pénzügy/időszak/vizsga) → alapból Mind
      else { let cur = ""; try { cur = (typeof semObj === "function") ? semObj(new Date()).key : ""; } catch (e) {} f.sem = opts.some((o) => o.v === cur) ? cur : (opts.length ? opts[opts.length - 1].v : ""); }
    }
    else f[fl.id] = opts.length ? opts[0].v : "";
  });
  if (def.id === "orarend-het") { const ws = exWeeks(f.sem), now = mondayOf(new Date()).getTime(); const hit = ws.find((t) => t >= now); f.week = String(hit != null ? hit : (ws[0] || now)); }
  if (def.id === "orarend-nap") { const ds = exDays(f.sem), t0 = new Date(); t0.setHours(0, 0, 0, 0); const hit = ds.find((t) => t >= t0.getTime()); f.day = String(hit != null ? hit : (ds[0] || t0.getTime())); }
  return f;
}
function buildExportCanvas() {
  const def = exportDef(); exportEnsureFilters();
  if (def.canvas) return def.canvas(exportCfg.f);
  if (def.doc) return exDoc(def.doc(exportCfg.f));
  return null;
}
function renderExport() {
  const host = $("export-scroll"); if (!host) return;
  const avail = EXPORTS.filter((e) => { try { return e.ok(); } catch (err) { return false; } });
  if (!avail.length) { host.innerHTML = `<div class="dash-empty" style="padding:24px 12px">Előbb olvass be adatokat a Neptunból, utána tudsz exportálni.</div>`; return; }
  if (!avail.some((e) => e.id === exportCfg.what)) { exportCfg.what = avail[0].id; exportCfg.f = exportDefaults(exportDef()); }
  exportEnsureFilters();
  const def = exportDef();
  const canCsv = !!def.doc;
  // Tappable preview → opens the zoom viewer.
  let h = `<button id="export-preview" class="export-preview" type="button" aria-label="Előnézet megnyitása nagyításhoz"></button>`
    + `<div class="hint center" style="margin:2px 0 20px">Koppints az előnézetre a nagyításhoz.</div>`;
  // What to export — a single grouped, searchable dropdown (was a wall of chips).
  h += `<div class="dash-label">Mit exportálsz?</div>`
    + `<button class="period-btn" id="exp-what" type="button" style="margin-bottom:16px"><span>${esc(def.label)}</span>${icon("down")}</button>`;
  // Each parameter (hét, nap, félév…) — its own dropdown.
  (def.filters || []).forEach((fl) => {
    const opts = fl.options(exportCfg.f) || [];
    if (!opts.length) return;
    const cur = opts.find((o) => o.v === exportCfg.f[fl.id]) || opts[0];
    h += `<div class="dash-label">${esc(fl.label)}</div>`
      + `<button class="period-btn" data-fdd="${esc(fl.id)}" type="button" style="margin-bottom:16px"><span>${esc(cur.label)}</span>${icon("down")}</button>`;
  });
  // Save actions — stacked full width (PNG on top, CSV under it).
  h += `<div class="export-actions">`
    + `<button class="btn primary lg" id="exp-share">${icon("send")} Megosztás képként</button>`
    + `<button class="btn tonal" id="exp-save">${icon("download")} Mentés a Letöltésekbe (PNG)</button>`
    + `<button class="btn tonal" id="exp-csv"${canCsv ? "" : " disabled"}>${icon("doc")} Mentés táblázatként (CSV)</button></div>`;
  host.innerHTML = h;
  $("exp-what").onclick = () => openList({
    title: "Mit exportálsz?", searchable: avail.length > 8, selected: exportCfg.what,
    items: avail.map((e) => ({ value: e.id, label: e.label, sub: e.group })),
    onPick: (v) => { exportCfg.what = v; exportCfg.f = exportDefaults(exportDef()); renderExport(); },
  });
  host.querySelectorAll("[data-fdd]").forEach((btn) => {
    const fid = btn.dataset.fdd, fl = (def.filters || []).find((x) => x.id === fid); if (!fl) return;
    btn.onclick = () => {
      const opts = fl.options(exportCfg.f) || [];
      openList({ title: fl.label, searchable: opts.length > 8, selected: exportCfg.f[fid],
        items: opts.map((o) => ({ value: o.v, label: o.label })),
        onPick: (v) => { exportCfg.f[fid] = v; exportEnsureFilters(); renderExport(); } });
    };
  });
  { const b = $("exp-share"); if (b) b.onclick = exportShare; }
  { const b = $("exp-save"); if (b) b.onclick = exportSave; }
  { const b = $("exp-csv"); if (b && canCsv) b.onclick = exportCsv; }
  { const p = $("export-preview"); if (p) p.onclick = () => { let cv = null; try { cv = buildExportCanvas(); } catch (e) {} if (cv) openExportZoom(cv); }; }
  renderExportPreview();
}
// Full-screen zoomable viewer for the export preview (pinch, drag-pan, double-tap to reset).
function openExportZoom(srcCanvas) {
  let url; try { url = srcCanvas.toDataURL("image/png"); } catch (e) { return; }
  const ov = document.createElement("div"); ov.className = "zoom-ov";
  ov.innerHTML = `<button class="zoom-close iconbtn" type="button" aria-label="Bezárás">${icon("x")}</button>`
    + `<div class="zoom-stage"><img class="zoom-img" src="${url}" alt="Előnézet" draggable="false"></div>`
    + `<div class="zoom-hint">Csippentéssel nagyíthatsz. Dupla koppintás a visszaállításhoz.</div>`;
  document.body.appendChild(ov);
  const img = ov.querySelector(".zoom-img"), stage = ov.querySelector(".zoom-stage");
  let z = 1, tx = 0, ty = 0;
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${z})`; };
  const close = () => ov.remove();
  ov.querySelector(".zoom-close").onclick = close;
  const pts = new Map(); let startDist = 0, startZ = 1, anchor = null, startTx = 0, startTy = 0, lastTap = 0;
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, e);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; startDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); startZ = z; }
    else { anchor = { x: e.clientX, y: e.clientY }; startTx = tx; startTy = ty; }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pts.size === 2 && startDist) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); z = Math.max(1, Math.min(6, startZ * (d / startDist))); apply(); }
    else if (pts.size === 1 && z > 1 && anchor) { tx = startTx + (e.clientX - anchor.x); ty = startTy + (e.clientY - anchor.y); apply(); }
  });
  const up = (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) startDist = 0;
    if (z <= 1.01) { z = 1; tx = 0; ty = 0; apply(); }
    const now = Date.now(); if (now - lastTap < 300) { z = z > 1 ? 1 : 2.5; tx = 0; ty = 0; apply(); } lastTap = now;
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  // Tap the dark margin to close.
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
}
function renderExportPreview() {
  const box = $("export-preview"); if (!box) return;
  let cv = null; try { cv = buildExportCanvas(); } catch (e) {}
  box.innerHTML = "";
  if (!cv) { box.innerHTML = `<div class="dash-empty" style="padding:16px">Ehhez nincs elég adat. Olvasd be a Neptunból.</div>`; return; }
  cv.style.cssText = "max-width:100%;height:auto;border-radius:8px;display:block";
  box.appendChild(cv);
}
function exportFileName(ext) { const def = exportDef(); let n = def.id; try { if (def.name) n = def.name(exportCfg.f) || def.id; } catch (e) {} return slugName(n) + "." + ext; }
async function exportSave() {
  let cv = null; try { cv = buildExportCanvas(); } catch (e) {}
  if (!cv) { toast("Ehhez nincs elég adat."); return; }
  await saveCanvasPng(cv, exportFileName("png"));
}
// Megosztás a natív megosztó-lappal (Web Share API fájllal). Ha nem elérhető, mentésre esik vissza.
async function exportShare() {
  let cv = null; try { cv = buildExportCanvas(); } catch (e) {}
  if (!cv) { toast("Ehhez nincs elég adat."); return; }
  const name = exportFileName("png");
  try {
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    if (!blob) throw new Error("noblob");
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Kredit+" }); return; }
    throw new Error("unsupported");
  } catch (e) {
    if (e && e.name === "AbortError") return; // a felhasználó megszakította
    await saveCanvasPng(cv, name);
    toast("A közvetlen megosztás nem elérhető. A képet elmentettem a Letöltésekbe, onnan tudod megosztani.");
  }
}
function exportCsv() {
  const def = exportDef();
  if (!def.doc) { toast("Ez a típus csak képként menthető."); return; }
  let spec = null; try { spec = def.doc(exportCfg.f); } catch (e) {}
  if (!spec || !(spec.rows || []).length) { toast("Nincs exportálható sor."); return; }
  const rows = [spec.columns.map((c) => c.label)].concat(spec.rows.map((r) => r.map((v) => (v == null ? "" : v))));
  saveCsv(exportFileName("csv"), buildCsv(rows));
}
