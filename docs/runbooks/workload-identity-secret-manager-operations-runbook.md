# Workload Identity + Secret Manager Operations Runbook

この runbook は low-budget `prod-only` path における `Workload Identity + Secret Manager` baseline の確認、rotation、rollback を扱う。

## Baseline

- Kubernetes workload は KSA を使う
- KSA は `iam.gke.io/gcp-service-account` annotation で GSA に紐づける
- Secret Manager access は project-wide ではなく secret-level `roles/secretmanager.secretAccessor` に限定する
- Cloud Audit Logs は `secretmanager.googleapis.com` の `ADMIN_READ` / `DATA_READ` を有効化する

## Apply 前提

- `LIN-1014` の prod-only GKE cluster が apply 済み
- `LIN-1015` の Rust API smoke workload baseline が branch / PR 上で利用可能
- `backend.hcl` を使って prod root を init 済み

## Verify

1. Terraform outputs で GSA と secret resource を確認する
2. `kubectl -n rust-api-smoke get sa rust-api-smoke -o yaml` で `iam.gke.io/gcp-service-account` annotation を確認する
3. `gcloud secrets get-iam-policy <secret-id>` で `roles/secretmanager.secretAccessor` が workload GSA に付与されていることを確認する
4. Cloud Logging で次の filter を使い、secret access を確認する

```text
resource.type="audited_resource"
protoPayload.serviceName="secretmanager.googleapis.com"
protoPayload.authenticationInfo.principalEmail="<workload-gsa-email>"
```

## Rotation

1. 新しい secret version を追加する
2. runtime が起動時に secret を読む場合は workload を rollout する
3. 新 version で正常動作を確認する
4. 不要になった旧 version を disable する

## Rollback

1. 直前の secret version を primary に戻す
2. 問題が identity 側なら KSA annotation または `roles/iam.workloadIdentityUser` binding を差し戻す
3. 必要なら secret accessor IAM を解除し、旧運用へ一時退避する

## Notes

- 実 secret 値そのものはこの baseline issue では Terraform 管理しない
- staging 常設 cluster がないため、初回 verification は prod smoke workload を最小影響で使う
