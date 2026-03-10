/**
 * API Service — MobileVaultService HTTPサーバーとの通信層
 */
const DEFAULT_BASE = 'http://localhost:3200';

let baseUrl = DEFAULT_BASE;

export function setApiBase(url) {
    baseUrl = url;
}

export async function callApi(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unknown error');
    return data;
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
};
