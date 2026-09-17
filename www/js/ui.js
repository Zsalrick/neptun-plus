// Közös UI elemek: párbeszédablakok, töltésjelző, választók, lehúzásos frissítés, szegmens-lapozás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// generic confirm dialog -> Promise<bool>
function ask({ title, body, okText = "Igen", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title; $("ask-body").innerHTML = body; $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    $("ask-ok").disabled = false;
    $("ask-dialog").classList.remove("hidden");
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").onclick = null; $("ask-cancel").onclick = null; res(v); };
    $("ask-ok").onclick = () => done(true); $("ask-cancel").onclick = () => done(false);
  });
}
// Like ask(), but with a free-text field. Resolves to the typed string, or null on cancel.
function askText({ title, body = "", value = "", placeholder = "", okText = "Mentés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<div class="field" style="margin-top:14px"><input class="input" id="ask-text" placeholder="${esc(placeholder)}" autocomplete="off" autocorrect="off" /></div>`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    const ok = $("ask-ok"), inp = $("ask-text");
    inp.value = value || "";
    ok.disabled = false;
    $("ask-dialog").classList.remove("hidden");
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); ok.onclick = null; $("ask-cancel").onclick = null; res(v); };
    ok.onclick = () => done(inp.value); $("ask-cancel").onclick = () => done(null);
  });
}
// Like ask(), but offers a list of choices. Resolves to the chosen value, or null on cancel.
function askPick({ title, body = "", options = [], cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<div class="card" style="margin-top:12px">` + options.map((o, ix) =>
      `<div class="row ask-pick" data-ix="${ix}" style="cursor:pointer"><span class="row-main"><span class="row-title">${esc(o.label)}</span>`
      + (o.sub ? `<span class="row-sub">${esc(o.sub)}</span>` : "") + `</span></div>`).join("") + `</div>`;
    $("ask-ok").textContent = ""; $("ask-ok").style.display = "none";
    $("ask-cancel").textContent = cancelText;
    $("ask-dialog").classList.remove("hidden");
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").style.display = ""; $("ask-cancel").onclick = null; res(v); };
    $("ask-body").querySelectorAll(".ask-pick").forEach((b) => b.onclick = () => done(options[+b.dataset.ix].value));
    $("ask-cancel").onclick = () => done(null);
  });
}
// Like ask(), but the OK button unlocks only once the user types the confirmation word (e.g. IGEN).
// Used for irreversible actions (accepting/rejecting an offered grade).
function askTyped({ title, body, word = "IGEN", okText = "Megerősítés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<div class="field" style="margin-top:14px"><input class="input" id="ask-typed" placeholder="Írd be: ${esc(word)}" autocomplete="off" autocapitalize="characters" autocorrect="off" /></div>`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    const ok = $("ask-ok"), inp = $("ask-typed");
    ok.disabled = true;
    $("ask-dialog").classList.remove("hidden");
    const check = () => { ok.disabled = inp.value.trim().toLowerCase() !== String(word).toLowerCase(); };
    inp.oninput = check; setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); ok.onclick = null; $("ask-cancel").onclick = null; inp.oninput = null; ok.disabled = false; res(v); };
    ok.onclick = () => { if (!ok.disabled) done(true); }; $("ask-cancel").onclick = () => done(false);
  });
}
// Confirm dialog that requires typing a specific word (e.g. "törlés") before the action button enables.
function askConfirmText({ title, body, mustType, okText = "Törlés", cancelText = "Mégse" }) {
  return new Promise((res) => {
    $("ask-title").textContent = title;
    $("ask-body").innerHTML = body + `<input class="input" id="ask-confirm-input" placeholder="${esc(mustType)}" autocomplete="off" autocapitalize="none" style="margin-top:12px" />`;
    $("ask-ok").textContent = okText; $("ask-cancel").textContent = cancelText;
    $("ask-dialog").classList.remove("hidden");
    const inp = $("ask-confirm-input");
    const ok = () => (inp.value || "").trim().toLowerCase() === String(mustType).toLowerCase();
    const refresh = () => { $("ask-ok").disabled = !ok(); };
    inp.oninput = refresh; refresh(); setTimeout(() => inp.focus(), 60);
    const done = (v) => { $("ask-dialog").classList.add("hidden"); $("ask-ok").onclick = null; $("ask-cancel").onclick = null; inp.oninput = null; $("ask-ok").disabled = false; res(v); };
    $("ask-ok").onclick = () => { if (ok()) done(true); };
    $("ask-cancel").onclick = () => done(false);
  });
}

// tap on the dimmed area (outside the sheet) closes any open dialog
document.querySelectorAll(".backdrop").forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.add("hidden"); }));

