/**
 * API Service — MobileVaultService HTTPサーバーとの通信層
 */
import { Platform } from "react-native";

const DEFAULT_BASE = 'http://localhost:3200';

let baseUrl = DEFAULT_BASE;
let localApiPromise = null;

export function setApiBase(url) {
    baseUrl = url;
}

async function callBridgeApi(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unknown error');
    return data;
}

async function callDeviceLocalApi(action, payload = {}) {
    if (!localApiPromise) {
        localApiPromise = import('./mobile-local-api.js').then((mod) => mod.callLocalApi);
    }

    const callLocalApi = await localApiPromise;
    return {
        ok: true,
        ...(await callLocalApi(action, payload))
    };
}

export async function callApi(action, payload = {}) {
    if (Platform.OS !== 'web') {
        return callDeviceLocalApi(action, payload);
    }

    return callBridgeApi(action, payload);
}

// ===== Vault Actions =====
export const api = {
    getState: () => callApi('getState'),
    setupVault: (masterPassword) => callApi('setupVault', { masterPassword }),
    unlockVault: (masterPassword) => callApi('unlockVault', { masterPassword }),
    lockVault: () => callApi('lockVault'),
    listItems: (filters = {}) => callApi('listItems', { filters }),
    getItem: (id) => callApi('getItem', { id }),
    saveItem: (item) => callApi('saveItem', { item }),
    deleteItem: (id) => callApi('deleteItem', { id }),
    generatePassword: (options = {}) => callApi('generatePassword', { options }),
    generateTotp: (secret) => callApi('generateTotp', { secret }),
    getSecurityReport: () => callApi('getSecurityReport'),
    passwordStrength: (password) => callApi('passwordStrength', { password }),
    getSettings: () => callApi('getSettings'),
    saveSettings: (settings) => callApi('saveSettings', { settings }),
    changeMasterPassword: (oldPassword, newPassword) =>
        callApi('changeMasterPassword', { oldPassword, newPassword }),
    getTags: () => callApi('getTags'),
    listAutofillItems: (domain) => callApi('listAutofillItems', { domain }),
    exportVaultEnvelope: () => callApi('exportVaultEnvelope'),
    importVaultEnvelope: (envelope) => callApi('importVaultEnvelope', { envelope }),
};
