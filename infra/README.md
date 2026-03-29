# Infra Bootstrap

LIN-962 で GCP bootstrap と Terraform remote state の最小土台を追加し、LIN-963 で runtime environment の network / DNS / TLS foundation を載せる。

## 目的

- `staging` / `prod` の GCP project baseline を Terraform で再現可能にする
- 後続 issue が共通 state backend を使えるようにする
- naming convention, budget baseline, admin service account を最初に固定する

## ディレクトリ構成

```text
infra/
├── modules/
│   ├── artifact_registry_repository/
│   ├── cloud_monitoring_minimal/
│   ├── cloud_sql_postgres_minimal/
│   ├── cloud_sql_postgres_standard/
│   ├── dragonfly_minimal/
│   ├── gke_autopilot_minimal/
│   ├── gke_autopilot_standard_cluster/
│   ├── gke_namespace_baseline/
│   ├── github_actions_artifact_publish/
│   ├── github_actions_terraform_deploy/
│   ├── managed_messaging_secret_placeholders/
│   ├── network_foundation/
│   ├── project_baseline/
│   ├── rust_api_smoke_deploy/
│   ├── search_secret_placeholders/
│   └── state_backend/
└── environments/
    ├── bootstrap/
    ├── staging/
    └── prod/
```

## 命名規約

| 種別 | 規約 | 例 |
| --- | --- | --- |
| Project prefix | `<project_prefix>` | `linklynx` |
| Bootstrap project | `<project_prefix>-bootstrap` | `linklynx-bootstrap` |
| Runtime project | `<project_prefix>-<env>` | `linklynx-staging`, `linklynx-prod` |
| State bucket | `<project_prefix>-tfstate-<suffix>` | `linklynx-tfstate-a1b2` |
| Terraform admin service account | `<account_id>@<bootstrap-project>.iam.gserviceaccount.com` | `terraform-admin@linklynx-bootstrap.iam.gserviceaccount.com` |
| State prefix | `env/<env>` | `env/staging`, `env/prod` |

## Terraform admin role baseline

`roles/owner` は採用しない。初期 baseline は override 可能な curated predefined roles に絞る。
bootstrap root を実行する人間または CI principal が folder / billing / project 作成権限を持ち、`terraform-admin` service account 自体にはそれらの organization-scope 権限を default 付与しない。

| Scope | Baseline roles |
| --- | --- |
| Bootstrap project | `roles/storage.admin`, `roles/serviceusage.serviceUsageAdmin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin` |
| Runtime project | `roles/compute.admin`, `roles/container.admin`, `roles/dns.admin`, `roles/certificatemanager.editor`, `roles/cloudsql.admin`, `roles/artifactregistry.admin`, `roles/secretmanager.admin`, `roles/serviceusage.serviceUsageAdmin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin` |

## Budget baseline

初期値は Terraform 変数で上書き可能だが、baseline は次を採用する。

| Environment | Monthly budget (JPY) |
| --- | ---: |
| `staging` | `300000` |
| `prod` | `1500000` |

閾値は `50% / 80% / 100%` を baseline とする。

## Bootstrap flow

1. `infra/environments/bootstrap` を local state で apply する
2. bootstrap project, state bucket, admin service account, `staging` / `prod` project baseline を作る
3. 同じ apply で `infra/environments/staging/backend.hcl` と `infra/environments/prod/backend.hcl` を生成する
4. 後続 issue では各 environment root で `terraform init -backend-config=backend.hcl` を使う

この流れにより、最初の state backend 作成以外で clickops を増やさずに進められる。

## Security notes

- state bucket は `uniform_bucket_level_access = true` と `public_access_prevention = "enforced"` を前提にする
- versioning を有効化する
- 必要なら `state_bucket_kms_key_name` で CMEK を有効化できる

## LIN-963 network foundation baseline

`infra/modules/network_foundation` は `staging` / `prod` 両方で共通利用する。

### Responsibility split

- DNS: `Cloud DNS`
- TLS: `Certificate Manager`
- WAF: `Cloud Armor`
- LB: `External Application Load Balancer` を後続 issue で attach
- Ingress: GKE cluster / workload 側の resource は後続 `LIN-964` / `LIN-1013` で作る
- API Gateway: main path では使わない

### Default IP plan

