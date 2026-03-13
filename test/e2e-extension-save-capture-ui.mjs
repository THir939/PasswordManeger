import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
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
  const server = await startTempServer({ label: "ext-save-ui" });
  const extensionPath = projectRoot;
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "passwordmaneger-ext-save-ui-profile-"));
  const username = "captured-user@example.com";
  const password = "Captured-password-5678";

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.PM_E2E_HEADLESS === "1",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    const serviceWorker = await getServiceWorker(context);
    const extensionId = new URL(serviceWorker.url()).host;
    const setupPage = await context.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
      waitUntil: "domcontentloaded"
    });

    const state = await sendToBackground(setupPage, "getState");
    if (!state.initialized) {
      await sendToBackground(setupPage, "setupVault", {
        masterPassword: "E2E-master-password-12345"
      });
      await setupPage.reload({ waitUntil: "domcontentloaded" });
    }
    await setupPage.close();

    const demoPage = await context.newPage();
    await demoPage.goto(`${server.baseUrl}/demo/login.html`, { waitUntil: "domcontentloaded" });
    await demoPage.fill('input[name="email"]', username);
    await demoPage.fill('input[name="password"]', password);
    await demoPage.click('button[type="submit"]');

    await delay(500);

    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
      waitUntil: "domcontentloaded"
    });

    const pending = await sendToBackground(extensionPage, "getPendingCaptures");
    assert.equal(pending.captures.length, 1, "login submit should create one pending capture");

    await extensionPage.bringToFront();
    await extensionPage.waitForSelector("#pending-capture-list .card");
    await extensionPage.click('#pending-capture-list button[data-action="save-capture"]');

    await delay(300);

    const pendingAfter = await sendToBackground(extensionPage, "getPendingCaptures");
    assert.equal(pendingAfter.captures.length, 0, "saving capture should clear pending capture");

    const items = await sendToBackground(extensionPage, "listItems", {
      filters: { search: username, type: "login", onlyFavorites: false }
    });
    const saved = (items.items || []).find((item) => item.username === username && item.password === password);
    assert.ok(saved, "popup save action should create a login item");

    console.log("PASS extension e2e (capture -> popup save candidate -> vault item)");
  } finally {
    if (context) {
      await context.close();
    }
    await fs.rm(userDataDir, { recursive: true, force: true });
    await server.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
