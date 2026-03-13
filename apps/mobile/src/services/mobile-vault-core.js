import {
    createVaultEnvelope,
    encryptJson,
    unlockVaultEnvelope
} from "@pm/core/crypto";
import { generatePassword, passwordStrength } from "@pm/core/password";
import { generateTotp } from "@pm/core/totp";
import { buildSecurityReport } from "@pm/core/security-audit";
import { normalizePasskeyRecord, defaultPasskeyUrl, buildPasskeyTitle } from "@pm/core/passkey";

function nowIso() {
    return new Date().toISOString();
}

function createIdFallback() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }
    return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeTags(tags) {
    if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20);
    if (typeof tags === "string") return tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    return [];
}

function normalizeUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
        return "";
    }
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function extractHostname(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return "";
    }

    try {
        return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
    } catch {
        return "";
    }
}

function isSameOrRelatedDomain(left, right) {
    if (!left || !right) {
        return false;
    }

    return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

export function createDefaultVault() {
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

function normalizePasskeyInput(input = {}) {
    if (Array.isArray(input.transports)) {
        return input;
    }

    return {
        ...input,
        transports: typeof input.transports === "string"
            ? input.transports.split(",").map((entry) => String(entry).trim()).filter(Boolean)
            : []
    };
}

function buildPasskeyPayload(input = {}, existing = null) {
    const current = normalizePasskeyRecord(existing?.passkey || {});
    const next = normalizePasskeyRecord(normalizePasskeyInput(input), current);
    return {
        ...next,
        createdAt: current.createdAt || next.createdAt || nowIso(),
        lastSeenAt: next.lastSeenAt || nowIso(),
        lastUsedAt: next.lastUsedAt || (next.event === "get" ? nowIso() : current.lastUsedAt || "")
    };
}

function normalizeItem(input, existing = null, createId = createIdFallback) {
    const type = ["login", "card", "identity", "note", "passkey"].includes(input.type) ? input.type : "login";
    const now = nowIso();
    const base = existing || { id: createId(), createdAt: now };
    const passkey = buildPasskeyPayload(input.passkey || {}, base);

    const item = {
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
        passwordUpdatedAt: input.password !== undefined && input.password !== base.password ? now : (base.passwordUpdatedAt || null),
        createdAt: base.createdAt,
        updatedAt: now,
        lastUsedAt: base.lastUsedAt || null
    };

    if (!item.title) throw new Error("タイトルは必須です。");
    if (item.type === "login" && !item.password) throw new Error("ログイン項目にはパスワードが必要です。");
    if (item.type === "passkey" && (!item.passkey.rpId || !item.passkey.credentialId)) {
        throw new Error("Passkey項目には RP ID と Credential ID が必要です。");
    }
    return item;
}

export function normalizeVault(vault) {
    const fallback = createDefaultVault();
    const incoming = vault && typeof vault === "object" ? vault : {};
    return {
        version: 1,
        meta: {
            createdAt: incoming.meta?.createdAt || fallback.meta.createdAt,
            updatedAt: incoming.meta?.updatedAt || fallback.meta.updatedAt
        },
        settings: {
            autoLockMinutes: Number(incoming.settings?.autoLockMinutes) || fallback.settings.autoLockMinutes,
            clipboardClearSeconds: Number(incoming.settings?.clipboardClearSeconds) || fallback.settings.clipboardClearSeconds,
            passkeyProxyEnabled: Boolean(incoming.settings?.passkeyProxyEnabled),
            passkeyDesktopApprovalEnabled: incoming.settings?.passkeyDesktopApprovalEnabled ?? fallback.settings.passkeyDesktopApprovalEnabled,
            generator: { ...fallback.settings.generator, ...(incoming.settings?.generator || {}) }
        },
        items: Array.isArray(incoming.items) ? incoming.items.map((item) => normalizeItem(item, item, createIdFallback)) : []
    };
}

function buildAutofillCandidate(item) {
    return {
        id: item.id,
        type: item.type,
        title: item.title,
        username: item.username || item.passkey?.userName || "",
        url: item.url || defaultPasskeyUrl(item.passkey || {}),
        updatedAt: item.updatedAt,
        lastUsedAt: item.lastUsedAt || item.passkey?.lastUsedAt || "",
        passkey: item.type === "passkey"
            ? {
                rpId: item.passkey?.rpId || "",
                credentialId: item.passkey?.credentialId || ""
            }
            : null
    };
}

export function matchAutofillItems(items, domain) {
    const targetDomain = extractHostname(domain);
    if (!targetDomain) {
        return [];
    }

    return items
        .filter((item) => item.type === "login" || item.type === "passkey")
        .filter((item) => {
            const itemHost = extractHostname(item.url);
            const rpId = String(item.passkey?.rpId || "").trim().toLowerCase();
            return isSameOrRelatedDomain(itemHost, targetDomain) || isSameOrRelatedDomain(rpId, targetDomain);
        })
        .sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0))
        .map(buildAutofillCandidate);
}

