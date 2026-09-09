// Minimal iCalendar (.ics) parser for Neptun timetable feeds.
// Returns an array of { start:Date, end:Date, allDay:bool, summary, location, description }.

function unfold(text) {
  // RFC5545 line folding: a CRLF followed by space/tab continues the previous line.
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}
function unescapeText(v) {
  return (v || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function parseDate(val) {
  if (/^\d{8}$/.test(val)) { // date only (all-day)
    return { d: new Date(+val.slice(0, 4), +val.slice(4, 6) - 1, +val.slice(6, 8)), allDay: true };
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) { const d = new Date(val); return { d: isNaN(d) ? null : d, allDay: false }; }
  const [, y, mo, da, h, mi, s, z] = m;
  const d = z ? new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s)) : new Date(+y, +mo - 1, +da, +h, +mi, +s);
  return { d, allDay: false };
}

function expand(events) {
  const out = [];
  for (const e of events) {
    if (!e.rrule || !/FREQ=WEEKLY/i.test(e.rrule) || !e.start || !e.end) { out.push(e); continue; }
    const p = {}; e.rrule.split(";").forEach((kv) => { const [k, v] = kv.split("="); p[k.toUpperCase()] = v; });
    const interval = +(p.INTERVAL || 1) || 1;
    const until = p.UNTIL ? (parseDate(p.UNTIL).d) : null;
    const count = p.COUNT ? +p.COUNT : null;
    const dur = e.end - e.start;
    let occ = 0; const cur = new Date(e.start);
    while (occ < 400) {
      if (until && cur > until) break;
      if (count !== null && occ >= count) break;
      out.push({ ...e, start: new Date(cur), end: new Date(cur.getTime() + dur), rrule: null });
      occ++;
      cur.setDate(cur.getDate() + 7 * interval);
      if (!until && count === null && occ >= 20) break; // safety cap for open-ended rules
    }
  }
  return out;
}

export function parseICS(text) {
  const lines = unfold(text || "");
  const events = [];
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    if (t === "BEGIN:VEVENT") { cur = {}; continue; }
    if (t === "END:VEVENT") { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(":"); if (idx < 0) continue;
    const left = line.slice(0, idx); const val = line.slice(idx + 1).trim();
    const name = left.split(";")[0].toUpperCase();
    if (name === "DTSTART") { const r = parseDate(val); cur.start = r.d; cur.allDay = r.allDay; }
    else if (name === "DTEND") { cur.end = parseDate(val).d; }
    else if (name === "SUMMARY") cur.summary = unescapeText(val);
    else if (name === "LOCATION") cur.location = unescapeText(val);
    else if (name === "DESCRIPTION") cur.description = unescapeText(val);
    else if (name === "CATEGORIES") cur.categories = unescapeText(val);
    else if (name === "RRULE") cur.rrule = val;
  }
  const expanded = expand(events).filter((e) => e.start);
  expanded.forEach((e) => { if (!e.end) e.end = new Date(e.start.getTime() + 60 * 60 * 1000); });
  expanded.sort((a, b) => a.start - b.start);
  return expanded;
}
