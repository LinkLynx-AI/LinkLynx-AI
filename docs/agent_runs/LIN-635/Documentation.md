# LIN-635 Documentation Log

## Status
- Implementation completed (reply reference + pin state persistence schema).

## Scope
- Added migration:
  - `database/postgres/migrations/0012_lin635_message_reply_pin_persistence.up.sql`
  - `database/postgres/migrations/0012_lin635_message_reply_pin_persistence.down.sql`
- Added contract:
  - `database/contracts/lin635_message_reply_pin_persistence_contract.md`
- Updated references:
  - `docs/DATABASE.md`

## Validation results
- `make db-migrate`: passed（`0012`適用成功）。
- `make db-schema`: passed（`POSTGRES_DUMP_CMD` を `docker run ... pg_dump -h host.docker.internal` へ上書きして実行）。
- `make db-schema-check`: passed（上記と同じ `POSTGRES_DUMP_CMD` 上書き）。
- `make gen`: passed。
- `make validate`: passed。

## Data checks
- SQL verification (transaction rollback) result:
  - `reply_absent:0`（返信なしパスは `message_references_v2` 行なし）
  - `reply_row:93001,3001,92001`（返信参照の保存確認）
  - `pin_row:3001,92001,true,true,true`（`pinned_by`/`unpinned_by`/`unpinned_at` の監査列更新確認）

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: no blocking issues found in changed scope.

## Per-issue evidence (LIN-635)
- issue: `LIN-635`
- branch: `codex/LIN-635-message-reference-pin-persistence`
- reviewer gate: unavailable (manual self-review fallback)
- UI gate: skipped (UI changesなし)
- planned PR base branch: `codex/LIN-857-drop-legacy-permission-assets`
