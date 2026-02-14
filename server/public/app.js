import { passwordStrength } from "./password-strength.js";

const statusEl = document.querySelector("#status");
const accountBox = document.querySelector("#account-box");
const entitlementListEl = document.querySelector("#entitlement-list");
const summaryEmailEl = document.querySelector("#summary-email");
const summaryPlanEl = document.querySelector("#summary-plan");
const summaryPaidEl = document.querySelector("#summary-paid");
const summaryPeriodEl = document.querySelector("#summary-period");

const inputs = {
  registerEmail: document.querySelector("#register-email"),
  registerPassword: document.querySelector("#register-password"),
  registerPasswordToggle: document.querySelector("#register-password-toggle"),
  registerPasswordStrength: document.querySelector("#register-password-strength"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  loginPasswordToggle: document.querySelector("#login-password-toggle"),
  loginPasswordStrength: document.querySelector("#login-password-strength"),
  recoverySecret: document.querySelector("#recovery-secret-input"),
  shareTotal: document.querySelector("#share-total-input"),
  shareThreshold: document.querySelector("#share-threshold-input"),
  sharesOutput: document.querySelector("#shares-output"),
  sharesInput: document.querySelector("#shares-input")
};

const buttons = {
  register: document.querySelector("#register-btn"),
  login: document.querySelector("#login-btn"),
  logout: document.querySelector("#logout-btn"),
  refreshAccount: document.querySelector("#refresh-account-btn"),
  checkout: document.querySelector("#checkout-btn"),
  portal: document.querySelector("#portal-btn"),
  emergency: document.querySelector("#emergency-btn"),
  recoveryGenerate: document.querySelector("#recovery-generate-btn"),
  splitShares: document.querySelector("#split-shares-btn"),
  downloadShares: document.querySelector("#download-shares-btn"),
  recoverSecret: document.querySelector("#recover-secret-btn")
};

const recoveredSecretBox = document.querySelector("#recovered-secret-box");

const state = {
  token: localStorage.getItem("pm_cloud_token") || "",
  latestShares: [],
  account: null
};

function setStatus(message, isError = false) {
  const hasMessage = Boolean(message);
  statusEl.textContent = hasMessage ? String(message) : "";
  statusEl.classList.toggle("ok", hasMessage && !isError);
  statusEl.classList.toggle("error", hasMessage && isError);
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
  bindVisibilityToggle(inputs.registerPassword, inputs.registerPasswordToggle);
  bindVisibilityToggle(inputs.loginPassword, inputs.loginPasswordToggle);

  if (inputs.registerPassword) {
    paintStrength(inputs.registerPasswordStrength, inputs.registerPassword.value, 10);
    inputs.registerPassword.addEventListener("input", () => {
      paintStrength(inputs.registerPasswordStrength, inputs.registerPassword.value, 10);
    });
  }

  if (inputs.loginPassword) {
    paintStrength(inputs.loginPasswordStrength, inputs.loginPassword.value, 10);
    inputs.loginPassword.addEventListener("input", () => {
      paintStrength(inputs.loginPasswordStrength, inputs.loginPassword.value, 10);
    });
  }
}

function saveToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem("pm_cloud_token", state.token);
  } else {
    localStorage.removeItem("pm_cloud_token");
  }
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sourceLabel(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "stripe") return "Stripe";
  if (["apple", "apple_app_store", "app_store"].includes(normalized)) return "App Store";
  if (["google_play", "google"].includes(normalized)) return "Google Play";
  if (normalized === "manual") return "Manual";
  if (!normalized) return "Unknown";
  return source;
}

function renderLoggedOutAccount() {
  state.account = null;
  accountBox.textContent = "未ログイン";
  summaryEmailEl.textContent = "未ログイン";
  summaryPlanEl.textContent = "inactive";
  summaryPlanEl.classList.remove("plan-active");
  summaryPlanEl.classList.add("plan-inactive");
  summaryPaidEl.textContent = "いいえ";
  summaryPeriodEl.textContent = "-";
  entitlementListEl.innerHTML = '<li class="empty">未ログイン</li>';
}

