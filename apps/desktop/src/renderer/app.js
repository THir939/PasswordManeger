import { passwordStrength } from "@pm/core/password";

const bridge = window.pmDesktop || null;

const elements = {
  status: document.querySelector("#status"),
  setupView: document.querySelector("#setup-view"),
  unlockView: document.querySelector("#unlock-view"),
  mainView: document.querySelector("#main-view"),

  setupForm: document.querySelector("#setup-form"),
  setupPassword: document.querySelector("#setup-password"),
  setupConfirm: document.querySelector("#setup-confirm"),
  setupPasswordToggle: document.querySelector("#setup-password-toggle"),
  setupConfirmToggle: document.querySelector("#setup-confirm-toggle"),
  setupPasswordStrength: document.querySelector("#setup-password-strength"),

  unlockForm: document.querySelector("#unlock-form"),
  unlockPassword: document.querySelector("#unlock-password"),
  unlockPasswordToggle: document.querySelector("#unlock-password-toggle"),

  lockButton: document.querySelector("#lock-btn"),
  exportButton: document.querySelector("#export-btn"),
  importButton: document.querySelector("#import-btn"),
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
  cloudPasswordToggle: document.querySelector("#cloud-password-toggle"),
  cloudPasswordStrength: document.querySelector("#cloud-password-strength"),
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
  itemPasswordToggle: document.querySelector("#item-password-toggle"),
  itemPasswordStrength: document.querySelector("#item-password-strength"),
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

  tagFilterBar: document.querySelector("#tag-filter-bar"),
  tagFilterBadges: document.querySelector("#tag-filter-badges"),
  tagFilterInput: document.querySelector("#tag-filter-input"),
  tagFilterSuggestions: document.querySelector("#tag-filter-suggestions"),
  tagFilterModeBtn: document.querySelector("#tag-filter-mode-btn"),
  tagFilterClearBtn: document.querySelector("#tag-filter-clear-btn"),

  folderTree: document.querySelector("#folder-tree"),
  newFolderBtn: document.querySelector("#new-folder-btn"),
  itemsPanelTitle: document.querySelector("#items-panel-title"),

  itemTagBadges: document.querySelector("#item-tag-badges"),
  itemTagSuggestions: document.querySelector("#item-tag-suggestions"),
  itemFolderSelect: document.querySelector("#item-folder-select"),
  itemFolderInput: document.querySelector("#item-folder-input"),

  refreshReportButton: document.querySelector("#refresh-report"),
  reportBox: document.querySelector("#report-box"),

  settingsForm: document.querySelector("#settings-form"),
  settingAutoLock: document.querySelector("#setting-autolock"),
  settingClipboard: document.querySelector("#setting-clipboard"),

  masterForm: document.querySelector("#master-form"),
  oldMaster: document.querySelector("#old-master"),
  newMaster: document.querySelector("#new-master"),
  oldMasterToggle: document.querySelector("#old-master-toggle"),
  newMasterToggle: document.querySelector("#new-master-toggle"),
  newMasterStrength: document.querySelector("#new-master-strength")
};

