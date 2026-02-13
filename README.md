# PasswordManeger

ネイティブアプリ主役のマルチプラットフォーム・パスワードマネージャーです。

- 主役: Desktop アプリ（Electron） + ブラウザ拡張（Chrome/Edge/Brave など）
- 補助: Web（課金・アカウント管理・緊急アクセス）
- サーバー: 認証 / Stripe課金 / 暗号化Vault同期API

## 1. 現在の実装範囲

### Desktop（`apps/desktop`）
1. ローカル暗号化Vault（PBKDF2 + AES-GCM）
2. ログイン / カード / 個人情報 / ノートの管理
3. パスワード生成 / TOTP / セキュリティ診断 + 改善優先度コーチ
4. 他サービス移行（1Password / Bitwarden / LastPass / 汎用CSV/JSON）+ 差分プレビュー
5. 有料ユーザー向けクラウド同期（push / pull）

### Browser Extension（ルート直下 + `src/`）
1. Webフォーム自動入力
2. リスクベース自動入力（高リスク時は確認必須）
3. サイト別フォーム学習（誤学習リセット対応）
4. 保存候補検出
5. Desktopと同等のVault管理機能
6. クラウド同期（有料）

### Web + Server（`server/`）
1. アカウント登録 / ログイン
2. Stripe Checkout / Billing Portal
3. エンタイトルメント（利用権）一元管理
4. 同期API（有料ユーザーのみ）
5. 緊急アクセス: 暗号化スナップショットのダウンロード
6. 緊急復旧オプション: 鍵分割（ブラウザ内で分割/復元）

## 2. なぜこの構成にしたか

### 採用理由
1. ネイティブ主役にすると、ブラウザが閉じていてもVault管理できる
2. 拡張機能を併用すると、ログイン画面での自動入力体験を維持できる
3. Webは課金と復旧導線に絞ることで、責務が明確になる

### メリット
1. 役割分離が明確（Desktop=保管庫、Extension=自動入力、Web=契約/復旧）
2. 学習しやすい（1機能1責務）
3. 商用運用で必要な課金と同期を最初から持てる

### デメリット・注意点
1. クライアントが複数あるため、配布手順が増える
2. ネイティブ署名（macコード署名、Windows署名）は商用配布時に追加作業が必要
3. PBKDF2は実用的だが、将来的にはArgon2id移行が望ましい

## 3. セットアップ

### 3-1. 依存インストール

```bash
npm install
npm run server:install
npm run desktop:install
```

### 3-2. サーバー環境変数

```bash
cp server/.env.example server/.env
```

`server/.env` に最低限以下を設定:

1. `JWT_SECRET`
2. `STRIPE_SECRET_KEY`（テストなら `sk_test_...`）
3. `STRIPE_PRICE_ID`（`price_...`）
4. `STRIPE_WEBHOOK_SECRET`（`whsec_...`）
5. `ENTITLEMENT_INGEST_TOKEN`（他ストア課金連携用の共有トークン）
6. `APP_BASE_URL`（例: `http://localhost:8787`）
7. `CORS_ORIGIN`（例: `http://localhost:8787`）
8. `ALLOW_INSECURE_WEBHOOK`（通常は `0`。ローカルで署名なしWebhookを使う場合だけ `1`）

### 3-3. 起動

```bash
npm run server:dev
npm run desktop:dev
```

- Webポータル: `http://localhost:8787`
- Desktop起動後、画面内の「拡張機能フォルダを開く」から拡張機能読み込みが可能

### 3-3-1. 1コマンド起動スクリプト（おすすめ）

通常起動（server + desktop）:

```bash
npm run dev:up
```

MCPも同時起動（server + desktop + mcp）:

```bash
npm run dev:up:mcp
```

補足:
1. `server/.env` の `JWT_SECRET` が未設定だと安全のため起動しません
2. 必要な依存が未インストールなら、スクリプトが自動で `npm install` を実行します

### 3-4. Chrome拡張の読み込み

1. `chrome://extensions` を開く
2. デベロッパーモードをON
3. 「パッケージ化されていない拡張機能を読み込む」
4. このリポジトリのルートフォルダを選択

