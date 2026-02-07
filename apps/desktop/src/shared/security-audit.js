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

function toCoachTask(payload) {
  return {
    id: payload.id,
    title: payload.title,
    priority: payload.priority,
    priorityLabel: payload.priority === 1 ? "最優先" : payload.priority === 2 ? "高" : "中",
    impact: payload.impact,
    affectedCount: payload.affectedCount,
    description: payload.description,
    nextStep: payload.nextStep,
    sampleTitles: payload.sampleTitles || []
  };
}

function buildSecurityCoach(loginItems, weakItems, oldItems, reusedGroups, missing2faItems) {
  const tasks = [];

  if (reusedGroups.length > 0) {
    const impactedIds = new Set();
    reusedGroups.forEach((group) => group.ids.forEach((id) => impactedIds.add(id)));
    const impactedTitles = loginItems
      .filter((item) => impactedIds.has(item.id))
      .slice(0, 5)
      .map((item) => item.title);

    tasks.push(
      toCoachTask({
        id: "replace-reused-passwords",
        title: "使い回しパスワードを先に解消",
        priority: 1,
        impact: "アカウント連鎖侵害のリスクを大きく下げる",
        affectedCount: impactedIds.size,
        description: "同じパスワードが複数サービスで使われています。1件漏えいすると他サービスにも波及します。",
        nextStep: "重複しているログインから順に、ランダム生成した別パスワードへ変更してください。",
        sampleTitles: impactedTitles
      })
    );
  }

  if (weakItems.length > 0) {
    tasks.push(
      toCoachTask({
        id: "upgrade-weak-passwords",
        title: "弱いパスワードを強化",
        priority: 1,
        impact: "総当たり攻撃への耐性を上げる",
        affectedCount: weakItems.length,
        description: "推測されやすい短い文字列や単純パターンが残っています。",
        nextStep: "PasswordManegerの生成機能で16文字以上・記号ありのパスワードへ更新してください。",
        sampleTitles: weakItems.slice(0, 5).map((item) => item.title)
      })
    );
  }

  if (missing2faItems.length > 0) {
    tasks.push(
      toCoachTask({
        id: "enable-2fa",
        title: "重要サービスで2段階認証を有効化",
        priority: 2,
        impact: "パスワード漏えい時の不正ログインを抑止",
        affectedCount: missing2faItems.length,
        description: "TOTP（6桁コード）未設定のログインがあります。",
        nextStep: "優先サービス（メール・決済・SNS）から2段階認証を有効化し、シークレットを登録してください。",
        sampleTitles: missing2faItems.slice(0, 5).map((item) => item.title)
      })
    );
  }

  if (oldItems.length > 0) {
    tasks.push(
      toCoachTask({
        id: "rotate-old-passwords",
        title: "古いパスワードをローテーション",
        priority: 3,
        impact: "長期利用によるリスク蓄積を下げる",
        affectedCount: oldItems.length,
        description: `最終更新から${MAX_AGE_DAYS}日を超えたログインがあります。`,
        nextStep: "優先度の高いサービスから順にパスワードを更新し、更新日を最新化してください。",
        sampleTitles: oldItems.slice(0, 5).map((item) => item.title)
      })
    );
  }

  return tasks.sort((a, b) => a.priority - b.priority || b.affectedCount - a.affectedCount);
}

export function buildSecurityReport(items = []) {
  const loginItems = items.filter((item) => item.type === "login");
  const passwordMap = new Map();
  const weakItems = [];
  const oldItems = [];
  const missing2faItems = [];
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
    } else {
      missing2faItems.push(item);
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

  const coach = buildSecurityCoach(loginItems, weakItems, oldItems, reusedGroups, missing2faItems);

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
    reusedGroups,
    coach,
    coachSummary: coach.map((task) => `${task.priorityLabel}: ${task.title} (${task.affectedCount}件)`).join(" / ")
  };
}
