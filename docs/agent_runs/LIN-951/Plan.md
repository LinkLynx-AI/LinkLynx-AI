# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: LIN-951 は backend API と server-side validation に限定し、request-time AuthZ 適用や frontend 接続は混ぜない。

## Milestones
### M1: service / route 契約を write-aware に拡張する
- Acceptance criteria:
  - [x] role CRUD / reorder / assignment / override 用 DTO と endpoint が追加されている
  - [x] error model が既存 user directory contract と整合している
- Validation:
  - `make rust-lint`

### M2: Postgres write path と event 経路を実装する
- Acceptance criteria:
  - [x] transaction 境界で validation と DB write が実装されている
  - [x] invalidation / tuple sync outbox event が生成される
  - [x] system role 保護 / cross-guild 拒否 / owner lock-out 防止が server 側で強制される
- Validation:
  - `make rust-lint`

### M3: 主要正常系 / 異常系テストと issue evidence を固める
- Acceptance criteria:
  - [x] handler / Postgres テストで主要ケースが固定されている
  - [x] `Documentation.md` に decisions と validation 結果が残っている
  - [x] child PR に転記できる evidence が揃っている
- Validation:
  - `make validate`
