const bridge = window.pmDesktop;

if (!bridge) {
  throw new Error("Desktop bridge is not available.");
}

const elements = {
  status: document.querySelector("#status"),
  setupView: document.querySelector("#setup-view"),
  unlockView: document.querySelector("#unlock-view"),
  mainView: document.querySelector("#main-view"),

  setupForm: document.querySelector("#setup-form"),
  setupPassword: document.querySelector("#setup-password"),
  setupConfirm: document.querySelector("#setup-confirm"),

  unlockForm: document.querySelector("#unlock-form"),
  unlockPassword: document.querySelector("#unlock-password"),

  lockButton: document.querySelector("#lock-btn"),
  exportButton: document.querySelector("#export-btn"),
  importInput: document.querySelector("#import-input"),

  platformBox: document.querySelector("#platform-box"),
  openExtensionButton: document.querySelector("#open-extension-btn"),
  openBillingButton: document.querySelector("#open-billing-btn"),
  openEmergencyButton: document.querySelector("#open-emergency-btn"),

  migrationForm: document.querySelector("#migration-form"),
  migrationProvider: document.querySelector("#migration-provider"),
  migrationFile: document.querySelector("#migration-file"),
  migrationReplace: document.querySelector("#migration-replace"),
  migrationPreviewButton: document.querySelector("#migration-preview-btn"),
  migrationApplyButton: document.querySelector("#migration-apply-btn"),
  migrationPreviewBox: document.querySelector("#migration-preview-box"),

  cloudAuthForm: document.querySelector("#cloud-auth-form"),
  cloudBaseUrl: document.querySelector("#cloud-base-url"),
  cloudEmail: document.querySelector("#cloud-email"),
  cloudPassword: document.querySelector("#cloud-password"),
  cloudRegisterButton: document.querySelector("#cloud-register-btn"),
  cloudLoginButton: document.querySelector("#cloud-login-btn"),
  cloudLogoutButton: document.querySelector("#cloud-logout-btn"),
  cloudPullButton: document.querySelector("#cloud-pull-btn"),
  cloudPushButton: document.querySelector("#cloud-push-btn"),
  cloudRefreshButton: document.querySelector("#cloud-refresh-btn"),
  cloudStatusBox: document.querySelector("#cloud-status-box"),

  itemForm: document.querySelector("#item-form"),
  itemId: document.querySelector("#item-id"),
  itemType: document.querySelector("#item-type"),
  itemTitle: document.querySelector("#item-title"),
  itemUsername: document.querySelector("#item-username"),
  itemPassword: document.querySelector("#item-password"),
  itemUrl: document.querySelector("#item-url"),
  itemOtp: document.querySelector("#item-otp"),
  itemFullName: document.querySelector("#item-fullname"),
  itemEmail: document.querySelector("#item-email"),
  itemPhone: document.querySelector("#item-phone"),
  itemAddress: document.querySelector("#item-address"),
  itemCardHolder: document.querySelector("#item-card-holder"),
  itemCardNumber: document.querySelector("#item-card-number"),
  itemCardExpiry: document.querySelector("#item-card-expiry"),
  itemCardCvc: document.querySelector("#item-card-cvc"),
  itemTags: document.querySelector("#item-tags"),
  itemNotes: document.querySelector("#item-notes"),
  itemFavorite: document.querySelector("#item-favorite"),
  generateButton: document.querySelector("#generate-btn"),
  cancelEdit: document.querySelector("#cancel-edit"),

  searchInput: document.querySelector("#search-input"),
  filterType: document.querySelector("#filter-type"),
  onlyFavorite: document.querySelector("#only-favorite"),
  itemList: document.querySelector("#item-list"),

  refreshReportButton: document.querySelector("#refresh-report"),
  reportBox: document.querySelector("#report-box"),

  settingsForm: document.querySelector("#settings-form"),
  settingAutoLock: document.querySelector("#setting-autolock"),
  settingClipboard: document.querySelector("#setting-clipboard"),

  masterForm: document.querySelector("#master-form"),
  oldMaster: document.querySelector("#old-master"),
  newMaster: document.querySelector("#new-master")
};

const state = {
  settings: null,
  currentItems: [],
  cloudStatus: null,
  platformInfo: null,
  migrationDraft: null
};

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  const hasMessage = Boolean(message);
  elements.status.classList.toggle("error", hasMessage && isError);
  elements.status.classList.toggle("ok", hasMessage && !isError);
}

