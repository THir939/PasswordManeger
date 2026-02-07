import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Stripe from "stripe";
import dotenv from "dotenv";

const serverRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envPath = path.join(serverRoot, ".env");

dotenv.config({ path: envPath });

function readEnvFile() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env が見つかりません: ${envPath}`);
  }
  return fs.readFileSync(envPath, "utf8");
}

function updateEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

function normalizePublicUrl(input) {
  const raw = String(input || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(raw)) {
    throw new Error("公開URLは https:// で始めてください。");
  }
  return raw;
}

const publicUrlArg = process.argv[2];
if (!publicUrlArg) {
  console.error("使い方: npm --prefix server run webhook:test -- <公開URL>");
  process.exit(1);
}

const publicUrl = normalizePublicUrl(publicUrlArg);
const webhookUrl = `${publicUrl}/api/billing/webhook`;

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY が server/.env にありません。");
}
if (!stripeKey.startsWith("sk_test_")) {
  throw new Error("テストモード設定専用です。sk_test_ を使ってください。");
}

const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

const endpoint = await stripe.webhookEndpoints.create({
  url: webhookUrl,
  enabled_events: [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted"
  ],
  description: "PasswordManeger test webhook"
});

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
for (const item of existing.data) {
  if (item.id === endpoint.id) continue;
  if (String(item.description || "").startsWith("PasswordManeger test webhook")) {
    await stripe.webhookEndpoints.del(item.id);
  }
}

let envContent = readEnvFile();
envContent = updateEnvLine(envContent, "STRIPE_WEBHOOK_SECRET", endpoint.secret);
fs.writeFileSync(envPath, envContent, "utf8");

console.log(JSON.stringify({
  message: "テストWebhookを作成し、.envを更新しました。",
  endpointId: endpoint.id,
  webhookUrl: endpoint.url,
  webhookSecret: endpoint.secret,
  envPath
}, null, 2));
