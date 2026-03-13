# Documentation

## Current status
- Now: LIN-979 の実装と検証は完了。
- Next: reviewer gate の最終結果を反映して PR を作成する。

## Decisions
- moderation / permission-snapshot / DM を横断する reject log scope は REST path から抽出する。
- moderation PATCH は AuthZ 上 `Guild + Manage`、rate-limit 上 `ModerationAction` の high-risk fail-close として扱う。
- reject log は `reason`、`principal_id`、`guild_id` を必須にし、取得できる場合は `channel_id` も残す。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
- `cd rust && cargo test -p linklynx_backend rest_request_scope_maps_moderation_permission_snapshot_and_dm_paths -- --nocapture`
- `make rust-lint`

## Known issues / follow-ups
- moderation PATCH の実処理接続自体は `LIN-978` の責務。
- runtime smoke は API 実装変更が middleware/logging 中心のため、今回は skip 候補。

## Validation log
- `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
  - pass
  - moderation route の AuthZ / rate-limit / scope helper 回帰を含む
- `cd rust && cargo test -p linklynx_backend rest_request_scope_maps_moderation_permission_snapshot_and_dm_paths -- --nocapture`
  - pass
- `make rust-lint`
  - pass
- `make validate`
  - pass
  - Python の `m` コマンド未導入による `Error 127 (ignored)` は既存 `python/Makefile` 由来で今回差分起因ではない
- `git diff --check`
  - pass

## Review gate
- `reviewer_simple`
  - pending

## Runtime smoke
- 未実施
- skip rationale:
  - 差分は shared REST middleware の logging scope と文書更新に限定される
  - 代替として moderation targeted tests と workspace validation を実施した