### 3-5. 拡張機能の動作確認（デモページ）

外部サイトを使わずに、自動入力/保存候補/フォーム学習を試せます。

1. サーバー起動: `npm run server:dev`
2. デモ一覧を開く: `http://localhost:8787/demo/`
3. 例: `login.html` を開く
4. 拡張機能ポップアップでログイン項目を作成（URLは `http://localhost:8787/demo/login.html`）
5. ポップアップの「このサイト向け候補」から自動入力

追加で試せること:
- 保存候補: デモフォームを送信 → ポップアップの「保存候補」に表示されるか確認
- フォーム学習: `login.html` の Trickyフォームで自動入力 → 必要なら手動修正 → 送信 → 次回から当たりやすくなるか確認
- リスクベース自動入力: URLが別ドメインの項目（例: `https://example.com`）を作り、`localhost` で自動入力すると高リスク扱いになりやすい

学習検証専用ページ:
- `http://localhost:8787/demo/learn-login.html`
- 先頭に囮フィールドがあり、`手動修正 -> 送信 -> 再自動入力` で学習効果を確認しやすい

### 3-6. 拡張込みE2E（自動入力→送信→学習）を自動実行

```bash
npm run test:e2e:extension
```

このテストが行うこと:
1. 一時サーバーを起動（テスト専用DB）
2. 拡張機能を読み込んだChromiumを起動
3. `learn-login.html` で初回自動入力
4. 手動修正して送信（保存候補 + 学習更新）
5. 再度自動入力し、学習後に本来欄へ入ることを検証

### 3-7. MCPでAIから操作する（AIネイティブ運用）

MCP（Model Context Protocol）は、AIがアプリを安全に操作するための共通インターフェースです。  
このプロジェクトでは Desktop のVaultサービスをそのままMCP化しているため、GUI操作と同じロジックをAIから実行できます。

起動:

```bash
npm run mcp:start
```

主なツール:
1. `pm_setup_vault` / `pm_unlock_vault` / `pm_lock_vault`
2. `pm_list_items` / `pm_save_item` / `pm_delete_item`
3. `pm_preview_external_import` / `pm_apply_external_import`
4. `pm_cloud_register` / `pm_cloud_login` / `pm_cloud_status`
5. `pm_cloud_entitlements_status` / `pm_cloud_sync_push` / `pm_cloud_sync_pull`
6. `pm_cloud_checkout_link` / `pm_cloud_portal_link`

環境変数（必要なら設定）:
1. `PM_MCP_WEB_BASE_URL`（デフォルト: `http://localhost:8787`）
2. `PM_MCP_DATA_DIR`（MCP実行時のローカルデータ保存先）
3. `PM_MCP_EXTENSION_PATH`（拡張フォルダのパス上書き）
4. `PM_MCP_ALLOW_SECRET_EXPORT`（`1` のときだけ `includeSecrets: true` を許可）

注意:
1. `pm_list_items` は初期状態で秘密値をマスクします（`includeSecrets: true` で明示的に開示）
2. 課金や同期系ツールは、先に `pm_cloud_login` 等でクラウド認証が必要です
3. クラウド認証トークンは永続保存しない設計にしているため、再起動後は再ログインが必要です

## 4. mac / Windows で試す

### mac（Apple Silicon）

```bash
npm run desktop:dist:mac -- --dir
```

出力例:
- `apps/desktop/dist/mac-arm64/PasswordManeger.app`

### Windows（x64）

```bash
npm run desktop:dist:win -- --dir
```

出力例:
- `apps/desktop/dist/win-unpacked/PasswordManeger.exe`

補足:
- `--dir` はインストーラ生成なしの検証用ビルド
- 商用配布では署名とインストーラ（dmg / nsis）を使う

## 4-1. 署名（ローカル試用）

この環境では Developer ID 証明書がない場合でも、ローカル試用向け ad-hoc 署名を実行できます。

```bash
npm run desktop:sign:local
```

実行内容:
1. macアプリをビルド
2. `codesign` で署名
3. 署名検証

注意:
1. ad-hoc署名は「ローカル試用」向けです
2. App Store配布や一般配布では Developer ID + Notarization が必要です
3. 初回起動で警告が出た場合は、Finderでアプリを右クリック -> 「開く」を1回実行してください

