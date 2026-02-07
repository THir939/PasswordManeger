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

  domainLabel: document.querySelector("#domain-label"),
  suggestionList: document.querySelector("#suggestion-list"),
  captureList: document.querySelector("#capture-list"),

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
  currentItems: []
};

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#be123c" : "#0f766e";
}

function setView(viewName) {
  elements.setupView.classList.add("hidden");
  elements.unlockView.classList.add("hidden");
  elements.mainView.classList.add("hidden");

  if (viewName === "setup") elements.setupView.classList.remove("hidden");
  if (viewName === "unlock") elements.unlockView.classList.remove("hidden");
  if (viewName === "main") elements.mainView.classList.remove("hidden");
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
            <button type="button" data-action="autofill" data-id="${escapeHtml(item.id)}" class="ghost">自動入力</button>
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
  const response = await callBackground("listItems", { filters: currentFilters() });
  renderItems(response.items || []);
}

function renderSuggestions(domain, items) {
  elements.domainLabel.textContent = domain ? `現在のドメイン: ${domain}` : "現在のタブ情報を取得できませんでした。";

  if (!items.length) {
    showEmpty(elements.suggestionList, "このサイト向けログインはまだありません。");
    return;
  }

  elements.suggestionList.innerHTML = items
    .map(
      (item) => `
        <li class="card">
          <p class="card-title">${escapeHtml(item.title)}</p>
          <p class="meta">${escapeHtml(item.username || "ユーザー名未設定")}</p>
          <div class="card-actions">
            <button type="button" data-action="suggest-fill" data-id="${escapeHtml(item.id)}" class="ghost">このサイトに入力</button>
          </div>
        </li>
      `
    )
    .join("");
}

function renderCaptures(captures) {
  if (!captures.length) {
    showEmpty(elements.captureList, "保存候補はありません。");
    return;
  }

  elements.captureList.innerHTML = captures
    .map(
      (capture) => `
        <li class="card">
          <p class="card-title">${escapeHtml(capture.title)}</p>
          <p class="meta">${escapeHtml(`${capture.username || "(ユーザー名なし)"}\n${capture.url}`)}</p>
          <div class="card-actions">
            <button type="button" data-action="capture-save" data-id="${escapeHtml(capture.id)}" class="ghost">保存</button>
            <button type="button" data-action="capture-discard" data-id="${escapeHtml(capture.id)}" class="ghost">破棄</button>
          </div>
        </li>
      `
    )
    .join("");
}

async function loadSuggestions() {
  const response = await callBackground("getSuggestionsForActiveTab");
  renderSuggestions(response.domain, response.items || []);
}

async function loadCaptures() {
  const response = await callBackground("getPendingCaptures");
  renderCaptures(response.captures || []);
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

async function refreshMainScreen() {
  await loadSettings();
  await Promise.all([loadItems(), loadSuggestions(), loadCaptures(), loadSecurityReport()]);
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
      await callBackground("setupVault", { masterPassword: password });
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
      await callBackground("unlockVault", { masterPassword: elements.unlockPassword.value });
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

  elements.itemType.addEventListener("change", updateTypeVisibility);

  elements.generateButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("generatePassword");
      elements.itemPassword.value = response.password;
      setStatus("強力なパスワードを生成しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await callBackground("saveItem", { item: buildItemFromForm() });
      setStatus("項目を保存しました。", false);
      clearItemForm();
      await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
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
        await callBackground("deleteItem", { id });
        await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
        setStatus("項目を削除しました。", false);
        return;
      }

      if (action === "autofill") {
        await callBackground("autofillActiveTab", { id });
        setStatus("アクティブタブへ自動入力しました。", false);
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

  elements.suggestionList.addEventListener("click", async (event) => {
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
      await callBackground("autofillActiveTab", { id });
      setStatus("候補を使って自動入力しました。", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.captureList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) {
      return;
    }

    try {
      if (action === "capture-save") {
        await callBackground("savePendingCapture", { id });
        setStatus("保存候補をVaultに登録しました。", false);
      }

      if (action === "capture-discard") {
        await callBackground("discardPendingCapture", { id });
        setStatus("保存候補を破棄しました。", false);
      }

      await Promise.all([loadCaptures(), loadItems(), loadSuggestions(), loadSecurityReport()]);
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
