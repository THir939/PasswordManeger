import { passwordStrength } from "../lib/password.js";

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
  addItemButton: document.querySelector("#fab-add-btn"),

  tabbar: document.querySelector("#tabbar"),
  tabButtons: [...document.querySelectorAll("#tabbar .tab")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],

  autofillList: document.querySelector("#autofill-list"),
  pageHost: document.querySelector("#page-host"),

  // Items panel shared elements
  itemFormSection: document.querySelector("#item-form-section"),
  itemFormTitle: document.querySelector("#item-form-title"),
  closeItemFormButton: document.querySelector("#close-item-form"),
  itemsPanelTitle: document.querySelector("#items-panel-title"),
  itemsCount: document.querySelector("#items-count"),

  // Sidebar user
  sidebarAvatar: document.querySelector("#sidebar-avatar"),
  sidebarUsername: document.querySelector("#sidebar-username"),

  // Migrate
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
  aliasButton: document.querySelector("#alias-btn"),
  cancelEdit: document.querySelector("#cancel-edit"),

  // Subscription fields
  itemIsSubscription: document.querySelector("#item-is-subscription"),
  subscriptionDetails: document.querySelector("#subscription-details"),
  itemSubAmount: document.querySelector("#item-sub-amount"),
  itemSubCurrency: document.querySelector("#item-sub-currency"),
  itemSubCycle: document.querySelector("#item-sub-cycle"),
  itemSubNextBilling: document.querySelector("#item-sub-next-billing"),

  // Subscriptions tab
  refreshSubsButton: document.querySelector("#refresh-subs"),
  subMonthlyTotal: document.querySelector("#sub-monthly-total"),
  subYearlyTotal: document.querySelector("#sub-yearly-total"),
  subCount: document.querySelector("#sub-count"),
  subList: document.querySelector("#sub-list"),

  searchInput: document.querySelector("#search-input"),
  filterType: document.querySelector("#filter-type"),
  onlyFavorite: document.querySelector("#only-favorite"),
  itemList: document.querySelector("#item-list"),

  refreshReportButton: document.querySelector("#refresh-report"),
  reportBox: document.querySelector("#report-box"),

  settingsForm: document.querySelector("#settings-form"),
  settingAutoLock: document.querySelector("#setting-autolock"),
  settingClipboard: document.querySelector("#setting-clipboard"),
  settingAliasEmail: document.querySelector("#setting-alias-email"),
  aliasSettingsForm: document.querySelector("#alias-settings-form"),

  masterForm: document.querySelector("#master-form"),
  oldMaster: document.querySelector("#old-master"),
  newMaster: document.querySelector("#new-master"),
  oldMasterToggle: document.querySelector("#old-master-toggle"),
  newMasterToggle: document.querySelector("#new-master-toggle"),
  newMasterStrength: document.querySelector("#new-master-strength"),

  // Deadman's Switch
  deadmanForm: document.querySelector("#deadman-form"),
  deadmanEnabled: document.querySelector("#deadman-enabled"),
  deadmanDays: document.querySelector("#deadman-days"),
  deadmanContactList: document.querySelector("#deadman-contact-list"),
  deadmanAddContact: document.querySelector("#deadman-add-contact"),
  deadmanStatus: document.querySelector("#deadman-status"),

  // Generator
  genResult: document.querySelector("#gen-result"),
  genCopyButton: document.querySelector("#gen-copy-btn"),
  genNewButton: document.querySelector("#gen-new-btn"),
  genStrength: document.querySelector("#gen-strength")
};

