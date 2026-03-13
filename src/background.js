import {
  createVaultEnvelope,
  encryptJson,
  unlockVaultEnvelope
} from "./lib/crypto.js";
import { generatePassword } from "./lib/password.js";
import { generateTotp } from "./lib/totp.js";
import { buildSecurityReport } from "./lib/security-audit.js";
import { parseExternalItems } from "./lib/migration.js";
import { buildAutofillRisk, extractDomain } from "./lib/autofill-risk.js";
import { generateDomainAlias, generateRandomAlias } from "./lib/email-alias.js";
import { safeCloudBaseUrl, validateCloudBaseUrl } from "./lib/cloud-url.js";
import {
  normalizePasskeyRecord,
  defaultPasskeyUrl,
  buildPasskeyTitle,
  buildPasskeyFingerprint
} from "./lib/passkey.js";
import {
  parseProxyRequestDetails,
  getProxyRpId,
  getProxyChallenge,
  getAllowCredentialIds,
  createSoftwarePasskeyRecord,
  buildCreateResponseJson,
  buildGetResponseJson
} from "./lib/webauthn-proxy.js";
import {
  DESKTOP_PASSKEY_BRIDGE_BASE_URL,
  getDesktopPasskeyBridgeStatus,
  requestDesktopPasskeyApproval
} from "./lib/desktop-passkey-client.js";
import { UI_LANGUAGE_STORAGE_KEY } from "./lib/i18n.js";

const STORAGE_KEY = "pm_encrypted_vault";
const AUTO_LOCK_ALARM = "pm-auto-lock";
const CLOUD_AUTH_PUBLIC_KEY = "pm_cloud_auth_public";
const CLOUD_AUTH_TOKEN_KEY = "pm_cloud_auth_token";
const FORM_LEARNING_KEY = "pm_form_learning_profiles";
const AUTOFILL_TRUST_KEY = "pm_autofill_trust";
const PENDING_CAPTURES_KEY = "pm_pending_captures";
const DEADMAN_CONFIG_KEY = "pm_deadman_config";
const DEADMAN_CHECK_ALARM = "pm-deadman-check";

const session = {
  unlocked: false,
  key: null,
  kdf: null,
  vault: null,
  lastActivityAt: 0,
  isDecoy: false,
  decoyKey: null,
  decoyVault: null
};

const pendingPasskeyRequests = [];
const pendingPasskeyApprovals = new Map();
const proxyState = {
  attached: false
};
const PASSKEY_APPROVAL_NOTIFICATION_PREFIX = "pm-passkey-approval:";

function normalizeHostForCompare(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncPendingCaptureBadge(captures = []) {
  try {
    const count = Array.isArray(captures) ? captures.length : 0;
    await chrome.action.setBadgeBackgroundColor({ color: "#111827" });
    await chrome.action.setBadgeText({
      text: count > 0 ? String(Math.min(count, 9)) : ""
    });
  } catch {
    // ignore badge update errors
  }
}

function safeJsonParse(value, fallback = {}) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function normalizePasskeyRequestContext(payload = {}) {
  const details = safeJsonParse(payload.requestDetailsJson, {});
  return {
    kind: String(payload.kind || "").trim().toLowerCase(),
    rpId: getProxyRpId(details) || String(payload.rpId || "").trim().toLowerCase(),
    challenge: getProxyChallenge(details) || String(payload.challenge || "").trim(),
    requestDetailsJson: JSON.stringify(details),
    origin: String(payload.origin || "").trim(),
    url: String(payload.url || "").trim(),
    title: String(payload.title || "").trim().slice(0, 140),
    requestedAt: Date.now()
  };
}

function addPendingPasskeyRequest(payload = {}) {
  const cutoff = Date.now() - 15_000;
  for (let index = pendingPasskeyRequests.length - 1; index >= 0; index -= 1) {
    if (pendingPasskeyRequests[index].requestedAt < cutoff) {
      pendingPasskeyRequests.splice(index, 1);
    }
  }

  const request = normalizePasskeyRequestContext(payload);
  if (!request.kind || !request.rpId || !request.challenge) {
    return null;
  }

  pendingPasskeyRequests.unshift(request);
  pendingPasskeyRequests.splice(30);
  return request;
}

function consumePendingPasskeyRequest(kind, rpId, challenge) {
  const index = pendingPasskeyRequests.findIndex((entry) =>
    entry.kind === kind && entry.rpId === rpId && entry.challenge === challenge
  );

  if (index < 0) {
    return null;
  }

  const [request] = pendingPasskeyRequests.splice(index, 1);
  return request;
}

async function waitForPendingPasskeyRequest(kind, rpId, challenge, timeoutMs = 1200) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const match = consumePendingPasskeyRequest(kind, rpId, challenge);
    if (match) {
      return match;
    }
    await delay(40);
  }
  return null;
}

function getCloudTokenStorage() {
  if (chrome.storage.session && typeof chrome.storage.session.get === "function") {
    return chrome.storage.session;
  }
  return chrome.storage.local;
}

async function getCloudState() {
  const tokenStorage = getCloudTokenStorage();
  const [publicResult, tokenResult] = await Promise.all([
    chrome.storage.local.get(CLOUD_AUTH_PUBLIC_KEY),
    tokenStorage.get(CLOUD_AUTH_TOKEN_KEY)
  ]);

  const payload = publicResult[CLOUD_AUTH_PUBLIC_KEY] || {};
  const tokenPayload = tokenResult[CLOUD_AUTH_TOKEN_KEY] || {};

  return {
    baseUrl: safeCloudBaseUrl(payload.baseUrl || ""),
    token: String(tokenPayload.token || ""),
    revision: Number(payload.revision) || 0,
    lastSyncAt: payload.lastSyncAt || null,
    user: payload.user || null
  };
}

async function setCloudState(next) {
  const tokenStorage = getCloudTokenStorage();
  await Promise.all([
    chrome.storage.local.set({
      [CLOUD_AUTH_PUBLIC_KEY]: {
        baseUrl: safeCloudBaseUrl(next.baseUrl || ""),
        revision: Number(next.revision) || 0,
        lastSyncAt: next.lastSyncAt || null,
        user: next.user || null
      }
    }),
    tokenStorage.set({
      [CLOUD_AUTH_TOKEN_KEY]: {
        token: String(next.token || "")
      }
    })
  ]);
}

async function clearCloudState() {
  const removals = [
    chrome.storage.local.remove(CLOUD_AUTH_PUBLIC_KEY),
    chrome.storage.local.remove(CLOUD_AUTH_TOKEN_KEY)
  ];

  if (chrome.storage.session && typeof chrome.storage.session.remove === "function") {
    removals.push(chrome.storage.session.remove(CLOUD_AUTH_TOKEN_KEY));
  }

  await Promise.all(removals);
}

async function ensureCloudStateMigration() {
  try {
    const legacy = await chrome.storage.local.get("pm_cloud_auth");
    const payload = legacy.pm_cloud_auth;
    if (!payload || typeof payload !== "object") {
      return;
    }

    await setCloudState({
      baseUrl: safeCloudBaseUrl(payload.baseUrl || ""),
      token: String(payload.token || ""),
      revision: Number(payload.revision) || 0,
      lastSyncAt: payload.lastSyncAt || null,
      user: payload.user || null
    });
    await chrome.storage.local.remove("pm_cloud_auth");
  } catch {
    // migration failure should not block extension startup
  }
}

ensureCloudStateMigration();

async function getFormLearningProfiles() {
  const result = await chrome.storage.local.get(FORM_LEARNING_KEY);
  const payload = result[FORM_LEARNING_KEY];
  return payload && typeof payload === "object" ? payload : {};
}

async function setFormLearningProfiles(next) {
  await chrome.storage.local.set({
    [FORM_LEARNING_KEY]: next
  });
}

async function getAutofillTrust() {
  const result = await chrome.storage.local.get(AUTOFILL_TRUST_KEY);
  const payload = result[AUTOFILL_TRUST_KEY];
  return payload && typeof payload === "object" ? payload : {};
}

async function setAutofillTrust(next) {
  await chrome.storage.local.set({
    [AUTOFILL_TRUST_KEY]: next
  });
}

async function getPendingCaptures() {
  const result = await chrome.storage.local.get(PENDING_CAPTURES_KEY);
  const payload = result[PENDING_CAPTURES_KEY];
  return Array.isArray(payload) ? payload : [];
}

async function getUiLanguagePreference() {
  const result = await chrome.storage.local.get(UI_LANGUAGE_STORAGE_KEY);
  const value = String(result[UI_LANGUAGE_STORAGE_KEY] || "").trim();
  return value || "auto";
}

