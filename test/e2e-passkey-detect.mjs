import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, _electron as electron } from "playwright";
import { delay, projectRoot, startTempServer } from "./e2e-helpers.mjs";

async function getServiceWorker(context) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 20_000 });
  }
  return serviceWorker;
}

async function sendToBackground(extensionPage, action, payload = {}) {
  const result = await extensionPage.evaluate(
    ({ actionName, actionPayload }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: actionName,
            ...(actionPayload || {})
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({
                ok: false,
                error: chrome.runtime.lastError.message
              });
              return;
            }
            resolve(response || { ok: false, error: "response is empty" });
          }
        );
      }),
    {
      actionName: action,
      actionPayload: payload
    }
  );

  if (!result?.ok) {
    throw new Error(`Background action failed: ${action} / ${result?.error || "unknown"}`);
  }

  return result;
}

async function run() {
  const server = await startTempServer({ label: "ext-passkey-e2e" });
  const extensionPath = projectRoot;
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "passwordmaneger-ext-passkey-profile-"));
  const desktopDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "passwordmaneger-desktop-passkey-profile-"));

  let context;
  let desktopApp;
  try {
    desktopApp = await electron.launch({
      args: ["apps/desktop"],
      env: {
        ...process.env,
        PM_WEB_BASE_URL: server.baseUrl,
        PM_DATA_DIR: desktopDataDir,
        PM_PASSKEY_APPROVAL_MODE: "mock-approve"
      }
    });
    const desktopWindow = await desktopApp.firstWindow();
    await desktopWindow.waitForLoadState("domcontentloaded");

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.PM_E2E_HEADLESS === "1",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    const serviceWorker = await getServiceWorker(context);
    const extensionId = new URL(serviceWorker.url()).host;
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
      waitUntil: "domcontentloaded"
    });

    const state = await sendToBackground(extensionPage, "getState");
    if (!state.initialized) {
      await sendToBackground(extensionPage, "setupVault", {
        masterPassword: "E2E-passkey-master-password-12345"
      });
    } else if (!state.unlocked) {
      await sendToBackground(extensionPage, "unlockVault", {
        masterPassword: "E2E-passkey-master-password-12345"
      }).catch(() => null);
    }

    await sendToBackground(extensionPage, "saveSettings", {
      settings: {
        passkeyProxyEnabled: true,
        passkeyDesktopApprovalEnabled: true
      }
    });
    await extensionPage.waitForFunction(
      () =>
        new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "getState" }, (response) => {
            resolve(Boolean(response?.ok && response?.desktopPasskeyBridge?.available));
          });
        }),
      null,
      { timeout: 10_000 }
    );

    const demoPage = await context.newPage();
    await demoPage.goto(`${server.baseUrl}/demo/passkey.html`, { waitUntil: "domcontentloaded" });
    await demoPage.waitForSelector("#register-passkey");
    await delay(400);

    await demoPage.click("#register-passkey");
    await delay(300);
    const pendingCreate = await sendToBackground(extensionPage, "getPendingPasskeyApprovals");
    assert.equal(pendingCreate.approvals.length, 0, "desktop approval should avoid popup approval queue");
    await demoPage.waitForFunction(() => document.querySelector("#passkey-log")?.textContent?.includes("create 成功"), null, { timeout: 10_000 });

    const createList = await sendToBackground(extensionPage, "listItems", {
      filters: { type: "passkey" }
    });
    assert.equal(createList.items.length, 1, "register event should save one passkey item");
    assert.equal(createList.items[0].passkey.rpId, "localhost");
    assert.equal(Boolean(createList.items[0].passkey.privateKeyJwk?.d), true, "software authenticator should persist a private key");
    assert.equal(createList.items[0].passkey.event, "create");
    assert.equal(createList.items[0].passkey.proxyProvider, "software");
    assert.equal(createList.items[0].passkey.approvalMethod, "mock-approve");

    await demoPage.click("#authenticate-passkey");
    await delay(300);
    const pendingGet = await sendToBackground(extensionPage, "getPendingPasskeyApprovals");
    assert.equal(pendingGet.approvals.length, 0, "desktop approval should avoid popup approval queue");
    await demoPage.waitForFunction(() => document.querySelector("#passkey-log")?.textContent?.includes("get 成功"), null, { timeout: 10_000 });

    const getList = await sendToBackground(extensionPage, "listItems", {
      filters: { type: "passkey" }
    });
    assert.equal(getList.items.length, 1, "get event should update existing passkey item instead of duplicating");
    assert.equal(getList.items[0].passkey.event, "get");
    assert.equal(Boolean(getList.items[0].passkey.lastUsedAt), true, "get event should stamp lastUsedAt");
    assert.equal(Number(getList.items[0].passkey.signCount || 0) >= 1, true, "get event should increment signCount");
    assert.equal(getList.items[0].passkey.approvalMethod, "mock-approve");

    console.log("PASS extension e2e (real webauthn create/get via desktop approval bridge -> save -> update)");
  } finally {
    if (context) {
      await context.close();
    }
    if (desktopApp) {
      await desktopApp.close();
    }
    await fs.rm(userDataDir, { recursive: true, force: true });
    await fs.rm(desktopDataDir, { recursive: true, force: true });
    await server.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
