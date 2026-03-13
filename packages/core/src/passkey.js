function sanitizeString(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function sanitizeJwk(value, { allowPrivate = false } = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const next = {
    kty: sanitizeString(value.kty || "", 20),
    crv: sanitizeString(value.crv || "", 20),
    x: sanitizeString(value.x || "", 200),
    y: sanitizeString(value.y || "", 200),
    ext: Boolean(value.ext)
  };

  if (allowPrivate) {
    next.d = sanitizeString(value.d || "", 200);
  }

  if (Array.isArray(value.key_ops)) {
    next.key_ops = value.key_ops.map((entry) => sanitizeString(entry, 20)).filter(Boolean).slice(0, 4);
  }

  return next.kty ? next : null;
}

function sanitizeTransportList(value) {
  const allowed = new Set(["usb", "nfc", "ble", "hybrid", "internal"]);
  const input = Array.isArray(value) ? value : [];
  return input
    .map((entry) => sanitizeString(entry, 30).toLowerCase())
    .filter((entry) => allowed.has(entry))
    .slice(0, 8);
}

export function normalizePasskeyRecord(input = {}, existing = {}) {
  const source = sanitizeString(input.source || existing.source || "manual", 30).toLowerCase();
  const event = sanitizeString(input.event || existing.event || "", 20).toLowerCase();
  const attachment = sanitizeString(input.authenticatorAttachment || existing.authenticatorAttachment || "", 30).toLowerCase();
  const residentKey = sanitizeString(input.residentKey || existing.residentKey || "", 30).toLowerCase();
  const userVerification = sanitizeString(input.userVerification || existing.userVerification || "", 30).toLowerCase();
  const approvalMethod = sanitizeString(input.approvalMethod || existing.approvalMethod || "", 40).toLowerCase();

  return {
    credentialId: sanitizeString(input.credentialId || existing.credentialId || "", 1200),
    rpId: sanitizeString(input.rpId || existing.rpId || "", 255).toLowerCase(),
    userName: sanitizeString(input.userName || existing.userName || "", 200),
    userDisplayName: sanitizeString(input.userDisplayName || existing.userDisplayName || "", 200),
    userHandle: sanitizeString(input.userHandle || existing.userHandle || "", 1200),
    origin: sanitizeString(input.origin || existing.origin || "", 300),
    authenticatorAttachment: ["platform", "cross-platform"].includes(attachment) ? attachment : "",
    transports: sanitizeTransportList(input.transports || existing.transports || []),
    residentKey,
    userVerification,
    source,
    event,
    proxyProvider: sanitizeString(input.proxyProvider || existing.proxyProvider || "", 40),
    credentialPublicKey: sanitizeString(input.credentialPublicKey || existing.credentialPublicKey || "", 2000),
    algorithm: Number.isFinite(Number(input.algorithm)) ? Number(input.algorithm) : Number(existing.algorithm) || 0,
    signCount: sanitizeInteger(input.signCount ?? existing.signCount, 0),
    approvalMethod,
    publicKeyJwk: sanitizeJwk(input.publicKeyJwk || existing.publicKeyJwk || null),
    privateKeyJwk: sanitizeJwk(input.privateKeyJwk || existing.privateKeyJwk || null, { allowPrivate: true }),
    createdAt: sanitizeString(existing.createdAt || input.createdAt || "", 40),
    lastSeenAt: sanitizeString(input.lastSeenAt || existing.lastSeenAt || "", 40),
    lastUsedAt: sanitizeString(input.lastUsedAt || existing.lastUsedAt || "", 40)
  };
}

export function defaultPasskeyUrl(record = {}) {
  if (record.origin) {
    return record.origin;
  }
  if (record.rpId) {
    return `https://${record.rpId}`;
  }
  return "";
}

export function buildPasskeyTitle(input = {}) {
  const user = sanitizeString(input.userDisplayName || input.userName || "", 120);
  const rpId = sanitizeString(input.rpId || "", 120);
  if (user && rpId) {
    return `${user} (${rpId})`;
  }
  if (rpId) {
    return `${rpId} Passkey`;
  }
  return "Passkey";
}

export function buildPasskeyFingerprint(input = {}) {
  const record = normalizePasskeyRecord(input);
  return `${record.rpId}|${record.credentialId}`;
}

export function shortenCredentialId(value = "") {
  const raw = sanitizeString(value, 1200);
  if (!raw) {
    return "";
  }
  if (raw.length <= 20) {
    return raw;
  }
  return `${raw.slice(0, 10)}…${raw.slice(-8)}`;
}
