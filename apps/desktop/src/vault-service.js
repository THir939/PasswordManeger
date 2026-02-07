import fs from "node:fs/promises";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { createVaultEnvelope, encryptJson, unlockVaultEnvelope } from "./shared/crypto.js";
import { generatePassword } from "./shared/password.js";
import { generateTotp } from "./shared/totp.js";
import { buildSecurityReport } from "./shared/security-audit.js";
import { parseExternalItems } from "./shared/migration.js";

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

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
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

export class DesktopVaultService {
  constructor(options) {
    this.envelopeFile = path.join(options.dataDir, "vault-envelope.json");
    this.cloudStateFile = path.join(options.dataDir, "cloud-state.json");
    this.defaultCloudBaseUrl = normalizeBaseUrl(options.defaultCloudBaseUrl || "http://localhost:8787");
    this.extensionPath = options.extensionPath;
    this.webBaseUrl = options.webBaseUrl || this.defaultCloudBaseUrl;

    this.session = {
      unlocked: false,
      key: null,
      kdf: null,
      vault: null,
      lastActivityAt: 0
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
  }

  enforceAutoLock() {
    if (!this.session.unlocked || !this.session.vault) {
      return;
    }

    const timeoutMinutes = Number(this.session.vault?.settings?.autoLockMinutes) || 10;
    const elapsed = Date.now() - this.session.lastActivityAt;
    if (elapsed >= timeoutMinutes * 60 * 1000) {
      this.resetSession();
    }
  }

  ensureUnlocked() {
    if (!this.session.unlocked || !this.session.vault) {
      throw new Error("Vault is locked.");
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
    return {
      baseUrl: normalizeBaseUrl(payload.baseUrl || this.defaultCloudBaseUrl),
      token: String(payload.token || ""),
      revision: Number(payload.revision) || 0,
      lastSyncAt: payload.lastSyncAt || null,
      user: payload.user || null
    };
  }

  async setCloudState(next) {
    await writeJsonFile(this.cloudStateFile, {
      baseUrl: normalizeBaseUrl(next.baseUrl || this.defaultCloudBaseUrl),
      token: String(next.token || ""),
      revision: Number(next.revision) || 0,
      lastSyncAt: next.lastSyncAt || null,
      user: next.user || null
    });
  }

  async clearCloudState() {
    await this.setCloudState({
      baseUrl: this.defaultCloudBaseUrl,
      token: "",
      revision: 0,
      lastSyncAt: null,
      user: null
    });
  }

  async cloudRequest(cloudState, endpoint, options = {}) {
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

  async unlockVault(masterPassword) {
    const envelope = await this.getStoredEnvelope();
    if (!envelope) {
      throw new Error("Vault is not initialized.");
    }

    const unlocked = await unlockVaultEnvelope(envelope, masterPassword);
    this.session.unlocked = true;
    this.session.key = unlocked.key;
    this.session.kdf = envelope.kdf;
    this.session.vault = normalizeVault(unlocked.vault);
    this.touchSession();

    return {
      itemCount: this.session.vault.items.length
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

    if (filters.type && filters.type !== "all") {
      items = items.filter((item) => item.type === filters.type);
    }

    if (filters.onlyFavorites) {
      items = items.filter((item) => item.favorite);
    }

    items = searchItems(items, filters.search || "");

    return items;
  }

  upsertItem(input) {
    this.ensureUnlocked();

    const index = this.session.vault.items.findIndex((item) => item.id === input.id);
    const existing = index >= 0 ? this.session.vault.items[index] : null;
    const item = normalizeItem(input, existing);

    if (index >= 0) {
      this.session.vault.items[index] = item;
    } else {
      this.session.vault.items.unshift(item);
    }

    return item;
  }

  removeItem(itemId) {
    this.ensureUnlocked();
    const countBefore = this.session.vault.items.length;
    this.session.vault.items = this.session.vault.items.filter((item) => item.id !== itemId);
    return countBefore !== this.session.vault.items.length;
  }

  async handleAction(message) {
    switch (message?.action) {
      case "getState": {
        const envelope = await this.getStoredEnvelope();
        return {
          initialized: Boolean(envelope),
          unlocked: this.session.unlocked,
          itemCount: this.session.vault?.items?.length || 0,
          supportsAutofill: false,
          extensionPath: this.extensionPath,
          webBaseUrl: this.webBaseUrl
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

        return this.unlockVault(password);
      }

      case "lockVault": {
        this.resetSession();
        return { locked: true };
      }

      case "saveItem": {
        const item = this.upsertItem(message.item || {});
        await this.persistVault();
        return { item };
      }

      case "deleteItem": {
        this.ensureUnlocked();
        const deleted = this.removeItem(message.id);
        if (deleted) {
          await this.persistVault();
        }
        return { deleted };
      }

      case "listItems": {
        return { items: this.listItems(message.filters || {}) };
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
        this.ensureUnlocked();
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

      case "importExternalData": {
        this.ensureUnlocked();
        const imported = parseExternalItems({
          provider: message.provider,
          rawText: message.rawText,
          filename: message.filename
        });

        const replaceExisting = Boolean(message.replaceExisting);
        if (replaceExisting) {
          this.session.vault.items = [];
        }

        const existingFingerprints = new Set(this.session.vault.items.map((item) => buildDedupFingerprint(item)));
        let added = 0;
        let skippedDuplicates = 0;
        let skippedInvalid = 0;

        for (const rawItem of imported.items) {
          try {
            const normalized = normalizeItem(rawItem);
            const fingerprint = buildDedupFingerprint(normalized);

            if (existingFingerprints.has(fingerprint)) {
              skippedDuplicates += 1;
              continue;
            }

            this.session.vault.items.unshift(normalized);
            existingFingerprints.add(fingerprint);
            added += 1;
          } catch {
            skippedInvalid += 1;
          }
        }

        await this.persistVault();

        return {
          added,
          skippedDuplicates,
          skippedInvalid,
          sourceProvider: imported.sourceProvider,
          format: imported.format,
          totalParsed: imported.totalParsed,
          warnings: imported.warnings
        };
      }

      case "cloudRegister": {
        const baseUrl = normalizeBaseUrl(message.baseUrl || this.defaultCloudBaseUrl);
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
        const baseUrl = normalizeBaseUrl(message.baseUrl || this.defaultCloudBaseUrl);
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
