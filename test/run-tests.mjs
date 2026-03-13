import assert from "node:assert/strict";
import { createVaultEnvelope, unlockVaultEnvelope } from "@pm/core/crypto";
import { generatePassword, passwordStrength } from "@pm/core/password";
import { generateTotp } from "@pm/core/totp";
import { buildSecurityReport } from "@pm/core/security-audit";
import { parseExternalItems } from "@pm/core/migration";
import { buildAutofillRisk } from "@pm/core/autofill-risk";
import { validateCloudBaseUrl } from "@pm/core/cloud-url";
import {
  normalizePasskeyRecord,
  buildPasskeyFingerprint,
  shortenCredentialId
} from "@pm/core/passkey";
import {
  FEATURE_CLOUD_SYNC,
  mapStripeStatusToEntitlementStatus,
  summarizeFeatureAccess
} from "../server/src/entitlements.js";
import {
  DESKTOP_PASSKEY_BRIDGE_BASE_URL,
  getDesktopPasskeyBridgeStatus,
  requestDesktopPasskeyApproval
} from "../src/lib/desktop-passkey-client.js";
import { PasskeyApprovalBridge } from "../apps/desktop/src/passkey-approval-bridge.js";
import {
  checkWindowsHelloAvailability,
  nativeWindowHandleToInteger,
  requestWindowsHelloVerification
} from "../apps/desktop/src/windows-hello.js";
import {
  clearCloudSession,
  fetchCloudBillingStatus,
  loadCloudSession,
  loginCloudAccount,
  pullCloudVaultSnapshot,
  pushCloudVaultSnapshot,
  registerCloudAccount,
  saveCloudSession
} from "../apps/mobile/src/services/cloud-auth.js";
import {
  buildAssociatedDomainEntitlements,
  getReleaseReadinessSnapshot,
  parseAssociatedDomains
} from "../apps/mobile/src/services/autofill-config.js";
import {
  loadAutofillSettings,
  saveAutofillSettings
} from "../apps/mobile/src/services/autofill.js";
import { buildAutofillCachePayload } from "../apps/mobile/src/services/autofill-cache.js";
import { MobileVaultCore } from "../apps/mobile/src/services/mobile-vault-core.js";
import { startTempServer } from "./e2e-helpers.mjs";
import { MobileVaultService } from "../apps/mobile/src/mobile-vault-service.js";

