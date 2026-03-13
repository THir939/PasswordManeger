export const DESKTOP_PASSKEY_BRIDGE_BASE_URL = "http://127.0.0.1:46321";

function withTimeout(timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 1200));
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeBaseUrl(baseUrl = "") {
  const value = String(baseUrl || DESKTOP_PASSKEY_BRIDGE_BASE_URL).trim();
  return value.replace(/\/+$/, "");
}

export async function getDesktopPasskeyBridgeStatus(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeout = withTimeout(options.timeoutMs || 1200);

  try {
    const response = await (options.fetchImpl || fetch)(`${baseUrl}/v1/passkey/status`, {
      method: "GET",
      signal: timeout.signal
    });
    const payload = await safeJson(response);

    if (!response.ok || payload?.ok === false) {
      return {
        available: false,
        baseUrl,
        reason: payload?.error || `Desktop bridge status failed (${response.status})`
      };
    }

    return {
      available: true,
      baseUrl,
      running: Boolean(payload.running),
      platform: String(payload.platform || ""),
      approvalMode: String(payload.approvalMode || ""),
      touchIdSupported: Boolean(payload.touchIdSupported),
      biometricSupported: Boolean(payload.biometricSupported),
      url: String(payload.url || `${baseUrl}/v1/passkey/status`)
    };
  } catch (error) {
    return {
      available: false,
      baseUrl,
      reason: error?.name === "AbortError" ? "Desktop bridge timeout" : error?.message || "Desktop bridge unavailable"
    };
  } finally {
    timeout.clear();
  }
}

export async function requestDesktopPasskeyApproval(payload = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeout = withTimeout(options.timeoutMs || 25_000);

  try {
    const response = await (options.fetchImpl || fetch)(`${baseUrl}/v1/passkey/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        kind: String(payload.kind || "").trim().toLowerCase(),
        rpId: String(payload.rpId || "").trim().toLowerCase(),
        origin: String(payload.origin || "").trim(),
        title: String(payload.title || "").trim().slice(0, 140),
        userName: String(payload.userName || "").trim().slice(0, 200)
      }),
      signal: timeout.signal
    });
    const body = await safeJson(response);

    if (!response.ok || body?.ok === false) {
      return {
        ok: false,
        available: false,
        baseUrl,
        reason: body?.error || `Desktop approval failed (${response.status})`
      };
    }

    return {
      ok: true,
      available: true,
      baseUrl,
      approved: Boolean(body.approved),
      method: String(body.method || ""),
      reason: String(body.reason || "")
    };
  } catch (error) {
    return {
      ok: false,
      available: false,
      baseUrl,
      reason: error?.name === "AbortError" ? "Desktop approval timeout" : error?.message || "Desktop approval unavailable"
    };
  } finally {
    timeout.clear();
  }
}
