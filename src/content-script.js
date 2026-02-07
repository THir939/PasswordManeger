function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
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

function describeField(field) {
  return {
    tag: field.tagName.toLowerCase(),
    type: String(field.type || "").toLowerCase(),
    name: String(field.name || ""),
    id: String(field.id || ""),
    autocomplete: String(field.getAttribute("autocomplete") || "").toLowerCase(),
    placeholder: String(field.placeholder || "").toLowerCase(),
    ariaLabel: String(field.getAttribute("aria-label") || "").toLowerCase()
  };
}

function setNativeValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setFieldValue(field, value) {
  if (!field) {
    return;
  }

  if (field instanceof HTMLTextAreaElement) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  setNativeValue(field, value);
}

function scoreDescriptorMatch(field, descriptor) {
  if (!descriptor || typeof descriptor !== "object") {
    return 0;
  }

  let score = 0;
  const signature = getFieldSignature(field);

  if (descriptor.id && field.id && descriptor.id === field.id) {
    score += 10;
  }
  if (descriptor.name && field.name && descriptor.name === field.name) {
    score += 7;
  }
  if (descriptor.type && field.type && descriptor.type === String(field.type).toLowerCase()) {
    score += 4;
  }
  if (descriptor.autocomplete && signature.includes(descriptor.autocomplete)) {
    score += 4;
  }
  if (descriptor.placeholder && signature.includes(descriptor.placeholder)) {
    score += 2;
  }
  if (descriptor.ariaLabel && signature.includes(descriptor.ariaLabel)) {
    score += 2;
  }

  return score;
}

function findFieldByDescriptor(candidates, descriptor, usedSet = new Set()) {
  let best = null;
  let bestScore = 0;

  for (const field of candidates) {
    if (usedSet.has(field)) {
      continue;
    }

    const score = scoreDescriptorMatch(field, descriptor);
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }

  return bestScore >= 8 ? best : null;
}

function fillLogin(fields, profileMapping = {}) {
  const inputs = [...document.querySelectorAll("input")].filter(isVisible);
  const used = new Set();
  const learned = {};

  let usernameTarget = findFieldByDescriptor(inputs, profileMapping.username, used);
  if (!usernameTarget) {
    usernameTarget = inputs.find((field) => {
      const signature = getFieldSignature(field);
      return field.type !== "password" && /(user|email|login|account|id)/i.test(signature);
    });
  }
  if (!usernameTarget) {
    usernameTarget = inputs.find((field) => field.type === "text" || field.type === "email");
  }

  let passwordTarget = findFieldByDescriptor(inputs, profileMapping.password, used);
  if (!passwordTarget) {
    passwordTarget = inputs.find((field) => field.type === "password");
  }

  if (usernameTarget && fields.username) {
    setFieldValue(usernameTarget, fields.username);
    learned.username = describeField(usernameTarget);
    used.add(usernameTarget);
  }

  if (passwordTarget && fields.password) {
    setFieldValue(passwordTarget, fields.password);
    learned.password = describeField(passwordTarget);
    used.add(passwordTarget);
  }

  return {
    filled: Boolean((usernameTarget && fields.username) || (passwordTarget && fields.password)),
    learnedProfile: {
      mode: "login",
      mapping: learned
    }
  };
}

function fillByRules(inputs, fields, rules, profileMapping = {}) {
  const used = new Set();
  const learned = {};
  let filled = false;

  for (const rule of rules) {
    const value = fields[rule.key];
    if (!value) {
      continue;
    }

    let target = findFieldByDescriptor(inputs, profileMapping[rule.key], used);

    if (!target) {
      target = inputs.find((input) => {
        if (used.has(input)) {
          return false;
        }
        const signature = getFieldSignature(input);
        return rule.regex.test(signature);
      });
    }

    if (!target) {
      continue;
    }

    setFieldValue(target, value);
    learned[rule.key] = describeField(target);
    used.add(target);
    filled = true;
  }

  return {
    filled,
    learnedProfile: {
      mapping: learned
    }
  };
}

function fillCard(fields, profileMapping = {}) {
  const inputs = [...document.querySelectorAll("input")].filter(isVisible);
  const rules = [
    { key: "cardNumber", regex: /(card.?number|cc-number|番号|カード)/i },
    { key: "cardHolder", regex: /(name.*card|cardholder|holder|名義)/i },
    { key: "cardExpiry", regex: /(exp|expiry|expiration|有効期限)/i },
    { key: "cardCvc", regex: /(cvc|cvv|security.?code|セキュリティ)/i }
  ];

  const result = fillByRules(inputs, fields, rules, profileMapping);
  result.learnedProfile.mode = "card";
  return result;
}

function fillIdentity(fields, profileMapping = {}) {
  const inputs = [...document.querySelectorAll("input, textarea")].filter(isVisible);
  const rules = [
    { key: "fullName", regex: /(name|fullname|氏名|名前)/i },
    { key: "email", regex: /(email|mail)/i },
    { key: "phone", regex: /(phone|tel|mobile|電話)/i },
    { key: "address", regex: /(address|住所|street)/i }
  ];

  const result = fillByRules(inputs, fields, rules, profileMapping);
  result.learnedProfile.mode = "identity";
  return result;
}

function rememberLastFill(mode) {
  window.__PM_LAST_FILL_CONTEXT__ = {
    mode: String(mode || ""),
    origin: location.origin,
    filledAt: Date.now()
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PM_FILL") {
    return;
  }

  const profileMapping = message.payload?.profile?.mapping || {};
  let result = {
    filled: false,
    learnedProfile: null
  };

  if (message.payload?.mode === "login") {
    result = fillLogin(message.payload.fields || {}, profileMapping);
  } else if (message.payload?.mode === "card") {
    result = fillCard(message.payload.fields || {}, profileMapping);
  } else if (message.payload?.mode === "identity") {
    result = fillIdentity(message.payload.fields || {}, profileMapping);
  }

  if (result?.filled && result?.learnedProfile?.mode) {
    rememberLastFill(result.learnedProfile.mode);
  }

  sendResponse({ ok: true, ...result });
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
    title: document.title || extractHostname(location.href),
    usernameField: userInput || null,
    passwordField: passwordInput
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
        payload: {
          username: payload.username,
          password: payload.password,
          url: payload.url,
          title: payload.title
        }
      });

      const lastFill = window.__PM_LAST_FILL_CONTEXT__;
      if (
        lastFill &&
        lastFill.mode === "login" &&
        lastFill.origin === location.origin &&
        Date.now() - Number(lastFill.filledAt || 0) < 2 * 60 * 1000 &&
        payload.passwordField &&
        payload.usernameField
      ) {
        chrome.runtime.sendMessage({
          type: "PM_LEARN_PROFILE",
          payload: {
            learnedProfile: {
              mode: "login",
              mapping: {
                username: describeField(payload.usernameField),
                password: describeField(payload.passwordField)
              }
            }
          }
        });

        window.__PM_LAST_FILL_CONTEXT__ = null;
      }
    },
    true
  );
}
