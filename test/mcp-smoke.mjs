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

    // === New feature tests ===

    // Re-unlock vault (cloudSyncPull resets session)
    await callTool(client, "pm_unlock_vault", { masterPassword });

    // 1. Agent save credential (OpenClaw等がID/パスワードを保存)
    const agentSaved = await callTool(client, "pm_agent_save_credential", {
      url: "https://service.example.com",
      username: "agent-user@test.com",
      password: "AgentPass!567",
      agentName: "openclaw",
      notes: "Discovered during automated setup"
    });
    assert.ok(agentSaved.item?.id, "agent save credential should return id");
    assert.equal(agentSaved.item.tags.includes("agent:openclaw"), true, "should have agent tag");

    // 2. Audit log (操作ログ確認)
    const auditAll = await callTool(client, "pm_audit_log", {});
    assert.equal(auditAll.count > 0, true, "audit log should have entries");

    const auditFiltered = await callTool(client, "pm_audit_log", {
      filterAction: "agentSaveCredential"
    });
    assert.equal(auditFiltered.count >= 1, true, "audit log should have agentSaveCredential entry");

    // 3. Read-only mode (読み取り専用モード)
    const modeSet = await callTool(client, "pm_set_access_mode", { mode: "readonly" });
    assert.equal(modeSet.accessMode, "readonly", "access mode should be readonly");

    const readonlySave = await client.callTool({
      name: "pm_save_item",
      arguments: {
        type: "login",
        title: "Should Fail",
        password: "NoSave!234"
      }
    });
    assert.equal(Boolean(readonlySave?.isError), true, "save should fail in readonly mode");

    // Restore full access
    await callTool(client, "pm_set_access_mode", { mode: "full" });

    // 4. Scoped unlock (スコープ付きアンロック)
    // First, save an item with specific tag
    const scopedItem = await callTool(client, "pm_save_item", {
      type: "login",
      title: "Scoped Test",
      username: "scoped-user",
      password: "ScopedPass!234",
      tags: ["team-a"]
    });

    // Lock and re-unlock with scope
    await callTool(client, "pm_lock_vault");
    const scopedUnlock = await callTool(client, "pm_unlock_vault_scoped", {
      masterPassword,
      scopeTags: ["team-a"],
      sessionTtlSeconds: 300
    });
    assert.ok(scopedUnlock.sessionId, "scoped unlock should return sessionId");
    assert.ok(scopedUnlock.scope, "scoped unlock should return scope");
    assert.ok(scopedUnlock.expiresAt, "scoped unlock should return expiresAt");

    const scopedList = await callTool(client, "pm_list_items", {});
    const scopedIds = (scopedList.items || []).map((i) => i.id);
    assert.equal(scopedIds.includes(scopedItem.item.id), true, "scoped list should include team-a item");

    // 5. Re-lock and unlock with TTL (短寿命セッション)
    await callTool(client, "pm_lock_vault");
    const ttlUnlock = await callTool(client, "pm_unlock_vault", {
      masterPassword,
      sessionTtlSeconds: 600
    });
    assert.ok(ttlUnlock.expiresAt, "TTL unlock should return expiresAt");
    assert.ok(ttlUnlock.sessionId, "TTL unlock should return sessionId");

    // Get state should include new session info
    const stateAfter = await callTool(client, "pm_get_state");
    assert.ok(stateAfter.local.sessionId, "state should include sessionId");

    console.log("PASS mcp smoke (register/vault/save/entitlement/sync/agent-features)");
  } finally {
    await client.close().catch(() => { });
    await transport.close().catch(() => { });
    await fs.rm(mcpDataDir, { recursive: true, force: true });
    await cloudServer.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
