/**
 * @pm/core パッケージのモバイル環境での動作検証用スクリプト
 *
 * React Native / Expo を導入する前に、コアロジック（暗号化・パスワード生成等）が
 * Node.js 上で正しくインポート・実行できることを確認する。
 */
import {
    createVaultEnvelope,
    unlockVaultEnvelope,
    generatePassword,
    passwordStrength,
    validateCloudBaseUrl
} from "@pm/core";

console.log("=== @pm/core モバイル検証 ===\n");

// 1. パスワード生成テスト
const password = generatePassword({ length: 24, symbols: true });
const strength = passwordStrength(password);
console.log(`✓ パスワード生成: ${password}`);
console.log(`  強度: ${strength.label} (score: ${strength.score})\n`);

// 2. 暗号化 / 復号化ラウンドトリップ
const testVault = {
    version: 1,
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    settings: {},
    items: [
        { id: "test-1", type: "login", title: "Test Service", username: "user@example.com", password: "TestPW123!" }
    ]
};

const masterPassword = "MobileTestMaster123!";
const envelope = await createVaultEnvelope(testVault, masterPassword);
const unlocked = await unlockVaultEnvelope(envelope, masterPassword);

if (unlocked.vault.items[0].title === "Test Service") {
    console.log("✓ 暗号化/復号化ラウンドトリップ: 成功");
} else {
    console.error("✗ 暗号化/復号化ラウンドトリップ: 失敗");
    process.exitCode = 1;
}

// 3. Cloud URL バリデーション
const url = validateCloudBaseUrl("https://api.example.com/");
console.log(`✓ Cloud URL バリデーション: ${url}\n`);

console.log("=== 全検証完了 ===");