// Category tab → panel mapping & filter config
const CATEGORY_TABS = {
  "pinned": { panel: "items", filterType: "all", onlyFavorites: true, title: "ピン留め" },
  "all-items": { panel: "items", filterType: "all", onlyFavorites: false, title: "すべてのアイテム" },
  "logins": { panel: "items", filterType: "login", onlyFavorites: false, title: "ログイン" },
  "cards": { panel: "items", filterType: "card", onlyFavorites: false, title: "カード" },
  "identities": { panel: "items", filterType: "identity", onlyFavorites: false, title: "個人情報" },
  "notes": { panel: "items", filterType: "note", onlyFavorites: false, title: "メモ" },
  "autofill": { panel: "autofill", title: "自動入力" },
  "generator": { panel: "generator", title: "パスワード生成器" },
  "security": { panel: "security", title: "セキュリティ" },
  "subscriptions": { panel: "subscriptions", title: "サブスク管理" },
  "migrate": { panel: "migrate", title: "クラウド同期" },
  "settings": { panel: "settings", title: "設定" }
};

const state = {
  settings: null,
  currentItems: [],
  cloudStatus: null,
  currentDomain: "",
  migrationDraft: null,
  currentTab: "all-items",
  currentSort: "az"
};

// --- Sort Tabs Logic ---
const sortTabs = document.querySelectorAll("#sort-tabs .filter-tab");
sortTabs.forEach(tab => {
  tab.addEventListener("click", (e) => {
    sortTabs.forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");
    state.currentSort = e.target.dataset.sort;
    if (state.currentItems) {
      renderItems(state.currentItems);
    }
  });
});

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", Boolean(message) && isError);
  elements.status.classList.toggle("ok", Boolean(message) && !isError);
}

function setView(viewName) {
  elements.setupView.classList.add("hidden");
  elements.unlockView.classList.add("hidden");
  elements.mainView.classList.add("hidden");

  if (viewName === "setup") elements.setupView.classList.remove("hidden");
  if (viewName === "unlock") elements.unlockView.classList.remove("hidden");
  if (viewName === "main") {
    elements.mainView.classList.remove("hidden");
    setTab(state.currentTab || "all-items");
  }
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

function setTab(tabName) {
  if (!elements.tabButtons.length) {
    return;
  }

  const next = String(tabName || "all-items");
  const config = CATEGORY_TABS[next];
  if (!config) return;

  state.currentTab = next;

  // Update sidebar buttons
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.tab === next;
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.classList.toggle("active", active);
    button.tabIndex = active ? 0 : -1;
  });

  // Show/hide panels based on the category config
  const targetPanel = config.panel;
  elements.tabPanels.forEach((panel) => {
    const panelName = panel.dataset.tabPanel;
    const active = panelName === targetPanel;
    panel.classList.toggle("hidden", !active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });

  // If this is an items category, apply filters
  if (config.panel === "items") {
    if (config.filterType) {
      elements.filterType.value = config.filterType;
    }
    if (elements.onlyFavorite) {
      elements.onlyFavorite.checked = Boolean(config.onlyFavorites);
    }
    if (elements.itemsPanelTitle) {
      elements.itemsPanelTitle.textContent = config.title;
    }
    loadItems().catch((error) => setStatus(error.message, true));
  }
}

function moveTabFocus(currentButton, direction) {
  const tabs = elements.tabButtons;
  const currentIndex = tabs.findIndex((button) => button === currentButton);
  if (currentIndex < 0) {
    return;
  }

  let nextIndex = currentIndex;
  if (direction === "next") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (direction === "prev") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (direction === "first") {
    nextIndex = 0;
  } else if (direction === "last") {
    nextIndex = tabs.length - 1;
  }

  const nextButton = tabs[nextIndex];
  if (!nextButton) {
    return;
  }

  setTab(nextButton.dataset.tab || "all-items");
  nextButton.focus();
}

async function callBackground(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || "処理に失敗しました。");
  }
  return response;
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

function riskLabel(risk) {
  if (!risk) {
    return "評価なし";
  }
  if (risk.level === "high") {
    return `高リスク (${risk.score})`;
  }
  if (risk.level === "medium") {
    return `注意 (${risk.score})`;
  }
  return `低リスク (${risk.score})`;
}

