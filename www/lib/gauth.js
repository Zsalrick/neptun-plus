// Parser for Google Authenticator export QR payloads:
//   otpauth-migration://offline?data=<url-encoded base64 protobuf>
// Also handles plain single otpauth:// URIs.
// Minimal protobuf reader (wire types 0 = varint, 2 = length-delimited).

import { base32Encode } from "./totp.js";

function b64ToBytes(b64) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readVarint(buf, pos) {
  let result = 0n, shift = 0n, p = pos;
  while (true) {
    const b = buf[p++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, p];
}

// Parse a protobuf message into { fieldNumber: [values...] }.
function parseMessage(buf, start = 0, end = buf.length) {
  const fields = {};
  let p = start;
  while (p < end) {
    let tag;
    [tag, p] = readVarint(buf, p);
    const fieldNo = Number(tag >> 3n);
    const wireType = Number(tag & 7n);
    let value;
    if (wireType === 0) {
      [value, p] = readVarint(buf, p);
    } else if (wireType === 2) {
      let len;
      [len, p] = readVarint(buf, p);
      const l = Number(len);
      value = buf.subarray(p, p + l);
      p += l;
    } else if (wireType === 5) {
      value = buf.subarray(p, p + 4); p += 4;
    } else if (wireType === 1) {
      value = buf.subarray(p, p + 8); p += 8;
    } else {
      throw new Error("Nem támogatott protobuf wire type: " + wireType);
    }
    (fields[fieldNo] ||= []).push(value);
  }
  return fields;
}

const ALGO = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512", 4: "MD5" };
const DIGITS = { 0: 6, 1: 6, 2: 8 };
const TYPE = { 0: "totp", 1: "hotp", 2: "totp" };

function decodeUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

// Returns array of { secret(base32), name, issuer, algorithm, digits, type }
export function parseMigrationUri(uri) {
  const url = new URL(uri);
  const scheme = uri.split(":")[0].toLowerCase();

  if (scheme === "otpauth") {
    // Single account URI: otpauth://totp/Issuer:name?secret=...&issuer=...
    const params = url.searchParams;
    const label = decodeURIComponent(url.pathname.replace(/^\/\//, "").replace(/^\//, ""));
    return [{
      secret: (params.get("secret") || "").toUpperCase(),
      name: label,
      issuer: params.get("issuer") || label.split(":")[0] || "",
      algorithm: (params.get("algorithm") || "SHA1").toUpperCase(),
      digits: parseInt(params.get("digits") || "6", 10),
      type: url.host.toLowerCase() === "hotp" ? "hotp" : "totp",
    }];
  }

  // otpauth-migration
  const data = url.searchParams.get("data");
  if (!data) throw new Error("Hiányzó 'data' paraméter a migration URI-ban.");
  const buf = b64ToBytes(data);
  const payload = parseMessage(buf);
  const otps = payload[1] || []; // repeated OtpParameters
  return otps.map((otpBytes) => {
    const f = parseMessage(otpBytes);
    const secretBytes = f[1] ? f[1][0] : new Uint8Array();
    return {
      secret: base32Encode(secretBytes),
      name: f[2] ? decodeUtf8(f[2][0]) : "",
      issuer: f[3] ? decodeUtf8(f[3][0]) : "",
      algorithm: ALGO[f[4] ? Number(f[4][0]) : 0] || "SHA1",
      digits: DIGITS[f[5] ? Number(f[5][0]) : 0] || 6,
      type: TYPE[f[6] ? Number(f[6][0]) : 0] || "totp",
    };
  });
}
