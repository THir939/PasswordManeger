import {
  createVaultEnvelope,
  encryptJson,
  unlockVaultEnvelope
} from "./lib/crypto.js";
import { generatePassword } from "./lib/password.js";
import { generateTotp } from "./lib/totp.js";
import { buildSecurityReport } from "./lib/security-audit.js";

const STORAGE_KEY = "pm_encrypted_vault";
const AUTO_LOCK_ALARM = "pm-auto-lock";

const session = {
  unlocked: false,
  key: null,
  kdf: null,
  vault: null,
  lastActivityAt: 0
};

const pendingCaptures = [];

function nowIso() {
  return new Date().toISOString();
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

function extractDomain(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isItemForDomain(item, domain) {
  if (!domain || !item.url) {
    return false;
  }

  const itemDomain = extractDomain(item.url);
  return Boolean(itemDomain && (itemDomain === domain || itemDomain.endsWith(`.${domain}`) || domain.endsWith(`.${itemDomain}`)));
}

function sortByUpdated(items) {
  return [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
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
  session.vault = unlocked.vault;
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
    const tags = item.tags.join(" ").toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q) ||
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
      const items = listItems({ domain, type: "login" }).slice(0, 5);
      return {
        domain,
        items
      };
    }

    case "autofillActiveTab": {
      ensureUnlocked();
      const item = session.vault.items.find((entry) => entry.id === message.id);
      if (!item) {
        throw new Error("対象アイテムが見つかりません。");
      }

      await withActiveTab(async (tab) => {
        await chrome.tabs.sendMessage(tab.id, {
          type: "PM_FILL",
          payload: buildFillPayload(item)
        });
      });

      item.lastUsedAt = nowIso();
      await persistVault();
      return { filled: true };
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

    default:
      break;
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
