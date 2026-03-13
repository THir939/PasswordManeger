/**
 * AddEditScreen — アイテム追加/編集
 * 全5種別（ログイン、パスキー、カード、個人情報、ノート）対応
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { api } from '../services/api';
import { refreshAutofillSessionCache } from '../services/autofill-session';
import { getTextInputAutofillProps } from '../services/text-input-autofill';

const TYPES = [
    { value: 'login', label: '🔑 ログイン' },
    { value: 'passkey', label: '🗝️ パスキー' },
    { value: 'card', label: '💳 クレジットカード' },
    { value: 'identity', label: '👤 個人情報' },
    { value: 'note', label: '📝 セキュアノート' },
];

export default function AddEditScreen({ route, navigation }) {
    const editItem = route?.params?.item;
    const isEdit = Boolean(editItem?.id);

    const [type, setType] = useState(editItem?.type || 'login');
    const [title, setTitle] = useState(editItem?.title || '');
    const [username, setUsername] = useState(editItem?.username || '');
    const [password, setPassword] = useState(editItem?.password || '');
    const [showPw, setShowPw] = useState(false);
    const [url, setUrl] = useState(editItem?.url || '');
    const [otpSecret, setOtpSecret] = useState(editItem?.otpSecret || '');
    const [passkeyRpId, setPasskeyRpId] = useState(editItem?.passkey?.rpId || '');
    const [passkeyCredentialId, setPasskeyCredentialId] = useState(editItem?.passkey?.credentialId || '');
    const [passkeyUserName, setPasskeyUserName] = useState(editItem?.passkey?.userName || '');
    const [passkeyDisplayName, setPasskeyDisplayName] = useState(editItem?.passkey?.userDisplayName || '');
    const [passkeyUserHandle, setPasskeyUserHandle] = useState(editItem?.passkey?.userHandle || '');
    const [passkeyTransports, setPasskeyTransports] = useState((editItem?.passkey?.transports || []).join(', '));
    const [fullName, setFullName] = useState(editItem?.fullName || '');
    const [email, setEmail] = useState(editItem?.email || '');
    const [phone, setPhone] = useState(editItem?.phone || '');
    const [address, setAddress] = useState(editItem?.address || '');
    const [cardHolder, setCardHolder] = useState(editItem?.cardHolder || '');
    const [cardNumber, setCardNumber] = useState(editItem?.cardNumber || '');
    const [cardExpiry, setCardExpiry] = useState(editItem?.cardExpiry || '');
    const [cardCvc, setCardCvc] = useState(editItem?.cardCvc || '');
    const [tags, setTags] = useState((editItem?.tags || []).join(', '));
    const [notes, setNotes] = useState(editItem?.notes || '');
    const [favorite, setFavorite] = useState(Boolean(editItem?.favorite));
    const [strength, setStrength] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (password) checkStrength(password);
    }, []);

    const checkStrength = async (pw) => {
        if (pw.length >= 4) {
            try { setStrength(await api.passwordStrength(pw)); } catch { }
        } else { setStrength(null); }
    };

    const genPassword = async () => {
        try {
            const data = await api.generatePassword();
            setPassword(data.password);
            setShowPw(true);
            checkStrength(data.password);
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    const handleSave = async () => {
        if (type !== 'passkey' && !title.trim()) { Alert.alert('エラー', 'タイトルを入力してください。'); return; }
        if (type === 'passkey' && (!passkeyRpId.trim() || !passkeyCredentialId.trim())) {
            Alert.alert('エラー', 'パスキーには RP ID と Credential ID が必要です。');
            return;
        }
        setSaving(true);
        try {
            await api.saveItem({
                id: editItem?.id, type, title, username, password, url, otpSecret,
                fullName, email, phone, address, cardHolder, cardNumber, cardExpiry, cardCvc,
                tags, notes, favorite,
                passkey: {
                    rpId: passkeyRpId,
                    credentialId: passkeyCredentialId,
                    userName: passkeyUserName || username,
                    userDisplayName: passkeyDisplayName,
                    userHandle: passkeyUserHandle,
                    transports: passkeyTransports,
                }
            });
            await refreshAutofillSessionCache();
            Alert.alert('✓', isEdit ? '更新しました！' : '保存しました！');
            if (navigation.canGoBack()) navigation.goBack();
        } catch (err) {
            Alert.alert('エラー', err.message);
        } finally {
            setSaving(false);
        }
    };

    const strengthColor = strength
        ? (strength.score >= 75 ? theme.colors.success : strength.score >= 50 ? theme.colors.warn : theme.colors.danger)
        : theme.colors.border;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>{isEdit ? '✏️ 編集' : '➕ 新規作成'}</Text>

                {/* Type selector */}
                <Text style={styles.label}>種別</Text>
                <View style={styles.typeRow}>
                    {TYPES.map(t => (
                        <TouchableOpacity
                            key={t.value}
                            style={[styles.typeBtn, type === t.value && styles.typeBtnActive]}
                            onPress={() => setType(t.value)}
                        >
                            <Text style={[styles.typeBtnText, type === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <InputField
                    label={type === 'passkey' ? 'タイトル（空欄なら自動生成）' : 'タイトル *'}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={type === 'passkey' ? '例: Alice (github.com)' : '例: GitHub'}
                />

                {['login', 'identity', 'note'].includes(type) && (
                    <InputField
                        label="ユーザー名 / メール"
                        value={username}
                        onChangeText={setUsername}
                        {...getTextInputAutofillProps(type === 'identity' ? 'email' : 'username')}
                    />
                )}

                {type === 'login' && (
                    <>
                        <Text style={styles.label}>パスワード</Text>
                        <View style={styles.pwRow}>
                            <TextInput style={[styles.input, { flex: 1 }]} secureTextEntry={!showPw} value={password}
                                onChangeText={(v) => { setPassword(v); checkStrength(v); }}
                                placeholderTextColor={theme.colors.textMuted}
                                {...getTextInputAutofillProps('currentPassword')}
                            />
                            <TouchableOpacity style={styles.pwBtn} onPress={() => setShowPw(!showPw)}>
                                <Text style={{ fontSize: 16 }}>{showPw ? '🔒' : '👁'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.genBtn} onPress={genPassword}>
                                <Text style={styles.genBtnText}>生成</Text>
                            </TouchableOpacity>
                        </View>
                        {strength && (
                            <View style={styles.strengthBox}>
                                <View style={styles.strengthTrack}>
                                    <View style={[styles.strengthFill, { width: `${strength.score}%`, backgroundColor: strengthColor }]} />
                                </View>
                                <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                                    強度: {strength.label} ({strength.score})
                                </Text>
                            </View>
                        )}
                        <InputField label="URL" value={url} onChangeText={setUrl} placeholder="https://example.com" keyboardType="url" {...getTextInputAutofillProps('url')} />
                        <InputField label="TOTP シークレット" value={otpSecret} onChangeText={setOtpSecret} placeholder="Base32 または otpauth://" />
                    </>
                )}

                {type === 'passkey' && (
                    <>
                        <InputField label="RP ID *" value={passkeyRpId} onChangeText={setPasskeyRpId} placeholder="github.com" />
                        <InputField label="Credential ID *" value={passkeyCredentialId} onChangeText={setPasskeyCredentialId} placeholder="Base64url / 文字列" />
                        <InputField label="ユーザー名" value={passkeyUserName} onChangeText={setPasskeyUserName} placeholder="alice@example.com" {...getTextInputAutofillProps('email')} />
                        <InputField label="表示名" value={passkeyDisplayName} onChangeText={setPasskeyDisplayName} placeholder="Alice" />
                        <InputField label="User Handle" value={passkeyUserHandle} onChangeText={setPasskeyUserHandle} placeholder="Base64url / 文字列" />
                        <InputField label="Transport (カンマ区切り)" value={passkeyTransports} onChangeText={setPasskeyTransports} placeholder="internal, usb" />
                        <InputField label="URL" value={url} onChangeText={setUrl} placeholder="https://github.com" keyboardType="url" {...getTextInputAutofillProps('url')} />
                    </>
                )}

                {type === 'identity' && (
                    <>
                        <InputField label="氏名" value={fullName} onChangeText={setFullName} {...getTextInputAutofillProps('name')} />
                        <InputField label="メール" value={email} onChangeText={setEmail} keyboardType="email-address" {...getTextInputAutofillProps('email')} />
                        <InputField label="電話" value={phone} onChangeText={setPhone} keyboardType="phone-pad" {...getTextInputAutofillProps('telephone')} />
                        <InputField label="住所" value={address} onChangeText={setAddress} multiline />
                    </>
                )}

                {type === 'card' && (
                    <>
                        <InputField label="名義人" value={cardHolder} onChangeText={setCardHolder} {...getTextInputAutofillProps('name')} />
                        <InputField label="カード番号" value={cardNumber} onChangeText={setCardNumber} keyboardType="number-pad" {...getTextInputAutofillProps('creditCardNumber')} />
                        <InputField label="有効期限 (MM/YY)" value={cardExpiry} onChangeText={setCardExpiry} />
                        <InputField label="CVC" value={cardCvc} onChangeText={setCardCvc} keyboardType="number-pad" secureTextEntry />
                    </>
                )}

                <InputField label="タグ (カンマ区切り)" value={tags} onChangeText={setTags} placeholder="work, personal" />
                <InputField label="メモ" value={notes} onChangeText={setNotes} multiline />

                <View style={styles.favRow}>
                    <Text style={styles.favLabel}>★ お気に入り</Text>
                    <Switch value={favorite} onValueChange={setFavorite} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" />
                </View>

                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存'}</Text>
                </TouchableOpacity>

                {navigation.canGoBack() && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelBtnText}>キャンセル</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function InputField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, ...rest }) {
    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[styles.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
                value={value} onChangeText={onChangeText} placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted} keyboardType={keyboardType}
                secureTextEntry={secureTextEntry} multiline={multiline} autoCapitalize="none"
                {...rest}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 80 },
    heading: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginBottom: 6, marginTop: 14 },
    input: {
        padding: 14, fontSize: 15, backgroundColor: theme.colors.bgInput,
        color: theme.colors.text, borderRadius: theme.radiusSm,
        borderWidth: 1.5, borderColor: theme.colors.border,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.border },
    typeBtnActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentGlow },
    typeBtnText: { fontSize: 13, color: theme.colors.textDim },
    typeBtnTextActive: { color: theme.colors.accentLight, fontWeight: '600' },
    pwRow: { flexDirection: 'row', gap: 4 },
    pwBtn: { padding: 14, backgroundColor: theme.colors.bgCard, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center' },
    genBtn: { padding: 14, backgroundColor: theme.colors.accent, borderRadius: theme.radiusSm, justifyContent: 'center' },
    genBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    strengthBox: { marginTop: 6 },
    strengthTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 12, marginTop: 3 },
    favRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
    favLabel: { fontSize: 15, color: theme.colors.text },
    saveBtn: { padding: 16, borderRadius: theme.radiusSm, backgroundColor: theme.colors.accent, alignItems: 'center', marginTop: 12 },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
    cancelBtnText: { fontSize: 15, color: theme.colors.textDim },
});
