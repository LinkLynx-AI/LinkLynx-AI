# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation か review で失敗したら修正してから進む。
- Scope lock: `LIN-917` は reply / pin / reaction の接続状態整理に限定する。

## Milestones
### M1: 未接続 API と UI 導線を明示する
- Acceptance criteria:
  - [ ] concrete API client で pin / reaction 系メソッドが未実装のまま落ちない
  - [ ] message hover / context menu から未接続操作が正しく案内される
- Validation:
  - `cd typescript && npm run test -- message-context-menu message`

### M2: fake modal / panel 表示を状態説明へ置き換える
- Acceptance criteria:
  - [ ] pin confirm modal が fake preview を表示しない
  - [ ] reaction detail modal が mock user 一覧を表示しない
  - [ ] pinned panel が未接続状態を明示する
- Validation:
  - `cd typescript && npm run typecheck`

### M3: 記録と全体検証を残す
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-917/` が埋まっている
  - [ ] `make setup` 後の required validation 結果を Documentation.md に残す
- Validation:
  - `make setup`
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
  - `make db-schema-check`
