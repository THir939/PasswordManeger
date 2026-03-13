import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { api } from "./api";
import { loadAutofillSettings } from "./autofill";
import { buildAutofillCachePayload } from "./autofill-cache.js";

const AUTOFILL_DIRECTORY = "passwordmaneger";
const AUTOFILL_CACHE_FILENAME = "autofill-cache.json";

function getDocumentDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("端末ストレージを利用できません。");
    }
    return FileSystem.documentDirectory;
}

function getAutofillDirectoryUri() {
    return `${getDocumentDirectory()}${AUTOFILL_DIRECTORY}/`;
}

export function getAutofillCacheUri() {
    return `${getAutofillDirectoryUri()}${AUTOFILL_CACHE_FILENAME}`;
}

export async function clearAutofillSessionCache() {
    if (Platform.OS === "web") {
        return { cleared: true, skipped: true };
    }

    try {
        await FileSystem.deleteAsync(getAutofillCacheUri(), { idempotent: true });
    } catch {
        // already removed
    }

    return { cleared: true };
}

export async function refreshAutofillSessionCache(options = {}) {
    if (Platform.OS === "web") {
        return { written: false, skipped: true };
    }

    const settings = await loadAutofillSettings();
    if (!settings.enabled) {
        await clearAutofillSessionCache();
        return { written: false, disabled: true };
    }

    const items = Array.isArray(options.items)
        ? options.items
        : (await api.listItems({ type: "all" })).items || [];
    const payload = buildAutofillCachePayload(items);

    await FileSystem.makeDirectoryAsync(getAutofillDirectoryUri(), { intermediates: true });
    await FileSystem.writeAsStringAsync(
        getAutofillCacheUri(),
        JSON.stringify(payload, null, 2)
    );

    return {
        written: true,
        recordCount: payload.recordCount,
        generatedAt: payload.generatedAt
    };
}
