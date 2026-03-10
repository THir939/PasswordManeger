function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function isLikelyJson(rawText, filename) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".json")) {
    return true;
  }

  const first = String(rawText || "").trimStart()[0];
  return first === "{" || first === "[";
}

function splitTags(input) {
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }

  return String(input || "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBoolean(input) {
  const value = String(input || "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on", "fav", "favorite"].includes(value);
}

function parseCsvRows(rawText) {
  const text = String(rawText || "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    const hasValues = row.some((value) => String(value).trim() !== "");
    if (hasValues) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      pushField();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      pushField();
      pushRow();
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  pushField();
  pushRow();

  return rows;
}

function csvToObjects(rawText) {
  const rows = parseCsvRows(rawText);
  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((value) => normalizeHeader(value));
  const records = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] || "").trim();
    });
    return record;
  });

  return { headers, rows: records };
}

function pick(row, aliases = []) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const value = row[key];
    if (value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function detectProviderFromHeaders(headers) {
  const set = new Set(headers.map((header) => normalizeHeader(header)));

  if (set.has("login_uri") && set.has("login_username") && set.has("login_password")) {
    return "bitwarden";
  }

  if (set.has("url") && set.has("username") && set.has("password") && set.has("extra")) {
    return "lastpass";
  }

  if ((set.has("title") || set.has("name")) && (set.has("website") || set.has("url") || set.has("urls"))) {
    return "1password";
  }

  return "generic";
}

function noteFromLoginFallback(item) {
  if (item.type !== "login" || item.password) {
    return item;
  }

  const fragments = [item.notes];
  if (item.username) fragments.push(`username: ${item.username}`);
  if (item.url) fragments.push(`url: ${item.url}`);

  return {
    ...item,
    type: "note",
    notes: fragments.filter(Boolean).join("\n") || "Imported item without password",
    username: "",
    url: ""
  };
}

function normalizeOutputItem(raw) {
  const base = {
    type: ["login", "card", "identity", "note"].includes(raw.type) ? raw.type : "login",
    title: String(raw.title || "").trim(),
    username: String(raw.username || "").trim(),
    password: String(raw.password || ""),
    url: String(raw.url || "").trim(),
    notes: String(raw.notes || "").trim(),
    otpSecret: String(raw.otpSecret || "").trim(),
    fullName: String(raw.fullName || "").trim(),
    email: String(raw.email || "").trim(),
    phone: String(raw.phone || "").trim(),
    address: String(raw.address || "").trim(),
    cardHolder: String(raw.cardHolder || "").trim(),
    cardNumber: String(raw.cardNumber || "").replace(/\s+/g, ""),
    cardExpiry: String(raw.cardExpiry || "").trim(),
    cardCvc: String(raw.cardCvc || "").trim(),
    tags: splitTags(raw.tags),
    favorite: Boolean(raw.favorite)
  };

  if (!base.title) {
    if (base.type === "login") {
      base.title = base.url || base.username || "Imported Login";
    } else {
      base.title = "Imported Item";
    }
  }

  return noteFromLoginFallback(base);
}

function parseBitwardenCsvRow(row) {
  const type = String(pick(row, ["type"]) || "login").toLowerCase();

  if (type === "note") {
    return normalizeOutputItem({
      type: "note",
      title: pick(row, ["name", "title"]),
      notes: pick(row, ["notes", "extra"]),
      tags: pick(row, ["folder", "collection"]),
      favorite: parseBoolean(pick(row, ["favorite"]))
    });
  }

  return normalizeOutputItem({
    type: "login",
    title: pick(row, ["name", "title"]),
    username: pick(row, ["login_username", "username"]),
    password: pick(row, ["login_password", "password"]),
    url: pick(row, ["login_uri", "url", "website"]),
    otpSecret: pick(row, ["login_totp", "totp", "otpauth"]),
    notes: pick(row, ["notes", "extra"]),
    tags: pick(row, ["folder", "collection"]),
    favorite: parseBoolean(pick(row, ["favorite"]))
  });
}

function parseLastpassCsvRow(row) {
  return normalizeOutputItem({
    type: "login",
    title: pick(row, ["name", "title"]),
    username: pick(row, ["username", "login"]),
    password: pick(row, ["password"]),
    url: pick(row, ["url", "website"]),
    otpSecret: pick(row, ["totp", "otp"]),
    notes: pick(row, ["extra", "notes"]),
    tags: pick(row, ["grouping", "group", "folder"]),
    favorite: parseBoolean(pick(row, ["fav", "favorite"]))
  });
}

function parseOnePasswordCsvRow(row) {
  const category = pick(row, ["category", "type"]).toLowerCase();
  const mappedType = category.includes("note") ? "note" : "login";

  return normalizeOutputItem({
    type: mappedType,
    title: pick(row, ["title", "name"]),
    username: pick(row, ["username", "email", "login"]),
    password: pick(row, ["password"]),
    url: pick(row, ["website", "url", "urls"]),
    otpSecret: pick(row, ["otpauth", "one-time password", "totp"]),
    notes: pick(row, ["notes"]),
    tags: pick(row, ["tags", "vault"]),
    favorite: parseBoolean(pick(row, ["favorite", "fav"]))
  });
}

function parseGenericCsvRow(row) {
  return normalizeOutputItem({
    type: "login",
    title: pick(row, ["title", "name", "site", "service"]),
    username: pick(row, ["username", "login", "email", "user"]),
    password: pick(row, ["password", "pass"]),
    url: pick(row, ["url", "website", "login_uri", "site_url"]),
    otpSecret: pick(row, ["totp", "otp", "otpauth"]),
    notes: pick(row, ["notes", "memo", "extra"]),
    tags: pick(row, ["tags", "folder", "group", "grouping"]),
    favorite: parseBoolean(pick(row, ["favorite", "fav", "starred"]))
  });
}

function parseBitwardenJsonItem(item) {
  const numericType = Number(item?.type);

  if (numericType === 2 || item?.secureNote) {
    return normalizeOutputItem({
      type: "note",
      title: item?.name,
      notes: item?.notes,
      favorite: Boolean(item?.favorite),
      tags: []
    });
  }

  if (numericType === 3 && item?.card) {
    return normalizeOutputItem({
      type: "card",
      title: item?.name,
      cardHolder: item.card.cardholderName,
      cardNumber: item.card.number,
      cardExpiry: [item.card.expMonth, item.card.expYear].filter(Boolean).join("/"),
      cardCvc: item.card.code,
      notes: item?.notes,
      favorite: Boolean(item?.favorite)
    });
  }

  if (numericType === 4 && item?.identity) {
    const identity = item.identity;
    return normalizeOutputItem({
      type: "identity",
      title: item?.name,
      fullName: [identity.firstName, identity.middleName, identity.lastName].filter(Boolean).join(" "),
      email: identity.email,
      phone: identity.phone,
      address: [identity.address1, identity.address2, identity.city, identity.state, identity.postalCode, identity.country]
        .filter(Boolean)
        .join(", "),
      notes: item?.notes,
      favorite: Boolean(item?.favorite)
    });
  }

  const login = item?.login || {};
  const loginUri = Array.isArray(login.uris) ? login.uris[0]?.uri : "";

  return normalizeOutputItem({
    type: "login",
    title: item?.name,
    username: login.username,
    password: login.password,
    url: loginUri,
    otpSecret: login.totp,
    notes: item?.notes,
    favorite: Boolean(item?.favorite)
  });
}

function parseGenericJsonItem(item) {
  return normalizeOutputItem({
    type: item?.type || "login",
    title: item?.title || item?.name,
    username: item?.username || item?.login,
    password: item?.password,
    url: item?.url || item?.website,
    otpSecret: item?.otpSecret || item?.totp,
    notes: item?.notes || item?.memo,
    tags: item?.tags,
    favorite: item?.favorite,
    fullName: item?.fullName,
    email: item?.email,
    phone: item?.phone,
    address: item?.address,
    cardHolder: item?.cardHolder,
    cardNumber: item?.cardNumber,
    cardExpiry: item?.cardExpiry,
    cardCvc: item?.cardCvc
  });
}

function parseJsonRecords(rawText) {
  const parsed = JSON.parse(rawText);

  if (Array.isArray(parsed)) {
    return { provider: "generic", records: parsed };
  }

  if (Array.isArray(parsed?.items)) {
    const provider = parsed.encrypted === false && parsed.items.some((item) => item?.login || item?.secureNote)
      ? "bitwarden"
      : "generic";
    return { provider, records: parsed.items };
  }

  if (Array.isArray(parsed?.records)) {
    return { provider: "generic", records: parsed.records };
  }

  throw new Error("JSON形式を解釈できませんでした。items配列または配列形式が必要です。");
}

export function parseExternalItems({ provider = "auto", rawText = "", filename = "" }) {
  const text = String(rawText || "");
  if (!text.trim()) {
    throw new Error("移行ファイルが空です。");
  }

  const warnings = [];
  const requestedProvider = String(provider || "auto").toLowerCase();

  if (isLikelyJson(text, filename)) {
    const jsonData = parseJsonRecords(text);
    const finalProvider = requestedProvider === "auto" ? jsonData.provider : requestedProvider;

    const mapped = jsonData.records.map((record) => {
      if (finalProvider === "bitwarden") {
        return parseBitwardenJsonItem(record);
      }
      return parseGenericJsonItem(record);
    });

    const items = mapped.filter((item) => item && item.title);

    if (!items.length) {
      throw new Error("JSON移行で有効な項目を作成できませんでした。");
    }

    return {
      sourceProvider: finalProvider,
      format: "json",
      totalParsed: items.length,
      warnings,
      items
    };
  }

  const csv = csvToObjects(text);
  if (!csv.rows.length) {
    throw new Error("CSVにデータ行がありません。");
  }

  const detected = detectProviderFromHeaders(csv.headers);
  const finalProvider = requestedProvider === "auto" ? detected : requestedProvider;

  const mapped = csv.rows.map((row) => {
    if (finalProvider === "bitwarden") {
      return parseBitwardenCsvRow(row);
    }
    if (finalProvider === "lastpass") {
      return parseLastpassCsvRow(row);
    }
    if (finalProvider === "1password") {
      return parseOnePasswordCsvRow(row);
    }
    return parseGenericCsvRow(row);
  });

  const items = mapped.filter((item) => item && item.title);

  if (!items.length) {
    throw new Error("CSV移行で有効な項目を作成できませんでした。移行元の形式を確認してください。");
  }

  if (requestedProvider !== "auto" && requestedProvider !== detected && detected !== "generic") {
    warnings.push(`ファイルヘッダー推定は ${detected} ですが、指定は ${requestedProvider} です。`);
  }

  return {
    sourceProvider: finalProvider,
    format: "csv",
    totalParsed: items.length,
    warnings,
    items
  };
}
