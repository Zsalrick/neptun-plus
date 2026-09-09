#!/usr/bin/env node
// Publish an OTA web-bundle update to GitHub Releases.
//   node scripts/release.mjs [--notes "changelog line"]
// Steps: read APP_VERSION from www/app.js -> zip www/* -> write dist/latest.json ->
// create a GitHub release tagged with the version and upload www-<ver>.zip + latest.json.
// GH_USER/GH_REPO are read from www/update.js (single source of truth).
// Requires the GitHub CLI (`gh`) authenticated: `gh auth login`.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// --- zip www/* (contents at zip root) via PowerShell Compress-Archive ---
console.log("Zipping www/ -> dist/" + zipName);
const ps = `Compress-Archive -Path '${join(ROOT, "www")}\\*' -DestinationPath '${zipPath}' -Force`;
const z = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
if (z.status !== 0) die("Compress-Archive failed.");

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
