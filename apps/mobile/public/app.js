/* ============================================================
   PasswordManeger Mobile — Frontend Logic
   ============================================================ */
const API = "/api/action";

// ===== API Helper =====
async function callApi(action, payload = {}) {
    const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Unknown error");
    return data;
}

// ===== DOM Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

let toastTimer = null;
function toast(msg, isError = false) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = isError ? "toast error" : "toast";
    show(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(el), 3000);
}

// ===== Password Toggle =====
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-pw");
    if (!btn) return;
    const target = $(` #${btn.dataset.target}`);
    if (!target) return;
    target.type = target.type === "password" ? "text" : "password";
    btn.textContent = target.type === "password" ? "👁" : "🔒";
});

// ===== Strength Meter =====
function updateStrength(meterId, password) {
    const meter = $(meterId);
    if (!meter) return;
    const fill = meter.querySelector(".strength-fill");
    const label = meter.querySelector(".strength-label");
    if (!password) {
        fill.style.width = "0";
        fill.style.background = "";
        label.textContent = "強度: 未入力";
        return;
    }
    // Inline strength (same call will go to server for consistency)
    callApi("passwordStrength", { password }).then(data => {
        const pct = data.score || 0;
        fill.style.width = `${pct}%`;
        fill.style.background = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";
        label.textContent = `強度: ${data.label || "不明"} (${pct})`;
    }).catch(() => { });
}

// ===== Views Management =====
const views = {
    items: "#view-items",
    detail: "#view-detail",
    add: "#view-add",
    generator: "#view-generator",
    security: "#view-security",
    settings: "#view-settings"
};

let currentView = "items";

function switchView(name) {
    Object.entries(views).forEach(([key, sel]) => {
        const el = $(sel);
        if (key === name) show(el); else hide(el);
    });
    currentView = name;
    // Show/hide search bar for items view only
    const searchBar = $("#search-bar");
    if (name === "items") show(searchBar); else hide(searchBar);
}

function switchTab(name) {
    switchView(name);
    $$(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === name);
    });

    if (name === "items") loadItems();
    if (name === "security") loadReport();
    if (name === "settings") loadSettings();
    if (name === "add" && !$("#f-id").value) clearForm();
    if (name === "generator") generatePassword();
}

// ===== Type fields visibility =====
function updateTypeFields() {
    const type = $("#f-type").value;
    $$(".type-fields").forEach(el => {
        const types = el.dataset.for.split(",");
        el.classList.toggle("visible", types.includes(type));
    });
}

// ===== INIT =====
async function init() {
    try {
        const state = await callApi("getState");
        if (!state.initialized) {
            showScreen("setup");
        } else if (!state.unlocked) {
            showScreen("unlock");
        } else {
            showScreen("main");
        }
    } catch (err) {
        showScreen("setup");
    }
}

function showScreen(name) {
    hide($("#setup-screen"));
    hide($("#unlock-screen"));
    hide($("#main-screen"));
    $(`#${name}-screen`).classList.remove("hidden");
    if (name === "main") {
        switchTab("items");
    }
}

// ===== SETUP =====
$("#setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#setup-pw").value;
    const confirm = $("#setup-confirm").value;
    if (pw !== confirm) { toast("パスワードが一致しません。", true); return; }
    try {
        await callApi("setupVault", { masterPassword: pw });
        toast("Vaultを作成しました！");
        showScreen("main");
    } catch (err) {
        toast(err.message, true);
    }
});

$("#setup-pw").addEventListener("input", (e) => updateStrength("#setup-strength", e.target.value));

// ===== UNLOCK =====
$("#unlock-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await callApi("unlockVault", { masterPassword: $("#unlock-pw").value });
        $("#unlock-pw").value = "";
        showScreen("main");
    } catch (err) {
        toast(err.message, true);
    }
});

// ===== LOCK =====
$("#lock-btn").addEventListener("click", async () => {
    await callApi("lockVault");
    showScreen("unlock");
    toast("Vaultをロックしました。");
});

// ===== ITEMS LIST =====
async function loadItems() {
    try {
        const type = $("#filter-type").value;
        const search = $("#search-input").value;
        const onlyFavorites = $("#filter-fav").checked;
        const data = await callApi("listItems", { filters: { type, search, onlyFavorites } });
        renderItems(data.items || []);
    } catch (err) {
        toast(err.message, true);
    }
}

const TYPE_ICONS = { login: "🔑", card: "💳", identity: "👤", note: "📝" };

