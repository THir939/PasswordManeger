// Autofill risk scoring logic extracted to a pure module so it can be unit-tested.
// Note: This is a heuristic approach. A perfect "registrable domain" requires the Public Suffix List (PSL),
// but PSL adds size/maintenance cost. We implement a small multi-part TLD allowlist for better accuracy.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHost(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "").trim();
}

const MULTI_PART_TLDS = new Set([
  "ac.jp",
  "co.jp",
  "ne.jp",
  "or.jp",
  "go.jp",
  "co.uk",
  "ac.uk",
  "gov.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.cn",
  "com.tw",
  "co.kr",
  "com.sg",
  "com.tr"
]);

export function getRegistrableDomain(host) {
  const normalized = normalizeHost(host);
  const parts = normalized.split(".").filter(Boolean);

  if (parts.length <= 2) {
    return normalized;
  }

  const last2 = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return last2;
}

export function levenshteinDistance(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

export function extractDomain(rawUrl) {
  try {
    const hostname = new URL(String(rawUrl || "")).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildAutofillRisk(item, tabUrl, trust = {}) {
  const itemDomain = extractDomain(item?.url || "");
  const tabDomain = extractDomain(tabUrl || "");
  let protocol = "";

  try {
    protocol = new URL(tabUrl || "").protocol;
  } catch {
    protocol = "";
  }

  const reasons = [];
  let score = 0;

  if (!tabDomain) {
    score += 80;
    reasons.push("現在のタブURLを判定できません。");
  }

  if (protocol && protocol !== "https:") {
    score += 35;
    reasons.push("HTTPSではないページです。");
  }

  if (tabDomain.includes("xn--")) {
    score += 30;
    reasons.push("国際化ドメイン（Punycode）が含まれています。");
  }

  if (!itemDomain) {
    score += 30;
    reasons.push("保存データにURLがないため照合が弱いです。");
  } else if (tabDomain && itemDomain !== tabDomain) {
    if (tabDomain.endsWith(`.${itemDomain}`) || itemDomain.endsWith(`.${tabDomain}`)) {
      score += 25;
      reasons.push("サブドメイン差分があります。");
    } else {
      // Different registrable domain should be treated as high risk by default.
      score += 60;
      reasons.push("保存先URLと別ドメインです。");
    }

    const tabRoot = getRegistrableDomain(tabDomain);
    const itemRoot = getRegistrableDomain(itemDomain);
    const distance = levenshteinDistance(tabRoot, itemRoot);
    if (distance > 0 && distance <= 2) {
      score += 18;
      reasons.push("似たドメイン名です（フィッシングの可能性）。");
    }
  }

  const trustCount = Number(trust?.[item?.id]?.hosts?.[tabDomain]?.count || 0);
  if (tabDomain && trustCount === 0) {
    score += 12;
    reasons.push("このサイトへの初回自動入力です。");
  }
  if (trustCount >= 3) {
    score -= 10;
  }

  score = clamp(score, 0, 100);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  if (reasons.length === 0) {
    reasons.push("重大なリスク要因は検出されませんでした。");
  }

  return {
    score,
    level,
    reasons,
    tabDomain,
    itemDomain,
    trustCount,
    blockedByPolicy: level === "high"
  };
}

