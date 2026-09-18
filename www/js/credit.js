// Kredit oldal és diploma-haladás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Full-screen Kredit page (own page, not a popup).
function renderCreditPage() {
  const host = $("credit-scroll"); if (!host) return;
  const p = state.progress;
  if (!p || !p.total) {
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px">`
      + `<div class="empty-ic">${icon("chart")}</div>`
      + `<h2>Nincs még kredit adat</h2>`
      + `<p>Olvasd be a Neptunból a teljesített és az összes kreditet.</p>`
      + `<button class="btn primary narrow" id="cred-read" style="margin-top:4px">${icon("book")} Kredit beolvasása</button></div>`;
    const b = $("cred-read"); if (b) b.onclick = grabProgress;
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
  const free = Math.max(0, p.free || 0);
  const req = Math.max(0, p.done - free);
  const remaining = Math.max(0, p.total - p.done);
  const w = (n) => p.total > 0 ? (n / p.total * 100) : 0;
  const leg = (cls, label, val) => `<div class="cl"><span class="dot ${cls}"></span><span class="cl-t">${label}</span><span class="cl-v">${val} kr</span></div>`;
  host.innerHTML = `<div class="card cred-hero">`
    + `<div class="ch-num">${p.done} / ${p.total}</div>`
    + `<div class="ch-cap">teljesített kredit</div>`
    + `<div class="cred-bar" style="margin-top:16px"><div class="cred-fill" style="width:${pct}%"></div></div>`
    + `<div class="ch-pctline">${pct}%</div>`
    + `</div>`
    + `<div class="dash-label">Megoszlás</div>`
    + `<div class="card" style="padding:16px">`
    +   `<div class="cbar">`
    +     (req ? `<span class="cseg s-req" style="width:${w(req)}%"></span>` : "")
    +     (free ? `<span class="cseg s-free" style="width:${w(free)}%"></span>` : "")
    +     `</div>`
    +   `<div class="clegend">`
    +     leg("s-req", "Kötelező teljesített", req)
    +     leg("s-free", "Szabadon választható", free)
    +     leg("s-rem", "Hátralévő", remaining)
    +     `</div>`
    + `</div>`
    + diplomaBlock(p, remaining)
    + `<div class="hint center" style="margin-top:16px">${esc(freshText(p.fetchedAt))}</div>`;
}
// Diploma-haladás: becsült hátralévő félévek (30 kr/félév) + a mintatanterv tárgyainak készültsége.
function diplomaBlock(p, remaining) {
  const semLeft = remaining > 0 ? Math.ceil(remaining / 30) : 0;
  const cur = state.curriculum;
  const req = (cur && cur.required) || [];
  const subTot = req.length;
  const subDone = req.filter((x) => x.completed).length;
  const subPct = subTot ? Math.round(subDone / subTot * 100) : 0;
  const stat = (val, lbl) => `<div style="min-width:120px"><div style="font-size:24px;font-weight:800;letter-spacing:-.02em;font-family:var(--font-brand)">${esc(val)}</div><div style="font-size:12.5px;color:var(--muted,#9aa0a6);margin-top:2px">${esc(lbl)}</div></div>`;
  let h = `<div class="dash-label">Diploma-haladás</div><div class="card" style="padding:16px">`;
  h += `<div class="dip-stats" style="display:flex;gap:18px;flex-wrap:wrap">`
    + stat(semLeft <= 0 ? "Kész" : "≈ " + semLeft + " félév", semLeft <= 0 ? "minden kredit megvan" : "van hátra (30 kr/félév)")
    + (subTot ? stat(subPct + "%", subDone + " / " + subTot + " tantervi tárgy kész") : "")
    + `</div>`;
  if (subTot) h += `<div class="cred-bar" style="margin-top:14px"><div class="cred-fill" style="width:${subPct}%"></div></div>`;
  h += `<div class="hint" style="margin-top:12px">${remaining} kredit van hátra a ${p.total} kredites képzésből.${subTot ? "" : " A tantervi arányhoz olvasd be a mintatantervet."}</div>`;
  h += `</div>`;
  return h;
}
// Credit refresh (topic-scoped): silent direct API via syncCredit, no "Bejelentkezés" overlay.
let refreshingCredit = false;
async function refreshCredit(viaButton) {
  if (isOffline()) { toast("Nincs internet. A mentett adatokat látod."); return; }
  if (refreshingCredit) return;
  refreshingCredit = true;
  if (viaButton) showBusy("Kredit frissítése…", true);
  let r; try { await totpTick(); r = await syncCredit(); } catch (e) { r = { ok: false }; }
  finally { refreshingCredit = false; if (viaButton) hideBusy(); }
  renderCreditPage(); renderProgress();
  toast(r && r.ok ? "Kredit frissítve." : "Nem sikerült frissíteni.");
}
function renderProgress() {
  const el = $("hub-credit"); if (!el) return;
  const p = state.progress;
  if (!p || !p.total) { el.classList.add("hidden"); el.classList.remove("clickable"); el.onclick = null; return; }
  el.classList.remove("hidden");
  const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
  el.classList.add("clickable"); el.onclick = openCreditPopup;
  el.innerHTML = `<div class="cred-row"><div><div class="cred-big">${p.done} / ${p.total}</div><div class="cred-lbl">teljesített kredit</div></div><div class="cred-count">${pct}%</div></div>`
    + `<div class="cred-bar"><div class="cred-fill" style="width:${pct}%"></div></div>`
    + `<div class="cred-free">Ebből szabadon választható: <b>${p.free || 0}</b> kredit</div>`;
}
async function openCreditPopup() {
  const p = state.progress; if (!p || !p.total) return;
  const pct = Math.round((p.done / p.total) * 100);
  const ok = await ask({ title: "Kredit előrehaladás", okText: "Frissítés", cancelText: "Mégse",
    body: "<b>" + p.done + " / " + p.total + "</b> teljesített kredit (" + pct + "%)<br>Ebből szabadon választható: <b>" + (p.free || 0) + "</b> kredit<br><br>Frissítve: " + esc(fmtWhen(p.fetchedAt)) });
  if (ok) grabProgress();
}
