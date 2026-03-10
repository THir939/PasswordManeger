// @pm/core — フレームワーク非依存の共通コアロジック
// 暗号化、パスワード生成、TOTP、セキュリティ監査、移行ツール等を集約

export {
    KDF_ITERATIONS,
    bytesToBase64,
    base64ToBytes,
    deriveAesKey,
    encryptJson,
    decryptJson,
    createVaultEnvelope,
    unlockVaultEnvelope
} from "./crypto.js";

export {
    generatePassword,
    passwordStrength
} from "./password.js";

export { generateTotp } from "./totp.js";

export { buildSecurityReport } from "./security-audit.js";

export { parseExternalItems } from "./migration.js";

export { AuditLogger } from "./audit-log.js";

export {
    normalizeBaseUrl,
    isLocalDevelopmentHost,
    validateCloudBaseUrl,
    safeCloudBaseUrl
} from "./cloud-url.js";

export {
    generateDomainAlias,
    generateRandomAlias
} from "./email-alias.js";

export {
    getRegistrableDomain,
    levenshteinDistance,
    extractDomain,
    buildAutofillRisk
} from "./autofill-risk.js";
