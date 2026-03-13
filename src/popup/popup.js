import { passwordStrength } from "../lib/password.js";
import { shortenCredentialId } from "../lib/passkey.js";
import { createI18n, getBrowserLocale, SUPPORTED_LOCALES } from "../lib/i18n.js";

const elements = {
  status: document.querySelector("#status"),
  setupView: document.querySelector("#setup-view"),
  unlockView: document.querySelector("#unlock-view"),
  mainView: document.querySelector("#main-view"),
  topbar: document.querySelector(".topbar"),
  sortTabs: document.querySelector("#sort-tabs"),
  utilityChips: [...document.querySelectorAll(".utility-chip")],

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
  pendingCapturePanel: document.querySelector("#pending-capture-panel"),
  pendingCaptureCount: document.querySelector("#pending-capture-count"),
  pendingCaptureList: document.querySelector("#pending-capture-list"),
  pageHost: document.querySelector("#page-host"),
  siteMatchSummary: document.querySelector("#site-match-summary"),
  autofillTabBadge: document.querySelector("#autofill-tab-badge"),

  // Items panel shared elements
  itemFormSection: document.querySelector("#item-form-section"),
  itemFormTitle: document.querySelector("#item-form-title"),
  closeItemFormButton: document.querySelector("#close-item-form"),
  itemsPanelTitle: document.querySelector("#items-panel-title"),
  itemsCount: document.querySelector("#items-count"),
  passkeyApprovalPanel: document.querySelector("#passkey-approval-panel"),
  passkeyApprovalCount: document.querySelector("#passkey-approval-count"),
  passkeyApprovalList: document.querySelector("#passkey-approval-list"),

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
  cloudBaseUrlSetting: document.querySelector("#cloud-base-url-setting"),
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
  itemPasskeyRpId: document.querySelector("#item-passkey-rpid"),
  itemPasskeyCredentialId: document.querySelector("#item-passkey-credential-id"),
  itemPasskeyDisplayName: document.querySelector("#item-passkey-display-name"),
  itemPasskeyUserHandle: document.querySelector("#item-passkey-user-handle"),
  itemPasskeyAttachment: document.querySelector("#item-passkey-attachment"),
  itemPasskeyTransports: document.querySelector("#item-passkey-transports"),
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
  settingLanguage: document.querySelector("#setting-language"),
  settingAutoLock: document.querySelector("#setting-autolock"),
  settingClipboard: document.querySelector("#setting-clipboard"),
  settingPasskeyProxy: document.querySelector("#setting-passkey-proxy"),
  settingPasskeyProxyStatus: document.querySelector("#setting-passkey-proxy-status"),
  settingPasskeyDesktopApproval: document.querySelector("#setting-passkey-desktop-approval"),
  settingPasskeyDesktopStatus: document.querySelector("#setting-passkey-desktop-status"),
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
  "pinned": { panel: "items", filterType: "all", onlyFavorites: true, titleKey: "popup.items.pinned" },
  "all-items": { panel: "items", filterType: "all", onlyFavorites: false, titleKey: "popup.items.allItems" },
  "logins": { panel: "items", filterType: "login", onlyFavorites: false, titleKey: "popup.shortcut.logins" },
  "passkeys": { panel: "items", filterType: "passkey", onlyFavorites: false, titleKey: "popup.shortcut.passkeys" },
  "cards": { panel: "items", filterType: "card", onlyFavorites: false, titleKey: "popup.shortcut.cards" },
  "identities": { panel: "items", filterType: "identity", onlyFavorites: false, titleKey: "popup.shortcut.identities" },
  "notes": { panel: "items", filterType: "note", onlyFavorites: false, titleKey: "popup.shortcut.notes" },
  "autofill": { panel: "autofill", titleKey: "popup.nav.currentSite" },
  "generator": { panel: "generator", titleKey: "popup.nav.generator" },
  "security": { panel: "security", titleKey: "popup.nav.security" },
  "subscriptions": { panel: "subscriptions", titleKey: "popup.shortcut.subscriptions" },
  "migrate": { panel: "migrate", titleKey: "popup.shortcut.sync" },
  "settings": { panel: "settings", titleKey: "popup.nav.settings" }
};

const state = {
  settings: null,
  currentItems: [],
  cloudStatus: null,
  currentDomain: "",
  migrationDraft: null,
  currentTab: "autofill",
  currentSort: "az",
  uiLanguage: "auto"
};

let i18n = createI18n({
  preferredLocale: "auto",
  browserLocale: getBrowserLocale()
});

function t(key, variables = {}) {
  return i18n.t(key, variables);
}

function setI18n(preferredLocale = "auto") {
  state.uiLanguage = preferredLocale || "auto";
  i18n = createI18n({
    preferredLocale: state.uiLanguage,
    browserLocale: getBrowserLocale()
  });
  document.documentElement.lang = i18n.locale;
}

function setNodeText(selector, key, variables = {}) {
  const element = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!element) {
    return;
  }
  element.textContent = t(key, variables);
}

function setInputPlaceholder(selector, key) {
  const element = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (element) {
    element.setAttribute("placeholder", t(key));
  }
}

function setLabelText(selector, key) {
  const element = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!element) {
    return;
  }
  const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) {
    textNode.textContent = ` ${t(key)} `;
    return;
  }
  element.prepend(document.createTextNode(`${t(key)} `));
}

function setOptionText(selectElement, value, key) {
  const option = selectElement?.querySelector(`option[value="${value}"]`);
  if (option) {
    option.textContent = t(key);
  }
}

function languageOptions() {
  return [
    { value: "auto", label: t("language.auto") },
    ...SUPPORTED_LOCALES.map((locale) => ({
      value: locale,
      label: t(`language.${locale}`)
    }))
  ];
}

function populateLanguageSelect(selectElement, currentValue = "auto") {
  if (!selectElement) {
    return;
  }
  selectElement.innerHTML = languageOptions()
    .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  selectElement.value = currentValue || "auto";
}

const ICONS = {
  login: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"></path>
      <path d="M2 21a8 8 0 0 1 16 0"></path>
    </svg>
  `,
  passkey: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="15" r="4"></circle>
      <path d="M12 15h9"></path>
      <path d="M18 15v4"></path>
      <path d="M21 15v2"></path>
    </svg>
  `,
  card: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
      <path d="M2 10h20"></path>
    </svg>
  `,
  identity: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
      <circle cx="9" cy="10" r="2"></circle>
      <path d="M15 8h3"></path>
      <path d="M15 12h3"></path>
      <path d="M7 16h10"></path>
    </svg>
  `,
  note: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16l4-3 4 3 4-3 4 3V8z"></path>
      <path d="M14 2v6h6"></path>
    </svg>
  `,
  vault: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `,
  plus: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    </svg>
  `,
  autofill: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2 3 14h8l-1 8 11-12h-8l1-8z"></path>
    </svg>
  `,
  user: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  `,
  password: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="15" r="4"></circle>
      <path d="M12 15h8"></path>
      <path d="M17 15v3"></path>
      <path d="M20 15v2"></path>
    </svg>
  `,
  edit: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
    </svg>
  `,
  credential: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"></rect>
      <path d="M7 9h10"></path>
      <path d="M7 13h6"></path>
    </svg>
  `
};

function iconMarkup(name, className = "") {
  const icon = ICONS[name] || ICONS.vault;
  const classes = ["ui-glyph", className].filter(Boolean).join(" ");
  return `<span class="${classes}" aria-hidden="true">${icon}</span>`;
}

function itemTypeLabel(type) {
  if (type === "passkey") return t("popup.items.itemType.passkey");
  if (type === "card") return t("popup.items.itemType.card");
  if (type === "identity") return t("popup.items.itemType.identity");
  if (type === "note") return t("popup.items.itemType.note");
  return t("popup.items.itemType.login");
}

