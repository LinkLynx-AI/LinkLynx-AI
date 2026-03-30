# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: LIN-950 は contract/doc 整理に限定し、backend/frontend 実装は `LIN-951` 以降へ送る。
- Start mode: child issue start (`LIN-950` under `LIN-949`)。

## Milestones
### M1: v2 server role / channel permission / AuthZ 最小契約を定義する
- Acceptance criteria:
  - [x] role metadata scope と `@everyone` 方針が固定されている
  - [x] planned REST family と request/response の基準がある
  - [x] system role 保護と owner lock-out 防止条件が明文化されている
- Validation:
  - `make validate`

### M2: 既存 SSOT docs に downstream 向け参照を追加する
- Acceptance criteria:
  - [x] `docs/AUTHZ.md` が LIN-950 baseline を参照している
  - [x] `docs/AUTHZ_API_MATRIX.md` に planned endpoint/action mapping がある
  - [x] `docs/DATABASE.md` が新 contract を参照している
- Validation:
  - `make validate`

### M3: issue run 記録と review evidence を固める
- Acceptance criteria:
  - [x] `Documentation.md` に decisions と validation 結果が残っている
  - [x] review gate の blocking finding がない
  - [x] child issue evidence を PR に転記できる状態である
- Validation:
  - `make validate`