async function setUiLanguagePreference(value = "auto") {
  const next = String(value || "auto").trim() || "auto";
  await chrome.storage.local.set({
    [UI_LANGUAGE_STORAGE_KEY]: next
  });
  return next;
}

async function setPendingCaptures(next) {
  const captures = Array.isArray(next) ? next.slice(0, 30) : [];
  await chrome.storage.local.set({
    [PENDING_CAPTURES_KEY]: captures
  });
  await syncPendingCaptureBadge(captures);
  return captures;
}

getPendingCaptures()
  .then((captures) => syncPendingCaptureBadge(captures))
  .catch(() => {});

async function cloudRequest(cloudState, endpoint, options = {}) {
  const baseUrl = validateCloudBaseUrl(cloudState.baseUrl || "", { allowEmpty: false });
  if (!baseUrl) {
    throw new Error("クラウドAPIのURLが設定されていません。");
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(cloudState.token ? { authorization: `Bearer ${cloudState.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const reason = payload?.error || `Cloud request failed (${response.status})`;
    throw new Error(reason);
  }

  return payload;
}

function createDefaultVault() {
  const createdAt = nowIso();
  return {
    version: 1,
    meta: {
      createdAt,
      updatedAt: createdAt
    },
    settings: {
      autoLockMinutes: 10,
      clipboardClearSeconds: 20,
      displayLanguage: "auto",
      aliasBaseEmail: "",
      passkeyProxyEnabled: false,
      passkeyDesktopApprovalEnabled: true,
      generator: {
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
      }
    },
    items: [],
    decoy: {
      enabled: false,
      kdf: null,
      cipher: null
    }
  };
}

function normalizeStoredItem(item) {
  const now = nowIso();
  const sub = item?.subscription || {};
  const passkey = normalizePasskeyRecord(item?.passkey || {});
  return {
    id: item?.id || crypto.randomUUID(),
    type: ["login", "card", "identity", "note", "passkey"].includes(item?.type) ? item.type : "login",
    title: String(item?.title || "Untitled").trim().slice(0, 140),
    username: String(item?.username || "").trim().slice(0, 200),
    password: String(item?.password || "").slice(0, 500),
    url: normalizeUrl(item?.url || defaultPasskeyUrl(passkey)),
    notes: String(item?.notes || "").trim().slice(0, 4000),
    otpSecret: String(item?.otpSecret || "").trim().slice(0, 300),
    fullName: String(item?.fullName || "").trim().slice(0, 200),
    email: String(item?.email || "").trim().slice(0, 200),
    phone: String(item?.phone || "").trim().slice(0, 50),
    address: String(item?.address || "").trim().slice(0, 400),
    cardHolder: String(item?.cardHolder || "").trim().slice(0, 120),
    cardNumber: String(item?.cardNumber || "").replace(/\s+/g, "").slice(0, 40),
    cardExpiry: String(item?.cardExpiry || "").trim().slice(0, 10),
    cardCvc: String(item?.cardCvc || "").trim().slice(0, 10),
    tags: sanitizeTags(item?.tags || []),
    favorite: Boolean(item?.favorite),
    subscription: {
      isSubscription: Boolean(sub.isSubscription),
      amount: Math.max(0, Number(sub.amount) || 0),
      currency: String(sub.currency || "JPY").slice(0, 5),
      cycle: ["monthly", "yearly", "weekly"].includes(sub.cycle) ? sub.cycle : "monthly",
      nextBillingDate: String(sub.nextBillingDate || "").slice(0, 20)
    },
    passkey,
    passwordUpdatedAt: item?.passwordUpdatedAt || null,
    createdAt: item?.createdAt || now,
    updatedAt: item?.updatedAt || now,
    lastUsedAt: item?.lastUsedAt || null
  };
}

function normalizeVault(vault) {
  const fallback = createDefaultVault();
  const incoming = vault && typeof vault === "object" ? vault : {};
  const items = Array.isArray(incoming.items) ? incoming.items.map(normalizeStoredItem) : [];

  return {
    version: 1,
    meta: {
      createdAt: incoming.meta?.createdAt || fallback.meta.createdAt,
      updatedAt: incoming.meta?.updatedAt || fallback.meta.updatedAt
    },
    settings: {
      autoLockMinutes: Number(incoming.settings?.autoLockMinutes) || fallback.settings.autoLockMinutes,
      clipboardClearSeconds: Number(incoming.settings?.clipboardClearSeconds) || fallback.settings.clipboardClearSeconds,
      displayLanguage: String(incoming.settings?.displayLanguage || fallback.settings.displayLanguage || "auto"),
      aliasBaseEmail: String(incoming.settings?.aliasBaseEmail || "").trim(),
      passkeyProxyEnabled: Boolean(incoming.settings?.passkeyProxyEnabled),
      passkeyDesktopApprovalEnabled: incoming.settings?.passkeyDesktopApprovalEnabled ?? fallback.settings.passkeyDesktopApprovalEnabled,
      generator: {
        ...fallback.settings.generator,
        ...(incoming.settings?.generator || {})
      }
    },
    items,
    decoy: incoming.decoy || fallback.decoy
  };
}

function resetSession() {
  session.unlocked = false;
  session.key = null;
  session.kdf = null;
  session.vault = null;
  session.lastActivityAt = 0;
  session.isDecoy = false;
  session.decoyKey = null;
  session.decoyVault = null;
  syncPasskeyProxyState().catch(() => { });
}

function touchSession() {
  session.lastActivityAt = Date.now();
}

async function getStoredEnvelope() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? null;
}

async function setStoredEnvelope(envelope) {
  await chrome.storage.local.set({ [STORAGE_KEY]: envelope });
}

function sanitizeTags(tagsValue) {
  if (Array.isArray(tagsValue)) {
    return tagsValue
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (typeof tagsValue === "string") {
    return tagsValue
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  return [];
}

function normalizeUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function isPasskeyProxySupported() {
  return Boolean(
    chrome.webAuthenticationProxy?.attach &&
    chrome.webAuthenticationProxy?.detach &&
    chrome.webAuthenticationProxy?.completeCreateRequest &&
    chrome.webAuthenticationProxy?.completeGetRequest &&
    chrome.webAuthenticationProxy?.completeIsUvpaaRequest
  );
}

function isPasskeyProxyEnabled() {
  return Boolean(session.unlocked && session.vault?.settings?.passkeyProxyEnabled && isPasskeyProxySupported());
}

async function syncPasskeyProxyState() {
  if (!isPasskeyProxySupported()) {
    proxyState.attached = false;
    return;
  }

  if (isPasskeyProxyEnabled() && !proxyState.attached) {
    await chrome.webAuthenticationProxy.attach();
    proxyState.attached = true;
    return;
  }

  if (!isPasskeyProxyEnabled() && proxyState.attached) {
    await chrome.webAuthenticationProxy.detach();
    proxyState.attached = false;
  }
}

async function getFallbackPasskeyContext(rpId) {
  try {
    return await withActiveTab(async (tab) => {
      const url = String(tab.url || "");
      const origin = url ? new URL(url).origin : `https://${rpId}`;
      return {
        origin,
        url,
        title: String(tab.title || rpId || "Passkey").slice(0, 140)
      };
    });
  } catch {
    return {
      origin: `https://${rpId}`,
      url: `https://${rpId}`,
      title: `${rpId} Passkey`
    };
  }
}

async function getProxyRequestContext(kind, options) {
  const rpId = getProxyRpId(options);
  const challenge = getProxyChallenge(options);
  const request = await waitForPendingPasskeyRequest(kind, rpId, challenge);
  if (request?.origin) {
    return request;
  }
  const fallback = await getFallbackPasskeyContext(rpId);
  return {
    kind,
    rpId,
    challenge,
    requestDetailsJson: JSON.stringify(options),
    requestedAt: Date.now(),
    ...fallback
  };
}

function listSoftwarePasskeyItems(rpId) {
  ensureUnlocked();
  return session.vault.items.filter((item) => {
    if (item.type !== "passkey") {
      return false;
    }
    const passkey = normalizePasskeyRecord(item.passkey || {});
    return (
      passkey.proxyProvider === "software" &&
      passkey.rpId === rpId &&
      passkey.privateKeyJwk &&
      passkey.publicKeyJwk &&
      passkey.credentialPublicKey
    );
  });
}

async function completeCreateProxyError(requestId, name, message) {
  await chrome.webAuthenticationProxy.completeCreateRequest({
    requestId,
    error: { name, message }
  });
}

async function completeGetProxyError(requestId, name, message) {
  await chrome.webAuthenticationProxy.completeGetRequest({
    requestId,
    error: { name, message }
  });
}

