import { createI18n, getBrowserLocale, SUPPORTED_LOCALES } from "../lib/i18n.js";
import { getOptionsContent } from "../lib/options-content.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tabs = [...document.querySelectorAll(".ribbon-tab")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const learningRefreshButton = document.querySelector("#learning-refresh-btn");
  const learningResetAllButton = document.querySelector("#learning-reset-all-btn");
  const learningStatus = document.querySelector("#learning-status");
  const learningEmpty = document.querySelector("#learning-empty");
  const learningList = document.querySelector("#learning-list");
  const languageSelect = document.querySelector("#options-language");

  let i18n = createI18n({
    preferredLocale: "auto",
    browserLocale: getBrowserLocale()
  });

  const t = (key, variables = {}) => i18n.t(key, variables);

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setLocale(preferredLocale = "auto") {
    i18n = createI18n({
      preferredLocale,
      browserLocale: getBrowserLocale()
    });
    document.documentElement.lang = i18n.locale;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function setHtml(selector, html) {
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = html;
    }
  }

  function setLearningStatus(message, tone = "neutral") {
    if (!learningStatus) {
      return;
    }

    learningStatus.textContent = message;
    if (message) {
      learningStatus.dataset.runtimeMessage = "true";
    } else {
      delete learningStatus.dataset.runtimeMessage;
    }
    learningStatus.classList.remove("is-error", "is-success");
    if (tone === "error") {
      learningStatus.classList.add("is-error");
    } else if (tone === "success") {
      learningStatus.classList.add("is-success");
    }
  }

  function setLearningBusy(busy) {
    [learningRefreshButton, learningResetAllButton].forEach((button) => {
      if (button) {
        button.disabled = busy;
      }
    });
  }

  function populateLanguageSelect(currentValue = "auto") {
    if (!languageSelect) {
      return;
    }
    const options = [
      { value: "auto", label: t("language.auto") },
      ...SUPPORTED_LOCALES.map((locale) => ({
        value: locale,
        label: t(`language.${locale}`)
      }))
    ];
    languageSelect.innerHTML = options
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    languageSelect.value = currentValue || "auto";
  }

  function applyStaticTranslations() {
    const content = getOptionsContent(i18n.locale);

    document.title = `${t("app.name")} - ${t("options.title")}`;
    setText(".header-text .kicker", t("options.kicker"));
    setText(".header-text h1", t("options.title"));
    setText(".language-picker span", t("language.label"));

    const tabKeyMap = {
      "tab-overview": "options.tab.overview",
      "tab-features": "options.tab.features",
      "tab-usage": "options.tab.usage",
      "tab-warnings": "options.tab.warnings",
      "tab-trouble": "options.tab.trouble"
    };
    tabs.forEach((tab) => {
      const key = tabKeyMap[tab.dataset.target];
      if (key) {
        tab.textContent = t(key);
      }
    });

    setText("#tab-overview h2", content.overview.title);
    setText("#tab-overview .sub", content.overview.sub);
    document.querySelectorAll("#tab-overview .hero-meta .pill").forEach((pill, index) => {
      pill.textContent = content.overview.pills[index] || "";
    });
    setText("#tab-overview h3", content.overview.questionTitle);
    setText("#tab-overview .hint", content.overview.questionHint);
    setHtml("#tab-overview .feature-list", content.overview.capabilities
      .map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</li>`)
      .join(""));

    setText("#tab-features h2", content.features.title);
    setHtml("#tab-features .feature-list.rich", content.features.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join(""));

    setText("#tab-usage h2", content.usage.title);
    document.querySelectorAll("#tab-usage .step-list li").forEach((stepItem, index) => {
      const step = content.usage.steps[index];
      if (!step) {
        return;
      }
      const titleNode = stepItem.querySelector(".step-text strong");
      const bodyNode = stepItem.querySelector(".step-text span");
      if (titleNode) {
        titleNode.textContent = step.title;
      }
      if (bodyNode) {
        bodyNode.textContent = step.text;
      }
    });

    setText("#tab-warnings h2", content.warnings.title);
    setHtml("#tab-warnings .feature-list", content.warnings.items
      .map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</li>`)
      .join(""));

    setText("#tab-trouble h2", content.trouble.title);
    setText("#tab-trouble .learning-tools h3", content.trouble.learningTitle);
    setText("#tab-trouble .learning-tools .hint", content.trouble.learningHint);
    if (learningRefreshButton) {
      learningRefreshButton.textContent = t("common.refresh");
    }
    if (learningResetAllButton) {
      learningResetAllButton.textContent = t("options.learning.resetAll");
    }
    if (learningStatus && !learningStatus.dataset.runtimeMessage) {
      learningStatus.textContent = content.trouble.defaultStatus;
    }
    if (learningEmpty) {
      learningEmpty.textContent = content.trouble.empty;
    }

    document.querySelectorAll("#tab-trouble .trouble-item").forEach((item, index) => {
      const faq = content.trouble.faqs[index];
      if (!faq) {
        return;
      }
      const questionNode = item.querySelector("h4");
      const answerNode = item.querySelector("p");
      if (questionNode) {
        questionNode.textContent = faq.q;
      }
      if (answerNode) {
        answerNode.textContent = faq.a;
      }
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return t("options.learning.noTimestamp");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("options.learning.noTimestamp");
    }

    return i18n.formatDateTime(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function canUseExtensionRuntime() {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  }

  function callBackground(action, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!canUseExtensionRuntime()) {
        reject(new Error(t("options.learning.runtimeOnly")));
        return;
      }

      chrome.runtime.sendMessage(
        {
          action,
          ...(payload || {})
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || t("common.actionFailed")));
            return;
          }

          resolve(response);
        }
      );
    });
  }

  function renderLearningRows(rows = []) {
    if (!learningList || !learningEmpty) {
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      learningList.hidden = true;
      learningList.innerHTML = "";
      learningEmpty.hidden = false;
      return;
    }

    learningEmpty.hidden = true;
    learningList.hidden = false;
    learningList.innerHTML = rows
      .map((row, index) => {
        const domain = String(row.domain || t("options.learning.unknownSite"));
        const mode = String(row.mode || t("options.learning.unknownMode"));
        const fillCount = Number(row.fillCount || 0);
        const updatedAt = formatDateTime(row.updatedAt);
        return `
          <li class="learning-item">
            <div class="learning-item-head">
              <div>
                <strong>${escapeHtml(domain)}</strong>
                <p class="learning-meta">${escapeHtml(t("options.learning.meta", { mode, count: fillCount, updatedAt }))}</p>
              </div>
              <button type="button" class="danger-btn learning-reset-btn" data-index="${index}">${escapeHtml(t("options.learning.resetOne"))}</button>
            </div>
          </li>
        `;
      })
      .join("");

    learningList.querySelectorAll(".learning-reset-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = rows[Number(button.dataset.index)];
        if (!row) {
          return;
        }

        try {
          setLearningBusy(true);
          const result = await callBackground("resetFormLearning", {
            domain: row.domain,
            mode: row.mode
          });
          setLearningStatus(t("options.learning.resetOneDone", { domain: row.domain, count: result.removed || 0 }), "success");
          await refreshLearningSummary();
        } catch (error) {
          setLearningStatus(error.message || t("options.learning.resetOneError"), "error");
        } finally {
          setLearningBusy(false);
        }
      });
    });
  }

  async function refreshLearningSummary() {
    try {
      setLearningBusy(true);
      setLearningStatus(t("options.learning.loading"));
      const response = await callBackground("getFormLearningSummary");
      const rows = Array.isArray(response.rows) ? response.rows : [];
      renderLearningRows(rows);
      setLearningStatus(
        rows.length > 0
          ? t("options.learning.loaded", { count: rows.length })
          : t("options.learning.emptyStatus"),
        "success"
      );
    } catch (error) {
      renderLearningRows([]);
      setLearningStatus(error.message || t("options.learning.loadError"), "error");
    } finally {
      setLearningBusy(false);
    }
  }

  function activateTab(targetId) {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.target === targetId);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === targetId);
    });
  }

  try {
    const state = await callBackground("getState");
    setLocale(state.uiLanguage || "auto");
    populateLanguageSelect(state.uiLanguage || "auto");
  } catch {
    setLocale("auto");
    populateLanguageSelect("auto");
  }

  applyStaticTranslations();
  document.body.classList.remove("i18n-pending");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.target);
    });
  });

  languageSelect?.addEventListener("change", async () => {
    const nextLanguage = languageSelect.value || "auto";
    setLocale(nextLanguage);
    populateLanguageSelect(nextLanguage);
    applyStaticTranslations();
    try {
      await callBackground("setUiLanguage", { uiLanguage: nextLanguage });
      await refreshLearningSummary();
    } catch (error) {
      setLearningStatus(error.message || t("options.learning.runtimeError"), "error");
    }
  });

  learningRefreshButton?.addEventListener("click", () => {
    refreshLearningSummary();
  });

  learningResetAllButton?.addEventListener("click", async () => {
    try {
      setLearningBusy(true);
      const result = await callBackground("resetFormLearning");
      setLearningStatus(t("options.learning.resetAllDone", { count: result.removed || 0 }), "success");
      await refreshLearningSummary();
    } catch (error) {
      setLearningStatus(error.message || t("options.learning.resetAllError"), "error");
    } finally {
      setLearningBusy(false);
    }
  });

  refreshLearningSummary();
});
