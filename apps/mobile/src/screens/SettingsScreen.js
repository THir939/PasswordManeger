/**
 * SettingsScreen — 設定
 * 自動ロック、クリップボードクリア、マスターPW変更、
 * 生体認証ON/OFF、Vaultロック
 */
import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { api } from '../services/api';
import { loadAutofillSettings, saveAutofillSettings } from '../services/autofill';
import { clearAutofillSessionCache, refreshAutofillSessionCache } from '../services/autofill-session';
import { getTextInputAutofillProps } from '../services/text-input-autofill';
import {
    isBiometricAvailable, isBiometricEnabled, setBiometricEnabled,
    saveMasterPassword, clearMasterPassword
} from '../services/auth';

export default function SettingsScreen({ onLock }) {
    const [autoLock, setAutoLock] = useState('10');
    const [clipboardClear, setClipboardClear] = useState('20');
    const [bioAvailable, setBioAvailable] = useState(false);
    const [bioType, setBioType] = useState('biometric');
    const [bioEnabled, setBioEnabled] = useState(false);
    const [oldPw, setOldPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [strength, setStrength] = useState(null);
    const [autofillEnabled, setAutofillEnabled] = useState(true);
    const [autofillDomains, setAutofillDomains] = useState('');

    useFocusEffect(useCallback(() => {
        loadSettings();
        checkBio();
        loadAutofill();
    }, []));

    const loadSettings = async () => {
        try {
            const data = await api.getSettings();
            setAutoLock(String(data.settings.autoLockMinutes || 10));
            setClipboardClear(String(data.settings.clipboardClearSeconds || 20));
        } catch { }
    };

    const checkBio = async () => {
        const bio = await isBiometricAvailable();
        setBioAvailable(bio.available);
        setBioType(bio.type);
        const enabled = await isBiometricEnabled();
        setBioEnabled(enabled);
    };

    const loadAutofill = async () => {
        try {
            const data = await loadAutofillSettings();
            setAutofillEnabled(data.enabled);
            setAutofillDomains(data.domains.join('\n'));
        } catch { }
    };

    const handleSaveSettings = async () => {
        try {
            await api.saveSettings({
                autoLockMinutes: Number(autoLock),
                clipboardClearSeconds: Number(clipboardClear),
            });
            Alert.alert('✓', '設定を保存しました！');
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    const handleBioToggle = async (enabled) => {
        if (enabled) {
            // 生体認証を有効にするにはマスターPWの入力が必要
            Alert.prompt?.('マスターパスワード', '生体認証を有効にするためにマスターパスワードを入力してください。',
                async (pw) => {
                    if (!pw) return;
                    await saveMasterPassword(pw);
                    await setBiometricEnabled(true);
                    setBioEnabled(true);
                    Alert.alert('✓', '生体認証を有効にしました！');
                },
                'secure-text'
            ) || Alert.alert('生体認証', '現在のマスターパスワードでVaultを解錠した状態で有効にしてください。',
                [
                    { text: 'キャンセル' },
                    {
                        text: '有効にする', onPress: async () => {
                            await setBiometricEnabled(true);
                            setBioEnabled(true);
                        }
                    }
                ]
            );
        } else {
            await setBiometricEnabled(false);
            await clearMasterPassword();
            setBioEnabled(false);
            Alert.alert('✓', '生体認証を無効にしました。');
        }
    };

    const handleChangeMaster = async () => {
        if (!oldPw || !newPw) { Alert.alert('エラー', 'パスワードを入力してください。'); return; }
        if (newPw.length < 10) { Alert.alert('エラー', '新しいパスワードは10文字以上にしてください。'); return; }
        try {
            await api.changeMasterPassword(oldPw, newPw);
            // 生体認証が有効なら新しいPWを保存
            if (bioEnabled) {
                await saveMasterPassword(newPw);
            }
            setOldPw('');
            setNewPw('');
            setStrength(null);
            Alert.alert('✓', 'マスターパスワードを変更しました！');
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    const handleSaveAutofill = async () => {
        try {
            const saved = await saveAutofillSettings({
                enabled: autofillEnabled,
                domains: autofillDomains
            });
            setAutofillEnabled(saved.enabled);
            setAutofillDomains(saved.domains.join('\n'));
            if (saved.enabled) {
                await refreshAutofillSessionCache();
            } else {
                await clearAutofillSessionCache();
            }
            Alert.alert('✓', 'OS AutoFill 用の設定を保存しました。解錠中キャッシュも更新しました。');
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    const checkStrength = async (pw) => {
        setNewPw(pw);
        if (pw.length >= 4) {
            try { setStrength(await api.passwordStrength(pw)); } catch { }
        } else {
            setStrength(null);
        }
    };

    const strengthColor = strength
        ? (strength.score >= 75 ? theme.colors.success : strength.score >= 50 ? theme.colors.warn : theme.colors.danger)
        : theme.colors.border;

    const bioLabel = bioType === 'face' ? 'Face ID' : bioType === 'fingerprint' ? 'Touch ID / 指紋' : '生体認証';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>⚙️ 設定</Text>

                {/* General */}
                <Text style={styles.section}>一般</Text>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>自動ロック（分）</Text>
                    <TextInput style={styles.rowInput} keyboardType="number-pad" value={autoLock} onChangeText={setAutoLock} />
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>クリップボードクリア（秒）</Text>
                    <TextInput style={styles.rowInput} keyboardType="number-pad" value={clipboardClear} onChangeText={setClipboardClear} />
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                    <Text style={styles.saveBtnText}>設定を保存</Text>
                </TouchableOpacity>

                {/* Biometrics */}
                {bioAvailable && (
                    <>
                        <Text style={styles.section}>セキュリティ</Text>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabel}>{bioLabel} で解錠</Text>
                                <Text style={styles.rowDesc}>パスワード入力なしで素早くアクセス</Text>
                            </View>
                            <Switch value={bioEnabled} onValueChange={handleBioToggle} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" />
                        </View>
                    </>
                )}

                <Text style={styles.section}>OS AutoFill（ベータ）</Text>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>OS 自動入力を準備する</Text>
                        <Text style={styles.rowDesc}>関連ドメインと候補解決に使う設定を保存します。</Text>
                    </View>
                    <Switch value={autofillEnabled} onValueChange={setAutofillEnabled} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" />
                </View>
                <Text style={styles.label}>関連ドメイン（1行1つ、またはカンマ区切り）</Text>
                <TextInput
                    style={[styles.input, { minHeight: 96, textAlignVertical: 'top' }]}
                    value={autofillDomains}
                    onChangeText={setAutofillDomains}
                    placeholder={'example.com\naccounts.example.com'}
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Text style={styles.rowDesc}>
                    iOS の `webcredentials:` / `applinks:` に使う候補です。保存後、`expo prebuild` または EAS Build でネイティブ設定へ反映します。
                </Text>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAutofill}>
                    <Text style={styles.saveBtnText}>OS AutoFill 設定を保存</Text>
                </TouchableOpacity>

                {/* Master Password */}
                <Text style={styles.section}>マスターパスワード変更</Text>
                <Text style={styles.label}>現在のパスワード</Text>
                <View style={styles.pwRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} secureTextEntry={!showOld} value={oldPw}
                        onChangeText={setOldPw} placeholderTextColor={theme.colors.textMuted} autoCapitalize="none"
                        {...getTextInputAutofillProps('currentPassword')} />
                    <TouchableOpacity style={styles.pwBtn} onPress={() => setShowOld(!showOld)}>
                        <Text style={{ fontSize: 16 }}>{showOld ? '🔒' : '👁'}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.label}>新しいパスワード (10文字以上)</Text>
                <View style={styles.pwRow}>
                    <TextInput style={[styles.input, { flex: 1 }]} secureTextEntry={!showNew} value={newPw}
                        onChangeText={checkStrength} placeholderTextColor={theme.colors.textMuted} autoCapitalize="none"
                        {...getTextInputAutofillProps('newPassword')} />
                    <TouchableOpacity style={styles.pwBtn} onPress={() => setShowNew(!showNew)}>
                        <Text style={{ fontSize: 16 }}>{showNew ? '🔒' : '👁'}</Text>
                    </TouchableOpacity>
                </View>
                {strength && (
                    <View style={styles.strengthBox}>
                        <View style={styles.strengthTrack}>
                            <View style={[styles.strengthFill, { width: `${strength.score}%`, backgroundColor: strengthColor }]} />
                        </View>
                        <Text style={[styles.strengthLabel, { color: strengthColor }]}>強度: {strength.label} ({strength.score})</Text>
                    </View>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={handleChangeMaster}>
                    <Text style={styles.saveBtnText}>パスワードを変更</Text>
                </TouchableOpacity>

                {/* Lock */}
                <TouchableOpacity style={styles.lockBtn} onPress={onLock}>
                    <Text style={styles.lockBtnText}>🔒 Vaultをロック</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scrollContent: { padding: 16, paddingBottom: 80 },
    heading: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
    section: { fontSize: 16, fontWeight: '700', color: theme.colors.accentLight, marginTop: 24, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowLabel: { fontSize: 15, color: theme.colors.text },
    rowDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    rowInput: { width: 60, padding: 8, fontSize: 15, backgroundColor: theme.colors.bgInput, color: theme.colors.text, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginBottom: 6, marginTop: 12 },
    input: {
        padding: 14, fontSize: 15, backgroundColor: theme.colors.bgInput,
        color: theme.colors.text, borderRadius: theme.radiusSm,
        borderWidth: 1.5, borderColor: theme.colors.border,
    },
    pwRow: { flexDirection: 'row', gap: 4 },
    pwBtn: { padding: 14, backgroundColor: theme.colors.bgCard, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center' },
    strengthBox: { marginTop: 6, marginBottom: 8 },
    strengthTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 12, marginTop: 3 },
    saveBtn: { padding: 14, borderRadius: theme.radiusSm, backgroundColor: theme.colors.accent, alignItems: 'center', marginTop: 12 },
    saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    lockBtn: { padding: 16, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.danger, alignItems: 'center', marginTop: 32 },
    lockBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.danger },
});
