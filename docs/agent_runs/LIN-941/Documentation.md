# Documentation.md (Status / audit log)

## Current status
- Now:
  - `origin/main` を基点に `codex/LIN-941-channel-category-contract` を作成済み。
  - `LIN-940` 親計画に基づく最初の child issue として、DB/AuthZ/API contract 差分を docs + migration + schema snapshot に固定した。
  - `0017_lin941_channel_category_contract` と `0018_lin941_channel_category_constraints` に分割し、enum 追加と constraint/trigger/index 更新の transaction 境界を分離した。
  - `LIN-942`/`LIN-943` へ跨る runtime/UI 差分はこの branch から外し、後続 child issue へ分離した。
- Next:
  - reviewer gate と UI guard の証跡を追加する。
  - merge step 完了後に `LIN-942` branch へ移り、runtime 実装を再開する。

## Decisions
- category representation は `channel_type` への additive 追加（`guild_category`）で固定する。
- category は非 messageable container とし、`guild_text` のみ message target とする。
- v1 では channel reparent を扱わず、親指定は create 時のみとする。
- category delete は child channel を含む cascade delete とする。
- `LIN-941` では runtime 完了を持たず、docs/migration/schema の contract fix と後続 handoff を成果物とする。

## API contract handoff
- `GET /guilds/{guild_id}/channels`
  - response item は少なくとも `channel_id`, `guild_id`, `type`, `name`, `parent_id`, `position`, `created_at` を返す。
  - `type` は v1 で `guild_text | guild_category` を扱う。
- `POST /guilds/{guild_id}/channels`
  - request は少なくとも `{ "name": string, "type"?: "guild_text" | "guild_category", "parent_id"?: number | null }` を受ける。
  - `type` 未指定時は `guild_text` 扱いとする。
  - `guild_category` 作成時の `parent_id` は reject する。
- `PATCH /channels/{channel_id}`
  - v1 では rename のみ扱い、request は `{ "name": string }` とする。
  - reparent は後続 issue の scope 外とする。
- `DELETE /channels/{channel_id}`
  - `guild_text` / `guild_category` の両方を対象とする。
  - `guild_category` 削除時は配下 child channel も cascade delete する。
- validation / reject policy
  - invalid parent, parent not found, parent not category, cross-guild parent, nested category, category message target は fail-close で reject する。

## How to run / demo
- 1. `make db-migrate`
- 2. `make db-schema`
- 3. `make db-schema-check`
- 4. `make rust-lint`
- 5. `cd typescript && npm run typecheck`

## Validation log
- 2026-03-08: `make validate` 成功
- 2026-03-08: `make rust-lint` 成功
- 2026-03-08: `cd typescript && npm run typecheck` 成功
- 2026-03-08: `make db-migrate` は当初 `/bin/sh: sqlx: command not found` で失敗したが、`/Users/reiya.mac/.cargo/bin/sqlx` を PATH に追加して再実行可能化した
- 2026-03-08: local Postgres に対する `sqlx migrate run` で `unsafe use of new value "guild_category" of enum type channel_type` を検出し、`0017` を enum-only migration に縮小して `0018` へ残差分を分離した
- 2026-03-08: `/bin/zsh -lc 'export PATH=/Users/reiya.mac/.cargo/bin:$PATH; make db-migrate'` 成功
- 2026-03-08: `/bin/zsh -lc 'POSTGRES_DUMP_CMD="docker exec tmp-postgres-1 pg_dump -U postgres -d linklynx --schema-only --no-owner --no-privileges --exclude-table=_sqlx_migrations" make db-schema'` 成功
- 2026-03-08: `/bin/zsh -lc 'POSTGRES_DUMP_CMD="docker exec tmp-postgres-1 pg_dump -U postgres -d linklynx --schema-only --no-owner --no-privileges --exclude-table=_sqlx_migrations" make db-schema-check'` 成功

## Review log
- 2026-03-08: reviewer fallback で `db-migrate` / `db-schema` / `db-schema-check` の成功証跡不足が block 指摘として上がった
- 2026-03-08: 上記 block に対し migration 分割 (`0017` + `0018`) と live DB 検証を実施し、再レビュー待ち状態へ更新した
- 2026-03-08: UI review は skip。理由: `LIN-941` の差分は docs / migration / schema snapshot のみで UI 変更を含まない
- 2026-03-08: `reviewer` / `reviewer_ui_guard` の自動実行はこの session で安定しなかったため、manual fallback を採用

## Known issues / follow-ups
- `LIN-942` で service / SQL / HTTP route を category-aware に拡張し、invalid parent / cross-guild parent / category message deny を実装する必要がある。
- `LIN-943` で `GuildChannelAPIClient`、sidebar、create/edit/delete 導線、category 非遷移、cascade delete 後フォールバックを接続する必要がある。
- default の `make db-schema*` は compose service `postgres` を前提にする。今回は既存 local container `tmp-postgres-1` を `POSTGRES_DUMP_CMD` で差し替えて検証した。
