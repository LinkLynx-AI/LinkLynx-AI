# Documentation.md (Status / audit log)

## Current status
- Now: LIN-912 の実装・validation・PR 作成まで完了。残りは merge 待ち。
- Next: LIN-913 の未認証復帰と参加後遷移に着手する。

## Decisions
- `POST /v1/invites/:invite_code/join` を追加し、AuthN 必須 / AuthZ 除外の明示例外として扱う。
- ADR-004 の例外ポリシーに招待参加 endpoint を追記し、AUTHZ API matrix も更新する。
- invite join は Postgres 1 statement の CTE で実装し、`guild_members` / `guild_member_roles_v2` / `invite_uses` / `invites.uses` をまとめて整合させる。
- duplicate join は `already_member` success に倒し、invite が disabled / expired / maxed-out でも既存 membership を持つ主体は異常終了させない。
- invite 使用数は新規 membership を挿入できたときだけ加算し、既存 member への重複 join では増やさない。

## How to run / demo
- `cargo test -p linklynx_backend invite`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`
- `curl -X POST /v1/invites/{invite_code}/join -H 'Authorization: Bearer <token>'`
- success: `join.status = joined | already_member`
- reject: `INVITE_INVALID` / `INVITE_EXPIRED` / `INVITE_UNAVAILABLE`
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1133

## Known issues / follow-ups
- `LIN-913` で未認証復帰と参加後遷移を閉じる。
