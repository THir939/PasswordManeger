/**
 * UnlockScreen — Vault 解錠
 * 生体認証（Face ID / Touch ID / 指紋）+ パスワード入力
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    KeyboardAvoidingView, Platform, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { api } from '../services/api';
import {
    isBiometricAvailable, biometricUnlock, isBiometricEnabled,
    saveMasterPassword, setBiometricEnabled
} from '../services/auth';

export default function UnlockScreen({ onComplete }) {
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [bioInfo, setBioInfo] = useState({ available: false, type: 'none' });
    const [bioEnabled, setBioEnabled] = useState(false);
    const pulseAnim = new Animated.Value(1);

    useEffect(() => {
        // 脈動アニメーション
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        checkBiometric();
    }, []);

    const checkBiometric = async () => {
        const bio = await isBiometricAvailable();
        setBioInfo(bio);
        const enabled = await isBiometricEnabled();
        setBioEnabled(enabled);

        // 自動的に生体認証を試行
        if (bio.available && enabled) {
            tryBiometricUnlock();
        }
    };

    const tryBiometricUnlock = async () => {
        setLoading(true);
        try {
            const result = await biometricUnlock(async (pw) => {
                await api.unlockVault(pw);
            });
            if (result.success) {
                onComplete();
                return;
            }
            // 失敗した場合はパスワード入力にフォールバック
        } catch { }
        setLoading(false);
    };

    const handleUnlock = async () => {
        if (!password) return;
        setLoading(true);
        try {
            await api.unlockVault(password);

            // 生体認証が利用可能だが未設定の場合、提案
            if (bioInfo.available && !bioEnabled) {
                const typeLabel = bioInfo.type === 'face' ? 'Face ID' : '指紋認証';
                Alert.alert(
                    `${typeLabel} を有効にしますか？`,
                    '次回から生体認証で素早く解錠できます。',
                    [
                        { text: '後で', onPress: () => onComplete() },
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
                // 生体認証が有効な場合、PWを更新（変更された場合に備えて）
                if (bioEnabled) {
                    await saveMasterPassword(password);
                }
                onComplete();
            }
        } catch (err) {
            Alert.alert('解錠失敗', err.message);
        } finally {
            setLoading(false);
        }
    };

    const bioLabel = bioInfo.type === 'face' ? 'Face ID で解錠' :
        bioInfo.type === 'fingerprint' ? '指紋で解錠' : '生体認証で解錠';

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={styles.content}>
                    <Animated.Text style={[styles.icon, { transform: [{ scale: pulseAnim }] }]}>🔐</Animated.Text>
                    <Text style={styles.title}>Vault 解錠</Text>
                    <Text style={styles.desc}>マスターパスワードを入力してください。</Text>

                    <View style={styles.pwRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            secureTextEntry={!showPw}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="マスターパスワード"
                            placeholderTextColor={theme.colors.textMuted}
                            autoCapitalize="none"
                            returnKeyType="go"
                            onSubmitEditing={handleUnlock}
                        />
                        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowPw(!showPw)}>
                            <Text style={styles.toggleText}>{showPw ? '🔒' : '👁'}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleUnlock}
                        disabled={loading}
                    >
                        <Text style={styles.btnText}>{loading ? '解錠中...' : '解錠する'}</Text>
                    </TouchableOpacity>

                    {/* 生体認証ボタン */}
                    {bioInfo.available && bioEnabled && (
                        <TouchableOpacity style={styles.bioBtn} onPress={tryBiometricUnlock}>
                            <Text style={styles.bioBtnIcon}>
                                {bioInfo.type === 'face' ? '😊' : '👆'}
                            </Text>
                            <Text style={styles.bioBtnText}>{bioLabel}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 56, marginBottom: 16 },
    title: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
    desc: { fontSize: 14, color: theme.colors.textDim, textAlign: 'center', marginBottom: 28 },
    pwRow: { flexDirection: 'row', width: '100%', gap: 6, marginBottom: 4 },
    input: {
        padding: 14, fontSize: 16, backgroundColor: theme.colors.bgInput,
        color: theme.colors.text, borderRadius: theme.radiusSm,
        borderWidth: 1.5, borderColor: theme.colors.border,
    },
    toggleBtn: { padding: 14, backgroundColor: theme.colors.bgCard, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center' },
    toggleText: { fontSize: 18 },
    btn: {
        width: '100%', padding: 16, borderRadius: theme.radiusSm, marginTop: 16,
        backgroundColor: theme.colors.accent, alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    bioBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginTop: 24, padding: 16, borderRadius: theme.radiusSm,
        borderWidth: 1.5, borderColor: theme.colors.accent,
        width: '100%', justifyContent: 'center',
    },
    bioBtnIcon: { fontSize: 28 },
    bioBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.accentLight },
});