| Purpose | Baseline |
| --- | --- |
| GKE nodes subnet | `10.0.0.0/20` |
| GKE pods secondary range | `10.16.0.0/14` |
| GKE services secondary range | `10.32.0.0/20` |
| DB private subnet | `10.48.0.0/24` |
| Proxy-only subnet | `10.48.2.0/23` |
| PSC subnet | `10.48.4.0/24` |
| Private services access reserved range | `10.60.0.0/16` |

`db-private /24` は将来の DB 隣接ワークロード向け subnet とし、Cloud SQL など Google producer service への private services access は別の reserved peering range で管理する。

### Edge foundation resources

domain が未確定でも code は先に用意し、environment ごとの `terraform.tfvars` で次を埋める。

- `public_dns_zone_name`
- `public_dns_name`
- `public_hostnames`

これにより先に次を作れる。

- public managed zone
- reserved global IPv4
- hostname 用 A record
- DNS authorization record
- Google-managed certificate
- certificate map / entry

## LIN-1014 low-budget GKE path

月額 `1万円` 前後の初期予算では、まず `prod only` の Autopilot cluster 1つに寄せる。

### Why prod only

- GKE cluster management fee は `1 cluster あたり $0.10/hour` だが、Autopilot / zonal cluster には billing account ごとに `月 $74.40` の free tier credit がある
- そのため、**常設 1 cluster** なら management fee はほぼ吸収できるが、`staging + prod` 常設は edge / DNS / traffic と合わせて初期予算に対して重くなりやすい
- low-budget path では `Rust API` を先に成立させ、常設 staging は後から足す

### Baseline

- prod: Autopilot cluster 1つ
- staging: 常設 cluster なし
- initial workload: Rust API のみ
- fixed request baseline:
  - CPU: `500m`
  - Memory: `512Mi`
  - Ephemeral storage: `1Gi`
- VPA: recommendation-only
- HPA: 未導入

### Upgrade path

次の条件を満たしたら標準 path の `LIN-964` へ移る。

- staging 常設環境がないと deploy safety を維持できない
- Next.js / Python が常時 production workload になった
- autoscaling を固定 request では吸収しきれない

## LIN-964 standard GKE Autopilot cluster baseline

standard path では `staging` / `prod` に 1 cluster ずつ置き、domain split 前の namespace / RBAC / restricted ingress baseline を先に固定する。

### What gets created

- standard Autopilot cluster
  - `staging`
  - `prod`
- namespace baseline
  - `frontend`
  - `api`
  - `ai`
  - `data`
  - `ops`
  - `observability`
- read-only ops service account
  - `ops/ops-viewer`
- restricted ingress baseline
  - `data`
  - `ops`
  - `observability`

### Autoscaling posture

- `frontend` / `api`: VPA primary, HPA later
- `ai`: spot-ready だが、この issue では placement まで入れない
- `data` / `ops` / `observability`: manual first

この issue では workload target がまだないため、`VerticalPodAutoscaler` object までは作らない。VPA/HPA 境界と namespace label で先に運用ルールを固定する。

### Prod coexistence rule

`prod` では low-budget cluster (`LIN-1014`) と standard cluster (`LIN-964`) を同時に有効化しない。
`enable_standard_gke_cluster_baseline = true` にする場合は `enable_minimal_gke_cluster = false` に切り替える。

詳細な verify / rollback は `docs/runbooks/gke-autopilot-standard-operations-runbook.md` を参照する。

## LIN-965 standard Workload Identity / Secret Manager baseline

standard path では `frontend` / `api` / `ai` を最初の workload identity 対象とし、KSA / GSA / secret placeholder を workload 単位で分離する。

### What gets created

- workload-scoped Google service accounts
  - `frontend-runtime`
  - `api-runtime`
  - `ai-runtime`
- workload-scoped Kubernetes service accounts
  - `frontend/frontend-runtime`
  - `api/api-runtime`
  - `ai/ai-runtime`
- Secret Manager placeholder baseline
  - `linklynx-<env>-frontend-runtime`
  - `linklynx-<env>-api-runtime`
  - `linklynx-<env>-ai-runtime`
- secret-level `roles/secretmanager.secretAccessor`
- `secretmanager.googleapis.com` audit log baseline

### Current pattern

- runtime secret retrieval は direct Secret Manager access
- long-lived GCP key は repo / CI に置かない
- `External Secrets Operator` は standard path でも後続検討に回す

