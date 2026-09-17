// Futtatás: a www/ kiszolgálva a localhost:5178-on, majd: node scripts/viewer-touch-test.mjs [pen|hl|eraser]
// Valódi (böngésző-bemeneti) érintésekkel teszteli a rajzolást: Chrome + CDP Input.dispatchTouchEvent.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9333;
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "kp-"))}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") logs.push("EXC " + d.params.exceptionDetails.exception?.description); else if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(d.params.type + " " + d.params.args.map((a) => a.value || a.description).join(" ")); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result.result.value; };

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5178/" }); await sleep(2500);
await ev(`localStorage.setItem("neptun-plus", JSON.stringify({setupComplete:true, legalAccepted:true, profiles:[{id:"t1", materials:[], courses:[]}], activeProfileId:"t1", materials:[], courses:[]})); return 1;`);
await send("Page.reload"); await sleep(3000);
console.log("setup", await ev(`
  const L = await matScript("lib/pdf-lib.min.js", "PDFLib");
  const doc = await L.PDFDocument.create();
  for (let p = 0; p < 3; p++) { const pg = doc.addPage([595, 842]); const f = await doc.embedFont(L.StandardFonts.TimesRoman);
    for (let i = 0; i < 40; i++) pg.drawText("Line " + i + " of page " + (p + 1) + " with some statistics text to fill the page nicely.", { x: 50, y: 800 - i * 19, size: 12, font: f }); }
  await matImportPdf(new File([await doc.save()], "Rajz teszt.pdf", { type: "application/pdf" }), currentSemesterKey(), { key: "teszt", name: "Teszt", code: "" });
  openMaterial(mats()[mats().length - 1].id); await new Promise(r => setTimeout(r, 3000));
  mvAction("${process.argv[2] || "pen"}"); return { tool: mv.tool, slots: mv.slots.length, cls: document.getElementById("mv-scroll").className };`));

const touch = (type, pts) => send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 0.5 })) });
async function stroke(x0, y0, dx, dy, steps = 16, dt = 16) {
  await touch("touchStart", [[x0, y0]]);
  for (let i = 1; i <= steps; i++) { await touch("touchMove", [[x0 + (dx * i) / steps, y0 + (dy * i) / steps]]); await sleep(dt); }
  await touch("touchEnd", []);
  await sleep(60);
}

const count = () => ev(`let n = 0; for (const sl of mv.slots) n += (mv.doc.items[sl.pg.id] || []).filter(i => i.t === "ink").length; return { n, z: mv.z, draw: !!mv.draw, pinch: !!mv.pinch };`);
const res = {};
// A) sima vonások
let ok = 0; for (let k = 0; k < 8; k++) { const b = await count(); await stroke(90 + k * 25, 260 + (k % 4) * 60, 110, 25); if ((await count()).n > b.n) ok++; }
res.A_normal = `${ok}/8`;
// B) tenyér a vonás közepén
{ const b = await count();
  await touch("touchStart", [[150, 300]]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [[150 + i * 6, 300 + i * 2]]); await sleep(16); }
  const pts = (i) => [[150 + i * 6, 300 + i * 2], [70, 520]];
  await touch("touchStart", pts(8)); // tenyér leér
  for (let i = 9; i <= 18; i++) { await touch("touchMove", pts(i)); await sleep(16); }

  await sleep(30); await touch("touchEnd", []); await sleep(80);
  const a = await count(); res.B_palm = { saved: a.n > b.n, zoomUnchanged: a.z === b.z, stuck: a.draw || a.pinch }; }
// C) két ujjas csípés
{ const b = await count();
  await touch("touchStart", [[180, 400], [240, 400]]);
  for (let i = 1; i <= 12; i++) { await touch("touchMove", [[180 - i * 6, 400], [240 + i * 6, 400]]); await sleep(16); }
  await touch("touchEnd", []); await sleep(600);
  const a = await count(); res.C_pinch = { zoomed: a.z > b.z + 0.1, noStroke: a.n === b.n, z: a.z }; }
await ev(`mvSetZoom(1); return 1;`); await sleep(500);
// D) utána rajzol-e
{ const b = await count(); await stroke(120, 350, 100, 40); res.D_after = (await count()).n > b.n; }
// E) elakadt (elveszett felengedésű) mozdulat után
{ await ev(`mv.draw = { pan: true, id: 999 }; return 1;`); const b = await count(); await stroke(120, 420, 100, 40); const a = await count(); res.E_stale = { drawn: a.n > b.n, stuck: a.draw }; }
console.log(JSON.stringify(res, null, 1));
console.log("logs", logs.slice(0, 10));
ws.close(); chrome.kill();
process.exit(0);
