# LIN-802 Documentation Log

## Current status
- Now: 実装完了。Rust/TSの主要品質ゲートを通過。
- Next: PR作成時に `LIN-822/832/833` の受け入れ条件対応を説明へ反映する。

## Decisions
- `LIN-817` が Canceled のため、LIN-802内では fail-close 契約を保持した暫定先行実装とした。
- ルートは `/guilds/{guild_id}/moderation/*` で統一し、キュー/詳細は `/channels/[serverId]/moderation*` で接続した。
- DBは additive 変更のみ（新規テーブル/enum値追加）とした。

## How to run / demo
1. Rust API起動: `make rust-dev`
2. FE起動: `make ts-dev`
3. 通報作成: `/channels/{serverId}/moderation` で report を作成
4. 詳細遷移: キュー項目から `/channels/{serverId}/moderation/{reportId}`
5. 状態遷移: `resolve` / `reopen` を実行
6. ミュート操作: 詳細画面で `mute` を実行

## Validation results
- Passed: `make rust-lint`
- Passed: `cd typescript && npm run typecheck`
- Passed: `cd typescript && npm run lint`
- Failed: `make validate`（Python環境の PEP 668 制約で `py-format` が失敗）

## Changed artifacts
- Added migration:
  - `database/postgres/migrations/0012_lin822_minimal_moderation.up.sql`
  - `database/postgres/migrations/0012_lin822_minimal_moderation.down.sql`
- Added Rust moderation module:
  - `rust/apps/api/src/moderation.rs`
  - `rust/apps/api/src/moderation/*`
- Updated Rust API integration:
  - `rust/apps/api/src/main.rs`
  - `rust/apps/api/src/main/http_routes.rs`
  - `rust/apps/api/src/main/tests.rs`
- Added TS moderation feature/routes/hooks:
  - `typescript/src/app/channels/[serverId]/moderation/**`
  - `typescript/src/features/moderation/**`
  - `typescript/src/shared/api/queries/use-moderation-reports.ts`
  - `typescript/src/shared/api/mutations/use-moderation-actions.ts`

## Known issues / follow-ups
- `make validate` はローカルPython管理制約で未完了。CIまたはvenv前提で再実行が必要。
- `database/postgres/schema.sql` と `database/postgres/generated/*` の再生成は未実施（DB起動前提）。
