# Workload Identity + Secret Manager Standard Operations Runbook

この runbook は standard path (`LIN-965`) における `staging` / `prod` の Workload Identity + Secret Manager baseline の確認、rotation、rollback を扱う。

## Baseline

- workload ごとに KSA / GSA を分離する
- initial standard runtime workloads:
  - `frontend/frontend-runtime`
  - `api/api-runtime`
  - `ai/ai-runtime`
- KSA は module が自動作成し、`iam.gke.io/gcp-service-account` annotation を付ける
- secret access は project-wide ではなく secret-level `roles/secretmanager.secretAccessor` に限定する
- Cloud Audit Logs は `secretmanager.googleapis.com` の `ADMIN_READ` / `DATA_READ` を有効化する

## Apply 前提

- `LIN-964` の standard GKE cluster / namespace baseline が apply 済み
- `enable_standard_workload_identity_baseline = true`
- `backend.hcl` を使って environment root を init 済み

## Verify

### 1. Terraform outputs

```bash
terraform output standard_runtime_identities
```

期待値:

- `frontend`, `api`, `ai` ごとに GSA email, KSA name, secret IDs が見える

### 2. Kubernetes service accounts

```bash
kubectl -n frontend get sa frontend-runtime -o yaml
kubectl -n api get sa api-runtime -o yaml
kubectl -n ai get sa ai-runtime -o yaml
```

期待値:

- `iam.gke.io/gcp-service-account` annotation が付いている

### 3. Secret IAM

```bash
gcloud secrets get-iam-policy <secret-id>
```

期待値:

- 対応する workload GSA に `roles/secretmanager.secretAccessor` が付いている

### 4. Audit logs

```text
resource.type="audited_resource"
protoPayload.serviceName="secretmanager.googleapis.com"
protoPayload.authenticationInfo.principalEmail="<workload-gsa-email>"
```

期待値:

- secret access / denied access を principal 単位で追える

## Rotation

1. 新しい secret version を追加する
2. runtime が起動時に secret を読む場合は対象 workload を rollout する
3. 新 version で正常動作を確認する
4. 不要になった旧 version を disable する

## Rollback

1. 直前の secret version を primary に戻す
2. 問題が identity 側なら KSA annotation または `roles/iam.workloadIdentityUser` binding を差し戻す
3. 必要なら secret accessor IAM を解除し、旧運用へ一時退避する

## Notes

- 実 secret 値そのものはこの baseline issue では Terraform 管理しない
- standard path でも GitHub Actions からの long-lived key 配布は行わず、OIDC / Workload Identity Federation を維持する
- `External Secrets Operator` は後続検討とし、この issue では direct Secret Manager access を標準パターンにする
