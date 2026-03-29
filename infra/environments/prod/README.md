# Production Environment

この root は LIN-963 以降の production infrastructure 用。

## 初期化

bootstrap apply 後に生成された `backend.hcl` を使う。

```bash
cd infra/environments/prod
terraform init -backend-config=backend.hcl
terraform plan
```

## LIN-963 時点の構成

- `network_foundation` module を呼び、次を prod project 内に作る
  - custom mode VPC
  - GKE node subnet + pods/services secondary ranges
  - `db-private`, `proxy-only`, `psc` subnet
  - private services access reserved range + peering
  - Cloud Armor baseline policy
  - Cloud DNS public zone, reserved global IPv4, Certificate Manager resources
- `artifact_registry_repository` module を呼び、`application-images` Docker repository を作る
- GKE Ingress resource 自体はこの issue では作らず、後続 cluster / workload issue で attach する
- main path に `API Gateway` は置かない

## LIN-1014 low-budget path

- `enable_minimal_gke_cluster = true` で **prod only** の GKE Autopilot cluster を作る
- `staging` 常設 cluster は作らず、local / preview / 必要時の一時環境で代替する
- 初期の workload baseline は Rust API 1本に絞る
  - CPU request: `500m`
  - Memory request: `512Mi`
  - Ephemeral storage request: `1Gi`
- VPA は recommendation-only 前提とし、自動 apply は後続 issue に回す

### 低予算 path から標準 path へ拡張する条件

- staging 常設環境がないと release safety を維持できなくなったとき
- Next.js / Python が常時稼働前提になり、prod only 1 cluster では運用しづらくなったとき
- HPA を入れたいだけの観測データが揃ったとき

## LIN-964 standard GKE Autopilot baseline

`LIN-964` は standard path 向けに、`prod` に 1 つの Autopilot cluster と namespace baseline を作る。

### 使う変数

- `enable_standard_gke_cluster_baseline`
- `standard_gke_release_channel`
- `standard_gke_namespace_names`

### 作られるもの

- standard Autopilot cluster
- namespace baseline
  - `frontend`
  - `api`
  - `ai`
  - `data`
  - `ops`
  - `observability`
- `ops/ops-viewer` read-only service account
- `data` / `ops` / `observability` restricted ingress baseline

### 運用メモ

- `prod` では low-budget cluster と standard cluster を同時に有効化しない
- standard path に切り替えるときは `enable_minimal_gke_cluster = false` にする
- VPA primary / HPA later の方針で始める
- verify / rollback は `docs/runbooks/gke-autopilot-standard-operations-runbook.md` を使う

## LIN-965 standard Workload Identity / Secret Manager baseline

`LIN-965` は standard path 向けに、`frontend` / `api` / `ai` の runtime identity を Terraform で固定する。

### 使う変数

- `enable_standard_workload_identity_baseline`
- `standard_runtime_secret_ids`

### 作られるもの

- workload-scoped GSA
- workload-scoped KSA
- Secret Manager placeholder
- secret-level accessor IAM
- Secret Manager audit log baseline

### 運用メモ

- `enable_standard_workload_identity_baseline = true` の前に `enable_standard_gke_cluster_baseline = true` が必要
- `frontend` / `api` / `ai` namespace が standard baseline に含まれている必要がある
- verify / rollback は `docs/runbooks/workload-identity-secret-manager-standard-operations-runbook.md` を使う

## LIN-967 standard GitOps / Rollouts baseline

`LIN-967` は standard path 向けに、`ops` namespace へ Argo CD / Argo Rollouts を install し、GitOps repo layout を固定する。

### 使う変数

- `enable_standard_gitops_baseline`
- `standard_gitops_repository_url`
- `standard_gitops_target_revision`
- `standard_gitops_argocd_chart_version`
- `standard_gitops_rollouts_chart_version`

### 作られるもの

- `ops/argocd`
- `ops/argo-rollouts`
- bootstrap path: `infra/gitops/bootstrap/prod`
- documented prod app: `prod-canary-smoke`

