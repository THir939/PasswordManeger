/**
 * GeneratorScreen — パスワード生成
 * 長さ・文字種をカスタマイズしてワンタップ生成＆コピー
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { api } from '../services/api';

export default function GeneratorScreen() {
    const [length, setLength] = useState(20);
    const [uppercase, setUppercase] = useState(true);
    const [lowercase, setLowercase] = useState(true);
    const [numbers, setNumbers] = useState(true);
    const [symbols, setSymbols] = useState(true);
    const [password, setPassword] = useState('');
    const [strength, setStrength] = useState(null);

    const generate = async () => {
        try {
            const data = await api.generatePassword({ length, uppercase, lowercase, numbers, symbols });
            setPassword(data.password);
            const str = await api.passwordStrength(data.password);
            setStrength(str);
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    };

    useEffect(() => { generate(); }, []);

    const copyPw = async () => {
        if (!password) return;
        await Clipboard.setStringAsync(password);
        Alert.alert('✓', 'コピーしました（20秒後にクリア）');
        setTimeout(async () => { try { await Clipboard.setStringAsync(''); } catch { } }, 20000);
    };

    const strengthColor = strength
        ? (strength.score >= 75 ? theme.colors.success : strength.score >= 50 ? theme.colors.warn : theme.colors.danger)
        : theme.colors.textMuted;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                <Text style={styles.heading}>🔑 パスワード生成</Text>

                <View style={styles.pwBox}>
                    <Text style={styles.pwText} selectable>{password || '...'}</Text>
                </View>
                {strength && (
                    <View style={styles.strengthRow}>
                        <View style={styles.strengthTrack}>
                            <View style={[styles.strengthFill, { width: `${strength.score}%`, backgroundColor: strengthColor }]} />
                        </View>
                        <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strength.label} ({strength.score})</Text>
                    </View>
                )}

                <View style={styles.option}>
                    <Text style={styles.optionLabel}>長さ: {length}</Text>
                    <View style={styles.sliderRow}>
                        <Text style={styles.sliderMin}>8</Text>
                        <View style={styles.sliderWrapper}>
                            {/* Slider は @react-native-community/slider を使用。
                  fallback: 手動入力 */}
                            <TouchableOpacity onPress={() => setLength(Math.max(8, length - 1))}><Text style={styles.sliderBtn}>−</Text></TouchableOpacity>
                            <View style={styles.sliderTrack}>
                                <View style={[styles.sliderFill, { width: `${((length - 8) / 56) * 100}%` }]} />
                            </View>
                            <TouchableOpacity onPress={() => setLength(Math.min(64, length + 1))}><Text style={styles.sliderBtn}>＋</Text></TouchableOpacity>
                        </View>
                        <Text style={styles.sliderMax}>64</Text>
                    </View>
                </View>

                <ToggleOption label="大文字 (A-Z)" value={uppercase} onValueChange={setUppercase} />
                <ToggleOption label="小文字 (a-z)" value={lowercase} onValueChange={setLowercase} />
                <ToggleOption label="数字 (0-9)" value={numbers} onValueChange={setNumbers} />
                <ToggleOption label="記号 (!@#$%)" value={symbols} onValueChange={setSymbols} />

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.genBtn} onPress={generate}>
                        <Text style={styles.genBtnText}>🔄 再生成</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.copyBtn} onPress={copyPw}>
                        <Text style={styles.copyBtnText}>📋 コピー</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

function ToggleOption({ label, value, onValueChange }) {
    return (
        <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 16 },
    heading: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
    pwBox: {
        padding: 20, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius,
        borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', minHeight: 70,
        justifyContent: 'center',
    },
    pwText: { fontSize: 17, fontWeight: '700', color: theme.colors.accentLight, letterSpacing: 1, textAlign: 'center' },
    strengthRow: { marginTop: 8, marginBottom: 16 },
    strengthTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 12, marginTop: 3, textAlign: 'center' },
    option: { marginBottom: 8 },
    optionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textDim, marginBottom: 8 },
    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sliderMin: { fontSize: 12, color: theme.colors.textMuted },
    sliderMax: { fontSize: 12, color: theme.colors.textMuted },
    sliderWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    sliderBtn: { fontSize: 20, color: theme.colors.accentLight, paddingHorizontal: 8 },
    sliderTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
    sliderFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 3 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    toggleLabel: { fontSize: 15, color: theme.colors.text },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    genBtn: { flex: 1, padding: 16, borderRadius: theme.radiusSm, backgroundColor: theme.colors.accent, alignItems: 'center' },
    genBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    copyBtn: { flex: 1, padding: 16, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.accent, alignItems: 'center' },
    copyBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.accentLight },
});
