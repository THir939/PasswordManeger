/**
 * SecurityScreen — セキュリティ診断
 * パスワード強度・使いまわし・2FA率のビジュアルレポート
 */
import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { api } from '../services/api';

export default function SecurityScreen() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getSecurityReport();
            setReport(data.report);
        } catch (err) {
            Alert.alert('エラー', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadReport(); }, [loadReport]));

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.loadingText}>診断中...</Text>
            </SafeAreaView>
        );
    }

    if (!report) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.loadingText}>レポートを取得できませんでした。</Text>
            </SafeAreaView>
        );
    }

    const scoreColor = report.score >= 80 ? theme.colors.success
        : report.score >= 50 ? theme.colors.warn : theme.colors.danger;
    const t = report.totals;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.heading}>🛡️ セキュリティ診断</Text>

                {/* Score */}
                <View style={styles.scoreCard}>
                    <Text style={[styles.scoreValue, { color: scoreColor }]}>{report.score}</Text>
                    <Text style={styles.scoreLabel}>セキュリティスコア / 100</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <StatCard label="ログイン" value={t.allLogins} color={theme.colors.text} />
                    <StatCard label="弱いPW" value={t.weak} color={t.weak ? theme.colors.danger : theme.colors.success} />
                    <StatCard label="使い回し" value={t.reusedGroups} color={t.reusedGroups ? theme.colors.danger : theme.colors.success} />
                    <StatCard label="2FA率" value={`${t.twoFactorCoverage}%`} color={t.twoFactorCoverage >= 50 ? theme.colors.success : theme.colors.warn} />
                </View>

                {/* Coach Tips */}
                {report.coach?.length > 0 && (
                    <View style={styles.coachSection}>
                        <Text style={styles.coachTitle}>改善の提案</Text>
                        {report.coach.map((c, i) => (
                            <View key={i} style={styles.coachItem}>
                                <Text style={styles.coachPriority}>{c.priorityLabel} · {c.affectedCount}件</Text>
                                <Text style={styles.coachItemTitle}>{c.title}</Text>
                                <Text style={styles.coachDesc}>{c.description}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.refreshBtn} onPress={loadReport}>
                    <Text style={styles.refreshBtnText}>🔄 再診断</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({ label, value, color }) {
    return (
        <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    loadingText: { color: theme.colors.textDim, textAlign: 'center', marginTop: 48 },
    scrollContent: { padding: 16, paddingBottom: 80 },
    heading: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
    scoreCard: {
        padding: 24, backgroundColor: theme.colors.bgCard, borderRadius: theme.radius,
        borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', marginBottom: 12,
    },
    scoreValue: { fontSize: 56, fontWeight: '800' },
    scoreLabel: { fontSize: 14, color: theme.colors.textDim, marginTop: 4 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    statCard: {
        width: '48%', padding: 12, backgroundColor: theme.colors.bgCard, borderRadius: theme.radiusSm,
        borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: theme.colors.textDim, marginTop: 2 },
    coachSection: { marginBottom: 16 },
    coachTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
    coachItem: {
        padding: 14, marginBottom: 8, backgroundColor: theme.colors.bgCard,
        borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.colors.border,
        borderLeftWidth: 3, borderLeftColor: theme.colors.accent,
    },
    coachPriority: { fontSize: 12, fontWeight: '700', color: theme.colors.accent, marginBottom: 4 },
    coachItemTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    coachDesc: { fontSize: 13, color: theme.colors.textDim, lineHeight: 20 },
    refreshBtn: { padding: 16, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.colors.accent, alignItems: 'center' },
    refreshBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.accentLight },
});