const state = {
  settings: null,
  currentItems: [],
  cloudStatus: null,
  platformInfo: null,
  migrationDraft: null,
  currentTab: "items",
  allTags: [],
  plainTags: [],
  folderTags: [],
  folderTree: {},
  selectedTagFilters: [],
  tagFilterMode: "or",
  selectedFolder: "",
  itemTagList: []
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

function strengthLabel(complexity) {
  if (complexity === "very-strong") return "非常に強い";
  if (complexity === "strong") return "強い";
  if (complexity === "fair") return "標準";
  if (complexity === "weak") return "弱い";
  return "非常に弱い";
}

function paintStrength(meterElement, password, minLength = 0) {
  if (!meterElement) {
    return;
  }

  const fill = meterElement.querySelector(".strength-fill");
  const text = meterElement.querySelector(".strength-text");
  const value = String(password || "");
  const result = passwordStrength(value);
  const level = value ? result.complexity : "very-weak";
  const firstFeedback = result.feedback?.[0] || "";
  const minLengthNote = minLength > 0 && value.length > 0 && value.length < minLength ? `最低 ${minLength} 文字以上が必要です。` : "";
  const message =
    value.length === 0
      ? "強度: 未入力"
      : `強度: ${strengthLabel(level)} (${result.score}/100)${minLengthNote ? ` / ${minLengthNote}` : firstFeedback ? ` / ${firstFeedback}` : ""}`;

  meterElement.classList.remove("is-very-weak", "is-weak", "is-fair", "is-strong", "is-very-strong");
  meterElement.classList.add(`is-${level}`);

  if (fill) {
    fill.style.width = `${value.length === 0 ? 0 : result.score}%`;
  }
  if (text) {
    text.textContent = message;
  }
}

function bindVisibilityToggle(inputElement, toggleButton) {
  if (!inputElement || !toggleButton) {
    return;
  }

  const render = () => {
    const hidden = inputElement.type === "password";
    toggleButton.textContent = hidden ? "表示" : "隠す";
    toggleButton.setAttribute("aria-pressed", hidden ? "false" : "true");
    toggleButton.setAttribute("aria-label", hidden ? "パスワードを表示" : "パスワードを隠す");
  };

  toggleButton.addEventListener("click", () => {
    inputElement.type = inputElement.type === "password" ? "text" : "password";
    render();
  });

  render();
}

function bindPasswordAssistUi() {
  const fields = [
    {
      input: elements.setupPassword,
      toggle: elements.setupPasswordToggle,
      meter: elements.setupPasswordStrength,
      minLength: 10
    },
    {
      input: elements.setupConfirm,
      toggle: elements.setupConfirmToggle
    },
    {
      input: elements.unlockPassword,
      toggle: elements.unlockPasswordToggle
    },
    {
      input: elements.cloudPassword,
      toggle: elements.cloudPasswordToggle,
      meter: elements.cloudPasswordStrength,
      minLength: 10
    },
    {
      input: elements.itemPassword,
      toggle: elements.itemPasswordToggle,
      meter: elements.itemPasswordStrength,
      minLength: 10
    },
    {
      input: elements.oldMaster,
      toggle: elements.oldMasterToggle
    },
    {
      input: elements.newMaster,
      toggle: elements.newMasterToggle,
      meter: elements.newMasterStrength,
      minLength: 10
    }
  ];

  fields.forEach(({ input, toggle, meter, minLength }) => {
    bindVisibilityToggle(input, toggle);
    if (meter && input) {
      paintStrength(meter, input.value, minLength);
      input.addEventListener("input", () => {
        paintStrength(meter, input.value, minLength);
      });
    }
  });
}

function refreshPasswordStrengthUi() {
  paintStrength(elements.setupPasswordStrength, elements.setupPassword?.value, 10);
  paintStrength(elements.cloudPasswordStrength, elements.cloudPassword?.value, 10);
  paintStrength(elements.itemPasswordStrength, elements.itemPassword?.value, 10);
  paintStrength(elements.newMasterStrength, elements.newMaster?.value, 10);
}

async function callService(action, payload = {}) {
  if (!bridge || typeof bridge.call !== "function") {
    throw new Error("Desktop連携の初期化に失敗しました。Desktopアプリとして起動し直してください。");
  }
  const response = await bridge.call(action, payload);
  if (!response?.ok) {
    throw new Error(response?.error || "処理に失敗しました。");
  }
  return response;
}

async function openExternal(url) {
  if (!bridge || typeof bridge.openExternal !== "function") {
    throw new Error("Desktop連携が利用できません。");
  }
  const response = await bridge.openExternal(url);
  if (!response?.ok) {
    throw new Error(response?.error || "URLを開けませんでした。");
  }
}

async function openPath(targetPath) {
  if (!bridge || typeof bridge.openPath !== "function") {
    throw new Error("Desktop連携が利用できません。");
  }
  const response = await bridge.openPath(targetPath);
  if (!response?.ok) {
    throw new Error(response?.error || "フォルダを開けませんでした。");
  }
}

async function copyText(text) {
  if (!bridge || typeof bridge.copyText !== "function") {
    throw new Error("Desktop連携が利用できません。");
  }
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
    onlyFavorites: elements.onlyFavorite.checked,
    tags: state.selectedTagFilters.length > 0 ? state.selectedTagFilters : undefined,
    tagMode: state.tagFilterMode,
    folder: state.selectedFolder || undefined
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
  // タグバッジリセット
  state.itemTagList = [];
  renderItemTagBadges();
  // フォルダリセット
  if (elements.itemFolderSelect) elements.itemFolderSelect.value = "";
  if (elements.itemFolderInput) elements.itemFolderInput.value = "";
  updateTypeVisibility();
  refreshPasswordStrengthUi();
}

function itemToMeta(item) {
  const lines = [];

  if (item.username) lines.push(item.username);
  if (item.url) lines.push(item.url);
  if (item.tags?.length) lines.push(`タグ: ${item.tags.join(", ")}`);
  if (item.type === "card" && item.cardNumber) lines.push(`カード末尾: ${item.cardNumber.slice(-4)}`);
  if (item.type === "identity" && item.email) lines.push(item.email);
  if (item.updatedAt) lines.push(`更新: ${new Date(item.updatedAt).toLocaleDateString()}`);

  return lines.filter(Boolean).join("\n");
}

function renderItems(items) {
  state.currentItems = items;

  if (!items.length) {
    showEmpty(elements.itemList, "一致する項目はありません。");
    return;
  }

  const typeIcons = {
    login: "🔑",
    card: "💳",
    identity: "👤",
    note: "📝"
  };
  const typeClass = {
    login: "login",
    card: "card-type",
    identity: "identity",
    note: "note"
  };

  elements.itemList.innerHTML = items
    .map((item) => {
      const otpButton = item.otpSecret
        ? `<button type="button" data-action="totp" data-id="${escapeHtml(item.id)}" class="ghost">OTP</button>`
        : "";
      const favStar = item.favorite ? '<span class="fav-star">★</span>' : "";
      const icon = typeIcons[item.type] || "🔑";
      const cls = typeClass[item.type] || "login";
      const detailLines = itemToMeta(item).split("\n").filter(Boolean);
      const primaryMeta = detailLines[0] || item.type;
      const secondaryMeta = detailLines.slice(1, 3).join(" / ");

      return `
        <li class="card">
          <div class="card-head">
            <div class="card-icon ${cls}">${icon}</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(item.title)}${favStar}</p>
              <p class="meta meta-primary">${escapeHtml(primaryMeta)}</p>
              ${secondaryMeta ? `<p class="meta meta-secondary">${escapeHtml(secondaryMeta)}</p>` : ""}
            </div>
          </div>
          <div class="card-actions">
            <button type="button" data-action="copy-user" data-id="${escapeHtml(item.id)}" class="ghost">IDコピー</button>
            <button type="button" data-action="copy-pass" data-id="${escapeHtml(item.id)}" class="ghost">PWコピー</button>
            ${otpButton}
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="ghost">編集</button>
            <button type="button" data-action="delete" data-id="${escapeHtml(item.id)}" class="ghost danger">削除</button>
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

async function loadTags() {
  try {
    const response = await callService("getTags");
    state.allTags = response.allTags || [];
    state.plainTags = response.plainTags || [];
    state.folderTags = response.folderTags || [];
    state.folderTree = response.folderTree || {};
    renderFolderTree();
    updateFolderSelect();
  } catch {
    // タグ取得に失敗してもクラッシュさせない
  }
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
  if (!bridge || typeof bridge.getPlatformInfo !== "function") {
    throw new Error("Desktop連携情報を取得できません。Desktopアプリとして起動してください。");
  }
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
  elements.itemTags.value = "";
  elements.itemNotes.value = item.notes || "";
  elements.itemFavorite.checked = Boolean(item.favorite);

  // タグとフォルダを分離してバッジ描画
  const folderTags = (item.tags || []).filter((t) => t.startsWith("folder:"));
  const plainTags = (item.tags || []).filter((t) => !t.startsWith("folder:"));
  state.itemTagList = plainTags;
  renderItemTagBadges();

  // フォルダ選択の復元
  const folderPath = folderTags.length > 0 ? folderTags[0].slice("folder:".length) : "";
  if (elements.itemFolderSelect) {
    const opt = [...elements.itemFolderSelect.options].find((o) => o.value === folderPath);
    if (opt) {
      elements.itemFolderSelect.value = folderPath;
      if (elements.itemFolderInput) elements.itemFolderInput.value = "";
    } else if (folderPath) {
      elements.itemFolderSelect.value = "";
      if (elements.itemFolderInput) elements.itemFolderInput.value = folderPath;
    } else {
      elements.itemFolderSelect.value = "";
      if (elements.itemFolderInput) elements.itemFolderInput.value = "";
    }
  }

  updateTypeVisibility();
  elements.cancelEdit.classList.remove("hidden");
  refreshPasswordStrengthUi();
  setStatus(`編集モード: ${item.title}`, false);
  switchTab("add-edit");
}

function buildItemFromForm() {
  // プレーンタグ（バッジUIから）
  const tags = [...state.itemTagList];

  // フォルダタグを追加
  const folderValue = (elements.itemFolderInput?.value.trim() || elements.itemFolderSelect?.value || "");
  if (folderValue) {
    const folderTag = `folder:${folderValue}`;
    if (!tags.includes(folderTag)) tags.push(folderTag);
  }

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
    tags,
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
  await Promise.all([loadPlatformInfo(), loadSettings(), loadTags(), loadItems(), loadSecurityReport(), loadCloudStatus()]);
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
      refreshPasswordStrengthUi();
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
      refreshPasswordStrengthUi();
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

  elements.importButton?.addEventListener("click", () => {
    elements.importInput?.click();
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
      refreshPasswordStrengthUi();
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
      await Promise.all([loadTags(), loadItems(), loadSecurityReport()]);
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
      refreshPasswordStrengthUi();
      setStatus("マスターパスワードを変更しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

/* === Folder Tree === */
function renderFolderTree() {
  const el = elements.folderTree;
  if (!el) return;

  function buildNodes(tree, prefix) {
    return Object.keys(tree).map((name) => {
      const fullPath = prefix ? `${prefix}/${name}` : name;
      const children = buildNodes(tree[name], fullPath);
      const isActive = state.selectedFolder === fullPath;
      return `
        <li class="folder-tree-item${isActive ? " active" : ""}" data-folder="${escapeHtml(fullPath)}">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(name)}</span>
          ${children.length > 0 ? `<ul class="folder-subtree">${children.join("")}</ul>` : ""}
        </li>`;
    });
  }

  const allActive = state.selectedFolder === "";
  const nodes = buildNodes(state.folderTree, "");
  el.innerHTML = `
    <li class="folder-tree-item${allActive ? " active" : ""}" data-folder="">
      <span class="folder-icon">🏠</span>
      <span class="folder-name">すべて</span>
    </li>
    ${nodes.join("")}`;
}

function updateFolderSelect() {
  const sel = elements.itemFolderSelect;
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">フォルダなし</option>`;
  for (const tag of state.folderTags) {
    const path = tag.slice("folder:".length);
    const opt = document.createElement("option");
    opt.value = path;
    opt.textContent = path;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === current)) {
    sel.value = current;
  }
}

/* === Tag Badges (Item Form) === */
function renderItemTagBadges() {
  const el = elements.itemTagBadges;
  if (!el) return;
  if (state.itemTagList.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = state.itemTagList
    .map(
      (tag, i) =>
        `<span class="tag-badge">
          ${escapeHtml(tag)}
          <button type="button" class="tag-badge-remove" data-tag-index="${i}" aria-label="タグ削除">×</button>
        </span>`
    )
    .join("");
}

function addItemTag(tag) {
  const t = tag.trim();
  if (!t || state.itemTagList.includes(t)) return;
  state.itemTagList.push(t);
  renderItemTagBadges();
}

function removeItemTag(index) {
  state.itemTagList.splice(index, 1);
  renderItemTagBadges();
}

/* === Tag Suggestions === */
function buildSuggestionList(input, suggestionsEl, tagPool, onSelect) {
  if (!input || !suggestionsEl) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const filtered = query
      ? tagPool().filter((t) => t.toLowerCase().includes(query))
      : tagPool().slice(0, 20);

    if (filtered.length === 0) {
      suggestionsEl.classList.add("hidden");
      return;
    }
    suggestionsEl.innerHTML = filtered
      .map((t) => `<div class="tag-suggestion-item" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</div>`)
      .join("");
    suggestionsEl.classList.remove("hidden");
  });

  input.addEventListener("blur", () => {
    setTimeout(() => suggestionsEl.classList.add("hidden"), 180);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim() === "" && tagPool().length > 0) {
      const filtered = tagPool().slice(0, 20);
      suggestionsEl.innerHTML = filtered
        .map((t) => `<div class="tag-suggestion-item" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</div>`)
        .join("");
      suggestionsEl.classList.remove("hidden");
    }
  });

  suggestionsEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".tag-suggestion-item");
    if (!item) return;
    e.preventDefault();
    onSelect(item.dataset.tag);
    input.value = "";
    suggestionsEl.classList.add("hidden");
  });
}

