/**
 * 4つの独自機能に対する包括的テスト
 * - エイリアスメール生成（追加ケース）
 * - サブスクリプションサマリー計算
 * - ダミーVault暗号化/復号
 * - デッドマンズスイッチ設定バリデーション
 */

import assert from "node:assert/strict";
import { createVaultEnvelope, unlockVaultEnvelope } from "../src/lib/crypto.js";
import { generateDomainAlias, generateRandomAlias } from "../src/lib/email-alias.js";

let passed = 0;
let failed = 0;

async function run(name, fn) {
    try {
        await fn();
        console.log(`PASS ${name}`);
        passed++;
    } catch (err) {
        console.error(`FAIL ${name}`);
        console.error(`  ${err.message}`);
        failed++;
        process.exitCode = 1;
    }
}

// ==================== Email Alias Tests ====================

await run("alias: edge case - empty domain", () => {
    const alias = generateDomainAlias("user@gmail.com", "");
    assert.ok(alias.startsWith("user+"));
    assert.ok(alias.endsWith("@gmail.com"));
});

await run("alias: special chars in domain sanitized", () => {
    const alias = generateDomainAlias("user@gmail.com", "evil<script>.com");
    assert.ok(!alias.includes("<"));
    assert.ok(!alias.includes(">"));
    assert.ok(alias.endsWith("@gmail.com"));
});

await run("alias: very long domain truncated", () => {
    const longDomain = "a".repeat(100) + ".com";
    const alias = generateDomainAlias("user@gmail.com", longDomain);
    // domain part should be max 30 chars
    const tagPart = alias.split("+")[1].split("@")[0];
    assert.ok(tagPart.length <= 40); // domain(30) + _ + token(4)
});

await run("alias: random uniqueness check", () => {
    const aliases = new Set();
    for (let i = 0; i < 50; i++) {
        aliases.add(generateRandomAlias("user@test.com"));
    }
    // All 50 should be unique
    assert.equal(aliases.size, 50);
});

await run("alias: preserves email domain correctly", () => {
    const alias = generateDomainAlias("me@company.co.jp", "amazon.com");
    assert.ok(alias.endsWith("@company.co.jp"));
    assert.ok(alias.startsWith("me+"));
});

await run("alias: works with + already in email", () => {
    const alias = generateDomainAlias("user+existing@gmail.com", "test.com");
    assert.ok(alias.startsWith("user+existing+"));
    assert.ok(alias.endsWith("@gmail.com"));
});

// ==================== Subscription Summary Tests ====================

// Inline mock of buildSubscriptionSummary logic (from background.js)
function buildSubscriptionSummary(items) {
    const subs = items.filter((item) => item.subscription?.isSubscription);
    let monthlyTotal = 0;

    const details = subs.map((item) => {
        const sub = item.subscription;
        let monthlyAmount = sub.amount;
        if (sub.cycle === "yearly") {
            monthlyAmount = sub.amount / 12;
        } else if (sub.cycle === "weekly") {
            monthlyAmount = sub.amount * 4.33;
        }
        monthlyTotal += monthlyAmount;

        return {
            id: item.id,
            title: item.title,
            amount: sub.amount,
            currency: sub.currency,
            cycle: sub.cycle,
            monthlyAmount: Math.round(monthlyAmount),
            nextBillingDate: sub.nextBillingDate
        };
    });

    return {
        count: subs.length,
        monthlyTotal: Math.round(monthlyTotal),
        yearlyTotal: Math.round(monthlyTotal * 12),
        currency: details[0]?.currency || "JPY",
        items: details
    };
}

await run("subscription: empty items returns zero", () => {
    const summary = buildSubscriptionSummary([]);
    assert.equal(summary.count, 0);
    assert.equal(summary.monthlyTotal, 0);
    assert.equal(summary.yearlyTotal, 0);
    assert.equal(summary.currency, "JPY");
});

await run("subscription: monthly calculation", () => {
    const items = [
        { id: "1", title: "Netflix", subscription: { isSubscription: true, amount: 1490, currency: "JPY", cycle: "monthly" } },
        { id: "2", title: "Spotify", subscription: { isSubscription: true, amount: 980, currency: "JPY", cycle: "monthly" } }
    ];
    const summary = buildSubscriptionSummary(items);
    assert.equal(summary.count, 2);
    assert.equal(summary.monthlyTotal, 2470);
    assert.equal(summary.yearlyTotal, 29640);
});