### Staging verify boundary

- staging では KSA annotation, secret IAM, audit logs までを baseline verify とする
- 実 secret value の注入や app-side retrieval smoke は後続 app issue に残す

詳細な verify / rollback は `docs/runbooks/workload-identity-secret-manager-standard-operations-runbook.md` を参照する。

## LIN-967 standard GitOps / Rollouts baseline

standard path では Argo CD / Argo Rollouts を `ops` namespace に入れ、GitOps repo layout は `infra/gitops/` に固定する。

### What gets created

- Helm release
  - `ops/argocd`
  - `ops/argo-rollouts`
- GitOps repo layout
  - `infra/gitops/apps/base/canary-smoke`
  - `infra/gitops/apps/staging/canary-smoke`
  - `infra/gitops/apps/prod/canary-smoke`
  - `infra/gitops/bootstrap/staging`
  - `infra/gitops/bootstrap/prod`

### Promotion boundary

- `staging` application は automated sync
- `prod` application は manual sync
- promotion は staging overlay merge -> verify -> prod overlay merge -> manual sync の順

### Validation

- `make infra-gitops-validate`
- `kubectl apply -k infra/gitops/bootstrap/<env>` で bootstrap manifest を apply

Terraform では controller install までを担当し、Argo CD custom resources は repo 側 bootstrap manifest として保持する。これは CRD timing を避けつつ、project / application 定義を Git に残すため。

詳細な verify / rollback は `docs/runbooks/argocd-rollouts-standard-operations-runbook.md` を参照する。

## LIN-968 standard Cloud SQL baseline

standard path では `staging` / `prod` に Cloud SQL for PostgreSQL baseline を置き、migration / PITR / approval boundary を low-budget path と分けて固定する。

### Standard profile

- tier: `db-custom-4-16384`
- storage: `PD_SSD`
- private IP only
- backup + PITR enabled
- staging availability: `ZONAL`
- prod availability: `REGIONAL`
- prod read replica: none at baseline

### Why no initial read replica

- `LIN-968` の対象はまず write-safe な primary baseline と migration / PITR 運用を閉じること
- read replica は read pressure, failover owner, replication lag alert を揃えてから別 issue で追加する

### Validation / operations

- standard path migration / approval / rollback:
  - `docs/runbooks/cloud-sql-postgres-standard-operations-runbook.md`
- PITR:
  - `docs/runbooks/postgres-pitr-runbook.md`

## LIN-966 Artifact Registry / CI publish baseline

### What gets created

- runtime project (`staging` / `prod`) ごとに Docker repository `application-images`
- bootstrap project に GitHub OIDC 用 workload identity pool / provider
- bootstrap project に environment ごとの publish service account
  - `github-artifact-publisher-staging`
  - `github-artifact-publisher-prod`

repository は `immutable_tags = true` を前提にする。

### Image naming baseline

service image name は次の形に統一する。

```text
<location>-docker.pkg.dev/<project-id>/<repository-id>/<service>
```

例:

```text
us-east1-docker.pkg.dev/linklynx-prod/application-images/rust
us-east1-docker.pkg.dev/linklynx-prod/application-images/typescript
us-east1-docker.pkg.dev/linklynx-prod/application-images/python
```

publish tag は mutable tag を避け、`sha-<commit>-run-<run_id>-attempt-<run_attempt>` を使う。
deploy や promotion の参照は **digest (`@sha256:...`) を canonical** とする。

### GitHub Actions settings baseline

CD workflow は GitHub Actions `environment` を使って `staging` / `prod` を切り替える。

