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
  const server = await startTempServer({ label: "ext-e2e" });
  const extensionPath = projectRoot;
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "passwordmaneger-ext-e2e-profile-"));
  const username = "e2e-user@example.com";
  const password = "e2e-password-1234";

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
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
      waitUntil: "domcontentloaded"
    });
    const demoPage = await context.newPage();
    await demoPage.goto(`${server.baseUrl}/demo/learn-login.html`, { waitUntil: "domcontentloaded" });
    await demoPage.waitForSelector("#pm-learning-form");
    await demoPage.bringToFront();

    const state = await sendToBackground(extensionPage, "getState");
    if (!state.initialized) {
      await sendToBackground(extensionPage, "setupVault", {
        masterPassword: "E2E-master-password-12345"
      });
    }

    const saveResult = await sendToBackground(extensionPage, "saveItem", {
      item: {
        type: "login",
        title: "E2E Learn Login",
        username,
        password,
        url: `${server.baseUrl}/demo/learn-login.html`
      }
    });

    const itemId = saveResult.item?.id;
    assert.ok(itemId, "saveItem should return item id");

    await demoPage.bringToFront();
    await delay(100);
    await sendToBackground(extensionPage, "autofillActiveTab", {
      id: itemId
    });

    const firstValues = await demoPage.evaluate(() => ({
      noise: document.querySelector("#pm-decoy")?.value || "",
      realUser: document.querySelector('[aria-label="signin-handle"]')?.value || "",
      realPass: document.querySelector('[aria-label="password"]')?.value || ""
    }));

    assert.equal(firstValues.noise, username, "first fill should hit the decoy field before learning");
    assert.equal(firstValues.realUser, "", "first fill should not reach real username before learning");
    assert.equal(firstValues.realPass, password, "password should be filled");

    await demoPage.fill('[aria-label="signin-handle"]', username);
    await demoPage.fill("#pm-decoy", "");
    await demoPage.click("#pm-submit");
    await delay(500);

    const pending = await sendToBackground(extensionPage, "getPendingCaptures");
    assert.ok(Array.isArray(pending.captures) && pending.captures.length >= 1, "submit should create pending capture");

    await demoPage.click("#pm-shuffle");
    await demoPage.click("#pm-clear");
    await demoPage.bringToFront();
    await delay(100);
    await sendToBackground(extensionPage, "autofillActiveTab", {
      id: itemId
    });

    const secondValues = await demoPage.evaluate(() => ({
      noise: document.querySelector("#pm-decoy")?.value || "",
      realUser: document.querySelector('[aria-label="signin-handle"]')?.value || "",
      realPass: document.querySelector('[aria-label="password"]')?.value || ""
    }));

    assert.equal(secondValues.realUser, username, "second fill should use learned mapping");
    assert.equal(secondValues.realPass, password, "password should still be filled after learning");
    assert.equal(secondValues.noise, "", "decoy field should stay empty after learning");

    const summary = await sendToBackground(extensionPage, "getFormLearningSummary");
    const learned = (summary.rows || []).find((row) => row.domain === "localhost" && row.mode === "login");
    assert.ok(learned, "form learning summary should include localhost/login profile");
    assert.ok(Number(learned.fillCount || 0) >= 2, "learn profile should be updated multiple times");

    console.log("PASS extension e2e (autofill -> submit -> learned mapping)");
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