// full-screen busy spinner (for invisible background reads)
let flowCancel = null; // set while a runNeptunFlow is active; lets the busy "Mégse" abort it
function showBusy(text, cancelable) { $("busy-text").textContent = text || "Beolvasás…"; $("busy-cancel").hidden = !cancelable; $("busy").classList.remove("hidden"); }
// Text-less spinner overlay for quick network actions (just the spinner, no label/bar/cancel).
function spinOn() { const b = $("busy"); if (!b) return; $("busy-text").textContent = ""; $("busy-cancel").hidden = true; $("busy-bar").hidden = true; $("busy-step").hidden = true; b.classList.remove("hidden"); }
function spinOff() { const b = $("busy"); if (b) b.classList.add("hidden"); }
function hideBusy() { $("busy").classList.add("hidden"); $("busy-cancel").hidden = true; $("busy-bar").hidden = true; $("busy-step").hidden = true; }
// Overall progress across a multi-step read (shown beside the spinner).
function setBusyProgress(done, total, stepLabel) {
  const bar = $("busy-bar"), fill = $("busy-fill"), step = $("busy-step");
  if (total > 0) { bar.hidden = false; fill.style.width = Math.round((done / total) * 100) + "%"; }
  if (stepLabel) { step.hidden = false; step.textContent = stepLabel; } else step.hidden = true;
}
$("busy-cancel").onclick = () => { if (flowCancel) flowCancel(); };

// ---------- custom pickers (replace native selects / date / time) ----------
function openList({ title, items, selected, onPick, searchable, allowCustom, chips, chipCurrent, onChip }) {
  $("pk-title").textContent = title;
  const chipsEl = $("pk-chips");
  if (chips && chips.length) {
    chipsEl.hidden = false;
    const cur = chips.find((c) => c.key === chipCurrent) || chips[0];
    chipsEl.innerHTML = `<button class="period-btn" id="pk-dd-btn" type="button"><span>${esc(cur ? cur.label : "")}</span>${icon("down")}</button>`
      + `<div class="pk-dd-menu hidden" id="pk-dd-menu">` + chips.map((c) => `<button class="pk-dd-item${c.key === chipCurrent ? " on" : ""}" data-k="${esc(c.key)}" type="button">${esc(c.label)}${c.key === chipCurrent ? icon("check") : ""}</button>`).join("") + `</div>`;
    const btn = chipsEl.querySelector("#pk-dd-btn"), menu = chipsEl.querySelector("#pk-dd-menu");
    btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
    menu.querySelectorAll(".pk-dd-item").forEach((el) => el.onclick = () => { menu.classList.add("hidden"); onChip(el.dataset.k); });
  } else { chipsEl.hidden = true; chipsEl.innerHTML = ""; }
  const sw = $("pk-search-wrap");
  const draw = (q) => {
    const query = (q || "").trim().toLowerCase();
    const list = items.filter((it) => !query || it.label.toLowerCase().includes(query));
    let html = list.map((it) => `<div class="uni-item${it.value === selected ? " selected" : ""}" data-v="${esc(it.value)}"><span style="flex:1;min-width:0"><div class="u-name">${esc(it.label)}</div>${it.sub ? `<div class="u-city">${esc(it.sub)}</div>` : ""}</span><span class="u-check">${icon("check")}</span></div>`).join("");
    if (allowCustom && query && !list.some((it) => it.label.toLowerCase() === query)) html += `<div class="uni-item" data-custom="1"><span style="flex:1"><div class="u-name">„${esc(q.trim())}" hozzáadása</div></span>${icon("plus")}</div>`;
    if (!html) html = `<div class="uni-empty">Nincs találat.</div>`;
    $("pk-list").innerHTML = html;
    $("pk-list").querySelectorAll(".uni-item").forEach((el) => el.onclick = () => { const v = el.dataset.custom ? $("pk-search").value.trim() : el.dataset.v; $("picker-sheet").classList.add("hidden"); onPick(v); });
  };
  if (searchable) { sw.hidden = false; $("pk-search").value = ""; $("pk-search").oninput = () => draw($("pk-search").value); } else sw.hidden = true;
  draw("");
  $("picker-sheet").classList.remove("hidden");
}
$("pk-close").onclick = () => $("picker-sheet").classList.add("hidden");

