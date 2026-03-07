# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: ActionGuard 契約を追加する
- Acceptance criteria:
  - [ ] permission snapshot を `allowed | forbidden | unavailable | loading` に正規化する共通層がある。
  - [ ] guild/channel/moderation 用の requirement が固定されている。
- Validation:
  - `cd typescript && npm run typecheck`

### M2: 対象 UI に guard を適用する
- Acceptance criteria:
  - [ ] context menu / hover actions / modals / settings / moderation が fail-close で guard される。
  - [ ] invite 作成導線が disabled になり modal を開かない。
- Validation:
  - `cd typescript && npm run typecheck`

### M3: テストと docs を揃える
- Acceptance criteria:
  - [ ] 主要 UI の guard 回帰テストが追加・更新されている。
  - [ ] `docs/AUTHZ.md` と run memory が最新になっている。
- Validation:
  - `make rust-lint`
  - `make validate`

### M4: レビューと PR 準備
- Acceptance criteria:
  - [ ] reviewer / UI review の結果が反映されている。
  - [ ] runtime smoke の証跡がある。
  - [ ] `main` 向け PR が作成されている。
- Validation:
  - review gates