async function run(name, testFn) {
  try {
    await testFn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await run("crypto round-trip", async () => {
  const vault = { items: [{ id: "1", title: "GitHub", type: "login", password: "Abcd1234!!" }] };
  const envelope = await createVaultEnvelope(vault, "master-password-123");
  const unlocked = await unlockVaultEnvelope(envelope, "master-password-123");
  assert.equal(unlocked.vault.items[0].title, "GitHub");
});

await run("crypto wrong password fails", async () => {
  const vault = { items: [{ id: "1", title: "A", type: "login", password: "abc" }] };
  const envelope = await createVaultEnvelope(vault, "correct-password");
  await assert.rejects(() => unlockVaultEnvelope(envelope, "wrong-password"));
});

await run("password generator length", () => {
  const password = generatePassword({ length: 32, symbols: true });
  assert.equal(password.length, 32);
});

await run("password strength flags weak pattern", () => {
  const result = passwordStrength("password123");
  assert.equal(result.score <= 55, true);
  assert.equal(["weak", "very-weak"].includes(result.complexity), true);
});

await run("password strength rates complex password high", () => {
  const result = passwordStrength("N7!qL2@vR9#xT4$kP8&m");
  assert.equal(result.score >= 75, true);
  assert.equal(["strong", "very-strong"].includes(result.complexity), true);
});

await run("totp known vector", async () => {
  const result = await generateTotp(
    "otpauth://totp/Example:test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8&period=30",
    59000
  );
  assert.equal(result.code, "94287082");
});

await run("security report basics", () => {
  const report = buildSecurityReport([
    {
      id: "1",
      type: "login",
      title: "Site A",
      password: "password",
      updatedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z"
    },
    {
      id: "2",
      type: "login",
      title: "Site B",
      password: "password",
      updatedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z"
    }
  ]);

  assert.equal(report.totals.reusedGroups, 1);
  assert.equal(report.totals.weak > 0, true);
  assert.equal(Array.isArray(report.coach), true);
  assert.equal(report.coach.length > 0, true);
  assert.equal(report.coach[0].priority <= report.coach[report.coach.length - 1].priority, true);
});

await run("migration bitwarden csv", () => {
  const csv = [
    "folder,favorite,type,name,notes,login_uri,login_username,login_password,login_totp",
    "work,1,login,GitHub,main account,https://github.com,alice,Secret123!,JBSWY3DPEHPK3PXP"
  ].join("\n");

  const result = parseExternalItems({
    provider: "auto",
    rawText: csv,
    filename: "bitwarden.csv"
  });

  assert.equal(result.sourceProvider, "bitwarden");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "GitHub");
  assert.equal(result.items[0].username, "alice");
});

await run("migration generic json array", () => {
  const json = JSON.stringify([
    {
      title: "Example",
      username: "bob@example.com",
      password: "pass123",
      url: "https://example.com"
    }
  ]);

  const result = parseExternalItems({
    provider: "auto",
    rawText: json,
    filename: "export.json"
  });

  assert.equal(result.format, "json");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Example");
});

await run("migration lastpass csv", () => {
  const csv = [
    "url,username,password,totp,extra,name,grouping,fav",
    "https://news.ycombinator.com,dev_user,Pass!234,,hacker news account,Hacker News,work,1"
  ].join("\n");

  const result = parseExternalItems({
    provider: "auto",
    rawText: csv,
    filename: "lastpass.csv"
  });

  assert.equal(result.sourceProvider, "lastpass");
  assert.equal(result.items[0].title, "Hacker News");
  assert.equal(result.items[0].favorite, true);
});

await run("entitlement summary unifies multi-source purchase", () => {
  const summary = summarizeFeatureAccess(
    {
      entitlements: [
        {
          feature: FEATURE_CLOUD_SYNC,
          source: "stripe",
          sourceRef: "sub_1",
          status: "canceled",
          expiresAt: "2025-01-01T00:00:00.000Z"
        },
        {
          feature: FEATURE_CLOUD_SYNC,
          source: "apple",
          sourceRef: "tx_9",
          status: "active",
          expiresAt: "2030-01-01T00:00:00.000Z"
        }
      ]
    },
    FEATURE_CLOUD_SYNC
  );

  assert.equal(summary.isActive, true);
  assert.equal(summary.effectiveStatus, "active");
  assert.equal(summary.activeSources.includes("apple"), true);
});

await run("stripe status mapping", () => {
  assert.equal(mapStripeStatusToEntitlementStatus("active"), "active");
  assert.equal(mapStripeStatusToEntitlementStatus("trialing"), "trialing");
  assert.equal(mapStripeStatusToEntitlementStatus("past_due"), "grace_period");
  assert.equal(mapStripeStatusToEntitlementStatus("incomplete_expired"), "expired");
  assert.equal(mapStripeStatusToEntitlementStatus("unpaid"), "inactive");
});

await run("autofill risk low on same-domain https", () => {
  const risk = buildAutofillRisk(
    { id: "1", url: "https://example.com/login" },
    "https://example.com/signin",
    {}
  );

  assert.equal(risk.level, "low");
  assert.equal(risk.blockedByPolicy, false);
});

await run("autofill risk high on different domain", () => {
  const risk = buildAutofillRisk(
    { id: "1", url: "https://example.com/login" },
    "https://evil.com/login",
    {}
  );

  assert.equal(risk.level, "high");
  assert.equal(risk.blockedByPolicy, true);
});

await run("cloud url allows localhost over http", () => {
  const url = validateCloudBaseUrl("http://localhost:8787/api");
  assert.equal(url, "http://localhost:8787/api");
});

await run("cloud url rejects remote http", () => {
  assert.throws(() => validateCloudBaseUrl("http://example.com"), /HTTPS/);
});

await run("cloud url normalizes https", () => {
  const url = validateCloudBaseUrl("https://example.com/");
  assert.equal(url, "https://example.com");
});

await run("passkey helpers normalize and fingerprint", () => {
  const record = normalizePasskeyRecord({
    rpId: "GitHub.com",
    credentialId: "credential-1234567890",
    transports: ["internal", "usb", "ignored"],
    authenticatorAttachment: "platform"
  });

  assert.equal(record.rpId, "github.com");
  assert.deepEqual(record.transports, ["internal", "usb"]);
  assert.equal(buildPasskeyFingerprint(record), "github.com|credential-1234567890");
});

await run("passkey helper shortens credential id", () => {
  assert.equal(shortenCredentialId("12345678901234567890abcdef"), "1234567890…90abcdef");
});

await run("email alias domain-based generation", async () => {
  const { generateDomainAlias, generateRandomAlias } = await import("@pm/core/email-alias");
  const alias = generateDomainAlias("user@gmail.com", "amazon.co.jp");
  assert.equal(alias.startsWith("user+amazon.co.jp_"), true);
  assert.equal(alias.endsWith("@gmail.com"), true);
  assert.equal(alias.length > "user+amazon.co.jp_@gmail.com".length, true);
});

await run("email alias random generation", async () => {
  const { generateRandomAlias } = await import("@pm/core/email-alias");
  const alias = generateRandomAlias("test@example.com");
  assert.equal(alias.startsWith("test+"), true);
  assert.equal(alias.endsWith("@example.com"), true);
  // random part should be 8 chars
  const tag = alias.split("+")[1].split("@")[0];
  assert.equal(tag.length, 8);
});

await run("email alias throws on invalid email", async () => {
  const { generateDomainAlias } = await import("@pm/core/email-alias");
  assert.throws(() => generateDomainAlias("not-an-email", "example.com"));
});

await run("audit log write and query", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { AuditLogger } = await import("@pm/core/audit-log");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-test-"));
  const logger = new AuditLogger(path.join(tmpDir, "test.jsonl"));

  await logger.log("saveItem", "mcp", { itemId: "123" }, "session-1");
  await logger.log("deleteItem", "desktop", { itemId: "456" }, "session-2");
  await logger.log("saveItem", "mcp", { itemId: "789" }, "session-1");

  const all = await logger.query();
  assert.equal(all.length, 3);

  const saveOnly = await logger.query({ action: "saveItem" });
  assert.equal(saveOnly.length, 2);

  const mcpOnly = await logger.query({ actor: "mcp" });
  assert.equal(mcpOnly.length, 2);

  const limited = await logger.query({ limit: 1 });
  assert.equal(limited.length, 1);

  await logger.clear();
  const empty = await logger.query();
  assert.equal(empty.length, 0);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

await run("desktop passkey bridge status and approval", async () => {
  const bridge = new PasskeyApprovalBridge({
    onVerify: async (payload) => ({
      approved: payload.kind === "create",
      method: "mock-approve",
      reason: payload.kind === "create" ? "approved" : "rejected"
    }),
    getStatus: () => ({
      platform: process.platform,
      approvalMode: "mock-approve",
      touchIdSupported: false,
      biometricSupported: false
    })
  });

  try {
    await bridge.start();

    const status = await getDesktopPasskeyBridgeStatus({
      baseUrl: DESKTOP_PASSKEY_BRIDGE_BASE_URL,
      fetchImpl: (url, options = {}) => fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Origin: "chrome-extension://test-extension-id"
        }
      })
    });
    assert.equal(status.available, true);
    assert.equal(status.approvalMode, "mock-approve");

    const approval = await requestDesktopPasskeyApproval({
      kind: "create",
      rpId: "example.com",
      origin: "https://example.com",
      title: "Example",
      userName: "alice"
    }, {
      baseUrl: DESKTOP_PASSKEY_BRIDGE_BASE_URL,
      fetchImpl: (url, options = {}) => fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Origin: "chrome-extension://test-extension-id"
        }
      })
    });

    assert.equal(approval.ok, true);
    assert.equal(approval.approved, true);
    assert.equal(approval.method, "mock-approve");
  } finally {
    await bridge.stop();
  }
});