### 運用メモ

- `enable_standard_gitops_baseline = true` の前に `enable_standard_gke_cluster_baseline = true` が必要
- `api` / `ops` namespace が standard baseline に含まれている必要がある
- prod app は automated sync を有効にせず、manual sync gate を baseline にする
- verify / rollback は `docs/runbooks/argocd-rollouts-standard-operations-runbook.md` を使う

## LIN-1015 prod-only Rust API smoke deploy

`LIN-1015` は `LIN-1014` の cluster を使って、最初の Rust API workload を Terraform で出す。

### 使う変数

- `enable_rust_api_smoke_deploy`
- `rust_api_image_digest`
- `rust_api_public_hostname`

default では `enable_rust_api_smoke_deploy = false` にしている。
cluster 作成後に digest と hostname が揃ってから明示的に `true` へ切り替える。
`true` のまま前提値が足りない場合は Terraform `check` で apply を止める。

### 作られるもの

- namespace: `rust-api-smoke`
- Kubernetes ServiceAccount / Deployment / Service
- Gateway API:
  - `Gateway`
  - `HTTPRoute`
  - `HealthCheckPolicy`

### 運用メモ

- Gateway は `LIN-963` で確保した named static IP と certificate map を使う
- 最初の有効化は `LIN-1014` cluster apply 後の 2 段階目 apply として実施する
- image は tag ではなく Artifact Registry digest を使う
- rollback は `rust_api_image_digest` を直前 digest に戻して `terraform apply` する

## LIN-1016 prod-only IAM / Workload Identity / Secret Manager baseline

`LIN-1016` は `rust-api-smoke` workload に対して、Secret Manager を読む最小の identity baseline を追加する。

### 使う変数

- `rust_api_runtime_secret_ids`

default では `linklynx-prod-rust-api-smoke-runtime` という placeholder secret ID を作る。
実 secret value 自体はこの issue では Terraform に入れない。

### 作られるもの

- workload 用 Google service account: `rust-api-smoke-runtime`
- KSA -> GSA の Workload Identity binding
- secret placeholder と secret-level `roles/secretmanager.secretAccessor`
- `secretmanager.googleapis.com` の `ADMIN_READ` / `DATA_READ` audit log config

### 運用メモ

- Rust API smoke workload の KSA には `iam.gke.io/gcp-service-account` annotation が自動で付く
- Workload Identity を使うため、この path では KSA token の automount を有効化する
- secret value の rotation と audit log の見方は `docs/runbooks/workload-identity-secret-manager-operations-runbook.md` を使う
- low-budget path では ESO を入れず、runtime が ADC で Secret Manager API を読む前提に寄せる

## LIN-1017 prod-only Cloud SQL baseline

`LIN-1017` は low-budget path 向けに、`prod` だけの Cloud SQL for PostgreSQL baseline を追加する。

### 使う変数

- `enable_minimal_cloud_sql_baseline`
- `minimal_cloud_sql_tier`
- `minimal_cloud_sql_database_name`
- `minimal_cloud_sql_disk_size_gb`

default では `enable_minimal_cloud_sql_baseline = false` にしている。
Cloud SQL は low-budget path の中でも費用インパクトが大きいため、明示的に有効化したときだけ作る。

### 作られるもの

- Cloud SQL for PostgreSQL instance
- application database (`linklynx`)
- private IP / backup / PITR / maintenance / deletion protection baseline

### 運用メモ

- low-budget profile は `db-g1-small` を baseline にするが、これは bootstrap 用の暫定 profile として扱う
- HA / read replica は含めない
- DB password や runtime 接続方式はこの issue では作らず、後続で Secret Manager / app connectivity 側に分離する
- migration 手順は `docs/runbooks/cloud-sql-postgres-migration-operations-runbook.md`、PITR は `docs/runbooks/postgres-pitr-runbook.md` を使う

