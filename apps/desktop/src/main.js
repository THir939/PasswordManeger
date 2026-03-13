import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, systemPreferences } from "electron";
import { DesktopVaultService } from "./vault-service.js";
import { PasskeyApprovalBridge } from "./passkey-approval-bridge.js";
import {
  checkWindowsHelloAvailability,
  nativeWindowHandleToInteger,
  requestWindowsHelloVerification
} from "./windows-hello.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const extensionPath = workspaceRoot;
const webBaseUrl = process.env.PM_WEB_BASE_URL || "http://localhost:8787";

let mainWindow = null;
let vaultService = null;
let passkeyApprovalBridge = null;
const desktopApprovalState = {
  platform: process.platform,
  approvalMode: "desktop-dialog",
  touchIdSupported: false,
  biometricSupported: false,
  windowsHelloSupported: false,
  windowsHelloAvailable: false,
  windowsHelloAvailability: ""
};

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");

  const window = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f4eee4",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.env.PM_DESKTOP_DEVTOOLS === "1") {
    window.webContents.openDevTools({ mode: "detach" });
  }

  return window;
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function canPromptTouchId() {
  return process.platform === "darwin" &&
    typeof systemPreferences?.canPromptTouchID === "function" &&
    Boolean(systemPreferences.canPromptTouchID());
}

function getOverrideApprovalMode() {
  const override = String(process.env.PM_PASSKEY_APPROVAL_MODE || "").trim().toLowerCase();
  if (override === "mock-approve" || override === "mock-reject") {
    return override;
  }
  return "";
}

async function refreshDesktopApprovalState() {
  const override = getOverrideApprovalMode();
  desktopApprovalState.platform = process.platform;

  if (override) {
    desktopApprovalState.approvalMode = override;
    desktopApprovalState.touchIdSupported = false;
    desktopApprovalState.biometricSupported = false;
    desktopApprovalState.windowsHelloSupported = false;
    desktopApprovalState.windowsHelloAvailable = false;
    desktopApprovalState.windowsHelloAvailability = "";
    return desktopApprovalState;
  }

  if (canPromptTouchId()) {
    desktopApprovalState.approvalMode = "touchid";
    desktopApprovalState.touchIdSupported = true;
    desktopApprovalState.biometricSupported = true;
    desktopApprovalState.windowsHelloSupported = false;
    desktopApprovalState.windowsHelloAvailable = false;
    desktopApprovalState.windowsHelloAvailability = "";
    return desktopApprovalState;
  }

  if (process.platform === "win32") {
    const status = await checkWindowsHelloAvailability();
    desktopApprovalState.approvalMode = status.available ? "windows-hello" : "desktop-dialog";
    desktopApprovalState.touchIdSupported = false;
    desktopApprovalState.biometricSupported = Boolean(status.available);
    desktopApprovalState.windowsHelloSupported = Boolean(status.supported);
    desktopApprovalState.windowsHelloAvailable = Boolean(status.available);
    desktopApprovalState.windowsHelloAvailability = status.availability || status.error || "";
    return desktopApprovalState;
  }

  desktopApprovalState.approvalMode = "desktop-dialog";
  desktopApprovalState.touchIdSupported = false;
  desktopApprovalState.biometricSupported = false;
  desktopApprovalState.windowsHelloSupported = false;
  desktopApprovalState.windowsHelloAvailable = false;
  desktopApprovalState.windowsHelloAvailability = "";
  return desktopApprovalState;
}

function getDesktopApprovalStatus() {
  return {
    ...desktopApprovalState
  };
}

function buildTouchIdReason(payload = {}) {
  const action = payload.kind === "create" ? "Passkey を登録" : "Passkey でログイン";
  const rpLabel = String(payload.rpId || payload.origin || "このサイト").trim();
  return `${rpLabel} で ${action} するには本人確認が必要です。`;
}

