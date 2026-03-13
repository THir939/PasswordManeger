function bytesFrom(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array();
}

export function utf8ToBytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

export function bytesToBase64Url(value) {
  const bytes = bytesFrom(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized) {
    return new Uint8Array();
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(...parts) {
  const arrays = parts.map((part) => bytesFrom(part));
  const total = arrays.reduce((sum, entry) => sum + entry.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const entry of arrays) {
    result.set(entry, offset);
    offset += entry.length;
  }
  return result;
}

function encodeUnsigned(majorType, value) {
  if (value < 24) {
    return Uint8Array.of((majorType << 5) | value);
  }
  if (value < 0x100) {
    return Uint8Array.of((majorType << 5) | 24, value);
  }
  if (value < 0x10000) {
    return Uint8Array.of((majorType << 5) | 25, value >> 8, value & 0xff);
  }
  if (value < 0x100000000) {
    return Uint8Array.of(
      (majorType << 5) | 26,
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    );
  }
  throw new Error("CBOR length is too large.");
}

export function cborEncode(value) {
  if (value === null) {
    return Uint8Array.of(0xf6);
  }

  if (value === false) {
    return Uint8Array.of(0xf4);
  }

  if (value === true) {
    return Uint8Array.of(0xf5);
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Only integer CBOR numbers are supported.");
    }
    if (value >= 0) {
      return encodeUnsigned(0, value);
    }
    return encodeUnsigned(1, -1 - value);
  }

  if (typeof value === "string") {
    const bytes = utf8ToBytes(value);
    return concatBytes(encodeUnsigned(3, bytes.length), bytes);
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = bytesFrom(value);
    return concatBytes(encodeUnsigned(2, bytes.length), bytes);
  }

  if (Array.isArray(value)) {
    return concatBytes(encodeUnsigned(4, value.length), ...value.map((entry) => cborEncode(entry)));
  }

  if (value instanceof Map) {
    const entries = [...value.entries()];
    return concatBytes(
      encodeUnsigned(5, entries.length),
      ...entries.flatMap(([key, entry]) => [cborEncode(key), cborEncode(entry)])
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    return concatBytes(
      encodeUnsigned(5, entries.length),
      ...entries.flatMap(([key, entry]) => [cborEncode(key), cborEncode(entry)])
    );
  }

  throw new Error("Unsupported CBOR value.");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", bytesFrom(value));
  return new Uint8Array(digest);
}

function uint16ToBytes(value) {
  return Uint8Array.of((value >> 8) & 0xff, value & 0xff);
}

function uint32ToBytes(value) {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

export function parseProxyRequestDetails(requestDetailsJson) {
  if (typeof requestDetailsJson === "string") {
    return JSON.parse(requestDetailsJson);
  }
  return requestDetailsJson && typeof requestDetailsJson === "object" ? structuredClone(requestDetailsJson) : {};
}

export function getProxyRpId(options = {}) {
  return String(options.rp?.id || options.rpId || "").trim().toLowerCase();
}

export function getProxyChallenge(options = {}) {
  return String(options.challenge || "").trim();
}

export function getAllowCredentialIds(options = {}) {
  if (!Array.isArray(options.allowCredentials)) {
    return [];
  }
  return options.allowCredentials
    .map((entry) => String(entry?.id || "").trim())
    .filter(Boolean);
}

function buildClientDataJson(type, challenge, origin) {
  return utf8ToBytes(
    JSON.stringify({
      type,
      challenge,
      origin,
      crossOrigin: false
    })
  );
}

function encodeCoseEc2PublicKey(publicJwk = {}) {
  const x = base64UrlToBytes(publicJwk.x || "");
  const y = base64UrlToBytes(publicJwk.y || "");
  return cborEncode(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y]
    ])
  );
}

