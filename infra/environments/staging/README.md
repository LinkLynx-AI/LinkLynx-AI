# Staging Environment

この root は LIN-963 以降の staging infrastructure 用。

## 初期化

bootstrap apply 後に生成された `backend.hcl` を使う。

```bash
cd infra/environments/staging
terraform init -backend-config=backend.hcl
terraform plan
```

## LIN-963 時点の構成

- `network_foundation` module を呼び、次を staging project 内に作る
  - custom mode VPC
  - GKE node subnet + pods/services secondary ranges
  - `db-private`, `proxy-only`, `psc` subnet
  - private services access reserved range + peering
  - Cloud Armor baseline policy
  - Cloud DNS public zone, reserved global IPv4, Certificate Manager resources
- `artifact_registry_repository` module を呼び、`application-images` Docker repository を作る
- GKE Ingress resource 自体はこの issue では作らず、後続 cluster / smoke deploy issue で attach する
- main path に `API Gateway` は置かない

## LIN-1014 low-budget path

- 月 `1万円` 前後の初期予算 path では、staging 常設 cluster は作らない
- staging は次で代替する
  - local 開発
  - preview 環境
  - 必要時のみの一時 cluster
- 常設 staging cluster が必要になったら、標準 path の `LIN-964` 相当へ拡張する

## LIN-964 standard GKE Autopilot baseline

- `enable_standard_gke_cluster_baseline = true` で staging standard cluster を作る
- namespace baseline は次を使う
  - `frontend`
  - `api`
  - `ai`
  - `data`
  - `ops`
  - `observability`
- `data` / `ops` / `observability` には restricted ingress baseline が入る
- `ops` namespace には read-only service account `ops-viewer` を作る

VPA/HPA 境界と verify / rollback は `docs/runbooks/gke-autopilot-standard-operations-runbook.md` を使う

## LIN-965 standard Workload Identity / Secret Manager baseline

- `enable_standard_workload_identity_baseline = true` で standard path の runtime identities を作る
- baseline workload は次の 3 つ
  - `frontend/frontend-runtime`
  - `api/api-runtime`
  - `ai/ai-runtime`