export class MobileVaultCore {
    constructor({ readEnvelope, writeEnvelope, createId = createIdFallback } = {}) {
        if (typeof readEnvelope !== "function" || typeof writeEnvelope !== "function") {
            throw new Error("Vault storage adapter is required.");
        }

        this.readEnvelope = readEnvelope;
        this.writeEnvelope = writeEnvelope;
        this.createId = createId;
        this.session = {
            unlocked: false,
            key: null,
            kdf: null,
            vault: null,
            lastActivityAt: 0,
            sessionId: ""
        };

        this.autoLockTimer = setInterval(() => this._enforceAutoLock(), 60_000);
        this.autoLockTimer.unref?.();
    }

    dispose() {
        clearInterval(this.autoLockTimer);
    }

    _touch() {
        this.session.lastActivityAt = Date.now();
    }

    _reset() {
        Object.assign(this.session, {
            unlocked: false,
            key: null,
            kdf: null,
            vault: null,
            lastActivityAt: 0,
            sessionId: ""
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

    _ensureWriteAccess() {
        this._ensureUnlocked();
    }

    async _getEnvelope() {
        return this.readEnvelope();
    }

    async _setEnvelope(envelope) {
        await this.writeEnvelope(envelope);
    }

    async _persistVault() {
        if (!this.session.unlocked || !this.session.vault || !this.session.key || !this.session.kdf) {
            throw new Error("Vault is locked.");
        }
        this.session.vault.meta.updatedAt = nowIso();
        const encrypted = await encryptJson(this.session.vault, this.session.key);
        await this._setEnvelope({
            version: 1,
            kdf: this.session.kdf,
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
                const password = String(msg.masterPassword || "");
                if (password.length < 10) throw new Error("マスターパスワードは10文字以上にしてください。");
                const existing = await this._getEnvelope();
                if (existing) throw new Error("Vault already exists.");
                const vault = createDefaultVault();
                const envelope = await createVaultEnvelope(vault, password);
                await this._setEnvelope(envelope);
                const unlocked = await unlockVaultEnvelope(envelope, password);
                Object.assign(this.session, {
                    unlocked: true,
                    key: unlocked.key,
                    kdf: envelope.kdf,
                    vault,
                    sessionId: this.createId()
                });
                this._touch();
                return { created: true };
            }

            case "unlockVault": {
                const password = String(msg.masterPassword || "");
                if (!password) throw new Error("マスターパスワードを入力してください。");
                const envelope = await this._getEnvelope();
                if (!envelope) throw new Error("Vault is not initialized.");
                const unlocked = await unlockVaultEnvelope(envelope, password);
                Object.assign(this.session, {
                    unlocked: true,
                    key: unlocked.key,
                    kdf: envelope.kdf,
                    vault: normalizeVault(unlocked.vault),
                    sessionId: this.createId()
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
                const filters = msg.filters || {};
                if (filters.type && filters.type !== "all") items = items.filter((item) => item.type === filters.type);
                if (filters.onlyFavorites) items = items.filter((item) => item.favorite);
                if (filters.search) {
                    const query = filters.search.toLowerCase();
                    items = items.filter((item) =>
                        (item.title || "").toLowerCase().includes(query) ||
                        (item.username || "").toLowerCase().includes(query) ||
                        (item.url || "").toLowerCase().includes(query) ||
                        (item.notes || "").toLowerCase().includes(query) ||
                        (item.passkey?.rpId || "").toLowerCase().includes(query) ||
                        (item.passkey?.userName || "").toLowerCase().includes(query) ||
                        (item.passkey?.userDisplayName || "").toLowerCase().includes(query) ||
                        (item.passkey?.credentialId || "").toLowerCase().includes(query) ||
                        (item.tags || []).join(" ").toLowerCase().includes(query)
                    );
                }
                this._touch();
                return { items };
            }

            case "getItem": {
                this._ensureUnlocked();
                const item = this.session.vault.items.find((entry) => entry.id === msg.id);
                if (!item) throw new Error("アイテムが見つかりません。");
                this._touch();
                return { item };
            }

            case "saveItem": {
                this._ensureWriteAccess();
                const input = msg.item || {};
                const index = this.session.vault.items.findIndex((entry) => entry.id === input.id);
                const existing = index >= 0 ? this.session.vault.items[index] : null;
                const item = normalizeItem(input, existing, this.createId);
                if (index >= 0) this.session.vault.items[index] = item;
                else this.session.vault.items.unshift(item);
                await this._persistVault();
                return { item };
            }

            case "deleteItem": {
                this._ensureWriteAccess();
                const before = this.session.vault.items.length;
                this.session.vault.items = this.session.vault.items.filter((entry) => entry.id !== msg.id);
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
                    ...this.session.vault.settings,
                    ...next,
                    generator: { ...this.session.vault.settings.generator, ...(next.generator || {}) }
                };
                await this._persistVault();
                return { settings: this.session.vault.settings };
            }

            case "changeMasterPassword": {
                this._ensureWriteAccess();
                const oldPassword = String(msg.oldPassword || "");
                const newPassword = String(msg.newPassword || "");
                if (newPassword.length < 10) throw new Error("新しいマスターパスワードは10文字以上が必要です。");
                const envelope = await this._getEnvelope();
                if (!envelope) throw new Error("Vaultが見つかりません。");
                await unlockVaultEnvelope(envelope, oldPassword);
                const updated = await createVaultEnvelope(this.session.vault, newPassword);
                await this._setEnvelope(updated);
                const unlocked = await unlockVaultEnvelope(updated, newPassword);
                this.session.key = unlocked.key;
                this.session.kdf = updated.kdf;
                this._touch();
                return { changed: true };
            }

            case "exportVaultEnvelope": {
                const envelope = await this._getEnvelope();
                return {
                    initialized: Boolean(envelope),
                    envelope
                };
            }

            case "importVaultEnvelope": {
                const envelope = msg.envelope;
                if (!envelope?.kdf || !envelope?.cipher) {
                    throw new Error("暗号化Vault形式が不正です。");
                }
                await this._setEnvelope(envelope);
                this._reset();
                return {
                    imported: true,
                    locked: true
                };
            }

            case "getTags": {
                this._ensureUnlocked();
                const tagSet = new Set();
                for (const item of this.session.vault.items) {
                    for (const tag of item.tags || []) tagSet.add(tag);
                }
                return { allTags: [...tagSet].sort() };
            }

            case "listAutofillItems": {
                this._ensureUnlocked();
                const domain = String(msg.domain || "").trim();
                if (!domain) {
                    throw new Error("対象ドメインが必要です。");
                }
                this._touch();
                return {
                    domain: extractHostname(domain),
                    items: matchAutofillItems(this.session.vault.items, domain)
                };
            }

            default:
                throw new Error("Unknown action.");
        }
    }
}
