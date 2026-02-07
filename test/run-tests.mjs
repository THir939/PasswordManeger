import assert from "node:assert/strict";
import { createVaultEnvelope, unlockVaultEnvelope } from "../src/lib/crypto.js";
import { generatePassword } from "../src/lib/password.js";
import { generateTotp } from "../src/lib/totp.js";
import { buildSecurityReport } from "../src/lib/security-audit.js";
import { parseExternalItems } from "../src/lib/migration.js";
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

if (process.exitCode) {
  process.exit(process.exitCode);
}
