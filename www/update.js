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

  // opts: { current, onFound(manifest), onDone(manifest), onError(e), apply:"next"|"now" }
  async function check(opts) {
    opts = opts || {};
    var C = window.Capacitor;
    var UP = C && C.Plugins && C.Plugins.CapacitorUpdater;
    if (!C || !C.isNativePlatform || !C.isNativePlatform() || !UP) { log("kihagyva (nem natív / nincs plugin)"); return; }
    // Tell Capgo the current bundle booted fine so it never rolls back.
    try { await UP.notifyAppReady(); } catch (e) { log("notifyAppReady", e); }
    if (!configured()) { log("nincs beállítva GH_USER/GH_REPO"); return; }

    var manifest;
    try {
      var res = await fetch(manifestUrl(), { cache: "no-store" });
      if (!res.ok) { log("manifest HTTP " + res.status); return; }
      manifest = await res.json();
    } catch (e) { log("manifest lekérés hiba", e); return; }
    if (!manifest || !manifest.version || !manifest.url) { log("hiányos manifest", manifest); return; }

    var cur = opts.current || "";
    if (verNum(manifest.version) <= verNum(cur)) { log("nincs újabb (" + manifest.version + " <= " + cur + ")"); return; }
    log("új verzió elérhető: " + manifest.version + " (jelenlegi " + cur + ")");
    if (opts.onFound) { try { opts.onFound(manifest); } catch (e) {} }

    var bundle;
    try {
      bundle = await UP.download({ url: manifest.url, version: String(manifest.version) });
    } catch (e) { log("letöltés hiba", e); if (opts.onError) opts.onError(e); return; }
    try {
      if (opts.apply === "now") await UP.set({ id: bundle.id });      // immediate reload
      else await UP.next({ id: bundle.id });                          // apply on next launch/background
      log("letöltve és beütemezve: " + manifest.version);
      if (opts.onDone) opts.onDone(manifest);
    } catch (e) { log("aktiválás hiba", e); if (opts.onError) opts.onError(e); }
  }

  window.OTA = { check: check, manifestUrl: manifestUrl, configured: configured };
})();