function riskChipClass(risk) {
  if (!risk) {
    return "chip-risk-unknown";
  }
  if (risk.level === "high") {
    return "chip-risk-high";
  }
  if (risk.level === "medium") {
    return "chip-risk-medium";
  }
  return "chip-risk-low";
}

function riskChipText(risk) {
  if (!risk) {
    return "評価なし";
  }
  if (risk.level === "high") {
    return `高 ${risk.score}`;
  }
  if (risk.level === "medium") {
    return `注意 ${risk.score}`;
  }
  return `低 ${risk.score}`;
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

function showItemForm(title = "新規追加") {
  elements.itemFormSection.classList.remove("hidden");
  elements.itemFormTitle.textContent = title;
}

function hideItemForm() {
  elements.itemFormSection.classList.add("hidden");
  clearItemForm();
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
  // Subscription
  elements.itemIsSubscription.checked = false;
  elements.itemSubAmount.value = "";
  elements.itemSubCurrency.value = "JPY";
  elements.itemSubCycle.value = "monthly";
  elements.itemSubNextBilling.value = "";
  elements.subscriptionDetails.classList.add("hidden");
  elements.cancelEdit.classList.add("hidden");
  updateTypeVisibility();
  refreshPasswordStrengthUi();
}

function itemToMeta(item) {
  const lines = [];

  if (item.username) lines.push(item.username);
  if (item.url) lines.push(item.url);
  if (item.tags?.length) lines.push(`タグ: ${item.tags.join(", ")}`);
  if (item.type === "card" && item.cardNumber) lines.push(`末尾: ${item.cardNumber.slice(-4)}`);
  if (item.type === "identity" && item.email) lines.push(item.email);

  return lines.join("\n");
}

function renderItems(items) {
  // Update count
  if (elements.itemsCount) {
    elements.itemsCount.textContent = `${items.length}件`;
  }

  if (!items.length) {
    showEmpty(elements.itemList, "一致する項目はありません。");
    return;
  }

  state.currentItems = items;

  // Apply Sorting
  let sortedItems = [...items];
  if (state.currentSort === "az") {
    // A-Z Order
    sortedItems.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (state.currentSort === "recent") {
    // Recent Usage Order (Assuming lastUsed property exists, otherwise fallback to updatedAt)
    sortedItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } else if (state.currentSort === "popular") {
    // Popularity Order (Assuming usageCount or favorite)
    sortedItems.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.usageCount || 0) - (a.usageCount || 0);
    });
  }

  elements.itemList.innerHTML = sortedItems
    .map((item) => {
      const favStar = item.favorite ? '<span class="fav-star" style="color:var(--accent-yellow); margin-left:4px;">★</span>' : "";
      const initials = item.title ? item.title.charAt(0).toUpperCase() : "?";
      const detailLines = itemToMeta(item).split("\n").filter(Boolean);
      const primaryMeta = detailLines[0] || item.type;
      const secondaryMeta = detailLines.slice(1, 3).join(" / ");

      return `
        <li class="card">
          <div class="card-head card-head-compact">
            <div class="card-logo">${initials}</div>
            <div class="card-info card-info-compact">
              <p class="card-title card-title-compact">
                ${escapeHtml(item.title)}${favStar}
              </p>
              <p class="meta meta-primary">${escapeHtml(primaryMeta)}</p>
              ${secondaryMeta ? `<p class="meta meta-secondary">${escapeHtml(secondaryMeta)}</p>` : ""}
            </div>
          </div>
          <div class="card-actions card-actions-compact">
            <button type="button" data-action="autofill" data-id="${escapeHtml(item.id)}" class="ghost card-action-primary">自動入力</button>
            <button type="button" data-action="copy-user" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="IDをコピー">ID</button>
            <button type="button" data-action="copy-pass" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="パスワードをコピー">PW</button>
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="編集">✎</button>
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadItems() {
  const response = await callBackground("listItems", { filters: currentFilters() });
  renderItems(response.items || []);
}

function renderSuggestions(domain, items) {
  state.currentDomain = domain || "";
  elements.pageHost.textContent = domain ? `現在のドメイン: ${domain}` : "現在のタブ情報を取得できませんでした。";

  if (!items.length) {
    showEmpty(elements.autofillList, "このサイト向けログインはまだありません。");
    return;
  }

  elements.autofillList.innerHTML = items
    .map((item) => {
      const username = item.username || "ユーザー名未設定";
      const risk = item.autofillRisk;
      const reasons = Array.isArray(risk?.reasons) ? risk.reasons : [];
      const metaLines = [username, reasons.length ? `理由: ${reasons.join(" / ")}` : ""].filter(Boolean).join("\n");

      return `
        <li class="card">
          <div class="card-head">
            <div class="card-icon login">🔑</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(item.title)}</p>
              <div class="chips">
                <span class="chip ${riskChipClass(risk)}" title="${escapeHtml(riskLabel(risk))}">${escapeHtml(riskChipText(risk))}</span>
              </div>
            </div>
          </div>
          <p class="meta">${escapeHtml(metaLines)}</p>
          <div class="card-actions">
            <button type="button" data-action="suggest-fill" data-id="${escapeHtml(item.id)}" class="ghost">このサイトに入力</button>
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadSuggestions() {
  const response = await callBackground("getSuggestionsForActiveTab");
  renderSuggestions(response.domain, response.items || []);
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
  const response = await callBackground("getSecurityReport");
  elements.reportBox.textContent = buildReportText(response.report);
}

async function loadSettings() {
  const response = await callBackground("getSettings");
  state.settings = response.settings;
  elements.settingAutoLock.value = state.settings.autoLockMinutes;
  elements.settingClipboard.value = state.settings.clipboardClearSeconds;
  if (elements.settingAliasEmail) {
    elements.settingAliasEmail.value = state.settings.aliasBaseEmail || "";
  }
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
  const payload = await callBackground("cloudStatus");
  state.cloudStatus = payload;
  elements.cloudStatusBox.textContent = buildCloudStatusText(payload);

  if (payload.baseUrl && !elements.cloudBaseUrl.value) {
    elements.cloudBaseUrl.value = payload.baseUrl;
  }

  // Update sidebar user info from cloud status
  if (payload?.connected && payload.user?.email) {
    const email = payload.user.email;
    const initial = email.charAt(0).toUpperCase();
    elements.sidebarAvatar.textContent = initial;
    elements.sidebarUsername.textContent = email.split("@")[0];
  }
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

  // Subscription
  const sub = item.subscription || {};
  elements.itemIsSubscription.checked = Boolean(sub.isSubscription);
  elements.itemSubAmount.value = sub.amount || "";
  elements.itemSubCurrency.value = sub.currency || "JPY";
  elements.itemSubCycle.value = sub.cycle || "monthly";
  elements.itemSubNextBilling.value = sub.nextBillingDate || "";
  elements.subscriptionDetails.classList.toggle("hidden", !sub.isSubscription);

  updateTypeVisibility();
  elements.cancelEdit.classList.remove("hidden");
  refreshPasswordStrengthUi();
  showItemForm(`編集: ${item.title}`);
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
    favorite: elements.itemFavorite.checked,
    subscription: {
      isSubscription: elements.itemIsSubscription.checked,
      amount: Number(elements.itemSubAmount.value) || 0,
      currency: elements.itemSubCurrency.value,
      cycle: elements.itemSubCycle.value,
      nextBillingDate: elements.itemSubNextBilling.value
    }
  };
}

