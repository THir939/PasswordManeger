import { passwordStrength } from "./password.js";

const MAX_AGE_DAYS = 180;

function daysBetween(isoDate) {
  if (!isoDate) {
    return null;
  }

  const value = Date.parse(isoDate);
  if (Number.isNaN(value)) {
    return null;
  }

  return Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
}

export function buildSecurityReport(items = []) {
  const loginItems = items.filter((item) => item.type === "login");
  const passwordMap = new Map();
  const weakItems = [];
  const oldItems = [];
  let twoFactorReady = 0;

  for (const item of loginItems) {
    const password = item.password || "";
    const strength = passwordStrength(password);

    if (!passwordMap.has(password)) {
      passwordMap.set(password, []);
    }
    passwordMap.get(password).push(item.id);

    if (strength.score < 60) {
      weakItems.push({
        id: item.id,
        title: item.title,
        score: strength.score,
        label: strength.label
      });
    }

    const age = daysBetween(item.passwordUpdatedAt || item.updatedAt || item.createdAt);
    if (age !== null && age > MAX_AGE_DAYS) {
      oldItems.push({
        id: item.id,
        title: item.title,
        ageDays: age
      });
    }

    if (item.otpSecret) {
      twoFactorReady += 1;
    }
  }

  const reusedGroups = [];
  for (const [password, ids] of passwordMap.entries()) {
    if (password && ids.length > 1) {
      reusedGroups.push({
        count: ids.length,
        ids
      });
    }
  }

  const total = loginItems.length;
  const issues = weakItems.length + oldItems.length + reusedGroups.reduce((sum, group) => sum + group.count, 0);
  const baseScore = total === 0 ? 100 : Math.max(0, Math.round(100 - (issues / (total * 3)) * 100));

  return {
    score: baseScore,
    totals: {
      allLogins: total,
      weak: weakItems.length,
      old: oldItems.length,
      reusedGroups: reusedGroups.length,
      twoFactorReady,
      twoFactorCoverage: total === 0 ? 100 : Math.round((twoFactorReady / total) * 100)
    },
    weakItems,
    oldItems,
    reusedGroups
  };
}