function itemTypeIcon(type) {
  if (type === "passkey") return "passkey";
  if (type === "card") return "card";
  if (type === "identity") return "identity";
  if (type === "note") return "note";
  return "login";
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function applyPopupTranslations() {
  document.title = t("app.name");
  elements.tabbar?.setAttribute("aria-label", t("popup.accessibility.mainNav"));
  document.querySelector(".utility-rail")?.setAttribute("aria-label", t("popup.accessibility.quickSwitch"));
  document.querySelector("#tab-panel-items")?.setAttribute("aria-label", t("popup.accessibility.itemsPanel"));
  document.querySelector("#tab-panel-autofill")?.setAttribute("aria-label", t("popup.accessibility.autofillPanel"));
  document.querySelector("#tab-panel-generator")?.setAttribute("aria-label", t("popup.accessibility.generatorPanel"));
  document.querySelector("#tab-panel-security")?.setAttribute("aria-label", t("popup.accessibility.securityPanel"));
  document.querySelector("#tab-panel-subscriptions")?.setAttribute("aria-label", t("popup.accessibility.subscriptionsPanel"));
  document.querySelector("#tab-panel-migrate")?.setAttribute("aria-label", t("popup.accessibility.migratePanel"));
  document.querySelector("#tab-panel-settings")?.setAttribute("aria-label", t("popup.accessibility.settingsPanel"));

  setNodeText("#setup-view .auth-eyebrow", "popup.auth.setupEyebrow");
  setNodeText("#setup-view h2", "popup.auth.setupTitle");
  setNodeText("#setup-view > p:not(.auth-eyebrow)", "popup.auth.setupDescription");
  document.querySelectorAll("#setup-view .auth-pill")[0].textContent = t("popup.auth.pillAutofill");
  document.querySelectorAll("#setup-view .auth-pill")[1].textContent = t("popup.auth.pillCapture");
  document.querySelectorAll("#setup-view .auth-pill")[2].textContent = t("popup.auth.pillLocal");
  setLabelText(elements.setupPassword?.closest("label"), "popup.auth.masterPasswordMin");
  setLabelText(elements.setupConfirm?.closest("label"), "popup.auth.confirmPassword");
  const setupWarning = document.querySelector("#setup-view .auth-form-note strong");
  if (setupWarning) setupWarning.textContent = t("popup.auth.warningTitle");
  const setupWarningBody = document.querySelector("#setup-view .auth-form-note span");
  if (setupWarningBody) setupWarningBody.textContent = t("popup.auth.warningBody");
  setNodeText('#setup-view button[type="submit"]', "popup.auth.createAndOpen");

  setNodeText("#unlock-view .auth-eyebrow", "popup.auth.unlockEyebrow");
  setNodeText("#unlock-view h2", "popup.auth.unlockTitle");
  setNodeText("#unlock-view > p:not(.auth-eyebrow)", "popup.auth.unlockDescription");
  setLabelText(elements.unlockPassword?.closest("label"), "popup.auth.masterPasswordMin");
  const unlockHint = document.querySelector("#unlock-view .auth-form-note strong");
  if (unlockHint) unlockHint.textContent = t("popup.auth.hintTitle");
  const unlockHintBody = document.querySelector("#unlock-view .auth-form-note span");
  if (unlockHintBody) unlockHintBody.textContent = t("popup.auth.hintBody");
  setNodeText('#unlock-view button[type="submit"]', "popup.auth.unlockButton");

  setNodeText('.sidebar-btn[data-tab="autofill"] span', "popup.nav.currentSite");
  setNodeText('.sidebar-btn[data-tab="all-items"] span', "popup.nav.vault");
  setNodeText('.sidebar-btn[data-tab="generator"] span', "popup.nav.generator");
  setNodeText('.sidebar-btn[data-tab="security"] span', "popup.nav.security");
  setNodeText('.sidebar-btn[data-tab="settings"] span', "popup.nav.settings");

  setInputPlaceholder(elements.searchInput, "popup.search.placeholder");
  elements.lockButton?.setAttribute("title", t("popup.button.lock"));
  elements.exportButton?.setAttribute("title", t("popup.button.backup"));
  elements.importButton?.setAttribute("title", t("popup.button.restore"));
  elements.importButton?.setAttribute("aria-label", t("popup.button.restore"));
  elements.addItemButton?.setAttribute("title", t("popup.button.newItem"));
  elements.addItemButton?.setAttribute("aria-label", t("popup.button.newItem"));

  const shortcutKeys = {
    pinned: "popup.shortcut.favorites",
    logins: "popup.shortcut.logins",
    passkeys: "popup.shortcut.passkeys",
    cards: "popup.shortcut.cards",
    identities: "popup.shortcut.identities",
    notes: "popup.shortcut.notes",
    subscriptions: "popup.shortcut.subscriptions",
    migrate: "popup.shortcut.sync"
  };
  elements.utilityChips.forEach((button) => {
    const key = shortcutKeys[button.dataset.tabShortcut];
    const label = button.querySelector("span");
    if (key && label) {
      label.textContent = t(key);
    }
  });

  const sortKeyMap = { popular: "popup.sort.recommended", recent: "popup.sort.recent", az: "popup.sort.name" };
  sortTabs.forEach((tab) => {
    const key = sortKeyMap[tab.dataset.sort];
    if (key) tab.textContent = t(key);
  });

  setNodeText(elements.itemFormTitle, "popup.items.newItem");
  elements.closeItemFormButton?.setAttribute("title", t("common.close"));
  setOptionText(elements.itemType, "login", "popup.items.itemType.login");
  setOptionText(elements.itemType, "passkey", "popup.items.itemType.passkey");
  setOptionText(elements.itemType, "card", "popup.items.itemType.card");
  setOptionText(elements.itemType, "identity", "popup.items.itemType.identity");
  setOptionText(elements.itemType, "note", "popup.items.itemType.note");
  setLabelText(elements.itemFavorite?.closest("label"), "popup.items.favorite");
  setInputPlaceholder(elements.itemTitle, "popup.items.titlePlaceholder");
  const passkeyNoteTitle = document.querySelector(".passkey-note strong");
  const passkeyNoteDesc = document.querySelector(".passkey-note span");
  if (passkeyNoteTitle) passkeyNoteTitle.textContent = t("popup.items.passkeyTitle");
  if (passkeyNoteDesc) passkeyNoteDesc.textContent = t("popup.items.passkeyDescription");
  setInputPlaceholder(elements.itemUsername, "popup.items.usernamePlaceholder");
  setNodeText(elements.aliasButton, "popup.items.aliasButton");
  setInputPlaceholder(elements.itemUrl, "popup.items.urlPlaceholder");
  setInputPlaceholder(elements.itemPassword, "popup.items.passwordPlaceholder");
  setInputPlaceholder(elements.itemOtp, "popup.items.otpPlaceholder");
  setNodeText(elements.generateButton, "popup.items.generateButton");
  setInputPlaceholder(elements.itemPasskeyRpId, "popup.items.passkeyRpIdPlaceholder");
  setInputPlaceholder(elements.itemPasskeyCredentialId, "popup.items.passkeyCredentialPlaceholder");
  setInputPlaceholder(elements.itemPasskeyDisplayName, "popup.items.passkeyDisplayNamePlaceholder");
  setInputPlaceholder(elements.itemPasskeyUserHandle, "popup.items.passkeyUserHandlePlaceholder");
  setOptionText(elements.itemPasskeyAttachment, "", "popup.items.passkeyAttachmentNone");
  setOptionText(elements.itemPasskeyAttachment, "platform", "popup.items.passkeyAttachmentPlatform");
  setOptionText(elements.itemPasskeyAttachment, "cross-platform", "popup.items.passkeyAttachmentCrossPlatform");
  setInputPlaceholder(elements.itemPasskeyTransports, "popup.items.passkeyTransportsPlaceholder");
  setInputPlaceholder(elements.itemCardHolder, "popup.items.cardHolderPlaceholder");
  setInputPlaceholder(elements.itemCardNumber, "popup.items.cardNumberPlaceholder");
  setInputPlaceholder(elements.itemCardExpiry, "popup.items.cardExpiryPlaceholder");
  setInputPlaceholder(elements.itemCardCvc, "popup.items.cardCvcPlaceholder");
  setInputPlaceholder(elements.itemFullName, "popup.items.fullNamePlaceholder");
  setInputPlaceholder(elements.itemEmail, "popup.items.emailPlaceholder");
  setInputPlaceholder(elements.itemPhone, "popup.items.phonePlaceholder");
  setInputPlaceholder(elements.itemAddress, "popup.items.addressPlaceholder");
  setInputPlaceholder(elements.itemTags, "popup.items.tagsPlaceholder");
  setInputPlaceholder(elements.itemNotes, "popup.items.notesPlaceholder");
  setLabelText(elements.itemIsSubscription?.closest("label"), "popup.items.subscription");
  setInputPlaceholder(elements.itemSubAmount, "popup.items.subscriptionAmountPlaceholder");
  setOptionText(elements.itemSubCycle, "monthly", "popup.items.subscriptionMonthly");
  setOptionText(elements.itemSubCycle, "yearly", "popup.items.subscriptionYearly");
  setOptionText(elements.itemSubCycle, "weekly", "popup.items.subscriptionWeekly");
  setNodeText('#item-form .btn-primary[type="submit"]', "common.save");
  setNodeText(elements.cancelEdit, "common.cancel");
  setOptionText(elements.filterType, "all", "popup.items.filterAll");
  setOptionText(elements.filterType, "login", "popup.items.filterLogin");
  setOptionText(elements.filterType, "passkey", "popup.items.filterPasskey");
  setOptionText(elements.filterType, "card", "popup.items.filterCard");
  setOptionText(elements.filterType, "identity", "popup.items.filterIdentity");
  setOptionText(elements.filterType, "note", "popup.items.filterNote");

  setNodeText("#tab-panel-autofill .panel-eyebrow", "popup.site.eyebrow");
  setNodeText("#tab-panel-autofill .quick-context-copy h3", "popup.site.readyTitle");
  setNodeText(".quick-open-vault-btn", "popup.site.viewVault");
  setNodeText("#pending-capture-panel h3", "popup.site.pendingCapturesTitle");
  setNodeText("#pending-capture-panel .small", "popup.site.pendingCapturesDescription");
  setNodeText("#passkey-approval-panel h3", "popup.site.passkeyPendingTitle");
  setNodeText("#passkey-approval-panel > .small", "popup.site.passkeyPendingDescription");
  setNodeText("#tab-panel-autofill .panel-soft:last-child h3", "popup.site.fillableTitle");
  setNodeText("#tab-panel-autofill .panel-soft:last-child .small", "popup.site.fillableDescription");
  setNodeText(".small-action-btn", "popup.site.newPassword");

  setNodeText("#tab-panel-generator h3", "popup.generator.title");
  setNodeText("#tab-panel-generator .small", "popup.generator.description");
  setInputPlaceholder(elements.genResult, "popup.generator.placeholder");
  setNodeText(elements.genNewButton, "popup.generator.generate");
  elements.genCopyButton?.setAttribute("title", t("popup.generator.copy"));
  elements.genCopyButton?.setAttribute("aria-label", t("popup.generator.copy"));

  setNodeText("#tab-panel-security h3", "popup.security.title");
  setNodeText("#tab-panel-security .small", "popup.security.description");
  setNodeText(elements.refreshReportButton, "popup.security.refresh");

  setNodeText("#tab-panel-subscriptions h2", "popup.subscriptions.title");
  setNodeText("#tab-panel-subscriptions .dashboard-header .small", "popup.subscriptions.description");
  setNodeText("#subscriptions-hero-title", "popup.subscriptions.totalMonthly");
  setNodeText("#subscriptions-yearly-label", "popup.subscriptions.yearlyEquivalent");
  setNodeText("#subscriptions-services-label", "popup.subscriptions.services");
  setNodeText("#subscriptions-sync-label", "popup.subscriptions.sync");
  setNodeText("#subscriptions-refresh-label", "popup.subscriptions.latest");
  setNodeText("#subscriptions-list-title", "popup.subscriptions.listTitle");

  setNodeText("#tab-panel-migrate section:first-child h3", "popup.cloud.title");
  setNodeText("#tab-panel-migrate section:first-child > .small", "popup.cloud.description");
  setInputPlaceholder(elements.cloudEmail, "popup.items.emailPlaceholder");
  setInputPlaceholder(elements.cloudPassword, "popup.items.passwordPlaceholder");
  setNodeText(elements.cloudRegisterButton, "common.register");
  setNodeText(elements.cloudLoginButton, "common.login");
  setNodeText(elements.cloudLogoutButton, "common.logout");
  setNodeText("#tab-panel-migrate details summary", "popup.cloud.advanced");
  setLabelText(elements.cloudBaseUrlSetting?.closest("label"), "popup.cloud.baseUrl");
  const cloudBaseDesc = elements.cloudBaseUrlSetting?.closest("label")?.querySelector(".small");
  if (cloudBaseDesc) cloudBaseDesc.textContent = t("popup.cloud.baseUrlDescription");
  setNodeText(elements.cloudPullButton, "popup.cloud.pull");
  setNodeText(elements.cloudPushButton, "popup.cloud.push");
  setNodeText(elements.cloudRefreshButton, "popup.cloud.refreshStatus");
  setNodeText("#tab-panel-migrate section:last-child h3", "popup.migration.title");
  setNodeText("#tab-panel-migrate section:last-child > .small", "popup.migration.description");
  setOptionText(elements.migrationProvider, "auto", "popup.migration.providerAuto");
  setOptionText(elements.migrationProvider, "1password", "popup.migration.provider1password");
  setOptionText(elements.migrationProvider, "bitwarden", "popup.migration.providerBitwarden");
  setOptionText(elements.migrationProvider, "lastpass", "popup.migration.providerLastpass");
  setOptionText(elements.migrationProvider, "generic", "popup.migration.providerGeneric");
  setLabelText(elements.migrationReplace?.closest("label"), "popup.migration.replaceExisting");
  setNodeText(elements.migrationPreviewButton, "common.preview");
  setNodeText(elements.migrationApplyButton, "common.apply");

  setNodeText('#tab-panel-settings section:first-child h3', "popup.settings.title");
  populateLanguageSelect(elements.settingLanguage, state.settings?.displayLanguage || state.uiLanguage || "auto");
  setLabelText(elements.settingLanguage?.closest("label"), "popup.settings.language");
  setLabelText(elements.settingAutoLock?.closest("label"), "popup.settings.autoLock");
  setLabelText(elements.settingClipboard?.closest("label"), "popup.settings.clipboardClear");
  const proxyTitle = document.querySelector(".alert-danger strong");
  const proxyDesc = document.querySelector(".alert-danger .setting-help");
  if (proxyTitle) proxyTitle.textContent = t("popup.settings.passkeyProxyTitle");
  setLabelText(elements.settingPasskeyProxy?.closest("label"), "popup.settings.passkeyProxyLabel");
  if (proxyDesc) proxyDesc.textContent = t("popup.settings.passkeyProxyDescription");
  const desktopTitle = document.querySelector(".alert-info strong");
  const desktopDesc = document.querySelector(".alert-info .setting-help");
  if (desktopTitle) desktopTitle.textContent = t("popup.settings.desktopApprovalTitle");
  setLabelText(elements.settingPasskeyDesktopApproval?.closest("label"), "popup.settings.desktopApprovalLabel");
  if (desktopDesc) desktopDesc.textContent = t("popup.settings.desktopApprovalDescription");
  setNodeText('#settings-form > .btn-primary[type="submit"]', "common.save");
  setNodeText('#tab-panel-settings section:nth-of-type(2) h3', "popup.settings.masterTitle");
  setInputPlaceholder(elements.oldMaster, "popup.settings.masterCurrent");
  setInputPlaceholder(elements.newMaster, "popup.settings.masterNew");
  setNodeText('#master-form .btn-primary[type="submit"]', "common.apply");
  setNodeText("#tab-panel-settings details summary", "popup.settings.advancedSummary");
  setNodeText("#alias-settings-form h3, #tab-panel-settings .advanced-settings-content section:first-child h3", "popup.settings.aliasTitle");
  setLabelText(elements.settingAliasEmail?.closest("label"), "popup.settings.aliasBaseEmail");
  const aliasDesc = document.querySelector("#alias-settings-form + .small, #tab-panel-settings .advanced-settings-content section:first-child .small");
  if (aliasDesc) aliasDesc.textContent = t("popup.settings.aliasDescription");
  setNodeText("#alias-settings-form .btn-primary", "common.save");
  setNodeText("#tab-panel-settings .advanced-settings-content section:last-child h3", "popup.settings.deadmanTitle");
  const deadmanDesc = document.querySelector("#tab-panel-settings .advanced-settings-content section:last-child > .small");
  if (deadmanDesc) deadmanDesc.textContent = t("popup.settings.deadmanDescription");
  setLabelText(elements.deadmanEnabled?.closest("label"), "popup.settings.deadmanEnable");
  setLabelText(elements.deadmanDays?.closest("label"), "popup.settings.deadmanDays");
  const contactsLabel = document.querySelector("#deadman-contacts > label");
  if (contactsLabel) contactsLabel.textContent = t("popup.settings.deadmanContacts");
  setNodeText(elements.deadmanAddContact, "popup.settings.deadmanAddContact");
  setNodeText("#deadman-form .btn-primary", "common.save");
}

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
  if (complexity === "very-strong") return t("popup.strength.veryStrong");
  if (complexity === "strong") return t("popup.strength.strong");
  if (complexity === "fair") return t("popup.strength.fair");
  if (complexity === "weak") return t("popup.strength.weak");
  return t("popup.strength.veryWeak");
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
  const minLengthNote = minLength > 0 && value.length > 0 && value.length < minLength ? t("popup.strength.requireLength", { count: minLength }) : "";
  const note = minLengthNote || firstFeedback;
  const message =
    value.length === 0
      ? t("popup.strength.empty")
      : t("popup.strength.template", {
        label: strengthLabel(level),
        score: result.score,
        note: note ? t("popup.strength.noteTemplate", { value: note }) : ""
      });

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
    toggleButton.textContent = hidden ? t("common.show") : t("common.hide");
    toggleButton.setAttribute("aria-pressed", hidden ? "false" : "true");
    toggleButton.setAttribute("aria-label", hidden ? t("common.show") : t("common.hide"));
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
  elements.utilityChips.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabShortcut === next);
  });

  // Show/hide panels based on the category config
  const targetPanel = config.panel;
  elements.tabPanels.forEach((panel) => {
    const panelName = panel.dataset.tabPanel;
    const active = panelName === targetPanel;
    panel.classList.toggle("hidden", !active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });

  if (elements.sortTabs) {
    elements.sortTabs.classList.toggle("hidden", config.panel !== "items");
  }
  if (elements.topbar) {
    elements.topbar.classList.toggle("site-focused", config.panel === "autofill");
  }

  // If this is an items category, apply filters
  if (config.panel === "items") {
    if (config.filterType) {
      elements.filterType.value = config.filterType;
    }
    if (elements.onlyFavorite) {
      elements.onlyFavorite.checked = Boolean(config.onlyFavorites);
    }
    if (elements.itemsPanelTitle) {
      elements.itemsPanelTitle.textContent = t(config.titleKey || "popup.items.allItems");
    }
    loadItems().catch((error) => setStatus(error.message, true));
    return;
  }

  if (config.panel === "autofill") {
    Promise.all([
      loadSuggestions(),
      loadPendingCaptures(),
      loadPendingPasskeyApprovals()
    ]).catch((error) => setStatus(error.message, true));
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
    throw new Error(response?.error || t("common.actionFailed"));
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

function hasActiveItemFilters() {
  return Boolean(elements.searchInput.value || elements.filterType.value !== "all" || elements.onlyFavorite.checked);
}

function buildVaultEmptyState() {
  return `
    <li class="empty empty-state-card">
      <div class="empty-state-icon" aria-hidden="true">${iconMarkup("vault", "empty-state-glyph")}</div>
      <div class="empty-state-copy">
        <p class="empty-state-eyebrow">${escapeHtml(t("popup.items.emptyEyebrow"))}</p>
        <h3>${escapeHtml(t("popup.items.emptyTitle"))}</h3>
        <p class="empty-state-text">${escapeHtml(t("popup.items.emptyDescription"))}</p>
      </div>
      <div class="empty-state-actions">
        <button type="button" class="empty-state-btn" data-empty-action="new-login">${escapeHtml(t("popup.items.emptyFirstLogin"))}</button>
        <button type="button" class="empty-state-btn ghost" data-empty-action="new-passkey">${escapeHtml(t("popup.items.emptyPasskey"))}</button>
        <button type="button" class="empty-state-btn ghost" data-empty-action="import">${escapeHtml(t("popup.items.emptyImport"))}</button>
        <button type="button" class="empty-state-btn ghost" data-empty-action="generator">${escapeHtml(t("popup.items.emptyGenerate"))}</button>
      </div>
      <ul class="empty-state-list">
        <li>${escapeHtml(t("popup.items.emptyHintOne"))}</li>
        <li>${escapeHtml(t("popup.items.emptyHintTwo"))}</li>
      </ul>
    </li>
  `;
}

function formatShortDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return i18n.formatDateTime(date, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderPendingCaptures(captures = []) {
  if (!elements.pendingCapturePanel || !elements.pendingCaptureList) {
    return;
  }

  const count = Array.isArray(captures) ? captures.length : 0;
  elements.pendingCapturePanel.classList.toggle("hidden", count === 0);
  if (elements.pendingCaptureCount) {
    elements.pendingCaptureCount.textContent = count > 0 ? String(count) : "";
  }
  if (elements.autofillTabBadge) {
    elements.autofillTabBadge.textContent = count > 0 ? String(Math.min(count, 9)) : "";
    elements.autofillTabBadge.classList.toggle("hidden", count === 0);
  }

  if (count === 0) {
    elements.pendingCaptureList.innerHTML = "";
    return;
  }

  elements.pendingCaptureList.innerHTML = captures
    .map((capture) => {
      const meta = [
        capture.username || t("popup.site.idNotCaptured"),
        capture.url || "",
        capture.createdAt ? t("popup.site.detectedAt", { time: formatShortDateTime(capture.createdAt) }) : ""
      ]
        .filter(Boolean)
        .join("\n");

      return `
        <li class="card card-capture">
          <div class="card-head">
            <div class="card-icon capture">${iconMarkup("plus", "card-glyph")}</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(capture.title || t("popup.site.newLogin"))}</p>
              <p class="meta">${escapeHtml(meta)}</p>
            </div>
          </div>
          <div class="card-actions card-actions-compact">
            <button type="button" data-action="save-capture" data-id="${escapeAttr(capture.id)}" class="card-action-primary">
              ${escapeHtml(t("popup.site.saveSuggestion"))}
            </button>
            <button type="button" data-action="discard-capture" data-id="${escapeAttr(capture.id)}" class="ghost card-action-mini" title="${escapeAttr(t("popup.site.later"))}">
              ${escapeHtml(t("popup.site.later"))}
            </button>
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadPendingCaptures() {
  const response = await callBackground("getPendingCaptures");
  renderPendingCaptures(response.captures || []);
}

function kindLabel(kind) {
  return kind === "create" ? `${t("popup.items.itemType.passkey")} ${t("common.register")}` : `${t("popup.items.itemType.passkey")} ${t("common.login")}`;
}

function approvalMethodLabel(value) {
  const method = String(value || "").toLowerCase();
  if (method === "touchid") return t("popup.approval.method.touchId");
  if (method === "windows-hello" || method === "windows-hello-hwnd") return t("popup.approval.method.windowsHello");
  if (method === "desktop-dialog") return t("popup.method.desktopDialog");
  if (method === "extension-popup") return t("popup.method.extensionPopup");
  if (method === "mock-approve") return t("popup.method.desktopApproveTest");
  if (method === "mock-reject") return t("popup.method.desktopRejectTest");
  return method ? method : "";
}

function paintInlineStatus(element, message, tone = "neutral") {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("is-online", "is-offline", "is-warning");
  if (tone === "online") {
    element.classList.add("is-online");
  } else if (tone === "offline") {
    element.classList.add("is-offline");
  } else if (tone === "warning") {
    element.classList.add("is-warning");
  }
}

async function loadPendingPasskeyApprovals() {
  const response = await callBackground("getPendingPasskeyApprovals");
  const approvals = response.approvals || [];

  if (!elements.passkeyApprovalPanel || !elements.passkeyApprovalList) {
    return;
  }

  elements.passkeyApprovalPanel.classList.toggle("hidden", approvals.length === 0);
  elements.passkeyApprovalCount.textContent = approvals.length ? String(approvals.length) : "";

  if (!approvals.length) {
    elements.passkeyApprovalList.innerHTML = "";
    return;
  }

  elements.passkeyApprovalList.innerHTML = approvals
    .map((approval) => `
      <article class="approval-card">
        <div class="approval-head">
          <span class="approval-domain">${escapeHtml(approval.rpId || approval.origin || t("common.unknown"))}</span>
          <span class="item-kind-badge passkey">${escapeHtml(kindLabel(approval.kind))}</span>
        </div>
        <p class="approval-title">${escapeHtml(approval.title || approval.rpId || t("popup.items.itemType.passkey"))}</p>
        <p class="approval-meta">${escapeHtml(approval.origin || "")}</p>
        ${approval.userName ? `<p class="approval-meta">${escapeHtml(t("popup.cloud.statusUser", { value: approval.userName }))}</p>` : ""}
        <div class="approval-actions">
          <button type="button" class="ghost" data-approval-action="reject" data-approval-id="${escapeAttr(approval.id)}">${escapeHtml(t("common.reject"))}</button>
          <button type="button" class="btn-primary" data-approval-action="approve" data-approval-id="${escapeAttr(approval.id)}">${escapeHtml(t("common.approve"))}</button>
        </div>
      </article>
    `)
    .join("");
}

function riskLabel(risk) {
  if (!risk) {
    return t("popup.risk.none");
  }
  if (risk.level === "high") {
    return t("popup.risk.high", { score: risk.score });
  }
  if (risk.level === "medium") {
    return t("popup.risk.medium", { score: risk.score });
  }
  return t("popup.risk.low", { score: risk.score });
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
    return t("popup.risk.none");
  }
  if (risk.level === "high") {
    return t("popup.risk.highShort", { score: risk.score });
  }
  if (risk.level === "medium") {
    return t("popup.risk.mediumShort", { score: risk.score });
  }
  return t("popup.risk.lowShort", { score: risk.score });
}

function buildMigrationPreviewText(preview) {
  if (!preview) {
    return t("popup.migration.previewNotRun");
  }

  const lines = [];
  lines.push(t("popup.migration.previewSource", { provider: preview.sourceProvider, format: preview.format }));
  lines.push(t("popup.migration.previewReplace", { value: preview.replaceExisting ? t("popup.migration.previewReplaceOn") : t("popup.migration.previewReplaceOff") }));
  lines.push(t("popup.migration.previewParsed", { count: preview.totalParsed }));
  lines.push(t("popup.migration.previewAdd", { count: preview.wouldAdd }));
  lines.push(t("popup.migration.previewDuplicates", { count: preview.wouldSkipDuplicates }));
  lines.push(t("popup.migration.previewInvalid", { count: preview.wouldSkipInvalid }));

  if (Array.isArray(preview.addSamples) && preview.addSamples.length) {
    lines.push(`\n[${t("popup.migration.previewAddSamples")}]`);
    preview.addSamples.slice(0, 6).forEach((item) => {
      lines.push(`- ${item.title} (${item.type})`);
    });
  }

  if (Array.isArray(preview.duplicateSamples) && preview.duplicateSamples.length) {
    lines.push(`\n[${t("popup.migration.previewDuplicateSamples")}]`);
    preview.duplicateSamples.slice(0, 4).forEach((item) => {
      lines.push(`- ${item.title} (${item.type})`);
    });
  }

  if (Array.isArray(preview.invalidSamples) && preview.invalidSamples.length) {
    lines.push(`\n[${t("popup.migration.previewInvalidSamples")}]`);
    preview.invalidSamples.slice(0, 4).forEach((item) => {
      lines.push(`- ${item.title}: ${item.reason}`);
    });
  }

  if (Array.isArray(preview.warnings) && preview.warnings.length) {
    lines.push(`\n[${t("popup.auth.warningTitle")}]`);
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
  const blocks = elements.itemForm.querySelectorAll(".type-login, .type-card, .type-identity, .type-note, .type-passkey");

  blocks.forEach((block) => {
    const allowedTypes = [...block.classList]
      .filter((name) => name.startsWith("type-"))
      .map((name) => name.replace("type-", ""));

    block.classList.toggle("hidden", !allowedTypes.includes(type));
  });

  elements.itemPassword.required = type === "login";
  elements.itemTitle.required = type !== "passkey";
}

function showItemForm(title = t("popup.items.newItem")) {
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
  elements.itemPasskeyRpId.value = "";
  elements.itemPasskeyCredentialId.value = "";
  elements.itemPasskeyDisplayName.value = "";
  elements.itemPasskeyUserHandle.value = "";
  elements.itemPasskeyAttachment.value = "";
  elements.itemPasskeyTransports.value = "";
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
  const passkey = item.passkey || {};

  if (item.username) lines.push(item.username);
  if (item.url) lines.push(item.url);
  if (item.type === "passkey" && passkey.rpId) lines.push(t("popup.meta.rpId", { value: passkey.rpId }));
  if (item.type === "passkey" && passkey.credentialId) lines.push(t("popup.meta.credential", { value: shortenCredentialId(passkey.credentialId) }));
  if (item.type === "passkey" && passkey.proxyProvider === "software") lines.push(t("popup.meta.passkeyMethod", { value: t("popup.settings.passkeyProxyLabel") }));
  if (item.type === "passkey" && passkey.approvalMethod) lines.push(t("popup.meta.approval", { value: approvalMethodLabel(passkey.approvalMethod) }));
  if (item.type === "passkey" && Number(passkey.signCount || 0) > 0) lines.push(t("popup.meta.signCount", { count: passkey.signCount }));
  if (item.type === "passkey" && passkey.lastUsedAt) lines.push(t("popup.meta.lastUsed", { value: formatShortDateTime(passkey.lastUsedAt) }));
  if (item.tags?.length) lines.push(t("popup.meta.tags", { value: item.tags.join(", ") }));
  if (item.type === "card" && item.cardNumber) lines.push(t("popup.meta.last4", { value: item.cardNumber.slice(-4) }));
  if (item.type === "identity" && item.email) lines.push(item.email);

  return lines.join("\n");
}

function renderItems(items) {
  // Update count
  if (elements.itemsCount) {
    elements.itemsCount.textContent = t("popup.items.count", { count: items.length });
  }

  if (!items.length) {
    showEmpty(elements.itemList, t("popup.items.noMatching"));
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
      const itemIcon = itemTypeIcon(item.type);
      const detailLines = itemToMeta(item).split("\n").filter(Boolean);
      const primaryMeta = detailLines[0] || itemTypeLabel(item.type);
      const secondaryMeta = detailLines.slice(1, 3).join(" / ");
      const typeBadge = item.type === "passkey" ? `<span class="item-kind-badge passkey">${escapeHtml(t("popup.items.itemType.passkey"))}</span>` : "";
      const actionButtons = item.type === "passkey"
        ? `
            <button type="button" data-action="copy-user" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("popup.action.copyDisplayOrId"))}" aria-label="${escapeAttr(t("popup.action.copyDisplayOrId"))}">${iconMarkup("user", "action-glyph")}<span>${escapeHtml(t("popup.action.idShort"))}</span></button>
            <button type="button" data-action="copy-credential" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("popup.action.copyCredential"))}" aria-label="${escapeAttr(t("popup.action.copyCredential"))}">${iconMarkup("credential", "action-glyph")}<span>${escapeHtml(t("popup.action.credentialShort"))}</span></button>
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("common.edit"))}" aria-label="${escapeAttr(t("common.edit"))}">${iconMarkup("edit", "action-glyph")}<span>${escapeHtml(t("common.edit"))}</span></button>
          `
        : `
            <button type="button" data-action="autofill" data-id="${escapeHtml(item.id)}" class="card-action-primary">${iconMarkup("autofill", "action-glyph")}<span>${escapeHtml(t("popup.site.autofill"))}</span></button>
            <button type="button" data-action="copy-user" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("popup.action.copyId"))}" aria-label="${escapeAttr(t("popup.action.copyId"))}">${iconMarkup("user", "action-glyph")}<span>${escapeHtml(t("popup.action.idShort"))}</span></button>
            <button type="button" data-action="copy-pass" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("popup.action.copyPassword"))}" aria-label="${escapeAttr(t("popup.action.copyPassword"))}">${iconMarkup("password", "action-glyph")}<span>${escapeHtml(t("popup.action.passwordShort"))}</span></button>
            <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}" class="ghost card-action-mini" title="${escapeAttr(t("common.edit"))}" aria-label="${escapeAttr(t("common.edit"))}">${iconMarkup("edit", "action-glyph")}<span>${escapeHtml(t("common.edit"))}</span></button>
          `;

      return `
        <li class="card">
          <div class="card-head card-head-compact">
            <div class="card-logo card-logo-${escapeAttr(item.type)}">${iconMarkup(itemIcon, "card-glyph")}</div>
            <div class="card-info card-info-compact">
              <p class="card-title card-title-compact">
                ${escapeHtml(item.title)}${favStar}${typeBadge}
              </p>
              <p class="meta meta-primary">${escapeHtml(primaryMeta)}</p>
              ${secondaryMeta ? `<p class="meta meta-secondary">${escapeHtml(secondaryMeta)}</p>` : ""}
            </div>
          </div>
          <div class="card-actions card-actions-compact">
            ${actionButtons}
          </div>
        </li>
      `;
    })
    .join("");
}

async function loadItems() {
  const response = await callBackground("listItems", { filters: currentFilters() });
  const items = response.items || [];

  if (!items.length && !hasActiveItemFilters()) {
    state.currentItems = [];
    if (elements.itemsCount) {
      elements.itemsCount.textContent = "0";
    }
    elements.itemList.innerHTML = buildVaultEmptyState();
    return;
  }

  renderItems(items);
}

function renderSuggestions(domain, items) {
  state.currentDomain = domain || "";
  elements.pageHost.textContent = domain || t("popup.site.hostUnknown");
  if (elements.siteMatchSummary) {
    elements.siteMatchSummary.textContent = items.length ? t("popup.site.matchCount", { count: items.length }) : t("popup.site.matchNone");
  }

  if (!items.length) {
    elements.autofillList.innerHTML = `
      <li class="empty empty-state-card compact-empty-state">
        <div class="empty-state-icon" aria-hidden="true">${iconMarkup("autofill", "empty-state-glyph")}</div>
        <div class="empty-state-copy">
          <p class="empty-state-eyebrow">${escapeHtml(t("popup.site.emptyEyebrow"))}</p>
          <h3>${escapeHtml(t("popup.site.emptyTitle"))}</h3>
          <p class="empty-state-text">${escapeHtml(t("popup.site.emptyDescription"))}</p>
        </div>
        <div class="empty-state-actions">
          <button type="button" class="empty-state-btn" data-tab-shortcut="all-items">${escapeHtml(t("popup.site.chooseFromVault"))}</button>
          <button type="button" class="empty-state-btn ghost" data-tab-shortcut="generator">${escapeHtml(t("popup.site.createPassword"))}</button>
        </div>
      </li>
    `;
    return;
  }

  elements.autofillList.innerHTML = items
    .map((item) => {
      const username = item.username || t("popup.site.usernameMissing");
      const risk = item.autofillRisk;
      const reasons = Array.isArray(risk?.reasons) ? risk.reasons : [];
      const metaLines = [username, reasons.length ? `${t("popup.auth.warningTitle")}: ${reasons.join(" / ")}` : ""].filter(Boolean).join("\n");

      return `
        <li class="card">
          <div class="card-head">
            <div class="card-icon login">${iconMarkup("login", "card-glyph")}</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(item.title)}</p>
              <div class="chips">
                <span class="chip ${riskChipClass(risk)}" title="${escapeHtml(riskLabel(risk))}">${escapeHtml(riskChipText(risk))}</span>
              </div>
            </div>
          </div>
          <p class="meta">${escapeHtml(metaLines)}</p>
          <div class="card-actions">
            <button type="button" data-action="suggest-fill" data-id="${escapeHtml(item.id)}" class="card-action-primary suggest-fill-btn">${iconMarkup("autofill", "action-glyph")}<span>${escapeHtml(t("popup.site.autofill"))}</span></button>
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
    return t("popup.security.refresh");
  }

  const lines = [];
  lines.push(t("popup.security.reportScore", { score: report.score }));
  lines.push(t("popup.security.reportLogins", { count: report.totals.allLogins }));
  lines.push(t("popup.security.reportPasskeys", { count: report.totals.passkeys || 0 }));
  lines.push(t("popup.security.reportWeak", { count: report.totals.weak }));
  lines.push(t("popup.security.reportOld", { count: report.totals.old }));
  lines.push(t("popup.security.reportReused", { count: report.totals.reusedGroups }));
  lines.push(t("popup.security.reportTwoFactor", { count: report.totals.twoFactorCoverage }));

  if (report.weakItems.length) {
    lines.push(`\n[${t("popup.security.sectionWeak")}]`);
    report.weakItems.slice(0, 5).forEach((item) => lines.push(`- ${item.title} (${item.score})`));
  }

  if (report.reusedGroups.length) {
    lines.push(`\n[${t("popup.security.sectionReused")}]`);
    report.reusedGroups.slice(0, 3).forEach((group) => lines.push(`- ${t("popup.security.reusedItem", { count: group.count })}`));
  }

  if (report.oldItems.length) {
    lines.push(`\n[${t("popup.security.sectionOld")}]`);
    report.oldItems.slice(0, 5).forEach((item) => lines.push(`- ${item.title} (${item.ageDays})`));
  }

  if (Array.isArray(report.coach) && report.coach.length) {
    lines.push(`\n[${t("popup.security.reportCoach")}]`);
    report.coach.forEach((task, index) => {
      lines.push(t("popup.security.coachItem", {
        index: index + 1,
        priority: task.priorityLabel,
        title: task.title,
        count: task.affectedCount
      }));
      lines.push(`   - ${t("popup.security.coachImpact", { value: task.impact })}`);
      lines.push(`   - ${t("popup.security.coachNextStep", { value: task.nextStep })}`);
    });
  }

  return lines.join("\n");
}