function renderItems(items) {
    const list = $("#item-list");
    const empty = $("#empty-state");
    if (!items.length) {
        list.innerHTML = "";
        show(empty);
        return;
    }
    hide(empty);
    list.innerHTML = items.map(item => `
    <li class="item-row" data-id="${item.id}">
      <div class="item-icon ${item.type}">${TYPE_ICONS[item.type] || "🔑"}</div>
      <div class="item-info">
        <div class="item-title">${esc(item.title)}</div>
        <div class="item-sub">${esc(item.username || item.url || item.notes?.slice(0, 40) || "")}</div>
      </div>
      ${item.favorite ? '<span class="item-fav">★</span>' : ""}
      <span class="item-arrow">›</span>
    </li>
  `).join("");
}

function esc(str) {
    const d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
}

// Click on item
$("#item-list").addEventListener("click", (e) => {
    const row = e.target.closest(".item-row");
    if (!row) return;
    showItemDetail(row.dataset.id);
});

// Search
let searchDebounce = null;
$("#search-input").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadItems, 300);
});
$("#filter-type").addEventListener("change", loadItems);
$("#filter-fav").addEventListener("change", loadItems);

// ===== ITEM DETAIL =====
let currentItem = null;
let totpInterval = null;

async function showItemDetail(id) {
    try {
        const data = await callApi("getItem", { id });
        currentItem = data.item;
        renderDetail(currentItem);
        switchView("detail");
    } catch (err) {
        toast(err.message, true);
    }
}

function renderDetail(item) {
    clearInterval(totpInterval);
    const content = $("#detail-content");
    const iconClass = item.type;

    let fields = "";

    if (item.type === "login" || item.type === "note" || item.type === "identity") {
        if (item.username) fields += detailField("ユーザー名", item.username, true);
    }
    if (item.type === "login") {
        fields += detailField("パスワード", "••••••••", true, "password");
        if (item.url) fields += detailField("URL", item.url, true, "url");
        if (item.otpSecret) fields += `<div class="detail-field" id="totp-field"><div class="detail-field-label">TOTP</div><div class="totp-display"><span class="totp-code" id="totp-code">------</span><span class="totp-timer" id="totp-timer"></span></div></div>`;
    }
    if (item.type === "identity") {
        if (item.fullName) fields += detailField("氏名", item.fullName, true);
        if (item.email) fields += detailField("メール", item.email, true);
        if (item.phone) fields += detailField("電話", item.phone, true);
        if (item.address) fields += detailField("住所", item.address, false);
    }
    if (item.type === "card") {
        if (item.cardHolder) fields += detailField("名義人", item.cardHolder, true);
        if (item.cardNumber) fields += detailField("カード番号", maskCard(item.cardNumber), true, "cardnumber");
        if (item.cardExpiry) fields += detailField("有効期限", item.cardExpiry, true);
        if (item.cardCvc) fields += detailField("CVC", "•••", true, "cvc");
    }
    if (item.notes) fields += detailField("メモ", item.notes, false);

    let tags = "";
    if (item.tags?.length) {
        tags = `<div class="detail-field"><div class="detail-field-label">タグ</div><div class="detail-tags">${item.tags.map(t => `<span class="tag-badge">${esc(t)}</span>`).join("")}</div></div>`;
    }

    content.innerHTML = `
    <div class="detail-header">
      <div class="detail-icon item-icon ${iconClass}">${TYPE_ICONS[item.type]}</div>
      <div class="detail-header-info">
        <h2>${esc(item.title)} ${item.favorite ? "★" : ""}</h2>
        <span>${item.type} · 更新 ${formatDate(item.updatedAt)}</span>
      </div>
    </div>
    ${fields}${tags}
    <div class="detail-actions">
      <button class="btn-ghost" onclick="editCurrentItem()">編集</button>
      <button class="btn-danger" onclick="deleteCurrentItem()">削除</button>
    </div>
  `;

    // Load TOTP if needed
    if (item.otpSecret) refreshTotp(item.otpSecret);

    // Set up real password copy
    content.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const field = btn.dataset.field;
            let value = "";
            if (field === "password") value = item.password;
            else if (field === "cardnumber") value = item.cardNumber;
            else if (field === "cvc") value = item.cardCvc;
            else value = btn.closest(".detail-field-row")?.querySelector(".detail-field-value")?.textContent || "";
            navigator.clipboard.writeText(value).then(() => toast("コピーしました")).catch(() => toast("コピーに失敗しました", true));
        });
    });
}

