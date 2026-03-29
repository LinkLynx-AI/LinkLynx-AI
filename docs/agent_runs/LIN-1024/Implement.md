# Implement.md

## Scope lock
- `LIN-1024` は low-budget `prod-only` path の managed messaging secret inventory に限定する。
- Redpanda / NATS runtime client, network, broker provisioning は実装しない。

## Planned edits
1. Secret Manager placeholder module を追加する。
2. `infra/environments/prod` に opt-in variables と module wiring を追加する。
3. low-budget runbook / README / decisions / agent memory を更新する。
