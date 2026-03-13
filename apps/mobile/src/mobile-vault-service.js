/**
 * Mobile VaultService
 * @pm/core を使った、ファイルシステムベースの Vault サービス。
 * DesktopVaultService と同等のロジックをモバイル向けに実装。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { webcrypto, randomUUID } from "node:crypto";
import {
    createVaultEnvelope,
    encryptJson,
    unlockVaultEnvelope
} from "@pm/core/crypto";
import { generatePassword, passwordStrength } from "@pm/core/password";
import { generateTotp } from "@pm/core/totp";
import { buildSecurityReport } from "@pm/core/security-audit";
import { safeCloudBaseUrl, validateCloudBaseUrl } from "@pm/core/cloud-url";
import { normalizePasskeyRecord, defaultPasskeyUrl, buildPasskeyTitle } from "@pm/core/passkey";

// Node.js環境でWeb Crypto APIを利用可能にする
if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
    globalThis.btoa = (v) => Buffer.from(String(v), "binary").toString("base64");
}
if (!globalThis.atob) {
    globalThis.atob = (v) => Buffer.from(String(v), "base64").toString("binary");
}

function nowIso() {
    return new Date().toISOString();
}

async function readJsonFile(filePath, fallback) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
        return structuredClone(fallback);
    }
}

async function writeJsonFile(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sanitizeTags(tags) {
    if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean).slice(0, 20);
    if (typeof tags === "string") return tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 20);
    return [];
}

function normalizeUrl(url) {
    const v = String(url || "").trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function createDefaultVault() {
    const now = nowIso();
    return {
        version: 1,
        meta: { createdAt: now, updatedAt: now },
        settings: {
            autoLockMinutes: 10,
            clipboardClearSeconds: 20,
            passkeyProxyEnabled: false,
            passkeyDesktopApprovalEnabled: true,
            generator: { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }
        },
        items: []
    };
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

function normalizeItem(input, existing = null) {
    const type = ["login", "card", "identity", "note", "passkey"].includes(input.type) ? input.type : "login";
    const now = nowIso();
    const base = existing || { id: randomUUID(), createdAt: now };
    const passkey = buildPasskeyPayload(input.passkey || {}, base);

    const item = {
        id: base.id, type,
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
        passwordUpdatedAt: input.password !== undefined && input.password !== base.password ? now : (base.passwordUpdatedAt || null),
        createdAt: base.createdAt, updatedAt: now,
        lastUsedAt: base.lastUsedAt || null
    };

    if (!item.title) throw new Error("タイトルは必須です。");
    if (item.type === "login" && !item.password) throw new Error("ログイン項目にはパスワードが必要です。");
    if (item.type === "passkey" && (!item.passkey.rpId || !item.passkey.credentialId)) {
        throw new Error("Passkey項目には RP ID と Credential ID が必要です。");
    }
    return item;
}

function normalizeVault(vault) {
    const fb = createDefaultVault();
    const inc = vault && typeof vault === "object" ? vault : {};
    return {
        version: 1,
        meta: { createdAt: inc.meta?.createdAt || fb.meta.createdAt, updatedAt: inc.meta?.updatedAt || fb.meta.updatedAt },
        settings: {
            autoLockMinutes: Number(inc.settings?.autoLockMinutes) || fb.settings.autoLockMinutes,
            clipboardClearSeconds: Number(inc.settings?.clipboardClearSeconds) || fb.settings.clipboardClearSeconds,
            passkeyProxyEnabled: Boolean(inc.settings?.passkeyProxyEnabled),
            passkeyDesktopApprovalEnabled: inc.settings?.passkeyDesktopApprovalEnabled ?? fb.settings.passkeyDesktopApprovalEnabled,
            generator: { ...fb.settings.generator, ...(inc.settings?.generator || {}) }
        },
        items: Array.isArray(inc.items) ? inc.items.map((item) => normalizeItem(item, item)) : []
    };
}

export class MobileVaultService {
    constructor(dataDir) {
        this.envelopeFile = path.join(dataDir, "vault-envelope.json");
        this.cloudStateFile = path.join(dataDir, "cloud-state.json");
        this.defaultCloudBaseUrl = "http://localhost:8787";

        this.session = {
            unlocked: false, key: null, kdf: null, vault: null,
            lastActivityAt: 0, sessionId: ""
        };

        this.autoLockTimer = setInterval(() => this._enforceAutoLock(), 60_000);
        this.autoLockTimer.unref?.();
    }

    dispose() { clearInterval(this.autoLockTimer); }

    _touch() { this.session.lastActivityAt = Date.now(); }

    _reset() {
        Object.assign(this.session, {
            unlocked: false, key: null, kdf: null, vault: null,
            lastActivityAt: 0, sessionId: ""
        });
    }

    _enforceAutoLock() {
        if (!this.session.unlocked || !this.session.vault) return;
        const timeout = Number(this.session.vault?.settings?.autoLockMinutes) || 10;
        if (Date.now() - this.session.lastActivityAt >= timeout * 60_000) this._reset();
    }

    _ensureUnlocked() {
        if (!this.session.unlocked || !this.session.vault) throw new Error("Vault is locked.");
    }

    _ensureWriteAccess() { this._ensureUnlocked(); }

    async _getEnvelope() { return readJsonFile(this.envelopeFile, null); }
    async _setEnvelope(e) { await writeJsonFile(this.envelopeFile, e); }

    async _persistVault() {
        if (!this.session.unlocked || !this.session.vault || !this.session.key || !this.session.kdf) {
            throw new Error("Vault is locked.");
        }
        this.session.vault.meta.updatedAt = nowIso();
        const encrypted = await encryptJson(this.session.vault, this.session.key);
        await this._setEnvelope({
            version: 1, kdf: this.session.kdf,
            cipher: { algorithm: "AES-GCM", iv: encrypted.iv, ciphertext: encrypted.ciphertext },
            updatedAt: nowIso()
        });
        this._touch();
    }

    async handleAction(msg) {
        switch (msg?.action) {
            case "getState": {
                const envelope = await this._getEnvelope();
                return {
                    initialized: Boolean(envelope),
                    unlocked: this.session.unlocked,
                    itemCount: this.session.vault?.items?.length || 0
                };
            }

            case "setupVault": {
                const pw = String(msg.masterPassword || "");
                if (pw.length < 10) throw new Error("マスターパスワードは10文字以上にしてください。");
                const existing = await this._getEnvelope();
                if (existing) throw new Error("Vault already exists.");
                const vault = createDefaultVault();
                const envelope = await createVaultEnvelope(vault, pw);
                await this._setEnvelope(envelope);
                const unlocked = await unlockVaultEnvelope(envelope, pw);
                Object.assign(this.session, { unlocked: true, key: unlocked.key, kdf: envelope.kdf, vault, sessionId: randomUUID() });
                this._touch();
                return { created: true };
            }

            case "unlockVault": {
                const pw = String(msg.masterPassword || "");
                if (!pw) throw new Error("マスターパスワードを入力してください。");
                const envelope = await this._getEnvelope();
                if (!envelope) throw new Error("Vault is not initialized.");
                const unlocked = await unlockVaultEnvelope(envelope, pw);
                Object.assign(this.session, {
                    unlocked: true, key: unlocked.key, kdf: envelope.kdf,
                    vault: normalizeVault(unlocked.vault), sessionId: randomUUID()
                });
                this._touch();
                return { itemCount: this.session.vault.items.length, sessionId: this.session.sessionId };
            }

            case "lockVault": {
                this._reset();
                return { locked: true };
            }

            case "listItems": {
                this._ensureUnlocked();
                let items = [...this.session.vault.items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
                const f = msg.filters || {};
                if (f.type && f.type !== "all") items = items.filter(i => i.type === f.type);
                if (f.onlyFavorites) items = items.filter(i => i.favorite);
                if (f.search) {
                    const q = f.search.toLowerCase();
                    items = items.filter(i =>
                        (i.title || "").toLowerCase().includes(q) ||
                        (i.username || "").toLowerCase().includes(q) ||
                        (i.url || "").toLowerCase().includes(q) ||
                        (i.notes || "").toLowerCase().includes(q) ||
                        (i.tags || []).join(" ").toLowerCase().includes(q)
                    );
                }
                this._touch();
                return { items };
            }

            case "getItem": {
                this._ensureUnlocked();
                const item = this.session.vault.items.find(i => i.id === msg.id);
                if (!item) throw new Error("アイテムが見つかりません。");
                this._touch();
                return { item };
            }

            case "saveItem": {
                this._ensureWriteAccess();
                const input = msg.item || {};
                const idx = this.session.vault.items.findIndex(i => i.id === input.id);
                const existing = idx >= 0 ? this.session.vault.items[idx] : null;
                const item = normalizeItem(input, existing);
                if (idx >= 0) this.session.vault.items[idx] = item;
                else this.session.vault.items.unshift(item);
                await this._persistVault();
                return { item };
            }

            case "deleteItem": {
                this._ensureWriteAccess();
                const before = this.session.vault.items.length;
                this.session.vault.items = this.session.vault.items.filter(i => i.id !== msg.id);
                if (before !== this.session.vault.items.length) await this._persistVault();
                return { deleted: before !== this.session.vault.items.length };
            }

            case "generatePassword": {
                this._ensureUnlocked();
                const settings = this.session.vault.settings.generator;
                return { password: generatePassword({ ...settings, ...(msg.options || {}) }) };
            }

            case "generateTotp": {
                this._ensureUnlocked();
                const secret = String(msg.secret || "").trim();
                if (!secret) throw new Error("TOTPシークレットがありません。");
                return generateTotp(secret);
            }

            case "getSecurityReport": {
                this._ensureUnlocked();
                return { report: buildSecurityReport(this.session.vault.items) };
            }

            case "passwordStrength": {
                return passwordStrength(String(msg.password || ""));
            }

            case "getSettings": {
                this._ensureUnlocked();
                return { settings: this.session.vault.settings };
            }

            case "saveSettings": {
                this._ensureWriteAccess();
                const next = msg.settings || {};
                this.session.vault.settings = {
                    ...this.session.vault.settings, ...next,
                    generator: { ...this.session.vault.settings.generator, ...(next.generator || {}) }
                };
                await this._persistVault();
                return { settings: this.session.vault.settings };
            }

            case "changeMasterPassword": {
                this._ensureWriteAccess();
                const oldPw = String(msg.oldPassword || "");
                const newPw = String(msg.newPassword || "");
                if (newPw.length < 10) throw new Error("新しいマスターパスワードは10文字以上が必要です。");
                const envelope = await this._getEnvelope();
                if (!envelope) throw new Error("Vaultが見つかりません。");
                await unlockVaultEnvelope(envelope, oldPw);
                const updated = await createVaultEnvelope(this.session.vault, newPw);
                await this._setEnvelope(updated);
                const re = await unlockVaultEnvelope(updated, newPw);
                this.session.key = re.key;
                this.session.kdf = updated.kdf;
                this._touch();
                return { changed: true };
            }

            case "getTags": {
                this._ensureUnlocked();
                const tagSet = new Set();
                for (const item of this.session.vault.items) {
                    for (const t of item.tags || []) tagSet.add(t);
                }
                return { allTags: [...tagSet].sort() };
            }

            default:
                throw new Error("Unknown action.");
        }
    }
}
