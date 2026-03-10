/**
 * Mobile App Server
 * MobileVaultService をラップする軽量HTTPサーバー。
 * モバイルUIからのAPIリクエストを処理する。
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { MobileVaultService } from "./mobile-vault-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const dataDir = process.env.PM_MOBILE_DATA_DIR ||
    path.join(os.homedir(), ".passwordmaneger", "mobile");
const PORT = Number(process.env.PM_MOBILE_PORT) || 3200;

const service = new MobileVaultService(dataDir);

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

async function serveStatic(res, urlPath) {
    const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(publicDir, safePath === "/" ? "index.html" : safePath);

    try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
        res.end(data);
    } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
    }
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // API endpoint
    if (req.method === "POST" && req.url === "/api/action") {
        try {
            const body = await readBody(req);
            const result = await service.handleAction(body);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: err?.message || "Unknown error" }));
        }
        return;
    }

    // Static files
    await serveStatic(res, req.url);
});

server.listen(PORT, () => {
    console.log(`\n🔐 PasswordManeger Mobile`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Data: ${dataDir}\n`);
});

process.on("SIGINT", () => { service.dispose(); process.exit(0); });
process.on("SIGTERM", () => { service.dispose(); process.exit(0); });