repository variable:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_ARTIFACT_REGISTRY_LOCATION` (default `us-east1`)
- `GCP_ARTIFACT_REGISTRY_REPOSITORY` (default `application-images`)

environment variable (`staging`, `prod`):

- `GCP_ARTIFACT_PUBLISHER_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_PROJECT_ID`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

low-budget path でも image publish 自体は `staging` / `prod` の両 project を用意してよい。
ただし、常設 GKE cluster は `LIN-1014` に従って `prod only` とする。

### Vulnerability scanning baseline

- runtime project では `containerscanning.googleapis.com` を enable する
- GitHub Actions publish job では `Trivy` で `HIGH` / `CRITICAL` を fail-fast する

これで GCP 側の継続監視と、workflow 側の即時 fail の両方を持てる。

### Promotion flow baseline

1. 検証ブランチ or manual dispatch で `staging` environment に publish する
2. digest を artifact / workflow summary で記録する
3. deploy 系 issue では tag ではなく digest を manifest / Terraform に渡す
4. `prod` publish は protected branch merge または manual approval 付き workflow dispatch で行う

この issue では image copy / promotion の完全自動化までは持たない。

## LIN-1015 prod-only Rust API smoke deploy baseline

low-budget path の最初の workload deploy は `prod` の Rust API 1本に絞る。

### Why default-off

`infra/environments/prod` では smoke workload resource を持つが、default は `enable_rust_api_smoke_deploy = false` にする。

- cluster 作成 (`LIN-1014`) と workload deploy (`LIN-1015`) を分離したい
- image digest と public host が埋まってから明示的に有効化したい
- local validation では cluster 未作成状態でも `terraform validate` / `plan` を通したい

`enable_rust_api_smoke_deploy = true` にした状態で digest / host / edge prerequisites が足りないときは、Terraform `check` で fail-fast する。

### Required inputs

- `enable_rust_api_smoke_deploy = true`
- `rust_api_image_digest = us-east1-docker.pkg.dev/.../rust@sha256:...`
- `rust_api_public_hostname = api.<domain>`

### What gets created

- Kubernetes namespace / service account / deployment / service
- GKE Gateway API resource (`Gateway`, `HTTPRoute`)
- `HealthCheckPolicy` with `/health`

Route baseline は次の通り。

- `https://<rust_api_public_hostname>/health`
- `wss://<rust_api_public_hostname>/ws`

deploy 後の rollback は `rust_api_image_digest` を直前 digest に戻して再 apply する。

## LIN-1023 prod-only Scylla runtime baseline

low-budget path では standard `LIN-970` の外部 Scylla provision をまだ行わず、先に Rust workload 側の runtime baseline を閉じる。

### What gets added

- Rust image に `/app/database/scylla/001_lin139_messages.cql` を同梱
- `rust_api_smoke_deploy` module から `SCYLLA_*` env を opt-in inject
- `prod` root に Scylla runtime 用 prerequisite check を追加

### Required inputs

- `enable_rust_api_smoke_deploy = true`
- `enable_minimal_scylla_runtime_baseline = true`
- `minimal_scylla_hosts = ["<host>:9042", ...]`

optional inputs:

- `minimal_scylla_keyspace`
- `minimal_scylla_schema_path`
- `minimal_scylla_request_timeout_ms`

### Responsibility boundary

- this issue covers workload-side runtime wiring only
- external Scylla cluster / network / backup / auth baseline は `LIN-970` に残す
- verify / rollback は `docs/runbooks/scylla-low-budget-runtime-operations-runbook.md` を使う

## LIN-1028 prod-only external Scylla ops / backup baseline

low-budget path では Scylla cluster 自体の onboarding までは持たず、まずは backup / restore / ownership / monitoring seed を documented baseline として固定する。

### What gets documented

- external Scylla owner と LinkLynx の responsibility split
- backup / restore / schema ownership の初期境界
- connect timeout / node-loss / backup freshness の初期判断線
- auth / TLS / network productionization を standard path に残す boundary

### Boundary

- runtime wiring baseline は `LIN-1023` を使う
- provider onboarding / auth / TLS / secret rotation / connectivity smoke は `LIN-970` に残す
- ownership / backup / incident triage baseline は `docs/runbooks/scylla-external-low-budget-operations-runbook.md` を使う

## LIN-1024 prod-only managed messaging secret baseline

low-budget path では Redpanda / NATS の runtime client をまだ入れず、先に Secret Manager 上の connection material inventory を固定する。

### What gets added

- `managed_messaging_secret_placeholders` module
- Redpanda Cloud 用 secret placeholder
- Synadia / NATS 用 secret placeholder

### Default inventory

- Redpanda:
  - `linklynx-prod-redpanda-bootstrap-servers`
  - `linklynx-prod-redpanda-sasl-username`
  - `linklynx-prod-redpanda-sasl-password`
- NATS:
  - `linklynx-prod-nats-url`
  - `linklynx-prod-nats-creds`

### Responsibility boundary

