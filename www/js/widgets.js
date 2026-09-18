// Híd a kezdőképernyő-widgetekhez (natív).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Current theme's accent (--brand-plus) as #RRGGBB, so the native widget's label can match the app theme.
function widgetAccentHex() {
  try {
    let c = getComputedStyle(document.documentElement).getPropertyValue("--brand-plus").trim();
    if (!c) return "#F5B221";
    if (c[0] === "#") return c;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(",").map((x) => parseInt(x.trim(), 10)); return "#" + p.slice(0, 3).map((n) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0")).join(""); }
    return "#F5B221";
  } catch (e) { return "#F5B221"; }
}
// Push the upcoming classes to the native home-screen widget (it picks current/next by the clock itself).
function updateClassWidget() {
  const W = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Widget;
  if (!W || !isNative) return;
  try {
    const now = Date.now();
    const evs = visibleClassEvents()
      .filter((e) => e.E && e.E.getTime() > now - 3600000) // keep the current one + everything ahead
      .sort((a, b) => a.S - b.S).slice(0, 40)
      .map((e) => { const p = parseClassSummary(e.summary) || {}; return { s: e.S.getTime(), e: e.E ? e.E.getTime() : 0, n: p.name || e.summary || "Óra", t: p.type || "", r: e.location || "" }; });
    W.setClasses({ events: JSON.stringify(evs), accent: widgetAccentHex() });
  } catch (e) {}
}
// Push the stat home-screen widgets: kreditindex, egyenleg, mai órák, következő számonkérés.
function updateStatWidgets() {
  const W = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Widget;
  if (!W || !isNative || !W.setStats) return;
  try {
    const stats = {};
    // Kreditindex (a korrigált a fő szám)
    const idx = state.grades && state.grades.averages && state.grades.averages.indices;
    if (idx && (idx.korrigalt != null || idx.kreditIndex != null)) {
      const v = idx.korrigalt != null ? idx.korrigalt : idx.kreditIndex;
      stats.credit = { l: idx.korrigalt != null ? "Korrigált kreditindex" : "Kreditindex", v: isNaN(+v) ? String(v) : (+v).toFixed(2).replace(".", ","), s: fmtTerm(idx.termName || "") };
    } else stats.credit = { l: "Kreditindex", v: "-", s: "Nincs adat" };
    // Egyenleg (fő HUF számla)
    const accts = (state.finance && state.finance.accounts) || [];
    const main = accts.find((a) => a.currency === "HUF") || accts[0];
    if (main) stats.balance = { l: "Egyenleg", v: ftFt(main.balance, main.currency), s: main.label || "Gyűjtőszámla" };
    else stats.balance = { l: "Egyenleg", v: "-", s: "Nincs adat" };
    // Mai órák száma + a következő ma
    const nowD = new Date(), t0 = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime(), t1 = t0 + 86400000;
    const todays = (visibleClassEvents() || []).filter((e) => e.S.getTime() >= t0 && e.S.getTime() < t1).sort((a, b) => a.S - b.S);
    if (todays.length) {
      const nx = todays.find((e) => e.E && e.E.getTime() > nowD.getTime());
      const p = nx ? (parseClassSummary(nx.summary) || {}) : null;
      stats.today = { l: "Mai órák", v: String(todays.length), s: nx ? ("Következő " + hm(nx.S) + " · " + (p.name || nx.summary || "")) : "Ma már nincs több óra" };
    } else stats.today = { l: "Mai órák", v: "0", s: "Nincs órád ma" };
    // Következő számonkérés
    const ex = (typeof nextAssessment === "function") ? nextAssessment() : null;
    if (ex) { const p = ex.manual ? null : parseClassSummary(ex.summary), n = daysUntil(ex.S);
      // b/bs: the big left column of the widget ("12" / "nap múlva", or "Ma" / "16:00")
      stats.exam = { l: "Következő számonkérés", t: (p && p.name) || ex.summary || "Számonkérés", s: [dayHeading(ex.S), hm(ex.S), ex.location].filter(Boolean).join(" · "),
        b: n <= 0 ? "Ma" : n === 1 ? "Holnap" : String(n), bs: n > 1 ? "nap múlva" : hm(ex.S) }; }
    else stats.exam = { l: "Következő számonkérés", t: "Nincs közelgő", s: "" };
    W.setStats({ stats: JSON.stringify(stats), accent: widgetAccentHex() });
  } catch (e) {}
}