## LIN-1018 prod-only Cloud Monitoring baseline

`LIN-1018` は low-budget path 向けに、`Cloud Monitoring + Cloud Logging` 中心の最小 observability baseline を追加する。

### 使う変数

- `enable_minimal_monitoring_baseline`
- `minimal_monitoring_alert_email_addresses`
- `minimal_monitoring_existing_notification_channels`

default では `enable_minimal_monitoring_baseline = false` にしている。
Rust API smoke deploy と Cloud SQL baseline が揃ってから明示的に有効化する。

### 作られるもの

- Cloud Monitoring dashboard
- Rust API restart alert policy
- Cloud SQL CPU alert policy
- optional email notification channels

### 運用メモ

- low-budget path では self-hosted `Prometheus + Grafana + Loki` を入れず、GCP native の可視化と通知だけを先に成立させる
- Discord forwarder はこの issue の対象外
- 運用手順は `docs/runbooks/cloud-monitoring-low-budget-operations-runbook.md` を使う

## LIN-1029 prod-only external dependency observability baseline

`LIN-1029` は low-budget path 向けに、Scylla / Redpanda Cloud / Synadia Cloud / Elastic Cloud の manual check source と alert seed を docs で固定する。

### 運用メモ

- Cloud Monitoring は GKE / Rust API / Cloud SQL を見る基準線として使う
- external dependency は provider console / status page / workload-local health を check source にする
- responder は Cloud Monitoring から dependency-specific runbook へ handoff する
- provider metrics ingestion や unified dashboard automation は `LIN-972` に残す
- external dependency handoff は `docs/runbooks/external-dependency-observability-low-budget-runbook.md` を使う

## LIN-1022 prod-only Dragonfly volatile baseline

`LIN-1022` は low-budget path 向けに、Dragonfly を `volatile cache/state only` として最小構成で追加する。

### 使う変数

- `enable_minimal_dragonfly_baseline`
- `minimal_dragonfly_image`

default では `enable_minimal_dragonfly_baseline = false` にしている。
この baseline は opt-in で、image pin が設定されているときだけ有効化する。

### 作られるもの

- namespace: `dragonfly`
- service account: `dragonfly`
- deployment: `dragonfly`
- service: `dragonfly`

### 運用メモ

- internal endpoint は `dragonfly.dragonfly.svc.cluster.local:6379`
- source of truth ではないため、pod restart 時の state loss は許容する
- fallback / degraded behavior は `docs/runbooks/dragonfly-ratelimit-operations-runbook.md` と `docs/runbooks/session-resume-dragonfly-operations-runbook.md` に従う
- infra verify / rollback は `docs/runbooks/dragonfly-low-budget-operations-runbook.md` を使う

## LIN-1023 prod-only Scylla runtime baseline

`LIN-1023` は low-budget path 向けに、`rust-api-smoke` workload が外部 Scylla へ接続するための runtime baseline を追加する。

### 使う変数

- `enable_minimal_scylla_runtime_baseline`
- `minimal_scylla_hosts`
- `minimal_scylla_keyspace`
- `minimal_scylla_schema_path`
- `minimal_scylla_request_timeout_ms`

default では `enable_minimal_scylla_runtime_baseline = false` にしている。
`Rust API smoke` workload が有効で、接続先 host が埋まっているときだけ明示的に有効化する。

### 追加されるもの

- Rust image 内の bundled schema artifact:
  - `/app/database/scylla/001_lin139_messages.cql`
- `rust-api-smoke` Pod への `SCYLLA_*` env injection

### 運用メモ

- この baseline は external Scylla cluster 自体は作らない
- `GET /internal/scylla/health` で wiring 後の状態を確認する
- network / backup / auth / recovery は standard path の `LIN-970` に残す
- verify / rollback は `docs/runbooks/scylla-low-budget-runtime-operations-runbook.md` を使う

## LIN-1028 prod-only external Scylla ops / backup baseline

