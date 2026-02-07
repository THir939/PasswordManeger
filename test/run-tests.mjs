import assert from "node:assert/strict";
import { createVaultEnvelope, unlockVaultEnvelope } from "../src/lib/crypto.js";
import { generatePassword } from "../src/lib/password.js";
import { generateTotp } from "../src/lib/totp.js";
import { buildSecurityReport } from "../src/lib/security-audit.js";

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
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
