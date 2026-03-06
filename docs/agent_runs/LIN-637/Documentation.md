# LIN-637 Documentation Log

## Status
- Implementation completed (attachment metadata persistence schema).
- PR repair completed on 2026-03-06 by merging the latest `codex/LIN-636-message-reaction-persistence` into this branch and resolving the inherited `docs/DATABASE.md` conflict.

## Scope
- Added migration:
  - `database/postgres/migrations/0014_lin637_attachment_metadata_persistence.up.sql`
  - `database/postgres/migrations/0014_lin637_attachment_metadata_persistence.down.sql`
- Added contract:
  - `database/contracts/lin637_attachment_metadata_persistence_contract.md`
- Updated references:
  - `docs/DATABASE.md`

## Validation results
- `make db-migrate`: passed（`0014`適用成功）。
- `make db-schema`: passed（`POSTGRES_DUMP_CMD` を `docker run ... pg_dump -h host.docker.internal` へ上書きして実行）。
- `make db-schema-check`: passed（上記と同じ `POSTGRES_DUMP_CMD` 上書き）。
- `make gen`: passed。
- `make validate`: passed。
- PR repair re-validation on 2026-03-06: `make validate` passed.

## Data checks
- SQL verification（transaction rollback）:
  - `multi_attachment_count:2`（1メッセージに複数添付を保持）
  - `no_attachment_count:0`（添付なしケースで関連行なし）
  - `logical_delete_flags:true,true`（`deleted_at` / `retention_until` 更新確認）
- object key prefix validation:
  - `invalid/key` のINSERTで `chk_msg_att_v2_object_key_prefix` 制約違反エラーを確認

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: no blocking issues found in changed scope.

## Per-issue evidence (LIN-637)
- issue: `LIN-637`
- branch: `codex/LIN-637-attachment-metadata-persistence`
- reviewer gate: unavailable (manual self-review fallback)
- UI gate: skipped (UI changesなし)
- planned PR base branch: `codex/LIN-636-message-reaction-persistence`
- PR repair action: merged latest `codex/LIN-636-message-reaction-persistence` into this branch and resolved the inherited `docs/DATABASE.md` conflict.
