import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { apiJson, startTempServer } from "./e2e-helpers.mjs";

async function run() {
  const server = await startTempServer({ label: "stripe-smoke" });

  try {
    const healthResponse = await apiJson(server.baseUrl, "/api/health");
    assert.equal(healthResponse.ok, true, "health endpoint should be available");

    const email = `stripe-smoke-${Date.now()}@example.com`;
    const password = "stripe-smoke-password-12345";

    const register = await apiJson(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { email, password }
    });
    assert.equal(register.status, 201, "register should succeed");
    assert.ok(register.payload?.token, "register should return token");

    const token = register.payload.token;
    const stripeConfigured = Boolean(healthResponse.payload?.stripeConfigured);

    const checkout = await apiJson(server.baseUrl, "/api/billing/checkout-session", {
      method: "POST",
      token
    });

    if (!stripeConfigured) {
      assert.equal(checkout.status, 503, "checkout should be blocked when Stripe is not configured");
      console.log("PASS stripe demo smoke (Stripe未設定モードの期待動作)");
      return;
    }

    assert.equal(checkout.ok, true, "checkout should succeed when Stripe is configured");
    assert.ok(
      String(checkout.payload?.url || "").startsWith("https://checkout.stripe.com/"),
      "checkout URL should be Stripe Checkout"
    );

    const portal = await apiJson(server.baseUrl, "/api/billing/portal-session", {
      method: "POST",
      token
    });
    assert.equal(portal.ok, true, "billing portal session should be created");
    assert.ok(
      String(portal.payload?.url || "").includes("billing.stripe.com"),
      "portal URL should be Stripe Billing Portal"
    );

    const dbRaw = await fs.readFile(server.dataFile, "utf8");
    const db = JSON.parse(dbRaw);
    const user = (db.users || []).find((entry) => entry.email === email);
    assert.ok(user?.stripeCustomerId, "checkout should assign stripeCustomerId");

    const now = Math.floor(Date.now() / 1000);
    const webhook = await fetch(`${server.baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: `evt_local_${Date.now()}`,
        type: "customer.subscription.created",
        data: {
          object: {
            id: `sub_local_${Date.now()}`,
            customer: user.stripeCustomerId,
            status: "active",
            start_date: now,
            current_period_end: now + 30 * 24 * 60 * 60
          }
        }
      })
    });
    assert.equal(webhook.ok, true, "webhook ingest should succeed");

    const billingStatus = await apiJson(server.baseUrl, "/api/billing/status", { token });
    assert.equal(billingStatus.ok, true, "billing status should be readable");
    assert.equal(Boolean(billingStatus.payload?.isPaid), true, "paid flag should become true after webhook");
    assert.equal(billingStatus.payload?.planStatus, "active", "plan status should become active");

    const entitlementStatus = await apiJson(server.baseUrl, "/api/entitlements/status", { token });
    assert.equal(entitlementStatus.ok, true, "entitlement status endpoint should be readable");
    assert.equal(
      Boolean(entitlementStatus.payload?.features?.cloud_sync?.isPaid),
      true,
      "entitlement should be unified as paid"
    );

    console.log("PASS stripe demo smoke (checkout/portal/webhook/entitlement)");
  } finally {
    await server.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
