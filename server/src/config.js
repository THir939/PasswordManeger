import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8787),
  jwtSecret: required("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8787",
  dataFilePath: process.env.DATA_FILE || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePriceId: process.env.STRIPE_PRICE_ID || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  allowInsecureWebhook: String(process.env.ALLOW_INSECURE_WEBHOOK || "") === "1",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8787",
  entitlementIngestToken: process.env.ENTITLEMENT_INGEST_TOKEN || ""
};

export function assertBillingEnv() {
  required("STRIPE_SECRET_KEY");
  required("STRIPE_PRICE_ID");
}