async function loadSecurityReport() {
  const response = await callBackground("getSecurityReport");
  elements.reportBox.textContent = buildReportText(response.report);
}

async function loadSettings() {
  const [response, stateResponse] = await Promise.all([
    callBackground("getSettings"),
    callBackground("getState")
  ]);
  state.settings = response.settings;
  setI18n(stateResponse.uiLanguage || state.settings.displayLanguage || "auto");
  applyPopupTranslations();
  elements.settingAutoLock.value = state.settings.autoLockMinutes;
  elements.settingClipboard.value = state.settings.clipboardClearSeconds;
  populateLanguageSelect(elements.settingLanguage, state.settings.displayLanguage || stateResponse.uiLanguage || "auto");
  if (elements.settingPasskeyProxy) {
    elements.settingPasskeyProxy.checked = Boolean(state.settings.passkeyProxyEnabled);
  }
  if (elements.settingPasskeyDesktopApproval) {
    elements.settingPasskeyDesktopApproval.checked = state.settings.passkeyDesktopApprovalEnabled ?? true;
  }
  if (elements.settingPasskeyProxyStatus) {
    if (!stateResponse.passkeyProxySupported) {
      paintInlineStatus(elements.settingPasskeyProxyStatus, `○ ${t("popup.settings.proxyStatusUnsupported")}`, "offline");
    } else if (stateResponse.passkeyProxyActive) {
      paintInlineStatus(elements.settingPasskeyProxyStatus, `● ${t("popup.settings.proxyStatusActive")}`, "online");
    } else {
      paintInlineStatus(elements.settingPasskeyProxyStatus, `○ ${t("popup.settings.proxyStatusInactive")}`, "warning");
    }
  }
  if (elements.settingPasskeyDesktopStatus) {
    const bridge = stateResponse.desktopPasskeyBridge || {};
    if (!elements.settingPasskeyDesktopApproval.checked) {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `○ ${t("popup.settings.desktopStatusDisabled")}`, "warning");
    } else if (!bridge.available) {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `○ ${t("popup.settings.desktopStatusUnavailable")}`, "offline");
    } else if (bridge.approvalMode === "touchid") {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `● ${t("popup.settings.desktopStatusTouchId")}`, "online");
    } else if (bridge.approvalMode === "windows-hello") {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `● ${t("popup.settings.desktopStatusWindowsHello")}`, "online");
    } else if (bridge.approvalMode === "desktop-dialog") {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `● ${t("popup.settings.desktopStatusDialog")}`, "online");
    } else {
      paintInlineStatus(elements.settingPasskeyDesktopStatus, `● ${t("popup.settings.desktopStatusOther", { value: approvalMethodLabel(bridge.approvalMode) || t("popup.method.desktopApproval") })}`, "online");
    }
  }
  if (elements.settingAliasEmail) {
    elements.settingAliasEmail.value = state.settings.aliasBaseEmail || "";
  }
}

