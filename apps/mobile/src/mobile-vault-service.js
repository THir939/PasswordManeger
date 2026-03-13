/**
 * Mobile VaultService (Node wrapper)
 * 共通コアを Node.js のファイルストレージへ接続する。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { MobileVaultCore } from "./services/mobile-vault-core.js";

if (!globalThis.crypto?.getRandomValues) {
    globalThis.crypto = webcrypto;
}

async function readJsonFile(filePath, fallback) {
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
        return fallback;
    }
}

async function writeJsonFile(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export class MobileVaultService {
    constructor(dataDir) {
        this.envelopeFile = path.join(dataDir, "vault-envelope.json");
        this.core = new MobileVaultCore({
            readEnvelope: () => readJsonFile(this.envelopeFile, null),
            writeEnvelope: (envelope) => writeJsonFile(this.envelopeFile, envelope)
        });
    }

    dispose() {
        this.core.dispose();
    }

    async handleAction(msg) {
        return this.core.handleAction(msg);
    }
}
