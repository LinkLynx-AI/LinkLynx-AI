# Documentation

## Current status
- Now: LIN-978 の実装と主要検証は完了。
- Next: PR 向けに最終検証と evidence を整理する。

## Decisions
- `PATCH /v1/moderation/guilds/{guild_id}/members/{member_id}` は v1 最小として `mute` のみ扱う。
- request body は `reason` と `expires_at` を受ける。
- 対象 member は guild membership で存在確認する。
- guild 自体が存在しない場合は `guild_not_found`、guild は存在するが対象 member が未所属の場合は `member_not_found` を返す。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
- `make rust-lint`

## Known issues / follow-ups
- `ban` / `unmute` は本 issue では扱わない。

## Validation log
- `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
  - pass
  - PATCH success / 404 / 503 / AuthZ / rate-limit 回帰を含む
- `cargo fmt --all`
  - pass
- `make rust-lint`
  - pass
  - workspace clippy / workspace tests を完走
- `git diff --check`
  - pass
- `MODERATION_POSTGRES_INTEGRATION=1 cargo test -p linklynx_backend moderation::tests::ensure_target_member_exists -- --nocapture`
  - not run
  - optional integration gate として追加済みだが、この run では `MODERATION_POSTGRES_INTEGRATION` を有効化していない

## Review gate
- `reviewer_simple`
  - pass
  - no blocking findings
  - follow-up 指摘だった `guild_not_found` / `member_not_found` のドキュメント差分と Postgres integration coverage を反映済み

## Runtime smoke
- 未実施
- skip rationale:
  - 今回の差分は backend の moderation PATCH 接続とテスト更新に限定される
  - live smoke には `make dev` ベースの compose 起動と手動 API 疎通が必要
  - 代替として moderation targeted tests と workspace lint/test を実施した