- this issue covers Secret Manager inventory only
- runtime env wiring / publish / subscribe smoke は `LIN-971` に残す
- verify / rollback は `docs/runbooks/managed-messaging-low-budget-operations-runbook.md` を使う

## LIN-1027 prod-only Redpanda Cloud / Synadia Cloud ops baseline

low-budget path では managed messaging provider 自体の provisioning までは持たず、まずは vendor responsibility と LinkLynx 側の運用責務を documented baseline として固定する。

### What gets documented

- Redpanda Cloud / Synadia Cloud の provider boundary
- credential rotation と ownership の分界
- Redpanda replay / lag / retention coverage の初期判断線
- NATS realtime degradation / reconnect / resubscribe の初期判断線
- monitoring seed と最初の alert seed

### Boundary

- actual client wiring / publish-subscribe smoke / network onboarding は `LIN-971` に残す
- secret inventory baseline は `LIN-1024` を使う
- incident triage / ownership baseline は `docs/runbooks/managed-messaging-cloud-low-budget-operations-runbook.md` を使う

## LIN-1025 prod-only Elastic Cloud secret baseline

low-budget path の検索基盤は、最初から OpenSearch self-managed を抱えず、`Elastic Cloud` を前提に接続情報の保管先だけを先に固定する。

### Why secret-first

- search は derived read model なので、source of truth や reindex contract より先に cluster provisioning を持ち込まない
- low-budget path では runtime wiring より先に Secret Manager inventory を閉じた方が、後続の接続作業を小さく保てる
- `database/contracts/lin139_runtime_contracts.md` はすでに `Elastic Cloud on GCP` を第一候補にしている

### What gets created

- `prod` root に search secret 用 prerequisite check を追加
- Elastic Cloud connection material 向け Secret Manager placeholder
  - `linklynx-prod-search-elastic-api-key`
  - `linklynx-prod-search-elastic-cloud-id`
  - `linklynx-prod-search-elastic-endpoint`

### Boundary

- runtime env wiring / connectivity smoke / traffic filter は `LIN-975` に残す
- index name は runtime contract の `messages` に固定し、Secret Manager へ逃がさない
- verify / rollback は `docs/runbooks/search-low-budget-operations-runbook.md` を使う

## LIN-1026 prod-only Elastic Cloud snapshot / lifecycle ops baseline

low-budget path では Elastic Cloud の deployment provisioning までは持たず、まずは default snapshot behavior と restore boundary を documented baseline として固定する。

### What gets documented

- default `found-snapshots` repository と `cloud-snapshot-policy` を維持する方針
- same-region restore を初期復旧経路にする方針
- vendor responsibility と LinkLynx responsibility の分界
- snapshot / lifecycle / search-health の monitoring seed

### Boundary

- custom repository, cross-region restore, connectivity smoke, and full hosting comparison は `LIN-975` に残す
- secret inventory baseline は `LIN-1025` を使う
- snapshot / restore / lifecycle の verify は `docs/runbooks/search-elastic-cloud-low-budget-operations-runbook.md` を使う

## LIN-1021 prod-only Terraform deploy workflow baseline

low-budget path の deploy 実行経路は、当面 `Argo CD` ではなく GitHub Actions からの Terraform 実行に寄せる。

### Why this path

- `prod-only` の最小構成では GitOps controller 常駐コストをまだ増やしたくない
- すでに low-budget path の cluster / workload / Cloud SQL / monitoring baseline は Terraform に揃っている
- `manual approval + exact plan artifact` だけでも初期の deploy safety をかなり確保できる

### What gets created

- bootstrap project 内の `prod` 用 GitHub Terraform deployer service account
- state bucket への限定的なアクセス
- `terraform-admin` への impersonation 導線
- GitHub Actions `Infra Deploy (prod)` workflow

### Deploy contract

- `plan` と `apply` は `workflow_dispatch` で明示的に分ける
- `apply` は `main` からのみ実行可能
- `apply` は GitHub `prod` environment の approval を必須にする
- deploy input は `INFRA_PROD_TERRAFORM_TFVARS` と optional な `rust_api_image_digest` override で与える

詳細な手順と rollback は `docs/runbooks/terraform-low-budget-prod-deploy-runbook.md` を参照する。

## LIN-1016 prod-only IAM / Workload Identity / Secret Manager baseline

low-budget path では `External Secrets Operator` をまだ入れず、`Workload Identity + direct Secret Manager access` を最初の標準パターンにする。

