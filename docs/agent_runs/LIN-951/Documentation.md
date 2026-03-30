# Documentation

## Current status
- Now: backend API 実装と handler テスト、validation が完了しており、child PR 化の evidence を整理している
- Next: `git diff --check` と review/smoke evidence を確定して commit / PR / Linear 更新へ進む

## Decisions
- role/member/permission 管理 API は既存 `user_directory` 境界を拡張して実装する。
- invalidation / tuple sync は既存 event kind / event type を再利用する。
- write は Postgres transaction で完結させ、tuple sync 用 outbox event は transaction 内で追加する。
- AuthZ cache invalidation は handler 成功後に `state.authorizer.invalidate_cache(...)` で行い、DB service は DB write と event 生成に責務を限定する。
- backend の canonical system role key は `member` を維持し、UI alias の `@everyone` は `LIN-953` 側で扱う。

## How to run / demo
- Validation:
  - `cargo test -p linklynx_backend -- --nocapture` : pass
  - `make rust-lint` : pass
  - `cd typescript && npm run typecheck` : pass
  - `make validate` : pass
- Runtime smoke:
  - backend API 変更であり UI 変更を含まないため、`make dev` / Playwright の end-to-end smoke は child issue `LIN-954` の統合回帰で実施する。

## Known issues / follow-ups
- request-time AuthZ 実接続は `LIN-952`
- frontend 接続は `LIN-953`
- end-to-end 回帰整理は `LIN-954`
- Postgres write path は compile/validation と handler テストで担保しており、専用 DB integration test の厚みは今後の回帰で強化余地がある。
