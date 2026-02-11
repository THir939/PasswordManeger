import path from "node:path";
import fs from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { config } from "./config.js";
import { JsonStore } from "./store.js";
import {
  authMiddleware,
  comparePassword,
  hashPassword,
  isPaidUser,
  issueToken,
  sanitizeUser
} from "./auth.js";
import {
  FEATURE_CLOUD_SYNC,
  mapStripeStatusToEntitlementStatus,
  summarizeFeatureAccess
} from "./entitlements.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const dataFile = config.dataFilePath
  ? (path.isAbsolute(config.dataFilePath)
      ? config.dataFilePath
      : path.resolve(projectRoot, config.dataFilePath))
  : path.join(projectRoot, "data", "db.json");

const app = express();
const store = new JsonStore(dataFile);
const authRequired = authMiddleware(store);

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" }) : null;

function parseAllowedOrigins() {
  return config.corsOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || origin.startsWith("chrome-extension://")) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS blocked"));
  }
};

app.use(cors(corsOptions));

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();

  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function createMemoryRateLimiter({
  windowMs,
  maxRequests,
  keyFn,
  errorMessage
}) {
  const buckets = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, value] of buckets.entries()) {
      if (!value || value.resetAt <= now) {
        buckets.delete(key);
      }
    }
  };

  const timer = setInterval(cleanup, windowMs);
  timer.unref?.();

  return (req, res, next) => {
    const key = String(keyFn(req) || "unknown");
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("retry-after", String(retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: errorMessage,
        retryAfterSec
      });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}

function safeTokenEquals(expected, provided) {
  const left = Buffer.from(String(expected || ""), "utf8");
  const right = Buffer.from(String(provided || ""), "utf8");

  if (!left.length || !right.length || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

const registerRateLimiter = createMemoryRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyFn: (req) => getClientIp(req),
  errorMessage: "登録試行が多すぎます。しばらく待って再試行してください。"
});

const loginRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyFn: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${getClientIp(req)}:${email || "-"}`;
  },
  errorMessage: "ログイン試行が多すぎます。しばらく待って再試行してください。"
});

function buildCloudSyncBillingStatus(user) {
  const cloudSync = summarizeFeatureAccess(user, FEATURE_CLOUD_SYNC);
  return {
    feature: FEATURE_CLOUD_SYNC,
    planStatus: cloudSync.effectiveStatus,
    isPaid: cloudSync.isActive,
    currentPeriodEnd: cloudSync.currentPeriodEnd,
    activeSources: cloudSync.activeSources,
    entitlements: cloudSync.entitlements
  };
}

function findEntitlementTargetUser({ userId, email }) {
  if (userId) {
    return store.findUserById(userId);
  }
  if (email) {
    return store.findUserByEmail(email);
  }
  return null;
}

app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(400).send("Stripe is not configured");
  }

  let event;
  const signature = req.headers["stripe-signature"];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");

  try {
    if (config.stripeWebhookSecret) {
      if (!signature || Array.isArray(signature)) {
        return res.status(400).send("Webhook signature is required");
      }

      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
    } else if (config.allowInsecureWebhook) {
      event = JSON.parse(rawBody.toString("utf8"));
    } else {
      return res.status(503).send("STRIPE_WEBHOOK_SECRET must be set (or ALLOW_INSECURE_WEBHOOK=1 for local-only testing)");
    }
  } catch (error) {
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  try {
    const updateFromSubscription = async (subscription) => {
      const customerId = String(subscription.customer || "");
      const user = store.findUserByStripeCustomerId(customerId);
      if (!user) {
        return;
      }

      const periodEndUnix = Number(subscription.current_period_end || 0);
      const periodEndIso = periodEndUnix > 0 ? new Date(periodEndUnix * 1000).toISOString() : null;
      const startedAtUnix = Number(subscription.start_date || 0);
      const startedAtIso = startedAtUnix > 0 ? new Date(startedAtUnix * 1000).toISOString() : null;
      const mappedStatus = mapStripeStatusToEntitlementStatus(subscription.status);

      store.upsertEntitlement(user.id, {
        feature: FEATURE_CLOUD_SYNC,
        source: "stripe",
        sourceRef: String(subscription.id || ""),
        status: mappedStatus,
        startedAt: startedAtIso,
        expiresAt: periodEndIso,
        metadata: {
          stripeStatus: String(subscription.status || "unknown"),
          stripeCustomerId: customerId
        }
      });

      store.updateUser(user.id, {
        subscriptionId: subscription.id,
        stripeCustomerId: customerId,
        currentPeriodEnd: periodEndIso
      });
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await updateFromSubscription(subscription);
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      await updateFromSubscription(event.data.object);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = String(subscription.customer || "");
      const user = store.findUserByStripeCustomerId(customerId);
      if (user) {
        store.upsertEntitlement(user.id, {
          feature: FEATURE_CLOUD_SYNC,
          source: "stripe",
          sourceRef: String(subscription.id || ""),
          status: "canceled",
          expiresAt: null,
          metadata: {
            stripeStatus: "canceled",
            stripeCustomerId: customerId
          }
        });

        store.updateUser(user.id, {
          subscriptionId: subscription.id || user.subscriptionId,
          currentPeriodEnd: null
        });
      }
    }
  } catch (error) {
    return res.status(500).send(`Webhook handler failed: ${error.message}`);
  }

  return res.status(200).json({ received: true });
});

app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripe && config.stripePriceId),
    now: new Date().toISOString()
  });
});

app.post("/api/auth/register", registerRateLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(422).json({ ok: false, error: "有効なメールアドレスを入力してください。" });
  }

  if (password.length < 10) {
    return res.status(422).json({ ok: false, error: "パスワードは10文字以上にしてください。" });
  }

  if (store.findUserByEmail(email)) {
    return res.status(409).json({ ok: false, error: "このメールは既に登録されています。" });
  }

  const passwordHash = await hashPassword(password);
  const user = store.createUser({ email, passwordHash });
  const token = issueToken(user);

  return res.status(201).json({
    ok: true,
    token,
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  const user = store.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ ok: false, error: "メールまたはパスワードが正しくありません。" });
  }

  const matched = await comparePassword(password, user.passwordHash);
  if (!matched) {
    return res.status(401).json({ ok: false, error: "メールまたはパスワードが正しくありません。" });
  }

  const token = issueToken(user);
  return res.json({ ok: true, token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ ok: true, user: sanitizeUser(req.user) });
});

app.get("/api/billing/status", authRequired, (req, res) => {
  const status = buildCloudSyncBillingStatus(req.user);
  res.json({
    ok: true,
    ...status
  });
});

app.get("/api/entitlements/status", authRequired, (req, res) => {
  const status = buildCloudSyncBillingStatus(req.user);
  return res.json({
    ok: true,
    features: {
      [FEATURE_CLOUD_SYNC]: status
    }
  });
});

app.post("/api/billing/checkout-session", authRequired, async (req, res) => {
  if (!stripe || !config.stripePriceId) {
    return res.status(503).json({ ok: false, error: "Stripe設定が未完了です。" });
  }

  let user = req.user;
  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id }
    });

    user = store.updateUser(user.id, {
      stripeCustomerId: customer.id
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: user.stripeCustomerId,
    line_items: [{ price: config.stripePriceId, quantity: 1 }],
    success_url: `${config.appBaseUrl}/?checkout=success`,
    cancel_url: `${config.appBaseUrl}/?checkout=cancel`,
    metadata: {
      userId: user.id
    }
  });

  return res.json({ ok: true, url: session.url });
});

app.post("/api/billing/portal-session", authRequired, async (req, res) => {
  if (!stripe || !req.user.stripeCustomerId) {
    return res.status(400).json({ ok: false, error: "課金ポータルを開けません。" });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: req.user.stripeCustomerId,
    return_url: config.appBaseUrl
  });

  return res.json({ ok: true, url: portal.url });
});

app.post("/api/entitlements/ingest", (req, res, next) => {
  if (!config.entitlementIngestToken) {
    return res.status(503).json({
      ok: false,
      error: "ENTITLEMENT_INGEST_TOKEN が未設定です。"
    });
  }

  const token = String(req.headers["x-entitlement-token"] || "");
  if (!safeTokenEquals(config.entitlementIngestToken, token)) {
    return res.status(401).json({
      ok: false,
      error: "entitlement token が無効です。"
    });
  }

  return next();
}, (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  const email = String(req.body?.email || "").trim();
  const source = String(req.body?.source || "manual").trim();
  const sourceRef = String(req.body?.sourceRef || "").trim();
  const status = String(req.body?.status || "inactive").trim();
  const feature = String(req.body?.feature || FEATURE_CLOUD_SYNC).trim();
  const startedAt = req.body?.startedAt || null;
  const expiresAt = req.body?.expiresAt || null;
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};

  if (!userId && !email) {
    return res.status(422).json({
      ok: false,
      error: "userId か email のどちらかが必要です。"
    });
  }

  const user = findEntitlementTargetUser({ userId, email });
  if (!user) {
    return res.status(404).json({
      ok: false,
      error: "対象ユーザーが見つかりません。"
    });
  }

  const updatedUser = store.upsertEntitlement(user.id, {
    feature,
    source,
    sourceRef,
    status,
    startedAt,
    expiresAt,
    metadata
  });

  if (!updatedUser) {
    return res.status(500).json({
      ok: false,
      error: "利用権の更新に失敗しました。"
    });
  }

  if (source === "stripe" && sourceRef) {
    store.updateUser(updatedUser.id, {
      subscriptionId: sourceRef
    });
  }

  const featureStatus = summarizeFeatureAccess(updatedUser, feature);

  return res.json({
    ok: true,
    user: sanitizeUser(updatedUser),
    featureStatus
  });
});

function paidRequired(req, res, next) {
  if (!isPaidUser(req.user)) {
    const status = buildCloudSyncBillingStatus(req.user);
    return res.status(402).json({
      ok: false,
      error: "この機能は有料プラン専用です。Web課金を完了してください。",
      planStatus: status.planStatus,
      activeSources: status.activeSources
    });
  }

  return next();
}

app.get("/api/vault/snapshot", authRequired, paidRequired, (req, res) => {
  const snapshot = store.getVaultSnapshot(req.user.id);
  return res.json({
    ok: true,
    snapshot
  });
});

app.put("/api/vault/snapshot", authRequired, paidRequired, (req, res) => {
  const expectedRevision = Number(req.body?.expectedRevision);
  const nextRevision = Number(req.body?.nextRevision);
  const envelope = req.body?.envelope;

  if (!Number.isFinite(expectedRevision) || !Number.isFinite(nextRevision) || !envelope?.kdf || !envelope?.cipher) {
    return res.status(422).json({ ok: false, error: "リクエスト形式が不正です。" });
  }

  const current = store.getVaultSnapshot(req.user.id);

  if (current.revision !== expectedRevision) {
    return res.status(409).json({
      ok: false,
      error: "リビジョン衝突です。先に最新を取得してください。",
      currentRevision: current.revision
    });
  }

  if (nextRevision !== expectedRevision + 1) {
    return res.status(422).json({ ok: false, error: "nextRevisionが不正です。" });
  }

  const saved = store.saveVaultSnapshot({
    userId: req.user.id,
    nextRevision,
    envelope
  });

  return res.json({ ok: true, snapshot: saved });
});

app.get("/api/vault/emergency-export", authRequired, (req, res) => {
  const snapshot = store.getVaultSnapshot(req.user.id);
  if (!snapshot?.envelope) {
    return res.status(404).json({
      ok: false,
      error: "緊急アクセス用のデータがありません。先に同期を実行してください。"
    });
  }

  return res.json({
    ok: true,
    snapshot
  });
});

app.use(express.static(publicDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  const indexPath = path.join(publicDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    res.status(404).send("Web UI not found");
    return;
  }

  res.sendFile(indexPath);
});

app.listen(config.port, () => {
  console.log(`PasswordManeger server running on http://localhost:${config.port}`);
});
