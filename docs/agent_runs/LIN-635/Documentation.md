# LIN-635 Documentation Log

## Status
- Implementation completed (reply reference + pin state persistence schema).
- PR repair in progress: merged latest `main` into the branch to remove stale parent-branch drift from the PR diff.
- PR repair follow-up in progress: add CI coverage for `make db-schema-check`.

## Scope
- Added migration:
  - `database/postgres/migrations/0012_lin635_message_reply_pin_persistence.up.sql`
  - `database/postgres/migrations/0012_lin635_message_reply_pin_persistence.down.sql`
- Added contract:
  - `database/contracts/lin635_message_reply_pin_persistence_contract.md`
- Updated references:
  - `docs/DATABASE.md`
- Updated CI:
  - `.github/workflows/ci.yml` に `DB Schema Check` job を追加し、Postgres 起動 -> `database/postgres/migrations/*.up.sql` 適用 -> `make db-schema-check` を自動実行

## Validation results
- Historical branch record before PR repair:
  - `make db-migrate`: passed（`0012`適用成功）。
  - `make db-schema`: passed（`POSTGRES_DUMP_CMD` を `docker run ... pg_dump -h host.docker.internal` へ上書きして実行）。
  - `make db-schema-check`: passed（上記と同じ `POSTGRES_DUMP_CMD` 上書き）。
  - `make gen`: passed。
  - `make validate`: passed。
- PR repair re-validation on 2026-03-06:
  - `make validate`: passed（`typescript` の `CI=true pnpm i` と `python` の `make install-dev` 実行後）。
  - `make gen`: passed。
  - `make db-migrate`: blocked。latest `main` 取り込み後、`sqlx migrate run` が `migration 8 was previously applied but has been modified` を返した。
  - `make db-schema`: blocked。既定 `POSTGRES_DUMP_CMD` が `docker compose` を経由し、`NEXT_PUBLIC_FIREBASE_PROJECT_ID` 未設定で失敗した。
  - `make db-schema-check`: skipped（`make db-schema` の既定経路がこの環境で再現できなかったため）。
- PR repair follow-up on 2026-03-07:
  - initial CI draft using `make db-migrate` was rejected after local verification because current migration numbering has duplicate versions and `sqlx migrate run` fails on a clean DB.
  - updated CI path: `docker compose up -d postgres` -> apply `database/postgres/migrations/*.up.sql` in sorted order -> `make db-schema-check`
  - local re-validation: passed with isolated container `lin635-db-schema-check`
  - executed commands:
    - `find database/postgres/migrations -name '*.up.sql' | sort` を順に `psql` 適用
    - `POSTGRES_DUMP_CMD='docker exec lin635-db-schema-check pg_dump ...' make db-schema`
    - `POSTGRES_DUMP_CMD='docker exec lin635-db-schema-check pg_dump ...' make db-schema-check`

## Data checks
- SQL verification (transaction rollback) result:
  - `reply_absent:0`（返信なしパスは `message_references_v2` 行なし）
  - `reply_row:93001,3001,92001`（返信参照の保存確認）
  - `pin_row:3001,92001,true,true,true`（`pinned_by`/`unpinned_by`/`unpinned_at` の監査列更新確認）

## Review results
- `reviewer_simple` / `reviewer_ui_guard` / `reviewer_ui`: unavailable in current execution environment.
- Manual self-review: stale PR diffを current `main` に合わせて再整形し、blocking issue はなし。

## Per-issue evidence (LIN-635)
- issue: `LIN-635`
- branch: `codex/LIN-635-message-reference-pin-persistence`
- reviewer gate: unavailable (manual self-review fallback)
- UI gate: skipped (UI changesなし)
- repair action: merged latest `main` into the branch and resolved `schema.sql` / `docs/DATABASE.md` / generated artifact conflicts
- planned PR base branch: `main`
