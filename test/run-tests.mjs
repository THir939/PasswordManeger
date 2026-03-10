import assert from "node:assert/strict";
import { createVaultEnvelope, unlockVaultEnvelope } from "@pm/core/crypto";
import { generatePassword, passwordStrength } from "@pm/core/password";
import { generateTotp } from "@pm/core/totp";
import { buildSecurityReport } from "@pm/core/security-audit";
import { parseExternalItems } from "@pm/core/migration";
import { buildAutofillRisk } from "@pm/core/autofill-risk";
import { validateCloudBaseUrl } from "@pm/core/cloud-url";
import {
  FEATURE_CLOUD_SYNC,
  mapStripeStatusToEntitlementStatus,
  summarizeFeatureAccess
} from "../server/src/entitlements.js";

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

if (process.exitCode) {
  process.exit(process.exitCode);
}
