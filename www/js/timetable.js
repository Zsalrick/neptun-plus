// Órarend és vizsgák nézet, iCal frissítés.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

function openIcs() { $("ics-input").value = state.icsUrl || ""; $("ics-sheet").classList.remove("hidden"); }
$("ics-cancel").onclick = () => $("ics-sheet").classList.add("hidden");
$("ics-save").onclick = () => {
  const v = $("ics-input").value.trim();
  if (!v) return toast("Illeszd be a feliratkozási linket.");
  state.icsUrl = v; saveState(); $("ics-sheet").classList.add("hidden");
  updateIcsStatus(); renderTimetable(); renderExams(); fetchTimetable();
};
$("btn-ics").onclick = openIcs;
$("tt-refresh").onclick = fetchTimetable;
{ const ti = $("tt-image"); if (ti) ti.onclick = () => openExportAt("orarend-het"); }
$("ex-refresh").onclick = fetchTimetable;
function updateIcsStatus() { const s = $("ics-status"); if (s) s.textContent = state.icsUrl ? "Beállítva" : "Nincs beállítva"; }

async function fetchTimetable() {
  if (isOffline()) { toast("Nincs internet. A mentett órarendet látod."); return; }
  if (!state.icsUrl) return openIcs();
  $("tt-sub").textContent = "Frissítés folyamatban"; $("ex-sub").textContent = "Frissítés folyamatban";
  try {
    const url = state.icsUrl.replace(/^webcal:\/\//i, "https://");
    const res = await fetch(url);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("a link nem naptár adatot adott vissza");
    const events = parseICS(text);
    state.ics = { fetchedAt: new Date().toISOString(),
      events: events.map((e) => ({ s: e.start.toISOString(), e: e.end.toISOString(), allDay: !!e.allDay, summary: e.summary || "", location: e.location || "", categories: e.categories || "", description: e.description || "" })) };
    saveState(); renderTimetable(); renderExams(); renderHome(); rescheduleNotifications(); toast(events.length + " esemény frissítve.");
  } catch (err) {
    toast("Nem sikerült letölteni. " + (err && err.message ? err.message : ""));
    renderTimetable(); renderExams();
  }
}

// Generic agenda for either classes or exams, with a period dropdown.
let ttFilter = "upcoming", exFilter = "upcoming";
function periodBtn(cur) {
  return `<button class="period-btn dd" type="button"><span>${esc(cur === "upcoming" ? "Közelgő" : fmtTerm(cur))}</span>${icon("down")}</button>`;
}
// Defensive parse of a Neptun class summary like "Tárgy ( - KÓD) - Oktató - Típus".
// Returns null unless it clearly matches, so a differently-formatted feed just shows the raw text.
function parseClassSummary(summary) {
  const s = String(summary || "").trim();
  const m = s.match(/^(.+?)\s*\(([^)]*)\)\s*(.*)$/);
  if (!m) return null;
  const name = m[1].trim();
  const code = m[2].replace(/^[\s-]+/, "").trim();          // "ONVH_00"
  const rest = m[3].replace(/^[\s-]+/, "").trim();           // "dr. X - Tanóra"
  let teacher = "", type = "";
  if (rest) { const parts = rest.split(/\s+[-–—]\s+/); if (parts.length >= 2) { type = parts[parts.length - 1].trim(); teacher = parts.slice(0, -1).join(" - ").trim(); } else { teacher = rest; } }
  // Only treat as parsed if we actually gained structure (name + at least one of code/teacher/type).
  if (!name || (!code && !teacher && !type)) return null;
  return { name, code, teacher, type };
}
function renderAgenda(scroll, subEl, refreshBtn, examMode, filter, onFilter, extraCtrl) {
  if (!scroll) return;
  extraCtrl = extraCtrl || "";
  const hasFeed = !!state.icsUrl;
  if (refreshBtn) refreshBtn.hidden = !hasFeed;
  // Classes need the feed; exams can also come from manual entries.
  if (!examMode && !hasFeed) {
    subEl.textContent = "Feliratkozási link szükséges";
    scroll.innerHTML = `<div class="empty"><div class="empty-ic">${icon("calendar")}</div>
      <h2>Órarend</h2><p>Add meg egyszer a Neptun feliratkozási linkjét, és onnantól egy gombbal frissül.</p>
      <button class="btn primary ics-setup" style="width:auto">Feliratkozási link megadása</button></div>`;
    const b = scroll.querySelector(".ics-setup"); if (b) b.onclick = openIcs;
    return;
  }
  const items = examMode ? examEvents() : classEvents();
  const sems = agendaSemesters(); // period options come from the fetched semester list (empty → only "Közelgő")
  if (filter !== "upcoming" && !sems.some((x) => x.key === filter)) filter = "upcoming"; // stale/removed semester
  const now = Date.now();
  let list;
  if (filter === "upcoming") list = items.filter((e) => e.E.getTime() >= now).sort((a, b) => a.S - b.S);
  else { const s = sems.find((x) => x.key === filter); list = s ? items.filter((e) => e.S >= s.start && e.S < s.end).sort((a, b) => a.S - b.S) : []; }
  subEl.textContent = list.length + (examMode ? " számonkérés" : " óra");
  // Conflicts are computed over VISIBLE (non-hidden) classes, so hiding one of a clash clears it.
  // (The ongoing class is marked per row from the clock, in every filter.)
  const conflictSet = new Set();
  if (!examMode) {
    const vis = list.filter((e) => !isHiddenOcc(e));
    // Two visible classes whose time ranges overlap are a real conflict.
    for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) {
      if (vis[a].S < vis[b].E && vis[b].S < vis[a].E) { conflictSet.add(occKey(vis[a])); conflictSet.add(occKey(vis[b])); }
    }
  }

  let html = `<div class="controls dd-row">${periodBtn(filter)}${extraCtrl}${examMode ? `<button class="btn tonal narrow dd-add" id="add-exam">${icon("plus")} ZH</button>` : ""}</div>`;
  if (hasFeed) html += `<div class="tt-updated">${esc(freshText(state.ics && state.ics.fetchedAt))}</div>`;
  if (!list.length) {
    html += `<div class="hint center" style="margin-top:20px">${filter === "upcoming" ? (examMode ? "Nincs közelgő számonkérés." : "Nincs közelgő óra.") : "Nincs esemény ebben az időszakban."}</div>`;
  } else {
    // Idővonal (B+C koncepció): naponként egy függőleges vonal pöttyökkel, az órák halvány blokkokban.
    // Lezajlott = tömör szürke pötty, blokk nélkül · most = akcentus pötty + vonalszakasz, kiemelt blokk,
    // hátralévő idő és haladásjelző · következő = üres karika. A szünet szaggatott vonalszakasz.
    const today = new Date(), tmr = new Date(today), nowMs = today.getTime(); tmr.setDate(today.getDate() + 1);
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const dayMain = (d) => sameDay(d, today) ? "Ma" : sameDay(d, tmr) ? "Holnap" : cap(TT_DAYS[d.getDay()]);
    const daySub = (d) => (sameDay(d, today) || sameDay(d, tmr) ? TT_DAYS[d.getDay()] + ", " : "") + TT_MON[d.getMonth()] + " " + d.getDate() + ".";
    let lastDay = "", prevEnd = null, open = false;
    list.forEach((e, i) => {
      const dh = dayHeading(e.S), isToday = sameDay(e.S, today);
      if (dh !== lastDay) {
        if (open) html += `</div>`;
        const due = examMode && e.S.getTime() > nowMs && !isToday ? " · " + countdownPhrase(e.S) : "";
        html += `<div class="tl-dh${isToday ? " today" : ""}"><b>${esc(dayMain(e.S))}</b><i>${esc(daySub(e.S) + due)}</i></div><div class="tl">`;
        open = true; lastDay = dh; prevEnd = null;
      }
      // A break between two classes is a dashed stretch of the line, never a new day.
      if (!examMode && prevEnd) {
        const gap = e.S.getTime() - prevEnd.getTime();
        if (gap >= (state.breakMin || 20) * 60000) html += `<div class="tl-gap"><span></span><span class="tl-rail"></span><span>Szünet · ${fmtDur(gap)}</span></div>`;
      }
      if (!examMode) prevEnd = (!prevEnd || e.E > prevEnd) ? e.E : prevEnd;
      const k = occKey(e);
      const hidden = !examMode && isHiddenOcc(e), conflict = !examMode && conflictSet.has(k);
      const past = e.E.getTime() <= nowMs, live = !examMode && !hidden && !past && e.S.getTime() <= nowMs; // minden szűrőnél az idő dönt
      const p = !e.manual ? parseClassSummary(e.summary) : null; // exams too: "Tárgy ( - KÓD) - Oktató - Típus"
      const title = p ? p.name : (e.summary || (examMode ? "Számonkérés" : "Óra"));
      const noteCount = e.manual ? (e.note ? 1 : 0) : notesForEvent(e).length;
      const state1 = hidden ? `<span class="r-flag">Rejtve</span>` : conflict ? `<span class="r-flag bad">Ütközés</span>` : live ? `<span class="live">Most tart</span>` : "";
      const bits = [p ? p.type : "", e.location, p ? p.teacher : "", e.subject && e.subject !== e.summary ? e.subject : "",
        e.manual ? "saját" : "", noteCount ? noteCount + " jegyzet" : "", e.manual && e.note ? e.note : "", live ? "még " + fmtDur(e.E.getTime() - nowMs) : ""].filter(Boolean).map(esc);
      const meta = [state1].concat(bits).filter(Boolean).join(" · ");
      const pct = live ? Math.max(2, Math.min(100, Math.round((nowMs - e.S.getTime()) / (e.E.getTime() - e.S.getTime()) * 100))) : 0;
      html += `<button class="tl-r tt-event${past ? " past" : ""}${live ? " live" : ""}${hidden ? " muted" : ""}${conflict ? " conflict" : ""}" data-idx="${i}" type="button">`
        + `<span class="tl-tm"><b>${hm(e.S)}</b>${examMode ? "" : `<small>${hm(e.E)}</small>`}</span><span class="tl-rail"></span>`
        + `<span class="tl-blk"><span class="tl-n">${esc(title)}</span>${meta ? `<span class="tl-m">${meta}</span>` : ""}`
        + (live ? `<span class="tl-prog"><i style="width:${pct}%"></i></span>` : "") + `</span></button>`;
    });
    if (open) html += `</div>`;
  }
  scroll.innerHTML = html;
  const pb = scroll.querySelector(".period-btn");
  if (pb) pb.onclick = () => openList({ title: "Időszak", selected: filter,
    items: [{ value: "upcoming", label: "Közelgő" }].concat(sems.map((s) => ({ value: s.key, label: s.key }))),
    onPick: (v) => onFilter(v) });
  const add = scroll.querySelector("#add-exam"); if (add) add.onclick = openExamSheet;
  scroll.querySelectorAll(".tt-event").forEach((el) => el.onclick = () => openDetail(list[+el.dataset.idx], examMode));
  wireViewBtn(scroll);
}
// ---- View selector (Lista / Heti) — a dropdown next to the period one, timetable only ----
let ttView = "list", ttWeekStart = null; // ttWeekStart = Monday 00:00 of the shown week
function viewBtn() {
  return `<button class="period-btn dd view-btn" id="tt-viewbtn" type="button"><span>${ttView === "week" ? "Heti nézet" : "Lista"}</span>${icon("down")}</button>`;
}
function wireViewBtn(scroll) {
  const b = scroll.querySelector("#tt-viewbtn"); if (!b) return;
  b.onclick = () => openList({ title: "Nézet", selected: ttView,
    items: [{ value: "list", label: "Lista" }, { value: "week", label: "Heti" }],
    onPick: (v) => { ttView = v; renderTimetable(); } });
}
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); }
function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x; }
// Assign side-by-side columns to overlapping events within one day (interval graph, per cluster).
function layoutOverlaps(dayEvs) {
  let i = 0;
  while (i < dayEvs.length) {
    let j = i, end = dayEvs[i].E.getTime();
    while (j + 1 < dayEvs.length && dayEvs[j + 1].S.getTime() < end) { j++; end = Math.max(end, dayEvs[j].E.getTime()); }
    const cluster = dayEvs.slice(i, j + 1), colEnd = [];
    cluster.forEach((e) => { let c = 0; while (c < colEnd.length && colEnd[c] > e.S.getTime()) c++; colEnd[c] = e.E.getTime(); e._col = c; });
    cluster.forEach((e) => e._cols = colEnd.length);
    i = j + 1;
  }
}
function renderTimetableWeek() {
  const scroll = $("tt-scroll"), subEl = $("tt-sub"), refreshBtn = $("tt-refresh"); if (!scroll) return;
  const hasFeed = !!state.icsUrl;
  if (refreshBtn) refreshBtn.hidden = !hasFeed;
  if (!hasFeed) {
    subEl.textContent = "Feliratkozási link szükséges";
    scroll.innerHTML = `<div class="empty"><div class="empty-ic">${icon("calendar")}</div>`
      + `<h2>Órarend</h2><p>Add meg egyszer a Neptun feliratkozási linkjét, és onnantól egy gombbal frissül.</p>`
      + `<button class="btn primary ics-setup" style="width:auto">Feliratkozási link megadása</button></div>`;
    const b = scroll.querySelector(".ics-setup"); if (b) b.onclick = openIcs; return;
  }
  if (!ttWeekStart) ttWeekStart = mondayOf(new Date());
  const weekStart = ttWeekStart, weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const evs = classEvents().filter((e) => !isHiddenOcc(e) && e.S >= weekStart && e.S < weekEnd).sort((a, b) => a.S - b.S);
  subEl.textContent = evs.length + " óra";
  let maxDay = 4; evs.forEach((e) => { const di = (e.S.getDay() + 6) % 7; if (di > maxDay) maxDay = di; });
  const nDays = maxDay + 1;
  let minH = 8, maxH = 20;
  evs.forEach((e) => { minH = Math.min(minH, e.S.getHours()); maxH = Math.max(maxH, e.E.getHours() + (e.E.getMinutes() > 0 ? 1 : 0)); });
  const rowH = 46, hours = maxH - minH, today = new Date(), now = Date.now();
  const wkEnd = new Date(weekStart); wkEnd.setDate(wkEnd.getDate() + nDays - 1);
  const wkRange = weekStart.getMonth() === wkEnd.getMonth()
    ? `${TT_MON[weekStart.getMonth()]} ${weekStart.getDate()}-${wkEnd.getDate()}.`
    : `${TT_MON[weekStart.getMonth()]} ${weekStart.getDate()}. - ${TT_MON[wkEnd.getMonth()]} ${wkEnd.getDate()}.`;
  const wkLabel = isoWeek(weekStart) + ". hét · " + wkRange;
  const TT_DAY_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"]; // getDay() 0=V..6=Szo — distinct (Szerda≠Szombat)
  let daysHead = "";
  for (let d = 0; d < nDays; d++) { const dd = new Date(weekStart); dd.setDate(dd.getDate() + d);
    daysHead += `<div class="wk-day${sameDay(dd, today) ? " today" : ""}"><span class="wk-day-n">${esc(TT_DAY_SHORT[dd.getDay()])}</span><span class="wk-day-d">${dd.getDate()}</span></div>`; }
  let times = ""; for (let h = minH; h < maxH; h++) times += `<div class="wk-hour" style="height:${rowH}px">${h}:00</div>`;
  let cols = "";
  for (let d = 0; d < nDays; d++) {
    const dayEvs = evs.filter((e) => (e.S.getDay() + 6) % 7 === d);
    layoutOverlaps(dayEvs);
    let blocks = "";
    dayEvs.forEach((e) => {
      const startMin = (e.S.getHours() - minH) * 60 + e.S.getMinutes();
      const dur = Math.max(30, (e.E - e.S) / 60000);
      const top = startMin / 60 * rowH, height = dur / 60 * rowH;
      const w = 100 / e._cols, left = e._col * w;
      const p = e.manual ? null : parseClassSummary(e.summary);
      const isNow = e.S.getTime() <= now && e.E.getTime() > now;
      blocks += `<button class="wk-ev${isNow ? " now" : ""}" data-ek="${esc(occKey(e))}" type="button" style="top:${top}px;height:${Math.max(height - 3, 22)}px;left:${left}%;width:calc(${w}% - 3px)">`
        + `<span class="wk-ev-t">${esc(hm(e.S))}</span><span class="wk-ev-n">${esc(p ? p.name : (e.summary || "Óra"))}</span>${e.location ? `<span class="wk-ev-r">${esc(e.location)}</span>` : ""}</button>`;
    });
    const dd = new Date(weekStart); dd.setDate(dd.getDate() + d);
    cols += `<div class="wk-col${sameDay(dd, today) ? " today" : ""}" style="height:${hours * rowH}px">${blocks}</div>`;
  }
  scroll.innerHTML = `<div class="controls dd-row">` + viewBtn() + `</div>`
    + `<div class="wk-nav"><button class="wk-navbtn" id="wk-prev" type="button" aria-label="Előző hét">${icon("back")}</button>`
    +   `<button class="wk-today" id="wk-today" type="button">${esc(wkLabel)}</button>`
    +   `<button class="wk-navbtn" id="wk-next" type="button" aria-label="Következő hét">${icon("chev")}</button></div>`
    + `<div class="wk-head"><div class="wk-head-corner"></div><div class="wk-head-days" style="grid-template-columns:repeat(${nDays},1fr)">${daysHead}</div></div>`
    + `<div class="wk-grid"><div class="wk-times">${times}</div>`
    + `<div class="wk-body" style="grid-template-columns:repeat(${nDays},1fr);background-image:repeating-linear-gradient(to bottom,var(--line) 0,var(--line) 1px,transparent 1px,transparent ${rowH}px)">${cols}</div></div>`;
  wireViewBtn(scroll);
  $("wk-prev").onclick = () => { const s = new Date(weekStart); s.setDate(s.getDate() - 7); ttWeekStart = s; renderTimetable(); };
  $("wk-next").onclick = () => { const s = new Date(weekStart); s.setDate(s.getDate() + 7); ttWeekStart = s; renderTimetable(); };
  $("wk-today").onclick = () => { ttWeekStart = mondayOf(new Date()); renderTimetable(); };
  scroll.querySelectorAll(".wk-ev").forEach((el) => el.onclick = () => { const e = evs.find((x) => occKey(x) === el.dataset.ek); if (e) openDetail(e, false); });
}
function renderTimetable() {
  if (ttView === "week") return renderTimetableWeek();
  renderAgenda($("tt-scroll"), $("tt-sub"), $("tt-refresh"), false, ttFilter, (k) => { ttFilter = k; renderTimetable(); }, viewBtn());
}
function renderExams() { renderAgenda($("ex-scroll"), $("ex-sub"), $("ex-refresh"), true, exFilter, (k) => { exFilter = k; renderExams(); }); }
function refreshAgendas() { renderTimetable(); renderExams(); renderHome(); rescheduleNotifications(); updateClassWidget(); updateStatWidgets(); }