`LIN-1028` は low-budget path 向けに、external Scylla の ownership / backup / restore / monitoring seed を docs で固定する。

### 運用メモ

- message body の source of truth は引き続き Scylla にある
- node-loss や quorum risk が疑われる場合は LIN-589 の fail-close 判断線を優先する
- backup freshness や schema manifest の有無が不明な状態で risky change を進めない
- provider onboarding、auth / TLS / secret rotation、staging / prod 接続確認は `LIN-970` に残す
- ownership / backup / incident triage は `docs/runbooks/scylla-external-low-budget-operations-runbook.md` を使う

## LIN-1024 prod-only managed messaging secret baseline

`LIN-1024` は low-budget path 向けに、Redpanda Cloud / Synadia Cloud の接続情報を受け入れる Secret Manager placeholder baseline を追加する。

### 使う変数

- `enable_minimal_managed_messaging_secret_baseline`
- `minimal_redpanda_secret_ids`
- `minimal_nats_secret_ids`

default では `enable_minimal_managed_messaging_secret_baseline = false` にしている。
connection material の保管先を先に固定したいときだけ明示的に有効化する。

### 作られるもの

- Redpanda Cloud 用 secret placeholder
- NATS / Synadia 用 secret placeholder

### 運用メモ

- runtime client や env wiring はこの baseline では追加しない
- secret version の投入は apply 後に手動で行う
- secret rotation / audit log の見方は `docs/runbooks/workload-identity-secret-manager-operations-runbook.md` を使う
- inventory / fill / rollback は `docs/runbooks/managed-messaging-low-budget-operations-runbook.md` を使う

## LIN-1027 prod-only Redpanda Cloud / Synadia Cloud ops baseline

`LIN-1027` は low-budget path 向けに、Redpanda Cloud / Synadia Cloud の運用責務と incident triage baseline を docs で固定する。

### 運用メモ

- Redpanda は extension stream path であり、core write path の source of truth にはしない
- NATS outage 時は realtime を degraded にし、Class A は history refetch / state resync で補償する
- credential rotation は Secret Manager version で行い、runtime adoption は後続 issue で閉じる
- provider resource provisioning、network / auth onboarding、publish / subscribe smoke は `LIN-971` に残す
- ownership / incident triage / monitoring seed は `docs/runbooks/managed-messaging-cloud-low-budget-operations-runbook.md` を使う

## LIN-1025 prod-only Elastic Cloud secret baseline

`LIN-1025` は low-budget path 向けに、検索基盤を `Elastic Cloud` 前提で受け入れる Secret Manager placeholder baseline を追加する。

### 使う変数

- `enable_minimal_search_secret_baseline`
- `minimal_search_secret_ids`

default では `enable_minimal_search_secret_baseline = false` にしている。
search connection material の保管先を先に固定したいときだけ明示的に有効化する。

### 作られるもの

- Elastic Cloud 用 secret placeholder

### 運用メモ

- `linklynx-prod-search-elastic-api-key` は必須
- `linklynx-prod-search-elastic-cloud-id` と `linklynx-prod-search-elastic-endpoint` は、runtime がどちらで接続するかに応じて片方または両方を使う
- index name は runtime contract の `messages` を使い、この baseline では secret 化しない
- runtime wiring / connectivity smoke / snapshot lifecycle は standard path の `LIN-975` に残す
- inventory / fill / rollback は `docs/runbooks/search-low-budget-operations-runbook.md` を使う

## LIN-1026 prod-only Elastic Cloud snapshot / lifecycle ops baseline

`LIN-1026` は low-budget path 向けに、Elastic Cloud の snapshot / restore / lifecycle / incident triage を docs で固定する。

### 追加される docs

- `docs/runbooks/search-elastic-cloud-low-budget-operations-runbook.md`

### 運用メモ

- default `found-snapshots` repository と `cloud-snapshot-policy` は維持する
- same-region restore を初期復旧経路にする
- custom repository や cross-region restore は必要になった時点で follow-up issue に分離する
- secret inventory は `LIN-1025` の baseline を使う

