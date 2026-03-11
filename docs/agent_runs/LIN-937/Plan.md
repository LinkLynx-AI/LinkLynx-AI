# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まず修正する。
- Scope lock: LIN-937 は message usecase 配線に限定し、DM / edit / delete / WS fanout は触らない。
- Start mode: child issue start (`LIN-937` under `LIN-935`).
- Branch: `codex/lin-937`

## Milestones
### M1: run memory と message crate 境界を追加する
- Acceptance criteria:
  - [ ] `docs/agent_runs/LIN-937/` の 4 ファイルを作成
  - [ ] message domain / platform crate が workspace member として解決される
- Validation:
  - `cd rust && cargo test -p linklynx_message_domain`

### M2: Scylla adapter / Postgres metadata repository / usecase を実装する
- Acceptance criteria:
  - [ ] append / list が port 経由で実行できる
  - [ ] `channel_last_message` 更新境界が monotonic に固定される
  - [ ] bucket / cursor / tombstone の扱いが helper と test で固定される
- Validation:
  - `cd rust && cargo test -p linklynx_message_domain -p linklynx_platform_scylla_message -p linklynx_platform_postgres_message`

### M3: apps/api を runtime service へ差し替える
- Acceptance criteria:
  - [ ] guild message list/create handler が fixture を使わない
  - [ ] Scylla / Postgres 未初期化時は fail-close の unavailable service になる
  - [ ] main tests で contract payload と error mapping を維持する
- Validation:
  - `cd rust && cargo test -p linklynx_backend list_channel_messages`
  - `cd rust && cargo test -p linklynx_backend create_channel_message`

### M4: 全体検証と review gate を通す
- Acceptance criteria:
  - [ ] `make rust-lint` が通る
  - [ ] `make validate` が通る
  - [ ] reviewer gate の blocking finding が解消される
- Validation:
  - `make rust-lint`
  - `make validate`
