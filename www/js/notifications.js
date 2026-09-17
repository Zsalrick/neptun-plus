// Értesítések: emlékeztetők, változás-riasztások, értesítési központ, reggeli összefoglaló.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---------- local notifications (reminders) ----------
function LN() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; }
function BR() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundRunner; }
// Seed the background runner (closed-app checks) with creds + base + on/off. It self-gates: with
// np_enabled != "1" or no creds it does nothing. Android may still throttle/kill the job (OEM battery
// optimizations), so this is best-effort — the reliable path is the in-app diff on open (notifyChanges).
async function seedBackgroundRunner(sess) {
  const br = BR(); if (!br || !isNative) return;
  const on = !!(state.notify && state.notify.changes && state.notify.changes.enabled);
  const details = {
    enabled: on ? "1" : "0",
    base: (sess && sess.base) || (typeof apiSession !== "undefined" && apiSession && apiSession.base) || "",
    username: state.username || "",
    password: state.password || "",
    no2fa: state.no2fa ? "1" : "0",
    totpSecret: (state.totp && state.totp.secret) || "",
    totpDigits: String((state.totp && state.totp.digits) || 6),
    totpPeriod: String((state.totp && state.totp.period) || 30),
  };
  try { await br.dispatchEvent({ label: "hu.neptun.autologin.check", event: "saveCreds", details }); } catch (e) {}
}
// Human lead label: "30 perc", "1 óra", "1 ó 30 p", "1 nap", "2 nap", "1 hét".
function fmtLead(min) {
  if (min % 10080 === 0) return (min / 10080) + " hét";
  if (min % 1440 === 0) return (min / 1440) + " nap";
  return fmtDur(min * 60000);
}
// Stable 31-bit integer id from occurrence key + lead (each reminder needs its own numeric id).
function notifId(e, lead) { const s = occKey(e) + "|" + lead; let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h) % 2000000000 || 1; }
async function ensureNotifPermission() {
  const ln = LN(); if (!ln) return false;
  try { let p = await ln.checkPermissions(); if (p.display !== "granted") p = await ln.requestPermissions(); return p.display === "granted"; }
  catch (e) { return false; }
}
// Pseudo-events for the Időszakok reminders: one per period opening ("start") or closing ("end"),
// so the generic scheduler below can treat them like any other timed event. Names are softened from
// the Neptun ALL-CAPS to sentence case (see DESIGN.md).
function periodNotifEvents(which) {
  const p = state.periods; if (!p || !p.items) return [];
  const out = [];
  p.items.forEach((it) => {
    const t = which === "start" ? it.from : it.to;
    if (!t) return;
    const S = new Date(t); if (isNaN(S)) return;
    const name = (typeof periodSentence === "function") ? periodSentence(it.name || it.type || "Időszak") : (it.name || it.type || "Időszak");
    out.push({ S, E: null, summary: name, location: "", _which: which });
  });
  return out;
}
// Cancel everything we scheduled, then re-schedule classes + ZH + exams + periods per their enabled reminders.
async function rescheduleNotifications() {
  const ln = LN(); if (!ln || !isNative) return;
  try {
    const pend = await ln.getPending();
    if (pend && pend.notifications && pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
  } catch (e) { /* ignore */ }
  const cfg = state.notify || {}, now = Date.now(), horizon = now + 40 * 864e5, out = [];
  const add = (events, catCfg, title, kind) => {
    if (!catCfg || !catCfg.enabled || !catCfg.leads || !catCfg.leads.length) return;
    events.forEach((e) => catCfg.leads.forEach((lead) => {
      const at = e.S.getTime() - lead * 60000;
      const p = (kind === "class") ? parseClassSummary(e.summary) : null;
      const short = p ? (p.name + (p.type ? " · " + p.type : "")) : (e.summary || "");
      const body = fmtLead(lead) + " múlva: " + short + (e.location ? " · " + e.location : "");
      const nm = p ? p.name : (e.summary || "Esemény");
      const detail = title + "\n" + nm + "\n" + dayHeading(e.S) + " · " + hm(e.S) + (e.E ? "–" + hm(e.E) : "") + (e.location ? "\n" + e.location : "") + (p && p.teacher ? "\n" + p.teacher : "");
      // Tappolásra az Értesítésekben nyílik meg; a "Megnyitás" az adott órára/vizsgára visz.
      const target = (kind === "class") ? { openClass: { sum: e.summary || "", s: e.S.getTime() } } : { tab: "tab-exams" };
      if (at > now + 15000 && e.S.getTime() < horizon) out.push({
        id: notifId(e, lead), title,
        body,
        schedule: { at: new Date(at), allowWhileIdle: true }, smallIcon: "ic_stat_neptun",
        extra: { kind, head: title, lead, summary: e.summary || "", location: e.location || "", s: e.S.toISOString(), e: e.E ? e.E.toISOString() : "",
          logOnTap: { kind: (kind === "class" ? "timetable" : "vizsga"), title, body, detail, target,
            data: { what: "reminder", ev: kind, lead, sum: e.summary || "", loc: e.location || "", s: e.S.getTime(), e: e.E ? e.E.getTime() : 0 } }, key: "rem-" + kind + "-" + e.S.getTime() + "-" + lead },
      });
    }));
  };
  add(visibleClassEvents(), cfg.classes, "Közelgő óra", "class");
  const exams = examEvents();
  add(exams.filter((e) => e.manual), cfg.zh, "Közelgő ZH", "zh");
  add(exams.filter((e) => !e.manual), cfg.vizsga, "Közelgő vizsga", "vizsga");
  add(periodNotifEvents("start"), cfg.periods, "Időszak nyílik", "period");
  add(periodNotifEvents("end"), cfg.periods, "Időszak zárul", "period");
  scheduleMorningBrief(out);
  if (!out.length) return;
  out.sort((a, b) => a.schedule.at - b.schedule.at);
  try { await ln.schedule({ notifications: out.slice(0, 64) }); } catch (e) { /* ignore */ }
}
// ---- Change alerts (Változás-értesítők) ----
// Egy órát a KURZUS + NAP azonosít (nem az időpont), hogy az időpont-változást ugyanannak az órának a
// módosulásaként lássuk (nem új+elmaradó óraként). A típus (Előadás/Gyakorlat) is a kulcsban, hogy az
// aznapi elmélet és gyakorlat ne keveredjen.
function classSeriesKey(e) {
  const p = parseClassSummary(e.summary) || {}; const d = e.S;
  const day = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  return ((p.name || e.summary || "") + "|" + (p.type || "") + "|" + day).toLowerCase();
}
// Ösztöndíj STABIL azonosítója: a Neptun id-je lekérésenként változhat (efemer), ezért tartalom alapján
// azonosítjuk (név + összeg + félév + dátum), különben minden frissítésnél újként riasztana.
function scholKey(s) { return [s.name || "", s.amount || "", s.term || "", s.date || ""].join("|"); }
// A compact "what we've seen" snapshot; notifyChanges() diffs the fresh data against the previous one.
function changeSnapshot() {
  const g = state.grades || {}, m = state.messages || {}, f = state.finance || {};
  const gradeKeys = [];
  (g.terms || []).forEach((t) => (t.subjects || []).forEach((s) => { if (s.value || s.result) gradeKeys.push((s.code || s.subject || "?") + "|" + (s.value || s.result)); }));
  const now = Date.now(), wEnd = now + 7 * 864e5;
  let classes = [];
  try { classes = (visibleClassEvents() || []).filter((e) => e.S && e.S.getTime() > now && e.S.getTime() < wEnd).map((e) => ({ sk: classSeriesKey(e), k: occKey(e), t: e.S.getTime(), te: e.E ? e.E.getTime() : 0, sum: e.summary || "", loc: e.location || "" })); } catch (e) {}
  return {
    gradeKeys,
    offered: (g.offered || []).map((o) => o.id).filter(Boolean),
    msgs: (m.received || []).map((x) => x.id).filter(Boolean),
    toPay: (f.toPay || []).map((x) => x.id).filter(Boolean),
    schols: (f.scholarships || []).map(scholKey),
    classes, at: now,
  };
}
// Fire a local notification for anything new since we last looked. First run only records the baseline.
// Every fired change is ALSO written to the in-app notification centre (state.notifLog) with a detailed
// description + a target, so the user can re-open it later and jump straight to the affected thing.
async function notifyChanges() {
  if (!isNative) return;
  const cur = changeSnapshot();
  const prev = state.seen;
  // Ha egy kategória adata most üres (nem töltött be / hibázott a sync), NE írjuk felül a korábbi baseline-t
  // — különben egy üres pillanatkép után minden réginek tűnő elem "újként" jönne vissza (a 201-es hamis riasztás).
  if (prev) ["gradeKeys", "offered", "msgs", "toPay", "schols"].forEach((k) => { if ((!cur[k] || !cur[k].length) && prev[k] && prev[k].length) cur[k] = prev[k].slice(); });
  state.seen = cur; saveState();
  const cat = (state.notify && state.notify.changes) || {};
  if (!prev || !cat.enabled) return; // no baseline yet, or category off → just record
  const setOf = (a) => new Set(a || []);
  const had = (a) => Array.isArray(a) && a.length > 0; // csak akkor riasztunk, ha volt korábbi, nem üres baseline
  const CAP = 15; // ekkora vagy nagyobb "új" tömeg baseline-hiba, nem valódi újdonság → elnyomjuk
  const news = [];
  // Új jegy
  const pg = setOf(prev.gradeKeys), ng = cur.gradeKeys.filter((k) => !pg.has(k));
  if (ng.length && had(prev.gradeKeys) && ng.length <= CAP) {
    const hits = []; ((state.grades && state.grades.terms) || []).forEach((t) => (t.subjects || []).forEach((s) => { if (ng.indexOf((s.code || s.subject || "?") + "|" + (s.value || s.result)) >= 0) hits.push(s); }));
    const body = (ng.length === 1 && hits[0]) ? (hits[0].subject || hits[0].code || "Tárgy") + " · " + (hits[0].result || hits[0].value) : ng.length + " új jegy";
    let detail = hits.length ? "Új jegyed érkezett:\n" + hits.map((s) => "· " + (s.subject || s.code) + ": " + (s.result || s.value) + (s.credits ? " (" + s.credits + " kr)" : "")).join("\n") : "Új jegyed érkezett a Neptunban.";
    const ix = (state.grades && state.grades.averages && state.grades.averages.indices) || {};
    const idxV = ix.korrigalt != null ? ix.korrigalt : ix.kreditIndex;
    if (idxV != null) detail += "\n\nKreditindexed most: " + idxV; // a jegy hatása az indexre
    news.push({ kind: "grades", title: "Új jegy", body, detail, target: { tab: "tab-grades" },
        data: { what: "grades", items: hits.map((s2) => ({ subject: s2.subject || "", code: s2.code || "", result: s2.result || s2.value || "", credits: s2.credits || "", term: s2.term || "" })), index: idxV } });
  }
  // Megajánlott jegy
  const po = setOf(prev.offered), no = cur.offered.filter((k) => !po.has(k));
  if (no.length && no.length <= CAP) news.push({ kind: "grades", title: "Megajánlott jegy", body: no.length === 1 ? "1 új megajánlott jegy vár rád" : no.length + " új megajánlott jegy", detail: "Megajánlott jegyed érkezett, amit a Jegyek oldalon elfogadhatsz vagy elutasíthatsz.", target: { tab: "tab-grades" } });
  // Új üzenet
  const pm = setOf(prev.msgs), nm = ((state.messages && state.messages.received) || []).filter((x) => x.id && !pm.has(x.id));
  if (nm.length && had(prev.msgs) && nm.length <= CAP) news.push({ data: { what: "messages", items: nm.slice(0, 6).map((x) => ({ from: x.from || "", subject: x.subject || "", date: x.date || x.lastPostDate || "" })) }, kind: "messages", title: "Új üzenet", body: nm.length === 1 ? [nm[0].from, nm[0].subject].filter(Boolean).join(" · ") : nm.length + " új üzenet", detail: nm.length === 1 ? ("Új üzeneted érkezett.\nFeladó: " + (nm[0].from || "?") + "\nTárgy: " + (nm[0].subject || "(nincs tárgy)")) : (nm.length + " új üzeneted érkezett a Neptunban."), target: { tab: "tab-messages" } });
  // Új befizetendő
  const pp = setOf(prev.toPay), np = ((state.finance && state.finance.toPay) || []).filter((x) => x.id && !pp.has(x.id));
  if (np.length && np.length <= CAP) {
    let fdetail;
    if (np.length === 1) {
      const it = np[0]; const dueLine = it.dueDate ? ("\nHatáridő: " + exFmtDate(it.dueDate) + dueDaysSuffix(it.dueDate)) : "";
      fdetail = "Új befizetendő tétel:\n" + (it.name || "Tétel") + " · " + ftFt(it.value, it.currency) + dueLine;
    } else fdetail = np.length + " új befizetendő tételed van.";
    news.push({ data: { what: "finance", items: np.slice(0, 6).map((x) => ({ name: x.name || "", value: x.value, currency: x.currency || "HUF", dueDate: x.dueDate || "", term: x.term || "", subject: x.subjectName || "" })) }, kind: "finance", title: "Új befizetendő", body: np.length === 1 ? (np[0].name || "Tétel") + " · " + ftFt(np[0].value, np[0].currency) : np.length + " új befizetendő tétel", detail: fdetail, target: { tab: "tab-fin-topay" } });
  }
  // Ösztöndíj jóváírva (pénz-pozitív)
  const ps = setOf(prev.schols), nsc = ((state.finance && state.finance.scholarships) || []).filter((x) => !ps.has(scholKey(x)));
  if (nsc.length && had(prev.schols) && nsc.length <= CAP) {
    const sum = nsc.reduce((a, x) => a + (+x.amount || 0), 0);
    const body = nsc.length === 1 ? (nsc[0].name || "Ösztöndíj") + " · " + ftFt(nsc[0].amount, nsc[0].currency) : nsc.length + " új kifizetés · " + ftFt(sum, "HUF");
    const detail = "Jóváírás érkezett:\n" + nsc.map((x) => "· " + (x.name || "Ösztöndíj") + ": " + ftFt(x.amount, x.currency) + (x.date ? " (" + exFmtDate(x.date) + ")" : "")).join("\n");
    news.push({ kind: "finance", title: "Ösztöndíj jóváírva", body, detail, target: { tab: "tab-fin-scholar" },
      data: { what: "schol", items: nsc.slice(0, 6).map((x) => ({ name: x.name || "", value: x.amount, currency: x.currency || "HUF", date: x.date || "", term: x.term || "" })) } });
  }
  // Órarend változott (következő 7 nap): új / elmaradó óra + IDŐPONT- és TEREMVÁLTOZÁS (miből → mire).
  // Az órát a kurzus+nap (sk) köti össze, így az időpont-változás nem új+elmaradó óraként jelenik meg.
  if (had(prev.classes) && prev.classes[0] && prev.classes[0].sk) { // csak ha a régi baseline már az új (sk) formátumú
    const prevBy = {}; (prev.classes || []).forEach((c) => { if (c.sk) prevBy[c.sk] = c; });
    const curBy = {}; cur.classes.forEach((c) => { curBy[c.sk] = c; });
    const nm = (c) => { const p = parseClassSummary(c.sum || ""); return (p && p.name) || c.sum || "Óra"; };
    const addedL = [], timeL = [], roomL = [], removedL = [];
    cur.classes.forEach((c) => {
      const p = prevBy[c.sk];
      if (!p) { addedL.push(c); }
      else if (p.t !== c.t) { timeL.push({ c, from: p.t }); }
      else if ((p.loc || "") !== (c.loc || "") && (p.loc || c.loc)) { roomL.push({ c, from: p.loc || "?" }); }
    });
    (prev.classes || []).forEach((c) => { if (c.t > Date.now() && !curBy[c.sk]) removedL.push(c); });
    const total = addedL.length + timeL.length + roomL.length + removedL.length;
    if (total && total <= CAP) {
      const body = [addedL.length ? addedL.length + " új óra" : "", timeL.length ? timeL.length + " időpont-változás" : "", roomL.length ? roomL.length + " teremváltozás" : "", removedL.length ? removedL.length + " elmaradó óra" : ""].filter(Boolean).join(" · ");
      const lines = [];
      addedL.forEach((c) => { const d = new Date(c.t); lines.push("Új óra: " + nm(c) + " · " + dayHeading(d) + " " + hm(d) + (c.loc ? " · " + c.loc : "")); });
      timeL.forEach((mv) => { const d = new Date(mv.c.t), o = new Date(mv.from); lines.push("Időpont változott: " + nm(mv.c) + " · " + dayHeading(d) + " · " + dayHeading(o) + " " + hm(o) + " → " + dayHeading(d) + " " + hm(mv.c.t) + (mv.c.loc ? " · " + mv.c.loc : "")); });
      roomL.forEach((mv) => { const d = new Date(mv.c.t); lines.push("Terem változott: " + nm(mv.c) + " · " + dayHeading(d) + " " + hm(d) + " · " + mv.from + " → " + (mv.c.loc || "?")); });
      removedL.forEach((c) => { const d = new Date(c.t); lines.push("Elmaradó óra: " + nm(c) + " · " + dayHeading(d) + " " + hm(d)); });
      const detail = "Változott az órarended:\n" + lines.join("\n");
      let target = { tab: "tab-timetable" };
      const only = (addedL.length === 1 && !timeL.length && !roomL.length && !removedL.length) ? addedL[0]
        : (timeL.length === 1 && !addedL.length && !roomL.length && !removedL.length) ? timeL[0].c
        : (roomL.length === 1 && !addedL.length && !timeL.length && !removedL.length) ? roomL[0].c : null;
      if (only) target = { openClass: { k: only.k, sum: only.sum, s: only.t } };
      const pack = (c, from) => ({ sum: c.sum || "", loc: c.loc || "", s: c.t, e: c.te || 0, from });
      news.push({ kind: "timetable", title: "Órarend változott", body, detail, target,
        data: { what: "ttchange", added: addedL.map((c) => pack(c)), time: timeL.map((mv) => pack(mv.c, mv.from)), room: roomL.map((mv) => pack(mv.c, mv.from)), removed: removedL.map((c) => pack(c)) } });
    }
  }
  if (!news.length) return;
  // 1) In-app értesítési központ — mindig, akkor is, ha az OS push tiltva van. Megjegyezzük az id-t,
  //    hogy a push megnyomásakor pont ezt a bejegyzést tudjuk megnyitni.
  const logged = news.slice(0, 6).map((n) => ({ n, id: logNotif({ kind: n.kind, title: n.title, body: n.body, detail: n.detail, target: n.target, data: n.data }) }));
  // 2) OS push — csak ha van engedély. A push a saját napló-bejegyzését nyitja meg (extra.notifId).
  const ln = LN(); if (!ln) return;
  try { const p = await ln.checkPermissions(); if (p.display !== "granted") return; } catch (e) { return; }
  const notifs = logged.map((L, i) => ({ id: 1300000000 + i, title: L.n.title, body: L.n.body, schedule: { at: new Date(Date.now() + 1500 + i * 400), allowWhileIdle: true }, smallIcon: "ic_stat_neptun", extra: { changeKind: L.n.kind, notifId: L.id } }));
  try { await ln.schedule({ notifications: notifs }); } catch (e) { /* ignore */ }
}
// ---- Értesítési központ (in-app napló) ----
function pruneNotifLog() { const cut = Date.now() - 30 * 864e5; state.notifLog = (state.notifLog || []).filter((n) => n.at >= cut).slice(0, 200); }
function logNotif(o) {
  if (!o) return null;
  state.notifLog = state.notifLog || [];
  const at = o.at || Date.now();
  if (o.key) { const ex = state.notifLog.find((n) => n.key === o.key); if (ex) { ex.at = at; ex.read = false; if (o.kind) ex.kind = o.kind; if (o.title) ex.title = o.title; if (o.body != null) ex.body = o.body; if (o.detail != null) ex.detail = o.detail; if (o.target) ex.target = o.target; if (o.data) ex.data = o.data; pruneNotifLog(); saveState(); updateNotifBell(); return ex.id; } }
  const id = uid();
  state.notifLog.unshift({ id, key: o.key || null, at, read: false, kind: o.kind || "", title: o.title || "", body: o.body || "", detail: o.detail || "", target: o.target || null, data: o.data || null });
  pruneNotifLog(); saveState(); updateNotifBell(); return id;
}
function logHas(id) { return (state.notifLog || []).some((n) => n.id === id); }
function notifUnread() { const now = Date.now(); return (state.notifLog || []).filter((n) => !n.read && n.at <= now).length; }
function updateNotifBell() { const n = notifUnread(), txt = n > 99 ? "99+" : String(n); document.querySelectorAll(".notif-bell-badge").forEach((b) => { b.textContent = txt; b.hidden = !n; }); }
const NOTIF_ICON = { grades: "note", messages: "mail", finance: "wallet", timetable: "calendar", brief: "clock", periods: "clock" };
function openNotifTarget(t) {
  if (!t) return;
  if (t.openClass) {
    try { const list = visibleClassEvents() || []; const e = list.find((x) => occKey(x) === t.openClass.k) || list.find((x) => x.summary === t.openClass.sum && Math.abs(x.S.getTime() - t.openClass.s) < 60000); if (e) { openDetail(e, false); return; } } catch (err) {}
    navTo("tab-timetable"); return;
  }
  if (t.tab) { openTab(t.tab); return; }
}
let detailNotifId = null, notifSearch = "", notifUnreadSnap = new Set();
function notifDayBucket(at, now) {
  const t = new Date(now), startToday = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  if (at >= startToday) return "Ma";
  if (at >= startToday - 86400000) return "Tegnap";
  if (at >= startToday - 6 * 86400000) return "Ezen a héten";
  return "Korábbi";
}
function renderNotifResults(all, now) {
  const box = $("notif-results"); if (!box) return;
  const q = notifSearch.trim().toLowerCase();
  const list = q ? all.filter((n) => ((n.title || "") + " " + (n.body || "")).toLowerCase().includes(q)) : all;
  if (!list.length) { box.innerHTML = `<div class="dash-empty" style="padding:26px 8px">Nincs találat.</div>`; return; }
  const groups = []; list.forEach((n) => { const b = notifDayBucket(n.at, now); let g = groups[groups.length - 1]; if (!g || g.name !== b) { g = { name: b, items: [] }; groups.push(g); } g.items.push(n); });
  box.innerHTML = groups.map((g) => `<div class="dash-label">${g.name}</div><div class="card">`
    + g.items.map((n) => `<button class="row notif-row${notifUnreadSnap.has(n.id) ? " unread" : ""}" data-nid="${esc(n.id)}" type="button">`
      + `<span class="row-ic">${icon(NOTIF_ICON[n.kind] || "note")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(n.title)}</span><span class="row-sub">${esc(n.body)}</span></span>`
      + `<span class="notif-when">${esc(fmtWhen(n.at))}</span></button>`).join("") + `</div>`).join("");
  box.querySelectorAll("[data-nid]").forEach((b) => b.onclick = () => { detailNotifId = b.dataset.nid; pushScreen("tab-notif"); });
}
function renderNotifs() {
  const host = $("notifs-scroll"); if (!host) return;
  const now = Date.now();
  const all = (state.notifLog || []).filter((n) => n.at <= now).sort((a, b) => b.at - a.at); // csak a már kiküldöttek
  notifUnreadSnap = new Set(all.filter((n) => !n.read).map((n) => n.id)); // pillanatkép, mielőtt olvasottá tesszük
  if (!all.length) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:48px 28px 8px"><div class="empty-ic">${icon("bell")}</div>`
      + `<h2>Nincs értesítés</h2><p>Itt jelennek meg az új jegyek, üzenetek, befizetnivalók és órarend-változások, amikről szólunk.</p></div>`;
  } else {
    host.innerHTML = `<div class="field-ic" style="margin-bottom:16px"><span class="ic-left">${icon("search")}</span>`
      + `<input class="input" id="notif-search" placeholder="Keresés az értesítésekben" value="${esc(notifSearch)}" autocomplete="off"></div>`
      + `<div id="notif-results"></div>`
      + `<button class="btn tonal" id="notif-clear" style="margin-top:16px">${icon("trash")} Összes törlése</button>`;
    const si = $("notif-search"); if (si) si.oninput = () => { notifSearch = si.value; renderNotifResults(all, now); };
    const c = $("notif-clear"); if (c) c.onclick = () => { state.notifLog = []; notifSearch = ""; saveState(); updateNotifBell(); renderNotifs(); };
    renderNotifResults(all, now);
  }
  // megnyitáskor a már kiküldöttek olvasottá válnak
  let changed = false; (state.notifLog || []).forEach((n) => { if (!n.read && n.at <= now) { n.read = true; changed = true; } });
  if (changed) { saveState(); updateNotifBell(); }
}
// Egy óra/vizsga minden ismert adata: a mentett összefoglalóból kibontva, és az élő órarendből kiegészítve
// (terem, oktató változhatott azóta). Visszaad: { rows: [[kulcs, érték]], ev } .
function notifEventInfo(d) {
  const rows = [], p = parseClassSummary(d.sum || "") || {};
  let ev = null;
  try {
    const list = (d.ev === "class" ? visibleClassEvents() : examEvents()) || [];
    ev = list.find((x) => x.S && Math.abs(x.S.getTime() - d.s) < 60000 && (x.summary || "") === (d.sum || ""))
      || list.find((x) => x.S && Math.abs(x.S.getTime() - d.s) < 60000);
  } catch (e) {}
  const pe = ev && !ev.manual ? (parseClassSummary(ev.summary) || {}) : {};
  const name = pe.name || p.name || (ev && ev.summary) || d.sum || "Óra";
  const S = new Date(d.s), E = d.e ? new Date(d.e) : (ev && ev.E) || null;
  rows.push(["Tárgy", name]);
  if (pe.code || p.code) rows.push(["Kurzus kódja", pe.code || p.code]);
  if (pe.type || p.type) rows.push(["Típus", pe.type || p.type]);
  if (pe.teacher || p.teacher) rows.push(["Oktató", pe.teacher || p.teacher]);
  rows.push(["Mikor", dayHeading(S) + " · " + hm(S) + (E ? "–" + hm(E) : "")]);
  if (E) { const min = Math.round((E - S) / 60000); rows.push(["Hossz", min >= 60 ? Math.floor(min / 60) + " óra" + (min % 60 ? " " + (min % 60) + " perc" : "") : min + " perc"]); }
  const loc = (ev && ev.location) || d.loc;
  if (loc) rows.push(["Terem", loc]);
  if (ev && ev.location && d.loc && ev.location !== d.loc) rows.push(["Terem az értesítéskor", d.loc]);
  rows.push(["Félév", semObj(S).key]);
  if (d.lead) rows.push(["Emlékeztető", "Kezdés előtt " + fmtLead(d.lead)]);
  const diff = d.s - Date.now();
  rows.push(["Állapot", diff > 0 ? "Kezdés " + fmtLead(Math.max(1, Math.round(diff / 60000))) + " múlva"
    : (E && E.getTime() > Date.now()) ? "Éppen tart" : "Véget ért"]);
  if (!ev) rows.push(["Megjegyzés", "Ez az esemény már nincs az órarendedben"]);
  return { rows, ev };
}
function notifCard(title, rows) {
  if (!rows || !rows.length) return "";
  return (title ? `<div class="section-label">${esc(title)}</div>` : "")
    + `<div class="card kv">` + rows.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(String(v))}</span></div>`).join("") + `</div>`;
}
// Órarend-változás egy sora: minden, amit tudunk róla, a régi értékkel együtt.
function notifChangeRows(x, kind) {
  const p = parseClassSummary(x.sum || "") || {}, S = new Date(x.s), E = x.e ? new Date(x.e) : null;
  const rows = [["Tárgy", p.name || x.sum || "Óra"]];
  if (p.code) rows.push(["Kurzus kódja", p.code]);
  if (p.type) rows.push(["Típus", p.type]);
  if (p.teacher) rows.push(["Oktató", p.teacher]);
  if (kind === "time") {
    const O = new Date(x.from);
    rows.push(["Eddig", dayHeading(O) + " · " + hm(O)]);
    rows.push(["Mostantól", dayHeading(S) + " · " + hm(S) + (E ? "–" + hm(E) : "")]);
  } else {
    rows.push(["Mikor", dayHeading(S) + " · " + hm(S) + (E ? "–" + hm(E) : "")]);
  }
  if (kind === "room") { rows.push(["Eddigi terem", x.from || "?"]); rows.push(["Új terem", x.loc || "?"]); }
  else if (x.loc) rows.push(["Terem", x.loc]);
  return rows;
}
function renderNotifDetail() {
  const host = $("notif-scroll"); if (!host) return;
  const n = (state.notifLog || []).find((x) => x.id === detailNotifId);
  const ttl = $("notif-title"); if (ttl) ttl.textContent = n ? n.title : "Értesítés";
  if (!n) { host.innerHTML = `<div class="dash-empty" style="padding:32px">Az értesítés már nem elérhető.</div>`; return; }
  if (!n.read) { n.read = true; saveState(); updateNotifBell(); } // push-ból megnyitva is olvasottá válik
  const when = new Date(n.at), d = n.data || null;
  let h = `<div class="card kv" style="padding:16px"><div class="dash-label" style="margin:0 0 6px">${esc(n.title)}</div>`
    + `<div class="hint" style="margin:0 0 12px">${esc(dayHeading(when))} · ${esc(hm(when))} · érkezett</div>`
    + `<div class="msg-text" style="white-space:pre-line">${esc(n.body || n.detail)}</div></div>`;
  let ev = null, matLink = "";
  if (d && d.what === "reminder") {
    const info = notifEventInfo(d); ev = info.ev;
    h += notifCard("Az esemény adatai", info.rows);
    if (ev && d.ev === "class") { try { matLink = matDetailLink(ev); } catch (e) {} }
  } else if (d && d.what === "ttchange") {
    const S = [["added", "Új óra"], ["time", "Időpont változott"], ["room", "Terem változott"], ["removed", "Elmaradó óra"]];
    S.forEach(([k, label]) => (d[k] || []).forEach((x, i) => {
      h += notifCard(label + ((d[k].length > 1) ? " (" + (i + 1) + "/" + d[k].length + ")" : ""), notifChangeRows(x, k));
    }));
  } else if (d && d.what === "grades") {
    (d.items || []).forEach((g) => {
      const rows = [["Tárgy", g.subject || g.code || "Tárgy"]];
      if (g.code) rows.push(["Tárgy kódja", g.code]);
      rows.push(["Jegy", g.result]);
      if (g.credits) rows.push(["Kredit", g.credits]);
      if (g.term) rows.push(["Félév", g.term]);
      h += notifCard("Jegy", rows);
    });
    if (d.index != null) h += notifCard("Hatás", [["Kreditindex az értesítéskor", d.index]]);
  } else if (d && d.what === "messages") {
    (d.items || []).forEach((m) => {
      const rows = [["Feladó", m.from || "?"], ["Tárgy", m.subject || "(nincs tárgy)"]];
      if (m.date) rows.push(["Dátum", exFmtDate(m.date) || m.date]);
      h += notifCard("Üzenet", rows);
    });
  } else if (d && (d.what === "finance" || d.what === "schol")) {
    (d.items || []).forEach((it) => {
      const rows = [["Megnevezés", it.name || "Tétel"], ["Összeg", ftFt(it.value, it.currency)]];
      if (it.dueDate) rows.push(["Határidő", exFmtDate(it.dueDate) + dueDaysSuffix(it.dueDate)]);
      if (it.date) rows.push(["Dátum", exFmtDate(it.date) || it.date]);
      if (it.term) rows.push(["Félév", it.term]);
      if (it.subject) rows.push(["Tárgy", it.subject]);
      h += notifCard(d.what === "schol" ? "Jóváírás" : "Befizetendő", rows);
    });
  } else if (n.detail && n.detail !== n.body) {
    h += `<div class="card" style="padding:16px"><div class="msg-text" style="white-space:pre-line">${esc(n.detail)}</div></div>`;
  }
  h += matLink;
  h += (n.target ? `<button class="btn primary lg" id="notif-open" style="margin-top:16px">${icon("chev")} Megnyitás</button>` : "");
  host.innerHTML = h;
  { const o = $("notif-open"); if (o) o.onclick = () => openNotifTarget(n.target); }
  { const ml = $("dn-mats"); if (ml) ml.onclick = () => openMatSubject(ml.dataset.sem, ml.dataset.name, ""); }
}
// ---- Morning brief (Reggeli összefoglaló) ----
// One-liner about a given day: hány óra, első óra, vizsga/ZH, befizetendő.
function morningBriefBody(day) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const inDay = (e) => e.S && e.S >= d0 && e.S < d1;
  let cls = [], exs = [];
  try { cls = (visibleClassEvents() || []).filter(inDay).sort((a, b) => a.S - b.S); } catch (e) {}
  try { exs = (examEvents() || []).filter(inDay); } catch (e) {}
  const parts = [];
  if (cls.length) {
    const first = cls[0], last = cls[cls.length - 1];
    const p = parseClassSummary(first.summary);
    const span = hm(first.S) + (last.E ? "–" + hm(last.E) : "");
    parts.push(cls.length + " óra " + span);
    parts.push("első: " + ((p && p.name) || first.summary || "óra") + (first.location ? " (" + first.location + ")" : ""));
  } else parts.push("Nincs órád ma");
  if (exs.length) { const e0 = exs.slice().sort((a, b) => a.S - b.S)[0]; const pe = parseClassSummary(e0.summary); parts.push(exs.length + " vizsga/ZH" + (exs.length === 1 ? " " + hm(e0.S) + " " + ((pe && pe.name) || "") : "")); }
  try { const f = state.finance; if (f && f.toPay && f.toPay.length) { const sum = f.toPay.reduce((s, i) => s + (+i.value || 0), 0); if (sum > 0) parts.push("Befizetendő " + ftFt(sum, "HUF")); } } catch (e) {}
  return parts.join(" · ");
}
// Schedule the next morning brief as a one-shot for the next occurrence of the chosen time.
// Re-runs on every open/resume (rescheduleNotifications), so its body reflects the freshest data.
function briefKey(d) { return "brief-" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function scheduleMorningBrief(out) {
  const b = state.notify && state.notify.brief; if (!b || !b.enabled) return;
  const m = /^(\d{1,2}):(\d{2})$/.exec(b.time || "07:00"); if (!m) return;
  const at = new Date(); at.setHours(+m[1], +m[2], 0, 0);
  if (at.getTime() <= Date.now() + 30000) at.setDate(at.getDate() + 1);
  const body = morningBriefBody(at);
  out.push({ id: 1290000001, title: "Mai nap", body, schedule: { at, allowWhileIdle: true }, smallIcon: "ic_stat_neptun",
    extra: { kind: "brief", logOnTap: { kind: "brief", title: "Mai nap", body, detail: body, target: { tab: "tab-timetable" } }, key: briefKey(at) } });
}
// A reggeli összefoglaló bekerül az Értesítésekbe is: ha mára már lejárt a brief ideje és még nincs mai
// bejegyzés, FRISSEN (a mostani adatból) kiszámoljuk és naplózzuk. Így a központban mindig helyes a nap.
function catchUpBrief() {
  const b = state.notify && state.notify.brief; if (!b || !b.enabled) return;
  if (!(state.ics && state.ics.events && state.ics.events.length)) return; // csak ha van órarend-adat
  const m = /^(\d{1,2}):(\d{2})$/.exec(b.time || "07:00"); if (!m) return;
  const t = new Date(); t.setHours(+m[1], +m[2], 0, 0);
  if (Date.now() < t.getTime()) return; // ma még nem járt le a brief ideje
  const key = briefKey(t);
  if ((state.notifLog || []).some((n) => n.key === key)) return; // a mai brief már megvan
  const body = morningBriefBody(t);
  logNotif({ kind: "brief", key, at: t.getTime(), title: "Mai nap", body, detail: body, target: { tab: "tab-timetable" } });
}
// Highlighted in-app alert shown when a reminder push is tapped.
function showNotifAlert(x) {
  if (!x) return;
  const S = x.s ? new Date(x.s) : null, E = x.e ? new Date(x.e) : null;
  const p = (x.kind === "class") ? parseClassSummary(x.summary) : null;
  $("notif-head").textContent = x.head || "Emlékeztető";
  $("notif-subj").textContent = p ? p.name : (x.summary || "Esemény");
  $("notif-meta").innerHTML = S ? `${icon("clock")} ${esc(dayHeading(S))} · ${hm(S)}${E && E > S ? "–" + hm(E) : ""}` : "";
  const teach = $("notif-teacher");
  const tline = p ? [p.type, p.teacher].filter(Boolean).join(" · ") : "";
  if (tline) { teach.hidden = false; teach.innerHTML = `${icon("user")} ${esc(tline)}`; } else teach.hidden = true;
  const loc = $("notif-loc"); if (x.location) { loc.hidden = false; loc.innerHTML = `${icon("pin")} ${esc(x.location)}`; } else loc.hidden = true;
  const lead = $("notif-lead"); if (x.lead) { lead.hidden = false; lead.innerHTML = `${icon("clock")} Emlékeztető ${esc(fmtLead(x.lead))} korábban`; } else lead.hidden = true;
  $("notif-sheet").classList.remove("hidden");
}
$("notif-ok").onclick = () => $("notif-sheet").classList.add("hidden");
