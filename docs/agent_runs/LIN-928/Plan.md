# LIN-928 Plan

## Rules
- Stop-and-fix: validation が落ちたら次の工程へ進む前に修正する。

## Milestones
### M1: API 契約差分を固定する
- Acceptance criteria:
  - [x] moderation report list の filter/paging 契約が確定している
  - [x] 既存 detail/create/resolve/reopen/mute との境界が整理されている
- Validation:
  - `rg -n "moderation/reports|page_info|next_after|status" rust/apps/api/src typescript/src`

### M2: Rust backend を実装する
- Acceptance criteria:
  - [x] report list handler が `status/limit/after` を検証できる
  - [x] service / postgres 実装が filter/paging を返せる
  - [x] detail API 契約が維持される
- Validation:
  - `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
  - `cd rust && cargo test -p linklynx_backend main::tests::list_moderation_reports -- --nocapture`

### M3: TypeScript 契約と追従テストを更新する
- Acceptance criteria:
  - [x] API client / hooks が additive response を扱える
  - [x] 既存 moderation UI が回帰しない
- Validation:
  - `cd typescript && npm run typecheck`
  - `cd typescript && pnpm test -- moderation`