### Why this pattern

- `prod-only` 1 cluster でまず最小権限と長期静的キー排除を成立させたい
- `LIN-1015` の Rust API smoke workload にそのままつなげられる
- 将来 `staging` や標準 path を足すときも、GSA / KSA / secret-level IAM の module を横展開しやすい

### What gets created

- workload ごとの Google service account
- KSA -> GSA binding (`roles/iam.workloadIdentityUser`)
- secret placeholder と secret-level `roles/secretmanager.secretAccessor`
- `secretmanager.googleapis.com` の `ADMIN_READ` / `DATA_READ` audit log baseline

### What stays out of scope

- secret の実値投入
- External Secrets Operator
- GitOps 連携

## LIN-1017 prod-only Cloud SQL baseline

low-budget path では `LIN-968` の `staging + prod / 4 vCPU + 16 GB` baseline をそのまま採らず、`prod-only` の単一 Cloud SQL instance から始める。

### Why a sibling issue

- `Cloud SQL` は low-budget path の中でもコスト影響が大きい
- `LIN-1014` 以降の prod-only path と、標準 path の `staging + prod` baseline を混ぜたくない
- まず `private IP + backup + PITR + deletion protection` を code 化して、app connectivity や HA は後続へ分離したい

### Baseline

- environment: `prod` only
- instance count: 1
- availability: `ZONAL`
- read replica: none
- private IP only
- backup: enabled
- PITR: enabled
- maintenance window: fixed
- deletion protection: enabled

### Cost profile note

- default tier は `db-g1-small` を bootstrap profile として置く
- これは long-term production size ではなく、初期構築と最小運用線のための profile
- traffic / migration risk / SLO が立ち上がったら、標準 path に寄せて dedicated-core + HA を検討する

### What stays out of scope

- DB password や runtime `DATABASE_URL` の実値管理
- Cloud SQL Auth Proxy 導入
- app runtime 側の TLS / connection change
- staging 常設 instance

## LIN-1018 prod-only Cloud Monitoring baseline

low-budget path の observability は、まず `Cloud Monitoring + Cloud Logging` で始める。

### Why GCP native first

- `Prometheus + Grafana + Loki` を low-budget path に最初から載せると cluster 内常駐 workload が増える
- GKE / Cloud SQL / uptime 系の基本指標は Cloud Monitoring で先に可視化できる
- `prod-only` の最小運用では dashboard / alert / logs を先に成立させる方が効果が高い

### Baseline

- dashboard: GKE workload restart, Cloud SQL CPU
- alerts: Rust API restart burst, Cloud SQL CPU high
- notification routing: optional email channel or既存 channel attach
- logs: Cloud Logging を前提に triage

### What stays out of scope

- Discord forwarder
- self-hosted metrics / logs / tracing stack
- Dragonfly / Scylla / messaging の observability

## LIN-1029 prod-only external dependency observability baseline

low-budget path では Cloud Monitoring を GKE / API / Cloud SQL の基準線にしつつ、external dependency は provider-side visibility と dependency-specific runbook で handoff する。

### What gets documented

- Scylla / Redpanda Cloud / Synadia Cloud / Elastic Cloud の first check source
- external dependency 向け alert seed
- Cloud Monitoring baseline から provider manual check へ渡す triage 導線

### Boundary

- GCP native dashboard / alert baseline は `LIN-1018` を使う
- provider onboarding や metrics ingestion automation は `LIN-972` に残す
- external dependency handoff は `docs/runbooks/external-dependency-observability-low-budget-runbook.md` を使う

## LIN-1022 prod-only Dragonfly volatile baseline

low-budget path の Dragonfly は、標準 path の stateful baseline をまだ採らず、`single replica + ClusterIP + volatile-only` で始める。

### Why this path

- Dragonfly は source of truth ではない
- low-budget path では persistence や replication より固定費削減を優先する
- ADR-005 と session/resume contract により、Dragonfly restart 時の degraded / fallback が既に定義されている

### Baseline

- namespace: `dragonfly`
- workload kind: `Deployment`
- service: `dragonfly.dragonfly.svc.cluster.local:6379`
- requests:
  - CPU `250m`
  - Memory `512Mi`
  - Ephemeral storage `1Gi`
- limits:
  - CPU `500m`
  - Memory `1Gi`
  - Ephemeral storage `2Gi`

