import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const KDF_ITERATIONS = 310000;

function ensureCrypto() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generator is not available.");
  }
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const chunk = (a << 16) | ((b || 0) << 8) | (c || 0);

    result += BASE64_ALPHABET[(chunk >> 18) & 63];
    result += BASE64_ALPHABET[(chunk >> 12) & 63];
    result += typeof b === "number" ? BASE64_ALPHABET[(chunk >> 6) & 63] : "=";
    result += typeof c === "number" ? BASE64_ALPHABET[chunk & 63] : "=";
  }
  return result;
}

export function base64ToBytes(base64) {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  const clean = String(base64 || "").replace(/[^A-Za-z0-9+/=]/g, "");
  const output = [];

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i]);
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === "=" ? -1 : BASE64_ALPHABET.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === "=" ? -1 : BASE64_ALPHABET.indexOf(clean[i + 3]);
    const chunk = (c0 << 18) | (c1 << 12) | ((Math.max(c2, 0) & 63) << 6) | (Math.max(c3, 0) & 63);

    output.push((chunk >> 16) & 255);
    if (c2 >= 0) output.push((chunk >> 8) & 255);
    if (c3 >= 0) output.push(chunk & 255);
  }

  return Uint8Array.from(output);
}

function randomBytes(length) {
  ensureCrypto();
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveAesKey(masterPassword, saltBytes, iterations = KDF_ITERATIONS) {
  ensureCrypto();
  return pbkdf2(sha256, encoder.encode(masterPassword), saltBytes, {
    c: iterations,
    dkLen: 32
  });
}

export async function encryptJson(value, aesKey, ivBytes = randomBytes(12)) {
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = gcm(aesKey, ivBytes).encrypt(plaintext);

  return {
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(ciphertext)
  };
}

export async function decryptJson(payload, aesKey) {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plaintext = gcm(aesKey, iv).decrypt(ciphertext);
  return JSON.parse(decoder.decode(plaintext));
}

export async function createVaultEnvelope(vaultData, masterPassword, kdfConfig = {}) {
  const iterations = Number(kdfConfig.iterations) || KDF_ITERATIONS;
  const saltBytes = kdfConfig.salt ? base64ToBytes(kdfConfig.salt) : randomBytes(16);
  const aesKey = await deriveAesKey(masterPassword, saltBytes, iterations);
  const encrypted = await encryptJson(vaultData, aesKey);

  return {
    version: 1,
    kdf: {
      algorithm: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt: bytesToBase64(saltBytes)
    },
    cipher: {
      algorithm: "AES-GCM",
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext
    },
    updatedAt: new Date().toISOString()
  };
}

export async function unlockVaultEnvelope(envelope, masterPassword) {
  if (!envelope?.kdf?.salt || !envelope?.cipher?.iv || !envelope?.cipher?.ciphertext) {
    throw new Error("Vault format is invalid.");
  }

  const iterations = Number(envelope.kdf.iterations) || KDF_ITERATIONS;
  const salt = base64ToBytes(envelope.kdf.salt);
  const key = await deriveAesKey(masterPassword, salt, iterations);
  const vault = await decryptJson(
    {
      iv: envelope.cipher.iv,
      ciphertext: envelope.cipher.ciphertext
    },
    key
  );

  return { key, vault };
}
