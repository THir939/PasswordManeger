const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

export function isLocalDevelopmentHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return LOCAL_DEV_HOSTS.has(normalized) || normalized.endsWith(".localhost");
}

export function validateCloudBaseUrl(baseUrl, { allowEmpty = true } = {}) {
  const normalized = normalizeBaseUrl(baseUrl);

  if (!normalized) {
    if (allowEmpty) {
      return "";
    }
    throw new Error("クラウドAPIのURLを入力してください。");
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("クラウドAPIのURLは http:// または https:// から入力してください。");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("クラウドAPIのURLは http:// または https:// のみ対応しています。");
  }

  if (url.protocol === "http:" && !isLocalDevelopmentHost(url.hostname)) {
    throw new Error("クラウドAPIのURLは HTTPS を使ってください。HTTP は localhost 系の開発環境だけ許可します。");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname === "/" ? "" : pathname}`;
}

export function safeCloudBaseUrl(baseUrl) {
  try {
    return validateCloudBaseUrl(baseUrl);
  } catch {
    return "";
  }
}
