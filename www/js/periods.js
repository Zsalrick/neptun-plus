// Időszakok.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---------- Időszakok (periods) ----------
let refreshingPeriods = false;
function periodState(p, now) { // -1 lezárult, 0 aktív, 1 közelgő
  const f = p.from ? new Date(p.from).getTime() : null, t = p.to ? new Date(p.to).getTime() : null;
  if (t != null && !isNaN(t) && now > t) return -1;
  if (f != null && !isNaN(f) && now < f) return 1;
  return 0;
}
function activePeriods(items) { const now = Date.now(); return (items || []).filter((p) => periodState(p, now) === 0); }
function ftDateTime(v) {
  if (!v) return "—";
  const d = new Date(v); if (isNaN(d)) return esc(String(v));
  const day = TT_MON[d.getMonth()] + " " + d.getDate() + "., " + d.getFullYear();
  const hm = d.getHours() || d.getMinutes() ? " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "";
  return day + hm;
}
let periodsStatus = "active-soon", periodsTerm = "all";
const PERIOD_STATUS = { "active-soon": "Aktív és közelgő", active: "Aktív", soon: "Közelgő", off: "Lezárult", all: "Összes" };
function periodTermOf(p) { const m = String(p.name || "").match(/(\d{4}\/\d{2}\/\d)/); return m ? m[1] : null; }
// Neptun period names arrive ALL CAPS ("MEGAJÁNLOTT JEGYEK BEÍRÁSA…") — soften to sentence case if shouty.
function periodSentence(s) {
  s = String(s || "").trim(); if (!s) return s;
  const letters = (s.match(/\p{L}/gu) || []).length, uppers = (s.match(/\p{Lu}/gu) || []).length;
  if (letters && uppers / letters > 0.6) s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s;
}
function periodShortRange(p) {
  const fmt = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? "—" : TT_MON[d.getMonth()] + " " + d.getDate() + "."; };
  return fmt(p.from) + " – " + fmt(p.to);
}
function periodBadge(p, st, now) {
  const DAY = 86400000;
  if (st === 0 && p.to) { const d = Math.ceil((new Date(p.to).getTime() - now) / DAY); return d <= 0 ? "ma zárul" : "még " + d + " nap"; }
  if (st === 1 && p.from) { const d = Math.ceil((new Date(p.from).getTime() - now) / DAY); return d <= 0 ? "ma indul" : d + " nap múlva"; }
  return "";
}
function renderPeriods() {
  const host = $("periods-scroll"); if (!host) return;
  const data = state.periods;
  if (!data || !data.items || !data.items.length) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("clock")}</div>`
      + `<h2>Nincsenek időszakok</h2><p>Olvasd be a Neptunból, hogy lásd mikor mettől meddig tartanak a beiratkozási, tárgyfelvételi és vizsgajelentkezési időszakok.</p>`
      + `<button class="btn primary narrow" id="periods-read" style="margin-top:4px">${icon("clock")} Beolvasás</button></div>`;
    const b = $("periods-read"); if (b) b.onclick = () => openDataSync(["periods"]);
    return;
  }
  const now = Date.now();
  const terms = Array.from(new Set(data.items.map(periodTermOf).filter(Boolean)));
  if (periodsTerm !== "all" && terms.indexOf(periodsTerm) < 0) periodsTerm = "all";
  const allow = (st) => periodsStatus === "all" ? true : periodsStatus === "active-soon" ? (st === 0 || st === 1)
    : periodsStatus === "active" ? st === 0 : periodsStatus === "soon" ? st === 1 : st === -1;
  const items = data.items.filter((p) => allow(periodState(p, now)) && (periodsTerm === "all" || periodTermOf(p) === periodsTerm));
  const groups = [{ key: 0, label: "Aktív" }, { key: 1, label: "Közelgő" }, { key: -1, label: "Lezárult" }].map((g) => ({ ...g, items: [] }));
  items.forEach((p) => { const g = groups.find((x) => x.key === periodState(p, now)); if (g) g.items.push(p); });
  groups[0].items.sort((a, b) => new Date(a.to || 0) - new Date(b.to || 0));
  groups[1].items.sort((a, b) => new Date(a.from || 0) - new Date(b.from || 0));
  groups[2].items.sort((a, b) => new Date(b.to || 0) - new Date(a.to || 0));
  let html = `<div class="controls dd-row">`
    + `<button class="period-btn dd" id="per-status" type="button"><span>${esc(PERIOD_STATUS[periodsStatus])}</span>${icon("down")}</button>`
    + (terms.length ? `<button class="period-btn dd view-btn" id="per-term" type="button"><span>${periodsTerm === "all" ? "Minden félév" : esc(fmtTerm(periodsTerm))}</span>${icon("down")}</button>` : "")
    + `</div>`;
  if (!items.length) html += `<div class="dash-empty" style="padding:24px 4px">Nincs a szűrőnek megfelelő időszak.</div>`;
  groups.forEach((g) => {
    if (!g.items.length) return;
    html += `<div class="dash-label">${esc(g.label)} · ${g.items.length}</div><div class="card">`;
    g.items.forEach((p) => {
      const st = periodState(p, now), cls = st === 0 ? "on" : st === 1 ? "soon" : "off", badge = periodBadge(p, st, now);
      html += `<div class="period-row ${cls}">`
        + `<span class="pd-main"><span class="pd-name">${esc(periodSentence(p.name || p.type || "Időszak"))}</span>`
        + `<span class="pd-dates">${esc(periodShortRange(p))}</span></span>`
        + (badge ? `<span class="pd-when">${esc(badge)}</span>` : "") + `</div>`;
    });
    html += `</div>`;
  });
  html += `<div class="hint center" style="margin-top:16px">${esc(freshText(data.fetchedAt))}</div>`;
  host.innerHTML = html;
  const ps = $("per-status");
  if (ps) ps.onclick = () => openList({ title: "Állapot", selected: periodsStatus,
    items: Object.keys(PERIOD_STATUS).map((k) => ({ value: k, label: PERIOD_STATUS[k] })), onPick: (v) => { periodsStatus = v; renderPeriods(); } });
  const pt = $("per-term");
  if (pt) pt.onclick = () => openList({ title: "Félév", selected: periodsTerm,
    items: [{ value: "all", label: "Minden félév" }].concat(terms.map((t) => ({ value: t, label: t }))), onPick: (v) => { periodsTerm = v; renderPeriods(); } });
}
async function refreshPeriods(viaButton) {
  if (isOffline()) { toast("Nincs internet. A mentett adatokat látod."); return; }
  if (refreshingPeriods) return;
  refreshingPeriods = true;
  if (viaButton) showBusy("Időszakok frissítése…", true);
  let r; try { await totpTick(); r = await syncPeriods(); } catch (e) { r = { ok: false }; }
  finally { refreshingPeriods = false; if (viaButton) hideBusy(); }
  renderPeriods();
  toast(r && r.ok ? "Időszakok frissítve." : "Nem sikerült frissíteni.");
}
