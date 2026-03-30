# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-1030` の CI security scan baseline 実装と validation が完了した
- Next: commit / push / PR 作成と Linear の `In Review` 更新を行う

## Decisions
- low-budget path の merge 前 security は `Gitleaks + Trivy config` の narrow baseline で始める
- container image scan は `LIN-966` に残し、この issue では repo / infra 側だけを追加する
- `AVD-GCP-0061` は現行 deploy 経路の制約から temporary accepted risk として扱う

## How to run / demo
- `docs/runbooks/ci-security-low-budget-operations-runbook.md` のコマンドで `Gitleaks` と `Trivy config` を再現する
- CI workflow に 2 job 追加されていることを確認する

## Known issues / follow-ups
- cluster access hardening と `master_authorized_networks` 対応は `LIN-973` / `LIN-964` 側へ残す
- DAST / CodeQL / full app config scan expansion は標準 path に残す

## Validation log
- tracked files snapshot を使った `Gitleaks` scan pass
- `Trivy config --ignorefile .trivyignore infra` pass
- `make validate` pass
- `git diff --check` pass

## Review notes
- repo root 全体の `Gitleaks` は local build artifact を拾って noisy になるため、CI / runbook とも tracked files snapshot を前提にした
- `.gitleaksignore` は deterministic test fixture 2件の fingerprint に限定した
- `.trivyignore` は low-budget deploy 経路で受容する `AVD-GCP-0061` 1件のみに限定した
