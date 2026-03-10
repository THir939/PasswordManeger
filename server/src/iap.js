/**
 * In-App Purchase Receipt Verification
 *
 * RevenueCat を使わず、Apple / Google のレシートを自社サーバーで直接検証する。
 * 検証成功後、Entitlement DB に課金状態を書き込む。
 */
import { config } from "./config.js";
import { FEATURE_CLOUD_SYNC, normalizeEntitlementStatus } from "./entitlements.js";

// ============================================================
// Apple App Store — レシート検証
// ============================================================

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

/**
 * Apple レシートを検証
 * @param {string} receiptData Base64 エンコードされたレシート
 * @returns {Promise<object>} { valid, expiresAt, productId, originalTransactionId, environment }
 */
export async function verifyAppleReceipt(receiptData) {
    const sharedSecret = config.appleSharedSecret;
    const body = JSON.stringify({
        "receipt-data": receiptData,
        password: sharedSecret || undefined,
        "exclude-old-transactions": true,
    });

    // まず本番環境に問い合わせ、21007 ならサンドボックスにフォールバック
    let response = await fetch(APPLE_PRODUCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });
    let result = await response.json();

    // status 21007 = sandbox receipt sent to production
    if (result.status === 21007) {
        response = await fetch(APPLE_SANDBOX_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });
        result = await response.json();
    }

    if (result.status !== 0) {
        return {
            valid: false,
            error: `Apple receipt validation failed: status ${result.status}`,
        };
    }

    // 最新の in_app アイテムまたは latest_receipt_info から判定
    const latestInfo = result.latest_receipt_info || result.receipt?.in_app || [];
    const sorted = [...latestInfo].sort(
        (a, b) => Number(b.expires_date_ms || 0) - Number(a.expires_date_ms || 0)
    );
    const latest = sorted[0];

    if (!latest) {
        return { valid: false, error: "No subscription info found in receipt" };
    }

    const expiresMs = Number(latest.expires_date_ms || 0);
    const isActive = expiresMs > Date.now();

    return {
        valid: true,
        active: isActive,
        productId: latest.product_id,
        originalTransactionId: latest.original_transaction_id,
        transactionId: latest.transaction_id,
        expiresAt: expiresMs > 0 ? new Date(expiresMs).toISOString() : null,
        environment: result.environment || "Production",
    };
}

// ============================================================
// Google Play — レシート検証
// ============================================================

/**
 * Google Play レシートを検証
 * Google Play Developer API を使用。
 * 必要環境変数: GOOGLE_PLAY_PACKAGE_NAME, GOOGLE_SERVICE_ACCOUNT_KEY (JSON)
 *
 * @param {string} productId プロダクトID
 * @param {string} purchaseToken 購入トークン
 * @returns {Promise<object>} { valid, expiresAt, orderId }
 */
export async function verifyGoogleReceipt(productId, purchaseToken) {
    const packageName = config.googlePlayPackageName;
    if (!packageName) {
        return { valid: false, error: "GOOGLE_PLAY_PACKAGE_NAME not configured" };
    }

    // Google Service Account Key から OAuth2 トークンを取得
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
        return { valid: false, error: "Failed to get Google API access token" };
    }

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const text = await response.text();
        return { valid: false, error: `Google API error: ${response.status} ${text}` };
    }

    const data = await response.json();
    const expiryMs = Number(data.expiryTimeMillis || 0);
    const isActive = expiryMs > Date.now();
    const cancelReason = data.cancelReason; // 0=user, 1=system

    return {
        valid: true,
        active: isActive,
        orderId: data.orderId,
        productId,
        expiresAt: expiryMs > 0 ? new Date(expiryMs).toISOString() : null,
        autoRenewing: Boolean(data.autoRenewing),
        canceled: cancelReason !== undefined && cancelReason !== null,
    };
}

/**
 * Google Service Account Key から OAuth2 Bearer Token を取得
 * npm パッケージなしで JWT を手動生成してトークン交換する
 */
async function getGoogleAccessToken() {
    const keyJson = config.googleServiceAccountKey;
    if (!keyJson) return null;

    let key;
    try {
        key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    } catch {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claimSet = Buffer.from(
        JSON.stringify({
            iss: key.client_email,
            scope: "https://www.googleapis.com/auth/androidpublisher",
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        })
    ).toString("base64url");

    const signInput = `${header}.${claimSet}`;

    // Node.js の crypto で RS256 署名
    const { createSign } = await import("node:crypto");
    const signer = createSign("RSA-SHA256");
    signer.update(signInput);
    const signature = signer.sign(key.private_key, "base64url");

    const jwt = `${signInput}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token || null;
}

// ============================================================
// Express ルート登録
// ============================================================

/**
 * IAP ルートを Express app に登録する
 * @param {import('express').Application} app
 * @param {Function} authRequired 認証ミドルウェア
 * @param {import('./store.js').JsonStore} store
 */
export function registerIapRoutes(app, authRequired, store) {
    // --- iOS レシート検証 ---
    app.post("/api/billing/verify-receipt/ios", authRequired, async (req, res) => {
        const receiptData = String(req.body?.receiptData || "").trim();
        if (!receiptData) {
            return res.status(422).json({ ok: false, error: "receiptData が必要です。" });
        }

        try {
            const result = await verifyAppleReceipt(receiptData);
            if (!result.valid) {
                return res.status(400).json({ ok: false, error: result.error });
            }

            // Entitlement を更新
            store.upsertEntitlement(req.user.id, {
                feature: FEATURE_CLOUD_SYNC,
                source: "apple",
                sourceRef: result.originalTransactionId || result.transactionId || "",
                status: result.active ? "active" : "expired",
                expiresAt: result.expiresAt,
                metadata: {
                    productId: result.productId,
                    environment: result.environment,
                    transactionId: result.transactionId,
                },
            });

            return res.json({
                ok: true,
                active: result.active,
                expiresAt: result.expiresAt,
                productId: result.productId,
            });
        } catch (err) {
            return res.status(500).json({ ok: false, error: `検証失敗: ${err.message}` });
        }
    });

    // --- Android レシート検証 ---
    app.post("/api/billing/verify-receipt/android", authRequired, async (req, res) => {
        const productId = String(req.body?.productId || "").trim();
        const purchaseToken = String(req.body?.purchaseToken || "").trim();
        if (!productId || !purchaseToken) {
            return res.status(422).json({ ok: false, error: "productId と purchaseToken が必要です。" });
        }

        try {
            const result = await verifyGoogleReceipt(productId, purchaseToken);
            if (!result.valid) {
                return res.status(400).json({ ok: false, error: result.error });
            }

            store.upsertEntitlement(req.user.id, {
                feature: FEATURE_CLOUD_SYNC,
                source: "google_play",
                sourceRef: result.orderId || "",
                status: result.active ? "active" : (result.canceled ? "canceled" : "expired"),
                expiresAt: result.expiresAt,
                metadata: {
                    productId: result.productId,
                    orderId: result.orderId,
                    autoRenewing: result.autoRenewing,
                },
            });

            return res.json({
                ok: true,
                active: result.active,
                expiresAt: result.expiresAt,
                productId: result.productId,
            });
        } catch (err) {
            return res.status(500).json({ ok: false, error: `検証失敗: ${err.message}` });
        }
    });
}