async function handleProxyCreateRequest(details) {
  if (!session.unlocked) {
    await completeCreateProxyError(details.requestId, "NotAllowedError", "Vault is locked.");
    return;
  }

  const options = parseProxyRequestDetails(details.requestDetailsJson);
  const rpId = getProxyRpId(options);
  const challenge = getProxyChallenge(options);

  if (!rpId || !challenge) {
    await completeCreateProxyError(details.requestId, "NotSupportedError", "RP ID or challenge is missing.");
    return;
  }

  const context = await getProxyRequestContext("create", options);
  const approval = await requestPasskeyApproval({
    kind: "create",
    rpId,
    origin: context.origin,
    title: context.title,
    userName: String(options.user?.name || "")
  });
  if (!approval.approved) {
    await completeCreateProxyError(details.requestId, "NotAllowedError", "User denied the passkey creation request.");
    return;
  }

  const excludeIds = Array.isArray(options.excludeCredentials)
    ? options.excludeCredentials.map((entry) => String(entry?.id || "").trim()).filter(Boolean)
    : [];
  const duplicate = listSoftwarePasskeyItems(rpId).find((item) => excludeIds.includes(String(item.passkey?.credentialId || "")));
  if (duplicate) {
    await completeCreateProxyError(details.requestId, "InvalidStateError", "A matching credential already exists.");
    return;
  }

  const record = await createSoftwarePasskeyRecord({
    rpId,
    userName: String(options.user?.name || ""),
    userDisplayName: String(options.user?.displayName || options.user?.name || ""),
    userHandle: String(options.user?.id || ""),
    origin: context.origin,
    title: context.title || buildPasskeyTitle({ rpId, userDisplayName: options.user?.displayName, userName: options.user?.name }),
    authenticatorAttachment: "platform",
    residentKey: String(options.authenticatorSelection?.residentKey || options.residentKey || "preferred"),
    userVerification: String(options.authenticatorSelection?.userVerification || options.userVerification || "preferred"),
    transports: ["internal"]
  });

  const item = upsertItem({
    type: "passkey",
    title: context.title || buildPasskeyTitle(record),
    username: record.userName || "",
    url: context.origin,
    notes: "",
    tags: ["passkey", "webauthn-beta"],
    favorite: false,
    passkey: {
      ...record,
      approvalMethod: approval.method || "",
      createdAt: nowIso(),
      lastSeenAt: nowIso()
    }
  });

  await persistVault();

  const responseJson = await buildCreateResponseJson(options, context.origin, item.passkey);
  await chrome.webAuthenticationProxy.completeCreateRequest({
    requestId: details.requestId,
    responseJson: JSON.stringify(responseJson)
  });
}

async function handleProxyGetRequest(details) {
  if (!session.unlocked) {
    await completeGetProxyError(details.requestId, "NotAllowedError", "Vault is locked.");
    return;
  }

  const options = parseProxyRequestDetails(details.requestDetailsJson);
  const rpId = getProxyRpId(options);
  const challenge = getProxyChallenge(options);

  if (!rpId || !challenge) {
    await completeGetProxyError(details.requestId, "NotSupportedError", "RP ID or challenge is missing.");
    return;
  }

  const context = await getProxyRequestContext("get", options);
  const approval = await requestPasskeyApproval({
    kind: "get",
    rpId,
    origin: context.origin,
    title: context.title
  });
  if (!approval.approved) {
    await completeGetProxyError(details.requestId, "NotAllowedError", "User denied the passkey authentication request.");
    return;
  }

  const allowCredentialIds = getAllowCredentialIds(options);
  const candidates = listSoftwarePasskeyItems(rpId).filter((item) =>
    allowCredentialIds.length === 0 || allowCredentialIds.includes(String(item.passkey?.credentialId || ""))
  );
  const selected = candidates[0];

  if (!selected) {
    await completeGetProxyError(details.requestId, "NotAllowedError", "No matching stored passkey was found.");
    return;
  }

  const { responseJson, nextSignCount } = await buildGetResponseJson(options, context.origin, selected.passkey || {});

  upsertItem({
    ...selected,
    lastUsedAt: nowIso(),
    passkey: {
      ...(selected.passkey || {}),
      event: "get",
      approvalMethod: approval.method || "",
      lastSeenAt: nowIso(),
      lastUsedAt: nowIso(),
      signCount: nextSignCount
    }
  });

  await persistVault();

  await chrome.webAuthenticationProxy.completeGetRequest({
    requestId: details.requestId,
    responseJson: JSON.stringify(responseJson)
  });
}

async function handleProxyIsUvpaaRequest(details) {
  await chrome.webAuthenticationProxy.completeIsUvpaaRequest({
    requestId: details.requestId,
    isUvpaa: Boolean(isPasskeyProxyEnabled())
  });
}

function buildPasskeyPayload(input = {}, existing = null) {
  const current = normalizePasskeyRecord(existing?.passkey || {});
  const next = normalizePasskeyRecord(input, current);
  return {
    ...next,
    createdAt: current.createdAt || next.createdAt || nowIso(),
    lastSeenAt: next.lastSeenAt || nowIso(),
    lastUsedAt: next.lastUsedAt || (next.event === "get" ? nowIso() : current.lastUsedAt || "")
  };
}

function summarizePasskeyMessage(payload = {}) {
  const label = payload.userDisplayName || payload.userName || payload.rpId || "Passkey";
  return `${label} のメタデータをVaultへ保存しました。`;
}

function normalizeItem(input, existing = null) {
  const type = ["login", "card", "identity", "note", "passkey"].includes(input.type) ? input.type : "login";
  const now = nowIso();
  const base = existing || {
    id: crypto.randomUUID(),
    createdAt: now
  };
  const passkey = buildPasskeyPayload(input.passkey || {}, base);

  const normalized = {
    id: base.id,
    type,
    title: String(input.title || (type === "passkey" ? buildPasskeyTitle(passkey) : "")).trim().slice(0, 140),
    username: String(input.username || passkey.userName || "").trim().slice(0, 200),
    password: String(input.password || "").slice(0, 500),
    url: normalizeUrl(input.url || defaultPasskeyUrl(passkey)),
    notes: String(input.notes || "").trim().slice(0, 4000),
    otpSecret: String(input.otpSecret || "").trim().slice(0, 300),
    fullName: String(input.fullName || "").trim().slice(0, 200),
    email: String(input.email || "").trim().slice(0, 200),
    phone: String(input.phone || "").trim().slice(0, 50),
    address: String(input.address || "").trim().slice(0, 400),
    cardHolder: String(input.cardHolder || "").trim().slice(0, 120),
    cardNumber: String(input.cardNumber || "").replace(/\s+/g, "").slice(0, 40),
    cardExpiry: String(input.cardExpiry || "").trim().slice(0, 10),
    cardCvc: String(input.cardCvc || "").trim().slice(0, 10),
    tags: sanitizeTags(input.tags),
    favorite: Boolean(input.favorite),
    passkey,
    passwordUpdatedAt: input.password !== undefined && input.password !== base.password ? now : base.passwordUpdatedAt,
    createdAt: base.createdAt,
    updatedAt: now,
    lastUsedAt: base.lastUsedAt || null
  };

  if (!normalized.title) {
    throw new Error("タイトルは必須です。");
  }

  if (normalized.type === "login" && !normalized.password) {
    throw new Error("ログイン項目にはパスワードが必要です。");
  }

  if (normalized.type === "passkey") {
    if (!normalized.passkey.rpId || !normalized.passkey.credentialId) {
      throw new Error("Passkey項目には RP ID と Credential ID が必要です。");
    }
    normalized.password = "";
    normalized.otpSecret = "";
  }

  return normalized;
}

function isItemForDomain(item, domain) {
  if (!domain || !item.url) {
    return false;
  }

  const itemDomain = extractDomain(item.url);
  return Boolean(itemDomain && (itemDomain === domain || itemDomain.endsWith(`.${domain}`) || domain.endsWith(`.${itemDomain}`)));
}

async function recordAutofillTrust(itemId, tabDomain) {
  if (!itemId || !tabDomain) {
    return;
  }

  const trust = await getAutofillTrust();
  const itemEntry = trust[itemId] || { hosts: {} };
  const hostEntry = itemEntry.hosts?.[tabDomain] || { count: 0, lastFilledAt: null };

  const next = {
    ...trust,
    [itemId]: {
      ...itemEntry,
      hosts: {
        ...(itemEntry.hosts || {}),
        [tabDomain]: {
          count: Number(hostEntry.count || 0) + 1,
          lastFilledAt: nowIso()
        }
      }
    }
  };

  await setAutofillTrust(next);
}