function detailField(label, value, copyable, fieldKey = "") {
    return `<div class="detail-field"><div class="detail-field-label">${esc(label)}</div><div class="detail-field-row"><span class="detail-field-value">${esc(value)}</span>${copyable ? `<button class="copy-btn" data-field="${fieldKey || ""}" type="button">コピー</button>` : ""}</div></div>`;
}

function maskCard(num) {
    return num.length > 4 ? "•".repeat(num.length - 4) + num.slice(-4) : num;
}

function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

async function refreshTotp(secret) {
    clearInterval(totpInterval);
    const update = async () => {
        try {
            const data = await callApi("generateTotp", { secret });
            const code = $("#totp-code");
            const timer = $("#totp-timer");
            if (code) code.textContent = data.code;
            if (timer) timer.textContent = `${data.expiresIn}s`;
        } catch { }
    };
    await update();
    totpInterval = setInterval(update, 1000);
}

// ===== BACK BUTTON =====
$("#detail-back").addEventListener("click", () => {
    clearInterval(totpInterval);
    switchTab("items");
});

// ===== EDIT ITEM =====
window.editCurrentItem = function () {
    if (!currentItem) return;
    fillForm(currentItem);
    switchView("add");
    $("#form-title").textContent = "編集";
};

window.deleteCurrentItem = async function () {
    if (!currentItem) return;
    if (!confirm(`「${currentItem.title}」を削除しますか？`)) return;
    try {
        await callApi("deleteItem", { id: currentItem.id });
        toast("削除しました。");
        switchTab("items");
    } catch (err) {
        toast(err.message, true);
    }
};

// ===== ADD/EDIT FORM =====
function clearForm() {
    $("#f-id").value = "";
    $("#f-type").value = "login";
    $("#f-title").value = "";
    $("#f-username").value = "";
    $("#f-password").value = "";
    $("#f-url").value = "";
    $("#f-otp").value = "";
    $("#f-fullname").value = "";
    $("#f-email").value = "";
    $("#f-phone").value = "";
    $("#f-address").value = "";
    $("#f-cardholder").value = "";
    $("#f-cardnumber").value = "";
    $("#f-cardexpiry").value = "";
    $("#f-cardcvc").value = "";
    $("#f-tags").value = "";
    $("#f-notes").value = "";
    $("#f-favorite").checked = false;
    $("#form-title").textContent = "新規作成";
    updateTypeFields();
    updateStrength("#f-pw-strength", "");
}

function fillForm(item) {
    $("#f-id").value = item.id || "";
    $("#f-type").value = item.type || "login";
    $("#f-title").value = item.title || "";
    $("#f-username").value = item.username || "";
    $("#f-password").value = item.password || "";
    $("#f-url").value = item.url || "";
    $("#f-otp").value = item.otpSecret || "";
    $("#f-fullname").value = item.fullName || "";
    $("#f-email").value = item.email || "";
    $("#f-phone").value = item.phone || "";
    $("#f-address").value = item.address || "";
    $("#f-cardholder").value = item.cardHolder || "";
    $("#f-cardnumber").value = item.cardNumber || "";
    $("#f-cardexpiry").value = item.cardExpiry || "";
    $("#f-cardcvc").value = item.cardCvc || "";
    $("#f-tags").value = (item.tags || []).join(", ");
    $("#f-notes").value = item.notes || "";
    $("#f-favorite").checked = Boolean(item.favorite);
    updateTypeFields();
    updateStrength("#f-pw-strength", item.password);
}

$("#f-type").addEventListener("change", updateTypeFields);
$("#f-password").addEventListener("input", (e) => updateStrength("#f-pw-strength", e.target.value));

$("#item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = {
        id: $("#f-id").value || undefined,
        type: $("#f-type").value,
        title: $("#f-title").value,
        username: $("#f-username").value,
        password: $("#f-password").value,
        url: $("#f-url").value,
        otpSecret: $("#f-otp").value,
        fullName: $("#f-fullname").value,
        email: $("#f-email").value,
        phone: $("#f-phone").value,
        address: $("#f-address").value,
        cardHolder: $("#f-cardholder").value,
        cardNumber: $("#f-cardnumber").value,
        cardExpiry: $("#f-cardexpiry").value,
        cardCvc: $("#f-cardcvc").value,
        tags: $("#f-tags").value,
        notes: $("#f-notes").value,
        favorite: $("#f-favorite").checked
    };
    try {
        await callApi("saveItem", { item });
        toast("保存しました！");
        clearForm();
        switchTab("items");
    } catch (err) {
        toast(err.message, true);
    }
});

