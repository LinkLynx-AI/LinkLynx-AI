# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1023` の Scylla low-budget runtime baseline 実装と validation が完了
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- external Scylla cluster 自体は作らず、Rust workload 側の runtime wiring を先行する
- schema artifact は Rust image に同梱し、`SCYLLA_SCHEMA_PATH` を固定しやすくする

## How to run / demo
- `enable_minimal_scylla_runtime_baseline = true` と `minimal_scylla_hosts` を設定する
- Rust image digest を更新した上で Terraform `plan/apply` を実行する
- `/internal/scylla/health` の reason を見て wiring 状態を確認する

## Known issues / follow-ups
- external Scylla の cluster / network / backup / auth はこの issue の対象外
- standard path の `LIN-970` で managed / productionized baseline を続ける

## Validation log
- `terraform fmt -check -recursive infra`
- `PATH=/tmp/terraform_1.6.6:$PATH make infra-validate`
- `make validate`
- `git diff --check`

## Review notes
- infra / docs / Dockerfile 変更のみで UI 変更なし
- external Scylla の actual provisioning や auth/TLS 対応は含めない
- `make validate` 中の既知 React `act(...)` warning は今回差分起因ではない
