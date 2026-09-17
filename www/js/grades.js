// Jegyek és felajánlott jegyek.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Jegyek: átlagok/indexek + félévenként a jegyek ----
let gradesFilter = "all"; // "all" or a termName
// A grade badge coloured by how good the grade is (1 red → 5 green). Shows the NUMBER for any graded
// subject; only signature/"megfelelt" results (no numeric grade) show a check. Recomputes the number
// from the result text if it wasn't stored, so older reads render correctly too.
function isSignatureResult(r) { return /alá[ií]r|megfelelt|teljes[ií]t/i.test(String(r || "")); }
function gradeBox(e) {
  const v = (e.value != null) ? e.value : gradeValue(e.result);
  const g = (v >= 1 && v <= 5) ? v : 0;
  const inner = (v != null) ? String(v) : (isSignatureResult(e.result) || e.passed ? icon("check") : (e.result ? esc(e.result[0].toUpperCase()) : "–"));
  return `<span class="grade-box g${g}" title="${esc(e.result || "")}">${inner}</span>`;
}
function renderGrades() {
  const host = $("grades-scroll"); if (!host) return;
  const gr = state.grades;
  if (!gr || !gr.fetchedAt) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("note")}</div>`
      + `<h2>Nincs még jegy</h2><p>Olvasd be a vizsgajegyeidet és az átlagaidat a Neptunból.</p>`
      + `<button class="btn primary narrow" id="grades-read" style="margin-top:4px">${icon("note")} Beolvasás</button></div>`;
    const b = $("grades-read"); if (b) b.onclick = () => openDataSync(["grades"]);
    return;
  }
  const idx = gr.averages && gr.averages.indices, perTerm = (gr.averages && gr.averages.perTerm) || [];
  let html = "";
  // Megajánlott jegyek — accept/reject right here.
  const offered = gr.offered || [];
  if (offered.length) {
    html += `<div class="dash-label">Megajánlott jegyek</div>`;
    offered.forEach((o) => {
      html += `<div class="card offer-card"><div class="offer-top">`
        + `<div class="row-main"><span class="row-title">${esc(o.subject || o.code || "Tárgy")}</span><span class="row-sub">${[esc(o.code), o.deadline ? "határidő " + esc(ftDate(o.deadline)) : ""].filter(Boolean).join(" · ")}</span></div>`
        + gradeBox({ value: gradeValue(o.result), result: o.result }) + `</div>`
        + `<div class="offer-actions"><button class="btn outline" data-offrej="${esc(o.id)}" type="button">Elutasítás</button><button class="btn primary" data-offacc="${esc(o.id)}" type="button">Elfogadás</button></div></div>`;
    });
  }
  // Semester filter (Összes félév / one term).
  const terms = gr.terms || [];
  const termNames = terms.map((t) => t.termName).filter(Boolean);
  if (gradesFilter !== "all" && termNames.indexOf(gradesFilter) < 0) gradesFilter = "all";
  html += `<div class="controls" style="margin-bottom:6px"><button class="period-btn" id="grades-period" type="button"><span>${gradesFilter === "all" ? "Összes félév" : esc(gradesFilter)}</span>${icon("down")}</button></div>`;
  // Per-term averages map for the per-term stat headers.
  const avgByTerm = {}; perTerm.forEach((t) => { avgByTerm[t.termName] = t; });
  const norm = (s) => String(s || "").replace(/\s*\(.*\)\s*$/, "").trim();
  const attempts = gr.attempts || {};
  (gradesFilter === "all" ? terms : terms.filter((t) => t.termName === gradesFilter)).forEach((t) => {
    const a = avgByTerm[norm(t.termName)];
    // Highlighted header for this term with its stats (átlag / súlyozott / kreditindex).
    html += `<div class="dash-label" style="margin-top:18px">${esc(t.termName)}</div>`;
    if (a && (a.average != null || a.sumAverage != null || a.creditIndex != null)) {
      const cells = [];
      if (a.average != null) cells.push(["Átlag", a.average]);
      if (a.sumAverage != null) cells.push(["Súlyozott", a.sumAverage]);
      if (a.creditIndex != null) cells.push(["Kreditindex", a.creditIndex]);
      html += `<div class="card grade-idx">` + cells.map(([k, v], i) => `<div class="gi-cell${i ? " gi-div" : ""}"><div class="gi-v">${esc(String(v))}</div><div class="gi-k">${esc(k)}</div></div>`).join("") + `</div>`;
    }
    if (!t.subjects.length) { html += `<div class="dash-empty" style="padding:10px 4px">Nincs tárgy ebben a félévben.</div>`; return; }
    html += `<div class="card">` + t.subjects.map((s) => {
      const n = (attempts[s.subjectId] || []).length;
      const sub = [esc(s.code), s.credits ? esc(s.credits + " kr") : "", n > 1 ? esc(n + " jegy") : ""].filter(Boolean).join(" · ");
      return `<button class="row grade-row" data-sid="${esc(s.subjectId)}" type="button">`
        + `<span class="row-main"><span class="row-title">${esc(s.subject)}</span><span class="row-sub">${sub}</span></span>`
        + gradeBox(s) + `</button>`;
    }).join("") + `</div>`;
  });
  html += `<div class="hint center" style="margin-top:16px">${esc(freshText(gr.fetchedAt))}</div>`;
  host.innerHTML = html;
  const pb = $("grades-period");
  if (pb) pb.onclick = () => openList({ title: "Félév", selected: gradesFilter,
    items: [{ value: "all", label: "Összes félév" }].concat(termNames.map((n) => ({ value: n, label: n }))),
    onPick: (v) => { gradesFilter = v; renderGrades(); } });
  host.querySelectorAll("[data-sid]").forEach((b) => b.onclick = () => openGradeDetail(b.dataset.sid));
  host.querySelectorAll("[data-offacc]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offacc, true));
  host.querySelectorAll("[data-offrej]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offrej, false));
}
async function offeredDecide(id, accept) {
  const gr = state.grades; const o = (gr && gr.offered || []).find((x) => x.id === id); if (!o) return;
  const ok = await askTyped({ title: accept ? "Biztosan elfogadod?" : "Biztosan elutasítod?", okText: accept ? "Elfogadom" : "Elutasítom", cancelText: "Mégse", word: "IGEN",
    body: `<b>${esc(o.subject || o.code)}</b><br>Megajánlott jegy: <b>${esc(o.result || "—")}</b><br><br>${accept ? "Elfogadás után a jegy bekerül a leckekönyvbe, és ezt nem lehet visszavonni." : "Elutasítás után vizsgáznod kell a tárgyból."}<br>A megerősítéshez írd be, hogy <b>IGEN</b>.` });
  if (!ok) return;
  showBusy(accept ? "Elfogadás…" : "Elutasítás…", true);
  let r; try { r = await apiOfferedGradeDecision(id, accept); } catch (e) { r = { ok: false }; }
  if (r.ok) { try { await syncGrades(); } catch (e) {} }
  hideBusy();
  renderGrades();
  toast(r.ok ? (accept ? "Jegy elfogadva." : "Jegy elutasítva.") : ("Nem sikerült" + (r.detail ? ": " + r.detail : ".")));
}
// Tap a subject → sheet with its final grade + every recorded grade (exam attempts, retakes…).
function openGradeDetail(subjectId) {
  const gr = state.grades; if (!gr) return;
  let subj = null; (gr.terms || []).forEach((t) => t.subjects.forEach((s) => { if (s.subjectId === subjectId) subj = Object.assign({ termName: t.termName }, s); }));
  if (!subj) return;
  const list = (gr.attempts && gr.attempts[subjectId]) || [];
  let h = `<div class="sheet-title">${esc(subj.subject)}</div>`
    + `<div class="detail-meta">${[esc(subj.code), subj.credits ? esc(subj.credits + " kredit") : "", esc(subj.termName)].filter(Boolean).join(" · ")}</div>`;
  h += `<div class="grade-final">${gradeBox(subj)}<div><div class="gf-t">Végleges jegy</div><div class="gf-v">${esc(subj.result || (subj.passed ? "Teljesítve" : "—"))}</div></div></div>`;
  if (list.length) {
    h += `<div class="dash-label" style="margin-top:8px">Összes bejegyzett jegy</div><div class="card">`
      + list.map((e) => `<div class="row grade-row"><span class="row-main"><span class="row-title">${esc(e.result || "—")}</span><span class="row-sub">${[esc(e.type), e.date ? esc(ftDate(e.date)) : ""].filter(Boolean).join(" · ")}</span></span>${gradeBox(e)}</div>`).join("")
      + `</div>`;
  } else {
    h += `<div class="hint" style="margin-top:12px">Ehhez a tárgyhoz nincs külön vizsgabejegyzés — a leckekönyvi végleges jegy látszik.</div>`;
  }
  $("grade-body").innerHTML = h;
  $("grade-sheet").classList.remove("hidden");
}
let refreshingGrades = false;
async function refreshGrades(viaButton) {
  if (isOffline()) { toast("Nincs internet. A mentett adatokat látod."); return; }
  if (refreshingGrades) return;
  refreshingGrades = true;
  if (viaButton) showBusy("Jegyek frissítése…", true);
  let r; try { await totpTick(); r = await syncGrades(); } catch (e) { r = { ok: false }; }
  finally { refreshingGrades = false; if (viaButton) hideBusy(); }
  renderGrades();
  toast(r && r.ok ? "Jegyek frissítve." : "Nem sikerült frissíteni.");
}
// Üzenetek (discovered v0.149, direct API). Message list endpoints use FLAT firstRow/lastRow paging
// (NOT sortAndPage.*). Received list is data.receivedMessages, sent is data.messages. Normalized to a
// stable {id, from, subject, date, unread, hasAttachment, isSystem, sent} shape; body loaded on demand.
// Grade text ("Jeles"/"Jó"/"Kiválóan megfelelt (5)"/…) → numeric 1-5, or null for pass-only (aláírás).
function gradeValue(text) {
  const t = String(text || "").trim().toLowerCase();
  const m = t.match(/\((\d)\)/); if (m && +m[1] >= 1 && +m[1] <= 5) return +m[1]; // e.g. "Kiválóan megfelelt (5)"
  // Order matters. Note: \b fails around accented letters (ó), so match "jó" via a manual boundary.
  if (/elégtelen|elegtelen/.test(t)) return 1;
  if (/elégséges|elegséges|elegseges/.test(t)) return 2;
  if (/közepes|kozepes/.test(t)) return 3;
  if (/(^|[^a-z])j[óo]([^a-z]|$)/.test(t)) return 4; // "jó" / "jo" standalone
  if (/jeles|kivál/.test(t)) return 5;
  return null;
}
// Accept or reject an offered grade: POST OfferedGrades/AcceptOrRejectOfferedGrade {accept, indexLineEntryId}.
async function apiOfferedGradeDecision(id, accept) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  try {
    const r = await apiPost(sess, "OfferedGrades/AcceptOrRejectOfferedGrade", { accept: !!accept, indexLineEntryId: id });
    if (r && r.status >= 200 && r.status < 300) return { ok: true };
    let d = r && r.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    const msg = d && (d.message || (d.modelStateErrors && d.modelStateErrors[0] && d.modelStateErrors[0].errors && d.modelStateErrors[0].errors[0]));
    return { ok: false, detail: msg || ("hiba (" + (r && r.status) + ")") };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
{ const gc = $("grade-close"); if (gc) gc.onclick = () => $("grade-sheet").classList.add("hidden"); }
