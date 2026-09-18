// APK építése és feltöltése a Cloudflare R2-be (kreditplus-apk tároló), hogy az admin.kreditplus.hu-ról
// letölthető legyen. A tároló PRIVÁT: csak az admin Worker olvassa (Access mögött), nyilvános URL nincs.
//
//   node scripts/apk.mjs                    építés (cap sync + gradle) + feltöltés
//   node scripts/apk.mjs --no-build         a meglévő app-debug.apk feltöltése
//   node scripts/apk.mjs --notes "Új widgetek"
//   node scripts/apk.mjs --dry-run          semmit nem tölt fel, csak kiírja, mit tenne
//
// R2 szerkezet (az admin Worker ezt olvassa, lásd WEBSITE-ADMIN-APK.md):
//   apk/KreditPlus-v0.308.apk      maga az APK
//   apk/KreditPlus-v0.308.json     a verzió adatai (manifest)
//   apk/latest.json                a legfrissebb verzió manifestje (másolat)
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKET = "kreditplus-apk";
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has("--dry-run"), BUILD = !has("--no-build");
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit" });

// Verzió a build.gradle-ből és az app.js-ből.
const gradle = readFileSync(join(root, "android/app/build.gradle"), "utf8");
const versionCode = +(/versionCode\s+(\d+)/.exec(gradle) || [])[1];
const versionName = (/versionName\s+"([^"]+)"/.exec(gradle) || [])[1];
const appVersion = (/const APP_VERSION = "([^"]+)"/.exec(readFileSync(join(root, "www/app.js"), "utf8")) || [])[1];
if (!versionCode || !versionName) throw new Error("Nem találom a versionCode / versionName értéket a build.gradle-ben.");

if (BUILD && !DRY) {
  sh("npx cap sync android");
  sh(process.platform === "win32" ? "gradlew.bat assembleDebug --console=plain" : "./gradlew assembleDebug --console=plain", join(root, "android"));
}

const built = join(root, "android/app/build/outputs/apk/debug/app-debug.apk");
const file = `KreditPlus-v${versionName}.apk`;
const dist = join(root, "dist", file);
copyFileSync(built, dist);
const buf = readFileSync(dist);
const manifest = {
  versionName, versionCode, appVersion, file,
  size: statSync(dist).size,
  sha256: createHash("sha256").update(buf).digest("hex"),
  builtAt: statSync(built).mtime.toISOString(),
  uploadedAt: new Date().toISOString(),
  signing: "debug", // debug kulccsal aláírva (a fejlesztő gépéhez kötött); Play-kiadáshoz release kulcs kell
  notes: arg("--notes") || "",
};
const tmp = mkdtempSync(join(tmpdir(), "kp-apk-"));
const mfile = join(tmp, "manifest.json");
writeFileSync(mfile, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));

const put = (key, path, type) => {
  const cmd = `npx wrangler r2 object put "${BUCKET}/${key}" --file "${path}" --content-type "${type}" --remote`;
  if (DRY) { console.log("[dry-run] " + cmd); return; }
  sh(cmd);
};
try {
  put(`apk/${file}`, dist, "application/vnd.android.package-archive");
  put(`apk/${file.replace(/\.apk$/, ".json")}`, mfile, "application/json");
  put("apk/latest.json", mfile, "application/json");
} catch (e) {
  console.error("\nA feltöltés nem sikerült. Ha a hiba 'bucket not found' vagy 'enable R2': kapcsold be az R2-t a Cloudflare"
    + " irányítópulton, majd: npx wrangler r2 bucket create " + BUCKET);
  process.exit(1);
}
console.log(DRY ? "\n(dry-run: semmi nem került fel)" : `\n✓ Feltöltve: ${BUCKET}/apk/${file} (és latest.json)`);
