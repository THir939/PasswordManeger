import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, "windows-hello.ps1");

function decodeJson(stdout) {
  const raw = String(stdout || "").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function encodeMessage(message = "") {
  return Buffer.from(String(message || ""), "utf8").toString("base64");
}

function resolvePowerShellCommand() {
  return process.env.PM_WINDOWS_HELLO_POWERSHELL || "powershell.exe";
}

export function nativeWindowHandleToInteger(windowHandleBuffer) {
  if (!Buffer.isBuffer(windowHandleBuffer) || windowHandleBuffer.length === 0) {
    return 0;
  }

  try {
    if (windowHandleBuffer.length >= 8) {
      return Number(windowHandleBuffer.readBigUInt64LE(0));
    }
    if (windowHandleBuffer.length >= 4) {
      return windowHandleBuffer.readUInt32LE(0);
    }
  } catch {
    return 0;
  }

  return 0;
}

export async function runWindowsHelloCommand(action, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32") {
    return {
      ok: false,
      supported: false,
      error: "Windows Hello は Windows でのみ使えます。"
    };
  }

  const runner = options.runner || execFileAsync;
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    options.scriptPath || scriptPath,
    action,
    encodeMessage(options.message || ""),
    String(options.windowHandle || 0)
  ];

  const { stdout } = await runner(resolvePowerShellCommand(), args, {
    windowsHide: true,
    timeout: Number(options.timeoutMs || 15_000),
    maxBuffer: 1024 * 1024
  });

  return {
    ok: true,
    supported: true,
    ...decodeJson(stdout)
  };
}

export async function checkWindowsHelloAvailability(options = {}) {
  try {
    const payload = await runWindowsHelloCommand("check", options);
    return {
      ok: Boolean(payload.ok),
      supported: Boolean(payload.supported),
      available: Boolean(payload.available),
      availability: String(payload.availability || ""),
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      supported: true,
      available: false,
      availability: "",
      error: error?.message || "Windows Hello availability check failed."
    };
  }
}

export async function requestWindowsHelloVerification(options = {}) {
  try {
    const payload = await runWindowsHelloCommand("verify", options);
    return {
      ok: Boolean(payload.ok),
      supported: Boolean(payload.supported),
      available: Boolean(payload.available),
      availability: String(payload.availability || ""),
      approved: Boolean(payload.approved),
      result: String(payload.result || ""),
      method: String(payload.method || ""),
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      supported: true,
      available: false,
      availability: "",
      approved: false,
      result: "",
      method: "",
      error: error?.message || "Windows Hello verification failed."
    };
  }
}
