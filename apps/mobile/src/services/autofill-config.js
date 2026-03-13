function normalizeDomainEntry(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) {
        return "";
    }

    const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const withoutPath = withoutScheme.split("/")[0];
    const withoutQuery = withoutPath.split("?")[0];
    const withoutHash = withoutQuery.split("#")[0];
    const withoutPort = withoutHash.split(":")[0];
    return withoutPort.replace(/^\.+|\.+$/g, "");
}

export function parseAssociatedDomains(input) {
    const values = Array.isArray(input)
        ? input
        : String(input || "").split(/[\n,]/);

    return [...new Set(values.map(normalizeDomainEntry).filter(Boolean))];
}

export function buildAssociatedDomainEntitlements(domains = []) {
    const normalized = parseAssociatedDomains(domains);
    const entitlements = [];

    for (const domain of normalized) {
        entitlements.push(`webcredentials:${domain}`);
        entitlements.push(`applinks:${domain}`);
    }

    return [...new Set(entitlements)];
}

export function getConfiguredAssociatedDomains(env = process.env) {
    return parseAssociatedDomains(
        env.EXPO_PUBLIC_PM_MOBILE_ASSOCIATED_DOMAINS ||
        env.PM_MOBILE_ASSOCIATED_DOMAINS ||
        ""
    );
}

export function getReleaseReadinessSnapshot(env = process.env) {
    const associatedDomains = getConfiguredAssociatedDomains(env);
    const cloudBaseUrl = String(env.EXPO_PUBLIC_PM_CLOUD_BASE_URL || "").trim();

    return {
        associatedDomains,
        hasAssociatedDomains: associatedDomains.length > 0,
        cloudBaseUrl,
        hasCloudBaseUrl: Boolean(cloudBaseUrl),
        readyForNativeBuild: Boolean(cloudBaseUrl) && associatedDomains.length > 0
    };
}
