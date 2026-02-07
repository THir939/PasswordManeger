const statusEl = document.querySelector("#status");
const accountBox = document.querySelector("#account-box");

const inputs = {
  registerEmail: document.querySelector("#register-email"),
  registerPassword: document.querySelector("#register-password"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password")
};

const buttons = {
  register: document.querySelector("#register-btn"),
  login: document.querySelector("#login-btn"),
  logout: document.querySelector("#logout-btn"),
  checkout: document.querySelector("#checkout-btn"),
  portal: document.querySelector("#portal-btn")
};

const state = {
  token: localStorage.getItem("pm_cloud_token") || ""
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

refreshAccount().catch((error) => setStatus(error.message, true));
