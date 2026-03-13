# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: 既存契約と実装前提の棚卸し
- Acceptance criteria:
  - [x] `LIN-940` / `LIN-941` / `LIN-634` と現行 backend/frontend のギャップ確認
  - [x] category representation / delete semantics / v1 scope を固定
  - [x] 変更対象 doc / code path を確定
- Validation:
  - `git log --oneline -n 1 origin/main`
  - `rg -n "channel_hierarch|GUILD_CATEGORY|parentId|GuildChannel" rust typescript docs database`

### M2: DB / API / AuthZ 契約の実装
- Acceptance criteria:
  - [x] `guild_category` を含む DB 契約差分を追加
  - [x] `0018_lin941_channel_category_contract` migration と `schema.sql` の整合を取る
  - [x] AuthZ docs と API inventory が category 前提へ更新されている
- Validation:
  - `make db-migrate`
  - `make db-schema`
  - `make db-schema-check`
  - `make rust-lint`

### M3: 回帰テストと handoff 整備
- Acceptance criteria:
  - [x] `LIN-942` / `LIN-943` 向けの未実装範囲を Documentation.md に明記
  - [x] validation 結果と blocker を Documentation.md に記録
  - [ ] PR 用 evidence を整理
- Validation:
  - `make validate`
  - `cd typescript && npm run typecheck`

### M4: Review gate
- Acceptance criteria:
  - [x] reviewer gate 実施（manual fallback）
  - [x] UI guard 実施（UI diff なし）
  - [x] 必要時 UI review 実施（skip: no UI changes）
- Validation:
  - `spawn_agent(reviewer)`
  - `spawn_agent(reviewer_ui_guard)`
