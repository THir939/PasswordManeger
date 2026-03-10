/**
 * PasswordManeger Mobile — App Entry Point
 *
 * React Navigation with Bottom Tabs + Native Stack.
 * アプリ復帰時の自動ロック + 生体認証対応。
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from './src/theme';
import { api } from './src/services/api';
import { shouldAutoLock, recordLastActive } from './src/services/auth';

import SetupScreen from './src/screens/SetupScreen';
import UnlockScreen from './src/screens/UnlockScreen';
import ItemsScreen from './src/screens/ItemsScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import AddEditScreen from './src/screens/AddEditScreen';
import GeneratorScreen from './src/screens/GeneratorScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
    ...DefaultTheme,
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.accent,
        background: theme.colors.bg,
        card: theme.colors.bg,
        text: theme.colors.text,
        border: theme.colors.border,
    },
};

function ItemsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ItemsList" component={ItemsScreen} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
            <Stack.Screen name="AddEdit" component={AddEditScreen} />
        </Stack.Navigator>
    );
}

function MainTabs({ onLock }) {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: 'rgba(15,15,26,0.95)',
                    borderTopColor: theme.colors.border,
                    height: 64,
                    paddingBottom: 8,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: theme.colors.accentLight,
                tabBarInactiveTintColor: theme.colors.textMuted,
                tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="一覧" component={ItemsStack}
                options={{ tabBarIcon: () => null, tabBarLabel: '📋 一覧' }} />
            <Tab.Screen name="追加" component={AddEditScreen}
                options={{ tabBarIcon: () => null, tabBarLabel: '➕ 追加' }} />
            <Tab.Screen name="生成" component={GeneratorScreen}
                options={{ tabBarIcon: () => null, tabBarLabel: '🔑 生成' }} />
            <Tab.Screen name="診断" component={SecurityScreen}
                options={{ tabBarIcon: () => null, tabBarLabel: '🛡️ 診断' }} />
            <Tab.Screen name="課金" component={PurchaseScreen}
                options={{ tabBarIcon: () => null, tabBarLabel: '💎 課金' }} />
            <Tab.Screen name="設定"
                options={{ tabBarIcon: () => null, tabBarLabel: '⚙️ 設定' }}>
                {(props) => <SettingsScreen {...props} onLock={onLock} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

export default function App() {
    const [screen, setScreen] = useState('loading'); // loading, setup, unlock, main
    const appState = useRef(AppState.currentState);

    const checkState = useCallback(async () => {
        try {
            const state = await api.getState();
            if (!state.initialized) setScreen('setup');
            else if (!state.unlocked) setScreen('unlock');
            else setScreen('main');
        } catch {
            setScreen('setup');
        }
    }, []);

    useEffect(() => {
        checkState();
    }, [checkState]);

    // アプリ復帰時の自動ロック
    useEffect(() => {
        const sub = AppState.addEventListener('change', async (nextState) => {
            if (appState.current === 'active' && nextState.match(/inactive|background/)) {
                await recordLastActive();
            }
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                if (screen === 'main') {
                    const needsLock = await shouldAutoLock(5);
                    if (needsLock) {
                        try { await api.lockVault(); } catch { }
                        setScreen('unlock');
                    }
                }
            }
            appState.current = nextState;
        });
        return () => sub.remove();
    }, [screen]);

    const handleSetupComplete = () => setScreen('main');
    const handleUnlockComplete = () => setScreen('main');
    const handleLock = async () => {
        try { await api.lockVault(); } catch { }
        setScreen('unlock');
    };

    let content;
    if (screen === 'loading') {
        content = null;
    } else if (screen === 'setup') {
        content = <SetupScreen onComplete={handleSetupComplete} />;
    } else if (screen === 'unlock') {
        content = <UnlockScreen onComplete={handleUnlockComplete} />;
    } else {
        content = <MainTabs onLock={handleLock} />;
    }

    return (
        <SafeAreaProvider>
            <NavigationContainer theme={navTheme}>
                <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
                {content}
            </NavigationContainer>
        </SafeAreaProvider>
    );
}
