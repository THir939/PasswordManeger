import {
    getConfiguredAssociatedDomains,
    parseAssociatedDomains,
    getReleaseReadinessSnapshot
} from './autofill-config.js';

const AUTOFILL_ENABLED_KEY = 'pm_autofill_enabled';
const AUTOFILL_DOMAINS_KEY = 'pm_autofill_domains';

async function getStorage(storageImpl) {
    if (storageImpl) {
        return storageImpl;
    }
    const module = await import('expo-secure-store');
    return module;
}

async function getValue(storage, key) {
    try {
        return await storage.getItemAsync(key);
    } catch {
        return null;
    }
}

export async function loadAutofillSettings(options = {}) {
    const storage = await getStorage(options.storage);
    const defaults = getConfiguredAssociatedDomains(options.env);
    const [rawEnabled, rawDomains] = await Promise.all([
        getValue(storage, AUTOFILL_ENABLED_KEY),
        getValue(storage, AUTOFILL_DOMAINS_KEY)
    ]);

    const domains = rawDomains ? parseAssociatedDomains(rawDomains) : defaults;

    return {
        enabled: rawEnabled === null ? true : rawEnabled === 'true',
        domains,
        defaults,
        readiness: getReleaseReadinessSnapshot(options.env)
    };
}

export async function saveAutofillSettings(settings = {}, options = {}) {
    const storage = await getStorage(options.storage);
    const enabled = settings.enabled !== false;
    const domains = parseAssociatedDomains(settings.domains);

    await Promise.all([
        storage.setItemAsync(AUTOFILL_ENABLED_KEY, enabled ? 'true' : 'false'),
        storage.setItemAsync(AUTOFILL_DOMAINS_KEY, domains.join('\n'))
    ]);

    return {
        enabled,
        domains,
        defaults: getConfiguredAssociatedDomains(options.env),
        readiness: getReleaseReadinessSnapshot(options.env)
    };
}
