/**
 * Audit Logger
 * MCP/エージェントの全操作を追記型JSONLファイルに記録する。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class AuditLogger {
    constructor(logFilePath) {
        this.logFilePath = logFilePath;
        this._ensured = false;
    }

    async _ensureDir() {
        if (this._ensured) {
            return;
        }

        try {
            await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
        } catch {
            // ignore
        }

        this._ensured = true;
    }

    /**
     * 操作をログに記録する。
     * @param {string} action - 操作名 (例: "saveItem", "deleteItem")
     * @param {string} actor - 操作元 (例: "mcp", "desktop", エージェント名)
     * @param {object} details - 追加情報 (アイテムIDなど)
     * @param {string} [sessionId] - セッションID
     */
    async log(action, actor = "unknown", details = {}, sessionId = "") {
        await this._ensureDir();

        const entry = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            actor,
            sessionId: sessionId || "",
            details
        };

        const line = JSON.stringify(entry) + "\n";

        try {
            await fs.appendFile(this.logFilePath, line, "utf-8");
        } catch {
            // ログ書き込み失敗は握り潰す（主処理を止めない）
        }

        return entry;
    }

    /**
     * ログをクエリする。
     * @param {object} [filter]
     * @param {string} [filter.action] - アクション名でフィルタ
     * @param {string} [filter.actor] - アクターでフィルタ
     * @param {string} [filter.since] - ISO日時文字列。これ以降のログのみ
     * @param {number} [filter.limit] - 最大件数 (デフォルト: 100)
     * @returns {Promise<Array>} ログエントリの配列（新しい順）
     */
    async query(filter = {}) {
        const limit = Math.min(Math.max(Number(filter.limit) || 100, 1), 1000);

        let raw;
        try {
            raw = await fs.readFile(this.logFilePath, "utf-8");
        } catch {
            return [];
        }

        const lines = raw.trim().split("\n").filter(Boolean);
        const entries = [];

        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            } catch {
                // skip malformed lines
            }
        }

        // フィルタ適用
        let filtered = entries;

        if (filter.action) {
            filtered = filtered.filter((e) => e.action === filter.action);
        }

        if (filter.actor) {
            filtered = filtered.filter((e) => e.actor === filter.actor);
        }

        if (filter.since) {
            const sinceTime = new Date(filter.since).getTime();
            if (!Number.isNaN(sinceTime)) {
                filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
            }
        }

        // 新しい順にソートして制限
        filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        return filtered.slice(0, limit);
    }

    /**
     * ログを全消去する。
     */
    async clear() {
        try {
            await fs.writeFile(this.logFilePath, "", "utf-8");
        } catch {
            // ignore
        }
    }
}
