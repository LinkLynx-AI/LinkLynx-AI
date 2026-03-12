# Plan.md (Milestones + validations)

## Milestones
### M1: service / route / SQL 差分の適用
- Acceptance criteria:
  - [x] `ChannelKind`, `CreateChannelInput`, hierarchy-aware `ChannelSummary` を導入
  - [x] create/list/get/update/delete を category-aware に拡張
  - [x] category message target reject を route で固定

### M2: backend 回帰検証
- Acceptance criteria:
  - [x] Rust backend tests が通る
  - [x] `make validate` が通る
  - [x] `make rust-lint` が通る
  - [x] reviewer gate を記録する
  - [x] runtime smoke を記録する

## Validation
- `cargo test -p linklynx_backend --no-run`
- `make rust-lint`
- `cd typescript && npm run typecheck`
- `make validate`
