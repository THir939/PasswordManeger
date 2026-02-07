# PasswordManeger

ネイティブアプリ主役のマルチプラットフォーム・パスワードマネージャーです。

- 主役: Desktop アプリ（Electron） + ブラウザ拡張（Chrome/Edge/Brave など）
- 補助: Web（課金・アカウント管理・緊急アクセス）
- サーバー: 認証 / Stripe課金 / 暗号化Vault同期API

## 1. 現在の実装範囲

### Desktop（`apps/desktop`）
1. ローカル暗号化Vault（PBKDF2 + AES-GCM）
2. ログイン / カード / 個人情報 / ノートの管理
3. パスワード生成 / TOTP / セキュリティ診断
4. 他サービス移行（1Password / Bitwarden / LastPass / 汎用CSV/JSON）
5. 有料ユーザー向けクラウド同期（push / pull）

### Browser Extension（ルート直下 + `src/`）
1. Webフォーム自動入力
2. 保存候補検出
3. Desktopと同等のVault管理機能
4. クラウド同期（有料）

### Web + Server（`server/`）
1. アカウント登録 / ログイン
2. Stripe Checkout / Billing Portal
3. 同期API（有料ユーザーのみ）
4. 緊急アクセス: 暗号化スナップショットのダウンロード

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
5. `APP_BASE_URL`（例: `http://localhost:8787`）
6. `CORS_ORIGIN`（例: `http://localhost:8787`）

### 3-3. 起動

```bash
npm run server:dev
npm run desktop:dev
```

- Webポータル: `http://localhost:8787`
- Desktop起動後、画面内の「拡張機能フォルダを開く」から拡張機能読み込みが可能

### 3-4. Chrome拡張の読み込み

1. `chrome://extensions` を開く
2. デベロッパーモードをON
3. 「パッケージ化されていない拡張機能を読み込む」
4. このリポジトリのルートフォルダを選択

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

### Vault同期
1. `GET /api/vault/snapshot`
2. `PUT /api/vault/snapshot`

### 緊急アクセス
1. `GET /api/vault/emergency-export`

## 8. いま出来ること / まだ出来ないこと

### 出来ること
1. Desktop中心で日常利用（保存・編集・生成・診断）
2. 拡張機能でWeb自動入力
3. Stripe課金と有料ユーザー同期
4. 緊急時に暗号化スナップショットをWebから回収

### まだ出来ないこと
1. ネイティブ生体認証（Face ID / Touch ID / Windows Hello）
2. Passkeyのフル管理
3. 企業向けSSO / SCIM /監査ログの本実装

## 9. 重要なセキュリティ注意

1. テストキー（`sk_test_...`）でも公開は避ける（不正利用やノイズ発生の原因）
2. `.env` はGitに含めない
3. マスターパスワード紛失時はVault復元できない
4. 商用公開前に暗号・認証・決済の監査を推奨
