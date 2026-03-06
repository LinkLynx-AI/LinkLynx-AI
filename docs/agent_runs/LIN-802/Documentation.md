# LIN-802 Documentation Log

## Current status
- Now: 実装完了。Rust/TSの主要品質ゲートを通過。
- PR repair completed on 2026-03-06 by merging `origin/main`, resolving inherited conflicts, and re-running the full validation gate.
- Next: `main` 向けPRのため human review 待ちに戻す。
- Current repository traceability note: the moderation migration is now stored as `0016_lin822_minimal_moderation` after 2026-03-07 collision resolution.

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
- Passed: `make validate`（2026-03-06 再実行）。

## Changed artifacts
- Added migration:
  - `database/postgres/migrations/0016_lin822_minimal_moderation.up.sql`
  - `database/postgres/migrations/0016_lin822_minimal_moderation.down.sql`
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
- `database/postgres/generated/*` の再生成は必要に応じて別途実施する。
- Historical references to `0012_lin822_minimal_moderation` were renumbered to `0016_lin822_minimal_moderation` on 2026-03-07 to resolve duplicate `sqlx` migration versions without changing schema intent.
- PR repair action:
  - merged `origin/main` into `codex/lin-802`
  - resolved conflicts in `rust/apps/api/src/main/http_routes.rs`, `rust/apps/api/src/main/tests.rs`, `typescript/src/shared/api/guild-channel-api-client.ts`, `typescript/src/shared/api/mock/mock-api-client.ts`, `typescript/src/shared/api/no-data-api-client.ts`, `typescript/src/shared/config/routes.ts`, `typescript/src/shared/config/routes.test.ts`
