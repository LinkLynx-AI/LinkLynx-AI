# インフラ学習ロードマップ

## 原則

- **実装順に学ぶ**。先に全部を理解しようとしない
- **手を動かして学ぶ**。ドキュメントを読むだけでは身につかない
- **1つずつ確実に**。Phase 1 が動いてから Phase 2 に進む

---

## 前提スキル（既にあるもの）

- [x] Docker（docker-compose で開発環境を構築済み）
- [x] Git / GitHub（ブランチ戦略、PR 運用済み）
- [x] GitHub Actions（CI パイプライン構築済み）
- [x] SQL / PostgreSQL（migration 運用済み）

---

## Phase 0: 土台（1〜2週間）

> Phase 1 に入る前に最低限これだけ理解する

### 0-1. GCP の基礎

**学ぶこと:**
- GCP プロジェクトの概念（dev / staging / prod 分離の土台）
- IAM（サービスアカウント、ロール、権限の仕組み）
- gcloud CLI の基本操作
- GCS（Cloud Storage）の基本（Terraform の state 保存先として使う）

**学び方:**
1. GCP 無料枠でプロジェクトを1つ作る
2. gcloud CLI をインストールして認証を通す
3. GCS バケットを CLI で作成・削除してみる
4. サービスアカウントを作って鍵を発行してみる