await run("subscription: yearly to monthly conversion", () => {
    const items = [
        { id: "1", title: "Adobe CC", subscription: { isSubscription: true, amount: 86880, currency: "JPY", cycle: "yearly" } }
    ];
    const summary = buildSubscriptionSummary(items);
    assert.equal(summary.count, 1);
    assert.equal(summary.monthlyTotal, 7240); // 86880/12
});

await run("subscription: weekly to monthly conversion", () => {
    const items = [
        { id: "1", title: "Weekly App", subscription: { isSubscription: true, amount: 500, currency: "JPY", cycle: "weekly" } }
    ];
    const summary = buildSubscriptionSummary(items);
    assert.equal(summary.count, 1);
    assert.equal(summary.monthlyTotal, 2165); // 500 * 4.33
});

await run("subscription: mixed cycles", () => {
    const items = [
        { id: "1", title: "Monthly", subscription: { isSubscription: true, amount: 1000, currency: "JPY", cycle: "monthly" } },
        { id: "2", title: "Yearly", subscription: { isSubscription: true, amount: 12000, currency: "JPY", cycle: "yearly" } },
        { id: "3", title: "Not a sub", subscription: { isSubscription: false, amount: 0, currency: "JPY", cycle: "monthly" } }
    ];
    const summary = buildSubscriptionSummary(items);
    assert.equal(summary.count, 2); // 3rd excluded
    assert.equal(summary.monthlyTotal, 2000); // 1000 + 12000/12
});

await run("subscription: USD currency preserved", () => {
    const items = [
        { id: "1", title: "ChatGPT", subscription: { isSubscription: true, amount: 20, currency: "USD", cycle: "monthly" } }
    ];
    const summary = buildSubscriptionSummary(items);
    assert.equal(summary.currency, "USD");
});

// ==================== Decoy Vault Tests ====================

await run("decoy vault: main password works", async () => {
    const vault = {
        version: 1,
        meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        settings: {},
        items: [{ id: "real-1", title: "RealItem" }]
    };
    const mainPw = "MainPassword123!";
    const envelope = await createVaultEnvelope(vault, mainPw);
    const result = await unlockVaultEnvelope(envelope, mainPw);
    assert.equal(result.vault.items[0].title, "RealItem");
});

await run("decoy vault: wrong password fails", async () => {
    const vault = { version: 1, meta: {}, settings: {}, items: [] };
    const envelope = await createVaultEnvelope(vault, "CorrectPassword1!");
    let threw = false;
    try {
        await unlockVaultEnvelope(envelope, "WrongPassword1!");
    } catch {
        threw = true;
    }
    assert.equal(threw, true);
});

await run("decoy vault: separate envelopes for main and decoy", async () => {
    const mainVault = { version: 1, meta: {}, settings: {}, items: [{ id: "1", title: "Secret" }] };
    const decoyVault = { version: 1, meta: {}, settings: {}, items: [] };

    const mainPw = "RealMasterPW123!";
    const decoyPw = "DecoyPW456!";

    const mainEnvelope = await createVaultEnvelope(mainVault, mainPw);
    const decoyEnvelope = await createVaultEnvelope(decoyVault, decoyPw);

    // Simulate the storage structure
    mainEnvelope.decoy = {
        kdf: decoyEnvelope.kdf,
        cipher: decoyEnvelope.cipher
    };

    // Main password should unlock main vault
    const mainResult = await unlockVaultEnvelope(mainEnvelope, mainPw);
    assert.equal(mainResult.vault.items.length, 1);
    assert.equal(mainResult.vault.items[0].title, "Secret");

    // Main password should NOT unlock decoy vault
    const decoyEnvelopeForTest = {
        version: 1,
        kdf: mainEnvelope.decoy.kdf,
        cipher: mainEnvelope.decoy.cipher
    };
    let decoyWithMainFailed = false;
    try {
        await unlockVaultEnvelope(decoyEnvelopeForTest, mainPw);
    } catch {
        decoyWithMainFailed = true;
    }
    assert.equal(decoyWithMainFailed, true);
    // Decoy password SHOULD unlock decoy vault
    const decoyResult = await unlockVaultEnvelope(decoyEnvelopeForTest, decoyPw);
    assert.equal(decoyResult.vault.items.length, 0);
});

// ==================== Deadman Config Validation Tests ====================

