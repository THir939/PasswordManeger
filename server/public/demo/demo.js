function setStatus(message, kind = "") {
  const el = document.querySelector("#demo-status");
  if (!el) {
    return;
  }

  el.textContent = message || "";
  el.classList.toggle("ok", kind === "ok");
  el.classList.toggle("error", kind === "error");
}

function toggleVisible(showId, hideIds = []) {
  const show = document.querySelector(`#${showId}`);
  if (show) {
    show.classList.remove("hidden");
  }

  hideIds.forEach((id) => {
    const el = document.querySelector(`#${id}`);
    if (el) {
      el.classList.add("hidden");
    }
  });
}

function randomToken(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function setupLoginPage() {
  const showStandard = document.querySelector("#show-standard");
  const showTricky = document.querySelector("#show-tricky");
  const shuffle = document.querySelector("#shuffle-tricky");

  if (showStandard) {
    showStandard.addEventListener("click", () => {
      toggleVisible("standard-box", ["tricky-box"]);
      setStatus("表示: Standard login form", "ok");
    });
  }

  if (showTricky) {
    showTricky.addEventListener("click", () => {
      toggleVisible("tricky-box", ["standard-box"]);
      setStatus("表示: Tricky login form", "ok");
    });
  }

  if (shuffle) {
    shuffle.addEventListener("click", () => {
      const user = document.querySelector("#tricky-user");
      const pass = document.querySelector("#tricky-pass");
      if (!user || !pass) {
        setStatus("フィールドが見つかりません。", "error");
        return;
      }

      // Change id/name only. Keep aria-label so "学習プロファイル" が当たりやすいようにする。
      user.id = randomToken("user");
      user.name = randomToken("user_name");
      pass.id = randomToken("pass");
      pass.name = randomToken("pass_name");

      setStatus("Trickyフォームの id / name を変更しました（学習が効くか試せます）。", "ok");
    });
  }
}

function setupDemoForms() {
  const forms = document.querySelectorAll("form[data-demo-form]");
  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setStatus("送信しました（デモなので通信はしません）。拡張機能の「保存候補」に出るか確認できます。", "ok");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupDemoForms();
  setupLoginPage();
});

