# LIN-806 Implement Rules

## Scope boundaries
- 変更対象は Rust API（`rust/apps/api`）中心。
- DB migration は追加しない（LIN-803契約を利用）。
- 招待/DM/カテゴリ/スレッドへの横展開は禁止。

## Fixed decisions
- API path は `guild` 基準（`/guilds`）。
- 非メンバー時は `403 AUTHZ_DENIED`。
- Guild作成時は owner bootstrap まで（default channelは作らない）。
- Channel作成は全メンバー可。
- IDは JSON `number` で返す。
