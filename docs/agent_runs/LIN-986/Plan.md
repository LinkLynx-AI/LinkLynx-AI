# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: identify rate-limit key を principal/session 単位へ置き換える
- Acceptance criteria:
  - [ ] active ticket は principal 単位の key を使う
  - [ ] principal を引けないケースは session 単位へ落とし、origin 共有 bucket を使わない
  - [ ] reject log に key source を残す
- Validation:
  - `cd rust && cargo test -p linklynx_backend ws_identify_ -- --nocapture`
  - `cd rust && cargo test -p linklynx_backend parse_identify_payload_ -- --nocapture`

### M2: docs と runtime smoke を固める
- Acceptance criteria:
  - [ ] auth runbook / matrix / run memory が key source と close 契約を説明する
  - [ ] runtime smoke または explicit skip rationale が残る
- Validation:
  - `make rust-lint`
  - `git diff --check`
  - `make validate`
  - `cd typescript && npm run typecheck`