**公式リソース:**
- [Google Cloud Skills Boost](https://www.cloudskillsboost.google/) — 無料のハンズオンラボあり
- `gcloud` クイックスタート: `gcloud init` → `gcloud projects list` → `gcloud iam service-accounts create`

**目安: ここまでで 3〜5 日**

---

### 0-2. Terraform の基礎

**学ぶこと:**
- HCL 構文（resource, variable, output, module）
- `terraform init` → `plan` → `apply` → `destroy` のライフサイクル
- State ファイルの概念（なぜ GCS に保存するのか）
- Module の書き方と使い方

**学び方:**
1. Terraform をインストール
2. GCS バケットを Terraform で作る（最小の HCL を書く）
3. `terraform plan` で差分を確認 → `apply` で適用 → `destroy` で削除
4. 変数（variables.tf + terraform.tfvars）で値を外出しする
5. Module として分離する

**ハンズオン順序:**
```
① GCS バケットを 1 つ作る            → resource の理解
② 変数で名前を外出しする              → variable / tfvars の理解
③ state を GCS に保存する設定を書く    → backend の理解
④ module に分離する                   → module の理解
⑤ 2 つ目の環境(dev/staging)を作る     → ディレクトリ分離の理解
```

**公式リソース:**
- [Terraform GCP Getting Started](https://developer.hashicorp.com/terraform/tutorials/gcp-get-started)
- [Terraform Language Documentation](https://developer.hashicorp.com/terraform/language)

**目安: ここまでで 5〜7 日**

---

## Phase 1: GKE + VPC + Cloud SQL（2〜3週間）

> Terraform で本番インフラの骨格を作る

### 1-1. VPC ネットワーク

**学ぶこと:**
- VPC、サブネット、CIDR の概念
- ファイアウォールルール
- Private Google Access

**学び方:**
- Terraform で VPC + サブネットを作る
- 最初は GCP Console で可視化しながら理解する

### 1-2. Kubernetes の基礎

**学ぶこと（最小限）:**
- Pod = コンテナの実行単位
- Deployment = Pod の管理（レプリカ数、ローリングアップデート）
- Service = Pod への内部ネットワーク
- Ingress = 外部からのアクセスルーティング
- ConfigMap / Secret = 設定と秘密情報
- Namespace = 論理的な分離

**学び方:**
1. Terraform で GKE Autopilot クラスタを作る
2. `kubectl` をインストールして接続する
3. nginx の Deployment を手動で作ってみる（`kubectl apply -f`）
4. Service で公開する
5. スケール（`kubectl scale`）してみる
6. 削除する

**ハンズオン順序:**
```
① Terraform で GKE Autopilot を作る
② kubectl get nodes で接続確認
③ nginx を Deployment で動かす
④ Service (ClusterIP → LoadBalancer) で公開
⑤ ConfigMap で設定を注入
⑥ 自分の Rust API の Docker イメージを Deployment で動かす
```

**公式リソース:**
- [Kubernetes 公式チュートリアル](https://kubernetes.io/docs/tutorials/)
- [GKE Autopilot クイックスタート](https://cloud.google.com/kubernetes-engine/docs/how-to/creating-an-autopilot-cluster)

**やらなくていいこと（Autopilot では不要）:**
- ノードプールの設計
- OS のチューニング
- kubelet の設定
- クラスタのアップグレード手順

### 1-3. Cloud SQL

**学ぶこと:**
- Terraform で Cloud SQL インスタンスを作る
- GKE から Cloud SQL への接続（Cloud SQL Auth Proxy）
- バックアップ・PITR の設定

**学び方:**
- Terraform で Cloud SQL (PostgreSQL) を作る
- GKE 上の Pod から接続を確認する

**目安: Phase 1 全体で 2〜3 週間**

---

## Phase 2: アプリデプロイ + LB + Secrets（2〜3週間）

> 自分のアプリを K8s 上で動かす

### 2-1. Kustomize

**学ぶこと:**
- base / overlays の概念
- Deployment, Service, Ingress の YAML 記述
- 環境ごとの差分管理（overlays/dev, overlays/staging, overlays/prod）

**学び方:**
1. `base/` に Rust API の Deployment + Service を書く
2. `overlays/dev/` で dev 用のパッチを書く
3. `kubectl apply -k overlays/dev` でデプロイ
4. 同じことを Next.js, Python でも繰り返す

**ハンズオン順序:**
```
① Rust API の Kustomize マニフェストを書く
② kubectl apply -k でデプロイ → curl で動作確認
③ Next.js のマニフェストを書く
④ Python AI のマニフェストを書く
⑤ 3 サービスが K8s 上で通信できることを確認
```

### 2-2. Artifact Registry + CI 連携

**学ぶこと:**
- Terraform で Artifact Registry を作る
- GitHub Actions から Artifact Registry に Docker push する設定
- Workload Identity Federation（GitHub → GCP の認証）

**学び方:**
- 既存の CI を拡張して Docker build → push を追加する

### 2-3. External Secrets Operator

**学ぶこと:**
- Helm で ESO をインストール
- SecretStore リソース（GCP Secret Manager への接続設定）
- ExternalSecret リソース（Secret Manager → K8s Secret の同期定義）

**学び方:**
1. GCP Secret Manager にテスト用シークレットを登録
2. Helm で ESO をインストール
3. ExternalSecret を定義して K8s Secret に同期されることを確認

### 2-4. GCP Load Balancer + Cloudflare

**学ぶこと:**
- GKE Ingress リソース（GCP LB を自動作成）
- SSL 証明書の設定
- Cloudflare DNS の設定（CNAME → GCP LB の IP）

**目安: Phase 2 全体で 2〜3 週間**

---

## Phase 3: ミドルウェア（2 週間）

> NATS, Redpanda, Dragonfly を K8s に載せる

### 3-1. Helm の基礎

**学ぶこと:**
- Helm chart の概念（テンプレート + values）
- `helm repo add` → `helm install` → `helm upgrade` のライフサイクル
- values.yaml でのカスタマイズ

**学び方:**
1. NATS の公式 Helm chart をインストールする（最も軽量で練習に最適）
2. values.yaml でパラメータを変更してみる
3. `helm upgrade` で設定変更を適用
4. 同じことを Redpanda, Dragonfly で繰り返す

**順序: NATS（最も軽量）→ Dragonfly → Redpanda（最も複雑）**

---

## Phase 4: GitOps + 監視（2〜3週間）

> ArgoCD + Prometheus/Grafana を入れる

### 4-1. ArgoCD

**学ぶこと:**
- Helm で ArgoCD をインストール
- Application リソース（Git リポジトリ → K8s クラスタの同期定義）
- ArgoCD UI の使い方
- Sync Policy（手動 / 自動）

**学び方:**
1. Helm で ArgoCD をインストール
2. ArgoCD UI にログインする
3. 既に作った Kustomize マニフェストを ArgoCD Application として登録
4. Git にコミット → ArgoCD が自動検知 → K8s に反映される流れを確認

### 4-2. Argo Rollouts（Canary）

**学ぶこと:**
- Rollout リソース（Deployment の代わり）
- Canary 戦略の設定（10% → 50% → 100%）
- AnalysisTemplate（メトリクスベースの自動判定）

**学び方:**
- ArgoCD が安定してから導入する。Phase 4 の後半

### 4-3. Prometheus + Grafana

**学ぶこと:**
- kube-prometheus-stack Helm chart のインストール
- Grafana UI でのダッシュボード作成
- PromQL の基本
- Alertmanager のルール設定

**学び方:**
1. `kube-prometheus-stack` を Helm でインストール（一発で全部入る）
2. Grafana UI にログイン → K8s のデフォルトダッシュボードを確認
3. 自分のアプリのメトリクスを追加する
4. 既存 Runbook のメトリクス定義をダッシュボードに反映

---

## Phase 5: 本番準備（1〜2週間）

> 負荷テスト、セキュリティ、Runbook 整備

ここまで来たら基礎は全て身についている。あとは実践的な運用知識:
- 負荷テスト（k6 / Locust）
- セキュリティスキャン（Trivy）
- Runbook の本番版整備
- インシデント対応フローの策定

---

## 学習時間の見積もり

| Phase | 期間 | 主な学習対象 |
|-------|------|------------|
| 0 | 1〜2 週間 | GCP 基礎 + Terraform 基礎 |
| 1 | 2〜3 週間 | VPC + GKE + Cloud SQL + kubectl |
| 2 | 2〜3 週間 | Kustomize + CI/CD + ESO + LB |
| 3 | 2 週間 | Helm + NATS/Redpanda/Dragonfly |
| 4 | 2〜3 週間 | ArgoCD + Argo Rollouts + Prometheus/Grafana |
| 5 | 1〜2 週間 | 負荷テスト + セキュリティ + 運用整備 |
| **合計** | **約 10〜15 週間** | |

---

## 学習のコツ

### やるべきこと
- **毎フェーズ、実際の LinkLynx のインフラを構築しながら学ぶ**（教材用の別プロジェクトではなく）
- **Terraform コードは最初から Git 管理する**（学習過程もコミットとして残す）
- **詰まったら公式ドキュメント → Stack Overflow → GitHub Issues の順で調べる**
- **各 Phase 完了時にドキュメントを書く**（運用引き継ぎの原則）

### やらないこと
- 本や Udemy のコースを最初から最後まで通しで見る（必要な部分だけつまむ）
- 完璧に理解してから次に進もうとする（動けば次に行く）
- 複数の Phase を並行して進める（1つずつ確実に）
