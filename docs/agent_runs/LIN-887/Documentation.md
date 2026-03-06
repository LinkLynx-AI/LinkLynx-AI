# Documentation.md (Status / audit log)

## Current status
- Now: 実装・検証完了、review gate 待ち。
- Next: review 反映後にコミットと PR 作成。

## Decisions
- Start mode は child issue start とする。
- Parent は `LIN-793`、leaf issue は `LIN-887`。
- 変更範囲は `guild create` bootstrap とその回帰テストに限定する。
- `create_guild` SQL を定数化し、旧スキーマ参照の有無をテストで検知できる形にした。
- system role seed は `database/postgres/seed.sql` と同じ `owner/admin/member` + `priority` + `allow_manage` + `is_system=true` に揃えた。

## How to run / demo
1. `make validate`
2. runtime smoke:
   - `make dev` を実行する
   - `curl -i -sS http://127.0.0.1:8080/health`
   - `curl -i -sS http://127.0.0.1:8080/guilds`
   - `curl -i -sS -X POST http://127.0.0.1:8080/guilds -H 'content-type: application/json' -d '{"name":"Smoke Guild"}'`

## Validation evidence
- `cd rust && cargo test -p linklynx_backend 'guild_channel::tests::' -- --nocapture`: pass
- `make rust-lint`: pass
  - sandbox では localhost bind を使う authz runtime test が `PermissionDenied` で失敗したため、昇格環境で再実行して pass を確認
- `make validate`: pass
  - 初回は `typescript/node_modules` 未導入で失敗
  - `pnpm -C typescript install --frozen-lockfile` 実行後、昇格環境で再実行して pass を確認

## Review gate evidence
- reviewer_ui_guard: `run_ui_checks: false`
  - rationale: backend-only diff (`rust/apps/api/src/guild_channel/*` + run docs only)
- reviewer_ui: skipped
  - rationale: UI diff なし
- reviewer: pass
  - blocking findings: なし
  - note: specialist reviewer の一部は起動失敗/割り込みで結果なしだったが、meta reviewer 自身の差分レビューでは P1+ 指摘なし

## Known issues / follow-ups
- runtime smoke で `make dev` は Rust API の `:8080` 既存 listener に衝突した。
- 既存 `linklynx_backend` listener に対する最小アクセス確認では以下を確認した。
  - `GET /health` => `200 OK`
  - `GET /guilds` => `401 AUTH_MISSING_TOKEN`
  - `POST /guilds` => `401 AUTH_MISSING_TOKEN`
  - `GET /guilds/2001/channels` => `401 AUTH_MISSING_TOKEN`
- Playwright smoke は backend-only diff のため skipped。
