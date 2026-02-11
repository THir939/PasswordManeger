import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { apiJson, projectRoot, startTempServer } from "./e2e-helpers.mjs";

function parseToolPayload(result) {
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }

  const text = Array.isArray(result?.content)
    ? result.content.find((entry) => entry?.type === "text")?.text
    : "";

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: !result?.isError,
      raw: text
    };
  }
}

async function callTool(client, name, args = {}) {
  const result = await client.callTool({
    name,
    arguments: args
  });

  const payload = parseToolPayload(result);

  if (result?.isError || payload?.ok === false) {
    const reason = payload?.error || payload?.raw || "tool error";
    throw new Error(`${name} failed: ${reason}`);
  }

  return payload;
}

async function run() {
  const ingestToken = "mcp-test-token";
  const cloudServer = await startTempServer({
    label: "mcp-smoke",
    env: {
      ENTITLEMENT_INGEST_TOKEN: ingestToken
    }
  });

  const mcpDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "passwordmaneger-mcp-smoke-"));

  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/server.mjs"],
    cwd: projectRoot,
    stderr: "pipe",
    env: {
      PM_MCP_DATA_DIR: mcpDataDir,
      PM_MCP_WEB_BASE_URL: cloudServer.baseUrl,
      PM_MCP_ALLOW_SECRET_EXPORT: "1"
    }
  });

  const client = new Client(
    {
      name: "passwordmaneger-mcp-smoke-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = new Set((tools.tools || []).map((tool) => tool.name));
    assert.equal(toolNames.has("pm_get_state"), true, "pm_get_state should exist");
    assert.equal(toolNames.has("pm_cloud_sync_push"), true, "pm_cloud_sync_push should exist");

    const email = `mcp-smoke-${Date.now()}@example.com`;
    const accountPassword = "mcp-account-password-12345";
    const masterPassword = "mcp-master-password-12345";

    const register = await callTool(client, "pm_cloud_register", {
      email,
      password: accountPassword,
      baseUrl: cloudServer.baseUrl
    });
    assert.equal(register.connected, true, "cloud register should connect");

    const setup = await callTool(client, "pm_setup_vault", {
      masterPassword
    });
    assert.equal(setup.created, true, "vault should be created");

    const saved = await callTool(client, "pm_save_item", {
      type: "login",
      title: "MCP Test Account",
      username: email,
      password: "McpPass!234",
      url: "https://example.com/login"
    });
    assert.ok(saved.item?.id, "save item should return id");

    const listedMasked = await callTool(client, "pm_list_items", {
      type: "login"
    });
    assert.equal(listedMasked.itemCount >= 1, true, "should list at least one item");
    assert.equal(listedMasked.items[0].password, "***", "password should be masked by default");

    const listedFull = await callTool(client, "pm_list_items", {
      type: "login",
      includeSecrets: true
    });
    assert.equal(listedFull.items[0].password, "McpPass!234", "password should be visible when includeSecrets=true");

    const prePush = await client.callTool({
      name: "pm_cloud_sync_push",
      arguments: {}
    });
    assert.equal(Boolean(prePush?.isError), true, "non-paid user push should fail");

    const ingest = await apiJson(cloudServer.baseUrl, "/api/entitlements/ingest", {
      method: "POST",
      headers: {
        "x-entitlement-token": ingestToken
      },
      body: {
        email,
        source: "manual",
        sourceRef: `manual_${Date.now()}`,
        status: "active",
        feature: "cloud_sync"
      }
    });
    assert.equal(ingest.ok, true, "entitlement ingest should succeed");

    const pushed = await callTool(client, "pm_cloud_sync_push");
    assert.equal(pushed.pushed, true, "cloud sync push should succeed for paid user");
    assert.equal(Number(pushed.revision), 1, "first push should set revision=1");

    const entitlements = await callTool(client, "pm_cloud_entitlements_status");
    assert.equal(
      Boolean(entitlements.features?.cloud_sync?.isPaid),
      true,
      "entitlements should be unified as paid"
    );

    const pulled = await callTool(client, "pm_cloud_sync_pull");
    assert.equal(pulled.pulled, true, "cloud sync pull should return pulled=true");

    const state = await callTool(client, "pm_get_state");
    assert.equal(state.local.initialized, true, "vault should stay initialized");
    assert.equal(Boolean(state.cloud.connected), true, "cloud should stay connected");

    console.log("PASS mcp smoke (register/vault/save/entitlement/sync)");
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
    await fs.rm(mcpDataDir, { recursive: true, force: true });
    await cloudServer.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
