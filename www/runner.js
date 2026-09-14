// Kredit+ háttér-ellenőrző (background runner). Egy izolált JS-motorban fut: NINCS Web Crypto, DOM,
// localStorage vagy Capacitor plugin — csak fetch, CapacitorKV, CapacitorNotifications, console.
// Cél: zárt app mellett is szóljon, ha új üzenet vagy jegy van a Neptunban. A RÉSZLETES diffet az app
// végzi megnyitáskor (Phase A); a runner csak egy "van valami új, nyisd meg" jelzést ad.
// A hitelesítési adatokat az app tölti be ide a 'saveCreds' eseménnyel (CapacitorKV-be írva).

// ---- Base32 + SHA-1 + HMAC-SHA1 + TOTP (tiszta JS, mert nincs crypto.subtle) ----
function base32Decode(input) {
  var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var s = String(input || "").toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  var bits = 0, val = 0, out = [];
  for (var i = 0; i < s.length; i++) {
    var idx = A.indexOf(s[i]); if (idx < 0) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 255); }
  }
  return out;
}
function sha1(msg) {
  function rotl(n, s) { return ((n << s) | (n >>> (32 - s))) >>> 0; }
  var ml = msg.length * 8, m = msg.slice();
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  var hi = Math.floor(ml / 0x100000000), lo = ml >>> 0;
  m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  for (var i = 0; i < m.length; i += 64) {
    var w = new Array(80);
    for (var j = 0; j < 16; j++) w[j] = ((m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) | (m[i + j * 4 + 2] << 8) | (m[i + j * 4 + 3])) >>> 0;
    for (var j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
    var a = h0, b = h1, c = h2, d = h3, e = h4;
    for (var j = 0; j < 80; j++) {
      var f, k;
      if (j < 20) { f = (b & c) | ((~b >>> 0) & d); k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      var t = (rotl(a, 5) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  var out = [];
  [h0, h1, h2, h3, h4].forEach(function (h) { out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255); });
  return out;
}
function hmacSha1(key, msg) {
  if (key.length > 64) key = sha1(key);
  var k = key.slice(); while (k.length < 64) k.push(0);
  var ipad = [], opad = [];
  for (var i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
  return sha1(opad.concat(sha1(ipad.concat(msg))));
}
// TOTP (SHA1 only — Neptun/Google Authenticator standard). Returns a zero-padded string code.
function totp(secretB32, opts) {
  opts = opts || {};
  var digits = opts.digits || 6, period = opts.period || 30, ts = opts.timestamp || Date.now();
  var counter = Math.floor(ts / 1000 / period);
  // 64-bit big-endian counter; high word is 0 for any realistic time (< 2^32 until ~2078).
  var cb = [0, 0, 0, 0, (counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255];
  var h = hmacSha1(base32Decode(secretB32), cb);
  var off = h[19] & 0x0f;
  var bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 255) << 16) | ((h[off + 2] & 255) << 8) | (h[off + 3] & 255);
  var code = (bin % Math.pow(10, digits)).toString();
  while (code.length < digits) code = "0" + code;
  return code;
}

// ---- KV helpers ----
function kvGet(k) { try { var r = CapacitorKV.get(k); return r && r.value != null ? String(r.value) : ""; } catch (e) { return ""; } }
function kvSet(k, v) { try { CapacitorKV.set(k, String(v)); } catch (e) {} }

// ---- HTTP ----
async function postJson(url, body, token) {
  var headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  var r = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) });
  try { return await r.json(); } catch (e) { return null; }
}
async function getJson(url, token) {
  var r = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
  try { return await r.json(); } catch (e) { return null; }
}

// The app pushes credentials + base URL here whenever they change or a refresh runs.
addEventListener("saveCreds", function (resolve, reject, args) {
  try {
    ["enabled", "base", "username", "password", "no2fa", "totpSecret", "totpDigits", "totpPeriod"].forEach(function (k) {
      if (args && args[k] != null) kvSet("np_" + k, args[k]);
    });
  } catch (e) {}
  resolve();
});

// Scheduled background check.
addEventListener("checkNeptun", async function (resolve, reject, args) {
  try { await check(); } catch (e) { try { console.error("checkNeptun: " + String(e)); } catch (_) {} }
  resolve();
});

async function check() {
  if (kvGet("np_enabled") !== "1") return; // a felhasználó kikapcsolta a háttér-ellenőrzést
  var base = kvGet("np_base"), user = kvGet("np_username"), pass = kvGet("np_password");
  if (!base || !user || !pass) return;
  if (base.charAt(base.length - 1) !== "/") base += "/";
  var no2fa = kvGet("np_no2fa") === "1";
  var token = "";
  if (!no2fa) {
    var secret = kvGet("np_totpSecret"); if (!secret) return;
    token = totp(secret, { digits: parseInt(kvGet("np_totpDigits") || "6", 10) || 6, period: parseInt(kvGet("np_totpPeriod") || "30", 10) || 30 });
  }
  var auth = await postJson(base + "Account/Authenticate", { userName: user, password: pass, captcha: "", captchaIdentifier: "", token: token, LCID: 1038 });
  var jwt = auth && (auth.accessToken || (auth.data && auth.data.accessToken));
  if (!jwt) return;
  // Két olcsó jelzés: olvasatlan üzenetek száma + összes vizsgajegy száma.
  var unread = null;
  try { var u = await getJson(base + "Message/GetUnreadedMessagesCount", jwt); var uc = u && (u.data && u.data.count != null ? u.data.count : u.count); if (typeof uc === "number") unread = uc; } catch (e) {}
  var gradeCount = 0;
  try {
    var ex = await getJson(base + "ExamResults/GetExamResultsList?sortAndPage.firstRow=0&sortAndPage.lastRow=500", jwt);
    var list = ex && ex.data && ex.data.data ? ex.data.data : (ex && ex.data ? ex.data : []);
    (Array.isArray(list) ? list : []).forEach(function (t) { gradeCount += ((t.examResultsList || []).length); });
  } catch (e) {}
  var prevUnread = parseInt(kvGet("np_lastUnread") || "-1", 10);
  var prevGrades = parseInt(kvGet("np_lastGrades") || "-1", 10);
  var parts = [], CAP = 15; // nagy ugrás baseline-hiba (pl. első betöltés), nem valódi újdonság → elnyomjuk
  if (prevUnread >= 0 && unread != null && unread > prevUnread && (unread - prevUnread) <= CAP) parts.push((unread - prevUnread) + " új üzenet");
  if (prevGrades >= 0 && gradeCount > prevGrades && (gradeCount - prevGrades) <= CAP) parts.push((gradeCount - prevGrades) + " új jegy");
  if (unread != null) kvSet("np_lastUnread", unread);
  kvSet("np_lastGrades", gradeCount);
  if (parts.length) {
    try { CapacitorNotifications.schedule([{ id: 1310000001, title: "Új a Neptunban", body: parts.join(" · ") + " · koppints a részletekért" }]); } catch (e) {}
  }
}
