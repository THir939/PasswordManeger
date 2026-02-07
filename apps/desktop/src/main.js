import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, clipboard, ipcMain, shell } from "electron";
import { DesktopVaultService } from "./vault-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const extensionPath = workspaceRoot;
const webBaseUrl = process.env.PM_WEB_BASE_URL || "http://localhost:8787";

let mainWindow = null;
let vaultService = null;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f4eee4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
    return {
      ok: true,
      platform: process.platform,
      extensionPath,
      webBaseUrl
    };
  });
}

async function bootstrap() {
  const dataDir = path.join(app.getPath("userData"), "data");
  vaultService = new DesktopVaultService({
    dataDir,
    extensionPath,
    webBaseUrl,
    defaultCloudBaseUrl: webBaseUrl
  });

  registerIpcHandlers();
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
  vaultService?.dispose();
});
