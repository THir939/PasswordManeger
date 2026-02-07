function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getFieldSignature(field) {
  const attributes = [
    field.name,
    field.id,
    field.placeholder,
    field.getAttribute("autocomplete"),
    field.getAttribute("aria-label")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return attributes;
}

function setNativeValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillLogin(fields) {
  const inputs = [...document.querySelectorAll("input")].filter(isVisible);
  const passwordFields = inputs.filter((field) => field.type === "password");

  let usernameTarget = inputs.find((field) => {
    const signature = getFieldSignature(field);
    return field.type !== "password" && /(user|email|login|account|id)/i.test(signature);
  });

  if (!usernameTarget) {
    usernameTarget = inputs.find((field) => field.type === "text" || field.type === "email");
  }

  if (usernameTarget && fields.username) {
    setNativeValue(usernameTarget, fields.username);
  }

  if (passwordFields[0] && fields.password) {
    setNativeValue(passwordFields[0], fields.password);
  }

  return Boolean(usernameTarget || passwordFields[0]);
}

function fillCard(fields) {
  const inputs = [...document.querySelectorAll("input")].filter(isVisible);
  const rules = [
    { key: "cardNumber", regex: /(card.?number|cc-number|番号|カード)/i },
    { key: "cardHolder", regex: /(name.*card|cardholder|holder|名義)/i },
    { key: "cardExpiry", regex: /(exp|expiry|expiration|有効期限)/i },
    { key: "cardCvc", regex: /(cvc|cvv|security.?code|セキュリティ)/i }
  ];

  let filled = false;
  for (const input of inputs) {
    const signature = getFieldSignature(input);
    for (const rule of rules) {
      if (fields[rule.key] && rule.regex.test(signature)) {
        setNativeValue(input, fields[rule.key]);
        filled = true;
        break;
      }
    }
  }

  return filled;
}

function fillIdentity(fields) {
  const textInputs = [...document.querySelectorAll("input, textarea")].filter(isVisible);
  const rules = [
    { key: "fullName", regex: /(name|fullname|氏名|名前)/i },
    { key: "email", regex: /(email|mail)/i },
    { key: "phone", regex: /(phone|tel|mobile|電話)/i },
    { key: "address", regex: /(address|住所|street)/i }
  ];

  let filled = false;
  for (const input of textInputs) {
    const signature = getFieldSignature(input);
    for (const rule of rules) {
      if (fields[rule.key] && rule.regex.test(signature)) {
        if (input.tagName === "TEXTAREA") {
          input.value = fields[rule.key];
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          setNativeValue(input, fields[rule.key]);
        }
        filled = true;
        break;
      }
    }
  }

  return filled;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PM_FILL") {
    return;
  }

  let filled = false;

  if (message.payload?.mode === "login") {
    filled = fillLogin(message.payload.fields || {});
  } else if (message.payload?.mode === "card") {
    filled = fillCard(message.payload.fields || {});
  } else if (message.payload?.mode === "identity") {
    filled = fillIdentity(message.payload.fields || {});
  }

  sendResponse({ ok: true, filled });
  return true;
});

function detectCredentialsFromForm(form) {
  const inputs = [...form.querySelectorAll("input")].filter((input) => !input.disabled);
  const passwordInput = inputs.find((input) => input.type === "password" && input.value.length > 0);
  if (!passwordInput) {
    return null;
  }

  const userInput =
    inputs.find((input) => /email/i.test(input.type) && input.value) ||
    inputs.find((input) => /(user|email|login|account|id)/i.test(getFieldSignature(input)) && input.value) ||
    inputs.find((input) => input.type !== "password" && input.value);

  return {
    username: userInput?.value || "",
    password: passwordInput.value,
    url: location.href,
    title: document.title || extractHostname(location.href)
  };
}

function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "New Login";
  }
}

if (!window.__PM_FORM_CAPTURE_ATTACHED__) {
  window.__PM_FORM_CAPTURE_ATTACHED__ = true;
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const payload = detectCredentialsFromForm(form);
      if (!payload) {
        return;
      }

      chrome.runtime.sendMessage({
        type: "PM_CAPTURE_LOGIN",
        payload
      });
    },
    true
  );
}