## LIN-1019 prod-only security baseline

`LIN-1019` は low-budget path 向けに、`Cloud Armor + Trivy + Secret Manager audit log` をつないだ最小 security baseline を追加する。

### 使う変数

- `enable_minimal_security_baseline`

default では `enable_minimal_security_baseline = false` にしている。
`Rust API smoke` workload が有効なときだけ明示的に有効化する。

### 作られるもの

- `Rust API smoke` Service に attach される `GCPBackendPolicy`
- Cloud Armor policy 上の baseline managed WAF rules

### 運用メモ

- low-budget path では narrow な WAF baseline から始め、false positive を増やしすぎない
- image scan 自体は既存の CD workflow の `Trivy` を使う
- secret access の audit 確認は `docs/runbooks/workload-identity-secret-manager-operations-runbook.md` を使う
- Cloud Armor の verify / rollback は `docs/runbooks/cloud-armor-low-budget-operations-runbook.md` を使う

## LIN-1031 prod-only cluster network policy baseline

`LIN-1031` は low-budget path 向けに、`rust-api-smoke` と `dragonfly` の ingress 面だけを narrow に絞る。

### 作られるもの

- `rust-api-smoke`
  - default deny ingress
  - TCP `8080` を許可する NetworkPolicy
- `dragonfly`
  - default deny ingress
  - TCP `6379` を `rust-api-smoke` namespace からのみ許可する NetworkPolicy

### 運用メモ

- egress 制御はこの baseline に含めない
- namespace をまたいで Dragonfly client を追加する場合は module variable `allowed_client_namespaces` を増やす
- verify / rollback は `docs/runbooks/cluster-network-policy-low-budget-operations-runbook.md` を使う

## LIN-1020 prod-only ops baseline

`LIN-1020` は low-budget path 向けに、初期 incident flow / postmortem / capacity assumption を整理する。

### 追加される docs

- `docs/runbooks/incident-low-budget-operations-runbook.md`
- `docs/runbooks/postmortem-low-budget-template.md`

### 運用メモ

- 初期 incident のメンション先は `hirwatan` / `sabe` / `miwasa`
- low-budget path では observed traffic と latency regression を基準に scale trigger を判断する
- Chaos Engineering は固定日ではなく readiness 条件が揃ってから開始する

## LIN-1021 prod-only Terraform deploy workflow

`LIN-1021` は low-budget path 向けに、`Argo CD` を入れず Terraform apply の実行経路を GitHub Actions に固定する。

### 使う GitHub variables

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_TERRAFORM_DEPLOYER_SERVICE_ACCOUNT`
- `GCP_TERRAFORM_ADMIN_SERVICE_ACCOUNT_EMAIL`
- `GCP_TERRAFORM_STATE_BUCKET`
- `GCP_TERRAFORM_STATE_PREFIX_PROD`

### 使う GitHub secrets

- `INFRA_PROD_TERRAFORM_TFVARS`

### 運用メモ

- workflow は `.github/workflows/infra-deploy-prod.yml`
- `plan` は approval なしで実行できる
- `apply` は `main` からのみ実行でき、GitHub `prod` environment approval が必要
- `rust_api_image_digest` は workflow input から一時的に上書きできる
- rollback は直前の digest または前の tfvars 内容に戻して再 apply する
- 詳細手順は `docs/runbooks/terraform-low-budget-prod-deploy-runbook.md` を使う

## tfvars で埋める値

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`
- `artifact_registry_repository_id` (default `application-images`)
- `enable_minimal_cloud_sql_baseline` とその profile 値
- `enable_minimal_monitoring_baseline` と通知先設定
- `enable_minimal_security_baseline`
- `enable_minimal_dragonfly_baseline`
- `minimal_dragonfly_image`

prod は `api.<domain>` を起点にし、後続 issue で必要な host を追加する。
