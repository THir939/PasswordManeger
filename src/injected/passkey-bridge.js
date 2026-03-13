(function installPasskeyBridge() {
  if (window.__PM_PASSKEY_BRIDGE_INSTALLED__) {
    return;
  }
  window.__PM_PASSKEY_BRIDGE_INSTALLED__ = true;

  function toBase64Url(value) {
    if (!value) {
      return "";
    }

    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : null;

    if (!bytes) {
      return "";
    }

    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function serializeAllowCredentials(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries
      .map((entry) => ({
        type: String(entry?.type || ""),
        id: toBase64Url(entry?.id || null),
        transports: Array.isArray(entry?.transports) ? entry.transports.map((item) => String(item)) : []
      }))
      .filter((entry) => entry.id);
  }

  function serializeRequest(kind, options) {
    const publicKey = options?.publicKey || {};
    return {
      type: "PM_PASSKEY_REQUEST",
      payload: {
        kind,
        rpId: String(publicKey.rp?.id || publicKey.rpId || location.hostname || ""),
        challenge: toBase64Url(publicKey.challenge || null),
        origin: location.origin,
        url: location.href,
        title: document.title || location.hostname || "Passkey",
        requestDetailsJson: JSON.stringify({
          ...publicKey,
          challenge: toBase64Url(publicKey.challenge || null),
          user: publicKey.user
            ? {
              ...publicKey.user,
              id: toBase64Url(publicKey.user.id || null)
            }
            : undefined,
          excludeCredentials: serializeAllowCredentials(publicKey.excludeCredentials),
          allowCredentials: serializeAllowCredentials(publicKey.allowCredentials)
        })
      }
    };
  }

  function postPasskeyEvent(kind, options, credential) {
    if (!credential || credential.type !== "public-key") {
      return;
    }

    const publicKey = options?.publicKey || {};
    const response = credential.response || {};
    const payload = {
      type: "PM_PASSKEY_EVENT",
      payload: {
        event: kind,
        credentialId: String(credential.id || toBase64Url(credential.rawId)),
        rpId: String(publicKey.rp?.id || publicKey.rpId || location.hostname || ""),
        userName: String(publicKey.user?.name || ""),
        userDisplayName: String(publicKey.user?.displayName || ""),
        userHandle: toBase64Url(response.userHandle || publicKey.user?.id || null),
        origin: location.origin,
        url: location.href,
        title: document.title || location.hostname || "Passkey",
        authenticatorAttachment: String(credential.authenticatorAttachment || ""),
        transports: typeof response.getTransports === "function" ? response.getTransports() : [],
        residentKey: String(publicKey.residentKey || ""),
        userVerification: String(publicKey.userVerification || ""),
        allowCredentials: serializeAllowCredentials(publicKey.allowCredentials),
        source: "extension-passkey-monitor"
      }
    };

    window.postMessage(payload, "*");
  }

  function wrapCredentialsMethod(name) {
    const credentials = navigator.credentials;
    if (!credentials || typeof credentials[name] !== "function") {
      return;
    }

    const original = credentials[name].bind(credentials);

    credentials[name] = async function wrappedCredentials(options) {
      try {
        window.postMessage(serializeRequest(name, options), "*");
      } catch {
        // request capture must never break the page flow
      }

      const result = await original(options);
      try {
        postPasskeyEvent(name, options, result);
      } catch {
        // passkey monitoring must never break the page flow
      }
      return result;
    };
  }

  wrapCredentialsMethod("create");
  wrapCredentialsMethod("get");
})();