async function promptDesktopPasskeyApproval(payload = {}) {
  const override = getOverrideApprovalMode();
  if (override === "mock-approve") {
    return { approved: true, method: "mock-approve", reason: "approved" };
  }
  if (override === "mock-reject") {
    return { approved: false, method: "mock-reject", reason: "rejected" };
  }

  if (canPromptTouchId()) {
    try {
      await systemPreferences.promptTouchID(buildTouchIdReason(payload));
      return { approved: true, method: "touchid", reason: "approved" };
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const cancelled = message.includes("cancel") || message.includes("canceled") || message.includes("cancelled");
      if (cancelled) {
        return { approved: false, method: "touchid", reason: "rejected" };
      }
    }
  }

  if (process.platform === "win32") {
    const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow || null;
    const nativeHandle = focusedWindow ? nativeWindowHandleToInteger(focusedWindow.getNativeWindowHandle()) : 0;
    const result = await requestWindowsHelloVerification({
      message: buildTouchIdReason(payload),
      windowHandle: nativeHandle
    });

    await refreshDesktopApprovalState();

    if (result.ok && result.available) {
      const rejectedStatuses = new Set(["Canceled", "RetriesExhausted", "DeviceBusy"]);
      return {
        approved: Boolean(result.approved),
        method: result.method || "windows-hello",
        reason: result.approved ? "approved" : rejectedStatuses.has(result.result) ? "rejected" : (result.result || "rejected")
      };
    }
  }

  const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow || null;
  const actionLabel = payload.kind === "create" ? "Passkey を登録" : "Passkey でログイン";
  const detailLines = [
    `サイト: ${payload.rpId || payload.origin || "unknown"}`,
    payload.origin ? `Origin: ${payload.origin}` : "",
    payload.userName ? `ユーザー: ${payload.userName}` : "",
    "この要求を許可する場合のみ承認してください。"
  ].filter(Boolean);
  const result = await dialog.showMessageBox(focusedWindow, {
    type: "question",
    buttons: ["拒否", "承認"],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
    normalizeAccessKeys: true,
    title: "Passkey 承認",
    message: `${actionLabel} を許可しますか？`,
    detail: detailLines.join("\n")
  });

  return {
    approved: result.response === 1,
    method: "desktop-dialog",
    reason: result.response === 1 ? "approved" : "rejected"
  };
}

async function startPasskeyApprovalBridge() {
  await refreshDesktopApprovalState();
  passkeyApprovalBridge = new PasskeyApprovalBridge({
    onVerify: promptDesktopPasskeyApproval,
    getStatus: getDesktopApprovalStatus
  });

  try {
    await passkeyApprovalBridge.start();
  } catch (error) {
    console.error("Failed to start passkey approval bridge:", error);
    passkeyApprovalBridge = null;
  }
}

function registerIpcHandlers() {
  ipcMain.handle("pm:action", async (_event, payload) => {
    try {
      const result = await vaultService.handleAction(payload);
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Unknown error"
      };
    }
  });

  ipcMain.handle("pm:open-external", async (_event, url) => {
    if (!isSafeExternalUrl(url)) {
      return { ok: false, error: "URLが不正です。" };
    }

    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("pm:open-path", async (_event, targetPath) => {
    const result = await shell.openPath(String(targetPath || ""));
    if (result) {
      return { ok: false, error: result };
    }
    return { ok: true };
  });

  ipcMain.handle("pm:copy", async (_event, text) => {
    clipboard.writeText(String(text || ""));
    return { ok: true };
  });

  ipcMain.handle("pm:platform", async () => {
    await refreshDesktopApprovalState();
    const approvalStatus = getDesktopApprovalStatus();
    return {
      ok: true,
      platform: process.platform,
      extensionPath,
      webBaseUrl,
      desktopPasskeyBridgeUrl: passkeyApprovalBridge?.getUrl() || "",
      desktopPasskeyBridgeActive: Boolean(passkeyApprovalBridge),
      desktopPasskeyApprovalMode: approvalStatus.approvalMode,
      desktopTouchIdSupported: approvalStatus.touchIdSupported,
      desktopWindowsHelloSupported: approvalStatus.windowsHelloSupported,
      desktopWindowsHelloAvailable: approvalStatus.windowsHelloAvailable,
      desktopWindowsHelloAvailability: approvalStatus.windowsHelloAvailability
    };
  });
}

async function bootstrap() {
  const dataDir = process.env.PM_DATA_DIR
    ? path.resolve(process.env.PM_DATA_DIR)
    : path.join(app.getPath("userData"), "data");
  vaultService = new DesktopVaultService({
    dataDir,
    extensionPath,
    webBaseUrl,
    defaultCloudBaseUrl: webBaseUrl
  });

  registerIpcHandlers();
  await startPasskeyApprovalBridge();
  mainWindow = createMainWindow();
}

app.whenReady().then(bootstrap);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  passkeyApprovalBridge?.stop().catch(() => { });
  vaultService?.dispose();
});
