# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: validation fails must be repaired before moving forward.
- Start mode: child issue start (`LIN-887` under `LIN-793`).
- Branch: `codex/LIN-887-fix-guild-create-v2-bootstrap`.

## Milestones
### M1: guild create bootstrap を v2 スキーマへ揃える
- Acceptance criteria:
  - [x] `create_guild` が `guild_roles_v2` / `guild_member_roles_v2` を使う。
  - [x] owner/admin/member の seed と owner role assignment が current schema 契約に一致する。
- Validation:
  - `cd rust && cargo test -p linklynx_backend guild_channel -- --nocapture`

### M2: 回帰テストを追加して旧スキーマ参照を封じる
- Acceptance criteria:
  - [x] create_guild 用の SQL/挙動テストが追加される。
  - [x] 旧テーブル/型名を参照しないことを確認できる。
- Validation:
  - `cd rust && cargo test -p linklynx_backend guild_channel -- --nocapture`

### M3: delivery gates を通して PR を出す
- Acceptance criteria:
  - [x] `make rust-lint` が通る。
  - [x] `make validate` が通る。
  - [x] required review gates が通る。
  - [x] runtime smoke は結果を残すか、skip 理由を明示する。
  - [ ] PR を作成する。
- Validation:
  - `make rust-lint`
  - `make validate`
