# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation failure は次へ進む前に修正する。

## Milestones
### M1: profile media upload contract に MIME / size guard を追加する
- Acceptance criteria:
  - [ ] backend が allowlist 外 MIME を拒否する
  - [ ] upload request に size 契約が入り、target ごとの上限を超える要求を拒否する
  - [ ] TypeScript client が更新後 contract に追従する
- Validation:
  - `cd rust && cargo test -p linklynx_backend profile_media_ -- --nocapture`
  - `cd rust && cargo test -p linklynx_backend issue_my_profile_media_upload_url_ -- --nocapture`

### M2: contract / runbook / review evidence を固める
- Acceptance criteria:
  - [ ] LIN-939 contract と profile media runbook が MIME / size / orphan cleanup baseline を説明する
  - [ ] run memory に validation / smoke / review 結果が残る
- Validation:
  - `make rust-lint`
  - `git diff --check`
  - `make validate`
  - `cd typescript && npm run typecheck`
