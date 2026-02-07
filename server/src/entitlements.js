import crypto from "node:crypto";

export const FEATURE_CLOUD_SYNC = "cloud_sync";
export const SUPPORTED_FEATURES = [FEATURE_CLOUD_SYNC];

const ENTITLEMENT_ACCESS_STATUSES = new Set(["active", "trialing", "grace_period"]);
const ENTITLEMENT_STATUS_PRIORITY = {
  active: 60,
  trialing: 50,
  grace_period: 40,
  canceled: 30,
  expired: 20,
  revoked: 10,
  inactive: 0
};

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function normalizeFeature(feature) {
  const normalized = String(feature || FEATURE_CLOUD_SYNC)
    .trim()
    .toLowerCase();
  if (SUPPORTED_FEATURES.includes(normalized)) {
    return normalized;
  }
  return FEATURE_CLOUD_SYNC;
}

function normalizeSource(source) {
  const normalized = String(source || "unknown")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (normalized === "appstore") {
    return "apple";
  }
  if (normalized === "playstore") {
    return "google_play";
  }
  return normalized;
}

export function normalizeEntitlementStatus(status) {
  const normalized = String(status || "inactive")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "active":
      return "active";
    case "trial":
    case "trialing":
      return "trialing";
    case "grace":
    case "grace-period":
    case "grace_period":
    case "past_due":
      return "grace_period";
    case "cancelled":
    case "canceled":
      return "canceled";
    case "expired":
    case "incomplete_expired":
      return "expired";
    case "revoked":
      return "revoked";
    default:
      return "inactive";
  }
}

function entitlementSortScore(entitlement) {
  const priority = ENTITLEMENT_STATUS_PRIORITY[entitlement.status] ?? 0;
  const updated = Date.parse(entitlement.updatedAt || 0) || 0;
  return priority * 10_000_000_000_000 + updated;
}

function dedupeEntitlements(entitlements) {
  const map = new Map();
  for (const entitlement of entitlements) {
    const key = [
      entitlement.feature,
      entitlement.source,
      String(entitlement.sourceRef || "")
    ].join("::");
    const existing = map.get(key);
    if (!existing || entitlementSortScore(entitlement) >= entitlementSortScore(existing)) {
      map.set(key, entitlement);
    }
  }
  return [...map.values()];
}

export function mapStripeStatusToEntitlementStatus(stripeStatus) {
  const status = String(stripeStatus || "").trim().toLowerCase();
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "grace_period";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "inactive";
    case "incomplete":
      return "inactive";
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "inactive";
    default:
      return "inactive";
  }
}

export function normalizeEntitlement(input = {}) {
  const normalized = asObject(input);
  return {
    id: String(normalized.id || crypto.randomUUID()),
    feature: normalizeFeature(normalized.feature),
    source: normalizeSource(normalized.source),
    sourceRef: String(normalized.sourceRef || "").trim(),
    status: normalizeEntitlementStatus(normalized.status),
    startedAt: toIsoOrNull(normalized.startedAt),
    expiresAt: toIsoOrNull(normalized.expiresAt || normalized.currentPeriodEnd),
    updatedAt: toIsoOrNull(normalized.updatedAt) || new Date().toISOString(),
    metadata: asObject(normalized.metadata)
  };
}

export function isEntitlementActive(entitlement, now = Date.now()) {
  if (!ENTITLEMENT_ACCESS_STATUSES.has(entitlement.status)) {
    return false;
  }
  if (!entitlement.expiresAt) {
    return true;
  }
  const expiresAt = Date.parse(entitlement.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return expiresAt > now;
}

export function summarizeFeatureAccess(user, feature, now = Date.now()) {
  const targetFeature = normalizeFeature(feature);
  const entitlements = (Array.isArray(user?.entitlements) ? user.entitlements : [])
    .map(normalizeEntitlement)
    .filter((item) => item.feature === targetFeature)
    .sort((left, right) => entitlementSortScore(right) - entitlementSortScore(left));

  const activeEntitlements = entitlements.filter((item) => isEntitlementActive(item, now));
  const effective = activeEntitlements[0] || entitlements[0] || null;

  const activeSources = [...new Set(activeEntitlements.map((item) => item.source))];

  let currentPeriodEnd = null;
  if (activeEntitlements.some((item) => !item.expiresAt)) {
    currentPeriodEnd = null;
  } else {
    const timestamps = activeEntitlements
      .map((item) => Date.parse(item.expiresAt || ""))
      .filter((value) => Number.isFinite(value));
    if (timestamps.length > 0) {
      currentPeriodEnd = new Date(Math.max(...timestamps)).toISOString();
    }
  }

  return {
    feature: targetFeature,
    isActive: activeEntitlements.length > 0,
    effectiveStatus: effective?.status || "inactive",
    currentPeriodEnd,
    activeSources,
    entitlements
  };
}

export function summarizeUserEntitlements(user) {
  const cloudSync = summarizeFeatureAccess(user, FEATURE_CLOUD_SYNC);
  return {
    [FEATURE_CLOUD_SYNC]: cloudSync
  };
}

export function canUseFeature(user, feature) {
  return summarizeFeatureAccess(user, feature).isActive;
}

export function normalizeUserRecord(user = {}) {
  const base = asObject(user);
  const email = String(base.email || "").trim();
  const emailLower = String(base.emailLower || email).toLowerCase();

  const explicitEntitlements = (Array.isArray(base.entitlements) ? base.entitlements : []).map(normalizeEntitlement);

  const hasLegacyStripeState = Boolean(
    base.subscriptionId ||
      base.currentPeriodEnd ||
      base.stripeCustomerId ||
      normalizeEntitlementStatus(base.planStatus) !== "inactive"
  );

  if (explicitEntitlements.length === 0 && hasLegacyStripeState) {
    explicitEntitlements.push(
      normalizeEntitlement({
        feature: FEATURE_CLOUD_SYNC,
        source: "stripe",
        sourceRef: String(base.subscriptionId || "").trim(),
        status: mapStripeStatusToEntitlementStatus(base.planStatus),
        startedAt: base.createdAt || null,
        expiresAt: base.currentPeriodEnd || null,
        metadata: {
          migratedFromLegacyPlanStatus: true
        }
      })
    );
  }

  const entitlements = dedupeEntitlements(explicitEntitlements);
  const cloudSync = summarizeFeatureAccess({ entitlements }, FEATURE_CLOUD_SYNC);

  return {
    ...base,
    email,
    emailLower,
    entitlements,
    planStatus: cloudSync.effectiveStatus,
    currentPeriodEnd: cloudSync.currentPeriodEnd,
    stripeCustomerId: base.stripeCustomerId || null,
    subscriptionId: base.subscriptionId || null
  };
}
