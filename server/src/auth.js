import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { FEATURE_CLOUD_SYNC, canUseFeature, summarizeFeatureAccess } from "./entitlements.js";

export function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    config.jwtSecret,
    {
      expiresIn: "30d"
    }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function authMiddleware(store) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({
        ok: false,
        error: "認証トークンがありません。"
      });
    }

    try {
      const payload = verifyToken(match[1]);
      const user = store.findUserById(payload.sub);
      if (!user) {
        return res.status(401).json({ ok: false, error: "ユーザーが存在しません。" });
      }

      req.user = user;
      return next();
    } catch {
      return res.status(401).json({
        ok: false,
        error: "認証トークンが無効です。"
      });
    }
  };
}

export function sanitizeUser(user) {
  const cloudSync = summarizeFeatureAccess(user, FEATURE_CLOUD_SYNC);
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    planStatus: cloudSync.effectiveStatus,
    currentPeriodEnd: cloudSync.currentPeriodEnd,
    entitlements: {
      cloudSync: {
        isActive: cloudSync.isActive,
        effectiveStatus: cloudSync.effectiveStatus,
        activeSources: cloudSync.activeSources
      }
    }
  };
}

export function isPaidUser(user) {
  return canUseFeature(user, FEATURE_CLOUD_SYNC);
}