function buildFormLearningKey(domain, mode) {
  return `${normalizeHostForCompare(domain)}::${mode}`;
}

async function getLearnedFormProfile(domain, mode) {
  const key = buildFormLearningKey(domain, mode);
  const profiles = await getFormLearningProfiles();
  return profiles[key] || null;
}

async function updateLearnedFormProfile(domain, learnedProfile) {
  const mode = String(learnedProfile?.mode || "");
  const mapping = learnedProfile?.mapping || {};
  if (!domain || !mode || Object.keys(mapping).length === 0) {
    return;
  }

  const key = buildFormLearningKey(domain, mode);
  const profiles = await getFormLearningProfiles();
  const current = profiles[key] || {
    domain,
    mode,
    mapping: {},
    fillCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  profiles[key] = {
    ...current,
    domain,
    mode,
    mapping: {
      ...(current.mapping || {}),
      ...mapping
    },
    fillCount: Number(current.fillCount || 0) + 1,
    updatedAt: nowIso()
  };

  await setFormLearningProfiles(profiles);
}

async function resetFormLearning({ domain = "", mode = "" } = {}) {
  const profiles = await getFormLearningProfiles();
  const normalizedDomain = normalizeHostForCompare(domain);
  const normalizedMode = String(mode || "").trim();
  const next = {};
  let removed = 0;

  for (const [key, value] of Object.entries(profiles)) {
    const domainMatched = normalizedDomain ? normalizeHostForCompare(value?.domain || "") === normalizedDomain : true;
    const modeMatched = normalizedMode ? String(value?.mode || "") === normalizedMode : true;

    if (domainMatched && modeMatched) {
      removed += 1;
      continue;
    }

    next[key] = value;
  }

  await setFormLearningProfiles(next);
  return { removed };
}

async function getFormLearningSummary() {
  const profiles = await getFormLearningProfiles();
  const rows = Object.values(profiles)
    .map((entry) => ({
      domain: entry.domain || "",
      mode: entry.mode || "",
      fillCount: Number(entry.fillCount || 0),
      updatedAt: entry.updatedAt || null
    }))
    .sort((left, right) => (Date.parse(right.updatedAt || 0) || 0) - (Date.parse(left.updatedAt || 0) || 0));

  return {
    totalProfiles: rows.length,
    rows
  };
}

function sortByUpdated(items) {
  return [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildDedupFingerprint(item) {
  const type = String(item.type || "login").toLowerCase();
  const title = String(item.title || "").trim().toLowerCase();
  const username = String(item.username || "").trim().toLowerCase();
  const url = String(item.url || "").trim().toLowerCase();
  const password = String(item.password || "");

  if (type === "login") {
    return [type, title, username, url, password].join("|");
  }

  if (type === "passkey") {
    return [type, buildPasskeyFingerprint(item.passkey || {})].join("|");
  }

  return [type, title, String(item.notes || "").trim().toLowerCase()].join("|");
}

function summarizeImportItem(item) {
  return {
    title: item.title,
    type: item.type,
    username: item.username || "",
    url: item.url || ""
  };
}

function analyzeImportRequest({ provider, rawText, filename, replaceExisting = false }) {
  const imported = parseExternalItems({
    provider,
    rawText,
    filename
  });

  const existingFingerprints = new Set(
    (replaceExisting ? [] : session.vault.items).map((item) => buildDedupFingerprint(item))
  );
  const seenIncoming = new Set();

  const normalizedItems = [];
  const duplicateItems = [];
  const invalidItems = [];

  for (const rawItem of imported.items) {
    try {
      const normalized = normalizeItem(rawItem);
      const fingerprint = buildDedupFingerprint(normalized);

      if (existingFingerprints.has(fingerprint) || seenIncoming.has(fingerprint)) {
        duplicateItems.push(summarizeImportItem(normalized));
        continue;
      }

      seenIncoming.add(fingerprint);
      normalizedItems.push(normalized);
    } catch (error) {
      invalidItems.push({
        title: String(rawItem?.title || rawItem?.name || "Unknown"),
        reason: error?.message || "形式不正"
      });
    }
  }

  return {
    imported,
    normalizedItems,
    duplicateItems,
    invalidItems,
    preview: {
      sourceProvider: imported.sourceProvider,
      format: imported.format,
      replaceExisting: Boolean(replaceExisting),
      totalParsed: imported.totalParsed,
      wouldAdd: normalizedItems.length,
      wouldSkipDuplicates: duplicateItems.length,
      wouldSkipInvalid: invalidItems.length,
      warnings: imported.warnings || [],
      addSamples: normalizedItems.slice(0, 8).map(summarizeImportItem),
      duplicateSamples: duplicateItems.slice(0, 8),
      invalidSamples: invalidItems.slice(0, 8)
    }
  };
}

async function persistVault() {
  if (!session.unlocked || !session.vault || !session.key || !session.kdf) {
    throw new Error("Vault is locked.");
  }

  session.vault.meta.updatedAt = nowIso();
  const encrypted = await encryptJson(session.vault, session.key);
  await setStoredEnvelope({
    version: 1,
    kdf: session.kdf,
    cipher: {
      algorithm: "AES-GCM",
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext
    },
    updatedAt: nowIso()
  });
  touchSession();
}

function ensureUnlocked() {
  if (!session.unlocked || !session.vault) {
    throw new Error("Vault is locked.");
  }
}

async function unlockVault(masterPassword) {
  const envelope = await getStoredEnvelope();
  if (!envelope) {
    throw new Error("Vault is not initialized.");
  }

  // まずメインパスワードで試す
  let unlocked = null;
  let isDecoy = false;
  try {
    unlocked = await unlockVaultEnvelope(envelope, masterPassword);
  } catch {
    // メインで失敗 → ダミーパスワードで試す
    unlocked = null;
  }

  if (!unlocked) {
    // ダミーVaultの復号を試みる
    if (envelope.decoy?.kdf && envelope.decoy?.cipher) {
      try {
        const decoyEnvelope = {
          version: 1,
          kdf: envelope.decoy.kdf,
          cipher: envelope.decoy.cipher
        };
        unlocked = await unlockVaultEnvelope(decoyEnvelope, masterPassword);
        isDecoy = true;
      } catch {
        throw new Error("パスワードが正しくありません。");
      }
    } else {
      throw new Error("パスワードが正しくありません。");
    }
  }

  session.unlocked = true;
  session.isDecoy = isDecoy;

  if (isDecoy) {
    session.key = unlocked.key;
    session.kdf = envelope.decoy.kdf;
    session.vault = normalizeVault(unlocked.vault);
    session.decoyKey = null;
    session.decoyVault = null;
  } else {
    session.key = unlocked.key;
    session.kdf = envelope.kdf;
    session.vault = normalizeVault(unlocked.vault);
    // ダミーVaultがあればセッションにも保持
    if (unlocked.vault?.decoy?.kdf && unlocked.vault?.decoy?.cipher) {
      session.decoyKey = null;
      session.decoyVault = null;
    }
  }

  touchSession();
  const storedUiLanguage = await getUiLanguagePreference();
  if (storedUiLanguage && session.vault.settings.displayLanguage !== storedUiLanguage) {
    session.vault.settings.displayLanguage = storedUiLanguage;
    await persistVault();
  } else if (!storedUiLanguage) {
    await setUiLanguagePreference(session.vault.settings.displayLanguage || "auto");
  }
  await recordDeadmanHeartbeat();
  await syncPasskeyProxyState();

  return {
    itemCount: session.vault.items.length,
    isDecoy
  };
}

async function initializeVault(masterPassword, decoyPassword = "") {
  const existing = await getStoredEnvelope();
  if (existing) {
    throw new Error("Vault already exists.");
  }

  const vault = createDefaultVault();
  vault.settings.displayLanguage = await getUiLanguagePreference();

  // ダミーパスワードが設定されている場合、ダミーVaultの暗号化データを作成
  if (decoyPassword && decoyPassword.length >= 6) {
    const decoyVault = createDefaultVault();
    decoyVault.items = [];
    const decoyEnvelope = await createVaultEnvelope(decoyVault, decoyPassword);
    vault.decoy = {
      enabled: true,
      kdf: decoyEnvelope.kdf,
      cipher: decoyEnvelope.cipher
    };
  }

  const envelope = await createVaultEnvelope(vault, masterPassword);

  // ダミーVaultのデータをエンベロープの外側にも配置（メイン暗号化の外に置くことで、
  // メインパスワードなしでもダミーパスワードだけで復号できるようにする）
  if (vault.decoy?.enabled) {
    envelope.decoy = {
      kdf: vault.decoy.kdf,
      cipher: vault.decoy.cipher
    };
  }

  await setStoredEnvelope(envelope);
  const unlocked = await unlockVaultEnvelope(envelope, masterPassword);

  session.unlocked = true;
  session.key = unlocked.key;
  session.kdf = envelope.kdf;
  session.vault = vault;
  session.isDecoy = false;
  touchSession();
  await setUiLanguagePreference(vault.settings.displayLanguage || "auto");
  await syncPasskeyProxyState();

  return { created: true };
}

/* ---------- Deadman's Switch helpers ---------- */

async function getDeadmanConfig() {
  const result = await chrome.storage.local.get(DEADMAN_CONFIG_KEY);
  const config = result[DEADMAN_CONFIG_KEY];
  return config && typeof config === "object"
    ? config
    : { enabled: false, inactiveDays: 90, contacts: [], lastHeartbeat: null };
}

async function setDeadmanConfig(config) {
  await chrome.storage.local.set({ [DEADMAN_CONFIG_KEY]: config });
}

async function recordDeadmanHeartbeat() {
  const config = await getDeadmanConfig();
  if (!config.enabled) return;
  config.lastHeartbeat = nowIso();
  await setDeadmanConfig(config);
}

async function checkDeadmanSwitch() {
  const config = await getDeadmanConfig();
  if (!config.enabled || !config.lastHeartbeat || !config.contacts?.length) return;

  const lastBeat = new Date(config.lastHeartbeat).getTime();
  const thresholdMs = (config.inactiveDays || 90) * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - lastBeat;

  if (elapsed >= thresholdMs) {
    // 非アクティブ期間超過 → 通知を発行
    const contactList = config.contacts.map((c) => `${c.name} <${c.email}>`).join(", ");

    // Chrome通知を表示
    try {
      await chrome.notifications.create("deadman-alert", {
        type: "basic",
        iconUrl: "src/lib/icon-128.png",
        title: "PasswordManeger - デジタル遺言",
        message: `${config.inactiveDays}日間操作がありません。連絡先: ${contactList}`,
        priority: 2
      });
    } catch {
      // notifications permission may not be granted
    }

    // mailto: リンクを生成してタブで開く（フォールバック通知手段）
    const emails = config.contacts.map((c) => c.email).join(",");
    const subject = encodeURIComponent("PasswordManeger - デジタル遺言通知");
    const body = encodeURIComponent(
      `このメールはPasswordManeger拡張のデッドマンズ・スイッチにより自動生成されました。\n` +
      `設定された非アクティブ期間（${config.inactiveDays}日）を超過したため、パスワードVaultの引き継ぎが必要な可能性があります。\n\n` +
      `最終アクセス: ${config.lastHeartbeat}`
    );
    try {
      await chrome.tabs.create({ url: `mailto:${emails}?subject=${subject}&body=${body}`, active: false });
    } catch {
      // tab creation may fail
    }
  }
}

/* ---------- Subscription summary ---------- */

function buildSubscriptionSummary(items) {
  const subs = items.filter((item) => item.subscription?.isSubscription);
  let monthlyTotal = 0;
  let yearlyTotal = 0;

  const details = subs.map((item) => {
    const sub = item.subscription;
    let monthlyAmount = sub.amount;
    if (sub.cycle === "yearly") {
      monthlyAmount = sub.amount / 12;
    } else if (sub.cycle === "weekly") {
      monthlyAmount = sub.amount * 4.33;
    }
    monthlyTotal += monthlyAmount;
    yearlyTotal += monthlyAmount * 12;

    return {
      id: item.id,
      title: item.title,
      url: item.url,
      amount: sub.amount,
      currency: sub.currency,
      cycle: sub.cycle,
      monthlyAmount: Math.round(monthlyAmount),
      nextBillingDate: sub.nextBillingDate
    };
  });

  return {
    count: subs.length,
    monthlyTotal: Math.round(monthlyTotal),
    yearlyTotal: Math.round(yearlyTotal),
    currency: details[0]?.currency || "JPY",
    items: details
  };
}

function searchItems(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return items;
  }

  return items.filter((item) => {
    const tags = (item.tags || []).join(" ").toLowerCase();
    const passkey = item.passkey || {};
    return (
      String(item.title || "").toLowerCase().includes(q) ||
      String(item.username || "").toLowerCase().includes(q) ||
      String(item.url || "").toLowerCase().includes(q) ||
      String(item.notes || "").toLowerCase().includes(q) ||
      String(passkey.rpId || "").toLowerCase().includes(q) ||
      String(passkey.userDisplayName || "").toLowerCase().includes(q) ||
      String(passkey.credentialId || "").toLowerCase().includes(q) ||
      tags.includes(q)
    );
  });
}

function upsertItem(input) {
  ensureUnlocked();

  const index = session.vault.items.findIndex((item) => item.id === input.id);
  const existing = index >= 0 ? session.vault.items[index] : null;
  const item = normalizeItem(input, existing);

  if (index >= 0) {
    session.vault.items[index] = item;
  } else {
    session.vault.items.unshift(item);
  }

  return item;
}

function removeItem(itemId) {
  ensureUnlocked();
  const countBefore = session.vault.items.length;
  session.vault.items = session.vault.items.filter((item) => item.id !== itemId);
  return countBefore !== session.vault.items.length;
}

function listItems(filters = {}) {
  ensureUnlocked();

  let items = sortByUpdated(session.vault.items);

  if (filters.type && filters.type !== "all") {
    items = items.filter((item) => item.type === filters.type);
  }

  if (filters.onlyFavorites) {
    items = items.filter((item) => item.favorite);
  }

  if (filters.domain) {
    items = items.filter((item) => isItemForDomain(item, filters.domain));
  }

  items = searchItems(items, filters.search || "");

  return items;
}

async function withActiveTab(callback) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("アクティブタブが見つかりません。");
  }

  return callback(tab);
}