async function copyWithAutoClear(text) {
  await navigator.clipboard.writeText(text);
  setStatus("クリップボードへコピーしました。", false);

  const clearAfter = Number(state.settings?.clipboardClearSeconds || 0);
  if (clearAfter > 0) {
    window.setTimeout(async () => {
      try {
        await navigator.clipboard.writeText("");
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
    baseUrl: elements.cloudBaseUrl.value.trim() || "http://localhost:8787",
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

  const { preview } = await callBackground("previewExternalImport", request);
  state.migrationDraft = {
    ...request,
    preview
  };

  elements.migrationPreviewBox.classList.remove("hidden");
  elements.migrationPreviewBox.textContent = buildMigrationPreviewText(preview);
  return state.migrationDraft;
}

async function refreshMainScreen() {
  await loadSettings();
  await Promise.all([
    loadItems(),
    loadSuggestions(),
    loadSecurityReport(),
    loadCloudStatus(),
    loadSubscriptionSummary(),
    loadDeadmanConfig()
  ]);
}

/* -------------- Subscriptions -------------- */

function formatCurrency(amount, currency) {
  const symbols = { JPY: "¥", USD: "$", EUR: "€" };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString()}`;
}

function cycleLabel(cycle) {
  if (cycle === "yearly") return "年額";
  if (cycle === "weekly") return "週額";
  return "月額";
}

async function loadSubscriptionSummary() {
  try {
    const response = await callBackground("getSubscriptionSummary");
    const summary = response.summary;
    if (!summary) return;

    elements.subMonthlyTotal.textContent = formatCurrency(summary.monthlyTotal, summary.currency);
    elements.subYearlyTotal.textContent = formatCurrency(summary.yearlyTotal, summary.currency);
    elements.subCount.textContent = String(summary.count);

    if (!summary.items.length) {
      showEmpty(elements.subList, "サブスク登録がありません。パスワード管理タブで項目にサブスク情報を追加してください。");
      return;
    }

    elements.subList.innerHTML = summary.items
      .map((item) => `
        <li class="card">
          <div class="card-head">
            <div class="card-icon card-type">💳</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(item.title)}</p>
              <p class="meta">${escapeHtml(cycleLabel(item.cycle))} ${escapeHtml(formatCurrency(item.amount, item.currency))} → 月額 ${escapeHtml(formatCurrency(item.monthlyAmount, item.currency))}</p>
            </div>
          </div>
          ${item.nextBillingDate ? `<p class="meta">次回請求: ${escapeHtml(item.nextBillingDate)}</p>` : ""}
        </li>
      `)
      .join("");
  } catch {
    // subscription loading failure is non-critical
  }
}

/* -------------- Deadman's Switch -------------- */

let deadmanContacts = [];

function renderDeadmanContacts() {
  elements.deadmanContactList.innerHTML = deadmanContacts
    .map((contact, index) => `
      <div class="deadman-contact-row" style="display: flex; gap: 6px; margin-bottom: 6px;">
        <input type="text" value="${escapeHtml(contact.name)}" placeholder="名前" data-dm-field="name" data-dm-index="${index}" style="flex: 1;" />
        <input type="email" value="${escapeHtml(contact.email)}" placeholder="メールアドレス" data-dm-field="email" data-dm-index="${index}" style="flex: 1.5;" />
        <button type="button" class="ghost danger" data-dm-remove="${index}" style="padding: 6px 8px; font-size: 11px;">✕</button>
      </div>
    `)
    .join("");

  // Bind inline events
  elements.deadmanContactList.querySelectorAll("[data-dm-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = Number(input.dataset.dmIndex);
      const field = input.dataset.dmField;
      if (deadmanContacts[idx]) {
        deadmanContacts[idx][field] = input.value;
      }
    });
  });

  elements.deadmanContactList.querySelectorAll("[data-dm-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.dmRemove);
      deadmanContacts.splice(idx, 1);
      renderDeadmanContacts();
    });
  });
}

async function loadDeadmanConfig() {
  try {
    const response = await callBackground("getDeadmanConfig");
    const config = response.config;
    if (!config) return;

    elements.deadmanEnabled.checked = config.enabled;
    elements.deadmanDays.value = config.inactiveDays || 90;
    deadmanContacts = Array.isArray(config.contacts) ? [...config.contacts] : [];
    renderDeadmanContacts();

    if (config.lastHeartbeat) {
      elements.deadmanStatus.textContent = `最終ハートビート: ${new Date(config.lastHeartbeat).toLocaleString()}`;
    } else {
      elements.deadmanStatus.textContent = "未記録";
    }
  } catch {
    // deadman config loading is non-critical
  }
}

function bindEvents() {
  elements.tabbar?.addEventListener("click", (event) => {
    const target = event.target.closest(".sidebar-btn.tab");
    if (!target) return;

    const tab = target.dataset.tab;
    if (!tab) return;

    setTab(tab);
  });

  elements.tabbar?.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      moveTabFocus(target, "next");
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveTabFocus(target, "prev");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveTabFocus(target, "first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveTabFocus(target, "last");
    }
  });

  // Add item button
  elements.addItemButton?.addEventListener("click", () => {
    // Navigate to all-items tab and show form
    setTab("all-items");
    clearItemForm();
    showItemForm("新規追加");
  });

  // Close item form button
  elements.closeItemFormButton?.addEventListener("click", () => {
    hideItemForm();
  });

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
      await callBackground("setupVault", { masterPassword: password });
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
      await callBackground("unlockVault", { masterPassword: elements.unlockPassword.value });
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
    await callBackground("lockVault");
    setView("unlock");
    clearItemForm();
    setStatus("Vaultをロックしました。", false);
  });

  elements.exportButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("exportBackup");
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
      await callBackground("importBackup", { envelope });
      setView("unlock");
      setStatus("バックアップを復元しました。解錠してください。", false);
    } catch (error) {
      setStatus(`復元に失敗: ${error.message}`, true);
    }
  });

  elements.migrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const draft = state.migrationDraft || (await buildMigrationDraftFromForm());

      const result = await callBackground("applyExternalImport", {
        provider: draft.provider,
        rawText: draft.rawText,
        filename: draft.filename,
        replaceExisting: draft.replaceExisting
      });

      await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
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
      const response = await callBackground("cloudRegister", cloudCredentials());
      await loadCloudStatus();
      setStatus(`クラウド登録完了: ${response.user.email}`, false);
    } catch (error) {
      setStatus(`クラウド登録失敗: ${error.message}`, true);
    }
  });

  elements.cloudLoginButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("cloudLogin", cloudCredentials());
      await loadCloudStatus();
      setStatus(`クラウドログイン成功: ${response.user.email}`, false);
    } catch (error) {
      setStatus(`クラウドログイン失敗: ${error.message}`, true);
    }
  });

  elements.cloudLogoutButton.addEventListener("click", async () => {
    try {
      await callBackground("cloudLogout");
      await loadCloudStatus();
      setStatus("クラウド連携を解除しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cloudPullButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("cloudSyncPull");
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
      const response = await callBackground("cloudSyncPush");
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
      const response = await callBackground("generatePassword");
      elements.itemPassword.value = response.password;
      refreshPasswordStrengthUi();
      setStatus("強力なパスワードを生成しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Alias generation
  elements.aliasButton?.addEventListener("click", async () => {
    try {
      const domain = state.currentDomain || "";
      const response = await callBackground("generateEmailAlias", { mode: "domain", domain });
      elements.itemUsername.value = response.alias;
      setStatus(`エイリアスメールを生成しました: ${response.alias}`, false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Subscription toggle
  elements.itemIsSubscription?.addEventListener("change", () => {
    elements.subscriptionDetails.classList.toggle("hidden", !elements.itemIsSubscription.checked);
  });

  elements.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await callBackground("saveItem", { item: buildItemFromForm() });
      setStatus("項目を保存しました。", false);
      hideItemForm();
      await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cancelEdit.addEventListener("click", () => {
    hideItemForm();
    setStatus("編集をキャンセルしました。", false);
  });

  let searchTimer = null;
  elements.searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      loadItems().catch((error) => setStatus(error.message, true));
    }, 180);
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
        await callBackground("deleteItem", { id });
        await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
        setStatus("項目を削除しました。", false);
        return;
      }

      if (action === "autofill") {
        const { risk } = await callBackground("checkAutofillRisk", { id });
        let forceHighRisk = false;

        if (risk.level === "high") {
          forceHighRisk = window.confirm(
            `高リスク判定です（${risk.score}）。\n理由: ${risk.reasons.join(" / ")}\nそれでも入力しますか？`
          );
          if (!forceHighRisk) {
            setStatus("高リスクのため自動入力を中止しました。", false);
            return;
          }
        }

        const response = await callBackground("autofillActiveTab", { id, forceHighRisk });
        const learnedText = response.learned ? " フォーム学習を更新しました。" : "";
        setStatus(`アクティブタブへ自動入力しました（${riskLabel(response.risk)}）。${learnedText}`, false);
        await loadSuggestions();
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
        const totp = await callBackground("generateTotp", { secret: item.otpSecret });
        await copyWithAutoClear(totp.code);
        setStatus(`OTP: ${totp.code}（残り ${totp.expiresIn} 秒）`, false);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.autofillList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || action !== "suggest-fill") {
      return;
    }

    try {
      const { risk } = await callBackground("checkAutofillRisk", { id });
      let forceHighRisk = false;
      if (risk.level === "high") {
        forceHighRisk = window.confirm(
          `高リスク判定です（${risk.score}）。\n理由: ${risk.reasons.join(" / ")}\nそれでも入力しますか？`
        );
        if (!forceHighRisk) {
          setStatus("高リスクのため自動入力を中止しました。", false);
          return;
        }
      }

      const response = await callBackground("autofillActiveTab", { id, forceHighRisk });
      const learnedText = response.learned ? " フォーム学習を更新しました。" : "";
      setStatus(`候補を使って自動入力しました（${riskLabel(response.risk)}）。${learnedText}`, false);
      await loadSuggestions();
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
      await callBackground("saveSettings", {
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
      await callBackground("changeMasterPassword", {
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

  // Alias settings
  elements.aliasSettingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await callBackground("saveSettings", {
        settings: {
          ...state.settings,
          aliasBaseEmail: elements.settingAliasEmail.value.trim()
        }
      });
      await loadSettings();
      setStatus("エイリアス設定を保存しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Subscription tab
  elements.refreshSubsButton?.addEventListener("click", async () => {
    try {
      await loadSubscriptionSummary();
      setStatus("サブスク情報を更新しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Deadman's Switch
  elements.deadmanAddContact?.addEventListener("click", () => {
    if (deadmanContacts.length >= 5) {
      setStatus("連絡先は最大5人までです。", true);
      return;
    }
    deadmanContacts.push({ name: "", email: "" });
    renderDeadmanContacts();
  });

  elements.deadmanForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const config = {
        enabled: elements.deadmanEnabled.checked,
        inactiveDays: Number(elements.deadmanDays.value) || 90,
        contacts: deadmanContacts.filter((c) => c.email)
      };
      await callBackground("saveDeadmanConfig", { config });
      await loadDeadmanConfig();
      setStatus("デジタル遺言設定を保存しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Generator tab
  elements.genNewButton?.addEventListener("click", async () => {
    try {
      const response = await callBackground("generatePassword");
      elements.genResult.value = response.password;
      paintStrength(elements.genStrength, response.password);
      setStatus("パスワードを生成しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.genCopyButton?.addEventListener("click", async () => {
    const pw = elements.genResult.value;
    if (!pw) {
      setStatus("先にパスワードを生成してください。", true);
      return;
    }
    await copyWithAutoClear(pw);
  });
}

async function bootstrap() {
  bindPasswordAssistUi();
  bindEvents();
  clearItemForm();
  refreshPasswordStrengthUi();

  try {
    const response = await callBackground("getState");

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
