import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function fetchHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(1000)
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export async function waitForServer(baseUrl, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const health = await fetchHealth(baseUrl);
    if (health?.ok) {
      return health;
    }
    await delay(200);
  }
  throw new Error(`Server did not become healthy: ${baseUrl}`);
}

export async function startTempServer({ port = 0, label = "e2e", env = {} } = {}) {
  const selectedPort = port || (await getFreePort());
  const baseUrl = `http://localhost:${selectedPort}`;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `passwordmaneger-${label}-`));
  const dataFile = path.join(tempDir, "db.json");
  await fs.writeFile(
    dataFile,
    JSON.stringify(
      {
        users: [],
        vaults: []
      },
      null,
      2
    ),
    "utf8"
  );

  const child = spawn("node", ["server/src/server.js"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(selectedPort),
      APP_BASE_URL: baseUrl,
      CORS_ORIGIN: baseUrl,
      JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret-local-only",
      DATA_FILE: dataFile,
      ...(env || {})
    }
  });

  const stdout = [];
  const stderr = [];
  child.stdout?.on("data", (chunk) => stdout.push(String(chunk)));
  child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await waitForServer(baseUrl, 30_000);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(`${error.message}\nSTDOUT:\n${stdout.join("")}\nSTDERR:\n${stderr.join("")}`);
  }

  return {
    port: selectedPort,
    baseUrl,
    dataFile,
    tempDir,
    process: child,
    logs: {
      get stdout() {
        return stdout.join("");
      },
      get stderr() {
        return stderr.join("");
      }
    },
    async stop() {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(1500)
      ]);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

export async function apiJson(baseUrl, endpoint, { method = "GET", token = "", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status,
    ok: response.ok,
    payload
  };
}
