# LIN-636 Documentation Log

## Status
- Implementation completed (message reaction persistence schema).
- PR repair completed: merged latest `codex/LIN-635-message-reference-pin-persistence` into the branch to inherit the parent-branch diff repair.

## Scope
- Added migration:
  - `database/postgres/migrations/0013_lin636_message_reaction_persistence.up.sql`
  - `database/postgres/migrations/0013_lin636_message_reaction_persistence.down.sql`
- Added contract:
  - `database/contracts/lin636_message_reaction_persistence_contract.md`
- Updated references:
  - `docs/DATABASE.md`

## Validation results
- Historical branch record before PR repair:
  - `make db-migrate`: passed（`0013`適用成功）。
  - `make db-schema`: passed（`POSTGRES_DUMP_CMD` を `docker run ... pg_dump -h host.docker.internal` へ上書きして実行）。
  - `make db-schema-check`: passed（上記と同じ `POSTGRES_DUMP_CMD` 上書き）。
  - `make gen`: passed。
  - `make validate`: passed。
- PR repair re-validation on 2026-03-06:
  - `make validate`: passed。

## Data checks
- idempotent add/remove check（transaction rollback）:
  - 2回目 `INSERT ... ON CONFLICT DO NOTHING` が `INSERT 0 0` となることを確認。
  - `after_add_count:1` を確認。
  - 2回目 `DELETE` が `DELETE 0` となることを確認。
  - `after_remove_count:0` を確認。
- duplicate prevention check:
  - 同一 `(message_id, emoji, user_id)` の2回目通常INSERTで以下エラーを確認:
    - `duplicate key value violates unique constraint "message_reactions_v2_pkey"`

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: parent-branch repair取り込み後も blocking issue はなし。

## Per-issue evidence (LIN-636)
- issue: `LIN-636`
- branch: `codex/LIN-636-message-reaction-persistence`
- reviewer gate: unavailable (manual self-review fallback)
- UI gate: skipped (UI changesなし)
- repair action: merged latest `codex/LIN-635-message-reference-pin-persistence` into the branch and resolved generated/docs conflicts by keeping LIN-636 reaction additions
- planned PR base branch: `codex/LIN-635-message-reference-pin-persistence`
