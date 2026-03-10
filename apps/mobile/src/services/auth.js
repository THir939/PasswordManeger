/**
 * Auth Service — 生体認証 + セキュアストレージ
 *
 * 機能:
 * - Face ID / Touch ID / 指紋認証 による Vault 解錠
 * - SecureStore にマスターパスワードを暗号化保存（再入力不要）
 * - 生体認証の有効/無効トグル
 * - アプリ復帰時の自動ロック判定
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const MASTER_PW_KEY = 'pm_master_password';
const BIOMETRIC_ENABLED_KEY = 'pm_biometric_enabled';
const LAST_ACTIVE_KEY = 'pm_last_active';

/**
 * デバイスが生体認証をサポートしているか確認
 */
export async function isBiometricAvailable() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, type: 'none' };

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return { available: false, type: 'not_enrolled' };

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let type = 'biometric';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        type = 'face';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        type = 'fingerprint';
    }

    return { available: true, type };
}

/**
 * 生体認証でユーザーを認証
 */
export async function authenticateWithBiometrics(promptMessage = 'Vaultを解錠') {
    const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'キャンセル',
        disableDeviceFallback: false,
        fallbackLabel: 'パスコードを使用',
    });
    return result;
}

/**
 * SecureStore にマスターパスワードを保存
 */
export async function saveMasterPassword(password) {
    await SecureStore.setItemAsync(MASTER_PW_KEY, password, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}

/**
 * SecureStore からマスターパスワードを取得
 */
export async function getSavedMasterPassword() {
    return SecureStore.getItemAsync(MASTER_PW_KEY);
}

/**
 * 保存されたマスターパスワードを削除
 */
export async function clearMasterPassword() {
    try {
        await SecureStore.deleteItemAsync(MASTER_PW_KEY);
    } catch { }
}

/**
 * 生体認証が有効かどうかの設定を取得
 */
export async function isBiometricEnabled() {
    const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
}

/**
 * 生体認証の有効/無効を切り替え
 */
export async function setBiometricEnabled(enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) {
        await clearMasterPassword();
    }
}

/**
 * 最終アクティブ時刻を記録
 */
export async function recordLastActive() {
    await SecureStore.setItemAsync(LAST_ACTIVE_KEY, Date.now().toString());
}

/**
 * アプリ復帰時にロックが必要か判定
 * @param {number} autoLockMinutes - 自動ロック設定（分）
 */
export async function shouldAutoLock(autoLockMinutes = 5) {
    const last = await SecureStore.getItemAsync(LAST_ACTIVE_KEY);
    if (!last) return true;
    const elapsed = Date.now() - Number(last);
    return elapsed > autoLockMinutes * 60 * 1000;
}

/**
 * 生体認証で Vault を解錠するフロー
 * 1. 生体認証で本人確認
 * 2. SecureStore からマスターPWを取得
 * 3. API でVaultを解錠
 */
export async function biometricUnlock(unlockFn) {
    const bioEnabled = await isBiometricEnabled();
    if (!bioEnabled) return { success: false, reason: 'disabled' };

    const savedPw = await getSavedMasterPassword();
    if (!savedPw) return { success: false, reason: 'no_saved_password' };

    const authResult = await authenticateWithBiometrics();
    if (!authResult.success) return { success: false, reason: 'auth_failed' };

    try {
        await unlockFn(savedPw);
        return { success: true };
    } catch (err) {
        return { success: false, reason: 'unlock_failed', error: err.message };
    }
}
