/**
 * ItemsScreen — アイテム一覧
 * 検索、種別フィルタ、お気に入り、ワンタップコピー
 */
import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { api } from '../services/api';

const TYPES = [
    { value: 'all', label: '全種別' },
    { value: 'login', label: '🔑 ログイン' },
    { value: 'passkey', label: '🗝️ パスキー' },
    { value: 'card', label: '💳 カード' },
    { value: 'identity', label: '👤 個人情報' },
    { value: 'note', label: '📝 ノート' },
];

function itemSubtitle(item) {
    if (item.type === 'passkey') {
        return item.passkey?.rpId || item.passkey?.userName || item.url || '';
    }
    if (item.type === 'identity') {
        return item.email || item.fullName || item.username || '';
    }
    if (item.type === 'card') {
        return item.cardHolder || item.cardExpiry || '';
    }
    return item.username || item.url || item.notes?.slice(0, 40) || '';
}

export default function ItemsScreen({ navigation }) {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [type, setType] = useState('all');
    const [favOnly, setFavOnly] = useState(false);
    const [typeMenuVisible, setTypeMenuVisible] = useState(false);

    const loadItems = useCallback(async () => {
        try {
            const data = await api.listItems({
                type, search, onlyFavorites: favOnly,
            });
            setItems(data.items || []);
        } catch (err) {
            Alert.alert('エラー', err.message);
        }
    }, [type, search, favOnly]);

    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [loadItems])
    );

    const copyToClipboard = async (text, label) => {
        try {
            await Clipboard.setStringAsync(text);
            Alert.alert('コピー完了', `${label}をコピーしました。`);
            // 20秒後にクリア
            setTimeout(async () => {
                try { await Clipboard.setStringAsync(''); } catch { }
            }, 20000);
        } catch {
            Alert.alert('エラー', 'コピーに失敗しました。');
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ItemDetail', { id: item.id })}
            onLongPress={() => {
                if (item.type === 'login' && item.password) {
                    copyToClipboard(item.password, 'パスワード');
                }
            }}
        >
            <View style={[styles.icon, { backgroundColor: (theme.typeColors[item.type] || '#666') + '20' }]}>
                <Text style={[styles.iconText, { color: theme.typeColors[item.type] || '#999' }]}>
                    {theme.typeIcons[item.type] || '🔑'}
                </Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                    {itemSubtitle(item)}
                </Text>
            </View>
            {item.favorite && <Text style={styles.fav}>★</Text>}
            {item.type === 'login' && item.username && (
                <TouchableOpacity
                    style={styles.quickCopy}
                    onPress={() => copyToClipboard(item.username, 'ユーザー名')}
                >
                    <Text style={styles.quickCopyText}>📋</Text>
                </TouchableOpacity>
            )}
            <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Search */}
            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="アイテムを検索..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={search}
                    onChangeText={(text) => { setSearch(text); }}
                    onEndEditing={loadItems}
                    returnKeyType="search"
                />
            </View>

            {/* Filters */}
            <View style={styles.filterBar}>
                <TouchableOpacity
                    style={styles.typeSelector}
                    onPress={() => setTypeMenuVisible(!typeMenuVisible)}
                >
                    <Text style={styles.typeSelectorText}>
                        {TYPES.find(t => t.value === type)?.label || '全種別'} ▼
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.favBtn, favOnly && styles.favBtnActive]}
                    onPress={() => setFavOnly(!favOnly)}
                >
                    <Text style={styles.favBtnText}>★のみ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddEdit')}>
                    <Text style={styles.addBtnText}>＋ 追加</Text>
                </TouchableOpacity>
            </View>

            {/* Type picker dropdown */}
            {typeMenuVisible && (
                <View style={styles.typePicker}>
                    {TYPES.map(t => (
                        <TouchableOpacity
                            key={t.value}
                            style={[styles.typeOption, type === t.value && styles.typeOptionActive]}
                            onPress={() => { setType(t.value); setTypeMenuVisible(false); }}
                        >
                            <Text style={[styles.typeOptionText, type === t.value && styles.typeOptionTextActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* List */}
            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyText}>アイテムがありません</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddEdit')}>
                            <Text style={styles.emptyBtnText}>最初のアイテムを追加</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: theme.colors.bgCard, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    searchIcon: { fontSize: 16, marginRight: 8, opacity: 0.5 },
    searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
    filterBar: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    typeSelector: {
        flex: 1, padding: 8, borderRadius: 8, backgroundColor: theme.colors.bgInput,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    typeSelectorText: { fontSize: 13, color: theme.colors.textDim },
    favBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
    favBtnActive: { borderColor: theme.colors.warn, backgroundColor: theme.colors.warn + '20' },
    favBtnText: { fontSize: 13, color: theme.colors.textDim },
    addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.colors.accent },
    addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    typePicker: {
        backgroundColor: theme.colors.bgCard, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
        paddingHorizontal: 16, paddingVertical: 4,
    },
    typeOption: { padding: 10, borderRadius: 8 },
    typeOptionActive: { backgroundColor: theme.colors.accentGlow },
    typeOptionText: { fontSize: 14, color: theme.colors.textDim },
    typeOptionTextActive: { color: theme.colors.accentLight, fontWeight: '600' },
    row: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12,
    },
    icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 18 },
    info: { flex: 1 },
    title: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
    sub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
    fav: { fontSize: 14, color: theme.colors.warn },
    quickCopy: { padding: 6 },
    quickCopyText: { fontSize: 16 },
    arrow: { fontSize: 18, color: theme.colors.textMuted },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', padding: 48 },
    emptyIcon: { fontSize: 48, opacity: 0.4, marginBottom: 12 },
    emptyText: { fontSize: 16, color: theme.colors.textDim, marginBottom: 16 },
    emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.accent },
    emptyBtnText: { color: theme.colors.accentLight, fontWeight: '600' },
});
