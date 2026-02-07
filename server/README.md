# PasswordManeger Server

商用運用向けのクラウド同期 + Web課金サーバーです。

## 機能

1. メール/パスワード認証
2. Stripe Checkoutによるサブスク課金
3. Stripe Billing Portalによる契約管理
4. 有料ユーザー限定のVault同期API（暗号化済みEnvelopeのみ保存）
5. 課金状態を管理するWeb画面（`/`）

## セットアップ

1. 依存インストール

```bash
npm --prefix server install
```

2. 環境変数

```bash
cp server/.env.example server/.env
```

- `JWT_SECRET`: 長いランダム値
- `STRIPE_SECRET_KEY`: Stripeのシークレットキー
- `STRIPE_PRICE_ID`: サブスクPrice ID
- `STRIPE_WEBHOOK_SECRET`: Webhook署名シークレット（必要なら）
- `APP_BASE_URL`: 例 `http://localhost:8787`

3. 起動

```bash
npm run server:dev
```

4. テストWebhookを自動設定（公開URLがある場合）

```bash
npm run webhook:test -- https://YOUR_PUBLIC_URL
```

- 指定URLの `/api/billing/webhook` をStripeに登録します
- 取得した `whsec_...` を `server/.env` の `STRIPE_WEBHOOK_SECRET` に自動反映します

## API（主要）

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `GET /api/billing/status`
- `GET /api/vault/snapshot`（有料のみ）
- `PUT /api/vault/snapshot`（有料のみ）

## データ保存

- 開発用DB: `server/data/db.json`
- 保存されるVaultデータは暗号化済みEnvelope（平文は保存しない）
