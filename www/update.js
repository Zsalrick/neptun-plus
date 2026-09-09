// =====================================================================
//  OTA self-update (Capgo capacitor-updater, self-hosted on GitHub Releases)
//  On launch the app fetches a small manifest (latest.json) from the repo's
//  "latest" release, compares it to the running bundle version, and if newer
//  downloads the new www bundle and activates it on the next app start.
//  Only the web assets (www/) update this way — native changes still need a
//  full APK. Auto-update to Capgo's cloud is DISABLED (see capacitor.config.json).
// =====================================================================
(function () {
  // Filled in once the GitHub repo exists (see scripts/release.mjs).
  var GH_USER = "Zsalrick";
  var GH_REPO = "neptun-plus";
  // The manifest is published as an asset named latest.json on the newest release.
  function manifestUrl() {
    // Allow a runtime override (handy for testing) stored in localStorage.
    try { var o = localStorage.getItem("neptun-ota-url"); if (o) return o; } catch (e) {}
    return "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/latest/download/latest.json";
  }
  function configured() { return GH_USER.indexOf("__") !== 0 && GH_REPO.indexOf("__") !== 0; }
  function log() { try { console.log.apply(console, ["[OTA]"].concat([].slice.call(arguments))); } catch (e) {} }
  // "v0.033" / "0.033" / "0.0.33" -> a comparable integer
  function verNum(v) { return parseInt(String(v || "").replace(/[^0-9]/g, ""), 10) || 0; }

  // Persist a human-readable status so it can be shown in Settings (helps diagnose on device).
  function setStatus(s) { try { localStorage.setItem("neptun-ota-status", JSON.stringify({ t: Date.now(), s: s })); } catch (e) {} log(s); }
  function lastStatus() { try { return JSON.parse(localStorage.getItem("neptun-ota-status") || "null"); } catch (e) { return null; } }
  var errMsg = (e) => (e && (e.message || e.errorMessage)) ? (e.message || e.errorMessage) : String(e);

  // opts: { current, onFound(manifest), onDone(manifest), onError(e), apply:"next"|"now" }
  // Always resolves with a result object: { ok, updated?, version?, reason?, error? }.
  async function check(opts) {
    opts = opts || {};
    var C = window.Capacitor;
    var UP = C && C.Plugins && C.Plugins.CapacitorUpdater;
    if (!C || !C.isNativePlatform || !C.isNativePlatform() || !UP) { return { ok: false, reason: "not-native" }; }
    try { await UP.notifyAppReady(); } catch (e) { log("notifyAppReady", e); }
    if (!configured()) { return { ok: false, reason: "not-configured" }; }

    var manifest;
    try {
      setStatus("Frissítés keresése");
      var res = await fetch(manifestUrl(), { cache: "no-store" });
      if (!res.ok) { setStatus("Manifest HTTP " + res.status); return { ok: false, reason: "http", code: res.status }; }
      manifest = await res.json();
    } catch (e) { setStatus("Hálózati hiba: " + errMsg(e)); return { ok: false, reason: "fetch", error: errMsg(e) }; }
    if (!manifest || !manifest.version || !manifest.url) { setStatus("Hibás manifest"); return { ok: false, reason: "manifest" }; }

    var cur = opts.current || "";
    if (verNum(manifest.version) <= verNum(cur)) { setStatus("Naprakész (" + cur + ")"); return { ok: true, updated: false, version: manifest.version }; }
    setStatus("Új verzió: " + manifest.version + ", letöltés…");
    if (opts.onFound) { try { opts.onFound(manifest); } catch (e) {} }

    var bundle;
    try {
      bundle = await UP.download({ url: manifest.url, version: String(manifest.version) });
    } catch (e) { setStatus("Letöltés hiba: " + errMsg(e)); if (opts.onError) opts.onError(e); return { ok: false, reason: "download", error: errMsg(e) }; }
    try {
      if (opts.apply === "now") { setStatus("Alkalmazás…"); await UP.set({ id: bundle.id }); } // reloads
      else { await UP.next({ id: bundle.id }); setStatus("Letöltve: " + manifest.version + " (újraindításkor lép életbe)"); }
      if (opts.onDone) opts.onDone(manifest);
      return { ok: true, updated: true, version: manifest.version };
    } catch (e) { setStatus("Aktiválás hiba: " + errMsg(e)); if (opts.onError) opts.onError(e); return { ok: false, reason: "apply", error: errMsg(e) }; }
  }

  // Lightweight check: fetch the manifest only (no download), report whether a newer version exists.
  async function peek(current) {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return { ok: false, reason: "not-native" };
    if (!configured()) return { ok: false, reason: "not-configured" };
    try {
      var res = await fetch(manifestUrl(), { cache: "no-store" });
      if (!res.ok) return { ok: false, reason: "http", code: res.status };
      var m = await res.json();
      if (!m || !m.version) return { ok: false, reason: "manifest" };
      var available = verNum(m.version) > verNum(current || "");
      setStatus(available ? ("Új verzió: " + m.version) : ("Naprakész (" + (current || "") + ")"));
      return { ok: true, available: available, version: m.version };
    } catch (e) { return { ok: false, reason: "fetch", error: errMsg(e) }; }
  }

  window.OTA = { check: check, peek: peek, manifestUrl: manifestUrl, configured: configured, lastStatus: lastStatus };
})();
