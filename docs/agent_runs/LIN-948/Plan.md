# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: LIN-948 は guild message create durable idempotency に限定する。
- Start mode: child issue start (`LIN-948` under `LIN-935`)。

## Milestones
### M1: durable idempotency の domain / API 契約を実装する
- Acceptance criteria:
  - [x] `Idempotency-Key` optional header を取り込める
  - [x] `request_id` ベース cache が消えている
  - [x] same key + different payload が validation error になる
- Validation:
  - `cd rust && cargo test -p linklynx_message_domain -p linklynx_backend --no-run`

### M2: Postgres reservation table と repository を実装する
- Acceptance criteria:
  - [x] reservation / completed state を保持する migration がある
  - [x] repository が reserve / complete を提供する
  - [x] `schema.sql` と DB docs が追従する
- Validation:
  - `cd rust && cargo test -p linklynx_platform_postgres_message`

### M3: API regression と全体検証を通す
- Acceptance criteria:
  - [x] 201 / validation / dependency unavailable の回帰がある
  - [x] review gate の blocking finding がない
  - [x] validation 結果を `Documentation.md` に記録する
- Validation:
  - `make rust-lint`
  - `make validate`
