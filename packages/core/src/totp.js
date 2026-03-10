const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(input) {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = "";

  for (const char of cleaned) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) {
      throw new Error("Invalid TOTP secret (Base32).")
    }
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return new Uint8Array(bytes);
}

function normalizeSecret(secretOrUri) {
  if (!secretOrUri) {
    throw new Error("TOTP secret is empty.");
  }

  if (secretOrUri.startsWith("otpauth://")) {
    const url = new URL(secretOrUri);
    const secret = url.searchParams.get("secret");
    const digits = Number(url.searchParams.get("digits") || 6);
    const period = Number(url.searchParams.get("period") || 30);

    if (!secret) {
      throw new Error("otpauth URI does not include secret.");
    }

    return { secret, digits, period };
  }

  return { secret: secretOrUri, digits: 6, period: 30 };
}

export async function generateTotp(secretOrUri, timestamp = Date.now()) {
  const normalized = normalizeSecret(secretOrUri);
  const secretBytes = base32ToBytes(normalized.secret);
  const counter = Math.floor(timestamp / 1000 / normalized.period);

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  const code = String(binary % 10 ** normalized.digits).padStart(normalized.digits, "0");
  const elapsed = Math.floor(timestamp / 1000) % normalized.period;

  return {
    code,
    period: normalized.period,
    expiresIn: normalized.period - elapsed
  };
}
