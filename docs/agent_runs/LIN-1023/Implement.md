# Implement.md

## Scope lock
- `LIN-1023` は low-budget `prod-only` path の external Scylla runtime baseline に限定する。
- cluster / account / peering / backup automation は実装しない。

## Planned edits
1. Rust image に Scylla schema artifact を同梱する。
2. `rust_api_smoke_deploy` module に optional `SCYLLA_*` env injection を追加する。
3. `infra/environments/prod` に opt-in variables と prerequisite checks を追加する。
4. low-budget runbook / README / decisions / agent memory を更新する。