function buildCloudStatusText(payload) {
  if (!payload?.connected) {
    return t("popup.cloud.statusLocal");
  }

  const lines = [];
  lines.push(t("popup.cloud.statusBaseUrl", { value: payload.baseUrl || t("common.unknown") }));
  lines.push(t("popup.cloud.statusUser", { value: payload.user?.email || t("common.unknown") }));
  lines.push(t("popup.cloud.statusBilling", { value: payload.billing?.planStatus || payload.user?.planStatus || t("common.unknown") }));
  lines.push(t("popup.cloud.statusPaid", { value: payload.billing?.isPaid ? t("popup.cloud.paidYes") : t("popup.cloud.paidNo") }));
  lines.push(t("popup.cloud.statusRevision", { value: payload.revision ?? 0 }));
  lines.push(t("popup.cloud.statusLastSync", { value: payload.lastSyncAt || t("popup.cloud.statusNever") }));
  return lines.join("\n");
}

function syncCloudBaseUrlInputs(value) {
  const nextValue = String(value || "").trim() || "http://localhost:8787";
  if (elements.cloudBaseUrl) {
    elements.cloudBaseUrl.value = nextValue;
  }
  if (elements.cloudBaseUrlSetting) {
    elements.cloudBaseUrlSetting.value = nextValue;
  }
}

