# Documentation.md (Status / audit log)

## Current status
- Now:
  - `origin/main` を基点に `codex/LIN-941-channel-category-contract` を作成済み。
  - `LIN-940` 親計画に基づく最初の child issue として、DB/AuthZ/API contract 差分を docs + migration + schema snapshot に固定した。
  - `0017_lin941_channel_category_contract` で `channel_type.guild_category`、category-child parent scope、guild-scoped index/constraint 更新を定義した。
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
- 2026-03-08: `make db-migrate` は `/bin/sh: sqlx: command not found` で失敗
- 2026-03-08: `make db-schema` は `service "postgres" is not running` で失敗
- 2026-03-08: `make db-schema-check` は `service "postgres" is not running` で失敗

## Review log
- 2026-03-08: manual blocking review を実施し、migration/schema consistency の修正後は blocking finding なし
- 2026-03-08: UI review は skip。理由: `LIN-941` の差分は docs / migration / schema snapshot のみで UI 変更を含まない
- 2026-03-08: `reviewer` / `reviewer_ui_guard` の自動実行はこの session で安定しなかったため、manual fallback を採用

## Known issues / follow-ups
- `LIN-942` で service / SQL / HTTP route を category-aware に拡張し、invalid parent / cross-guild parent / category message deny を実装する必要がある。
- `LIN-943` で `GuildChannelAPIClient`、sidebar、create/edit/delete 導線、category 非遷移、cascade delete 後フォールバックを接続する必要がある。
- DB 系 validation を再実行するには、`sqlx` CLI の用意と `postgres` service 起動が必要。
