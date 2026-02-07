import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8787),
  jwtSecret: process.env.JWT_SECRET || "dev-local-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8787",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePriceId: process.env.STRIPE_PRICE_ID || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8787"
};

export function assertBillingEnv() {
  required("STRIPE_SECRET_KEY");
  required("STRIPE_PRICE_ID");
}