async function loadCloudStatus() {
  const payload = await callBackground("cloudStatus");
  state.cloudStatus = payload;
  elements.cloudStatusBox.textContent = buildCloudStatusText(payload);

  if (payload.baseUrl) {
    syncCloudBaseUrlInputs(payload.baseUrl);
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
  elements.itemPasskeyRpId.value = item.passkey?.rpId || "";
  elements.itemPasskeyCredentialId.value = item.passkey?.credentialId || "";
  elements.itemPasskeyDisplayName.value = item.passkey?.userDisplayName || "";
  elements.itemPasskeyUserHandle.value = item.passkey?.userHandle || "";
  elements.itemPasskeyAttachment.value = item.passkey?.authenticatorAttachment || "";
  elements.itemPasskeyTransports.value = Array.isArray(item.passkey?.transports) ? item.passkey.transports.join(", ") : "";
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
  showItemForm(t("popup.items.editTitle", { title: item.title }));
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
    passkey: {
      rpId: elements.itemPasskeyRpId.value,
      credentialId: elements.itemPasskeyCredentialId.value,
      userDisplayName: elements.itemPasskeyDisplayName.value,
      userHandle: elements.itemPasskeyUserHandle.value,
      authenticatorAttachment: elements.itemPasskeyAttachment.value,
      transports: elements.itemPasskeyTransports.value.split(",").map((entry) => entry.trim()).filter(Boolean)
    },
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
  setStatus(t("popup.status.clipboardCopied"), false);

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
    t("popup.migration.completed", { count: result.added }),
    t("popup.migration.skippedDuplicates", { count: result.skippedDuplicates }),
    t("popup.migration.sourceFormat", { provider: result.sourceProvider, format: result.format })
  ];

  if (result.skippedInvalid > 0) {
    parts.push(t("popup.migration.skippedInvalid", { count: result.skippedInvalid }));
  }

  if (Array.isArray(result.warnings) && result.warnings.length) {
    parts.push(`${t("popup.auth.warningTitle")}: ${result.warnings[0]}`);
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
    throw new Error(t("popup.migration.fileRequired"));
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
    loadPendingCaptures(),
    loadPendingPasskeyApprovals(),
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
  if (cycle === "yearly") return t("popup.items.subscriptionYearly");
  if (cycle === "weekly") return t("popup.items.subscriptionWeekly");
  return t("popup.items.subscriptionMonthly");
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
      showEmpty(elements.subList, t("popup.subscriptions.empty"));
      return;
    }

    elements.subList.innerHTML = summary.items
      .map((item) => `
        <li class="card">
          <div class="card-head">
            <div class="card-icon card-type">💳</div>
            <div class="card-info">
              <p class="card-title">${escapeHtml(item.title)}</p>
              <p class="meta">${escapeHtml(cycleLabel(item.cycle))} ${escapeHtml(formatCurrency(item.amount, item.currency))}</p>
            </div>
          </div>
          ${item.nextBillingDate ? `<p class="meta">${escapeHtml(t("popup.subscriptions.nextBilling", { date: item.nextBillingDate }))}</p>` : ""}
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
        <input type="text" value="${escapeHtml(contact.name)}" placeholder="${escapeAttr(t("popup.settings.deadmanContactNamePlaceholder"))}" data-dm-field="name" data-dm-index="${index}" style="flex: 1;" />
        <input type="email" value="${escapeHtml(contact.email)}" placeholder="${escapeAttr(t("popup.settings.deadmanContactEmailPlaceholder"))}" data-dm-field="email" data-dm-index="${index}" style="flex: 1.5;" />
        <button type="button" class="ghost danger" data-dm-remove="${index}" style="padding: 6px 8px; font-size: 11px;" aria-label="${escapeAttr(t("popup.settings.deadmanRemoveContact"))}" title="${escapeAttr(t("popup.settings.deadmanRemoveContact"))}">✕</button>
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
      elements.deadmanStatus.textContent = t("popup.settings.deadmanStatusLastHeartbeat", {
        value: i18n.formatDateTime(new Date(config.lastHeartbeat), {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      });
    } else {
      elements.deadmanStatus.textContent = t("popup.settings.deadmanStatusNone");
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

  elements.mainView?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-tab-shortcut]");
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const tab = target.dataset.tabShortcut;
    if (!tab) {
      return;
    }

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
    showItemForm(t("popup.items.newItem"));
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
      setStatus(t("popup.auth.confirmPasswordMismatch"), true);
      return;
    }

    try {
      await callBackground("setupVault", { masterPassword: password });
      setView("main");
      elements.setupForm.reset();
      refreshPasswordStrengthUi();
      await refreshMainScreen();
      clearItemForm();
      setStatus(t("popup.status.vaultCreated"), false);
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
      setStatus(t("popup.status.vaultUnlocked"), false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.lockButton.addEventListener("click", async () => {
    await callBackground("lockVault");
    setView("unlock");
    clearItemForm();
    setStatus(t("popup.status.vaultLockedDone"), false);
  });

  elements.exportButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("exportBackup");
      const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
      downloadJson(`passwordmaneger-backup-${date}.json`, response.envelope);
      setStatus(t("popup.status.backupExported"), false);
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
      setStatus(t("popup.status.backupImported"), false);
    } catch (error) {
      setStatus(t("popup.status.restoreFailed", { error: error.message }), true);
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
      setStatus(error.message, true);
    }
  });

  elements.migrationPreviewButton.addEventListener("click", async () => {
    try {
      await buildMigrationDraftFromForm();
      setStatus(t("popup.status.migrationPreviewUpdated"), false);
    } catch (error) {
      setStatus(t("popup.status.migrationPreviewFailed", { error: error.message }), true);
    }
  });

  elements.migrationProvider.addEventListener("change", clearMigrationDraft);
  elements.migrationFile.addEventListener("change", clearMigrationDraft);
  elements.migrationReplace.addEventListener("change", clearMigrationDraft);

  elements.cloudRegisterButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("cloudRegister", cloudCredentials());
      await loadCloudStatus();
      setStatus(t("popup.status.cloudRegisterDone", { email: response.user.email }), false);
    } catch (error) {
      setStatus(t("popup.status.cloudRegisterFailed", { error: error.message }), true);
    }
  });

  elements.cloudLoginButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("cloudLogin", cloudCredentials());
      await loadCloudStatus();
      setStatus(t("popup.status.cloudLoginDone", { email: response.user.email }), false);
    } catch (error) {
      setStatus(t("popup.status.cloudLoginFailed", { error: error.message }), true);
    }
  });

  elements.cloudLogoutButton.addEventListener("click", async () => {
    try {
      await callBackground("cloudLogout");
      await loadCloudStatus();
      setStatus(t("popup.status.cloudLogoutDone"), false);
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
        setStatus(t("popup.status.cloudPullDone"), false);
      } else {
        setStatus(t("popup.status.cloudPullEmpty"), false);
      }
    } catch (error) {
      setStatus(error.message || t("common.actionFailed"), true);
    }
  });

  elements.cloudPushButton.addEventListener("click", async () => {
    try {
      const response = await callBackground("cloudSyncPush");
      await loadCloudStatus();
      setStatus(t("popup.status.cloudPushDone", { revision: response.revision }), false);
    } catch (error) {
      setStatus(t("popup.status.cloudPushFailed", { error: error.message }), true);
    }
  });

  elements.cloudRefreshButton.addEventListener("click", async () => {
    try {
      await loadCloudStatus();
      setStatus(t("popup.status.cloudRefreshed"), false);
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
      setStatus(t("popup.status.passwordGenerated"), false);
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
      setStatus(t("popup.status.aliasGenerated", { value: response.alias }), false);
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
      setStatus(t("popup.status.itemSaved"), false);
      hideItemForm();
      await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cancelEdit.addEventListener("click", () => {
    hideItemForm();
    setStatus(t("popup.status.editCancelled"), false);
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

    const emptyAction = target.dataset.emptyAction;
    if (emptyAction) {
      if (emptyAction === "new-login") {
        setTab("all-items");
        clearItemForm();
        showItemForm(t("popup.items.emptyFirstLogin"));
        elements.itemTitle.focus();
        return;
      }

      if (emptyAction === "new-passkey") {
        setTab("passkeys");
        clearItemForm();
        elements.itemType.value = "passkey";
        updateTypeVisibility();
        showItemForm(t("popup.status.itemFormManualPasskeyTitle"));
        elements.itemPasskeyRpId.focus();
        setStatus(t("popup.status.passkeyManualHint"), false);
        return;
      }

      if (emptyAction === "import") {
        setTab("migrate");
        elements.migrationFile.focus();
        return;
      }

      if (emptyAction === "generator") {
        setTab("generator");
        return;
      }
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
        if (item?.type === "passkey") {
          const confirmed = window.confirm(t("popup.confirm.passkeyDelete"));
          if (!confirmed) {
            setStatus(t("popup.status.passkeyDeleteCancelled"), false);
            return;
          }
        }
        await callBackground("deleteItem", { id });
        await Promise.all([loadItems(), loadSuggestions(), loadSecurityReport()]);
        setStatus(t("popup.status.itemDeleted"), false);
        return;
      }

      if (action === "autofill") {
        const { risk } = await callBackground("checkAutofillRisk", { id });
        let forceHighRisk = false;

        if (risk.level === "high") {
          forceHighRisk = window.confirm(t("popup.confirm.highRiskAutofill", {
            score: risk.score,
            reasons: risk.reasons.join(" / ")
          }));
          if (!forceHighRisk) {
            setStatus(t("popup.status.autofillHighRiskStopped"), false);
            return;
          }
        }

        const response = await callBackground("autofillActiveTab", { id, forceHighRisk });
        const learnedText = response.learned ? t("popup.status.autofillLearned") : "";
        setStatus(t("popup.status.autofillDone", { risk: riskLabel(response.risk), learned: learnedText }), false);
        await loadSuggestions();
        return;
      }

      if (action === "copy-user" && item) {
        const copyTarget = item.username || item?.passkey?.userDisplayName || item?.passkey?.credentialId || "";
        if (copyTarget) {
          await copyWithAutoClear(copyTarget);
        }
        return;
      }

      if (action === "copy-pass" && item?.password) {
        await copyWithAutoClear(item.password);
        return;
      }

      if (action === "copy-credential" && item?.passkey?.credentialId) {
        await copyWithAutoClear(item.passkey.credentialId);
        return;
      }

      if (action === "totp" && item?.otpSecret) {
        const totp = await callBackground("generateTotp", { secret: item.otpSecret });
        await copyWithAutoClear(totp.code);
        setStatus(t("popup.status.otpCopied", { code: totp.code, seconds: totp.expiresIn }), false);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.passkeyApprovalList?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const approvalId = target.dataset.approvalId;
    const action = target.dataset.approvalAction;
    if (!approvalId || !action) {
      return;
    }

    try {
      await callBackground("decidePasskeyApproval", {
        approvalId,
        approved: action === "approve"
      });
      await loadPendingPasskeyApprovals();
      setStatus(action === "approve" ? t("popup.status.passkeyApproved") : t("popup.status.passkeyRejected"), false);
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
        forceHighRisk = window.confirm(t("popup.confirm.highRiskAutofill", {
          score: risk.score,
          reasons: risk.reasons.join(" / ")
        }));
        if (!forceHighRisk) {
          setStatus(t("popup.status.autofillHighRiskStopped"), false);
          return;
        }
      }

      const response = await callBackground("autofillActiveTab", { id, forceHighRisk });
      const learnedText = response.learned ? t("popup.status.autofillLearned") : "";
      setStatus(t("popup.status.autofillDone", { risk: riskLabel(response.risk), learned: learnedText }), false);
      await loadSuggestions();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.pendingCaptureList?.addEventListener("click", async (event) => {
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
      if (action === "save-capture") {
        await callBackground("savePendingCapture", { id });
        await Promise.all([loadPendingCaptures(), loadSuggestions(), loadItems()]);
        setStatus(t("popup.status.captureSaved"), false);
        return;
      }

      if (action === "discard-capture") {
        await callBackground("discardPendingCapture", { id });
        await loadPendingCaptures();
        setStatus(t("popup.status.captureLater"), false);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.refreshReportButton.addEventListener("click", async () => {
    try {
      await loadSecurityReport();
      setStatus(t("popup.status.securityUpdated"), false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const enablingPasskeyProxy = Boolean(elements.settingPasskeyProxy?.checked) && !Boolean(state.settings?.passkeyProxyEnabled);
      if (enablingPasskeyProxy) {
        const confirmed = window.confirm(t("popup.confirm.enablePasskeyProxy"));
        if (!confirmed) {
          elements.settingPasskeyProxy.checked = false;
          setStatus(t("popup.status.passkeyBetaCancelled"), false);
          return;
        }
      }

      await callBackground("saveSettings", {
        settings: {
          displayLanguage: elements.settingLanguage?.value || "auto",
          autoLockMinutes: Number(elements.settingAutoLock.value),
          clipboardClearSeconds: Number(elements.settingClipboard.value),
          passkeyProxyEnabled: Boolean(elements.settingPasskeyProxy?.checked),
          passkeyDesktopApprovalEnabled: Boolean(elements.settingPasskeyDesktopApproval?.checked)
        }
      });
      await loadSettings();
      setStatus(t("popup.status.settingsSaved"), false);
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
      setStatus(t("popup.status.masterChanged"), false);
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
      setStatus(t("popup.status.aliasSettingsSaved"), false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Subscription tab
  elements.refreshSubsButton?.addEventListener("click", async () => {
    try {
      await loadSubscriptionSummary();
      setStatus(t("popup.status.subscriptionsUpdated"), false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  // Deadman's Switch
  elements.deadmanAddContact?.addEventListener("click", () => {
    if (deadmanContacts.length >= 5) {
      setStatus(t("popup.status.contactsLimit"), true);
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
      setStatus(t("popup.status.deadmanSaved"), false);
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
      setStatus(t("popup.status.passwordGeneratedSimple"), false);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.genCopyButton?.addEventListener("click", async () => {
    const pw = elements.genResult.value;
    if (!pw) {
      setStatus(t("popup.status.generateFirst"), true);
      return;
    }
    await copyWithAutoClear(pw);
  });

  elements.cloudBaseUrlSetting?.addEventListener("change", () => {
    syncCloudBaseUrlInputs(elements.cloudBaseUrlSetting.value);
  });
}

async function bootstrap() {
  setI18n("auto");
  applyPopupTranslations();
  bindPasswordAssistUi();
  bindEvents();
  clearItemForm();
  refreshPasswordStrengthUi();
  syncCloudBaseUrlInputs(elements.cloudBaseUrl.value);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "PM_PASSKEY_APPROVALS_UPDATED") {
      loadPendingPasskeyApprovals().catch((error) => setStatus(error.message, true));
    }
  });

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes.pm_pending_captures) {
      loadPendingCaptures().catch((error) => setStatus(error.message, true));
    }
  });

  try {
    const response = await callBackground("getState");
    setI18n(response.uiLanguage || "auto");
    applyPopupTranslations();

    if (!response.initialized) {
      setView("setup");
      setStatus(t("popup.status.createVaultFirst"), false);
      return;
    }

    if (!response.unlocked) {
      setView("unlock");
      setStatus(t("popup.status.vaultLocked"), false);
      return;
    }

    setView("main");
    await refreshMainScreen();
    setStatus(t("popup.status.vaultLoaded"), false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    document.body.classList.remove("i18n-pending");
  }
}

bootstrap();
