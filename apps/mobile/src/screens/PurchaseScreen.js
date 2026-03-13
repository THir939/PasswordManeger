/**
 * PurchaseScreen — アプリ内課金画面
 * 有料プラン（クラウド同期）へのアップグレードUI
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { theme } from '../theme';
import {
    initIap, getSubscriptions, purchaseSubscription,
    setupPurchaseListeners, restorePurchases, setIapServerBase, clearPurchaseListeners
} from '../services/iap';
import { api } from '../services/api';
import { getTextInputAutofillProps } from '../services/text-input-autofill';
import {
    clearCloudSession,
    fetchCloudBillingStatus,
    loadCloudSession,
    loginCloudAccount,
    pullCloudVaultSnapshot,
    pushCloudVaultSnapshot,
    registerCloudAccount,
    saveCloudSession
} from '../services/cloud-auth';

const FEATURES = [
    { icon: '☁️', title: 'クラウド同期', desc: 'すべてのデバイスでVaultを暗号化同期' },
    { icon: '🔄', title: '自動バックアップ', desc: 'サーバーに暗号化Vaultを自動保存' },
    { icon: '🚨', title: '緊急アクセス', desc: 'Webからマスターパスワードで復元可能' },
    { icon: '🛡️', title: '優先サポート', desc: 'メールによる技術サポート' },
];

export default function PurchaseScreen() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [authBusy, setAuthBusy] = useState(false);
    const [cloudBaseUrl, setCloudBaseUrl] = useState('');
    const [cloudEmail, setCloudEmail] = useState('');
    const [cloudPassword, setCloudPassword] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [syncBusy, setSyncBusy] = useState(false);
    const [syncMeta, setSyncMeta] = useState({ revision: 0, lastSyncAt: '' });

    useEffect(() => {
        loadData();
        return () => {
            clearPurchaseListeners();
        };
    }, []);

    const loadData = async (sessionOverride = null) => {
        setLoading(true);
        try {
            await initIap();

            const session = sessionOverride || await loadCloudSession();
            setCloudBaseUrl(session.baseUrl || '');
            setCloudEmail(session.email || '');
            setAuthToken(session.token || '');
            setSyncMeta({
                revision: Number(session.revision) || 0,
                lastSyncAt: session.lastSyncAt || ''
            });
            setIapServerBase(session.baseUrl || '');

            // 現在のステータスを確認
            if (session.baseUrl && session.token) {
                const status = await fetchCloudBillingStatus({
                    baseUrl: session.baseUrl,
                    token: session.token
                });
                setCurrentPlan(status);
                setupPurchaseListeners(
                    session.token,
                    (result) => {
                        setPurchasing(false);
                        Alert.alert('✓ 購入完了', 'プレミアムプランが有効になりました！');
                        setCurrentPlan((prev) => ({
                            ...(prev || {}),
                            ok: true,
                            isPaid: true,
                            expiresAt: result.expiresAt
                        }));
                    },
                    (err) => {
                        setPurchasing(false);
                        Alert.alert('購入エラー', err.message);
                    }
                );
            } else {
                clearPurchaseListeners();
                setCurrentPlan(null);
            }

            // 商品リストを取得
            const subs = await getSubscriptions();
            setProducts(subs);
        } catch (err) {
            console.warn('Load failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const connectCloud = async (mode) => {
        setAuthBusy(true);
        try {
            const authFn = mode === 'register' ? registerCloudAccount : loginCloudAccount;
            const session = await authFn({
                baseUrl: cloudBaseUrl,
                email: cloudEmail,
                password: cloudPassword
            });
            const persisted = await saveCloudSession({
                baseUrl: session.baseUrl,
                token: session.token,
                email: session.user?.email || cloudEmail,
                revision: 0,
                lastSyncAt: ''
            });
            setCloudPassword('');
            Alert.alert('✓', mode === 'register' ? 'クラウドアカウントを作成しました。' : 'クラウドにログインしました。');
            await loadData(persisted);
        } catch (err) {
            Alert.alert('接続エラー', err.message);
        } finally {
            setAuthBusy(false);
        }
    };

    const handleLogout = async () => {
        await clearCloudSession();
        clearPurchaseListeners();
        setAuthToken('');
        setCurrentPlan(null);
        setSyncMeta({ revision: 0, lastSyncAt: '' });
        setIapServerBase('');
        Alert.alert('✓', 'クラウド接続を解除しました。');
    };

    const persistSyncMeta = async (next) => {
        const persisted = await saveCloudSession({
            baseUrl: cloudBaseUrl,
            token: authToken,
            email: cloudEmail,
            revision: Number(next.revision) || 0,
            lastSyncAt: next.lastSyncAt || ''
        });
        setSyncMeta({
            revision: persisted.revision,
            lastSyncAt: persisted.lastSyncAt
        });
    };

    const handleSyncPush = async () => {
        if (!authToken || !cloudBaseUrl) {
            Alert.alert('クラウド接続が必要です', '先にクラウドURLとアカウントで接続してください。');
            return;
        }
        if (!currentPlan?.isPaid) {
            Alert.alert('プレミアム契約が必要です', 'クラウド同期は有料ユーザーのみ利用できます。先に購入または復元を完了してください。');
            return;
        }
        setSyncBusy(true);
        try {
            const local = await api.exportVaultEnvelope();
            if (!local.envelope) {
                Alert.alert('未初期化', '同期するVaultがまだありません。');
                return;
            }
            const snapshot = await pushCloudVaultSnapshot({
                baseUrl: cloudBaseUrl,
                token: authToken,
                revision: syncMeta.revision,
                envelope: local.envelope
            });
            const next = {
                revision: Number(snapshot?.revision) || syncMeta.revision,
                lastSyncAt: new Date().toISOString()
            };
            await persistSyncMeta(next);
            Alert.alert('✓ 同期完了', 'この端末の暗号化Vaultをクラウドへ push しました。');
        } catch (err) {
            Alert.alert('同期エラー', err.message);
        } finally {
            setSyncBusy(false);
        }
    };

    const handleSyncPull = async () => {
        if (!authToken || !cloudBaseUrl) {
            Alert.alert('クラウド接続が必要です', '先にクラウドURLとアカウントで接続してください。');
            return;
        }
        if (!currentPlan?.isPaid) {
            Alert.alert('プレミアム契約が必要です', 'クラウド同期は有料ユーザーのみ利用できます。先に購入または復元を完了してください。');
            return;
        }
        setSyncBusy(true);
        try {
            const snapshot = await pullCloudVaultSnapshot({
                baseUrl: cloudBaseUrl,
                token: authToken
            });
            if (!snapshot?.envelope) {
                Alert.alert('取得なし', 'クラウド側に同期済みVaultがありません。');
                return;
            }
            await api.importVaultEnvelope(snapshot.envelope);
            const next = {
                revision: Number(snapshot.revision) || 0,
                lastSyncAt: new Date().toISOString()
            };
            await persistSyncMeta(next);
            Alert.alert('✓ 取得完了', 'クラウドの暗号化Vaultを端末に反映しました。安全のため再度解錠してください。');
        } catch (err) {
            Alert.alert('同期エラー', err.message);
        } finally {
            setSyncBusy(false);
        }
    };

    const handleOpenCloudPortal = async () => {
        if (!authToken || !cloudBaseUrl) {
            Alert.alert('クラウド接続が必要です', '先にクラウドへログインしてください。');
            return;
        }
        try {
            const status = await fetch(`${cloudBaseUrl}/api/billing/portal-session`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            });
            const payload = await status.json();
            if (!status.ok || payload?.ok === false || !payload?.url) {
                throw new Error(payload?.error || '契約管理URLを作成できませんでした。');
            }
            await Linking.openURL(payload.url);
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    const handlePurchase = async (productId) => {
        if (!authToken || !cloudBaseUrl) {
            Alert.alert('クラウド接続が必要です', '先にクラウドURLとアカウントで接続してください。');
            return;
        }
        setPurchasing(true);
        try {
            const result = await purchaseSubscription(productId);
            if (!result) {
                setPurchasing(false); // user cancelled
            }
            // if result is true, purchaseUpdatedListener will handle it
        } catch (err) {
            setPurchasing(false);
            Alert.alert('エラー', err.message);
        }
    };

    const handleRestore = async () => {
        if (!authToken || !cloudBaseUrl) {
            Alert.alert('クラウド接続が必要です', '先にクラウドURLとアカウントで接続してください。');
            return;
        }
        setLoading(true);
        try {
            const results = await restorePurchases(authToken);
            const active = results.find(r => r.ok && r.active);
            if (active) {
                Alert.alert('✓ 復元完了', 'サブスクリプションを復元しました。');
                const refreshed = await fetchCloudBillingStatus({
                    baseUrl: cloudBaseUrl,
                    token: authToken
                });
                setCurrentPlan(refreshed);
            } else {
                Alert.alert('復元なし', '有効なサブスクリプションが見つかりませんでした。');
            }
        } catch (err) {
            Alert.alert('エラー', err.message);
        } finally {
            setLoading(false);
        }
    };

    const isConnected = Boolean(authToken && cloudBaseUrl);
    const hasPaidAccess = Boolean(currentPlan?.isPaid);
    const canSync = isConnected && hasPaidAccess && !syncBusy;
    const syncGateText = !isConnected
        ? '先にクラウドへ接続してください。'
        : hasPaidAccess
            ? '有料契約が有効なので、この端末から push / pull できます。'
            : '接続済みですが、同期は有料契約の有効化後に使えます。';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loadingText}>読み込み中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.heading}>💎 プレミアムプラン</Text>
                <Text style={styles.subheading}>クラウド同期で全デバイスをシームレスに。</Text>

                <View style={styles.statusRow}>
                    <View style={[styles.statusChip, isConnected ? styles.statusChipSuccess : styles.statusChipMuted]}>
                        <Text style={[styles.statusChipText, isConnected ? styles.statusChipTextSuccess : null]}>
                            {isConnected ? '接続済み' : '未接続'}
                        </Text>
                    </View>
                    <View style={[styles.statusChip, hasPaidAccess ? styles.statusChipSuccess : styles.statusChipMuted]}>
                        <Text style={[styles.statusChipText, hasPaidAccess ? styles.statusChipTextSuccess : null]}>
                            {hasPaidAccess ? 'プレミアム有効' : '無料プラン'}
                        </Text>
                    </View>
                    <View style={[styles.statusChip, canSync ? styles.statusChipAccent : styles.statusChipMuted]}>
                        <Text style={[styles.statusChipText, canSync ? styles.statusChipTextAccent : null]}>
                            {canSync ? '同期可能' : '同期待ち'}
                        </Text>
                    </View>
                </View>

                <View style={styles.authCard}>
                    <Text style={styles.authTitle}>☁️ クラウド接続</Text>
                    <Text style={styles.authDesc}>
                        モバイル課金はクラウドアカウントと接続してから使います。まずサーバーURLとメール/パスワードを設定してください。
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={cloudBaseUrl}
                        onChangeText={setCloudBaseUrl}
                        placeholder="https://api.example.com"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TextInput
                        style={styles.input}
                        value={cloudEmail}
                        onChangeText={setCloudEmail}
                        placeholder="email@example.com"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        {...getTextInputAutofillProps('email')}
                    />
                    <TextInput
                        style={styles.input}
                        value={cloudPassword}
                        onChangeText={setCloudPassword}
                        placeholder="クラウド用パスワード"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                        secureTextEntry
                        {...getTextInputAutofillProps('currentPassword')}
                    />
                    <View style={styles.authActions}>
                        <TouchableOpacity
                            style={[styles.authButton, authBusy && styles.planCardDisabled]}
                            onPress={() => connectCloud('register')}
                            disabled={authBusy}
                        >
                            <Text style={styles.authButtonText}>新規登録</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.authButton, styles.authButtonGhost, authBusy && styles.planCardDisabled]}
                            onPress={() => connectCloud('login')}
                            disabled={authBusy}
                        >
                            <Text style={styles.authButtonGhostText}>ログイン</Text>
                        </TouchableOpacity>
                    </View>
                    {authToken ? (
                        <View style={styles.connectedBox}>
                            <Text style={styles.connectedText}>接続中: {cloudEmail || 'ログイン済みユーザー'}</Text>
                            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                                <Text style={styles.logoutBtnText}>接続解除</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Text style={styles.authHint}>未接続の状態では購入・復元は実行できません。</Text>
                    )}
                </View>

                <View style={styles.syncCard}>
                    <Text style={styles.syncTitle}>🔄 クラウド同期</Text>
                    <Text style={styles.syncMeta}>
                        現在のリビジョン: {syncMeta.revision} {'\n'}
                        最終同期: {syncMeta.lastSyncAt ? new Date(syncMeta.lastSyncAt).toLocaleString('ja-JP') : '未同期'}
                    </Text>
                    <Text style={styles.syncHint}>{syncGateText}</Text>
                    <View style={styles.authActions}>
                        <TouchableOpacity
                            style={[styles.authButton, !canSync && styles.planCardDisabled]}
                            onPress={handleSyncPush}
                            disabled={!canSync}
                        >
                            <Text style={styles.authButtonText}>{syncBusy ? '処理中...' : 'Push'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.authButton, styles.authButtonGhost, !canSync && styles.planCardDisabled]}
                            onPress={handleSyncPull}
                            disabled={!canSync}
                        >
                            <Text style={styles.authButtonGhostText}>{syncBusy ? '処理中...' : 'Pull'}</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[styles.portalBtn, !isConnected && styles.planCardDisabled]} onPress={handleOpenCloudPortal} disabled={!isConnected}>
                        <Text style={styles.portalBtnText}>契約管理をWebで開く</Text>
                    </TouchableOpacity>
                </View>

                {/* 現在のプラン */}
                {currentPlan?.isPaid && (
                    <View style={styles.activePlan}>
                        <Text style={styles.activePlanIcon}>✅</Text>
                        <Text style={styles.activePlanText}>プレミアムプラン利用中</Text>
                        {currentPlan.expiresAt && (
                            <Text style={styles.activePlanDate}>
                                次回更新: {new Date(currentPlan.expiresAt).toLocaleDateString('ja-JP')}
                            </Text>
                        )}
                    </View>
                )}

                {/* 機能リスト */}
                <View style={styles.features}>
                    {FEATURES.map((f, i) => (
                        <View key={i} style={styles.featureRow}>
                            <Text style={styles.featureIcon}>{f.icon}</Text>
                            <View style={styles.featureInfo}>
                                <Text style={styles.featureTitle}>{f.title}</Text>
                                <Text style={styles.featureDesc}>{f.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* 商品プラン */}
                {!currentPlan?.isPaid && (
                    <View style={styles.plans}>
                        {!authToken && (
                            <Text style={styles.noProducts}>
                                先にクラウド接続を完了してください。
                            </Text>
                        )}
                        {products.length === 0 ? (
                            <Text style={styles.noProducts}>
                                ストアから商品情報を取得できませんでした。
                            </Text>
                        ) : (
                            products.map((p) => (
                                <TouchableOpacity
                                    key={p.productId}
                                    style={[styles.planCard, (purchasing || !isConnected) && styles.planCardDisabled]}
                                    onPress={() => handlePurchase(p.productId)}
                                    disabled={purchasing || !isConnected}
                                >
                                    <Text style={styles.planTitle}>{p.title}</Text>
                                    <Text style={styles.planPrice}>{p.price}</Text>
                                    {p.description ? <Text style={styles.planDesc}>{p.description}</Text> : null}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {purchasing && (
                    <View style={styles.purchasingOverlay}>
                        <ActivityIndicator size="small" color={theme.colors.accent} />
                        <Text style={styles.purchasingText}>購入処理中...</Text>
                    </View>
                )}

                {/* 復元ボタン */}
                <TouchableOpacity style={[styles.restoreBtn, !isConnected && styles.planCardDisabled]} onPress={handleRestore} disabled={!isConnected}>
                    <Text style={styles.restoreBtnText}>購入を復元する</Text>
                </TouchableOpacity>

                <Text style={styles.legal}>
                    ・サブスクリプションは自動更新されます{'\n'}
                    ・キャンセルは端末の設定 → サブスクリプションから{'\n'}
                    ・プライバシーポリシーと利用規約に同意の上ご購入ください
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: theme.colors.textDim, marginTop: 12 },
    scroll: { padding: 20, paddingBottom: 60 },
    heading: { fontSize: 26, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
    subheading: { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', marginTop: 6, marginBottom: 20 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
    statusChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.bgInput,
    },
    statusChipMuted: { backgroundColor: theme.colors.bgInput },
    statusChipSuccess: { backgroundColor: theme.colors.success + '16', borderColor: theme.colors.success + '40' },
    statusChipAccent: { backgroundColor: theme.colors.accentGlow, borderColor: theme.colors.accent + '55' },
    statusChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textDim },
    statusChipTextSuccess: { color: theme.colors.success },
    statusChipTextAccent: { color: theme.colors.accentLight },
    activePlan: {
        padding: 16, backgroundColor: theme.colors.success + '15', borderRadius: theme.radius,
        borderWidth: 1, borderColor: theme.colors.success + '40', alignItems: 'center', marginBottom: 16,
    },
    activePlanIcon: { fontSize: 28 },
    activePlanText: { fontSize: 16, fontWeight: '700', color: theme.colors.success, marginTop: 4 },
    activePlanDate: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
    authCard: {
        padding: 16,
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.radius,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 18,
        gap: 10,
    },
    authTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    authDesc: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
    input: {
        padding: 14,
        fontSize: 14,
        backgroundColor: theme.colors.bgInput,
        color: theme.colors.text,
        borderRadius: theme.radiusSm,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
    },
    authActions: { flexDirection: 'row', gap: 8 },
    authButton: {
        flex: 1,
        padding: 14,
        borderRadius: theme.radiusSm,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
    },
    authButtonGhost: {
        backgroundColor: theme.colors.bgInput,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
    },
    authButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    authButtonGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    authHint: { fontSize: 12, color: theme.colors.textMuted },
    connectedBox: {
        paddingTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    connectedText: { flex: 1, fontSize: 12, color: theme.colors.success },
    logoutBtn: { paddingVertical: 10, paddingHorizontal: 12 },
    logoutBtnText: { color: theme.colors.accentLight, fontSize: 13, fontWeight: '600' },
    syncCard: {
        padding: 16,
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.radius,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 18,
        gap: 10,
    },
    syncTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    syncMeta: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
    syncHint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
    portalBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    portalBtnText: {
        color: theme.colors.accentLight,
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    features: { marginBottom: 20 },
    featureRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    featureIcon: { fontSize: 24, width: 36, textAlign: 'center' },
    featureInfo: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
    featureDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    plans: { gap: 10, marginBottom: 16 },
    noProducts: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', padding: 20 },
    planCard: {
        padding: 20, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius,
        borderWidth: 1.5, borderColor: theme.colors.accent, alignItems: 'center',
    },
    planCardDisabled: { opacity: 0.5 },
    planTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    planPrice: { fontSize: 24, fontWeight: '800', color: theme.colors.accentLight, marginTop: 4 },
    planDesc: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
    purchasingOverlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
    purchasingText: { fontSize: 14, color: theme.colors.textDim },
    restoreBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
    restoreBtnText: { fontSize: 14, color: theme.colors.accentLight, textDecorationLine: 'underline' },
    legal: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 16 },
});
