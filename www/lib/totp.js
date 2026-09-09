// TOTP + Base32 helpers. Vanilla JS, uses Web Crypto (works in secure contexts,
// incl. http://localhost and the Capacitor WebView).

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input) {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Érvénytelen Base32 karakter: " + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

const ALGO_MAP = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" };

// Returns { code, secondsRemaining, period }
export async function generateTOTP(secretBase32, {
  digits = 6, period = 30, algorithm = "SHA1", timestamp = Date.now(),
} = {}) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestamp / 1000 / period);

  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  // 64-bit big-endian counter (high word is 0 for any realistic time).
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: ALGO_MAP[algorithm] || "SHA-1" },
    false, ["sign"],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes));

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 10 ** digits).toString().padStart(digits, "0");
  const secondsRemaining = period - (Math.floor(timestamp / 1000) % period);
  return { code, secondsRemaining, period };
}