function buildFillPayload(item) {
  if (item.type === "identity") {
    return {
      mode: "identity",
      fields: {
        fullName: item.fullName,
        email: item.email,
        phone: item.phone,
        address: item.address
      }
    };
  }

  if (item.type === "card") {
    return {
      mode: "card",
      fields: {
        cardHolder: item.cardHolder,
        cardNumber: item.cardNumber,
        cardExpiry: item.cardExpiry,
        cardCvc: item.cardCvc
      }
    };
  }

  return {
    mode: "login",
    fields: {
      username: item.username,
      password: item.password
    }
  };
}

async function addPendingCapture(payload = {}) {
  if (!payload.password) {
    return { added: false, capture: null };
  }

  const id = crypto.randomUUID();
  const capture = {
    id,
    title: payload.title || payload.hostname || "New Login",
    username: payload.username || "",
    password: payload.password,
    url: payload.url || "",
    createdAt: nowIso()
  };

  const captures = await getPendingCaptures();
  const duplicate = captures.some(
    (item) => item.url === capture.url && item.username === capture.username && item.password === capture.password
  );

  if (duplicate) {
    return { added: false, capture: null };
  }

  captures.unshift(capture);
  await setPendingCaptures(captures);
  return { added: true, capture };
}

async function notifyUser(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title,
      message
    });
  } catch {
    // notification failure should not block vault updates
  }
}

function approvalActionLabel(kind) {
  return kind === "create" ? "Passkey登録" : "Passkeyログイン";
}

function buildPasskeyApprovalSummary(approval) {
  return `${approvalActionLabel(approval.kind)} / ${approval.rpId}`;
}

function isDesktopPasskeyApprovalEnabled() {
  return Boolean(session.unlocked && session.vault?.settings?.passkeyDesktopApprovalEnabled);
}

async function getDesktopPasskeyApprovalStatusPayload(timeoutMs = 900) {
  const status = await getDesktopPasskeyBridgeStatus({
    baseUrl: DESKTOP_PASSKEY_BRIDGE_BASE_URL,
    timeoutMs
  });

  return {
    enabled: isDesktopPasskeyApprovalEnabled(),
    baseUrl: DESKTOP_PASSKEY_BRIDGE_BASE_URL,
    ...status
  };
}

