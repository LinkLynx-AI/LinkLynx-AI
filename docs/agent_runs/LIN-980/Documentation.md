# Documentation

## Current status
- Now: LIN-980 の実装と検証は完了。
- Next: PR 向けに evidence を整理する。

## Decisions
- permission-snapshot 監査ログは handler で emit し、`principal_id` / `guild_id` / `channel_id?` を残す。
- non-`v1` path は current FE/client 契約のため維持し、cutover 条件を docs に明記する。
- snapshot response shape や AuthZ policy 自体は変更しない。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend permission_snapshot -- --nocapture`
- `make rust-lint`
- `make validate`

## Known issues / follow-ups
- `v1` alias の追加と client 切替は別 issue。

## Validation log
- `cd rust && cargo test -p linklynx_backend permission_snapshot -- --nocapture`
  - pass
  - success / unavailable / audit field helper 回帰を含む
- `make rust-lint`
  - pass
- `make validate`
  - pass
  - Python の `m` コマンド未導入による `Error 127 (ignored)` は既存 `python/Makefile` 由来で今回差分起因ではない
- `git diff --check`
  - pass

## Review gate
- pending

## Runtime smoke
- 未実施
- skip rationale:
  - 差分は permission-snapshot handler の audit logging と文書更新に限定される
  - 代替として permission-snapshot targeted tests と workspace validation を実施した
