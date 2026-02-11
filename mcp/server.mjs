#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { DesktopVaultService } from "../apps/desktop/src/vault-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function resolveDataDir() {
  const envDir = String(process.env.PM_MCP_DATA_DIR || "").trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }

  return path.join(os.homedir(), ".passwordmaneger", "mcp");
}

const dataDir = resolveDataDir();
const webBaseUrl = String(process.env.PM_MCP_WEB_BASE_URL || "http://localhost:8787").trim();
const extensionPath = process.env.PM_MCP_EXTENSION_PATH
  ? path.resolve(process.cwd(), String(process.env.PM_MCP_EXTENSION_PATH))
  : projectRoot;

const service = new DesktopVaultService({
  dataDir,
  extensionPath,
  webBaseUrl,
  defaultCloudBaseUrl: webBaseUrl
});

const server = new McpServer({
  name: "passwordmaneger-mcp",
  version: "0.1.0"
});

function normalizeError(error) {
  const message = error?.message || String(error) || "Unknown error";
  return {
    ok: false,
    error: message
  };
}

function makeResult(payload) {
  const body = {
    ok: true,
    ...payload
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(body, null, 2)
      }
    ],
    structuredContent: body
  };
}

function makeErrorResult(error) {
  const payload = normalizeError(error);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

async function callAction(action, payload = {}) {
  return service.handleAction({
    action,
    ...(payload || {})
  });
}

function redactSecrets(item, includeSecrets) {
  if (includeSecrets) {
    return item;
  }

  const safe = {
    ...item
  };

  if (safe.password) {
    safe.password = "***";
  }

  if (safe.otpSecret) {
    safe.otpSecret = "***";
  }

  if (safe.cardNumber) {
    const digits = String(safe.cardNumber).replace(/\D+/g, "");
    safe.cardNumber = digits.length > 4 ? `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}` : "***";
  }

  if (safe.cardCvc) {
    safe.cardCvc = "***";
  }

  return safe;
}

function registerTool(name, definition, handler) {
  server.registerTool(name, definition, async (args) => {
    try {
      const result = await handler(args || {});
      return makeResult(result || {});
    } catch (error) {
      return makeErrorResult(error);
    }
  });
}

registerTool(
  "pm_get_state",
  {
    description: "ローカルVault状態とクラウド接続状態を取得します。",
    inputSchema: {}
  },
  async () => {
    const local = await callAction("getState");

    let cloud;
    try {
      cloud = await callAction("cloudStatus");
    } catch (error) {
      cloud = {
        connected: false,
        error: error?.message || "cloud status failed"
      };
    }

    return {
      runtime: {
        dataDir,
        webBaseUrl,
        extensionPath
      },
      local,
      cloud
    };
  }
);

registerTool(
  "pm_setup_vault",
  {
    description: "新規Vaultを初期化します。未初期化時のみ実行できます。",
    inputSchema: {
      masterPassword: z.string().min(10).describe("10文字以上のマスターパスワード")
    }
  },
  async ({ masterPassword }) => {
    return callAction("setupVault", { masterPassword });
  }
);

registerTool(
  "pm_unlock_vault",
  {
    description: "既存Vaultを解錠します。",
    inputSchema: {
      masterPassword: z.string().min(1).describe("マスターパスワード")
    }
  },
  async ({ masterPassword }) => {
    return callAction("unlockVault", { masterPassword });
  }
);

registerTool(
  "pm_lock_vault",
  {
    description: "Vaultをロックします。",
    inputSchema: {}
  },
  async () => {
    return callAction("lockVault");
  }
);

registerTool(
  "pm_list_items",
  {
    description: "Vault項目を一覧取得します。初期値では秘密値をマスクします。",
    inputSchema: {
      type: z.enum(["all", "login", "card", "identity", "note"]).optional(),
      search: z.string().optional(),
      onlyFavorites: z.boolean().optional(),
      includeSecrets: z.boolean().optional().describe("trueにするとパスワード等の秘密値も返します")
    }
  },
  async ({ type, search, onlyFavorites, includeSecrets }) => {
    const response = await callAction("listItems", {
      filters: {
        type: type || "all",
        search: search || "",
        onlyFavorites: Boolean(onlyFavorites)
      }
    });

    return {
      itemCount: Array.isArray(response.items) ? response.items.length : 0,
      includeSecrets: Boolean(includeSecrets),
      items: (response.items || []).map((item) => redactSecrets(item, Boolean(includeSecrets)))
    };
  }
);

registerTool(
  "pm_save_item",
  {
    description: "Vault項目を追加または更新します（id指定で更新）。",
    inputSchema: {
      id: z.string().optional(),
      type: z.enum(["login", "card", "identity", "note"]).optional(),
      title: z.string().min(1),
      username: z.string().optional(),
      password: z.string().optional(),
      url: z.string().optional(),
      notes: z.string().optional(),
      otpSecret: z.string().optional(),
      fullName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      cardHolder: z.string().optional(),
      cardNumber: z.string().optional(),
      cardExpiry: z.string().optional(),
      cardCvc: z.string().optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      favorite: z.boolean().optional()
    }
  },
  async (input) => {
    return callAction("saveItem", {
      item: input
    });
  }
);

registerTool(
  "pm_delete_item",
  {
    description: "Vault項目を削除します。",
    inputSchema: {
      id: z.string().min(1)
    }
  },
  async ({ id }) => {
    return callAction("deleteItem", { id });
  }
);

registerTool(
  "pm_generate_password",
  {
    description: "強力なパスワードを生成します。",
    inputSchema: {
      length: z.number().int().min(8).max(128).optional(),
      uppercase: z.boolean().optional(),
      lowercase: z.boolean().optional(),
      numbers: z.boolean().optional(),
      symbols: z.boolean().optional()
    }
  },
  async ({ length, uppercase, lowercase, numbers, symbols }) => {
    return callAction("generatePassword", {
      options: {
        ...(length !== undefined ? { length } : {}),
        ...(uppercase !== undefined ? { uppercase } : {}),
        ...(lowercase !== undefined ? { lowercase } : {}),
        ...(numbers !== undefined ? { numbers } : {}),
        ...(symbols !== undefined ? { symbols } : {})
      }
    });
  }
);

registerTool(
  "pm_generate_totp",
  {
    description: "TOTPコードを生成します。",
    inputSchema: {
      secret: z.string().min(1).describe("otpauth URL または base32 secret")
    }
  },
  async ({ secret }) => {
    return callAction("generateTotp", { secret });
  }
);

registerTool(
  "pm_security_report",
  {
    description: "セキュリティ診断（弱い/再利用/古いパスワード）を返します。",
    inputSchema: {}
  },
  async () => {
    return callAction("getSecurityReport");
  }
);

registerTool(
  "pm_preview_external_import",
  {
    description: "他サービス移行データの差分プレビューを返します。",
    inputSchema: {
      rawText: z.string().min(1),
      filename: z.string().optional(),
      provider: z.string().optional().describe("auto / 1password / bitwarden / lastpass など"),
      replaceExisting: z.boolean().optional()
    }
  },
  async ({ rawText, filename, provider, replaceExisting }) => {
    return callAction("previewExternalImport", {
      rawText,
      filename: filename || "import.txt",
      provider: provider || "auto",
      replaceExisting: Boolean(replaceExisting)
    });
  }
);

registerTool(
  "pm_apply_external_import",
  {
    description: "他サービス移行データを実際に反映します。",
    inputSchema: {
      rawText: z.string().min(1),
      filename: z.string().optional(),
      provider: z.string().optional().describe("auto / 1password / bitwarden / lastpass など"),
      replaceExisting: z.boolean().optional()
    }
  },
  async ({ rawText, filename, provider, replaceExisting }) => {
    return callAction("applyExternalImport", {
      rawText,
      filename: filename || "import.txt",
      provider: provider || "auto",
      replaceExisting: Boolean(replaceExisting)
    });
  }
);

registerTool(
  "pm_cloud_register",
  {
    description: "クラウドアカウントを新規登録してログイン状態にします。",
    inputSchema: {
      email: z.string().email(),
      password: z.string().min(10),
      baseUrl: z.string().url().optional()
    }
  },
  async ({ email, password, baseUrl }) => {
    return callAction("cloudRegister", {
      email,
      password,
      baseUrl: baseUrl || webBaseUrl
    });
  }
);

registerTool(
  "pm_cloud_login",
  {
    description: "既存クラウドアカウントでログインします。",
    inputSchema: {
      email: z.string().email(),
      password: z.string().min(1),
      baseUrl: z.string().url().optional()
    }
  },
  async ({ email, password, baseUrl }) => {
    return callAction("cloudLogin", {
      email,
      password,
      baseUrl: baseUrl || webBaseUrl
    });
  }
);

registerTool(
  "pm_cloud_logout",
  {
    description: "クラウドログイン状態をクリアします。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudLogout");
  }
);

registerTool(
  "pm_cloud_status",
  {
    description: "クラウド接続と課金状態を取得します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudStatus");
  }
);

registerTool(
  "pm_cloud_entitlements_status",
  {
    description: "利用権（エンタイトルメント）の統合ステータスを取得します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudEntitlementsStatus");
  }
);

registerTool(
  "pm_cloud_checkout_link",
  {
    description: "Stripe Checkoutリンクを生成します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudCheckoutSession");
  }
);

registerTool(
  "pm_cloud_portal_link",
  {
    description: "Stripe Billing Portalリンクを生成します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudPortalSession");
  }
);

registerTool(
  "pm_cloud_sync_push",
  {
    description: "ローカルVaultをクラウドへ同期（push）します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudSyncPush");
  }
);

registerTool(
  "pm_cloud_sync_pull",
  {
    description: "クラウドVaultをローカルへ同期（pull）します。",
    inputSchema: {}
  },
  async () => {
    return callAction("cloudSyncPull");
  }
);

const transport = new StdioServerTransport();

function cleanup() {
  service.dispose();
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

try {
  await server.connect(transport);
  console.error("PasswordManeger MCP server started");
} catch (error) {
  console.error(error);
  cleanup();
  process.exit(1);
}
