/**
 * PurchaseScreen — アプリ内課金画面
 * 有料プラン（クラウド同期）へのアップグレードUI
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import {
    initIap, getSubscriptions, purchaseSubscription,
    setupPurchaseListeners, restorePurchases, checkSubscriptionStatus
} from '../services/iap';

const FEATURES = [
    { icon: '☁️', title: 'クラウド同期', desc: 'すべてのデバイスでVaultを暗号化同期' },
    { icon: '🔄', title: '自動バックアップ', desc: 'サーバーに暗号化Vaultを自動保存' },
    { icon: '🚨', title: '緊急アクセス', desc: 'Webからマスターパスワードで復元可能' },
    { icon: '🛡️', title: '優先サポート', desc: 'メールによる技術サポート' },
];

export default function PurchaseScreen({ authToken, navigation }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);

    useEffect(() => {
        loadData();
        return () => { };
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await initIap();

            // 現在のステータスを確認
            const status = await checkSubscriptionStatus(authToken);
            if (status?.ok && status.isPaid) {
                setCurrentPlan(status);
            }

            // 商品リストを取得
            const subs = await getSubscriptions();
            setProducts(subs);

            // 購入リスナーを設定
            setupPurchaseListeners(
                authToken,
                (result) => {
                    setPurchasing(false);
                    Alert.alert('✓ 購入完了', 'プレミアムプランが有効になりました！');
                    setCurrentPlan({ isPaid: true, expiresAt: result.expiresAt });
                },
                (err) => {
                    setPurchasing(false);
                    Alert.alert('購入エラー', err.message);
                }
            );
        } catch (err) {
            console.warn('Load failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (productId) => {
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
        setLoading(true);
        try {
            const results = await restorePurchases(authToken);
            const active = results.find(r => r.ok && r.active);
            if (active) {
                Alert.alert('✓ 復元完了', 'サブスクリプションを復元しました。');
                setCurrentPlan({ isPaid: true, expiresAt: active.expiresAt });
            } else {
                Alert.alert('復元なし', '有効なサブスクリプションが見つかりませんでした。');
            }
        } catch (err) {
            Alert.alert('エラー', err.message);
        } finally {
            setLoading(false);
        }
    };

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
                        {products.length === 0 ? (
                            <Text style={styles.noProducts}>
                                ストアから商品情報を取得できませんでした。
                            </Text>
                        ) : (
                            products.map((p) => (
                                <TouchableOpacity
                                    key={p.productId}
                                    style={[styles.planCard, purchasing && styles.planCardDisabled]}
                                    onPress={() => handlePurchase(p.productId)}
                                    disabled={purchasing}
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
                <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
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
    activePlan: {
        padding: 16, backgroundColor: theme.colors.success + '15', borderRadius: theme.radius,
        borderWidth: 1, borderColor: theme.colors.success + '40', alignItems: 'center', marginBottom: 16,
    },
    activePlanIcon: { fontSize: 28 },
    activePlanText: { fontSize: 16, fontWeight: '700', color: theme.colors.success, marginTop: 4 },
    activePlanDate: { fontSize: 12, color: theme.colors.textDim, marginTop: 4 },
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
