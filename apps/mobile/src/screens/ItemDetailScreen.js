/**
 * ItemDetailScreen — アイテム詳細
 * ワンタップコピー、TOTP自動更新、クリップボード自動クリア
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { api } from '../services/api';
import { refreshAutofillSessionCache } from '../services/autofill-session';

export default function ItemDetailScreen({ route, navigation }) {
    const { id } = route.params;
    const [item, setItem] = useState(null);
    const [showPw, setShowPw] = useState(false);
    const [totp, setTotp] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await api.getItem(id);
            setItem(data.item);
        } catch (err) {
            Alert.alert('エラー', err.message);
            navigation.goBack();
        }
    }, [id, navigation]);

    useEffect(() => { load(); }, [load]);

    // TOTP 自動更新
    useEffect(() => {
        if (!item?.otpSecret) return;
        let active = true;
        const refresh = async () => {
            try {
                const data = await api.generateTotp(item.otpSecret);
                if (active) setTotp(data);
            } catch { }
        };
        refresh();
        const timer = setInterval(refresh, 1000);
        return () => { active = false; clearInterval(timer); };
    }, [item?.otpSecret]);

    const copy = async (text, label) => {
        try {
            await Clipboard.setStringAsync(text);
            Alert.alert('✓', `${label}をコピーしました`, [{ text: 'OK' }]);
            setTimeout(async () => { try { await Clipboard.setStringAsync(''); } catch { } }, 20000);
        } catch { }
    };

    if (!item) return <View style={styles.container}><Text style={styles.loadingText}>読み込み中...</Text></View>;

    const handleDelete = () => {
        Alert.alert('削除確認', `「${item.title}」を削除しますか？`, [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '削除', style: 'destructive',
                onPress: async () => {
                    try {
                        await api.deleteItem(item.id);
                        await refreshAutofillSessionCache();
                        navigation.goBack();
                    } catch (err) {
                        Alert.alert('エラー', err.message);
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>← 一覧に戻る</Text>
            </TouchableOpacity>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.iconBox, { backgroundColor: (theme.typeColors[item.type] || '#666') + '20' }]}>
                        <Text style={{ fontSize: 24, color: theme.typeColors[item.type] || '#999' }}>
                            {theme.typeIcons[item.type]}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{item.title} {item.favorite ? '★' : ''}</Text>
                        <Text style={styles.meta}>{item.type} · 更新 {formatDate(item.updatedAt)}</Text>
                    </View>
                </View>

                {/* Fields */}
                {(item.type === 'login' || item.type === 'identity' || item.type === 'note') && item.username && (
                    <Field label="ユーザー名" value={item.username} onCopy={() => copy(item.username, 'ユーザー名')} />
                )}
                {item.type === 'login' && (
                    <>
                        <Field
                            label="パスワード"
                            value={showPw ? item.password : '••••••••'}
                            onCopy={() => copy(item.password, 'パスワード')}
                            extra={
                                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.pwToggle}>
                                    <Text style={styles.pwToggleText}>{showPw ? '🔒 隠す' : '👁 表示'}</Text>
                                </TouchableOpacity>
                            }
                        />
                        {item.url && <Field label="URL" value={item.url} onCopy={() => copy(item.url, 'URL')} />}
                        {totp && (
                            <View style={styles.field}>
                                <Text style={styles.fieldLabel}>TOTP</Text>
                                <View style={styles.totpRow}>
                                    <Text style={styles.totpCode}>{totp.code}</Text>
                                    <Text style={styles.totpTimer}>{totp.expiresIn}s</Text>
                                    <TouchableOpacity style={styles.copyBtn} onPress={() => copy(totp.code, 'TOTPコード')}>
                                        <Text style={styles.copyBtnText}>コピー</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}
                {item.type === 'passkey' && (
                    <>
                        {item.passkey?.rpId && <Field label="RP ID" value={item.passkey.rpId} onCopy={() => copy(item.passkey.rpId, 'RP ID')} />}
                        {item.passkey?.credentialId && <Field label="Credential ID" value={item.passkey.credentialId} onCopy={() => copy(item.passkey.credentialId, 'Credential ID')} />}
                        {item.passkey?.userName && <Field label="ユーザー名" value={item.passkey.userName} onCopy={() => copy(item.passkey.userName, 'ユーザー名')} />}
                        {item.passkey?.userDisplayName && <Field label="表示名" value={item.passkey.userDisplayName} />}
                        {item.passkey?.userHandle && <Field label="User Handle" value={item.passkey.userHandle} onCopy={() => copy(item.passkey.userHandle, 'User Handle')} />}
                        {item.passkey?.transports?.length > 0 && <Field label="Transport" value={item.passkey.transports.join(', ')} />}
                        {Number.isFinite(Number(item.passkey?.signCount)) && Number(item.passkey?.signCount) > 0 && <Field label="Sign Count" value={String(item.passkey.signCount)} />}
                        {item.passkey?.lastUsedAt && <Field label="最終利用" value={formatDateTime(item.passkey.lastUsedAt)} />}
                        {item.passkey?.lastSeenAt && <Field label="最終検知" value={formatDateTime(item.passkey.lastSeenAt)} />}
                        {item.url && <Field label="URL" value={item.url} onCopy={() => copy(item.url, 'URL')} />}
                    </>
                )}
                {item.type === 'identity' && (
                    <>
                        {item.fullName && <Field label="氏名" value={item.fullName} onCopy={() => copy(item.fullName, '氏名')} />}
                        {item.email && <Field label="メール" value={item.email} onCopy={() => copy(item.email, 'メール')} />}
                        {item.phone && <Field label="電話" value={item.phone} onCopy={() => copy(item.phone, '電話')} />}
                        {item.address && <Field label="住所" value={item.address} />}
                    </>
                )}
                {item.type === 'card' && (
                    <>
                        {item.cardHolder && <Field label="名義人" value={item.cardHolder} onCopy={() => copy(item.cardHolder, '名義人')} />}
                        {item.cardNumber && <Field label="カード番号" value={maskCard(item.cardNumber)} onCopy={() => copy(item.cardNumber, 'カード番号')} />}
                        {item.cardExpiry && <Field label="有効期限" value={item.cardExpiry} onCopy={() => copy(item.cardExpiry, '有効期限')} />}
                        {item.cardCvc && <Field label="CVC" value="•••" onCopy={() => copy(item.cardCvc, 'CVC')} />}
                    </>
                )}
                {item.notes ? <Field label="メモ" value={item.notes} /> : null}
                {item.tags?.length > 0 && (
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>タグ</Text>
                        <View style={styles.tags}>
                            {item.tags.map((t, i) => (
                                <View key={i} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => navigation.navigate('AddEdit', { item })}
                    >
                        <Text style={styles.editBtnText}>✏️ 編集</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Text style={styles.deleteBtnText}>🗑 削除</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function Field({ label, value, onCopy, extra }) {
    return (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.fieldRow}>
                <Text style={styles.fieldValue} selectable>{value}</Text>
                {extra}
                {onCopy && (
                    <TouchableOpacity style={styles.copyBtn} onPress={onCopy}>
                        <Text style={styles.copyBtnText}>コピー</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

function maskCard(num) {
    return num.length > 4 ? '•'.repeat(num.length - 4) + num.slice(-4) : num;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    loadingText: { color: theme.colors.textDim, textAlign: 'center', marginTop: 48 },
    backBtn: { padding: 12, paddingHorizontal: 16 },
    backText: { color: theme.colors.accentLight, fontSize: 15, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 80 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
    meta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
    field: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldValue: { flex: 1, fontSize: 15, color: theme.colors.text },
    copyBtn: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
        backgroundColor: theme.colors.bgInput, borderWidth: 1, borderColor: theme.colors.border,
    },
    copyBtnText: { fontSize: 12, fontWeight: '600', color: theme.colors.accentLight },
    pwToggle: { paddingHorizontal: 10, paddingVertical: 6 },
    pwToggleText: { fontSize: 13, color: theme.colors.accentLight },
    totpRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    totpCode: { fontSize: 24, fontWeight: '800', color: theme.colors.accentLight, letterSpacing: 4, fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace' },
    totpTimer: { fontSize: 13, color: theme.colors.textMuted },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(124,92,252,0.12)' },
    tagText: { fontSize: 12, fontWeight: '600', color: theme.colors.accentLight },
    actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
    editBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.accent, alignItems: 'center' },
    editBtnText: { fontSize: 15, fontWeight: '700', color: theme.colors.accentLight },
    deleteBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.danger, alignItems: 'center' },
    deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