### Scope boundary

- persistence なし
- replication なし
- PDB なし
- application runtime wiring なし

詳細な verify / rollback は `docs/runbooks/dragonfly-low-budget-operations-runbook.md` を参照する。

## LIN-1019 prod-only security baseline

low-budget path の security は、まず `Cloud Armor + Trivy + Secret Manager audit log` の組み合わせで始める。

### Why this baseline

- `Cloud Armor` policy は `LIN-963` で作られているが、backend attach と最小 WAF rule は別 issue で閉じる方が確認しやすい
- image scan は `LIN-966` で既に `Trivy` が入っているので、low-budget path では重複投資せず verify 導線を整える
- Secret access の監査は `LIN-1016` の audit log baseline を再利用する

### Baseline

- Cloud Armor backend attach: `GCPBackendPolicy`
- managed WAF rules:
  - `sqli-v33-stable` (`sensitivity = 1`)
  - `xss-v33-stable` (`sensitivity = 1`)
- image scan: `Trivy` `HIGH/CRITICAL` fail-fast
- secret access audit: `secretmanager.googleapis.com` `ADMIN_READ` / `DATA_READ`

### What stays out of scope

- DAST / bot management / VPC-SC / IAP
- 標準 path の full security program

## LIN-1030 prod-only CI security scan baseline

low-budget path では edge 側の `Cloud Armor` だけでなく、merge 前に止められる `repo secret` / `infra misconfig`
のチェックを CI に足す。

### Baseline

- repo secret scan: `Gitleaks`
- infra misconfiguration scan: `Trivy config` against `infra/`
- accepted temporary ignore:
  - `AVD-GCP-0061` (`master_authorized_networks` 未設定)
- deterministic test fixture ignore:
  - `.gitleaksignore` に fingerprint 2件だけを登録

### Why this stays narrow

- container image scan は `LIN-966` で `Trivy` が入っている
- low-budget path では false positive が強い scanner や browser-driven DAST をまだ持ち込まない
- `AVD-GCP-0061` は real finding だが、現行の GitHub Actions -> public control plane deploy を崩さずに直すには別 issue が必要

verify / triage / rollback は `docs/runbooks/ci-security-low-budget-operations-runbook.md` を参照する。

## LIN-1031 prod-only cluster network policy baseline

low-budget path では cluster 内 east-west traffic を一気に harden しすぎず、まず `rust-api-smoke` と `dragonfly` の ingress 面だけを narrow に絞る。

### Why this baseline

- `Cloud Armor` は north-south の入口保護に効くが、cluster 内の namespace 間アクセスは別の線で制御したい
- `Dragonfly` は `volatile cache/state only` 前提でも、誰からでも叩ける状態は避けたい
- default deny を cluster-wide に広げる前に、low-budget path では verify しやすい最小面積から入れる

### What gets created

- `rust-api-smoke` Pod 向け ingress-only NetworkPolicy
  - default deny ingress
  - TCP `8080` のみ許可
- `dragonfly` Pod 向け ingress-only NetworkPolicy
  - default deny ingress
  - TCP `6379` を `rust-api-smoke` namespace からのみ許可

### Current boundary

- egress 制御はまだ入れない
- cluster-wide default deny や Pod Security Admission はまだ入れない
- Dragonfly client namespace の追加は `allowed_client_namespaces` で明示的に行う

verify / rollback は `docs/runbooks/cluster-network-policy-low-budget-operations-runbook.md` を参照する。

## LIN-1020 prod-only ops baseline

low-budget path の運用は、まず「人が迷わず反応できる」ことを優先する。

### Baseline

- incident routing: Discord thread + `hirwatan` / `sabe` / `miwasa`
- primary signals:
  - Cloud Monitoring alert
  - Cloud Armor false positive / block
  - DB restore decision
- postmortem: lightweight template を必須化
- capacity planning: account count ではなく observed traffic と SLO regression を基準に見直す

### Initial assumptions

- registered users: `10,000 - 100,000`
- peak concurrent WebSocket connections: `500 - 2,000`
- sustained message ingress: `50 - 200 msg/s`
- REST latency target: `P95 <= 300ms`, `P99 <= 800ms`

### Chaos readiness

- 固定日ではなく readiness 条件で開始する
- single-cluster `prod-only` の間は、fault injection より tabletop を優先する
