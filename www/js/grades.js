// Jegyek és felajánlott jegyek.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Jegyek: átlagok/indexek + félévenként a jegyek ----
let gradesFilter = "all"; // "all" or a termName
// Grade badge: a neutral numeral (no colour by value, see FRONTEND-design-frissites 1.). Shows the NUMBER
// for any graded subject; only signature/"megfelelt" results (no numeric grade) show a check. Recomputes
// the number from the result text if it wasn't stored, so older reads render correctly too.
function isSignatureResult(r) { return /alá[ií]r|megfelelt|teljes[ií]t/i.test(String(r || "")); }
function gradeBox(e) {
  const v = (e.value != null) ? e.value : gradeValue(e.result);
  const g = (v >= 1 && v <= 5) ? v : 0;
  const inner = (v != null) ? String(v) : (isSignatureResult(e.result) || e.passed ? icon("check") : (e.result ? esc(e.result[0].toUpperCase()) : "-"));
  return `<span class="grade-box g${g}" title="${esc(e.result || "")}">${inner}</span>`;
}
// Napló grade cell: the numeral with the grade word under it ("5 / jeles"), right-aligned in the row.
const GRADE_WORD = { 5: "jeles", 4: "jó", 3: "közepes", 2: "elégséges", 1: "elégtelen" };
function gradeCell(e) {
  const v = (e.value != null) ? e.value : gradeValue(e.result);
  if (v >= 1 && v <= 5) return `<span class="gcell"><b>${v}</b><small>${GRADE_WORD[v]}</small></span>`;
  const sig = isSignatureResult(e.result) || e.passed;
  return `<span class="gcell g0"><b>${sig ? icon("check") : "-"}</b><small>${esc(sig ? String(e.result || "teljesítve").toLowerCase() : (e.result ? String(e.result).toLowerCase() : "nincs jegy"))}</small></span>`;
}
const fmtIdx = (v) => (v == null || v === "" || isNaN(+v)) ? "-" : (+v).toFixed(2).replace(".", ",");
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
    html += `<h3 class="ma-h">Megajánlott jegyek</h3>`;
    offered.forEach((o) => {
      html += `<div class="card offer-card"><div class="offer-top">`
        + `<div class="row-main"><span class="row-title">${esc(o.subject || o.code || "Tárgy")}</span><span class="row-sub">${[esc(o.code), o.deadline ? "határidő " + esc(ftDate(o.deadline)) : ""].filter(Boolean).join(" · ")}</span></div>`
        + gradeBox({ value: gradeValue(o.result), result: o.result }) + `</div>`
        + `<div class="offer-actions"><button class="btn outline" data-offrej="${esc(o.id)}" type="button">Elutasítás</button><button class="btn primary" data-offacc="${esc(o.id)}" type="button">Elfogadás</button></div></div>`;
    });
  }
  // Semester filter (Összes félév / one term): the term label itself is the dropdown.
  const terms = gr.terms || [];
  const termNames = terms.map((t) => t.termName).filter(Boolean);
  if (gradesFilter !== "all" && termNames.indexOf(gradesFilter) < 0) gradesFilter = "all";
  const norm = (s) => fmtTerm(s);
  const avgByTerm = {}; perTerm.forEach((t) => { avgByTerm[norm(t.termName)] = t; });
  const attempts = gr.attempts || {};
  // Headline: the term the two figures describe. "Összes" → the dashboard's term (else the newest).
  const focusName = gradesFilter !== "all" ? gradesFilter : ((idx && idx.termName && termNames.find((n) => norm(n) === norm(idx.termName))) || termNames[0] || (idx && idx.termName) || "");
  const focusAvg = avgByTerm[norm(focusName)] || {};
  const useKorr = idx && idx.korrigalt != null && (gradesFilter === "all" || norm(idx.termName) === norm(focusName));
  const leftV = useKorr ? idx.korrigalt : focusAvg.creditIndex, leftK = useKorr ? "Korrigált kreditindex" : "Kreditindex";
  const focusTerm = terms.find((t) => t.termName === focusName);
  const doneCr = focusTerm ? focusTerm.subjects.reduce((n, x) => n + (((x.value != null ? x.value : gradeValue(x.result)) >= 2 || x.passed) ? (+x.credits || 0) : 0), 0) : null;
  html = `<div class="controls dd-row"><button class="period-btn dd" id="grades-period" type="button"><span>${gradesFilter === "all" ? "Összes félév" : esc(fmtTerm(gradesFilter))}</span>${icon("down")}</button></div>`
    + `<div class="gstats"><div class="gs"><div class="gs-v">${fmtIdx(leftV)}</div><div class="gs-k">${leftK}</div></div>`
    + `<div class="gs"><div class="gs-v">${fmtIdx(focusAvg.sumAverage)}</div><div class="gs-k">Súlyozott átlag</div></div></div>`
    + (doneCr != null ? `<p class="gs-note">${doneCr} kredit teljesítve ${gradesFilter === "all" ? "ebben a félévben · " + esc(fmtTerm(focusName)) : "ebben a félévben"}</p>` : "")
    + html; // offered grades (accept/reject) come right after the headline
  (gradesFilter === "all" ? terms : terms.filter((t) => t.termName === gradesFilter)).forEach((t) => {
    const a = avgByTerm[norm(t.termName)];
    const extra = a ? [a.average != null ? "Átlag " + fmtIdx(a.average) : "", a.creditIndex != null ? "Kreditindex " + fmtIdx(a.creditIndex) : "", a.sumAverage != null ? "Súlyozott " + fmtIdx(a.sumAverage) : ""].filter(Boolean).join(" · ") : "";
    html += `<h3 class="ma-h">${esc(fmtTerm(t.termName))}${extra ? `<span class="ma-h-sub">${extra}</span>` : ""}</h3>`;
    if (!t.subjects.length) { html += `<div class="dash-empty" style="padding:10px 4px">Nincs tárgy ebben a félévben.</div>`; return; }
    html += `<div class="rows">` + t.subjects.map((x) => {
      const n = (attempts[x.subjectId] || []).length;
      const sub = [x.credits ? esc(x.credits + " kredit") : "", esc(x.code), n > 1 ? esc(n + " jegy") : ""].filter(Boolean).join(" · ");
      return `<button class="r r-kv grade-row" data-sid="${esc(x.subjectId)}" type="button">`
        + `<span class="r-b"><span class="r-n">${esc(x.subject)}</span><span class="r-m">${sub}</span></span>`
        + `<span class="r-x">${gradeCell(x)}</span></button>`;
    }).join("") + `</div>`;
  });
  html += `<div class="hint center" style="margin-top:16px">${esc(freshText(gr.fetchedAt))}</div>`;
  host.innerHTML = html;
  const pb = $("grades-period");
  if (pb) pb.onclick = () => openList({ title: "Félév", selected: gradesFilter,
    items: [{ value: "all", label: "Összes félév" }].concat(termNames.map((n) => ({ value: n, label: fmtTerm(n) }))),
    onPick: (v) => { gradesFilter = v; renderGrades(); } });
  host.querySelectorAll("[data-sid]").forEach((b) => b.onclick = () => openGradeDetail(b.dataset.sid));
  host.querySelectorAll("[data-offacc]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offacc, true));
  host.querySelectorAll("[data-offrej]").forEach((b) => b.onclick = () => offeredDecide(b.dataset.offrej, false));
}
async function offeredDecide(id, accept) {
  const gr = state.grades; const o = (gr && gr.offered || []).find((x) => x.id === id); if (!o) return;
  const ok = await askTyped({ title: accept ? "Biztosan elfogadod?" : "Biztosan elutasítod?", okText: accept ? "Elfogadom" : "Elutasítom", cancelText: "Mégse", word: "IGEN",
    body: `<b>${esc(o.subject || o.code)}</b><br>Megajánlott jegy: <b>${esc(o.result || "nincs megadva")}</b><br><br>${accept ? "Elfogadás után a jegy bekerül a leckekönyvbe, és ezt nem lehet visszavonni." : "Elutasítás után vizsgáznod kell a tárgyból."}<br>A megerősítéshez írd be, hogy <b>IGEN</b>.` });
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
    + `<div class="detail-meta">${[esc(subj.code), subj.credits ? esc(subj.credits + " kredit") : "", esc(fmtTerm(subj.termName))].filter(Boolean).join(" · ")}</div>`;
  h += `<div class="grade-final">${gradeBox(subj)}<div><div class="gf-t">Végleges jegy</div><div class="gf-v">${esc(subj.result || (subj.passed ? "Teljesítve" : "—"))}</div></div></div>`;
  if (list.length) {
    h += `<h3 class="ma-h">Összes bejegyzett jegy</h3><div class="rows">`
      + list.map((e) => `<div class="r r-kv grade-row"><span class="r-b"><span class="r-n">${esc(e.result || "Nincs jegy")}</span><span class="r-m">${[esc(e.type), e.date ? esc(ftDate(e.date)) : ""].filter(Boolean).join(" · ")}</span></span><span class="r-x">${gradeCell(e)}</span></div>`).join("")
      + `</div>`;
  } else {
    h += `<div class="hint" style="margin-top:12px">Ehhez a tárgyhoz nincs külön vizsgabejegyzés. A leckekönyvi végleges jegy látszik.</div>`;
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
