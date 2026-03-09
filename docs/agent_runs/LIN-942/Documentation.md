# Documentation.md (Status / audit log)

## Current status
- Now:
  - branch `codex/LIN-942-channel-category-backend-clean` で reviewer 指摘の backend 修正まで反映済み。
  - category-aware service / SQL / route / tests と review fix の証跡が揃った。
- Next:
  - review fix と memory 更新を commit し、stacked PR を作成する。
  - その後 `LIN-943` へ進む。

## Validation log
- 2026-03-08: `cargo test -p linklynx_backend --no-run` 成功
- 2026-03-08: `make rust-lint` 成功
- 2026-03-09: `make rust-lint` 成功（Rust backend `261 passed`）
- 2026-03-09: `cd typescript && npm run typecheck` 成功
- 2026-03-09: `make validate` 成功

## Runtime smoke
- sandbox 内の `make rust-dev` は listener / Scylla 接続で `Operation not permitted` となり失敗
- sandbox 外の `/bin/zsh -lc 'AUTHZ_PROVIDER=spicedb make rust-dev'` は起動成功
- `GET /health` -> `200 OK`
- `GET /` -> `200 LinkLynx API Server`
- `GET /guilds/2001/channels` without token -> `401 AUTH_MISSING_TOKEN`
- `GET /v1/guilds/2001/channels/3001/messages` without token -> `401 AUTH_MISSING_TOKEN`
- limits:
  - local auth token を使った category create/message deny の実リクエストまでは未実施
  - category-specific behavior は Rust integration test を primary evidence とした
  - Playwright smoke は backend-only 差分のため skip

## Review gates
- `reviewer_ui_guard`: pass
  - UI 変更なし。対象差分は Rust backend と build artifact cleanup のみ
- `reviewer_ui`: skip
  - UI guard が false のため未実施
- `reviewer`: pass
  - fast-path SQL の manage 判定を `owner/admin` 固定から `allow_manage = TRUE` へ修正
  - category message target の deny を `403 AUTHZ_DENIED` に統一

## Delivery
- Branch: `codex/LIN-942-channel-category-backend-clean`
- Commit: `61e1cd4`（backend 本体） + pending review-fix commit
- PR URL: pending
- PR base branch: `codex/LIN-941-channel-category-contract`（planned stacked base）
- Merge policy: non-`main` base のため、PR 作成後は validation / review gate pass を確認して auto-merge 対象

## Follow-ups
- `LIN-943` で `GuildChannelAPIClient` と sidebar/create/delete 導線を backend DTO に接続する必要がある。
