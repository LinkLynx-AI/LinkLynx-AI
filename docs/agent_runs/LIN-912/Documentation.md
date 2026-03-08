# Documentation.md (Status / audit log)

## Current status
- Now: PR `#1133` は 2026-03-08 に latest `origin/main` を再取り込みし、conflict 解消と targeted validation を再実施済み。
- Next: 更新済み branch の PR check / human review を待てる状態。

## Decisions
- `POST /v1/invites/:invite_code/join` を追加し、AuthN 必須 / AuthZ 除外の明示例外として扱う。
- ADR-004 の例外ポリシーに招待参加 endpoint を追記し、AUTHZ API matrix も更新する。
- invite join は Postgres 1 statement の CTE で実装し、`guild_members` / `guild_member_roles_v2` / `invite_uses` / `invites.uses` をまとめて整合させる。
- duplicate join は `already_member` success に倒し、invite が disabled / expired / maxed-out でも既存 membership を持つ主体は異常終了させない。
- invite 使用数は新規 membership を挿入できたときだけ加算し、既存 member への重複 join では増やさない。
- review follow-up として、join handler の degraded fail-close 回帰テスト、principal-scoped rate-limit 回帰テスト、SQL の二重加算ガード assertion を追加した。
- review blocker 解消のため、`JOIN_INVITE_SQL` を現行 migration 済み Postgres schema に対して実行する integration test を追加し、CI の `db-schema-check` job でも常時実行する。

## How to run / demo
- `cargo test -p linklynx_backend invite`
- `cargo test -p linklynx_backend public_invite_join`
- `cargo test -p linklynx_backend scylla_health_`
- `cargo test -p linklynx_backend -- --nocapture`
- `docker compose down -v && docker compose up -d postgres && ... && INVITE_POSTGRES_INTEGRATION=true cargo test -p linklynx_backend postgres_join_invite_integration_ -- --nocapture`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`
- `curl -X POST /v1/invites/{invite_code}/join -H 'Authorization: Bearer <token>'`
- success: `join.status = joined | already_member`
- reject: `INVITE_INVALID` / `INVITE_EXPIRED` / `INVITE_UNAVAILABLE`

## Known issues / follow-ups
- PR: `https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1133`
- `LIN-913` で未認証復帰と参加後遷移を閉じる。
- TypeScript test の `act(...)` warning と verify-email の想定 error log は既存ノイズとして継続。

## Review notes
- 2026-03-08 branch repair では latest `origin/main` を再 merge し、以下の競合を解消した。
  - `docs/AUTHZ_API_MATRIX.md`: public invite verify / invite join / scylla health を併存。
  - `rust/apps/api/src/main/http_routes.rs`: invite join route と scylla health route を同時に保持。
- reviewer gate:
  - `reviewer_simple`: pass（blocking finding なし）
  - `reviewer_ui_guard`: UI review required（`typescript/src/features/auth-flow/ui/password-reset-form.tsx` を含む main 取り込み差分を検知）
  - `reviewer_ui`: pass（concrete finding なし）