function renderEntitlementList(entitlements = []) {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    entitlementListEl.innerHTML = '<li class="empty">有効な利用権がありません。</li>';
    return;
  }

  entitlementListEl.innerHTML = entitlements
    .map((entitlement) => {
      const source = sourceLabel(entitlement.source);
      const status = String(entitlement.status || "inactive");
      const expires = entitlement.expiresAt ? formatDateTime(entitlement.expiresAt) : "期限なし";
      const feature = String(entitlement.feature || "cloud_sync");
      return `
        <li class="entitlement-item">
          <div class="entitlement-head">
            <p class="entitlement-source">${escapeHtml(source)} / ${escapeHtml(feature)}</p>
            <span class="entitlement-status ${escapeHtml(status)}">${escapeHtml(status)}</span>
          </div>
          <p class="entitlement-meta">sourceRef: ${escapeHtml(entitlement.sourceRef || "-")}</p>
          <p class="entitlement-meta">expires: ${escapeHtml(expires)}</p>
        </li>
      `;
    })
    .join("");
}

function renderAccount(payload) {
  state.account = payload;

  const user = payload?.user || {};
  const billing = payload?.billing || {};

  summaryEmailEl.textContent = user.email || "-";
  summaryPlanEl.textContent = billing.planStatus || user.planStatus || "inactive";

  if (billing.isPaid) {
    summaryPlanEl.classList.remove("plan-inactive");
    summaryPlanEl.classList.add("plan-active");
  } else {
    summaryPlanEl.classList.remove("plan-active");
    summaryPlanEl.classList.add("plan-inactive");
  }

  summaryPaidEl.textContent = billing.isPaid ? "はい" : "いいえ";
  summaryPeriodEl.textContent = formatDateTime(billing.currentPeriodEnd || user.currentPeriodEnd);

  renderEntitlementList(Array.isArray(billing.entitlements) ? billing.entitlements : []);
  accountBox.textContent = JSON.stringify(payload, null, 2);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

async function refreshAccount() {
  if (!state.token) {
    renderLoggedOutAccount();
    return;
  }

  try {
    const [me, billing, entitlements] = await Promise.all([
      api("/api/auth/me"),
      api("/api/billing/status"),
      api("/api/entitlements/status").catch(() => null)
    ]);

    const payload = {
      user: me.user,
      billing,
      entitlements
    };
    renderAccount(payload);

    setStatus("アカウント情報を更新しました。", false);
  } catch (error) {
    saveToken("");
    renderLoggedOutAccount();
    setStatus(error.message, true);
  }
}

async function register() {
  const email = inputs.registerEmail.value.trim();
  const password = inputs.registerPassword.value;

  const data = await api("/api/auth/register", {
    method: "POST",
    body: { email, password }
  });

  saveToken(data.token);
  inputs.registerPassword.value = "";
  paintStrength(inputs.registerPasswordStrength, "", 10);
  setStatus("アカウントを作成しました。", false);
  await refreshAccount();
}

async function login() {
  const email = inputs.loginEmail.value.trim();
  const password = inputs.loginPassword.value;

  const data = await api("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });

  saveToken(data.token);
  inputs.loginPassword.value = "";
  paintStrength(inputs.loginPasswordStrength, "", 10);
  setStatus("ログインしました。", false);
  await refreshAccount();
}

function logout() {
  saveToken("");
  renderLoggedOutAccount();
  setStatus("ログアウトしました。", false);
}

async function startCheckout() {
  const data = await api("/api/billing/checkout-session", {
    method: "POST"
  });

  window.location.href = data.url;
}

async function openPortal() {
  const data = await api("/api/billing/portal-session", {
    method: "POST"
  });

  window.location.href = data.url;
}

function downloadText(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

async function emergencyExport() {
  const data = await api("/api/vault/emergency-export");
  const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadJson(`passwordmaneger-emergency-export-${date}.json`, data.snapshot);
  setStatus("暗号化データをダウンロードしました。マスターパスワードと一緒に安全な場所へ保管してください。", false);
}

function randomRecoverySecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const chunks = raw.match(/.{1,8}/g) || [];
  return `PM-RECOVERY-${chunks.join("-").toUpperCase()}`;
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function gfMultiply(left, right) {
  let a = Number(left) & 0xff;
  let b = Number(right) & 0xff;
  let result = 0;

  while (b > 0) {
    if (b & 1) {
      result ^= a;
    }

    const carry = a & 0x80;
    a = (a << 1) & 0xff;
    if (carry) {
      a ^= 0x1b;
    }

    b >>= 1;
  }

  return result;
}

function gfPow(base, exponent) {
  let result = 1;
  let factor = Number(base) & 0xff;
  let power = Number(exponent);

  while (power > 0) {
    if (power & 1) {
      result = gfMultiply(result, factor);
    }
    factor = gfMultiply(factor, factor);
    power >>= 1;
  }

  return result;
}

function gfInverse(value) {
  const v = Number(value) & 0xff;
  if (v === 0) {
    throw new Error("ゼロの逆元は存在しません。");
  }
  return gfPow(v, 254);
}

function gfDivide(left, right) {
  if (right === 0) {
    throw new Error("ゼロ除算です。");
  }
  if (left === 0) {
    return 0;
  }
  return gfMultiply(left, gfInverse(right));
}

function evaluatePolynomial(coefficients, x) {
  let y = 0;
  let xPower = 1;
  for (const coefficient of coefficients) {
    y ^= gfMultiply(coefficient, xPower);
    xPower = gfMultiply(xPower, x);
  }
  return y;
}

function splitSecret(secretText, threshold, totalShares) {
  const secretBytes = new TextEncoder().encode(secretText);
  const shares = Array.from({ length: totalShares }, (_, index) => ({
    x: index + 1,
    bytes: new Uint8Array(secretBytes.length)
  }));

  for (let byteIndex = 0; byteIndex < secretBytes.length; byteIndex += 1) {
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secretBytes[byteIndex];

    if (threshold > 1) {
      const random = new Uint8Array(threshold - 1);
      crypto.getRandomValues(random);
      for (let index = 1; index < threshold; index += 1) {
        coefficients[index] = random[index - 1];
      }
    }

    for (const share of shares) {
      share.bytes[byteIndex] = evaluatePolynomial(coefficients, share.x);
    }
  }

  return shares.map((share) => `PM-SHARE-${share.x}-${threshold}of${totalShares}:${bytesToBase64(share.bytes)}`);
}

function parseShareLine(line) {
  const match = String(line || "").trim().match(/^PM-SHARE-(\d+)-(\d+)of(\d+):([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error(`シェア形式が不正です: ${line}`);
  }

  return {
    x: Number(match[1]),
    threshold: Number(match[2]),
    total: Number(match[3]),
    bytes: base64ToBytes(match[4])
  };
}

function recoverSecret(shareLines) {
  const parsed = shareLines.map(parseShareLine);
  if (!parsed.length) {
    throw new Error("シェアがありません。");
  }

  const threshold = parsed[0].threshold;
  const total = parsed[0].total;

  if (parsed.length < threshold) {
    throw new Error(`復元には最低${threshold}個のシェアが必要です。`);
  }

  const unique = new Map();
  for (const share of parsed) {
    if (share.threshold !== threshold || share.total !== total) {
      throw new Error("異なるセットのシェアが混在しています。");
    }
    unique.set(share.x, share);
  }

  const selected = [...unique.values()].slice(0, threshold);
  const length = selected[0].bytes.length;
  if (selected.some((share) => share.bytes.length !== length)) {
    throw new Error("シェア長が一致しません。");
  }

  const secretBytes = new Uint8Array(length);

  for (let byteIndex = 0; byteIndex < length; byteIndex += 1) {
    let recovered = 0;

    for (let i = 0; i < selected.length; i += 1) {
      const shareI = selected[i];
      let numerator = 1;
      let denominator = 1;

      for (let j = 0; j < selected.length; j += 1) {
        if (i === j) {
          continue;
        }
        const shareJ = selected[j];
        numerator = gfMultiply(numerator, shareJ.x);
        denominator = gfMultiply(denominator, shareI.x ^ shareJ.x);
      }

      const lagrange = gfDivide(numerator, denominator);
      recovered ^= gfMultiply(shareI.bytes[byteIndex], lagrange);
    }

    secretBytes[byteIndex] = recovered;
  }

  return new TextDecoder().decode(secretBytes);
}

function splitRecoveryKey() {
  const secret = String(inputs.recoverySecret.value || "").trim();
  if (!secret) {
    throw new Error("復旧キーを入力してください（またはキー生成を実行）。");
  }

  const totalShares = Number(inputs.shareTotal.value);
  const threshold = Number(inputs.shareThreshold.value);

  if (!Number.isInteger(totalShares) || totalShares < 2 || totalShares > 10) {
    throw new Error("分割数は2〜10で指定してください。");
  }

  if (!Number.isInteger(threshold) || threshold < 2 || threshold > totalShares) {
    throw new Error("復元必要数は2以上、かつ分割数以下にしてください。");
  }

  const shares = splitSecret(secret, threshold, totalShares);
  state.latestShares = shares;
  inputs.sharesOutput.value = shares.join("\n");
  setStatus(`鍵分割を作成しました（${threshold} of ${totalShares}）。`, false);
}

function recoverFromShares() {
  const lines = String(inputs.sharesInput.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const recovered = recoverSecret(lines);
  recoveredSecretBox.textContent = recovered;
  setStatus("シェアから復旧キーを再構築しました。", false);
}

bindPasswordAssistUi();

buttons.register.addEventListener("click", () => {
  register().catch((error) => setStatus(error.message, true));
});

buttons.login.addEventListener("click", () => {
  login().catch((error) => setStatus(error.message, true));
});

buttons.logout.addEventListener("click", () => {
  logout();
});

buttons.refreshAccount.addEventListener("click", () => {
  refreshAccount().catch((error) => setStatus(error.message, true));
});

buttons.checkout.addEventListener("click", () => {
  startCheckout().catch((error) => setStatus(error.message, true));
});

buttons.portal.addEventListener("click", () => {
  openPortal().catch((error) => setStatus(error.message, true));
});

buttons.emergency.addEventListener("click", () => {
  emergencyExport().catch((error) => setStatus(error.message, true));
});

buttons.recoveryGenerate.addEventListener("click", () => {
  inputs.recoverySecret.value = randomRecoverySecret();
  setStatus("復旧キーを生成しました。必要なら鍵分割してください。", false);
});

buttons.splitShares.addEventListener("click", () => {
  try {
    splitRecoveryKey();
  } catch (error) {
    setStatus(error.message, true);
  }
});

buttons.downloadShares.addEventListener("click", () => {
  if (!state.latestShares.length) {
    setStatus("先に鍵分割を作成してください。", true);
    return;
  }

  const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadText(`passwordmaneger-key-shares-${date}.txt`, state.latestShares.join("\n"), "text/plain");
  setStatus("鍵分割結果を保存しました。別々の安全な場所へ保管してください。", false);
});

buttons.recoverSecret.addEventListener("click", () => {
  try {
    recoverFromShares();
  } catch (error) {
    setStatus(error.message, true);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("view") === "emergency") {
  setStatus("緊急アクセス画面です。ログイン後に「緊急アクセス」を押して暗号化データを取得してください。", false);
}

refreshAccount().catch((error) => setStatus(error.message, true));