function setView(viewName) {
  elements.setupView.classList.add("hidden");
  elements.unlockView.classList.add("hidden");
  elements.mainView.classList.add("hidden");

  if (viewName === "setup") elements.setupView.classList.remove("hidden");
  if (viewName === "unlock") elements.unlockView.classList.remove("hidden");
  if (viewName === "main") elements.mainView.classList.remove("hidden");
}

async function callService(action, payload = {}) {
  const response = await bridge.call(action, payload);
  if (!response?.ok) {
    throw new Error(response?.error || "処理に失敗しました。");
  }
  return response;
}

async function openExternal(url) {
  const response = await bridge.openExternal(url);
  if (!response?.ok) {
    throw new Error(response?.error || "URLを開けませんでした。");
  }
}

async function openPath(targetPath) {
  const response = await bridge.openPath(targetPath);
  if (!response?.ok) {
    throw new Error(response?.error || "フォルダを開けませんでした。");
  }
}

async function copyText(text) {
  const response = await bridge.copyText(text);
  if (!response?.ok) {
    throw new Error(response?.error || "コピーに失敗しました。");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showEmpty(target, message) {
  target.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
}

function buildMigrationPreviewText(preview) {
  if (!preview) {
    return "差分プレビュー未実行";
  }

  const lines = [];
  lines.push(`移行元: ${preview.sourceProvider} / ${preview.format}`);
  lines.push(`置換モード: ${preview.replaceExisting ? "ON（既存削除）" : "OFF（追加）"}`);
  lines.push(`解析件数: ${preview.totalParsed}`);
  lines.push(`追加予定: ${preview.wouldAdd}`);
  lines.push(`重複スキップ予定: ${preview.wouldSkipDuplicates}`);
  lines.push(`形式不正スキップ予定: ${preview.wouldSkipInvalid}`);

  if (Array.isArray(preview.addSamples) && preview.addSamples.length) {
    lines.push("\n[追加予定サンプル]");
    preview.addSamples.slice(0, 6).forEach((item) => {
      lines.push(`- ${item.title} (${item.type})`);
    });
  }

  if (Array.isArray(preview.duplicateSamples) && preview.duplicateSamples.length) {
    lines.push("\n[重複サンプル]");
    preview.duplicateSamples.slice(0, 4).forEach((item) => {
      lines.push(`- ${item.title} (${item.type})`);
    });
  }

  if (Array.isArray(preview.invalidSamples) && preview.invalidSamples.length) {
    lines.push("\n[形式不正サンプル]");
    preview.invalidSamples.slice(0, 4).forEach((item) => {
      lines.push(`- ${item.title}: ${item.reason}`);
    });
  }

  if (Array.isArray(preview.warnings) && preview.warnings.length) {
    lines.push("\n[注意]");
    preview.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return lines.join("\n");
}

function currentFilters() {
  return {
    search: elements.searchInput.value,
    type: elements.filterType.value,
    onlyFavorites: elements.onlyFavorite.checked
  };
}

function updateTypeVisibility() {
  const type = elements.itemType.value;
  const blocks = elements.itemForm.querySelectorAll(".type-login, .type-card, .type-identity, .type-note");

  blocks.forEach((block) => {
    const allowedTypes = [...block.classList]
      .filter((name) => name.startsWith("type-"))
      .map((name) => name.replace("type-", ""));

    block.classList.toggle("hidden", !allowedTypes.includes(type));
  });

  elements.itemPassword.required = type === "login";
}

function clearItemForm() {
  elements.itemId.value = "";
  elements.itemType.value = "login";
  elements.itemTitle.value = "";
  elements.itemUsername.value = "";
  elements.itemPassword.value = "";
  elements.itemUrl.value = "";
  elements.itemOtp.value = "";
  elements.itemFullName.value = "";
  elements.itemEmail.value = "";
  elements.itemPhone.value = "";
  elements.itemAddress.value = "";
  elements.itemCardHolder.value = "";
  elements.itemCardNumber.value = "";
  elements.itemCardExpiry.value = "";
  elements.itemCardCvc.value = "";
  elements.itemTags.value = "";
  elements.itemNotes.value = "";
  elements.itemFavorite.checked = false;
  elements.cancelEdit.classList.add("hidden");
  updateTypeVisibility();
}

function itemToMeta(item) {
  const lines = [`種類: ${item.type}`];

  if (item.username) lines.push(`ユーザー: ${item.username}`);
  if (item.url) lines.push(`URL: ${item.url}`);
  if (item.tags?.length) lines.push(`タグ: ${item.tags.join(", ")}`);
  if (item.favorite) lines.push("お気に入り: はい");
  if (item.type === "card" && item.cardNumber) lines.push(`カード末尾: ${item.cardNumber.slice(-4)}`);
  if (item.type === "identity" && item.email) lines.push(`メール: ${item.email}`);
  if (item.updatedAt) lines.push(`更新: ${new Date(item.updatedAt).toLocaleString()}`);

  return lines.join("\n");
}

function renderItems(items) {
  state.currentItems = items;

  if (!items.length) {
    showEmpty(elements.itemList, "一致する項目はありません。");
    return;
  }

  elements.itemList.innerHTML = items
    .map((item) => {
      const otpButton = item.otpSecret
        ? `<button type="button" data-action="totp" data-id="${escapeHtml(item.id)}" class="ghost">OTP表示</button>`
        : "";

      return `
        <li class="card">
          <div class="card-head">
            <p class="card-title">${escapeHtml(item.title)}</p>
            <span class="small">${escapeHtml(item.type)}</span>
          </div>
          <p class="meta">${escapeHtml(itemToMeta(item))}</p>
          <div class="card-actions">
            <button type="button" data-action="copy-user" data-id="${escapeHtml(item.id)}" class="ghost">IDコピー</button>
            <button type="button" data-action="copy-pass" data-id="${escapeHtml(item.id)}" class="ghost">PWコピー</button>
            ${otpButton}
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="ghost">編集</button>
            <button type="button" data-action="delete" data-id="${escapeHtml(item.id)}" class="ghost">削除</button>
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadItems() {
  const response = await callService("listItems", { filters: currentFilters() });
  renderItems(response.items || []);
}

function buildReportText(report) {
  if (!report) {
    return "診断結果を取得できませんでした。";
  }

  const lines = [];
  lines.push(`総合スコア: ${report.score} / 100`);
  lines.push(`ログイン件数: ${report.totals.allLogins}`);
  lines.push(`弱いパスワード: ${report.totals.weak}`);
  lines.push(`古いパスワード: ${report.totals.old}`);
  lines.push(`再利用グループ: ${report.totals.reusedGroups}`);
  lines.push(`2FA設定率: ${report.totals.twoFactorCoverage}%`);

  if (report.weakItems.length) {
    lines.push("\n[弱いパスワード]");
    report.weakItems.slice(0, 5).forEach((item) => lines.push(`- ${item.title} (${item.score})`));
  }

  if (report.reusedGroups.length) {
    lines.push("\n[再利用あり]");
    report.reusedGroups.slice(0, 3).forEach((group) => lines.push(`- 同じパスワードが ${group.count} 件`));
  }

  if (report.oldItems.length) {
    lines.push("\n[更新推奨]");
    report.oldItems.slice(0, 5).forEach((item) => lines.push(`- ${item.title} (${item.ageDays} 日)`));
  }

  if (Array.isArray(report.coach) && report.coach.length) {
    lines.push("\n[改善優先度つきセキュリティコーチ]");
    report.coach.forEach((task, index) => {
      lines.push(`${index + 1}. ${task.priorityLabel}: ${task.title} (${task.affectedCount}件)`);
      lines.push(`   - 効果: ${task.impact}`);
      lines.push(`   - 次の一手: ${task.nextStep}`);
    });
  }

  return lines.join("\n");
}

async function loadSecurityReport() {
  const response = await callService("getSecurityReport");
  elements.reportBox.textContent = buildReportText(response.report);
}

async function loadSettings() {
  const response = await callService("getSettings");
  state.settings = response.settings;
  elements.settingAutoLock.value = state.settings.autoLockMinutes;
  elements.settingClipboard.value = state.settings.clipboardClearSeconds;
}

function buildCloudStatusText(payload) {
  if (!payload?.connected) {
    return "未連携（ローカルモード）";
  }

  const lines = [];
  lines.push(`接続先: ${payload.baseUrl}`);
  lines.push(`ユーザー: ${payload.user?.email || "unknown"}`);
  lines.push(`課金状態: ${payload.billing?.planStatus || payload.user?.planStatus || "unknown"}`);
  lines.push(`有料プラン: ${payload.billing?.isPaid ? "はい" : "いいえ"}`);
  lines.push(`同期リビジョン: ${payload.revision ?? 0}`);
  lines.push(`最終同期: ${payload.lastSyncAt || "未実行"}`);
  return lines.join("\n");
}

async function loadCloudStatus() {
  const payload = await callService("cloudStatus");
  state.cloudStatus = payload;
  elements.cloudStatusBox.textContent = buildCloudStatusText(payload);

  if (payload.baseUrl) {
    elements.cloudBaseUrl.value = payload.baseUrl;
  }
}

async function loadPlatformInfo() {
  const info = await bridge.getPlatformInfo();
  if (!info?.ok) {
    throw new Error(info?.error || "環境情報を取得できません。");
  }

  state.platformInfo = info;

  if (!elements.cloudBaseUrl.value.trim()) {
    elements.cloudBaseUrl.value = info.webBaseUrl;
  }

  elements.platformBox.textContent = [
    `OS: ${info.platform}`,
    `拡張機能フォルダ: ${info.extensionPath}`,
    `Webポータル: ${info.webBaseUrl}`,
    "補足: Chrome/Edgeの拡張機能画面からこのフォルダを読み込むと自動入力が使えます。"
  ].join("\n");
}

function editItem(item) {
  elements.itemId.value = item.id;
  elements.itemType.value = item.type;
  elements.itemTitle.value = item.title || "";
  elements.itemUsername.value = item.username || "";
  elements.itemPassword.value = item.password || "";
  elements.itemUrl.value = item.url || "";
  elements.itemOtp.value = item.otpSecret || "";
  elements.itemFullName.value = item.fullName || "";
  elements.itemEmail.value = item.email || "";
  elements.itemPhone.value = item.phone || "";
  elements.itemAddress.value = item.address || "";
  elements.itemCardHolder.value = item.cardHolder || "";
  elements.itemCardNumber.value = item.cardNumber || "";
  elements.itemCardExpiry.value = item.cardExpiry || "";
  elements.itemCardCvc.value = item.cardCvc || "";
  elements.itemTags.value = (item.tags || []).join(", ");
  elements.itemNotes.value = item.notes || "";
  elements.itemFavorite.checked = Boolean(item.favorite);

  updateTypeVisibility();
  elements.cancelEdit.classList.remove("hidden");
  setStatus(`編集モード: ${item.title}`, false);
}

function buildItemFromForm() {
  return {
    id: elements.itemId.value || undefined,
    type: elements.itemType.value,
    title: elements.itemTitle.value,
    username: elements.itemUsername.value,
    password: elements.itemPassword.value,
    url: elements.itemUrl.value,
    otpSecret: elements.itemOtp.value,
    fullName: elements.itemFullName.value,
    email: elements.itemEmail.value,
    phone: elements.itemPhone.value,
    address: elements.itemAddress.value,
    cardHolder: elements.itemCardHolder.value,
    cardNumber: elements.itemCardNumber.value,
    cardExpiry: elements.itemCardExpiry.value,
    cardCvc: elements.itemCardCvc.value,
    tags: elements.itemTags.value,
    notes: elements.itemNotes.value,
    favorite: elements.itemFavorite.checked
  };
}

async function copyWithAutoClear(text) {
  await copyText(text);
  setStatus("クリップボードへコピーしました。", false);

  const clearAfter = Number(state.settings?.clipboardClearSeconds || 0);
  if (clearAfter > 0) {
    window.setTimeout(async () => {
      try {
        await copyText("");
      } catch {
        // ignore clipboard clear error
      }
    }, clearAfter * 1000);
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildMigrationMessage(result) {
  const parts = [
    `移行完了: 追加 ${result.added} 件`,
    `重複スキップ ${result.skippedDuplicates} 件`,
    `形式 ${result.sourceProvider}/${result.format}`
  ];

  if (result.skippedInvalid > 0) {
    parts.push(`変換不可 ${result.skippedInvalid} 件`);
  }

  if (Array.isArray(result.warnings) && result.warnings.length) {
    parts.push(`注意: ${result.warnings[0]}`);
  }

  return parts.join(" / ");
}

function cloudCredentials() {
  return {
    baseUrl: elements.cloudBaseUrl.value.trim() || state.platformInfo?.webBaseUrl || "http://localhost:8787",
    email: elements.cloudEmail.value.trim(),
    password: elements.cloudPassword.value
  };
}

function clearMigrationDraft() {
  state.migrationDraft = null;
  elements.migrationPreviewBox.classList.add("hidden");
  elements.migrationPreviewBox.textContent = "";
}

async function buildMigrationDraftFromForm() {
  const file = elements.migrationFile.files?.[0];
  if (!file) {
    throw new Error("移行ファイルを選択してください。");
  }

  const rawText = await file.text();
  const request = {
    provider: elements.migrationProvider.value,
    rawText,
    filename: file.name,
    replaceExisting: elements.migrationReplace.checked
  };

  const { preview } = await callService("previewExternalImport", request);
  state.migrationDraft = {
    ...request,
    preview
  };

  elements.migrationPreviewBox.classList.remove("hidden");
  elements.migrationPreviewBox.textContent = buildMigrationPreviewText(preview);
  return state.migrationDraft;
}

async function refreshMainScreen() {
  await Promise.all([loadPlatformInfo(), loadSettings(), loadItems(), loadSecurityReport(), loadCloudStatus()]);
}

function bindEvents() {
  elements.setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const password = elements.setupPassword.value;
    const confirm = elements.setupConfirm.value;

    if (password !== confirm) {
      setStatus("確認パスワードが一致しません。", true);
      return;
    }

    try {
      await callService("setupVault", { masterPassword: password });
      setView("main");
      elements.setupForm.reset();
      await refreshMainScreen();
      clearItemForm();
      setStatus("Vaultを作成しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    try {
      await callService("unlockVault", { masterPassword: elements.unlockPassword.value });
      setView("main");
      elements.unlockForm.reset();
      await refreshMainScreen();
      clearItemForm();
      setStatus("Vaultを解錠しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.lockButton.addEventListener("click", async () => {
    await callService("lockVault");
    setView("unlock");
    clearItemForm();
    setStatus("Vaultをロックしました。", false);
  });

  elements.exportButton.addEventListener("click", async () => {
    try {
      const response = await callService("exportBackup");
      const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
      downloadJson(`passwordmaneger-backup-${date}.json`, response.envelope);
      setStatus("暗号化バックアップを保存しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const content = await file.text();
      const envelope = JSON.parse(content);
      await callService("importBackup", { envelope });
      setView("unlock");
      setStatus("バックアップを復元しました。解錠してください。", false);
    } catch (error) {
      setStatus(`復元に失敗: ${error.message}`, true);
    }
  });

  elements.openExtensionButton.addEventListener("click", async () => {
    try {
      await openPath(state.platformInfo?.extensionPath || "");
      setStatus("拡張機能フォルダを開きました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.openBillingButton.addEventListener("click", async () => {
    try {
      const base = state.platformInfo?.webBaseUrl || elements.cloudBaseUrl.value || "http://localhost:8787";
      await openExternal(base);
      setStatus("Web課金ページを開きました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.openEmergencyButton.addEventListener("click", async () => {
    try {
      const base = state.platformInfo?.webBaseUrl || elements.cloudBaseUrl.value || "http://localhost:8787";
      await openExternal(`${base}/?view=emergency`);
      setStatus("緊急アクセス画面を開きました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.migrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const draft = state.migrationDraft || (await buildMigrationDraftFromForm());
      const result = await callService("applyExternalImport", {
        provider: draft.provider,
        rawText: draft.rawText,
        filename: draft.filename,
        replaceExisting: draft.replaceExisting
      });

      await Promise.all([loadItems(), loadSecurityReport()]);
      elements.migrationForm.reset();
      clearMigrationDraft();
      setStatus(buildMigrationMessage(result), false);
    } catch (error) {
      setStatus(`移行に失敗: ${error.message}`, true);
    }
  });

  elements.migrationPreviewButton.addEventListener("click", async () => {
    try {
      await buildMigrationDraftFromForm();
      setStatus("差分プレビューを更新しました。内容を確認してから実行してください。", false);
    } catch (error) {
      setStatus(`プレビュー失敗: ${error.message}`, true);
    }
  });

  elements.migrationProvider.addEventListener("change", clearMigrationDraft);
  elements.migrationFile.addEventListener("change", clearMigrationDraft);
  elements.migrationReplace.addEventListener("change", clearMigrationDraft);

  elements.cloudRegisterButton.addEventListener("click", async () => {
    try {
      const response = await callService("cloudRegister", cloudCredentials());
      await loadCloudStatus();
      setStatus(`クラウド登録完了: ${response.user.email}`, false);
    } catch (error) {
      setStatus(`クラウド登録失敗: ${error.message}`, true);
    }
  });

  elements.cloudLoginButton.addEventListener("click", async () => {
    try {
      const response = await callService("cloudLogin", cloudCredentials());
      await loadCloudStatus();
      setStatus(`クラウドログイン成功: ${response.user.email}`, false);
    } catch (error) {
      setStatus(`クラウドログイン失敗: ${error.message}`, true);
    }
  });

  elements.cloudLogoutButton.addEventListener("click", async () => {
    try {
      await callService("cloudLogout");
      await loadCloudStatus();
      setStatus("クラウド連携を解除しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cloudPullButton.addEventListener("click", async () => {
    try {
      const response = await callService("cloudSyncPull");
      await loadCloudStatus();

      if (response.pulled) {
        setView("unlock");
        setStatus("クラウドデータを取得しました。安全のため再解錠してください。", false);
      } else {
        setStatus("クラウド側に同期データがありません。", false);
      }
    } catch (error) {
      setStatus(`取得失敗: ${error.message}`, true);
    }
  });

  elements.cloudPushButton.addEventListener("click", async () => {
    try {
      const response = await callService("cloudSyncPush");
      await loadCloudStatus();
      setStatus(`クラウドへ送信しました（revision ${response.revision}）。`, false);
    } catch (error) {
      setStatus(`送信失敗: ${error.message}`, true);
    }
  });

  elements.cloudRefreshButton.addEventListener("click", async () => {
    try {
      await loadCloudStatus();
      setStatus("クラウド状態を更新しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.itemType.addEventListener("change", updateTypeVisibility);

  elements.generateButton.addEventListener("click", async () => {
    try {
      const response = await callService("generatePassword");
      elements.itemPassword.value = response.password;
      setStatus("強力なパスワードを生成しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await callService("saveItem", { item: buildItemFromForm() });
      setStatus("項目を保存しました。", false);
      clearItemForm();
      await Promise.all([loadItems(), loadSecurityReport()]);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cancelEdit.addEventListener("click", () => {
    clearItemForm();
    setStatus("編集をキャンセルしました。", false);
  });

  let searchTimer = null;
  elements.searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      loadItems().catch((error) => setStatus(error.message, true));
    }, 180);
  });

  elements.filterType.addEventListener("change", () => {
    loadItems().catch((error) => setStatus(error.message, true));
  });

  elements.onlyFavorite.addEventListener("change", () => {
    loadItems().catch((error) => setStatus(error.message, true));
  });

  elements.itemList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) {
      return;
    }

    const item = state.currentItems.find((entry) => entry.id === id);

    try {
      if (action === "edit" && item) {
        editItem(item);
        return;
      }

      if (action === "delete") {
        await callService("deleteItem", { id });
        await Promise.all([loadItems(), loadSecurityReport()]);
        setStatus("項目を削除しました。", false);
        return;
      }

      if (action === "copy-user" && item?.username) {
        await copyWithAutoClear(item.username);
        return;
      }

      if (action === "copy-pass" && item?.password) {
        await copyWithAutoClear(item.password);
        return;
      }

      if (action === "totp" && item?.otpSecret) {
        const totp = await callService("generateTotp", { secret: item.otpSecret });
        await copyWithAutoClear(totp.code);
        setStatus(`OTP: ${totp.code}（残り ${totp.expiresIn} 秒）`, false);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.refreshReportButton.addEventListener("click", async () => {
    try {
      await loadSecurityReport();
      setStatus("セキュリティ診断を更新しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await callService("saveSettings", {
        settings: {
          autoLockMinutes: Number(elements.settingAutoLock.value),
          clipboardClearSeconds: Number(elements.settingClipboard.value)
        }
      });
      await loadSettings();
      setStatus("設定を保存しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.masterForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await callService("changeMasterPassword", {
        oldPassword: elements.oldMaster.value,
        newPassword: elements.newMaster.value
      });

      elements.masterForm.reset();
      setStatus("マスターパスワードを変更しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

async function bootstrap() {
  bindEvents();
  clearItemForm();

  try {
    const response = await callService("getState");

    if (!response.initialized) {
      setView("setup");
      setStatus("まずVaultを作成してください。", false);
      return;
    }

    if (!response.unlocked) {
      setView("unlock");
      setStatus("Vaultはロック中です。", false);
      return;
    }

    setView("main");
    await refreshMainScreen();
    setStatus("Vaultを読み込みました。", false);
  } catch (error) {
    setStatus(error.message, true);
  }
}

bootstrap();