/* === Tag Filter Bar === */
function renderTagFilterBadges() {
  const el = elements.tagFilterBadges;
  if (!el) return;
  if (state.selectedTagFilters.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = state.selectedTagFilters
    .map(
      (tag, i) =>
        `<span class="tag-badge filter-badge">
          ${escapeHtml(tag)}
          <button type="button" class="tag-badge-remove" data-filter-index="${i}" aria-label="タグフィルター削除">×</button>
        </span>`
    )
    .join("");
}

function addTagFilter(tag) {
  const t = tag.trim();
  if (!t || state.selectedTagFilters.includes(t)) return;
  state.selectedTagFilters.push(t);
  renderTagFilterBadges();
  loadItems().catch((e) => setStatus(e.message, true));
}

function removeTagFilter(index) {
  state.selectedTagFilters.splice(index, 1);
  renderTagFilterBadges();
  loadItems().catch((e) => setStatus(e.message, true));
}

function bindFolderTagEvents() {
  // --- フォルダツリー ---
  const folderTreeEl = elements.folderTree;
  if (folderTreeEl) {
    folderTreeEl.addEventListener("click", (e) => {
      const item = e.target.closest(".folder-tree-item");
      if (!item) return;
      const folder = item.dataset.folder;
      state.selectedFolder = folder;
      renderFolderTree();
      // パネルタイトル更新
      if (elements.itemsPanelTitle) {
        elements.itemsPanelTitle.textContent = folder ? `📁 ${folder}` : "すべてのアイテム";
      }
      loadItems().catch((err) => setStatus(err.message, true));
      // アイテムタブに切り替え
      switchTab("items");
    });
  }

  // --- 新しいフォルダ作成ボタン ---
  const newFolderBtn = elements.newFolderBtn;
  if (newFolderBtn) {
    newFolderBtn.addEventListener("click", () => {
      const name = window.prompt("新しいフォルダ名を入力してください（/ で階層化）:");
      if (!name?.trim()) return;
      // フォルダ選択入力に反映してタブ切り替え
      if (elements.itemFolderInput) elements.itemFolderInput.value = name.trim();
      if (elements.itemFolderSelect) elements.itemFolderSelect.value = "";
      switchTab("add-edit");
    });
  }

  // --- 編集フォーム: タグ入力 ---
  const tagInput = elements.itemTags;
  const tagSug = elements.itemTagSuggestions;

  if (tagInput) {
    buildSuggestionList(
      tagInput,
      tagSug,
      () => state.plainTags.filter((t) => !state.itemTagList.includes(t)),
      (tag) => {
        addItemTag(tag);
      }
    );

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = tagInput.value.replace(/,/g, "").trim();
        if (val) {
          addItemTag(val);
          tagInput.value = "";
          if (tagSug) tagSug.classList.add("hidden");
        }
      } else if (e.key === "Backspace" && tagInput.value === "" && state.itemTagList.length > 0) {
        removeItemTag(state.itemTagList.length - 1);
      }
    });
  }

  // --- タグバッジ: 削除 (編集フォーム) ---
  const tagBadgesEl = elements.itemTagBadges;
  if (tagBadgesEl) {
    tagBadgesEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".tag-badge-remove");
      if (!btn) return;
      const idx = Number(btn.dataset.tagIndex);
      removeItemTag(idx);
    });
  }

  // --- フォルダ選択: selectとfreeテキストの排他制御 ---
  const folderSel = elements.itemFolderSelect;
  const folderInp = elements.itemFolderInput;
  if (folderSel && folderInp) {
    folderSel.addEventListener("change", () => {
      if (folderSel.value) folderInp.value = "";
    });
    folderInp.addEventListener("input", () => {
      if (folderInp.value.trim()) folderSel.value = "";
    });
  }

  // --- タグフィルターバー ---
  const filterInput = elements.tagFilterInput;
  const filterSug = elements.tagFilterSuggestions;

  if (filterInput) {
    buildSuggestionList(
      filterInput,
      filterSug,
      () => state.plainTags.filter((t) => !state.selectedTagFilters.includes(t)),
      (tag) => {
        addTagFilter(tag);
        filterInput.value = "";
      }
    );

    filterInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = filterInput.value.trim();
        if (val) {
          addTagFilter(val);
          filterInput.value = "";
          if (filterSug) filterSug.classList.add("hidden");
        }
      }
    });
  }

  // --- タグフィルターバッジ削除 ---
  const filterBadgesEl = elements.tagFilterBadges;
  if (filterBadgesEl) {
    filterBadgesEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".tag-badge-remove");
      if (!btn) return;
      const idx = Number(btn.dataset.filterIndex);
      removeTagFilter(idx);
    });
  }

  // --- AND/ORトグル ---
  const modeBtn = elements.tagFilterModeBtn;
  if (modeBtn) {
    modeBtn.addEventListener("click", () => {
      state.tagFilterMode = state.tagFilterMode === "or" ? "and" : "or";
      modeBtn.textContent = state.tagFilterMode.toUpperCase();
      modeBtn.classList.toggle("mode-and", state.tagFilterMode === "and");
      if (state.selectedTagFilters.length > 0) {
        loadItems().catch((e) => setStatus(e.message, true));
      }
    });
  }

  // --- タグフィルタークリア ---
  const clearBtn = elements.tagFilterClearBtn;
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.selectedTagFilters = [];
      renderTagFilterBadges();
      loadItems().catch((e) => setStatus(e.message, true));
    });
  }
}

