import fs from "node:fs/promises";
import path from "node:path";
import { webcrypto, randomUUID } from "node:crypto";
import { createVaultEnvelope, encryptJson, unlockVaultEnvelope } from "@pm/core/crypto";
import { generatePassword } from "@pm/core/password";
import { generateTotp } from "@pm/core/totp";
import { buildSecurityReport } from "@pm/core/security-audit";
import { parseExternalItems } from "@pm/core/migration";
import { AuditLogger } from "@pm/core/audit-log";
import { safeCloudBaseUrl, validateCloudBaseUrl } from "@pm/core/cloud-url";

if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
  globalThis.crypto = webcrypto;
}

if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(String(value), "binary").toString("base64");
}

if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(String(value), "base64").toString("binary");
}

function nowIso() {
  return new Date().toISOString();
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
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

function sortByUpdated(items) {
  return [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
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

function filterByTags(items, tags, tagMode) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return items;
  }
  const mode = tagMode === "and" ? "and" : "or";
  return items.filter((item) => {
    const itemTags = (item.tags || []).map((t) => t.toLowerCase());
    if (mode === "and") {
      return tags.every((t) => itemTags.includes(t.toLowerCase()));
    }
    return tags.some((t) => itemTags.includes(t.toLowerCase()));
  });
}

function filterByFolder(items, folder) {
  if (!folder) {
    return items;
  }
  const prefix = `folder:${folder}`.toLowerCase();
  return items.filter((item) =>
    (item.tags || []).some((t) => t.toLowerCase() === prefix)
  );
}

function collectAllTags(items) {
  const tagSet = new Set();
  for (const item of items) {
    for (const tag of item.tags || []) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

function buildFolderTree(tags) {
  // folder:path/subpath 形式のタグを階層ツリーに変換
  const tree = {};
  for (const tag of tags) {
    if (!tag.startsWith("folder:")) continue;
    const path = tag.slice("folder:".length);
    const parts = path.split("/").filter(Boolean);
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
  }
  return tree;
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

function analyzeImportRequest(sessionItems, { provider, rawText, filename, replaceExisting = false }) {
  const imported = parseExternalItems({
    provider,
    rawText,
    filename
  });

  const existingFingerprints = new Set(
    (replaceExisting ? [] : sessionItems).map((item) => buildDedupFingerprint(item))
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

export class DesktopVaultService {
  constructor(options) {
    this.envelopeFile = path.join(options.dataDir, "vault-envelope.json");
    this.cloudStateFile = path.join(options.dataDir, "cloud-state.json");
    this.defaultCloudBaseUrl = validateCloudBaseUrl(options.defaultCloudBaseUrl || "http://localhost:8787", { allowEmpty: false });
    this.extensionPath = options.extensionPath;
    this.webBaseUrl = options.webBaseUrl || this.defaultCloudBaseUrl;
    this.cloudToken = "";
    this.auditLog = new AuditLogger(path.join(options.dataDir, "audit-log.jsonl"));

    this.session = {
      unlocked: false,
      key: null,
      kdf: null,
      vault: null,
      lastActivityAt: 0,
      scope: null,
      accessMode: "full",
      expiresAt: null,
      sessionId: ""
    };

    this.autoLockTimer = setInterval(() => {
      this.enforceAutoLock();
    }, 60 * 1000);
    this.autoLockTimer.unref?.();
  }

  dispose() {
    clearInterval(this.autoLockTimer);
  }

  touchSession() {
    this.session.lastActivityAt = Date.now();
  }

  resetSession() {
    this.session.unlocked = false;
    this.session.key = null;
    this.session.kdf = null;
    this.session.vault = null;
    this.session.lastActivityAt = 0;
    this.session.scope = null;
    this.session.accessMode = "full";
    this.session.expiresAt = null;
    this.session.sessionId = "";
  }

  enforceAutoLock() {
    if (!this.session.unlocked || !this.session.vault) {
      return;
    }

    // 短寿命セッション: expiresAtが設定されていれば優先
    if (this.session.expiresAt) {
      if (Date.now() >= this.session.expiresAt) {
        this.auditLog.log("autoLock", "system", { reason: "session_ttl_expired" }, this.session.sessionId).catch(() => { });
        this.resetSession();
        return;
      }
    }

    const timeoutMinutes = Number(this.session.vault?.settings?.autoLockMinutes) || 10;
    const elapsed = Date.now() - this.session.lastActivityAt;
    if (elapsed >= timeoutMinutes * 60 * 1000) {
      this.auditLog.log("autoLock", "system", { reason: "inactivity" }, this.session.sessionId).catch(() => { });
      this.resetSession();
    }
  }

  ensureUnlocked() {
    if (!this.session.unlocked || !this.session.vault) {
      throw new Error("Vault is locked.");
    }

    // TTLチェック（タイマー間隔の隙間を埋める）
    if (this.session.expiresAt && Date.now() >= this.session.expiresAt) {
      this.resetSession();
      throw new Error("Session expired.");
    }
  }

  ensureWriteAccess() {
    this.ensureUnlocked();
    if (this.session.accessMode === "readonly") {
      throw new Error("読み取り専用モードです。書き込み操作は許可されていません。");
    }
  }

  /**
   * スコープが設定されている場合、アイテムがスコープ内かチェックする。
   */
  isItemInScope(item) {
    if (!this.session.scope) {
      return true;
    }

    const { tags, folders } = this.session.scope;
    const itemTags = item.tags || [];

    if (tags && tags.length > 0) {
      if (!itemTags.some((tag) => tags.includes(tag))) {
        return false;
      }
    }

    if (folders && folders.length > 0) {
      if (!itemTags.some((tag) => folders.some((f) => tag.startsWith(`folder:${f}`)))) {
        return false;
      }
    }

    return true;
  }

  ensureScopeAccess(itemId) {
    if (!this.session.scope) {
      return;
    }

    const item = this.session.vault.items.find((i) => i.id === itemId);
    if (!item) {
      return;
    }

    if (!this.isItemInScope(item)) {
      throw new Error("スコープ外のアイテムです。操作は許可されていません。");
    }
  }

  async getStoredEnvelope() {
    return readJsonFile(this.envelopeFile, null);
  }

  async setStoredEnvelope(envelope) {
    await writeJsonFile(this.envelopeFile, envelope);
  }

  async getCloudState() {
    const payload = await readJsonFile(this.cloudStateFile, {});
    const diskToken = String(payload.token || "");

    if (!this.cloudToken && diskToken) {
      this.cloudToken = diskToken;
      try {
        await writeJsonFile(this.cloudStateFile, {
          baseUrl: safeCloudBaseUrl(payload.baseUrl || this.defaultCloudBaseUrl),
          token: "",
          revision: Number(payload.revision) || 0,
          lastSyncAt: payload.lastSyncAt || null,
          user: payload.user || null
        });
      } catch {
        // token scrub failure should not break runtime behavior
      }
    }

    return {
      baseUrl: safeCloudBaseUrl(payload.baseUrl || this.defaultCloudBaseUrl),
      token: this.cloudToken,
      revision: Number(payload.revision) || 0,
      lastSyncAt: payload.lastSyncAt || null,
      user: payload.user || null
    };
  }

  async setCloudState(next) {
    this.cloudToken = String(next.token || "");
    await writeJsonFile(this.cloudStateFile, {
      baseUrl: safeCloudBaseUrl(next.baseUrl || this.defaultCloudBaseUrl),
      token: "",
      revision: Number(next.revision) || 0,
      lastSyncAt: next.lastSyncAt || null,
      user: next.user || null
    });
  }

  async clearCloudState() {
    this.cloudToken = "";
    await this.setCloudState({
      baseUrl: this.defaultCloudBaseUrl,
      token: this.cloudToken,
      revision: 0,
      lastSyncAt: null,
      user: null
    });
  }

  async cloudRequest(cloudState, endpoint, options = {}) {
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

  async initializeVault(masterPassword) {
    const existing = await this.getStoredEnvelope();
    if (existing) {
      throw new Error("Vault already exists.");
    }

    const vault = createDefaultVault();
    const envelope = await createVaultEnvelope(vault, masterPassword);
    await this.setStoredEnvelope(envelope);
    const unlocked = await unlockVaultEnvelope(envelope, masterPassword);

    this.session.unlocked = true;
    this.session.key = unlocked.key;
    this.session.kdf = envelope.kdf;
    this.session.vault = vault;
    this.touchSession();

    return { created: true };
  }

  async unlockVault(masterPassword, options = {}) {
    const envelope = await this.getStoredEnvelope();
    if (!envelope) {
      throw new Error("Vault is not initialized.");
    }

    const unlocked = await unlockVaultEnvelope(envelope, masterPassword);
    this.session.unlocked = true;
    this.session.key = unlocked.key;
    this.session.kdf = envelope.kdf;
    this.session.vault = normalizeVault(unlocked.vault);
    this.session.sessionId = randomUUID();
    this.session.scope = options.scope || null;
    this.session.accessMode = options.accessMode || "full";

    // 短寿命セッション
    if (options.sessionTtlSeconds && Number(options.sessionTtlSeconds) > 0) {
      this.session.expiresAt = Date.now() + Number(options.sessionTtlSeconds) * 1000;
    } else {
      this.session.expiresAt = null;
    }

    this.touchSession();

    return {
      itemCount: this.session.vault.items.length,
      sessionId: this.session.sessionId,
      expiresAt: this.session.expiresAt ? new Date(this.session.expiresAt).toISOString() : null,
      scope: this.session.scope,
      accessMode: this.session.accessMode
    };
  }

  async persistVault() {
    if (!this.session.unlocked || !this.session.vault || !this.session.key || !this.session.kdf) {
      throw new Error("Vault is locked.");
    }

    this.session.vault.meta.updatedAt = nowIso();
    const encrypted = await encryptJson(this.session.vault, this.session.key);
    await this.setStoredEnvelope({
      version: 1,
      kdf: this.session.kdf,
      cipher: {
        algorithm: "AES-GCM",
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext
      },
      updatedAt: nowIso()
    });

    this.touchSession();
  }

  listItems(filters = {}) {
    this.ensureUnlocked();

    let items = sortByUpdated(this.session.vault.items);

    // スコープフィルタ
    if (this.session.scope) {
      items = items.filter((item) => this.isItemInScope(item));
    }

    if (filters.type && filters.type !== "all") {
      items = items.filter((item) => item.type === filters.type);
    }

    if (filters.onlyFavorites) {
      items = items.filter((item) => item.favorite);
    }

    // フォルダフィルタ
    if (filters.folder) {
      items = filterByFolder(items, filters.folder);
    }

    // タグ複数フィルタ（AND / OR）
    if (Array.isArray(filters.tags) && filters.tags.length > 0) {
      items = filterByTags(items, filters.tags, filters.tagMode || "or");
    }

    items = searchItems(items, filters.search || "");

    return items;
  }

  getAllTags() {
    this.ensureUnlocked();
    const allTags = collectAllTags(this.session.vault.items);
    const folderTree = buildFolderTree(allTags);
    const plainTags = allTags.filter((t) => !t.startsWith("folder:"));
    const folderTags = allTags.filter((t) => t.startsWith("folder:"));
    return { allTags, plainTags, folderTags, folderTree };
  }

  upsertItem(input) {
    this.ensureWriteAccess();

    // 既存アイテム更新時はスコープチェック
    if (input.id) {
      this.ensureScopeAccess(input.id);
    }

    const index = this.session.vault.items.findIndex((item) => item.id === input.id);
    const existing = index >= 0 ? this.session.vault.items[index] : null;
    const item = normalizeItem(input, existing);

    // 新規作成時: スコープがある場合はスコープのタグを自動付与
    if (index < 0 && this.session.scope?.tags?.length) {
      const merged = new Set([...(item.tags || []), ...this.session.scope.tags]);
      item.tags = [...merged].slice(0, 20);
    }

    if (index >= 0) {
      this.session.vault.items[index] = item;
    } else {
      this.session.vault.items.unshift(item);
    }

    return item;
  }

  removeItem(itemId) {
    this.ensureWriteAccess();
    this.ensureScopeAccess(itemId);
    const countBefore = this.session.vault.items.length;
    this.session.vault.items = this.session.vault.items.filter((item) => item.id !== itemId);
    return countBefore !== this.session.vault.items.length;
  }

  async handleAction(message) {
    const auditActor = message?.actor || "unknown";

    switch (message?.action) {
      case "getState": {
        const envelope = await this.getStoredEnvelope();
        return {
          initialized: Boolean(envelope),
          unlocked: this.session.unlocked,
          itemCount: this.session.vault?.items?.length || 0,
          supportsAutofill: false,
          extensionPath: this.extensionPath,
          webBaseUrl: this.webBaseUrl,
          scope: this.session.scope,
          accessMode: this.session.accessMode,
          sessionExpiresAt: this.session.expiresAt ? new Date(this.session.expiresAt).toISOString() : null,
          sessionId: this.session.sessionId || ""
        };
      }

      case "setupVault": {
        const password = String(message.masterPassword || "");
        if (password.length < 10) {
          throw new Error("マスターパスワードは10文字以上にしてください。");
        }

        return this.initializeVault(password);
      }

      case "unlockVault": {
        const password = String(message.masterPassword || "");
        if (!password) {
          throw new Error("マスターパスワードを入力してください。");
        }

        const result = await this.unlockVault(password, {
          sessionTtlSeconds: message.sessionTtlSeconds,
          accessMode: message.accessMode
        });
        await this.auditLog.log("unlockVault", auditActor, { sessionId: this.session.sessionId, accessMode: this.session.accessMode }, this.session.sessionId);
        return result;
      }

      case "unlockVaultScoped": {
        const password = String(message.masterPassword || "");
        if (!password) {
          throw new Error("マスターパスワードを入力してください。");
        }

        const scope = message.scope || {};
        if (!scope.tags?.length && !scope.folders?.length) {
          throw new Error("スコープ（tags または folders）を指定してください。");
        }

        const result = await this.unlockVault(password, {
          scope,
          sessionTtlSeconds: message.sessionTtlSeconds,
          accessMode: message.accessMode || "full"
        });
        await this.auditLog.log("unlockVaultScoped", auditActor, { sessionId: this.session.sessionId, scope, accessMode: this.session.accessMode }, this.session.sessionId);
        return result;
      }

      case "setAccessMode": {
        this.ensureUnlocked();
        const mode = message.mode;
        if (mode !== "full" && mode !== "readonly") {
          throw new Error("accessMode は 'full' または 'readonly' である必要があります。");
        }

        this.session.accessMode = mode;
        await this.auditLog.log("setAccessMode", auditActor, { mode }, this.session.sessionId);
        return { accessMode: mode };
      }

      case "getAuditLog": {
        const entries = await this.auditLog.query({
          action: message.filterAction,
          actor: message.filterActor,
          since: message.since,
          limit: message.limit
        });
        return { entries, count: entries.length };
      }

      case "agentSaveCredential": {
        this.ensureWriteAccess();
        const agentName = String(message.agentName || "unknown-agent").trim().slice(0, 60);
        const url = String(message.url || "").trim();
        const username = String(message.username || "").trim();
        const password = String(message.password || "");

        if (!url && !username) {
          throw new Error("url または username を指定してください。");
        }
        if (!password) {
          throw new Error("password を指定してください。");
        }

        const agentTag = `agent:${agentName}`;
        const inputTags = sanitizeTags(message.tags || []);
        const tags = [agentTag, ...inputTags.filter((t) => t !== agentTag)];

        const item = this.upsertItem({
          type: "login",
          title: message.title || url || username,
          username,
          password,
          url,
          notes: message.notes || `Saved by agent: ${agentName}`,
          tags
        });
        await this.persistVault();
        await this.auditLog.log("agentSaveCredential", auditActor, { itemId: item.id, agentName, url }, this.session.sessionId);
        return { item };
      }

      case "lockVault": {
        this.resetSession();
        return { locked: true };
      }

      case "saveItem": {
        const item = this.upsertItem(message.item || {});
        await this.persistVault();
        await this.auditLog.log("saveItem", auditActor, { itemId: item.id, title: item.title }, this.session.sessionId);
        return { item };
      }

      case "deleteItem": {
        const deleted = this.removeItem(message.id);
        if (deleted) {
          await this.persistVault();
          await this.auditLog.log("deleteItem", auditActor, { itemId: message.id }, this.session.sessionId);
        }
        return { deleted };
      }

      case "listItems": {
        return { items: this.listItems(message.filters || {}) };
      }

      case "getTags": {
        return this.getAllTags();
      }

      case "generatePassword": {
        this.ensureUnlocked();
        const settings = this.session.vault.settings.generator;
        const value = generatePassword({
          ...settings,
          ...(message.options || {})
        });
        return { password: value };
      }

      case "generateTotp": {
        this.ensureUnlocked();
        const secret = String(message.secret || "").trim();
        if (!secret) {
          throw new Error("TOTPシークレットがありません。");
        }

        return generateTotp(secret);
      }

      case "getSecurityReport": {
        this.ensureUnlocked();
        return {
          report: buildSecurityReport(this.session.vault.items)
        };
      }

      case "exportBackup": {
        const envelope = await this.getStoredEnvelope();
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

        await this.setStoredEnvelope(envelope);
        this.resetSession();
        return { imported: true };
      }

      case "changeMasterPassword": {
        this.ensureWriteAccess();
        this.ensureUnlocked();
        const oldPassword = String(message.oldPassword || "");
        const newPassword = String(message.newPassword || "");

        if (newPassword.length < 10) {
          throw new Error("新しいマスターパスワードは10文字以上が必要です。");
        }

        const envelope = await this.getStoredEnvelope();
        if (!envelope) {
          throw new Error("Vaultが見つかりません。");
        }

        await unlockVaultEnvelope(envelope, oldPassword);
        const updatedEnvelope = await createVaultEnvelope(this.session.vault, newPassword);
        await this.setStoredEnvelope(updatedEnvelope);
        const unlocked = await unlockVaultEnvelope(updatedEnvelope, newPassword);
        this.session.key = unlocked.key;
        this.session.kdf = updatedEnvelope.kdf;
        this.touchSession();
        return { changed: true };
      }

      case "getSettings": {
        this.ensureUnlocked();
        return { settings: this.session.vault.settings };
      }

      case "saveSettings": {
        this.ensureWriteAccess();
        const next = message.settings || {};
        this.session.vault.settings = {
          ...this.session.vault.settings,
          ...next,
          generator: {
            ...this.session.vault.settings.generator,
            ...(next.generator || {})
          }
        };
        await this.persistVault();
        return { settings: this.session.vault.settings };
      }

      case "previewExternalImport": {
        this.ensureUnlocked();
        const analyzed = analyzeImportRequest(this.session.vault.items, {
          provider: message.provider,
          rawText: message.rawText,
          filename: message.filename,
          replaceExisting: Boolean(message.replaceExisting)
        });
        return { preview: analyzed.preview };
      }

      case "applyExternalImport": {
        this.ensureWriteAccess();
        this.ensureUnlocked();
        const analyzed = analyzeImportRequest(this.session.vault.items, {
          provider: message.provider,
          rawText: message.rawText,
          filename: message.filename,
          replaceExisting: Boolean(message.replaceExisting)
        });

        if (analyzed.preview.replaceExisting) {
          this.session.vault.items = [];
        }

        for (const item of analyzed.normalizedItems) {
          this.session.vault.items.unshift(item);
        }

        await this.persistVault();

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
        this.ensureUnlocked();
        const analyzed = analyzeImportRequest(this.session.vault.items, {
          provider: message.provider,
          rawText: message.rawText,
          filename: message.filename,
          replaceExisting: Boolean(message.replaceExisting)
        });

        if (analyzed.preview.replaceExisting) {
          this.session.vault.items = [];
        }

        for (const item of analyzed.normalizedItems) {
          this.session.vault.items.unshift(item);
        }

        await this.persistVault();

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
        const baseUrl = validateCloudBaseUrl(message.baseUrl || this.defaultCloudBaseUrl, { allowEmpty: false });
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

        await this.setCloudState({
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
        const baseUrl = validateCloudBaseUrl(message.baseUrl || this.defaultCloudBaseUrl, { allowEmpty: false });
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

        await this.setCloudState({
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
        await this.clearCloudState();
        return { connected: false };
      }

      case "cloudStatus": {
        const state = await this.getCloudState();
        if (!state.token || !state.baseUrl) {
          return {
            connected: false,
            baseUrl: state.baseUrl || this.defaultCloudBaseUrl,
            revision: state.revision || 0,
            lastSyncAt: state.lastSyncAt
          };
        }

        try {
          const [me, billing] = await Promise.all([
            this.cloudRequest(state, "/api/auth/me"),
            this.cloudRequest(state, "/api/billing/status")
          ]);

          const nextState = {
            ...state,
            user: me.user
          };
          await this.setCloudState(nextState);

          return {
            connected: true,
            baseUrl: state.baseUrl,
            user: me.user,
            billing,
            revision: state.revision,
            lastSyncAt: state.lastSyncAt
          };
        } catch {
          await this.clearCloudState();
          return {
            connected: false,
            baseUrl: state.baseUrl,
            revision: 0,
            lastSyncAt: null
          };
        }
      }

      case "cloudEntitlementsStatus": {
        const state = await this.getCloudState();
        if (!state.token) {
          throw new Error("先にクラウドログインしてください。");
        }

        const payload = await this.cloudRequest(state, "/api/entitlements/status", {
          method: "GET"
        });

        return {
          features: payload.features || {}
        };
      }

      case "cloudCheckoutSession": {
        const state = await this.getCloudState();
        if (!state.token) {
          throw new Error("先にクラウドログインしてください。");
        }

        const payload = await this.cloudRequest(state, "/api/billing/checkout-session", {
          method: "POST"
        });

        return {
          url: payload.url || ""
        };
      }

      case "cloudPortalSession": {
        const state = await this.getCloudState();
        if (!state.token) {
          throw new Error("先にクラウドログインしてください。");
        }

        const payload = await this.cloudRequest(state, "/api/billing/portal-session", {
          method: "POST"
        });

        return {
          url: payload.url || ""
        };
      }

      case "cloudSyncPush": {
        this.ensureUnlocked();
        const state = await this.getCloudState();
        if (!state.token) {
          throw new Error("先にクラウドログインしてください。");
        }

        const envelope = await this.getStoredEnvelope();
        if (!envelope) {
          throw new Error("同期するVaultがありません。");
        }

        const expectedRevision = Number(state.revision || 0);
        const payload = await this.cloudRequest(state, "/api/vault/snapshot", {
          method: "PUT",
          body: {
            expectedRevision,
            nextRevision: expectedRevision + 1,
            envelope
          }
        });

        await this.setCloudState({
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
        const state = await this.getCloudState();
        if (!state.token) {
          throw new Error("先にクラウドログインしてください。");
        }

        const payload = await this.cloudRequest(state, "/api/vault/snapshot", {
          method: "GET"
        });

        if (!payload.snapshot?.envelope) {
          return {
            pulled: false,
            reason: "remote-empty",
            revision: payload.snapshot?.revision || 0
          };
        }

        await this.setStoredEnvelope(payload.snapshot.envelope);
        this.resetSession();

        await this.setCloudState({
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
        throw new Error("Unknown action.");
    }
  }
}
