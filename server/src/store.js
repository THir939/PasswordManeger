import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_DB = {
  users: [],
  vaults: []
};

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
    }
  }

  read() {
    const raw = fs.readFileSync(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        vaults: Array.isArray(parsed.vaults) ? parsed.vaults : []
      };
    } catch {
      return structuredClone(DEFAULT_DB);
    }
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  findUserByEmail(email) {
    const db = this.read();
    return db.users.find((user) => user.emailLower === String(email || "").toLowerCase()) || null;
  }

  findUserById(userId) {
    const db = this.read();
    return db.users.find((user) => user.id === userId) || null;
  }

  findUserByStripeCustomerId(customerId) {
    if (!customerId) {
      return null;
    }

    const db = this.read();
    return db.users.find((user) => user.stripeCustomerId === customerId) || null;
  }

  createUser({ email, passwordHash }) {
    const db = this.read();
    const now = new Date().toISOString();

    const user = {
      id: crypto.randomUUID(),
      email,
      emailLower: email.toLowerCase(),
      passwordHash,
      createdAt: now,
      planStatus: "inactive",
      subscriptionId: null,
      stripeCustomerId: null,
      currentPeriodEnd: null
    };

    db.users.push(user);
    this.write(db);
    return user;
  }

  updateUser(userId, updates) {
    const db = this.read();
    const index = db.users.findIndex((user) => user.id === userId);
    if (index < 0) {
      return null;
    }

    db.users[index] = {
      ...db.users[index],
      ...updates
    };

    this.write(db);
    return db.users[index];
  }

  getVaultSnapshot(userId) {
    const db = this.read();
    return (
      db.vaults.find((vault) => vault.userId === userId) || {
        userId,
        revision: 0,
        envelope: null,
        updatedAt: null
      }
    );
  }

  saveVaultSnapshot({ userId, nextRevision, envelope }) {
    const db = this.read();
    const now = new Date().toISOString();
    const index = db.vaults.findIndex((vault) => vault.userId === userId);

    const payload = {
      userId,
      revision: nextRevision,
      envelope,
      updatedAt: now
    };

    if (index < 0) {
      db.vaults.push(payload);
    } else {
      db.vaults[index] = payload;
    }

    this.write(db);
    return payload;
  }
}