$("#cancel-edit").addEventListener("click", () => {
    clearForm();
    switchTab("items");
});

// Generate password button in form
$("#gen-pw-btn").addEventListener("click", async () => {
    try {
        const data = await callApi("generatePassword");
        $("#f-password").value = data.password;
        $("#f-password").type = "text";
        updateStrength("#f-pw-strength", data.password);
        toast("パスワードを生成しました");
    } catch (err) {
        toast(err.message, true);
    }
});

// ===== PASSWORD GENERATOR =====
async function generatePassword() {
    const opts = {
        length: Number($("#g-length").value),
        uppercase: $("#g-upper").checked,
        lowercase: $("#g-lower").checked,
        numbers: $("#g-numbers").checked,
        symbols: $("#g-symbols").checked
    };
    try {
        const data = await callApi("generatePassword", { options: opts });
        $("#generated-pw").textContent = data.password;
    } catch (err) {
        toast(err.message, true);
    }
}

$("#gen-generate").addEventListener("click", generatePassword);
$("#gen-copy").addEventListener("click", () => {
    const pw = $("#generated-pw").textContent;
    navigator.clipboard.writeText(pw).then(() => toast("コピーしました")).catch(() => toast("コピーに失敗", true));
});
$("#g-length").addEventListener("input", (e) => {
    $("#g-length-val").textContent = e.target.value;
});

// ===== SECURITY REPORT =====
async function loadReport() {
    const content = $("#report-content");
    content.innerHTML = "<p style='color:var(--text-dim);padding:16px'>読み込み中...</p>";
    try {
        const data = await callApi("getSecurityReport");
        renderReport(data.report);
    } catch (err) {
        content.innerHTML = `<p style="color:var(--danger);padding:16px">${esc(err.message)}</p>`;
    }
}

function renderReport(report) {
    const scoreClass = report.score >= 80 ? "good" : report.score >= 50 ? "fair" : "bad";
    const t = report.totals;

    let coach = "";
    if (report.coach?.length) {
        coach = report.coach.map(c => `
      <div class="coach-item">
        <div class="coach-priority">${c.priorityLabel} · ${c.affectedCount}件</div>
        <div class="coach-title">${esc(c.title)}</div>
        <div class="coach-desc">${esc(c.description)}</div>
      </div>
    `).join("");
    }

    $("#report-content").innerHTML = `
    <div class="report-score">
      <div class="report-score-value ${scoreClass}">${report.score}</div>
      <div class="report-score-label">セキュリティスコア / 100</div>
    </div>
    <div class="report-stats">
      <div class="report-stat"><div class="report-stat-value">${t.allLogins}</div><div class="report-stat-label">ログイン</div></div>
      <div class="report-stat"><div class="report-stat-value" style="color:${t.weak ? 'var(--danger)' : 'var(--success)'}">${t.weak}</div><div class="report-stat-label">弱いPW</div></div>
      <div class="report-stat"><div class="report-stat-value" style="color:${t.reusedGroups ? 'var(--danger)' : 'var(--success)'}">${t.reusedGroups}</div><div class="report-stat-label">使い回し</div></div>
      <div class="report-stat"><div class="report-stat-value">${t.twoFactorCoverage}%</div><div class="report-stat-label">2FA率</div></div>
    </div>
    ${coach}
  `;
}

$("#refresh-report").addEventListener("click", loadReport);

// ===== SETTINGS =====
async function loadSettings() {
    try {
        const data = await callApi("getSettings");
        const s = data.settings;
        $("#s-autolock").value = s.autoLockMinutes || 10;
        $("#s-clipboard").value = s.clipboardClearSeconds || 20;
    } catch (err) {
        toast(err.message, true);
    }
}

$("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await callApi("saveSettings", {
            settings: {
                autoLockMinutes: Number($("#s-autolock").value),
                clipboardClearSeconds: Number($("#s-clipboard").value)
            }
        });
        toast("設定を保存しました！");
    } catch (err) {
        toast(err.message, true);
    }
});

// ===== MASTER PASSWORD CHANGE =====
$("#m-new").addEventListener("input", (e) => updateStrength("#m-strength", e.target.value));

$("#master-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await callApi("changeMasterPassword", {
            oldPassword: $("#m-old").value,
            newPassword: $("#m-new").value
        });
        $("#m-old").value = "";
        $("#m-new").value = "";
        updateStrength("#m-strength", "");
        toast("マスターパスワードを変更しました！");
    } catch (err) {
        toast(err.message, true);
    }
});

// ===== TAB BAR =====
$$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ===== BOOT =====
init();
