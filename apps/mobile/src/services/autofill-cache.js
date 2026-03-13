function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return "";
    }

    return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function normalizeDomain(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) {
        return "";
    }

    try {
        return new URL(normalizeUrl(raw)).hostname.toLowerCase();
    } catch {
        return raw
            .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
            .split("/")[0]
            .split("?")[0]
            .split("#")[0]
            .split(":")[0]
            .replace(/^\.+|\.+$/g, "");
    }
}

function buildAutofillRecord(item = {}) {
    const username = String(item.username || "").trim();
    const password = String(item.password || "");
    const url = normalizeUrl(item.url || "");
    const domain = normalizeDomain(url);

    if (item.type !== "login" || !password || !domain) {
        return null;
    }

    return {
        id: String(item.id || ""),
        title: String(item.title || domain).trim() || domain,
        username,
        password,
        url,
        domain,
        updatedAt: String(item.updatedAt || ""),
        favorite: Boolean(item.favorite)
    };
}

export function buildAutofillCachePayload(items = [], now = new Date()) {
    const records = [];

    for (const item of Array.isArray(items) ? items : []) {
        const record = buildAutofillRecord(item);
        if (record) {
            records.push(record);
        }
    }

    records.sort((left, right) => {
        if (left.favorite !== right.favorite) {
            return left.favorite ? -1 : 1;
        }
        return Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0);
    });

    return {
        version: 1,
        generatedAt: new Date(now).toISOString(),
        recordCount: records.length,
        records
    };
}