async function tryDesktopPasskeyApproval(payload = {}) {
  if (!isDesktopPasskeyApprovalEnabled()) {
    return {
      handled: false,
      reason: "disabled"
    };
  }

  const status = await getDesktopPasskeyApprovalStatusPayload(750);
  if (!status.available) {
    return {
      handled: false,
      reason: status.reason || "desktop-unavailable",
      status
    };
  }

  const result = await requestDesktopPasskeyApproval(payload, {
    baseUrl: DESKTOP_PASSKEY_BRIDGE_BASE_URL,
    timeoutMs: 30_000
  });

  if (!result.ok) {
    return {
      handled: false,
      reason: result.reason || "desktop-request-failed",
      status
    };
  }

  return {
    handled: true,
    approved: Boolean(result.approved),
    method: result.method || status.approvalMode || "desktop",
    reason: result.reason || ""
  };
}

function listPendingPasskeyApprovals() {
  return [...pendingPasskeyApprovals.values()]
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      rpId: entry.rpId,
      origin: entry.origin,
      title: entry.title,
      userName: entry.userName,
      requestedAt: entry.requestedAt
    }))
    .sort((left, right) => right.requestedAt - left.requestedAt);
}

async function broadcastPasskeyApprovalUpdate() {
  try {
    await chrome.runtime.sendMessage({
      type: "PM_PASSKEY_APPROVALS_UPDATED",
      approvals: listPendingPasskeyApprovals()
    });
  } catch {
    // no popup listeners is normal
  }
}

async function clearPasskeyApproval(approvalId) {
  const approval = pendingPasskeyApprovals.get(approvalId);
  if (!approval) {
    return;
  }
  if (approval.timer) {
    clearTimeout(approval.timer);
  }
  pendingPasskeyApprovals.delete(approvalId);
  try {
    await chrome.notifications.clear(`${PASSKEY_APPROVAL_NOTIFICATION_PREFIX}${approvalId}`);
  } catch {
    // ignore notification clear failures
  }
  await broadcastPasskeyApprovalUpdate();
}

async function resolvePasskeyApproval(approvalId, approved, reason = "") {
  const approval = pendingPasskeyApprovals.get(approvalId);
  if (!approval) {
    return false;
  }

  await clearPasskeyApproval(approvalId);
  approval.resolve({
    approved: Boolean(approved),
    reason: String(reason || "")
  });
  return true;
}

async function requestPasskeyApproval(payload = {}) {
  const desktopDecision = await tryDesktopPasskeyApproval(payload);
  if (desktopDecision.handled) {
    return {
      approved: Boolean(desktopDecision.approved),
      reason: desktopDecision.reason || "",
      method: desktopDecision.method || "desktop"
    };
  }

  const id = crypto.randomUUID();
  const approval = {
    id,
    kind: String(payload.kind || "").trim().toLowerCase(),
    rpId: String(payload.rpId || "").trim().toLowerCase(),
    origin: String(payload.origin || "").trim(),
    title: String(payload.title || payload.rpId || "Passkey").slice(0, 140),
    userName: String(payload.userName || "").trim().slice(0, 200),
    requestedAt: Date.now(),
    resolve: null,
    timer: null
  };

  const decisionPromise = new Promise((resolve) => {
    approval.resolve = resolve;
  });

  approval.timer = setTimeout(() => {
    resolvePasskeyApproval(id, false, "timeout").catch(() => { });
  }, 60_000);

  pendingPasskeyApprovals.set(id, approval);

  try {
    await chrome.notifications.create(`${PASSKEY_APPROVAL_NOTIFICATION_PREFIX}${id}`, {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: `承認が必要です: ${approvalActionLabel(approval.kind)}`,
      message: `${approval.rpId || approval.origin}\n${approval.userName || "ユーザー名なし"}`,
      buttons: [
        { title: "承認" },
        { title: "拒否" }
      ],
      requireInteraction: true
    });
  } catch {
    // popup-only approval is still acceptable
  }

  await broadcastPasskeyApprovalUpdate();
  const decision = await decisionPromise;
  return {
    ...decision,
    method: "extension-popup"
  };
}

async function saveDetectedPasskey(payload = {}) {
  ensureUnlocked();

  const existing = session.vault.items.find((item) => {
    if (item.type !== "passkey") {
      return false;
    }
    const current = normalizePasskeyRecord(item.passkey || {});
    return current.credentialId === String(payload.credentialId || "").trim() && current.rpId === String(payload.rpId || "").trim().toLowerCase();
  });
  const currentRecord = normalizePasskeyRecord(existing?.passkey || {});
  const record = normalizePasskeyRecord({
    ...payload,
    lastSeenAt: nowIso(),
    lastUsedAt: payload.event === "get" ? nowIso() : ""
  }, currentRecord);

  if (!record.rpId || !record.credentialId) {
    throw new Error("Passkey metadata is incomplete.");
  }

  const item = upsertItem({
    ...(existing || {}),
    type: "passkey",
    title: existing?.title || buildPasskeyTitle(record),
    username: record.userName || existing?.username || "",
    url: defaultPasskeyUrl(record),
    notes: existing?.notes || "",
    tags: existing?.tags || ["passkey"],
    favorite: Boolean(existing?.favorite),
    passkey: {
      ...(existing?.passkey || {}),
      ...record,
      createdAt: existing?.passkey?.createdAt || nowIso()
    }
  });

  if (payload.event === "get") {
    item.lastUsedAt = nowIso();
  }

  await persistVault();

  return {
    item,
    created: !existing
  };
}