await run("desktop passkey bridge answers private-network preflight", async () => {
  const bridge = new PasskeyApprovalBridge();

  try {
    await bridge.start();

    const http = await import("node:http");
    const response = await new Promise((resolve, reject) => {
      const request = http.request(`${DESKTOP_PASSKEY_BRIDGE_BASE_URL}/v1/passkey/verify`, {
        method: "OPTIONS",
        headers: {
          Origin: "chrome-extension://test-extension-id",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
          "Access-Control-Request-Private-Network": "true"
        }
      }, (res) => resolve(res));
      request.once("error", reject);
      request.end();
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "chrome-extension://test-extension-id");
    assert.equal(response.headers["access-control-allow-private-network"], "true");
  } finally {
    await bridge.stop();
  }
});

await run("windows hello helper parses availability and verify payload", async () => {
  const mockRunner = async (_command, args) => {
    const action = args[6];
    if (action === "check") {
      return {
        stdout: JSON.stringify({
          ok: true,
          available: true,
          availability: "Available"
        })
      };
    }

    return {
      stdout: JSON.stringify({
        ok: true,
        available: true,
        availability: "Available",
        approved: true,
        result: "Verified",
        method: "windows-hello-hwnd"
      })
    };
  };

  const availability = await checkWindowsHelloAvailability({
    platform: "win32",
    runner: mockRunner
  });
  assert.equal(availability.ok, true);
  assert.equal(availability.available, true);
  assert.equal(availability.availability, "Available");

  const verification = await requestWindowsHelloVerification({
    platform: "win32",
    runner: mockRunner,
    message: "本人確認",
    windowHandle: 12345
  });
  assert.equal(verification.ok, true);
  assert.equal(verification.approved, true);
  assert.equal(verification.method, "windows-hello-hwnd");
});

await run("windows hello helper decodes native window handle", () => {
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(12345n, 0);
  assert.equal(nativeWindowHandleToInteger(handle), 12345);
});

await run("mobile cloud auth service round-trip", async () => {
  const storageMap = new Map();
  const storage = {
    async getItemAsync(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    async setItemAsync(key, value) {
      storageMap.set(key, String(value));
    },
    async deleteItemAsync(key) {
      storageMap.delete(key);
    }
  };

  const server = await startTempServer({ label: "mobile-cloud-auth" });

  try {
    const baseUrl = `${server.baseUrl}/`;
    const email = `mobile-cloud-${Date.now()}@example.com`;
    const password = "MobileCloud12345!";

    const registered = await registerCloudAccount(
      {
        baseUrl,
        email,
        password
      },
      { fetchImpl: fetch }
    );

    assert.ok(registered.token);
    assert.equal(registered.user?.email, email);

    const saved = await saveCloudSession(
      {
        baseUrl,
        token: registered.token,
        email,
        revision: 3,
        lastSyncAt: "2026-03-13T00:00:00.000Z"
      },
      { storage }
    );

    assert.equal(saved.baseUrl, server.baseUrl);
    assert.equal(saved.revision, 3);

    const loaded = await loadCloudSession({ storage });
    assert.equal(loaded.baseUrl, server.baseUrl);
    assert.equal(loaded.token, registered.token);
    assert.equal(loaded.email, email);
    assert.equal(loaded.revision, 3);
    assert.equal(loaded.lastSyncAt, "2026-03-13T00:00:00.000Z");

    const billing = await fetchCloudBillingStatus(
      {
        baseUrl: loaded.baseUrl,
        token: loaded.token
      },
      { fetchImpl: fetch }
    );
    assert.equal(billing.ok, true);
    assert.equal(billing.isPaid, false);

    const loggedIn = await loginCloudAccount(
      {
        baseUrl: loaded.baseUrl,
        email,
        password
      },
      { fetchImpl: fetch }
    );
    assert.ok(loggedIn.token);

    await clearCloudSession({ storage });
    const cleared = await loadCloudSession({ storage });
    assert.equal(cleared.baseUrl, "");
    assert.equal(cleared.token, "");
    assert.equal(cleared.email, "");
  } finally {
    await server.stop();
  }
});

await run("mobile autofill config normalizes domains and entitlements", () => {
  const domains = parseAssociatedDomains("https://example.com/login, accounts.example.com\nexample.com:443");
  assert.deepEqual(domains, ["example.com", "accounts.example.com"]);
  assert.deepEqual(buildAssociatedDomainEntitlements(domains), [
    "webcredentials:example.com",
    "applinks:example.com",
    "webcredentials:accounts.example.com",
    "applinks:accounts.example.com"
  ]);

  const readiness = getReleaseReadinessSnapshot({
    EXPO_PUBLIC_PM_MOBILE_ASSOCIATED_DOMAINS: "example.com",
    EXPO_PUBLIC_PM_CLOUD_BASE_URL: "https://api.example.com"
  });
  assert.equal(readiness.readyForNativeBuild, true);
});

await run("mobile expo config includes native autofill plugin", async () => {
  const { getConfig } = await import("@expo/config");
  const { exp: evaluated } = getConfig(new URL("../apps/mobile", import.meta.url).pathname, {
    skipSDKVersionRequirement: true,
    isPublicConfig: true
  });
  const pluginEntries = evaluated.plugins || [];
  const nativePlugin = pluginEntries.find(
    (entry) => Array.isArray(entry) && entry[0] === "./plugins/with-passwordmaneger-native-autofill.cjs"
  );

  assert.ok(nativePlugin);
  assert.equal(
    evaluated.extra.mobileReleaseReadiness.appGroup,
    "group.com.antigravity.passwordmaneger"
  );
  assert.equal(
    evaluated.extra.mobileReleaseReadiness.iosExtensionBundleIdentifier,
    "com.antigravity.passwordmaneger.autofill"
  );
});

await run("mobile autofill settings round-trip", async () => {
  const storageMap = new Map();
  const storage = {
    async getItemAsync(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    async setItemAsync(key, value) {
      storageMap.set(key, String(value));
    }
  };

  const saved = await saveAutofillSettings(
    {
      enabled: true,
      domains: "example.com\naccounts.example.com"
    },
    { storage, env: { EXPO_PUBLIC_PM_MOBILE_ASSOCIATED_DOMAINS: "" } }
  );
  assert.deepEqual(saved.domains, ["example.com", "accounts.example.com"]);

  const loaded = await loadAutofillSettings(
    {
      storage,
      env: { EXPO_PUBLIC_PM_MOBILE_ASSOCIATED_DOMAINS: "" }
    }
  );
  assert.equal(loaded.enabled, true);
  assert.deepEqual(loaded.domains, ["example.com", "accounts.example.com"]);
});

await run("mobile autofill cache keeps only login credentials with domains", () => {
  const payload = buildAutofillCachePayload([
    {
      id: "login-1",
      type: "login",
      title: "GitHub",
      username: "alice@example.com",
      password: "Secret123!",
      url: "github.com",
      updatedAt: "2026-03-01T00:00:00.000Z",
      favorite: true
    },
    {
      id: "note-1",
      type: "note",
      title: "Private note",
      notes: "keep me out"
    },
    {
      id: "login-2",
      type: "login",
      title: "Broken",
      username: "bob@example.com",
      password: "MissingDomain123!"
    }
  ], "2026-03-13T12:00:00.000Z");

  assert.equal(payload.version, 1);
  assert.equal(payload.generatedAt, "2026-03-13T12:00:00.000Z");
  assert.equal(payload.recordCount, 1);
  assert.deepEqual(payload.records[0], {
    id: "login-1",
    title: "GitHub",
    username: "alice@example.com",
    password: "Secret123!",
    url: "https://github.com",
    domain: "github.com",
    updatedAt: "2026-03-01T00:00:00.000Z",
    favorite: true
  });
});

await run("mobile cloud sync push and pull", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const ingestToken = "mobile-sync-ingest-token";
  const server = await startTempServer({
    label: "mobile-cloud-sync",
    env: {
      ENTITLEMENT_INGEST_TOKEN: ingestToken
    }
  });
  const mobileDir = await fs.mkdtemp(path.join(os.tmpdir(), "pm-mobile-sync-"));

  try {
    const service = new MobileVaultService(mobileDir);
    await service.handleAction({ action: "setupVault", masterPassword: "MobileSync12345!" });
    await service.handleAction({
      action: "saveItem",
      item: {
        type: "login",
        title: "Mobile Sync Account",
        username: "mobile-sync@example.com",
        password: "SyncPass!234",
        url: "https://example.com"
      }
    });

    const email = `mobile-sync-${Date.now()}@example.com`;
    const accountPassword = "CloudAccount12345!";
    const registered = await registerCloudAccount(
      {
        baseUrl: server.baseUrl,
        email,
        password: accountPassword
      },
      { fetchImpl: fetch }
    );

    const entitlement = await fetch(`${server.baseUrl}/api/entitlements/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-entitlement-token": ingestToken
      },
      body: JSON.stringify({
        email,
        source: "manual",
        sourceRef: `mobile_sync_${Date.now()}`,
        status: "active",
        feature: "cloud_sync"
      })
    }).then((response) => response.json());

    assert.equal(entitlement.ok, true);

    const exported = await service.handleAction({ action: "exportVaultEnvelope" });
    assert.ok(exported.envelope?.kdf);

    const pushed = await pushCloudVaultSnapshot(
      {
        baseUrl: server.baseUrl,
        token: registered.token,
        revision: 0,
        envelope: exported.envelope
      },
      { fetchImpl: fetch }
    );
    assert.equal(Number(pushed.revision), 1);

    await service.handleAction({ action: "importVaultEnvelope", envelope: pushed.envelope });
    const stateAfterImport = await service.handleAction({ action: "getState" });
    assert.equal(stateAfterImport.unlocked, false);

    const pulled = await pullCloudVaultSnapshot(
      {
        baseUrl: server.baseUrl,
        token: registered.token
      },
      { fetchImpl: fetch }
    );
    assert.equal(Number(pulled.revision), 1);
    await service.handleAction({ action: "importVaultEnvelope", envelope: pulled.envelope });
    await service.handleAction({ action: "unlockVault", masterPassword: "MobileSync12345!" });
    const listed = await service.handleAction({ action: "listItems", filters: {} });
    assert.equal(listed.items[0].title, "Mobile Sync Account");
    service.dispose();
  } finally {
    await server.stop();
    await fs.rm(mobileDir, { recursive: true, force: true });
  }
});

await run("mobile passkey metadata search and auto title", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const mobileDir = await fs.mkdtemp(path.join(os.tmpdir(), "pm-mobile-passkey-"));

  try {
    const service = new MobileVaultService(mobileDir);
    await service.handleAction({ action: "setupVault", masterPassword: "MobilePasskey12345!" });

    const saved = await service.handleAction({
      action: "saveItem",
      item: {
        type: "passkey",
        title: "",
        passkey: {
          rpId: "github.com",
          credentialId: "credential-1234567890",
          userName: "alice@example.com",
          userDisplayName: "Alice",
          userHandle: "alice-handle",
          transports: "internal, usb"
        }
      }
    });

    assert.equal(saved.item.title, "Alice (github.com)");
    assert.deepEqual(saved.item.passkey.transports, ["internal", "usb"]);

    const searched = await service.handleAction({
      action: "listItems",
      filters: { search: "github.com" }
    });
    assert.equal(searched.items.length, 1);
    assert.equal(searched.items[0].passkey.userHandle, "alice-handle");
    service.dispose();
  } finally {
    await fs.rm(mobileDir, { recursive: true, force: true });
  }
});

await run("mobile autofill item lookup returns matching login and passkey", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const mobileDir = await fs.mkdtemp(path.join(os.tmpdir(), "pm-mobile-autofill-"));

  try {
    const service = new MobileVaultService(mobileDir);
    await service.handleAction({ action: "setupVault", masterPassword: "MobileAutofill12345!" });
    await service.handleAction({
      action: "saveItem",
      item: {
        type: "login",
        title: "GitHub Login",
        username: "alice@example.com",
        password: "Autofill!234",
        url: "https://github.com/login"
      }
    });
    await service.handleAction({
      action: "saveItem",
      item: {
        type: "passkey",
        title: "",
        passkey: {
          rpId: "github.com",
          credentialId: "passkey-gh-1",
          userName: "alice@example.com"
        }
      }
    });

    const result = await service.handleAction({
      action: "listAutofillItems",
      domain: "accounts.github.com"
    });
    assert.equal(result.domain, "accounts.github.com");
    assert.equal(result.items.length, 2);
    assert.equal(result.items.some((item) => item.type === "login"), true);
    assert.equal(result.items.some((item) => item.type === "passkey"), true);
    service.dispose();
  } finally {
    await fs.rm(mobileDir, { recursive: true, force: true });
  }
});

await run("mobile vault core works with in-memory storage", async () => {
  let envelope = null;
  let idCounter = 0;
  const core = new MobileVaultCore({
    readEnvelope: async () => envelope,
    writeEnvelope: async (next) => {
      envelope = next;
    },
    createId: () => `core-test-${++idCounter}`
  });

  try {
    await core.handleAction({ action: "setupVault", masterPassword: "CoreMemoryPass123!" });
    await core.handleAction({
      action: "saveItem",
      item: {
        type: "login",
        title: "Example",
        username: "alice@example.com",
        password: "MemoryPass!234",
        url: "https://example.com"
      }
    });

    const listed = await core.handleAction({
      action: "listItems",
      filters: { search: "example.com" }
    });
    assert.equal(listed.items.length, 1);

    await core.handleAction({ action: "lockVault" });
    await core.handleAction({ action: "unlockVault", masterPassword: "CoreMemoryPass123!" });
    const state = await core.handleAction({ action: "getState" });
    assert.equal(state.itemCount, 1);
  } finally {
    core.dispose();
  }
});

await run("desktop renderer setup flow", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { _electron: electron } = await import("playwright");
  const pageErrors = [];
  const tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "pm-desktop-smoke-data-"));
  const app = await electron.launch({
    args: ["apps/desktop"],
    env: {
      ...process.env,
      PM_WEB_BASE_URL: "http://localhost:8787",
      PM_DATA_DIR: tempDataDir
    }
  });

  try {
    const page = await app.firstWindow();
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.waitForFunction(() => window.__pmDesktopBootstrapState === "setup", null, { timeout: 8_000 });
    await page.fill("#setup-password", "DesktopSmoke12345!");
    await page.fill("#setup-confirm", "DesktopSmoke12345!");
    await page.click("#setup-form button[type='submit']");
    await page.waitForFunction(() => window.__pmDesktopBootstrapState === "main", null, { timeout: 8_000 });

    const bootstrapState = await page.evaluate(() => window.__pmDesktopBootstrapState);
    const status = await page.textContent("#status");

    assert.equal(pageErrors.length, 0);
    assert.equal(bootstrapState, "main");
    assert.equal(Boolean(String(status || "").trim()), true);
  } finally {
    await app.close();
    await fs.rm(tempDataDir, { recursive: true, force: true });
  }
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