// Test the validation logic inline (mirrors background.js saveDeadmanConfig)
function validateDeadmanConfig(input) {
    const dmNext = input || {};
    return {
        enabled: Boolean(dmNext.enabled),
        inactiveDays: Math.max(1, Math.min(365, Number(dmNext.inactiveDays) || 90)),
        contacts: Array.isArray(dmNext.contacts)
            ? dmNext.contacts
                .filter((c) => c && c.email)
                .map((c) => ({ name: String(c.name || "").slice(0, 100), email: String(c.email || "").slice(0, 200) }))
                .slice(0, 5)
            : [],
        lastHeartbeat: dmNext.lastHeartbeat || null
    };
}

await run("deadman: default config", () => {
    const config = validateDeadmanConfig({});
    assert.equal(config.enabled, false);
    assert.equal(config.inactiveDays, 90);
    assert.equal(config.contacts.length, 0);
});

await run("deadman: clamps days to 1-365 range", () => {
    // Number(0) is falsy, so || 90 kicks in → result is min(365, 90) = 90
    assert.equal(validateDeadmanConfig({ inactiveDays: 0 }).inactiveDays, 90);
    // Number(-10) is truthy but max(1, -10) = 1? No — Number(-10) is truthy so no fallback
    // Actually: Math.max(1, Math.min(365, Number(-10) || 90))
    // Number(-10) = -10, truthy, so: Math.max(1, Math.min(365, -10)) = Math.max(1, -10) = 1
    assert.equal(validateDeadmanConfig({ inactiveDays: -10 }).inactiveDays, 1);
    assert.equal(validateDeadmanConfig({ inactiveDays: 500 }).inactiveDays, 365);
    assert.equal(validateDeadmanConfig({ inactiveDays: 30 }).inactiveDays, 30);
});

await run("deadman: max 5 contacts enforced", () => {
    const contacts = Array.from({ length: 10 }, (_, i) => ({ name: `P${i}`, email: `p${i}@test.com` }));
    const config = validateDeadmanConfig({ contacts });
    assert.equal(config.contacts.length, 5);
});

await run("deadman: filters empty email contacts", () => {
    const contacts = [
        { name: "Alice", email: "alice@test.com" },
        { name: "No Email", email: "" },
        { name: "", email: "valid@test.com" },
        null,
        undefined
    ];
    const config = validateDeadmanConfig({ contacts });
    assert.equal(config.contacts.length, 2);
});

await run("deadman: truncates long names and emails", () => {
    const config = validateDeadmanConfig({
        contacts: [{ name: "A".repeat(200), email: "B".repeat(300) + "@test.com" }]
    });
    assert.equal(config.contacts[0].name.length, 100);
    assert.equal(config.contacts[0].email.length, 200);
});

// ==================== Storage Item Normalization Tests ====================

// Test normalizeStoredItem subscription fields (mirrors background.js logic)
function normalizeSubscription(sub) {
    const s = sub || {};
    return {
        isSubscription: Boolean(s.isSubscription),
        amount: Math.max(0, Number(s.amount) || 0),
        currency: String(s.currency || "JPY").slice(0, 5),
        cycle: ["monthly", "yearly", "weekly"].includes(s.cycle) ? s.cycle : "monthly",
        nextBillingDate: String(s.nextBillingDate || "").slice(0, 20)
    };
}

await run("normalize sub: defaults", () => {
    const sub = normalizeSubscription(undefined);
    assert.equal(sub.isSubscription, false);
    assert.equal(sub.amount, 0);
    assert.equal(sub.currency, "JPY");
    assert.equal(sub.cycle, "monthly");
});

await run("normalize sub: invalid cycle defaults to monthly", () => {
    const sub = normalizeSubscription({ cycle: "biweekly" });
    assert.equal(sub.cycle, "monthly");
});

await run("normalize sub: negative amount clamped to 0", () => {
    const sub = normalizeSubscription({ amount: -100 });
    assert.equal(sub.amount, 0);
});

await run("normalize sub: valid data preserved", () => {
    const sub = normalizeSubscription({
        isSubscription: true,
        amount: 1490,
        currency: "USD",
        cycle: "yearly",
        nextBillingDate: "2026-03-01"
    });
    assert.equal(sub.isSubscription, true);
    assert.equal(sub.amount, 1490);
    assert.equal(sub.currency, "USD");
    assert.equal(sub.cycle, "yearly");
    assert.equal(sub.nextBillingDate, "2026-03-01");
});

// ==================== Summary ====================

console.log(`\n--- 包括テスト結果 ---`);
console.log(`PASS: ${passed} / ${passed + failed}`);
console.log(`FAIL: ${failed}`);

if (failed) {
    process.exit(1);
}
