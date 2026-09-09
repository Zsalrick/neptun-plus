// Headless validation of totp.js and gauth.js (Node 24 has atob/URL/TextDecoder/crypto globals).
import { generateTOTP, base32Decode, base32Encode } from "./www/lib/totp.js";
import { parseMigrationUri } from "./www/lib/gauth.js";

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };

// --- Base32 roundtrip ---
console.log("Base32:");
const bytes = new TextEncoder().encode("Hello!");
ok(base32Encode(bytes) === "JBSWY3DPEE", "encode Hello! -> " + base32Encode(bytes));
ok(new TextDecoder().decode(base32Decode("JBSWY3DPEE")) === "Hello!", "decode roundtrip");

// --- TOTP against RFC 6238 test vector (secret "12345678901234567890", SHA1, 8 digits) ---
console.log("TOTP (RFC 6238):");
const rfcSecret = base32Encode(new TextEncoder().encode("12345678901234567890"));
const v1 = await generateTOTP(rfcSecret, { digits: 8, timestamp: 59 * 1000 });
ok(v1.code === "94287082", "t=59 -> " + v1.code + " (expect 94287082)");
const v2 = await generateTOTP(rfcSecret, { digits: 8, timestamp: 1111111109 * 1000 });
ok(v2.code === "07081804", "t=1111111109 -> " + v2.code + " (expect 07081804)");

// --- Build a Google Authenticator migration payload and parse it ---
console.log("Google Authenticator export parse:");
function varint(n) { const o = []; n = BigInt(n); do { let b = Number(n & 0x7fn); n >>= 7n; if (n > 0n) b |= 0x80; o.push(b); } while (n > 0n); return o; }
function lenDelim(field, buf) { return [(field << 3) | 2, ...varint(buf.length), ...buf]; }
function vField(field, val) { return [(field << 3) | 0, ...varint(val)]; }
const secretRaw = [...new TextEncoder().encode("12345678901234567890")];
const otp = [
  ...lenDelim(1, secretRaw),
  ...lenDelim(2, [...new TextEncoder().encode("hallgato@uni-pannon.hu")]),
  ...lenDelim(3, [...new TextEncoder().encode("Neptun")]),
  ...vField(4, 1), // SHA1
  ...vField(5, 1), // 6 digits
  ...vField(6, 2), // TOTP
];
const payload = [...lenDelim(1, otp), ...vField(2, 1), ...vField(3, 1), ...vField(4, 0)];
const b64 = Buffer.from(payload).toString("base64");
const uri = "otpauth-migration://offline?data=" + encodeURIComponent(b64);
const accounts = parseMigrationUri(uri);
ok(accounts.length === 1, "parsed 1 account");
ok(accounts[0].name === "hallgato@uni-pannon.hu", "name = " + accounts[0].name);
ok(accounts[0].issuer === "Neptun", "issuer = " + accounts[0].issuer);
ok(accounts[0].secret === rfcSecret, "secret matches (" + accounts[0].secret + ")");
ok(accounts[0].algorithm === "SHA1" && accounts[0].digits === 6, "algo/digits ok");

// --- plain otpauth:// single URI ---
const single = parseMigrationUri("otpauth://totp/Neptun:abc123?secret=JBSWY3DPEHPK3PXP&issuer=Neptun&digits=6");
ok(single[0].secret === "JBSWY3DPEHPK3PXP" && single[0].issuer === "Neptun", "single otpauth URI parsed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
