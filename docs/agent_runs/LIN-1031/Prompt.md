# Prompt.md (Spec / Source of truth)

## Goals
- low-budget `prod-only` path 向けに cluster network policy baseline を追加する
- `rust-api-smoke` と `dragonfly` の ingress 面だけを narrow に絞る
- Terraform と runbook を揃えて verify / rollback 導線を残す

## Non-goals
- cluster-wide default deny
- egress 制御
- Pod Security Admission
- service mesh や zero-trust 全体設計

## Deliverables
- `infra/modules/rust_api_smoke_deploy` の ingress-only NetworkPolicy baseline
- `infra/modules/dragonfly_minimal` の ingress-only NetworkPolicy baseline
- low-budget runbook / docs 更新

## Done when
- [ ] `rust-api-smoke` に default deny ingress と 8080 許可 policy が入る
- [ ] `dragonfly` に default deny ingress と `rust-api-smoke` namespace 許可 policy が入る
- [ ] runbook / decision doc / infra README が更新される
- [ ] validation と review evidence が残る

## Constraints
- Perf: baseline は narrow に保ち、egress policy は入れない
- Security: Dragonfly は allowlist namespace からのみ到達可能にする
- Compatibility: low-budget `prod-only` path の既存 variable surface をできるだけ増やさない
