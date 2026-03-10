/**
 * In-App Purchase Service — react-native-iap を使ったネイティブ課金
 *
 * RevenueCat なしで App Store / Google Play の課金を処理し、
 * 自社サーバーでレシート検証を行う。
 */
import { Platform, Alert } from 'react-native';
import * as RNIap from 'react-native-iap';

// ===== 商品 ID (App Store Connect / Google Play Console で登録した ID) =====
const PRODUCT_IDS = {
    ios: ['pm_cloud_sync_monthly', 'pm_cloud_sync_yearly'],
    android: ['pm_cloud_sync_monthly', 'pm_cloud_sync_yearly'],
};

// ===== Server Base URL (Cloud Server, not local vault) =====
let serverBaseUrl = '';

export function setIapServerBase(url) {
    serverBaseUrl = url;
}

// ===== 初期化 =====
let initialized = false;
let purchaseListener = null;

export async function initIap() {
    if (initialized) return;
    try {
        await RNIap.initConnection();
        initialized = true;
    } catch (err) {
        console.warn('IAP init failed:', err);
    }
}

export async function endIap() {
    if (purchaseListener) {
        purchaseListener.remove();
        purchaseListener = null;
    }
    try {
        await RNIap.endConnection();
    } catch { }
    initialized = false;
}

// ===== 商品リスト取得 =====
export async function getSubscriptions() {
    await initIap();
    const skus = Platform.OS === 'ios' ? PRODUCT_IDS.ios : PRODUCT_IDS.android;
    try {
        const subs = await RNIap.getSubscriptions({ skus });
        return subs.map((s) => ({
            productId: s.productId,
            title: s.title || s.productId,
            description: s.description || '',
            price: s.localizedPrice || s.price || '---',
            priceAmount: Number(s.price) || 0,
            currency: s.currency || 'JPY',
            period: s.subscriptionPeriodUnitIOS || s.subscriptionPeriodAndroid || '',
        }));
    } catch (err) {
        console.warn('Failed to get subscriptions:', err);
        return [];
    }
}

// ===== 購入 =====
export async function purchaseSubscription(productId) {
    await initIap();
    try {
        if (Platform.OS === 'ios') {
            await RNIap.requestSubscription({ sku: productId });
        } else {
            await RNIap.requestSubscription({
                subscriptionOffers: [{ sku: productId, offerToken: '' }],
            });
        }
        // 購入結果は purchaseUpdatedListener で受け取る
        return true;
    } catch (err) {
        if (err.code === 'E_USER_CANCELLED') {
            return false; // ユーザーキャンセル
        }
        throw err;
    }
}

// ===== 購入リスナーの設定 =====
export function setupPurchaseListeners(authToken, onSuccess, onError) {
    // 購入成功
    purchaseListener = RNIap.purchaseUpdatedListener(async (purchase) => {
        try {
            // サーバーでレシート検証
            const result = await verifyReceiptOnServer(purchase, authToken);
            if (result.ok && result.active) {
                // 消費を完了
                await RNIap.finishTransaction({ purchase, isConsumable: false });
                onSuccess?.(result);
            } else {
                onError?.(new Error(result.error || '検証失敗'));
            }
        } catch (err) {
            onError?.(err);
        }
    });

    // 購入エラー
    RNIap.purchaseErrorListener((err) => {
        if (err.code !== 'E_USER_CANCELLED') {
            onError?.(err);
        }
    });
}

// ===== サーバーでレシート検証 =====
async function verifyReceiptOnServer(purchase, authToken) {
    if (!serverBaseUrl) {
        return { ok: false, error: 'Server URL not configured' };
    }

    const isIos = Platform.OS === 'ios';
    const endpoint = isIos
        ? '/api/billing/verify-receipt/ios'
        : '/api/billing/verify-receipt/android';

    const body = isIos
        ? { receiptData: purchase.transactionReceipt }
        : { productId: purchase.productId, purchaseToken: purchase.purchaseToken };

    const res = await fetch(`${serverBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
    });

    return res.json();
}

// ===== 購入済み確認 (復元) =====
export async function restorePurchases(authToken) {
    await initIap();
    try {
        const purchases = await RNIap.getAvailablePurchases();
        const results = [];
        for (const purchase of purchases) {
            const result = await verifyReceiptOnServer(purchase, authToken);
            results.push(result);
        }
        return results;
    } catch (err) {
        console.warn('Restore failed:', err);
        return [];
    }
}

// ===== サブスクリプション状態の確認 =====
export async function checkSubscriptionStatus(authToken) {
    if (!serverBaseUrl) return null;
    try {
        const res = await fetch(`${serverBaseUrl}/api/billing/status`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        return res.json();
    } catch {
        return null;
    }
}
