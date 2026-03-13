import { validateCloudBaseUrl } from "@pm/core/cloud-url";

const CLOUD_BASE_URL_KEY = "pm_mobile_cloud_base_url";
const CLOUD_TOKEN_KEY = "pm_mobile_cloud_token";
const CLOUD_EMAIL_KEY = "pm_mobile_cloud_email";
const CLOUD_REVISION_KEY = "pm_mobile_cloud_revision";
const CLOUD_LAST_SYNC_KEY = "pm_mobile_cloud_last_sync";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getSecureStore(storageImpl) {
  if (storageImpl) {
    return storageImpl;
  }

  const module = await import("expo-secure-store");
  return module;
}

async function readValue(storage, key) {
  try {
    return (await storage.getItemAsync(key)) || "";
  } catch {
    return "";
  }
}

async function deleteValue(storage, key) {
  try {
    await storage.deleteItemAsync(key);
  } catch {
    // ignore storage cleanup errors
  }
}

async function persistValue(storage, key, value) {
  const normalized = String(value || "");
  if (!normalized) {
    await deleteValue(storage, key);
    return;
  }

  await storage.setItemAsync(key, normalized);
}

async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

function assertOkResponse(response, payload, fallbackMessage) {
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || fallbackMessage || `Request failed: ${response.status}`);
  }
}

export function normalizeCloudBaseUrl(baseUrl) {
  return validateCloudBaseUrl(String(baseUrl || "").trim());
}

export async function loadCloudSession(options = {}) {
  const storage = await getSecureStore(options.storage);
  const [rawBaseUrl, token, email, rawRevision, lastSyncAt] = await Promise.all([
    readValue(storage, CLOUD_BASE_URL_KEY),
    readValue(storage, CLOUD_TOKEN_KEY),
    readValue(storage, CLOUD_EMAIL_KEY),
    readValue(storage, CLOUD_REVISION_KEY),
    readValue(storage, CLOUD_LAST_SYNC_KEY)
  ]);

  let baseUrl = "";
  try {
    baseUrl = rawBaseUrl ? normalizeCloudBaseUrl(rawBaseUrl) : "";
  } catch {
    baseUrl = "";
  }

  return {
    baseUrl,
    token: String(token || ""),
    email: normalizeEmail(email),
    revision: Number(rawRevision) || 0,
    lastSyncAt: String(lastSyncAt || "")
  };
}

export async function saveCloudSession(session = {}, options = {}) {
  const storage = await getSecureStore(options.storage);
  const baseUrl = session.baseUrl ? normalizeCloudBaseUrl(session.baseUrl) : "";
  const token = String(session.token || "");
  const email = normalizeEmail(session.email);
  const revision = Number(session.revision) || 0;
  const lastSyncAt = String(session.lastSyncAt || "");

  await Promise.all([
    persistValue(storage, CLOUD_BASE_URL_KEY, baseUrl),
    persistValue(storage, CLOUD_TOKEN_KEY, token),
    persistValue(storage, CLOUD_EMAIL_KEY, email),
    persistValue(storage, CLOUD_REVISION_KEY, String(revision)),
    persistValue(storage, CLOUD_LAST_SYNC_KEY, lastSyncAt)
  ]);

  return {
    baseUrl,
    token,
    email,
    revision,
    lastSyncAt
  };
}

export async function clearCloudSession(options = {}) {
  const storage = await getSecureStore(options.storage);
  await Promise.all([
    deleteValue(storage, CLOUD_BASE_URL_KEY),
    deleteValue(storage, CLOUD_TOKEN_KEY),
    deleteValue(storage, CLOUD_EMAIL_KEY),
    deleteValue(storage, CLOUD_REVISION_KEY),
    deleteValue(storage, CLOUD_LAST_SYNC_KEY)
  ]);
}

export async function registerCloudAccount({ baseUrl, email, password }, options = {}) {
  const normalizedBaseUrl = normalizeCloudBaseUrl(baseUrl);
  const normalizedEmail = normalizeEmail(email);
  const response = await (options.fetchImpl || fetch)(`${normalizedBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: String(password || "")
    })
  });

  const payload = await parseJsonResponse(response);
  assertOkResponse(response, payload, "クラウドアカウントの登録に失敗しました。");

  return {
    baseUrl: normalizedBaseUrl,
    token: String(payload.token || ""),
    user: payload.user || null
  };
}

export async function loginCloudAccount({ baseUrl, email, password }, options = {}) {
  const normalizedBaseUrl = normalizeCloudBaseUrl(baseUrl);
  const normalizedEmail = normalizeEmail(email);
  const response = await (options.fetchImpl || fetch)(`${normalizedBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: String(password || "")
    })
  });

  const payload = await parseJsonResponse(response);
  assertOkResponse(response, payload, "クラウドログインに失敗しました。");

  return {
    baseUrl: normalizedBaseUrl,
    token: String(payload.token || ""),
    user: payload.user || null
  };
}

export async function fetchCloudBillingStatus({ baseUrl, token }, options = {}) {
  const normalizedBaseUrl = normalizeCloudBaseUrl(baseUrl);
  const authToken = String(token || "").trim();

  if (!authToken) {
    throw new Error("クラウド認証トークンがありません。");
  }

  const response = await (options.fetchImpl || fetch)(`${normalizedBaseUrl}/api/billing/status`, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const payload = await parseJsonResponse(response);
  assertOkResponse(response, payload, "課金状態の取得に失敗しました。");
  return payload;
}

export async function pushCloudVaultSnapshot({ baseUrl, token, revision, envelope }, options = {}) {
  const normalizedBaseUrl = normalizeCloudBaseUrl(baseUrl);
  const authToken = String(token || "").trim();
  if (!authToken) {
    throw new Error("クラウド認証トークンがありません。");
  }
  if (!envelope?.kdf || !envelope?.cipher) {
    throw new Error("同期する暗号化Vaultがありません。");
  }

  const expectedRevision = Number(revision) || 0;
  const response = await (options.fetchImpl || fetch)(`${normalizedBaseUrl}/api/vault/snapshot`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({
      expectedRevision,
      nextRevision: expectedRevision + 1,
      envelope
    })
  });

  const payload = await parseJsonResponse(response);
  assertOkResponse(response, payload, "クラウド同期の push に失敗しました。");
  return payload.snapshot || null;
}

export async function pullCloudVaultSnapshot({ baseUrl, token }, options = {}) {
  const normalizedBaseUrl = normalizeCloudBaseUrl(baseUrl);
  const authToken = String(token || "").trim();
  if (!authToken) {
    throw new Error("クラウド認証トークンがありません。");
  }

  const response = await (options.fetchImpl || fetch)(`${normalizedBaseUrl}/api/vault/snapshot`, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const payload = await parseJsonResponse(response);
  assertOkResponse(response, payload, "クラウド同期の pull に失敗しました。");
  return payload.snapshot || null;
}
