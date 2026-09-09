#!/usr/bin/env node
// Publish an OTA web-bundle update to GitHub Releases.
//   node scripts/release.mjs [--notes "changelog line"]
// Steps: read APP_VERSION from www/app.js -> zip www/* -> write dist/latest.json ->
// create a GitHub release tagged with the version and upload www-<ver>.zip + latest.json.
// GH_USER/GH_REPO are read from www/update.js (single source of truth).
// Requires the GitHub CLI (`gh`) authenticated: `gh auth login`.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import JSZip from "jszip";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const notesArg = (() => { const i = process.argv.indexOf("--notes"); return i >= 0 ? process.argv[i + 1] : ""; })();

function read(p) { return readFileSync(join(ROOT, p), "utf8"); }
function die(m) { console.error("\x1b[31m" + m + "\x1b[0m"); process.exit(1); }

// --- version + repo from source ---
const appJs = read("www/app.js");
const ver = (appJs.match(/APP_VERSION\s*=\s*"(v?[0-9.]+)"/) || [])[1] || die("APP_VERSION not found in www/app.js");
const upJs = read("www/update.js");
const ghUser = (upJs.match(/GH_USER\s*=\s*"([^"]+)"/) || [])[1] || "";
const ghRepo = (upJs.match(/GH_REPO\s*=\s*"([^"]+)"/) || [])[1] || "";
if (ghUser.startsWith("__") || ghRepo.startsWith("__") || !ghUser || !ghRepo)
  die("Set GH_USER and GH_REPO in www/update.js first (current: " + ghUser + "/" + ghRepo + ").");

const tag = ver.startsWith("v") ? ver : "v" + ver;
const zipName = "www-" + tag + ".zip";
const distDir = join(ROOT, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
const zipPath = join(distDir, zipName);
const bundleUrl = `https://github.com/${ghUser}/${ghRepo}/releases/download/${tag}/${zipName}`;

// --- zip www/* (contents at zip root) with forward-slash paths ---
// IMPORTANT: use jszip, not PowerShell Compress-Archive — the latter writes backslash entry
// paths ("lib\ical.js") which Android/Capgo can't unzip into folders, so the bundle fails to
// load and rolls back. jszip always writes spec-compliant "/" separators.
console.log("Zipping www/ -> dist/" + zipName);
const zip = new JSZip();
(function add(dir, base) {
  for (const name of readdirSync(dir)) {
    const fp = join(dir, name), rel = base ? base + "/" + name : name;
    if (statSync(fp).isDirectory()) add(fp, rel);
    else zip.file(rel, readFileSync(fp));
  }
})(join(ROOT, "www"), "");
const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
writeFileSync(zipPath, zipBuf);

// --- manifest ---
const manifest = { version: tag, url: bundleUrl, notes: notesArg, published: new Date().toISOString() };
const manifestPath = join(distDir, "latest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log("Wrote dist/latest.json:", JSON.stringify(manifest));

// --- gh release ---
// Resolve the gh executable (PATH first, then the default Windows install location).
function resolveGh() {
  if (spawnSync("gh", ["--version"], { stdio: "ignore" }).status === 0) return "gh";
  const win = "C:\\Program Files\\GitHub CLI\\gh.exe";
  if (existsSync(win) && spawnSync(win, ["--version"], { stdio: "ignore" }).status === 0) return win;
  return null;
}
const GH = resolveGh();
if (!GH) {
  console.log("\n'gh' not found. Create the release manually and upload BOTH files as assets:");
  console.log("  tag:   " + tag);
  console.log("  files: " + zipPath + "\n         " + manifestPath);
  process.exit(0);
}
console.log("Creating GitHub release " + tag + " on " + ghUser + "/" + ghRepo + " ...");
const repo = `${ghUser}/${ghRepo}`;
// Delete an existing release with the same tag so re-runs are idempotent, then create fresh.
// shell:false so version tags like "v0.033" are passed verbatim (no shell globbing/quoting).
spawnSync(GH, ["release", "delete", tag, "-R", repo, "--yes", "--cleanup-tag"], { stdio: "ignore" });
const r = spawnSync(GH, ["release", "create", tag, zipPath, manifestPath,
  "-R", repo, "-t", "Neptun+ " + tag, "-n", notesArg || ("OTA bundle " + tag)],
  { stdio: "inherit" });
if (r.status !== 0) die("gh release create failed.");
console.log("\n✓ Published " + tag + ". Manifest: https://github.com/" + repo + "/releases/latest/download/latest.json");