- `standard_runtime_secret_ids` で workload ごとの placeholder secret ID を上書きできる
- verify / rollback は `docs/runbooks/workload-identity-secret-manager-standard-operations-runbook.md` を使う

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`
- `artifact_registry_repository_id` (default `application-images`)
- `enable_standard_gke_cluster_baseline`
- `standard_gke_release_channel`
- `standard_gke_namespace_names`
- `enable_standard_workload_identity_baseline`
- `standard_runtime_secret_ids`
- `enable_standard_gitops_baseline`
- `enable_standard_cloud_sql_baseline`
- `enable_standard_dragonfly_baseline`
- `enable_standard_scylla_cloud_baseline`
- `enable_standard_managed_messaging_cloud_baseline`
- `enable_standard_search_baseline`
- `enable_standard_observability_baseline`
- `standard_dragonfly_image`
- `standard_dragonfly_storage_size`
- `standard_dragonfly_allowed_client_namespaces`
- `standard_scylla_hosts`
- `standard_scylla_keyspace`
- `standard_scylla_schema_path`
- `standard_scylla_request_timeout_ms`
- `standard_scylla_disallow_shard_aware_port`
- `standard_scylla_runtime_workloads`
- `standard_scylla_secret_ids`
- `standard_redpanda_runtime_workloads`
- `standard_nats_runtime_workloads`
- `standard_redpanda_secret_ids`
- `standard_nats_secret_ids`
- `standard_redpanda_smoke_topic`
- `standard_nats_smoke_subject`
- `standard_search_runtime_workloads`
- `standard_search_secret_ids`
- `standard_search_index_name`
- `standard_cloud_sql_database_name`
- `standard_cloud_sql_tier`
- `standard_cloud_sql_disk_size_gb`
- `standard_cloud_sql_staging_retained_backups`
- `standard_gitops_repository_url`
- `standard_gitops_target_revision`
- `standard_gitops_argocd_chart_version`
- `standard_gitops_rollouts_chart_version`
- `standard_observability_discord_webhook_url`
- `standard_observability_discord_mention`
- `standard_api_probe_targets`
- `standard_redpanda_probe_targets`
- `standard_nats_probe_targets`
- `standard_search_probe_targets`
- `standard_observability_kube_prometheus_stack_chart_version`
- `standard_observability_loki_chart_version`
- `standard_observability_alloy_chart_version`
- `standard_observability_blackbox_chart_version`
- `standard_observability_prometheus_retention`
- `standard_observability_prometheus_storage_size`
- `standard_observability_alertmanager_storage_size`
- `standard_observability_grafana_storage_size`
- `standard_observability_loki_storage_size`
- `standard_observability_loki_retention_period`

staging の最小 smoke deploy は `api.<staging-domain>` だけ先に作れば十分。

## LIN-967 standard GitOps / Rollouts baseline

- `enable_standard_gitops_baseline = true` で `ops` namespace に Argo CD / Argo Rollouts を入れる
- bootstrap manifest は `infra/gitops/bootstrap/staging` を使う
- staging app は `staging-canary-smoke`
  - source path: `infra/gitops/apps/staging/canary-smoke`
  - sync policy: automated
- verify / rollback は `docs/runbooks/argocd-rollouts-standard-operations-runbook.md` を使う

## LIN-968 standard Cloud SQL baseline

- `enable_standard_cloud_sql_baseline = true` で staging 向け Cloud SQL for PostgreSQL baseline を作る
- baseline は次
  - tier: `db-custom-4-16384`
  - availability: `ZONAL`
  - private IP only
  - backup + PITR enabled
- retained backups: `7`
- standard path の migration / rollback / approval 境界は `docs/runbooks/cloud-sql-postgres-standard-operations-runbook.md` を使う

## LIN-969 standard Dragonfly baseline

- `enable_standard_dragonfly_baseline = true` で staging 向け Dragonfly StatefulSet baseline を作る
- baseline は次
  - namespace: `data`
  - StatefulSet + PVC
  - PDB `minAvailable=1`
  - allowed client namespaces は default `api`
- Autopilot では dedicated node pool を作らず、namespace / workload / PDB / anti-affinity で隔離を表現する
- verify / rollback は `docs/runbooks/dragonfly-standard-operations-runbook.md` を使う

## LIN-970 standard ScyllaDB Cloud connection baseline

- `enable_standard_scylla_cloud_baseline = true` で staging 向け ScyllaDB Cloud secret/access baseline を作る
- baseline は次
  - runtime accessor: default `api`
  - required secrets: `username`, `password`, `ca_bundle`
  - hosts / keyspace / timeout は Terraform input と output contract で固定する
- provider-side cluster / allowlist / private connectivity は Terraform scope 外
- verify / rollback / rotation は `docs/runbooks/scylla-cloud-standard-operations-runbook.md` を使う

## LIN-971 standard Redpanda Cloud / Synadia Cloud connection baseline

- `enable_standard_managed_messaging_cloud_baseline = true` で staging 向け managed messaging secret/access baseline を作る
- baseline は次
  - runtime accessor: default `api`
  - Redpanda required secrets: `bootstrap_servers`, `sasl_username`, `sasl_password`, `ca_bundle`
  - NATS required secrets: `url`, `creds`, `ca_bundle`
  - smoke contract: `llx.staging.v1.derived.ops.messaging_smoke.v1` / `v0.ops.messaging_smoke`
- provider-side account / cluster / allowlist / private connectivity は Terraform scope 外
- verify / rollback / rotation / incident triage は `docs/runbooks/managed-messaging-cloud-standard-operations-runbook.md` を使う

## LIN-975 standard Elastic Cloud search baseline

- `enable_standard_search_baseline = true` で staging 向け Elastic Cloud secret/access baseline を作る
- baseline は次
  - runtime accessor: default `api`
  - required secrets: `api_key`, `cloud_id`, `endpoint`
  - index contract: `messages`
  - observability seed: optional `standard_search_probe_targets`
- provider-side deployment / allowlist / private connectivity は Terraform scope 外
- verify / rollback / snapshot / vendor boundary は `docs/runbooks/search-elastic-cloud-standard-operations-runbook.md` を使う

## LIN-972 standard observability baseline

- `enable_standard_observability_baseline = true` で staging standard observability baseline を作る
- baseline stack は次
  - `kube-prometheus-stack`
  - `Grafana`
  - `Alertmanager -> Discord`
  - `Loki`
  - `Grafana Alloy`
  - `prometheus-blackbox-exporter`
- minimum dependency probes は次を対象にする
  - API health URL
  - Cloud SQL private IP
  - Dragonfly internal endpoint
  - Scylla hosts
  - Redpanda probe targets
  - NATS probe targets
  - search HTTPS probe targets（設定時のみ）
- dashboard baseline は次
  - API / WS SLO dashboard
  - dependency probe dashboard
- verify / rollback は `docs/runbooks/observability-standard-operations-runbook.md` を使う

## LIN-973 standard security baseline

- standard path の edge security は `Cloud Armor` policy を `GCPBackendPolicy` で `canary-smoke-stable` / `canary-smoke-canary` Service に attach する
- audit baseline は次
  - `secretmanager.googleapis.com` `ADMIN_READ` / `DATA_READ`
  - `iam.googleapis.com` `ADMIN_READ` / `DATA_READ`
- CI baseline は次
  - `Gitleaks`
  - `Dependency Review`
  - `Trivy config`
  - changed-files `Semgrep`
  - changed service image `Trivy image`
- DAST は `Security DAST Baseline` workflow を手動で回す
- control plane hardening はまだ follow-up。現時点では exception を documented risk として扱う
- verify / rollback は `docs/runbooks/security-standard-operations-runbook.md` を使う
