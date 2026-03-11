# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: Rust profile contract に theme を追加
- Acceptance criteria:
  - [ ] profile service / route payload / postgres query が `theme` を扱う
  - [ ] `dark | light` 以外を validation で拒否する
  - [ ] Rust テストで GET/PATCH 契約を固定する
- Validation:
  - `cd rust && cargo test -p linklynx_backend --locked profile::tests`
  - `cd rust && cargo test -p linklynx_backend --locked my_profile`

### M2: TypeScript API client 契約に theme を追加
- Acceptance criteria:
  - [ ] API 型 / zod schema / mapper / PATCH body が `theme` を扱う
  - [ ] mock / no-data client 契約が揃う
  - [ ] TypeScript テストで read/write 契約を固定する
- Validation:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts src/shared/model/stores/settings-store.test.ts`
  - `cd typescript && npm run typecheck`

### M3: 品質ゲートと run evidence を揃える
- Acceptance criteria:
  - [ ] `make rust-lint` / `make validate` の結果を記録する
  - [ ] reviewer gate 結果を記録する
  - [ ] runtime smoke 実施または skip rationale を記録する
- Validation:
  - `make rust-lint`
  - `make validate`
