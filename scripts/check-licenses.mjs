#!/usr/bin/env node
/**
 * 商用リリース前提のため「商用不可 / 強いコピーレフト / 不明」ライセンスを早期に検出する簡易チェッカー。
 *
 * 目的:
 * - 依存を増やしたときに、GitHub Actions で自動的に止める（後から気づくと大変なので）
 *
 * 注意:
 * - これは法務判断の代わりではありません（最終的には弁護士/法務で確認が必要）
 * - npm の package-lock.json の `packages[*].license` フィールドに依存します
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const POLICY = {
  // 商用で一般的に問題になりにくい「許諾型(パーミッシブ)」を中心に許可。
  // ここにないライセンスは基本「要確認(unknown)」として落とします。
  allowedSpdx: new Set([
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "CC0-1.0",
    "Unlicense",
    "0BSD",
    "BlueOak-1.0.0",
    "Python-2.0",
    "WTFPL"
  ]),

  // 「商用不可」や「強いコピーレフト」「ソース公開義務が強いもの」をざっくりブロック。
  // 完全な網羅ではないので、必要に応じて増やす。
  bannedKeywordsLower: [
    "noncommercial",
    "non-commercial",
    "cc-by-nc",
    "cc-by-nd",
    "cc-by-sa",
    "gpl",
    "agpl",
    "lgpl",
    "sspl",
    "busl",
    "bsl-1.1",
    "elastic",
    "polyform",
    "commons clause",
    "cddl",
    "mpl",
    "epl",
    "osl",
    "eupl"
  ],

  // 許可はするが、法務レビューでは嫌がられがちな「変わり種」を警告にする。
  warnSpdx: new Set(["WTFPL", "Python-2.0", "BlueOak-1.0.0"])
};

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function usage() {
  const text = `
Usage:
  node scripts/check-licenses.mjs
  node scripts/check-licenses.mjs --lock package-lock.json --lock server/package-lock.json

Options:
  --lock <path>   Check only the given lockfile path(s). Can be repeated.
  --json          Output machine-readable JSON (still exits non-zero on failure).
`;
  process.stdout.write(text.trimStart());
}

function splitByKeyword(expression, keywordUpper) {
  const keyword = keywordUpper.toUpperCase();
  const parts = [];
  let current = "";
  const tokens = expression.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    if (token.toUpperCase() === keyword) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += (current ? " " : "") + token;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.length ? parts : [expression.trim()];
}

function normalizeLeafToken(token) {
  return String(token || "")
    .trim()
    .replace(/^[(]+/, "")
    .replace(/[)]+$/, "")
    .replace(/[,;]+$/, "")
    .trim();
}

function isBannedToken(token) {
  const lower = String(token || "").toLowerCase();
  if (!lower) {
    return false;
  }
  return POLICY.bannedKeywordsLower.some((keyword) => lower.includes(keyword));
}

function evaluateLicenseExpression(licenseExpressionRaw) {
  const raw = String(licenseExpressionRaw || "").trim();

  if (!raw) {
    return {
      status: "unknown",
      raw,
      reason: "missing"
    };
  }

  // 例: "SEE LICENSE IN LICENSE"
  if (/^see license in/i.test(raw)) {
    return {
      status: "unknown",
      raw,
      reason: "see-license-in-file"
    };
  }

  // ゆるく URL / file: を含むものも「要確認」に寄せる
  if (raw.includes("http://") || raw.includes("https://") || raw.includes("file:")) {
    return {
      status: "unknown",
      raw,
      reason: "license-reference"
    };
  }

  // ここでは超簡易パーサ:
  // - OR は「どれか1つ選べる」なので、どれか1枝でも全部 allowed なら OK
  // - AND は「全部守る」必要があるので、全部 allowed でないと NG
  // 典型例: "(MIT OR CC0-1.0)", "WTFPL OR ISC"
  const sanitized = raw.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const orBranches = splitByKeyword(sanitized, "OR");

  const seen = new Set();
  const unknownTokens = new Set();
  const bannedTokens = new Set();
  const warnTokens = new Set();

  let hasAllowedBranch = false;

  for (const branch of orBranches) {
    const andParts = splitByKeyword(branch, "AND");
    let branchOk = true;

    for (const part of andParts) {
      const token = normalizeLeafToken(part);
      if (!token) {
        branchOk = false;
        continue;
      }

      seen.add(token);

      if (isBannedToken(token)) {
        bannedTokens.add(token);
        branchOk = false;
        continue;
      }

      if (!POLICY.allowedSpdx.has(token)) {
        unknownTokens.add(token);
        branchOk = false;
        continue;
      }

      if (POLICY.warnSpdx.has(token)) {
        warnTokens.add(token);
      }
    }

    if (branchOk) {
      hasAllowedBranch = true;
    }
  }

  if (hasAllowedBranch) {
    return {
      status: "allowed",
      raw,
      tokens: [...seen].sort(),
      warnings: [...warnTokens].sort()
    };
  }

  if (bannedTokens.size > 0) {
    return {
      status: "banned",
      raw,
      tokens: [...seen].sort(),
      bannedTokens: [...bannedTokens].sort()
    };
  }

  return {
    status: "unknown",
    raw,
    tokens: [...seen].sort(),
    unknownTokens: [...unknownTokens].sort()
  };
}

function inferredNameFromPackagePath(packagePath) {
  const parts = String(packagePath || "").split("node_modules/");
  return parts[parts.length - 1] || packagePath;
}

function scanLockfile(lockPath) {
  const rawText = fs.readFileSync(lockPath, "utf8");
  const lock = JSON.parse(rawText);
  const packages = lock.packages;
  if (!packages || typeof packages !== "object") {
    throw new Error(`Unsupported lockfile format (no 'packages'): ${lockPath}`);
  }

  const unique = new Map();

  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (pkgPath === "" || !meta) {
      continue;
    }

    const name = meta.name || inferredNameFromPackagePath(pkgPath);
    const version = meta.version || "unknown";
    const key = `${name}@${version}`;

    const license = meta.license || "";
    const evaluation = evaluateLicenseExpression(license);

    const entry = unique.get(key);
    const isDev = Boolean(meta.dev);
    const isOptional = Boolean(meta.optional);

    if (!entry) {
      unique.set(key, {
        name,
        version,
        license,
        evaluation,
        // devOnly は「すべて dev のときだけ true」にしたいので、いったん meta.dev をセット
        devOnly: isDev,
        optional: isOptional
      });
      continue;
    }

    // 既に存在する場合: devOnly は AND、optional は OR
    entry.devOnly = entry.devOnly && isDev;
    entry.optional = entry.optional || isOptional;

    // licenseフィールドが異なるものが混ざった場合は不整合なので unknown 扱いへ寄せる
    if (String(entry.license) !== String(license)) {
      entry.evaluation = {
        status: "unknown",
        raw: `${entry.license} / ${license}`,
        reason: "inconsistent"
      };
    }
  }

  const rows = [...unique.values()].sort((a, b) => (a.name + a.version).localeCompare(b.name + b.version));

  const summary = {
    allowed: 0,
    banned: 0,
    unknown: 0,
    warnings: 0
  };

  const flagged = [];

  for (const row of rows) {
    if (row.evaluation.status === "allowed") {
      summary.allowed += 1;
      if (Array.isArray(row.evaluation.warnings) && row.evaluation.warnings.length > 0) {
        summary.warnings += 1;
      }
      continue;
    }

    if (row.evaluation.status === "banned") {
      summary.banned += 1;
      flagged.push(row);
      continue;
    }

    summary.unknown += 1;
    flagged.push(row);
  }

  return { lockPath, rows, summary, flagged };
}

function main() {
  const args = process.argv.slice(2);
  const lockPaths = [];
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--lock") {
      const next = args[index + 1];
      if (!next) {
        process.stderr.write("Error: --lock requires a path\n");
        process.exit(2);
      }
      lockPaths.push(next);
      index += 1;
      continue;
    }

    process.stderr.write(`Error: unknown option: ${arg}\n`);
    usage();
    process.exit(2);
  }

  const repoRoot = process.cwd();
  const defaultLocks = [
    "package-lock.json",
    path.join("server", "package-lock.json"),
    path.join("apps", "desktop", "package-lock.json")
  ].filter((p) => exists(path.join(repoRoot, p)));

  const targets = (lockPaths.length ? lockPaths : defaultLocks).map((p) => path.resolve(repoRoot, p));

  if (targets.length === 0) {
    process.stderr.write("No lockfiles found to scan.\n");
    process.exit(0);
  }

  const results = [];
  let hasBanned = false;
  let hasUnknown = false;

  for (const lockPath of targets) {
    const relative = path.relative(repoRoot, lockPath);
    if (!exists(lockPath)) {
      results.push({
        lockPath: relative,
        error: "missing"
      });
      hasUnknown = true;
      continue;
    }

    try {
      const result = scanLockfile(lockPath);
      results.push({
        ...result,
        lockPath: relative
      });
      hasBanned = hasBanned || result.summary.banned > 0;
      hasUnknown = hasUnknown || result.summary.unknown > 0;
    } catch (error) {
      results.push({
        lockPath: relative,
        error: error?.message || String(error)
      });
      hasUnknown = true;
    }
  }

  if (json) {
    process.stdout.write(JSON.stringify({ ok: !hasBanned && !hasUnknown, results }, null, 2) + "\n");
  } else {
    for (const result of results) {
      process.stdout.write(`\n[license-check] ${result.lockPath}\n`);

      if (result.error) {
        process.stdout.write(`- ERROR: ${result.error}\n`);
        continue;
      }

      process.stdout.write(
        `- allowed: ${result.summary.allowed}, banned: ${result.summary.banned}, unknown: ${result.summary.unknown}, warnings: ${result.summary.warnings}\n`
      );

      if (result.flagged.length) {
        process.stdout.write("- flagged packages:\n");
        result.flagged.slice(0, 80).forEach((row) => {
          const kind = row.evaluation.status;
          const devTag = row.devOnly ? " (devOnly)" : "";
          const optTag = row.optional ? " (optional)" : "";
          process.stdout.write(`  - [${kind}] ${row.name}@${row.version}: ${row.license}${devTag}${optTag}\n`);
        });
        if (result.flagged.length > 80) {
          process.stdout.write(`  - ...and ${result.flagged.length - 80} more\n`);
        }
      }

      // 変わり種ライセンス警告（allowed の範囲）
      const warned = result.rows
        .filter((row) => row.evaluation.status === "allowed" && Array.isArray(row.evaluation.warnings) && row.evaluation.warnings.length)
        .slice(0, 20);

      if (warned.length) {
        process.stdout.write("- warnings (allowed but unusual):\n");
        warned.forEach((row) => {
          process.stdout.write(`  - ${row.name}@${row.version}: ${row.license}\n`);
        });
      }
    }
    process.stdout.write("\n");
  }

  if (hasBanned || hasUnknown) {
    process.stderr.write(
      "License check failed: found banned or unknown licenses. Fix the dependency or update policy with legal review.\n"
    );
    process.exit(1);
  }
}

main();

