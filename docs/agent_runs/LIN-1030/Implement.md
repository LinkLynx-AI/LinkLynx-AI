# Implement.md

- `LIN-1030` は low-budget `prod-only` path の CI security scan baseline に限定する。
- 追加対象は `repo secret` と `infra misconfig` に絞り、image scan / DAST / runtime policy は scope 外とする。
- `Gitleaks` の deterministic test fixture false positive は `.gitleaks.toml` で narrow に抑える。
- `Trivy` の `AVD-GCP-0061` は low-budget deploy 経路の前提上、`.trivyignore` と runbook で明示的に受容する。
