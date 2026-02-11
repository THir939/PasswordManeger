# PasswordManeger Server

商用運用向けのクラウド同期 + Web課金サーバーです。

## 機能

1. メール/パスワード認証
2. Stripe Checkoutによるサブスク課金
3. Stripe Billing Portalによる契約管理
4. エンタイトルメント（利用権）一元管理
5. 有料ユーザー限定のVault同期API（暗号化済みEnvelopeのみ保存）
6. 緊急アクセス用の暗号化スナップショット取得API
7. Web上での復旧キー鍵分割（オプション）
8. 課金状態を管理するWeb画面（`/`）

ポイント:
- 購入経路（Stripe / App Store / Google Play / 手動付与）が異なっても、サーバー内部では同じ `entitlements` として判定します。

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
- `STRIPE_WEBHOOK_SECRET`: Webhook署名シークレット（必須）
- `ALLOW_INSECURE_WEBHOOK`: ローカル検証で署名なしWebhookを許可したい場合のみ `1`（本番は必ず `0`）
- `ENTITLEMENT_INGEST_TOKEN`: 外部課金連携から利用権を取り込むための共有トークン
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
- 通常運用では署名なしWebhookは拒否されます（`ALLOW_INSECURE_WEBHOOK=1` のときだけ例外）

## API（主要）

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `GET /api/billing/status`
- `GET /api/entitlements/status`
- `POST /api/entitlements/ingest`（サーバー間連携用）
- `GET /api/vault/snapshot`（有料のみ）
- `PUT /api/vault/snapshot`（有料のみ）
- `GET /api/vault/emergency-export`（ログイン必須）

## エンタイトルメント取込API（他ストア連携用）

用途:
- Apple/Google等で購入した利用権を、後段の連携サーバーから本サーバーに反映するためのAPIです。

リクエスト:
- Header: `x-entitlement-token: <ENTITLEMENT_INGEST_TOKEN>`
- Body（例）:
```json
{
  "email": "user@example.com",
  "feature": "cloud_sync",
  "source": "apple",
  "sourceRef": "original_transaction_id",
  "status": "active",
  "expiresAt": "2026-03-01T00:00:00.000Z",
  "metadata": {
    "environment": "production"
  }
}
```

## データ保存

- 開発用DB: `server/data/db.json`
- 保存されるVaultデータは暗号化済みEnvelope（平文は保存しない）
