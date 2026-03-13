import http from "node:http";

export const DESKTOP_PASSKEY_BRIDGE_PORT = 46321;

function isAllowedOrigin(origin) {
  return origin === "" || (typeof origin === "string" && origin.startsWith("chrome-extension://"));
}

function privateNetworkHeaders(request) {
  const wantsPrivateNetwork = String(request?.headers?.["access-control-request-private-network"] || "").toLowerCase() === "true";
  return wantsPrivateNetwork ? { "access-control-allow-private-network": "true" } : {};
}

function writeJson(response, statusCode, payload, origin = "", extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(isAllowedOrigin(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    ...(extraHeaders || {})
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16_384) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });
    request.on("error", reject);
  });
}

function normalizeApprovalPayload(payload = {}) {
  return {
    kind: String(payload.kind || "").trim().toLowerCase(),
    rpId: String(payload.rpId || "").trim().toLowerCase(),
    origin: String(payload.origin || "").trim(),
    title: String(payload.title || "").trim().slice(0, 140),
    userName: String(payload.userName || "").trim().slice(0, 200)
  };
}

export class PasskeyApprovalBridge {
  constructor(options = {}) {
    this.port = Number(options.port) || DESKTOP_PASSKEY_BRIDGE_PORT;
    this.host = "127.0.0.1";
    this.server = null;
    this.onVerify = options.onVerify;
    this.getStatus = options.getStatus;
  }

  getUrl() {
    return `http://${this.host}:${this.port}`;
  }

  getStatusPayload() {
    const runtime = typeof this.getStatus === "function" ? this.getStatus() || {} : {};
    return {
      ok: true,
      running: Boolean(this.server?.listening),
      url: this.getUrl(),
      platform: String(runtime.platform || process.platform),
      approvalMode: String(runtime.approvalMode || "desktop-dialog"),
      touchIdSupported: Boolean(runtime.touchIdSupported),
      biometricSupported: Boolean(runtime.biometricSupported)
    };
  }

  async handleRequest(request, response) {
    const origin = String(request.headers.origin || "");

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) {
        writeJson(response, 403, { ok: false, error: "Origin is not allowed." }, origin, privateNetworkHeaders(request));
        return;
      }
      response.writeHead(204, {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        vary: "Origin",
        "cache-control": "no-store",
        ...privateNetworkHeaders(request)
      });
      response.end();
      return;
    }

    if (!isAllowedOrigin(origin)) {
      writeJson(response, 403, { ok: false, error: "Origin is not allowed." }, origin, privateNetworkHeaders(request));
      return;
    }

    if (request.method === "GET" && request.url === "/v1/passkey/status") {
      writeJson(response, 200, this.getStatusPayload(), origin, privateNetworkHeaders(request));
      return;
    }

    if (request.method === "POST" && request.url === "/v1/passkey/verify") {
      try {
        const payload = normalizeApprovalPayload(await readRequestBody(request));
        if (!payload.kind || !payload.rpId) {
          writeJson(response, 400, { ok: false, error: "kind と rpId は必須です。" }, origin, privateNetworkHeaders(request));
          return;
        }

        const result = await this.onVerify?.(payload);
        writeJson(response, 200, {
          ok: true,
          approved: Boolean(result?.approved),
          method: String(result?.method || ""),
          reason: String(result?.reason || "")
        }, origin, privateNetworkHeaders(request));
      } catch (error) {
        writeJson(response, 500, { ok: false, error: error?.message || "Approval bridge failed." }, origin, privateNetworkHeaders(request));
      }
      return;
    }

    writeJson(response, 404, { ok: false, error: "Not found." }, origin, privateNetworkHeaders(request));
  }

  async start() {
    if (this.server?.listening) {
      return this.getStatusPayload();
    }

    this.server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        writeJson(response, 500, { ok: false, error: error?.message || "Unhandled bridge error." }, String(request.headers.origin || ""));
      });
    });

    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    return this.getStatusPayload();
  }

  async stop() {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }
}
