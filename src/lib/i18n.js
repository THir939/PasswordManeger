import { LOCALE_MESSAGES } from "./locale-data.js";
import { LOCALE_EXTRA_MESSAGES } from "./locale-extra-data.js";

export const UI_LANGUAGE_STORAGE_KEY = "pm_ui_language";

export const SUPPORTED_LOCALES = [
  "en",
  "ja",
  "es",
  "fr",
  "de",
  "pt-BR",
  "zh-CN",
  "ko"
];

const MERGED_LOCALE_MESSAGES = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      ...(LOCALE_MESSAGES[locale] || {}),
      ...(LOCALE_EXTRA_MESSAGES[locale] || {})
    }
  ])
);

const LOCALE_ALIASES = new Map([
  ["en", "en"],
  ["en-us", "en"],
  ["en-gb", "en"],
  ["ja", "ja"],
  ["ja-jp", "ja"],
  ["es", "es"],
  ["es-es", "es"],
  ["es-419", "es"],
  ["fr", "fr"],
  ["fr-fr", "fr"],
  ["de", "de"],
  ["de-de", "de"],
  ["pt", "pt-BR"],
  ["pt-br", "pt-BR"],
  ["zh", "zh-CN"],
  ["zh-cn", "zh-CN"],
  ["zh-sg", "zh-CN"],
  ["ko", "ko"],
  ["ko-kr", "ko"]
]);

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function canonicalizeLocale(value) {
  const normalized = normalizeKey(value);
  if (!normalized || normalized === "auto") {
    return "auto";
  }

  if (LOCALE_ALIASES.has(normalized)) {
    return LOCALE_ALIASES.get(normalized);
  }

  const base = normalized.split("-")[0];
  if (LOCALE_ALIASES.has(base)) {
    return LOCALE_ALIASES.get(base);
  }

  return "en";
}

export function getBrowserLocale() {
  if (typeof chrome !== "undefined" && typeof chrome.i18n?.getUILanguage === "function") {
    return chrome.i18n.getUILanguage();
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en";
}

export function resolveLocale(preferred = "auto", browserLocale = getBrowserLocale()) {
  const choice = canonicalizeLocale(preferred);
  if (choice !== "auto") {
    return choice;
  }
  return canonicalizeLocale(browserLocale) || "en";
}

function interpolate(template, variables = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, name) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return String(variables[name]);
    }
    return `{${name}}`;
  });
}

export function createI18n({ preferredLocale = "auto", browserLocale = getBrowserLocale() } = {}) {
  const locale = resolveLocale(preferredLocale, browserLocale);
  const messages = MERGED_LOCALE_MESSAGES[locale] || MERGED_LOCALE_MESSAGES.en || {};
  const fallback = MERGED_LOCALE_MESSAGES.en || {};

  return {
    locale,
    preferredLocale: canonicalizeLocale(preferredLocale),
    browserLocale,
    t(key, variables = {}) {
      const template = messages[key] ?? fallback[key] ?? key;
      return interpolate(template, variables);
    },
    has(key) {
      return Object.prototype.hasOwnProperty.call(messages, key) || Object.prototype.hasOwnProperty.call(fallback, key);
    },
    formatDateTime(value, options = {}) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return new Intl.DateTimeFormat(locale, options).format(date);
    },
    formatList(items = []) {
      return new Intl.ListFormat(locale, {
        style: "short",
        type: "conjunction"
      }).format(items.filter(Boolean).map((item) => String(item)));
    }
  };
}
