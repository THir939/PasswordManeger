const statusEl = document.querySelector("#status");
const accountBox = document.querySelector("#account-box");

const inputs = {
  registerEmail: document.querySelector("#register-email"),
  registerPassword: document.querySelector("#register-password"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
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
  latestShares: []
};

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("ok", !isError && Boolean(message));
}

function saveToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem("pm_cloud_token", state.token);
  } else {
    localStorage.removeItem("pm_cloud_token");
  }
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
    accountBox.textContent = "未ログイン";
    return;
  }

  try {
    const me = await api("/api/auth/me");
    const billing = await api("/api/billing/status");

    accountBox.textContent = JSON.stringify(
      {
        user: me.user,
        billing
      },
      null,
      2
    );

    setStatus("アカウント情報を更新しました。", false);
  } catch (error) {
    saveToken("");
    accountBox.textContent = "未ログイン";
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
  setStatus("ログインしました。", false);
  await refreshAccount();
}

function logout() {
  saveToken("");
  accountBox.textContent = "未ログイン";
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

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value;
    GF_LOG[value] = index;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11b;
    }
  }

  for (let index = 255; index < 512; index += 1) {
    GF_EXP[index] = GF_EXP[index - 255];
  }
})();

function gfMultiply(left, right) {
  if (left === 0 || right === 0) {
    return 0;
  }
  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function gfDivide(left, right) {
  if (right === 0) {
    throw new Error("ゼロ除算です。");
  }
  if (left === 0) {
    return 0;
  }
  const index = (GF_LOG[left] - GF_LOG[right] + 255) % 255;
  return GF_EXP[index];
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

buttons.register.addEventListener("click", () => {
  register().catch((error) => setStatus(error.message, true));
});

buttons.login.addEventListener("click", () => {
  login().catch((error) => setStatus(error.message, true));
});

buttons.logout.addEventListener("click", () => {
  logout();
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
