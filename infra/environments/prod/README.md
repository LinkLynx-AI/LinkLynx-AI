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