/* --- Tab Switching --- */
function switchTab(tabName) {
  state.currentTab = tabName;

  // Update sidebar buttons
  document.querySelectorAll("#tabbar .sidebar-btn[data-tab]").forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Show/hide tab panels
  document.querySelectorAll(".tab-panel[data-tab-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.tabPanel !== tabName);
  });
}

function bindTabEvents() {
  document.querySelectorAll("#tabbar .sidebar-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Sync API URL from advanced settings to hidden field
  const advancedUrlInput = document.querySelector("#cloud-base-url-setting");
  if (advancedUrlInput) {
    advancedUrlInput.addEventListener("change", () => {
      const hiddenUrl = document.querySelector("#cloud-base-url");
      if (hiddenUrl) {
        hiddenUrl.value = advancedUrlInput.value.trim() || "http://localhost:8787";
      }
    });
  }
}

async function bootstrap() {
  bindPasswordAssistUi();
  bindEvents();
  bindTabEvents();
  bindFolderTagEvents();
  clearItemForm();
  refreshPasswordStrengthUi();

  if (!bridge) {
    setView("setup");
    setStatus("Desktop連携が見つかりません。ブラウザではなく Desktop アプリとして起動してください。", true);
    return;
  }

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
    setView("setup");
    setStatus(error.message, true);
  }
}

bootstrap();