let tpH = 8, tpM = 0, tpCb = null;
function openTime(current, onPick) {
  tpCb = onPick;
  const [h, m] = (current || "08:00").split(":").map(Number);
  tpH = isNaN(h) ? 8 : h; tpM = isNaN(m) ? 0 : m;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const drawH = () => { $("tp-hours").innerHTML = hours.map((x) => `<button class="time-cell${x === tpH ? " on" : ""}" data-h="${x}">${pad2(x)}</button>`).join(""); $("tp-hours").querySelectorAll(".time-cell").forEach((b) => b.onclick = () => { tpH = +b.dataset.h; drawH(); }); };
  const drawM = () => { $("tp-mins").innerHTML = mins.map((x) => `<button class="time-cell${x === tpM ? " on" : ""}" data-m="${x}">${pad2(x)}</button>`).join(""); $("tp-mins").querySelectorAll(".time-cell").forEach((b) => b.onclick = () => { tpM = +b.dataset.m; drawM(); }); };
  drawH(); drawM();
  $("time-sheet").classList.remove("hidden");
  setTimeout(() => { const a = $("tp-hours").querySelector(".on"); if (a) a.scrollIntoView({ block: "center" }); const b = $("tp-mins").querySelector(".on"); if (b) b.scrollIntoView({ block: "center" }); }, 30);
}
$("tp-cancel").onclick = () => $("time-sheet").classList.add("hidden");
$("tp-ok").onclick = () => { $("time-sheet").classList.add("hidden"); if (tpCb) tpCb(pad2(tpH) + ":" + pad2(tpM)); };

let calView = null, calSel = null, calCb = null;
function openCalendar(current, onPick) {
  calCb = onPick; calSel = current || null;
  const base = current || new Date();
  calView = new Date(base.getFullYear(), base.getMonth(), 1);
  drawCal(); $("cal-sheet").classList.remove("hidden");
}
function drawCal() {
  const y = calView.getFullYear(), m = calView.getMonth();
  $("cal-title").textContent = y + ". " + TT_MON[m];
  const start = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  let html = "";
  for (let i = 0; i < start; i++) html += `<span class="cal-cell empty"></span>`;
  for (let d = 1; d <= days; d++) {
    const dd = new Date(y, m, d);
    html += `<button class="cal-cell${calSel && sameDay(dd, calSel) ? " sel" : ""}${sameDay(dd, today) ? " today" : ""}" data-d="${d}">${d}</button>`;
  }
  $("cal-grid").innerHTML = html;
  $("cal-grid").querySelectorAll(".cal-cell[data-d]").forEach((b) => b.onclick = () => { const dd = new Date(y, m, +b.dataset.d); $("cal-sheet").classList.add("hidden"); if (calCb) calCb(dd); });
}
$("cal-prev").onclick = () => { calView.setMonth(calView.getMonth() - 1); drawCal(); };
$("cal-next").onclick = () => { calView.setMonth(calView.getMonth() + 1); drawCal(); };
$("cal-cancel").onclick = () => $("cal-sheet").classList.add("hidden");

// ---------- pull to refresh ----------
function attachPTR(scrollEl, ptrEl, onRefresh) {
  if (!scrollEl || !ptrEl) return;
  let startY = 0, pulling = false, dy = 0, ready = false;
  const TH = 68;
  const reset = () => { ptrEl.classList.remove("ready"); ptrEl.style.opacity = "0"; ptrEl.style.transform = "translate(-50%,0)"; };
  scrollEl.addEventListener("touchstart", (e) => { if (scrollEl.scrollTop <= 0 && !ptrEl.classList.contains("spin")) { startY = e.touches[0].clientY; pulling = true; dy = 0; ready = false; } }, { passive: true });
  scrollEl.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scrollEl.scrollTop > 0) { reset(); return; }
    e.preventDefault();
    const d = Math.min(dy, 120);
    ptrEl.style.opacity = String(Math.min(1, d / TH));
    ptrEl.style.transform = `translate(-50%, ${d * 0.5}px) rotate(${d * 3}deg)`;
    ready = d >= TH; ptrEl.classList.toggle("ready", ready);
  }, { passive: false });
  const end = () => {
    if (!pulling) return; pulling = false;
    if (ready) { ptrEl.classList.add("spin"); Promise.resolve(onRefresh()).finally(() => { ptrEl.classList.remove("spin"); reset(); }); }
    else reset();
    ready = false;
  };
  scrollEl.addEventListener("touchend", end);
  scrollEl.addEventListener("touchcancel", end);
}
// Swipe left/right inside a sub-screen with tabs → move to the prev/next segment. Sub-screens aren't
// paged by the main-tab pager (it only handles MAIN_TABS), so horizontal swipes here are free to use.
function attachSegSwipe(el, order, getCur, setCur) {
  if (!el) return;
  let x0 = 0, y0 = 0, ok = false;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest("input,textarea,.seg,.wk-grid,.controls"))) { ok = false; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; ok = true;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.8) return; // must be a clear horizontal swipe
    const list = typeof order === "function" ? order() : order;
    const i = list.indexOf(getCur()), n = i + (dx < 0 ? 1 : -1);
    if (i >= 0 && n >= 0 && n < list.length) setCur(list[n]);
  }, { passive: true });
  el.addEventListener("touchcancel", () => { ok = false; }, { passive: true });
}
