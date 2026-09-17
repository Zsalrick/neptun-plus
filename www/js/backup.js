// Mentés és visszaállítás (titkosítva).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ----- data export / import (encrypted backup & restore) -----
function FSP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }
const BACKUP_DIR = "neptunplus", BK_KEY_LS = "neptun-plus-bkkey";
function currentStateJson() {
  let obj = null; try { obj = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) {}
  if (!obj || typeof obj !== "object") obj = state;
  const copy = Object.assign({}, obj); delete copy.dlc; // DLCs are re-downloadable from GitHub — keep them out of the backup
  return JSON.stringify(copy);
}
function backupTs() { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()); }
// AES-GCM key kept in its own localStorage entry (survives "Minden adat törlése", which only clears STORE_KEY).
// Chunked to avoid "Maximum call stack size exceeded" on large buffers (fromCharCode.apply limit).
function b64(buf) { const bytes = new Uint8Array(buf); let bin = ""; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(bin); }
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// v0.067 device-key (kept only to still decrypt old .npb files).
async function backupKey() {
  let raw = null; try { raw = localStorage.getItem(BK_KEY_LS); } catch (e) {}
  if (!raw) throw new Error("nincs kulcs");
  return crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
// Passphrase (the Neptun password) → AES-GCM key via PBKDF2.
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password || ""), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptBackup(json) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(state.password || "", salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(json));
  return JSON.stringify({ app: "neptun-plus", enc: "pbkdf2-aes-gcm", v: 2, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}
async function decryptBackup(text) {
  let env; try { env = JSON.parse(text); } catch (e) { throw new Error("Sérült fájl"); }
  if (env && env.enc === "pbkdf2-aes-gcm" && env.ct) { // password-encrypted (Neptun password)
    const attempt = async (pw) => { try { const k = await deriveKey(pw, unb64(env.salt)); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, k, unb64(env.ct)); return JSON.parse(new TextDecoder().decode(pt)); } catch (e) { return null; } };
    if (state.password) { const d = await attempt(state.password); if (d) return d; }
    for (let i = 0; i < 3; i++) {
      const pw = await askPassword({ title: "Mentés jelszava", body: "Add meg a Neptun jelszavad a mentés visszafejtéséhez." });
      if (pw === null) throw new Error("Megszakítva");
      const d = await attempt(pw); if (d) return d;
      toast("Hibás jelszó.");
    }
    throw new Error("Nem sikerült visszafejteni");
  }
  if (env && env.enc === "aes-gcm" && env.ct) { // old device-key backup (back-compat)
    try { const key = await backupKey(); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
    catch (e) { throw new Error("Nem sikerült visszafejteni (régi mentés, más eszköz?)"); }
  }
  if (env && typeof env === "object" && !Array.isArray(env)) return env; // legacy plaintext backup
  throw new Error("Érvénytelen mentés");
}
function askPassword({ title, body, okText = "OK" }) {
  return new Promise((res) => {
    $("pw-title").textContent = title; $("pw-body").textContent = body || ""; $("pw-ok").textContent = okText; $("pw-input").value = "";
    $("pw-dialog").classList.remove("hidden");
    setTimeout(() => { try { $("pw-input").focus(); } catch (e) {} }, 60);
    const done = (v) => { $("pw-dialog").classList.add("hidden"); $("pw-ok").onclick = null; $("pw-cancel").onclick = null; $("pw-input").onkeydown = null; res(v); };
    $("pw-ok").onclick = () => done($("pw-input").value);
    $("pw-cancel").onclick = () => done(null);
    $("pw-input").onkeydown = (e) => { if (e.key === "Enter") done($("pw-input").value); };
  });
}
function applyImported(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) { toast("Érvénytelen mentés."); return false; }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { toast("Nem sikerült menteni."); return false; }
  location.reload(); return true;
}
async function confirmAndApply(data, name) {
  if (!(await requireAuthFor("actions"))) return;
  if (!(await ask({ title: "Adatok importálása", okText: "Felülírás", cancelText: "Mégse", body: "Visszatöltöd ezt a mentést? Minden jelenlegi adat felülíródik, és az app újraindul." + (name ? "<br><span class='mono'>" + esc(name) + "</span>" : "") }))) return;
  applyImported(data);
}
$("btn-export").onclick = async () => {
 try {
  if (!state.password) { toast("Előbb állítsd be a Neptun jelszót (azzal titkosítunk)."); return; }
  if (!(window.crypto && crypto.subtle)) { toast("A titkosítás nem elérhető ezen az eszközön."); return; }
  if (!(await requireAuthFor("sensitive"))) return; // backup contains the password + 2FA secret
  const enc = await encryptBackup(currentStateJson()), fs = FSP();
  if (fs) {
    const name = "neptun-plus-mentes-" + backupTs() + ".npb";
    await fs.writeFile({ path: BACKUP_DIR + "/" + name, data: enc, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    await ask({ title: "Mentés elkészült", okText: "OK", cancelText: "Bezárás", body: "Titkosított mentés ide:<br><span class='mono'>Dokumentumok/" + esc(BACKUP_DIR) + "/" + esc(name) + "</span><br><br>A <b>Neptun jelszavaddal</b> fejthető vissza." });
    return;
  }
  // fallback (preview / no plugin): show encrypted text + clipboard
  $("backup-title").textContent = "Adatok exportálása";
  $("backup-hint").innerHTML = "Titkosított mentés. Másold ki és mentsd el.";
  $("backup-text").value = enc; $("backup-text").readOnly = true;
  $("backup-copy").hidden = false; $("backup-import-ok").hidden = true;
  $("backup-sheet").classList.remove("hidden");
  try { await navigator.clipboard.writeText(enc); toast("Vágólapra másolva."); } catch (e) {}
 } catch (e) { toast("Export hiba: " + (e && e.message ? e.message : e)); }
};
$("btn-import").onclick = async () => {
  const fs = FSP(); let files = [];
  if (fs) { try { const r = await fs.readdir({ path: BACKUP_DIR, directory: "DOCUMENTS" }); files = (r.files || []).map((f) => f && f.name ? f.name : f).filter((n) => typeof n === "string" && /\.(npb|json)$/i.test(n)); } catch (e) {} files.sort().reverse(); }
  const items = files.map((n) => ({ value: "f:" + n, label: n })).concat([{ value: "browse", label: "Tallózás… (fájl kiválasztása)" }]);
  openList({ title: "Mentés visszatöltése", items, onPick: (v) => { if (v === "browse") $("import-file").click(); else importFromFile(v.slice(2)); } });
};
async function importFromFile(name) {
  const fs = FSP(); if (!fs) return;
  let text; try { const rf = await fs.readFile({ path: BACKUP_DIR + "/" + name, directory: "DOCUMENTS", encoding: "utf8" }); text = rf.data; } catch (e) { return toast("Nem sikerült beolvasni."); }
  let data; try { data = await decryptBackup(text); } catch (e) { return toast(e.message || "Hibás mentés."); }
  confirmAndApply(data, name);
}
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
  const r = new FileReader();
  r.onload = async () => { let data; try { data = await decryptBackup(String(r.result)); } catch (err) { return toast(err.message || "Hibás mentés."); } confirmAndApply(data, file.name); };
  r.onerror = () => toast("Nem sikerült beolvasni a fájlt.");
  r.readAsText(file);
});
$("backup-close").onclick = () => $("backup-sheet").classList.add("hidden");
$("backup-copy").onclick = async () => { try { await navigator.clipboard.writeText($("backup-text").value); toast("Vágólapra másolva."); } catch (e) { $("backup-text").select(); toast("Jelöld ki és másold."); } };
$("backup-import-ok").onclick = async () => {
  const raw = $("backup-text").value.trim(); if (!raw) return toast("Illeszd be a mentést.");
  let data; try { data = await decryptBackup(raw); } catch (e) { return toast(e.message || "Hibás mentés."); }
  confirmAndApply(data);
};
// Once a day, on first open, write an encrypted auto-backup; keep max 5 (delete the oldest).
async function dailyBackup() {
  const fs = FSP(); if (!isNative || !fs || !state.password) return;
  const every = (state.backupEvery == null ? 1 : state.backupEvery);
  if (!every) return; // 0 = auto-backup off
  const today = Math.floor(Date.now() / 86400000);
  if (typeof state.lastBackup === "number" && today - state.lastBackup < every) return;
  try {
    const enc = await encryptBackup(currentStateJson());
    await fs.writeFile({ path: BACKUP_DIR + "/auto-" + backupTs() + ".npb", data: enc, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    try { const r = await fs.readdir({ path: BACKUP_DIR, directory: "DOCUMENTS" }); let autos = (r.files || []).map((f) => f && f.name ? f.name : f).filter((n) => typeof n === "string" && /^auto-.*\.npb$/i.test(n)).sort(); while (autos.length > 5) { const oldest = autos.shift(); await fs.deleteFile({ path: BACKUP_DIR + "/" + oldest, directory: "DOCUMENTS" }); } } catch (e) {}
    state.lastBackup = today; saveState();
  } catch (e) { /* silent */ }
}
const BACKUP_FREQ = [{ value: "0", label: "Kikapcsolva" }, { value: "1", label: "Naponta" }, { value: "2", label: "2 naponta" }, { value: "3", label: "3 naponta" }, { value: "7", label: "Hetente" }];
function backupFreqLabel() { const e = (state.backupEvery == null ? 1 : state.backupEvery); const f = BACKUP_FREQ.find((x) => +x.value === e); return f ? f.label : (e + " naponta"); }
function syncBackupFreq() { const el = $("backup-freq-status"); if (el) el.textContent = backupFreqLabel(); }
$("btn-backup-freq").onclick = () => {
  openList({ title: "Automatikus mentés gyakorisága", selected: String(state.backupEvery == null ? 1 : state.backupEvery), items: BACKUP_FREQ,
    onPick: (v) => { state.backupEvery = parseInt(v, 10) || 0; saveState(); syncBackupFreq(); } });
};
