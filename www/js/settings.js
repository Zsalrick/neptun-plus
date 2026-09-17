// Beállítások: értesítések, biztonság, fiók, szerver, 2FA, jogi szövegek, alaphelyzet.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  SETTINGS
// =====================================================================
function syncSettings() {
  $("in-username").value = state.username || "";
  $("in-username-err").hidden = !!state.username;
  { const cf = $("in-code-field"), ci = $("in-code"); if (cf && ci) { if (state.neptunCode) { ci.value = state.neptunCode; cf.hidden = false; } else cf.hidden = true; } }
  refreshAccountBar();
  updateIcsStatus();
  $("in-password").value = state.password || "";
  $("cur-uni").textContent = state.university || "Nincs kiválasztva";
  renderServersSettings();
  renderTotpStatus();
  updateUpdateStatus();
  updateBreakMinStatus();
  syncSecurityToggles();
  { const b = $("app-bootsound"); if (b) b.classList.toggle("on", bootSoundOn()); }
  renderBioSetting();
  syncNotifySettings();
  syncSemStatus();
  syncProgStatus();
  syncBackupFreq();
  // Mirror live values onto the settings hub rows.
  const mir = (from, to) => { const a = $(from), b = $(to); if (a && b) b.textContent = a.textContent; };
  mir("cur-uni", "hub-uni-sub"); mir("update-status", "hub-update-sub");
  { const th = THEMES.find((t) => t.id === currentTheme()), el = $("hub-theme-sub"); if (el && th) el.textContent = th.name; }
  { const el = $("hub-ref-sub"); if (el) el.textContent = "A kódod: " + referralCode(); }
}
function syncSemStatus() {
  const el = $("sems-status"); if (!el) return;
  const s = state.semesters;
  el.textContent = (s && s.list && s.list.length) ? (s.list.length + " félév · " + fmtWhen(s.fetchedAt)) : "Nincs beolvasva";
}
function syncProgStatus() {
  const el = $("prog-status"); if (!el) return;
  const p = state.progress;
  el.textContent = (p && p.total) ? (p.done + "/" + p.total + " kredit · " + fmtWhen(p.fetchedAt)) : "Nincs beolvasva";
}
// Per-category reminder settings (Órák / ZH / Vizsgák), each: on/off + up to 3 lead times.
const NOTIFY_CATS = [["classes", "Órák", "Emlékeztető óra előtt."], ["zh", "ZH", "Emlékeztető ZH előtt."], ["vizsga", "Vizsgák", "Emlékeztető vizsga előtt."], ["periods", "Időszakok", "Nyitás és zárulás előtt (pl. tárgyfelvétel, vizsgajelentkezés)."], ["changes", "Változások", "Új jegy, üzenet, befizetendő vagy órarend-változás. Megnyitáskor részletesen, a háttérben pedig kb. félóránként ellenőrzi (ezt a telefon energiakezelése lassíthatja).", true]];
const CLASS_LEADS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const EXAM_LEADS = [10, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080];
function syncNotifySettings() {
  const host = $("notify-cats"); if (!host) return;
  const br = (state.notify && state.notify.brief) || { enabled: false, time: "07:00" };
  host.innerHTML = `<div class="card">` + NOTIFY_CATS.map(([key, label, desc, noLeads]) => {
    const c = (state.notify && state.notify[key]) || { enabled: false, leads: [] };
    const chips = (c.leads || []).map((m) => `<button class="lead-chip" data-cat="${key}" data-lead="${m}">${esc(fmtLead(m))} <span class="lx">${icon("x")}</span></button>`).join("");
    const canAdd = (c.leads || []).length < 3;
    const leadRow = (!noLeads && c.enabled) ? `<div class="lead-row"><span class="lead-lbl">Emlékeztető</span>${chips}
        ${canAdd ? `<button class="lead-add" data-addcat="${key}">${icon("plus")} ${chips ? "Még" : "Hozzáadás"}</button>` : ""}</div>` : "";
    return `<div class="notify-cat">
      <button class="check flat" data-nt="${key}"><span class="box"><span data-icon="check"></span></span>
        <span><span class="c-t">${esc(label)}</span><span class="c-b">${esc(desc || ("Emlékeztető " + label.toLowerCase() + " előtt."))}</span></span></button>
      ${leadRow}
    </div>`;
  }).join("")
    + `<div class="notify-cat">
      <button class="check flat" data-nt="brief"><span class="box"><span data-icon="check"></span></span>
        <span><span class="c-t">Reggeli összefoglaló</span><span class="c-b">Napi értesítés a mai órákról, vizsgákról és a befizetendőről.</span></span></button>
      ${br.enabled ? `<div class="lead-row"><span class="lead-lbl">Időpont</span><input type="time" id="brief-time" value="${esc(br.time || "07:00")}" style="font-family:var(--font-mono,inherit);font-size:15px;padding:6px 10px;border-radius:10px;border:1px solid var(--line,#2a2f37);background:var(--card,#161a21);color:var(--fg,#e8eaed)"></div>` : ""}
    </div></div>
    <button class="btn tonal" id="change-test" style="margin-top:2px"><span data-icon="bell"></span> Változás-teszt (Új üzenet push)</button>`;
  renderIcons(host);
  host.querySelectorAll("[data-nt]").forEach((b) => b.onclick = () => b.dataset.nt === "brief" ? toggleBrief() : toggleNotifyCat(b.dataset.nt));
  host.querySelectorAll(".lead-chip").forEach((b) => b.onclick = () => { removeLead(b.dataset.cat, +b.dataset.lead); });
  host.querySelectorAll("[data-addcat]").forEach((b) => b.onclick = () => addLead(b.dataset.addcat));
  { const t = $("brief-time"); if (t) t.onchange = () => { state.notify.brief.time = t.value || "07:00"; saveState(); rescheduleNotifications(); }; }
  { const ct = $("change-test"); if (ct) ct.onclick = testChangeNotif; }
  NOTIFY_CATS.forEach(([key]) => { const el = host.querySelector(`[data-nt="${key}"]`); if (el) el.classList.toggle("on", !!(state.notify[key] && state.notify[key].enabled)); });
  { const el = host.querySelector(`[data-nt="brief"]`); if (el) el.classList.toggle("on", !!br.enabled); }
}
async function toggleNotifyCat(key) {
  const c = state.notify[key];
  if (!c.enabled) { if (isNative && !(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell a telefon beállításaiban."); return; } c.enabled = true; }
  else c.enabled = false;
  saveState(); syncNotifySettings(); rescheduleNotifications();
  if (key === "changes") { try { seedBackgroundRunner(); } catch (e) {} } // háttér on/off azonnal
}
// Teszt: a valódi változás-értesítő útvonalán küld egy "Új üzenet" push-t (a legfrissebb üzeneted
// tárgyával), így ellenőrizhető, hogy megjön-e és jó helyre visz-e koppintásra. Nem módosít adatot.
async function testChangeNotif() {
  const ln = LN();
  if (!isNative || !ln) { toast("A teszt a telefonos alkalmazásban működik."); return; }
  if (!(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell."); return; }
  const m = (state.messages && state.messages.received && state.messages.received[0]) || null;
  const body = (m ? [m.from, m.subject].filter(Boolean).join(" · ") : "") || "Teszt feladó · Teszt üzenet";
  const id = logNotif({ kind: "messages", title: "Új üzenet", body, detail: "Teszt értesítés.\n" + body, target: { tab: "tab-messages" } });
  try {
    await ln.schedule({ notifications: [{ id: 1305000000, title: "Új üzenet", body: body, schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true }, smallIcon: "ic_stat_neptun", extra: { notifId: id } }] });
    toast("Teszt push 4 másodperc múlva. Tedd háttérbe az appot, majd koppints rá!");
  } catch (e) { toast("Hiba: " + (e && e.message ? e.message : e)); }
}
async function toggleBrief() {
  const b = state.notify.brief;
  if (!b.enabled) { if (isNative && !(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell a telefon beállításaiban."); return; } b.enabled = true; }
  else b.enabled = false;
  saveState(); syncNotifySettings(); rescheduleNotifications();
}
function removeLead(key, m) { const c = state.notify[key]; c.leads = (c.leads || []).filter((x) => x !== m); saveState(); syncNotifySettings(); rescheduleNotifications(); }
$("notify-test").onclick = async () => {
  const ln = LN();
  if (!isNative || !ln) { toast("A teszt értesítés a telefonos alkalmazásban működik."); return; }
  if (!(await ensureNotifPermission())) { toast("Az értesítésekhez engedély kell."); return; }
  const id = logNotif({ kind: "brief", title: "Teszt értesítés", body: "Így néz ki egy emlékeztető. Koppints rá!", detail: "Ez egy teszt értesítés.\nÍgy jelennek meg és nyílnak meg az értesítések az appban.", target: null });
  try {
    await ln.schedule({ notifications: [{
      id: 424242, title: "Teszt értesítés", body: "Így néz ki egy emlékeztető. Koppints rá!",
      schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, smallIcon: "ic_stat_neptun",
      extra: { notifId: id },
    }] });
    toast("Teszt értesítés 5 másodperc múlva. Tedd háttérbe az appot!");
  } catch (e) { toast("Hiba: " + (e && e.message ? e.message : e)); }
};
function addLead(key) {
  const c = state.notify[key];
  const opts = (key === "classes" ? CLASS_LEADS : EXAM_LEADS).filter((m) => (c.leads || []).indexOf(m) < 0);
  openList({ title: "Emlékeztető ennyivel előtte", items: opts.map((m) => ({ value: String(m), label: fmtLead(m) })),
    onPick: (v) => { const m = parseInt(v, 10); if (!m) return; c.leads = (c.leads || []).concat(m).sort((a, b) => a - b).slice(0, 3); saveState(); syncNotifySettings(); rescheduleNotifications(); } });
}
const SEC_TOGGLES = [["sec-startup", "startup"], ["sec-resume", "resume"], ["sec-sensitive", "sensitive"], ["sec-actions", "actions"], ["sec-confirmsend", "confirmSend"]];
function syncSecurityToggles() { SEC_TOGGLES.forEach(([id, key]) => { const el = $(id); if (el) el.classList.toggle("on", secOn(key)); }); }
SEC_TOGGLES.forEach(([id, key]) => {
  $(id).onclick = async () => {
    // Changing a security switch is itself a protected action.
    if (!(await requireAuthFor("actions"))) return;
    if (!state.security) state.security = { startup: true, resume: true, sensitive: true, actions: true };
    state.security[key] = !secOn(key);
    saveState(); syncSecurityToggles();
  };
});
function renderBioSetting() {
  const btn = $("set-bio"), sub = $("set-bio-sub");
  if (!btn) return;
  btn.classList.toggle("on", !!state.biometric && bioOK);
  if (!bioOK) {
    btn.classList.add("disabled");
    if (sub) sub.textContent = "Az eszközöd most nem támogatja, vagy nincs beállítva.";
  } else {
    btn.classList.remove("disabled");
    if (sub) sub.textContent = state.biometric ? "Bekapcsolva. A kód tartalékként végig működik." : "Ujjlenyomat vagy arc a kód helyett.";
  }
}
$("set-bio").onclick = async () => {
  if (!bioOK) { toast("Az eszközöd most nem támogatja a biometrikus feloldást."); return; }
  if (state.biometric) {
    // Turning OFF is a protected change: require the code or biometrics first.
    if (!(await requireAuth())) return;
    state.biometric = false;
  } else {
    // Turning ON: confirm with biometrics; if that isn't possible, fall back to the code.
    let ok = false;
    try { await bioVerify(); ok = true; } catch { ok = await requireAuth(); }
    if (!ok) return;
    state.biometric = true;
  }
  saveState(); renderBioSetting();
};
function updateBreakMinStatus() { const el = $("breakmin-status"); if (el) el.textContent = (state.breakMin || 20) + " perc"; }
$("btn-breakmin").onclick = () => {
  const items = [];
  for (let m = 5; m <= 120; m += 5) items.push({ value: String(m), label: m + " perc" });
  openList({
    title: "Szünet minimum hossza",
    selected: String(state.breakMin || 20),
    items,
    onPick: (v) => { state.breakMin = parseInt(v, 10) || 20; saveState(); updateBreakMinStatus(); renderTimetable(); },
  });
};
async function updateUpdateStatus() {
  const el = $("update-status"), title = $("update-title");
  if (el) el.textContent = "Verzió " + APP_VERSION; // immediate, before the network check
  if (title) title.textContent = "Frissítés keresése";
  if (!isNative || !window.OTA || !window.OTA.peek) return;
  const res = await window.OTA.peek(APP_VERSION); // manifest only, no download
  if (!res || !res.ok) return; // offline / not configured → leave defaults
  if (res.available) {
    if (title) title.textContent = "Frissítés letöltése";
    if (el) el.textContent = "Verzió " + APP_VERSION + " · Új: " + res.version;
  } else {
    if (title) title.textContent = "Frissítés keresése";
    if (el) el.textContent = "Verzió " + APP_VERSION + " · Naprakész";
  }
}
{ const b = $("app-bootsound"); if (b) b.onclick = () => { state.bootSound = !bootSoundOn(); saveState(); b.classList.toggle("on", bootSoundOn()); if (bootSoundOn()) playBootChime(); }; }
{ const b = $("msg-receive-all"); if (b) b.onclick = msgReceiveToggle; }
$("btn-check-update").onclick = async () => {
  if (!isNative) { toast("A frissítés a telefonos alkalmazásban működik."); return; }
  if (!window.OTA) { toast("A frissítő nem elérhető."); return; }
  showBusy("Frissítés keresése…");
  let res;
  try { res = await window.OTA.check({ current: APP_VERSION, apply: "now" }); }
  catch (e) { res = { ok: false, reason: "exception", error: String(e) }; }
  finally { hideBusy(); }
  updateUpdateStatus();
  if (res && res.ok && res.updated) toast("Új verzió letöltve, frissítés…"); // set() reloads
  else if (res && res.ok) toast("Az alkalmazás naprakész (" + APP_VERSION + ").");
  else toast("Frissítés nem sikerült: " + ((res && (res.error || res.reason)) || "ismeretlen"));
};
// Account page uses STAGED editing: inputs don't auto-save; a Save/Cancel bar commits, and leaving
// with unsaved edits prompts. (The onboarding fields still auto-save — different flow.)
function accountDirty() {
  const u = $("in-username"), p = $("in-password");
  if (!u || !p) return false;
  return u.value !== (state.username || "") || p.value !== (state.password || "");
}
function refreshAccountBar() { const b = $("account-savebar"); if (b) b.hidden = !accountDirty(); }
function saveAccount() {
  const u = $("in-username").value.slice(0, 255);
  if (!u) { toast("Az azonosító nem lehet üres."); return false; }
  const old = state.username || "";
  state.username = u; state.password = $("in-password").value; saveState();
  renderHome(); refreshAccountBar();
  toast(old && old !== u ? "Azonosító mentve: " + old + " → " + u : "Mentve.");
  return true;
}
$("in-username").addEventListener("input", (e) => {
  e.target.value = e.target.value.slice(0, 255);
  $("in-username-err").hidden = e.target.value.length > 0;
  refreshAccountBar();
});
$("in-password").addEventListener("input", refreshAccountBar);
{ const s = $("account-save"); if (s) s.onclick = () => saveAccount(); }
{ const c = $("account-cancel"); if (c) c.onclick = () => { $("in-username").value = state.username || ""; $("in-password").value = state.password || ""; $("in-username-err").hidden = true; refreshAccountBar(); }; }
$("btn-show-pass").onclick = async () => { const el = $("in-password"); if (el.type !== "password") { el.type = "password"; return; } if (!(await requireAuthFor("sensitive"))) return; el.type = "text"; };

function renderServersSettings() {
  const list = $("server-list"); list.innerHTML = "";
  state.servers.forEach((s) => {
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<span class="row-ic">${icon("swap")}</span>
      <span class="row-main"><span class="row-title">${esc(s.label)}</span><span class="row-sub">${esc(s.url)}</span></span>
      ${s.id === state.activeServerId ? '<span class="row-val">aktív</span>' : ""}`;
    row.querySelector(".row-main").onclick = () => { state.activeServerId = s.id; saveState(); renderServersSettings(); };
    list.appendChild(row);
  });
}
$("btn-change-uni").onclick = () => openUniSheet();
function openUniSheet() {
  const render = () => renderUniList($("uni-sheet-list"), $("uni-sheet-search").value, state.university, (u) => {
    applyUniversity(u); $("uni-sheet").classList.add("hidden"); syncSettings(); renderHome(); toast(u.name + " beállítva");
  });
  $("uni-sheet-search").value = ""; render();
  $("uni-sheet-search").oninput = render;
  $("uni-sheet").classList.remove("hidden");
}
$("uni-sheet-close").onclick = () => $("uni-sheet").classList.add("hidden");

function renderTotpStatus() {
  const box = $("totp-status");
  if (state.no2fa && hasTotp()) box.innerHTML = `<div class="status-pill neutral">2FA kikapcsolva (kulcs elmentve: ${esc(state.totp.name)})</div>`;
  else if (state.no2fa) box.innerHTML = `<div class="status-pill neutral">2FA kikapcsolva (nincs a sulinál)</div>`;
  else if (hasTotp()) box.innerHTML = `<div class="status-pill ok">${icon("check")} Beállítva: ${esc(state.totp.name)}</div><button class="btn ghost narrow" id="btn-remove-totp" style="margin-top:8px">2FA törlése</button>`;
  else box.innerHTML = `<div class="status-pill neutral">Nincs beállítva</div>`;
  const rm = $("btn-remove-totp"); if (rm) rm.onclick = async () => {
    if (!(await requireAuthFor("actions"))) return; // guard (respects the Biztonság switch)
    if (!(await ask({ title: "2FA törlése", okText: "Törlés", body: "Biztosan törlöd a mentett 2FA kulcsot? A belépéshez újra be kell majd olvasnod." }))) return;
    state.totp = null; saveState(); renderTotpStatus(); renderHome(); toast("2FA törölve.");
  };
  $("toggle-no2fa").classList.toggle("on", state.no2fa);
}
$("in-qr").addEventListener("change", (e) => handleQrPick(e, $("qr-result"), () => { renderTotpStatus(); renderHome(); totpTick(); }));
$("btn-save-secret").onclick = async () => {
  const secret = $("in-secret").value.replace(/\s+/g, "").toUpperCase();
  if (!secret) return toast("Írd be a Base32 kulcsot.");
  try { await validateSecret(secret); state.totp = { secret, digits: 6, period: 30, algorithm: "SHA1", name: "Kézi kulcs" }; state.no2fa = false; saveState(); $("in-secret").value = ""; renderTotpStatus(); renderHome(); totpTick(); toast("2FA kulcs mentve"); }
  catch (err) { toast("Érvénytelen kulcs: " + err.message); }
};
// FIX: keep the uploaded key when toggling; just flip the flag.
$("toggle-no2fa").onclick = () => { state.no2fa = !state.no2fa; saveState(); renderTotpStatus(); renderHome(); totpTick(); };

// legal document sheets (settings + close buttons)
$("open-privacy2").onclick = () => $("privacy-sheet").classList.remove("hidden");
$("open-terms2").onclick = () => $("terms-sheet").classList.remove("hidden");
$("privacy-close").onclick = () => $("privacy-sheet").classList.add("hidden");
$("terms-close").onclick = () => $("terms-sheet").classList.add("hidden");
const openTotpHelp = () => $("totp-help-sheet").classList.remove("hidden");
$("ob-2fa-help").onclick = openTotpHelp;
$("set-2fa-help").onclick = openTotpHelp;
$("totp-help-close").onclick = () => $("totp-help-sheet").classList.add("hidden");
$("btn-reset").onclick = () => { $("reset-delpin").classList.remove("on"); $("confirm-dialog").classList.remove("hidden"); };
$("reset-delpin").onclick = () => $("reset-delpin").classList.toggle("on");
$("confirm-cancel").onclick = () => $("confirm-dialog").classList.add("hidden");
$("confirm-ok").onclick = async () => {
  const delPin = $("reset-delpin").classList.contains("on");
  $("confirm-dialog").classList.add("hidden");
  const ok = await requireAuthFor("actions");
  if (!ok) return;
  const keep = (!delPin && state.pinHash) ? { pinHash: state.pinHash, biometric: state.biometric } : null;
  try { await matClearAll(); } catch { /* ignore */ } // az anyagok IndexedDB-ben vannak, azokat is töröljük
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  if (keep) { const s = defaultState(); s.pinHash = keep.pinHash; s.biometric = keep.biometric; try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
  location.reload();
};