async function buildAuthenticatorData({
  rpId,
  signCount,
  credentialId,
  publicKeyCose,
  includeAttestedData
}) {
  const rpIdHash = await sha256(utf8ToBytes(rpId));
  const flags = includeAttestedData ? 0x45 : 0x05;
  const header = concatBytes(rpIdHash, Uint8Array.of(flags), uint32ToBytes(signCount));

  if (!includeAttestedData) {
    return header;
  }

  const credentialIdBytes = base64UrlToBytes(credentialId);
  const attested = concatBytes(
    new Uint8Array(16),
    uint16ToBytes(credentialIdBytes.length),
    credentialIdBytes,
    publicKeyCose
  );

  return concatBytes(header, attested);
}

export async function createSoftwarePasskeyRecord({
  rpId,
  userName,
  userDisplayName,
  userHandle,
  origin,
  title,
  authenticatorAttachment = "platform",
  residentKey = "preferred",
  userVerification = "preferred",
  transports = ["internal"]
}) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );

  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const credentialId = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const normalizedUserHandle = userHandle || bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const publicKeyCose = encodeCoseEc2PublicKey(publicKeyJwk);

  return {
    event: "create",
    credentialId,
    rpId,
    userName,
    userDisplayName,
    userHandle: normalizedUserHandle,
    origin,
    title,
    authenticatorAttachment,
    transports,
    residentKey,
    userVerification,
    source: "software-webauthn-proxy",
    proxyProvider: "software",
    algorithm: -7,
    signCount: 0,
    publicKeyJwk,
    privateKeyJwk,
    credentialPublicKey: bytesToBase64Url(publicKeyCose)
  };
}

export async function buildCreateResponseJson(options, origin, passkey) {
  const challenge = getProxyChallenge(options);
  const publicKeyCose = base64UrlToBytes(passkey.credentialPublicKey || "");
  const authenticatorData = await buildAuthenticatorData({
    rpId: passkey.rpId || getProxyRpId(options),
    signCount: Number(passkey.signCount || 0),
    credentialId: passkey.credentialId,
    publicKeyCose,
    includeAttestedData: true
  });
  const clientDataJSON = buildClientDataJson("webauthn.create", challenge, origin);
  const attestationObject = cborEncode(
    new Map([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authenticatorData]
    ])
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    passkey.publicKeyJwk,
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["verify"]
  );
  const publicKeySpki = await crypto.subtle.exportKey("spki", publicKey);

  return {
    id: passkey.credentialId,
    rawId: passkey.credentialId,
    type: "public-key",
    authenticatorAttachment: passkey.authenticatorAttachment || "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: bytesToBase64Url(clientDataJSON),
      attestationObject: bytesToBase64Url(attestationObject),
      authenticatorData: bytesToBase64Url(authenticatorData),
      publicKey: bytesToBase64Url(publicKeySpki),
      publicKeyAlgorithm: Number(passkey.algorithm || -7),
      transports: Array.isArray(passkey.transports) && passkey.transports.length ? passkey.transports : ["internal"]
    }
  };
}

export async function buildGetResponseJson(options, origin, passkey) {
  const challenge = getProxyChallenge(options);
  const nextSignCount = Number(passkey.signCount || 0) + 1;
  const authenticatorData = await buildAuthenticatorData({
    rpId: passkey.rpId || getProxyRpId(options),
    signCount: nextSignCount,
    includeAttestedData: false
  });
  const clientDataJSON = buildClientDataJson("webauthn.get", challenge, origin);
  const clientDataHash = await sha256(clientDataJSON);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    passkey.privateKeyJwk,
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    privateKey,
    concatBytes(authenticatorData, clientDataHash)
  );

  return {
    nextSignCount,
    responseJson: {
      id: passkey.credentialId,
      rawId: passkey.credentialId,
      type: "public-key",
      authenticatorAttachment: passkey.authenticatorAttachment || "platform",
      clientExtensionResults: {},
      response: {
        authenticatorData: bytesToBase64Url(authenticatorData),
        clientDataJSON: bytesToBase64Url(clientDataJSON),
        signature: bytesToBase64Url(signature),
        userHandle: passkey.userHandle || ""
      }
    }
  };
}