async function handleAction(message, sender) {
  switch (message?.action) {
    case "getState": {
      const envelope = await getStoredEnvelope();
      const pendingCaptures = await getPendingCaptures();
      return {
        initialized: Boolean(envelope),
        unlocked: session.unlocked,
        isDecoy: session.isDecoy,
        itemCount: session.vault?.items?.length || 0,
        pendingCaptureCount: pendingCaptures.length,
        pendingPasskeyApprovalCount: pendingPasskeyApprovals.size,
        uiLanguage: await getUiLanguagePreference(),
        passkeyProxySupported: isPasskeyProxySupported(),
        passkeyProxyActive: proxyState.attached,
        desktopPasskeyBridge: await getDesktopPasskeyApprovalStatusPayload()
      };
    }

    case "getUiLanguage": {
      return {
        uiLanguage: await getUiLanguagePreference()
      };
    }

    case "setUiLanguage": {
      const uiLanguage = await setUiLanguagePreference(message.uiLanguage || "auto");
      if (session.unlocked && session.vault?.settings) {
        session.vault.settings.displayLanguage = uiLanguage;
        await persistVault();
      }
      return { uiLanguage };
    }

    case "setupVault": {
      const password = String(message.masterPassword || "");
      if (password.length < 10) {
        throw new Error("マスターパスワードは10文字以上にしてください。");
      }
      const decoyPw = String(message.decoyPassword || "");
      return initializeVault(password, decoyPw);
    }

    case "unlockVault": {
      const password = String(message.masterPassword || "");
      if (!password) {
        throw new Error("マスターパスワードを入力してください。");
      }
      return unlockVault(password);
    }

    case "lockVault": {
      resetSession();
      return { locked: true };
    }

    case "saveItem": {
      const item = upsertItem(message.item || {});
      await persistVault();
      return { item };
    }

    case "deleteItem": {
      ensureUnlocked();
      const deleted = removeItem(message.id);
      if (deleted) {
        await persistVault();
      }
      return { deleted };
    }

    case "listItems": {
      return { items: listItems(message.filters || {}) };
    }

    case "getSuggestionsForActiveTab": {
      ensureUnlocked();
      const tab = await withActiveTab(async (activeTab) => activeTab);
      const domain = extractDomain(tab.url || "");
      const trust = await getAutofillTrust();
      const items = listItems({ domain, type: "login" })
        .slice(0, 5)
        .map((item) => ({
          ...item,
          autofillRisk: buildAutofillRisk(item, tab.url || "", trust)
        }));
      return {
        domain,
        items
      };
    }

    case "checkAutofillRisk": {
      ensureUnlocked();
      const item = session.vault.items.find((entry) => entry.id === message.id);
      if (!item) {
        throw new Error("対象アイテムが見つかりません。");
      }

      const tab = await withActiveTab(async (activeTab) => activeTab);
      const trust = await getAutofillTrust();
      return {
        risk: buildAutofillRisk(item, tab.url || "", trust)
      };
    }

    case "autofillActiveTab": {
      ensureUnlocked();
      const item = session.vault.items.find((entry) => entry.id === message.id);
      if (!item) {
        throw new Error("対象アイテムが見つかりません。");
      }

      const forceHighRisk = Boolean(message.forceHighRisk);
      const trust = await getAutofillTrust();

      const fillResult = await withActiveTab(async (tab) => {
        const tabUrl = tab.url || "";
        const tabDomain = extractDomain(tabUrl);
        const risk = buildAutofillRisk(item, tabUrl, trust);

        if (risk.blockedByPolicy && !forceHighRisk) {
          throw new Error(
            `高リスクのため自動入力を停止しました。理由: ${risk.reasons.join(" / ")}`
          );
        }

        const payload = buildFillPayload(item);
        const learnedProfile = await getLearnedFormProfile(tabDomain, payload.mode);
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "PM_FILL",
          payload: {
            ...payload,
            profile: learnedProfile
          }
        });

        if (!response?.ok || !response?.filled) {
          throw new Error("入力対象フィールドが見つかりませんでした。");
        }

        await updateLearnedFormProfile(tabDomain, response.learnedProfile);
        await recordAutofillTrust(item.id, tabDomain);

        return {
          risk,
          learned: Boolean(response.learnedProfile && Object.keys(response.learnedProfile.mapping || {}).length)
        };
      });

      item.lastUsedAt = nowIso();
      await persistVault();
      return {
        filled: true,
        risk: fillResult.risk,
        learned: fillResult.learned
      };
    }

    case "generatePassword": {
      ensureUnlocked();
      const settings = session.vault.settings.generator;
      const value = generatePassword({
        ...settings,
        ...(message.options || {})
      });
      return { password: value };
    }

    case "generateTotp": {
      ensureUnlocked();
      const secret = String(message.secret || "").trim();
      if (!secret) {
        throw new Error("TOTPシークレットがありません。");
      }
      return generateTotp(secret);
    }

    case "getSecurityReport": {
      ensureUnlocked();
      return {
        report: buildSecurityReport(session.vault.items)
      };
    }

    case "exportBackup": {
      const envelope = await getStoredEnvelope();
      if (!envelope) {
        throw new Error("エクスポート対象のVaultがありません。");
      }
      return { envelope };
    }

    case "importBackup": {
      const envelope = message.envelope;
      if (!envelope?.kdf || !envelope?.cipher) {
        throw new Error("バックアップ形式が不正です。");
      }
      await setStoredEnvelope(envelope);
      resetSession();
      return { imported: true };
    }

    case "changeMasterPassword": {
      ensureUnlocked();
      const oldPassword = String(message.oldPassword || "");
      const newPassword = String(message.newPassword || "");

      if (newPassword.length < 10) {
        throw new Error("新しいマスターパスワードは10文字以上が必要です。");
      }

      const envelope = await getStoredEnvelope();
      if (!envelope) {
        throw new Error("Vaultが見つかりません。");
      }

      await unlockVaultEnvelope(envelope, oldPassword);
      const updatedEnvelope = await createVaultEnvelope(session.vault, newPassword);
      await setStoredEnvelope(updatedEnvelope);
      const unlocked = await unlockVaultEnvelope(updatedEnvelope, newPassword);
      session.key = unlocked.key;
      session.kdf = updatedEnvelope.kdf;
      touchSession();
      await syncPasskeyProxyState();
      return { changed: true };
    }

    case "getSettings": {
      ensureUnlocked();
      return { settings: session.vault.settings };
    }

    case "saveSettings": {
      ensureUnlocked();
      const next = message.settings || {};
      const nextDisplayLanguage = String(next.displayLanguage ?? session.vault.settings.displayLanguage ?? "auto");
      session.vault.settings = {
        ...session.vault.settings,
        ...next,
        displayLanguage: nextDisplayLanguage,
        aliasBaseEmail: String(next.aliasBaseEmail ?? session.vault.settings.aliasBaseEmail ?? "").trim(),
        passkeyProxyEnabled: next.passkeyProxyEnabled ?? session.vault.settings.passkeyProxyEnabled,
        passkeyDesktopApprovalEnabled: next.passkeyDesktopApprovalEnabled ?? session.vault.settings.passkeyDesktopApprovalEnabled,
        generator: {
          ...session.vault.settings.generator,
          ...(next.generator || {})
        }
      };
      await persistVault();
      await setUiLanguagePreference(nextDisplayLanguage);
      await syncPasskeyProxyState();
      return { settings: session.vault.settings };
    }

    case "getPendingPasskeyApprovals": {
      return {
        approvals: listPendingPasskeyApprovals()
      };
    }

    case "getDesktopPasskeyBridgeStatus": {
      return {
        desktopPasskeyBridge: await getDesktopPasskeyApprovalStatusPayload()
      };
    }

    case "decidePasskeyApproval": {
      const approvalId = String(message.approvalId || "");
      const approved = Boolean(message.approved);
      const updated = await resolvePasskeyApproval(approvalId, approved, approved ? "approved" : "rejected");
      return {
        updated
      };
    }

    /* ---------- Email Alias ---------- */

    case "generateEmailAlias": {
      ensureUnlocked();
      const baseEmail = session.vault.settings.aliasBaseEmail;
      if (!baseEmail) {
        throw new Error("設定画面でベースメールアドレスを設定してください。");
      }
      const mode = String(message.mode || "domain");
      const domain = String(message.domain || "");
      const alias = mode === "random"
        ? generateRandomAlias(baseEmail)
        : generateDomainAlias(baseEmail, domain);
      return { alias };
    }

    /* ---------- Subscription Summary ---------- */

    case "getSubscriptionSummary": {
      ensureUnlocked();
      return { summary: buildSubscriptionSummary(session.vault.items) };
    }

    /* ---------- Deadman's Switch ---------- */

    case "getDeadmanConfig": {
      const dmConfig = await getDeadmanConfig();
      return { config: dmConfig };
    }

    case "saveDeadmanConfig": {
      const dmNext = message.config || {};
      const dmConfig = {
        enabled: Boolean(dmNext.enabled),
        inactiveDays: Math.max(1, Math.min(365, Number(dmNext.inactiveDays) || 90)),
        contacts: Array.isArray(dmNext.contacts)
          ? dmNext.contacts
            .filter((c) => c && c.email)
            .map((c) => ({ name: String(c.name || "").slice(0, 100), email: String(c.email || "").slice(0, 200) }))
            .slice(0, 5)
          : [],
        lastHeartbeat: dmNext.lastHeartbeat || nowIso()
      };
      await setDeadmanConfig(dmConfig);
      return { config: dmConfig };
    }

    case "deadmanHeartbeat": {
      await recordDeadmanHeartbeat();
      return { recorded: true };
    }

    case "getPendingCaptures": {
      ensureUnlocked();
      return { captures: await getPendingCaptures() };
    }

    case "savePendingCapture": {
      ensureUnlocked();
      const pendingCaptures = await getPendingCaptures();
      const capture = pendingCaptures.find((item) => item.id === message.id);
      if (!capture) {
        throw new Error("保存候補が見つかりません。");
      }

      const item = upsertItem({
        type: "login",
        title: capture.title,
        username: capture.username,
        password: capture.password,
        url: capture.url,
        notes: "",
        tags: []
      });

      const index = pendingCaptures.findIndex((entry) => entry.id === capture.id);
      pendingCaptures.splice(index, 1);
      await setPendingCaptures(pendingCaptures);

      await persistVault();
      return { item };
    }

    case "discardPendingCapture": {
      ensureUnlocked();
      const pendingCaptures = await getPendingCaptures();
      const index = pendingCaptures.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        pendingCaptures.splice(index, 1);
        await setPendingCaptures(pendingCaptures);
      }
      return { discarded: true };
    }

    case "getFormLearningSummary": {
      ensureUnlocked();
      return await getFormLearningSummary();
    }

    case "resetFormLearning": {
      ensureUnlocked();
      return await resetFormLearning({
        domain: message.domain || "",
        mode: message.mode || ""
      });
    }

    case "previewExternalImport": {
      ensureUnlocked();
      const analyzed = analyzeImportRequest({
        provider: message.provider,
        rawText: message.rawText,
        filename: message.filename,
        replaceExisting: Boolean(message.replaceExisting)
      });
      return { preview: analyzed.preview };
    }

    case "applyExternalImport": {
      ensureUnlocked();
      const analyzed = analyzeImportRequest({
        provider: message.provider,
        rawText: message.rawText,
        filename: message.filename,
        replaceExisting: Boolean(message.replaceExisting)
      });

      if (analyzed.preview.replaceExisting) {
        session.vault.items = [];
      }

      for (const item of analyzed.normalizedItems) {
        session.vault.items.unshift(item);
      }

      await persistVault();

      return {
        added: analyzed.normalizedItems.length,
        skippedDuplicates: analyzed.duplicateItems.length,
        skippedInvalid: analyzed.invalidItems.length,
        sourceProvider: analyzed.imported.sourceProvider,
        format: analyzed.imported.format,
        totalParsed: analyzed.imported.totalParsed,
        warnings: analyzed.imported.warnings
      };
    }

    case "importExternalData": {
      ensureUnlocked();
      const analyzed = analyzeImportRequest({
        provider: message.provider,
        rawText: message.rawText,
        filename: message.filename,
        replaceExisting: Boolean(message.replaceExisting)
      });

      if (analyzed.preview.replaceExisting) {
        session.vault.items = [];
      }

      for (const item of analyzed.normalizedItems) {
        session.vault.items.unshift(item);
      }

      await persistVault();

      return {
        added: analyzed.normalizedItems.length,
        skippedDuplicates: analyzed.duplicateItems.length,
        skippedInvalid: analyzed.invalidItems.length,
        sourceProvider: analyzed.imported.sourceProvider,
        format: analyzed.imported.format,
        totalParsed: analyzed.imported.totalParsed,
        warnings: analyzed.imported.warnings
      };
    }

    case "cloudRegister": {
      const baseUrl = validateCloudBaseUrl(message.baseUrl || "http://localhost:8787", { allowEmpty: false });
      const email = String(message.email || "").trim();
      const password = String(message.password || "");

      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "アカウント登録に失敗しました。");
      }

      await setCloudState({
        baseUrl,
        token: payload.token,
        revision: 0,
        lastSyncAt: null,
        user: payload.user
      });

      return {
        connected: true,
        user: payload.user,
        baseUrl
      };
    }

    case "cloudLogin": {
      const baseUrl = validateCloudBaseUrl(message.baseUrl || "http://localhost:8787", { allowEmpty: false });
      const email = String(message.email || "").trim();
      const password = String(message.password || "");

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "ログインに失敗しました。");
      }

      await setCloudState({
        baseUrl,
        token: payload.token,
        revision: 0,
        lastSyncAt: null,
        user: payload.user
      });

      return {
        connected: true,
        user: payload.user,
        baseUrl
      };
    }

    case "cloudLogout": {
      await clearCloudState();
      return { connected: false };
    }

    case "cloudStatus": {
      const state = await getCloudState();
      if (!state.token || !state.baseUrl) {
        return {
          connected: false,
          baseUrl: state.baseUrl || "",
          revision: state.revision || 0,
          lastSyncAt: state.lastSyncAt
        };
      }

      try {
        const [me, billing] = await Promise.all([
          cloudRequest(state, "/api/auth/me"),
          cloudRequest(state, "/api/billing/status")
        ]);

        const nextState = {
          ...state,
          user: me.user
        };
        await setCloudState(nextState);

        return {
          connected: true,
          baseUrl: state.baseUrl,
          user: me.user,
          billing,
          revision: state.revision,
          lastSyncAt: state.lastSyncAt
        };
      } catch {
        await clearCloudState();
        return {
          connected: false,
          baseUrl: state.baseUrl,
          revision: 0,
          lastSyncAt: null
        };
      }
    }

    case "cloudSyncPush": {
      ensureUnlocked();
      const state = await getCloudState();
      if (!state.token) {
        throw new Error("先にクラウドログインしてください。");
      }

      const envelope = await getStoredEnvelope();
      if (!envelope) {
        throw new Error("同期するVaultがありません。");
      }

      const expectedRevision = Number(state.revision || 0);
      const payload = await cloudRequest(state, "/api/vault/snapshot", {
        method: "PUT",
        body: {
          expectedRevision,
          nextRevision: expectedRevision + 1,
          envelope
        }
      });

      await setCloudState({
        ...state,
        revision: payload.snapshot.revision,
        lastSyncAt: nowIso()
      });

      return {
        pushed: true,
        revision: payload.snapshot.revision
      };
    }

    case "cloudSyncPull": {
      const state = await getCloudState();
      if (!state.token) {
        throw new Error("先にクラウドログインしてください。");
      }

      const payload = await cloudRequest(state, "/api/vault/snapshot", {
        method: "GET"
      });

      if (!payload.snapshot?.envelope) {
        return {
          pulled: false,
          reason: "remote-empty",
          revision: payload.snapshot?.revision || 0
        };
      }

      await setStoredEnvelope(payload.snapshot.envelope);
      resetSession();

      await setCloudState({
        ...state,
        revision: Number(payload.snapshot.revision || 0),
        lastSyncAt: nowIso()
      });

      return {
        pulled: true,
        revision: Number(payload.snapshot.revision || 0)
      };
    }

    default:
      break;
  }

  if (message?.type === "PM_LEARN_PROFILE") {
    if (session.unlocked) {
      const domain = extractDomain(sender?.url || "");
      await updateLearnedFormProfile(domain, message.payload?.learnedProfile);
      return { learned: true };
    }
    return { learned: false, reason: "locked" };
  }

  if (message?.type === "PM_CAPTURE_LOGIN") {
    if (session.unlocked) {
      const result = await addPendingCapture({
        ...message.payload,
        hostname: extractDomain(message.payload?.url || sender?.url || "")
      });
      if (result.added && result.capture) {
        await notifyUser(
          "ログイン情報を検出しました",
          `${result.capture.title} を保存候補に追加しました。拡張を開いて保存できます。`
        );
      }
    }
    return { accepted: true };
  }

  if (message?.type === "PM_PASSKEY_REQUEST") {
    addPendingPasskeyRequest(message.payload || {});
    return { accepted: true };
  }

  if (message?.type === "PM_PASSKEY_EVENT") {
    if (!session.unlocked) {
      await notifyUser("Passkeyを検知しました", "Vaultがロック中のため、Passkeyメタデータは保存されませんでした。");
      return { accepted: false, reason: "locked" };
    }

    const result = await saveDetectedPasskey(message.payload || {});
    if (result.created) {
      await notifyUser("Passkeyを保存しました", summarizePasskeyMessage(result.item.passkey));
    }
    return {
      accepted: true,
      itemId: result.item.id,
      created: result.created
    };
  }

  throw new Error("Unknown action.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleAction(message, sender)
    .then((payload) => sendResponse({ ok: true, ...payload }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Unknown error"
      });
    });

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DEADMAN_CHECK_ALARM) {
    checkDeadmanSwitch().catch(() => { });
    return;
  }

  if (alarm.name !== AUTO_LOCK_ALARM || !session.unlocked) {
    return;
  }

  const timeoutMinutes = Number(session.vault?.settings?.autoLockMinutes) || 10;
  const elapsed = Date.now() - session.lastActivityAt;
  if (elapsed >= timeoutMinutes * 60 * 1000) {
    resetSession();
  }
});