## 4-2. GitHub Actions で Windows/Mac ビルドを作る（おすすめ）

Windows実機が手元にない場合でも、GitHub上でビルドして `.exe` をダウンロードできます。

1. GitHub のリポジトリ画面を開く
2. 上部メニューの `Actions` を開く
3. `Build Desktop Apps` を選ぶ
4. `Run workflow` を押す（または `main` に push すると自動で走ります）
5. 実行が終わったら、成果物（artifact）をダウンロード

artifactの中身の目安:
- `passwordmaneger-desktop-win-x64`: `PasswordManeger Setup ...exe`（インストーラ）と `PasswordManeger ...exe`（ポータブル）
- `passwordmaneger-desktop-mac-arm64`: `.dmg` / `.zip` など

注意:
- 署名（Code Signing）をしていないビルドは、Windows の SmartScreen や macOS の Gatekeeper で警告が出やすいです
- まずは「試す」目的で使い、一般配布（商用リリース）では必ず署名 + Notarization（mac）/コード署名（Windows）を行ってください

## 5. Webhook自動セットアップ（テスト）

公開URLがある場合（例: ngrok）:

```bash
npm run stripe:webhook:test -- https://<公開URL>
```

このコマンドは以下を自動実行します。
1. StripeにWebhook endpointを作成
2. `server/.env` の `STRIPE_WEBHOOK_SECRET` を更新

## 6. テスト

```bash
npm test
```

追加の検証:

```bash
npm run test:mcp
npm run test:stripe:demo
npm run test:full
```

- `test:mcp`: MCP経由で登録/保存/利用権/同期までをスモーク検証
- `test:stripe:demo`: Checkout / Billing Portal / Webhook / 利用権反映のスモークテスト
- `test:full`: 単体テスト + MCP + 拡張E2E + Stripeデモをまとめて実行

### 6-2. GitHub Actionsで `test:full` を自動実行

このリポジトリには `Test Full` ワークフロー（`.github/workflows/test-full.yml`）を追加済みです。

動作:
1. `main` への push 時に自動実行
2. Actions 画面から手動実行（`workflow_dispatch`）も可能
3. Linux上で `xvfb` を使って拡張E2Eを含む `npm run test:full` を実行

## 6-1. すぐ試す（サーバー + Desktop同時起動）

```bash
npm run desktop:run:local
```

このコマンドは次を自動で行います。
1. サーバー起動（`http://localhost:8787`）
2. Desktop起動

## 7. API一覧（主要）

### 認証
1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `GET /api/auth/me`

### 課金
1. `POST /api/billing/checkout-session`
2. `POST /api/billing/portal-session`
3. `GET /api/billing/status`
4. `POST /api/billing/webhook`
5. `GET /api/entitlements/status`
6. `POST /api/entitlements/ingest`（サーバー間連携用）

### Vault同期
1. `GET /api/vault/snapshot`
2. `PUT /api/vault/snapshot`

### 緊急アクセス
1. `GET /api/vault/emergency-export`

## 8. いま出来ること / まだ出来ないこと

### 出来ること
1. Desktop中心で日常利用（保存・編集・生成・診断）
2. 拡張機能でWeb自動入力
3. Stripe課金を含むエンタイトルメント一元管理
4. 有料ユーザー同期
5. 緊急時に暗号化スナップショットをWebから回収

### まだ出来ないこと
1. ネイティブ生体認証（Face ID / Touch ID / Windows Hello）
2. Passkeyのフル管理
3. 企業向けSSO / SCIM /監査ログの本実装

## 9. 重要なセキュリティ注意

1. テストキー（`sk_test_...`）でも公開は避ける（不正利用やノイズ発生の原因）
2. `.env` はGitに含めない
3. マスターパスワード紛失時はVault復元できない
4. 商用公開前に暗号・認証・決済の監査を推奨
5. `JWT_SECRET` 未設定ではサーバー起動しない仕様です（固定デフォルト鍵を禁止）
6. Webhook署名検証は既定で必須です（`ALLOW_INSECURE_WEBHOOK=1` はローカル検証専用）
