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

const STORAGE_KEY = "pm_encrypted_vault";
const AUTO_LOCK_ALARM = "pm-auto-lock";
const CLOUD_AUTH_KEY = "pm_cloud_auth";
const FORM_LEARNING_KEY = "pm_form_learning_profiles";
const AUTOFILL_TRUST_KEY = "pm_autofill_trust";

const session = {
  unlocked: false,
  key: null,
  kdf: null,
  vault: null,
  lastActivityAt: 0
};

const pendingCaptures = [];

function normalizeHostForCompare(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
}

async function getCloudState() {
  const result = await chrome.storage.local.get(CLOUD_AUTH_KEY);
  const payload = result[CLOUD_AUTH_KEY] || {};
  return {
    baseUrl: normalizeBaseUrl(payload.baseUrl || ""),
    token: String(payload.token || ""),
    revision: Number(payload.revision) || 0,
    lastSyncAt: payload.lastSyncAt || null,
    user: payload.user || null
  };
}

async function setCloudState(next) {
  await chrome.storage.local.set({
    [CLOUD_AUTH_KEY]: {
      baseUrl: normalizeBaseUrl(next.baseUrl || ""),
      token: String(next.token || ""),
      revision: Number(next.revision) || 0,
      lastSyncAt: next.lastSyncAt || null,
      user: next.user || null
    }
  });
}

async function clearCloudState() {
  await chrome.storage.local.remove(CLOUD_AUTH_KEY);
}

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

async function cloudRequest(cloudState, endpoint, options = {}) {
  const baseUrl = normalizeBaseUrl(cloudState.baseUrl || "");
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
      generator: {
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
      }
    },
    items: []
  };
}

function normalizeStoredItem(item) {
  const now = nowIso();
  return {
    id: item?.id || crypto.randomUUID(),
    type: ["login", "card", "identity", "note"].includes(item?.type) ? item.type : "login",
    title: String(item?.title || "Untitled").trim().slice(0, 140),
    username: String(item?.username || "").trim().slice(0, 200),
    password: String(item?.password || "").slice(0, 500),
    url: normalizeUrl(item?.url || ""),
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
      generator: {
        ...fallback.settings.generator,
        ...(incoming.settings?.generator || {})
      }
    },
    items
  };
}

function resetSession() {
  session.unlocked = false;
  session.key = null;
  session.kdf = null;
  session.vault = null;
  session.lastActivityAt = 0;
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

function normalizeItem(input, existing = null) {
  const type = ["login", "card", "identity", "note"].includes(input.type) ? input.type : "login";
  const now = nowIso();
  const base = existing || {
    id: crypto.randomUUID(),
    createdAt: now
  };

  const normalized = {
    id: base.id,
    type,
    title: String(input.title || "").trim().slice(0, 140),
    username: String(input.username || "").trim().slice(0, 200),
    password: String(input.password || "").slice(0, 500),
    url: normalizeUrl(input.url),
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

  const unlocked = await unlockVaultEnvelope(envelope, masterPassword);
  session.unlocked = true;
  session.key = unlocked.key;
  session.kdf = envelope.kdf;
  session.vault = normalizeVault(unlocked.vault);
  touchSession();

  return {
    itemCount: session.vault.items.length
  };
}

async function initializeVault(masterPassword) {
  const existing = await getStoredEnvelope();
  if (existing) {
    throw new Error("Vault already exists.");
  }

  const vault = createDefaultVault();
  const envelope = await createVaultEnvelope(vault, masterPassword);
  await setStoredEnvelope(envelope);
  const unlocked = await unlockVaultEnvelope(envelope, masterPassword);

  session.unlocked = true;
  session.key = unlocked.key;
  session.kdf = envelope.kdf;
  session.vault = vault;
  touchSession();

  return { created: true };
}

function searchItems(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return items;
  }

  return items.filter((item) => {
    const tags = (item.tags || []).join(" ").toLowerCase();
    return (
      String(item.title || "").toLowerCase().includes(q) ||
      String(item.username || "").toLowerCase().includes(q) ||
      String(item.url || "").toLowerCase().includes(q) ||
      String(item.notes || "").toLowerCase().includes(q) ||
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

function addPendingCapture(payload = {}) {
  if (!payload.password) {
    return;
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

  const duplicate = pendingCaptures.some(
    (item) => item.url === capture.url && item.username === capture.username && item.password === capture.password
  );

  if (!duplicate) {
    pendingCaptures.unshift(capture);
    if (pendingCaptures.length > 30) {
      pendingCaptures.length = 30;
    }
  }
}

async function handleAction(message, sender) {
  switch (message?.action) {
    case "getState": {
      const envelope = await getStoredEnvelope();
      return {
        initialized: Boolean(envelope),
        unlocked: session.unlocked,
        itemCount: session.vault?.items?.length || 0,
        pendingCaptureCount: pendingCaptures.length
      };
    }

    case "setupVault": {
      const password = String(message.masterPassword || "");
      if (password.length < 10) {
        throw new Error("マスターパスワードは10文字以上にしてください。");
      }
      return initializeVault(password);
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
      return { changed: true };
    }

    case "getSettings": {
      ensureUnlocked();
      return { settings: session.vault.settings };
    }

    case "saveSettings": {
      ensureUnlocked();
      const next = message.settings || {};
      session.vault.settings = {
        ...session.vault.settings,
        ...next,
        generator: {
          ...session.vault.settings.generator,
          ...(next.generator || {})
        }
      };
      await persistVault();
      return { settings: session.vault.settings };
    }

    case "getPendingCaptures": {
      ensureUnlocked();
      return { captures: pendingCaptures };
    }

    case "savePendingCapture": {
      ensureUnlocked();
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

      await persistVault();
      return { item };
    }

    case "discardPendingCapture": {
      ensureUnlocked();
      const index = pendingCaptures.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        pendingCaptures.splice(index, 1);
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
      const baseUrl = normalizeBaseUrl(message.baseUrl || "http://localhost:8787");
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
      const baseUrl = normalizeBaseUrl(message.baseUrl || "http://localhost:8787");
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
      addPendingCapture({
        ...message.payload,
        hostname: extractDomain(message.payload?.url || sender?.url || "")
      });
    }
    return { accepted: true };
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
  if (alarm.name !== AUTO_LOCK_ALARM || !session.unlocked) {
    return;
  }

  const timeoutMinutes = Number(session.vault?.settings?.autoLockMinutes) || 10;
  const elapsed = Date.now() - session.lastActivityAt;
  if (elapsed >= timeoutMinutes * 60 * 1000) {
    resetSession();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
});
