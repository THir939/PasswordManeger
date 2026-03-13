const fs = require("node:fs");
const path = require("node:path");

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

function parseAssociatedDomains(input) {
    const values = Array.isArray(input)
        ? input
        : String(input || "").split(/[\n,]/);

    return [...new Set(values.map(normalizeDomainEntry).filter(Boolean))];
}

function buildAssociatedDomainEntitlements(domains = []) {
    const normalized = parseAssociatedDomains(domains);
    const entitlements = [];

    for (const domain of normalized) {
        entitlements.push(`webcredentials:${domain}`);
        entitlements.push(`applinks:${domain}`);
    }

    return [...new Set(entitlements)];
}

function getConfiguredAssociatedDomains(env = process.env) {
    return parseAssociatedDomains(
        env.EXPO_PUBLIC_PM_MOBILE_ASSOCIATED_DOMAINS ||
        env.PM_MOBILE_ASSOCIATED_DOMAINS ||
        ""
    );
}

function getReleaseReadinessSnapshot(env = process.env) {
    const associatedDomains = getConfiguredAssociatedDomains(env);
    const cloudBaseUrl = String(env.EXPO_PUBLIC_PM_CLOUD_BASE_URL || "").trim();
    const iosBundleIdentifier = baseConfig.ios?.bundleIdentifier || "com.antigravity.passwordmaneger";
    const androidPackage = baseConfig.android?.package || "com.antigravity.passwordmaneger";
    const appGroup = String(env.PM_MOBILE_APP_GROUP || `group.${iosBundleIdentifier}`).trim();

    return {
        associatedDomains,
        hasAssociatedDomains: associatedDomains.length > 0,
        cloudBaseUrl,
        hasCloudBaseUrl: Boolean(cloudBaseUrl),
        appGroup,
        iosExtensionBundleIdentifier: `${iosBundleIdentifier}.autofill`,
        androidAutofillService: `${androidPackage}.autofill.PasswordManegerAutofillService`,
        readyForNativeBuild: Boolean(cloudBaseUrl) && associatedDomains.length > 0
    };
}

const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "app.json"), "utf8")).expo;

module.exports = () => {
    const associatedDomains = getConfiguredAssociatedDomains(process.env);
    const readiness = getReleaseReadinessSnapshot(process.env);

    return {
        expo: {
            ...baseConfig,
            scheme: "passwordmaneger",
            plugins: [
                ...(baseConfig.plugins || []),
                [
                    "./plugins/with-passwordmaneger-native-autofill.cjs",
                    {
                        appGroup: readiness.appGroup,
                        iosExtensionBundleIdentifier: readiness.iosExtensionBundleIdentifier,
                    },
                ],
            ],
            extra: {
                ...(baseConfig.extra || {}),
                mobileReleaseReadiness: readiness
            },
            ios: {
                ...baseConfig.ios,
                associatedDomains: buildAssociatedDomainEntitlements(associatedDomains)
            }
        }
    };
};