if (isPasskeyProxySupported()) {
  chrome.webAuthenticationProxy.onCreateRequest.addListener((details) => {
    handleProxyCreateRequest(details).catch(async (error) => {
      try {
        await completeCreateProxyError(details.requestId, "UnknownError", error?.message || "Create request failed.");
      } catch {
        // ignore proxy completion errors
      }
    });
  });

  chrome.webAuthenticationProxy.onGetRequest.addListener((details) => {
    handleProxyGetRequest(details).catch(async (error) => {
      try {
        await completeGetProxyError(details.requestId, "UnknownError", error?.message || "Get request failed.");
      } catch {
        // ignore proxy completion errors
      }
    });
  });

  chrome.webAuthenticationProxy.onIsUvpaaRequest.addListener((details) => {
    handleProxyIsUvpaaRequest(details).catch(() => { });
  });

  chrome.webAuthenticationProxy.onRequestCanceled.addListener(() => {
    pendingPasskeyRequests.length = 0;
    [...pendingPasskeyApprovals.keys()].forEach((approvalId) => {
      resolvePasskeyApproval(approvalId, false, "canceled").catch(() => { });
    });
  });
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith(PASSKEY_APPROVAL_NOTIFICATION_PREFIX)) {
    return;
  }

  const approvalId = notificationId.slice(PASSKEY_APPROVAL_NOTIFICATION_PREFIX.length);
  resolvePasskeyApproval(approvalId, buttonIndex === 0, buttonIndex === 0 ? "approved" : "rejected").catch(() => { });
});

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (!byUser || !notificationId.startsWith(PASSKEY_APPROVAL_NOTIFICATION_PREFIX)) {
    return;
  }

  const approvalId = notificationId.slice(PASSKEY_APPROVAL_NOTIFICATION_PREFIX.length);
  resolvePasskeyApproval(approvalId, false, "notification-closed").catch(() => { });
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
  await chrome.alarms.create(DEADMAN_CHECK_ALARM, { periodInMinutes: 1440 }); // 24h
  await syncPasskeyProxyState().catch(() => { });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
  await chrome.alarms.create(DEADMAN_CHECK_ALARM, { periodInMinutes: 1440 });
  await syncPasskeyProxyState().catch(() => { });
});
