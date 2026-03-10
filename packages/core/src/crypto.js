const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const KDF_ITERATIONS = 310000;

function ensureCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto API is not available.");
  }
}

export function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length) {
  ensureCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveAesKey(masterPassword, saltBytes, iterations = KDF_ITERATIONS) {
  ensureCrypto();

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(value, aesKey, ivBytes = randomBytes(12)) {
  ensureCrypto();

  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBytes
    },
    aesKey,
    plaintext
  );

  return {
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptJson(payload, aesKey) {
  ensureCrypto();

  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    aesKey,
    ciphertext
  );

  return JSON.parse(decoder.decode(plaintextBuffer));
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
