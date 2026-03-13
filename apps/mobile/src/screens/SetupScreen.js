/**
 * SetupScreen — 初回 Vault 作成
 * マスターパスワードの設定 + 生体認証の有効化提案
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView,
    Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { api } from '../services/api';
import { getTextInputAutofillProps } from '../services/text-input-autofill';
import { refreshAutofillSessionCache } from '../services/autofill-session';
import {
    isBiometricAvailable, saveMasterPassword, setBiometricEnabled
} from '../services/auth';

export default function SetupScreen({ onComplete }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [strength, setStrength] = useState(null);
    const [loading, setLoading] = useState(false);

    const checkStrength = async (pw) => {
        setPassword(pw);
        if (pw.length >= 4) {
            try {
                const res = await api.passwordStrength(pw);
                setStrength(res);
            } catch { }
        } else {
            setStrength(null);
        }
    };

    const handleSetup = async () => {
        if (password.length < 10) {
            Alert.alert('エラー', 'パスワードは10文字以上にしてください。');
            return;
        }
        if (password !== confirm) {
            Alert.alert('エラー', 'パスワードが一致しません。');
            return;
        }
        setLoading(true);
        try {
            await api.setupVault(password);
            await refreshAutofillSessionCache();

            // 生体認証の提案
            const bio = await isBiometricAvailable();
            if (bio.available) {
                const typeLabel = bio.type === 'face' ? 'Face ID' : bio.type === 'fingerprint' ? 'Touch ID / 指紋' : '生体認証';
                Alert.alert(
                    `${typeLabel} を有効にしますか？`,
                    '次回から生体認証でVaultを解錠できます。',
                    [
                        { text: '後で', style: 'cancel', onPress: () => onComplete() },
                        {
                            text: '有効にする',
                            onPress: async () => {
                                await saveMasterPassword(password);
                                await setBiometricEnabled(true);
                                onComplete();
                            }
                        }
                    ]
                );
            } else {
                onComplete();
            }
        } catch (err) {
            Alert.alert('エラー', err.message);
        } finally {
            setLoading(false);
        }
    };

    const strengthColor = strength
        ? (strength.score >= 75 ? theme.colors.success : strength.score >= 50 ? theme.colors.warn : theme.colors.danger)
        : theme.colors.border;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.icon}>🔒</Text>
                    <Text style={styles.title}>Vault 作成</Text>
                    <Text style={styles.desc}>マスターパスワードを設定してください。{'\n'}忘れると復元できません。</Text>

                    <Text style={styles.label}>マスターパスワード (10文字以上)</Text>
                    <View style={styles.pwRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            secureTextEntry={!showPw}
                            value={password}
                            onChangeText={checkStrength}
                            placeholder="マスターパスワード"
                            placeholderTextColor={theme.colors.textMuted}
                            autoCapitalize="none"
                            {...getTextInputAutofillProps('newPassword')}
                        />
                        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowPw(!showPw)}>
                            <Text style={styles.toggleText}>{showPw ? '🔒' : '👁'}</Text>
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

                    <Text style={styles.label}>確認入力</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        value={confirm}
                        onChangeText={setConfirm}
                        placeholder="もう一度入力"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                        autoComplete="off"
                    />

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleSetup}
                        disabled={loading}
                    >
                        <Text style={styles.btnText}>{loading ? '作成中...' : 'Vaultを作成して開く'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: '100%' },
    icon: { fontSize: 56, marginBottom: 16 },
    title: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
    desc: { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, alignSelf: 'stretch', marginBottom: 6, marginTop: 12 },
    input: {
        width: '100%', padding: 14, fontSize: 16, backgroundColor: theme.colors.bgInput,
        color: theme.colors.text, borderRadius: theme.radiusSm,
        borderWidth: 1.5, borderColor: theme.colors.border,
    },
    pwRow: { flexDirection: 'row', width: '100%', gap: 6 },
    toggleBtn: { padding: 14, backgroundColor: theme.colors.bgCard, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center' },
    toggleText: { fontSize: 18 },
    strengthBox: { width: '100%', marginTop: 6 },
    strengthTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 12, marginTop: 3 },
    btn: {
        width: '100%', padding: 16, borderRadius: theme.radiusSm, marginTop: 24,
        backgroundColor: theme.colors.accent, alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
