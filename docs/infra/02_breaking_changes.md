# 既存設計からの変更点と議論が必要な項目

## 概要

新しいインフラ決定事項（`01_decisions.md`）は、既存の ADR / Contract / Runbook と**大部分で整合している**。
既存ドキュメントの多くはアプリケーション層の設計であり、インフラ非依存のため影響を受けない。

ただし、以下の **6つの領域** で既存設計との乖離・変更が発生する。
それぞれのメリット・デメリットと議論ポイントを記載する。

---

## 変更 1: Elixir サービスの本番除外

### 既存設計
- `docker-compose.yml`: Elixir サービスが定義済み（:4000）
- `Makefile`: `elixir-dev`, `elixir-build`, `elixir-deps`, `elixir-test` コマンドが存在
- `README.md`: 4サービス構成（TypeScript / Rust / Python / Elixir）として記載
- `.github/workflows/ci.yml`: Elixir の CI ジョブは未定義（Python までで止まっている）

### 新決定
- 本番は **3サービス構成**（Rust + Next.js + Python）。Elixir は本番から除外

### メリット
- インフラ複雑性の削減（コンテナ 4 → 3、監視対象減少）
- CI/CD パイプラインのシンプル化
- 運用コスト削減（リソース消費、障害点の減少）
- Elixir 人材確保の困難さを回避

### デメリット
- BEAM VM の強み（数百万同時接続、ホットコードスワップ、fault tolerance）を手放す
- 将来リアルタイム Pub/Sub Gateway として Elixir が最適な場面が来る可能性がある
- 既存の Elixir コード（学習投資）が無駄になる

### 議論ポイント
- **BEAM の同時接続性能は本当に不要か？** Rust + Tokio でも高い同時接続は可能だが、BEAM の supervision tree による耐障害性は独自の強み
- **リアルタイム配信の将来設計**: NATS Core が v0 で使われているが、v1 以降でリアルタイム Gateway を誰が担当するか
- **判断**: 現時点で Elixir に明確な責務がなく、Rust で同等の機能が実現可能であれば除外は合理的。ただし将来の再導入パスは残す

---

## 変更 2: PostgreSQL のホスティング（self-managed → Cloud SQL）

### 既存設計
- `docker-compose.yml`: `postgres:16-alpine` イメージで自前運用
- `database/contracts/lin588_postgres_operations_baseline.md`:
  - forward-only migration
  - 接続プール管理（`pool_in_use_ratio` 監視）
  - PITR: RPO 15分 / RTO 1時間
  - 記述はインフラ非依存だが、`pg_dump` / `psql` 等の直接操作を前提としている
- `docs/runbooks/postgres-pitr-runbook.md`: restore 手順が生の PostgreSQL コマンドベース

### 新決定
- **Cloud SQL（GCP マネージド）** でホスティング

### メリット
- 自動 HA（リージョン内フェイルオーバー）
- 自動バックアップ・PITR（GCP が管理）
- OS パッチ・マイナーバージョンアップの自動化
- 接続プール管理が不要に近い（Cloud SQL Proxy + Alloy DB 系の最適化）
- 運用者（非構築者）にとっての負荷が劇的に低い

### デメリット
- **ベンダーロックイン**: Cloud SQL は GCP 専用。AWS 移行時は RDS、自社サーバー移行時は self-managed PostgreSQL への切り替えが必要
- **コスト**: self-managed より高い（特に HA 構成は 2 倍近く）
- **制約**: 一部の PostgreSQL 拡張が使えない（`pg_cron` 等、Cloud SQL 非対応のものがある）
- **運用手順の乖離**: 既存 Runbook の `pg_dump` / `psql` 直接操作が `gcloud sql` コマンドに置き換わる
- **ポータビリティ原則との矛盾**: クラウド非依存を目指しているのに、最も重要な DB がクラウドマネージドに依存

### 議論ポイント
- **ポータビリティとのトレードオフ**: マネージド PostgreSQL は全クラウドに存在する（Cloud SQL / RDS / Azure Database）。抽象化レイヤー（接続文字列 + migration ツール）で吸収可能か？
- **Runbook の更新**: PITR runbook を Cloud SQL 固有のコマンドに書き換える必要がある
- **代替案: K8s 上の CloudNativePG (Operator)**
  - K8s Operator で PostgreSQL を管理する OSS
  - ポータビリティは最高だが、運用負荷が Cloud SQL より高い
  - バックアップ・PITR は自前で設定が必要

---

## 変更 3: ScyllaDB のホスティング（docker-compose → 外部サービス）

### 既存設計
- `docker-compose.yml`: `scylladb/scylla:5.4` をローカルで起動
- `database/contracts/lin589_scylla_sor_partition_baseline.md`:
  - `NetworkTopologyStrategy { dc1: 3 }` レプリケーション
  - パーティション設計: Latest-N P95 <= 500ms
  - 自前クラスタ管理を想定した記述
- `docs/runbooks/scylla-node-loss-backup-runbook.md`:
  - ノード障害時の Quorum 判定
  - snapshot / restore 手順が self-managed 前提

### 新決定
- **ScyllaDB Cloud or GCE 専用インスタンス**（K8s 外）

### メリット
- GKE Autopilot の制限（DaemonSet 不可、ストレージ制約）を回避
- ScyllaDB Cloud なら運用負荷が大幅に低下
- 専用ハードウェアで I/O 性能を最大化（K8s のノイジーネイバー問題を回避）

### デメリット
- **ScyllaDB Cloud**: ベンダーロックイン + 高コスト
- **GCE 専用インスタンス**: 自前でノード管理・スケーリング・バックアップが必要
- **K8s エコシステムから外れる**: ArgoCD / GitOps の管理対象外になる。Terraform 側で別途管理が必要
- **ネットワーク**: K8s クラスタと外部 ScyllaDB 間のレイテンシ・セキュリティ（VPC Peering / Private Service Connect が必要）

### 議論ポイント
- **ScyllaDB Cloud vs GCE self-managed**: 運用負荷 vs コスト vs ポータビリティのバランス
- **ScyllaDB Operator on K8s**: GKE Standard に移行後なら K8s 上での運用も可能。Autopilot の制限が理由なら、将来 Standard に移行した時点で再検討できる
- **初期フェーズでは ScyllaDB は本当に必要か？**: メッセージ量が少ない初期は PostgreSQL の JSONB でも対応可能。ScyllaDB はスケール問題が顕在化してからでも遅くない

---

## 変更 4: 監視スタック（未定義 → Prometheus + Grafana + Loki）

### 既存設計
- `docs/runbooks/observability-v0-structured-logs-metrics-runbook.md`:
  - Prometheus 形式のメトリクス名（`api_request_total`, `ws_connections_active` 等）を定義
  - ダッシュボード最小パネルを定義（9 パネル）
  - **ただし、具体的なデプロイ方法・ツール選定は未決定**
- `README.md`: 監視に関する記述なし

### 新決定
- **Prometheus + Grafana + Alertmanager + Loki**（K8s 上 self-hosted）

### メリット
- 既存 Runbook のメトリクス定義とそのまま整合する
- ポータビリティ: どのクラウド / ベアメタルでも動く
- 業界標準。運用引き継ぎしやすい（人材確保容易）
- kube-prometheus-stack Helm chart で一括デプロイ可能
- コスト: OSS なのでソフトウェア費用ゼロ

### デメリット
- **運用負荷**: self-hosted なのでストレージ管理・スケーリング・アップグレードが自前
- **長期保持**: Prometheus はデフォルトで 15 日保持。長期保持には Thanos / Mimir / Cortex 等の追加構成が必要
- **学習コスト**: PromQL、Grafana ダッシュボード作成、Alertmanager の設定
- **代替案との比較**:
  - GCP Cloud Monitoring: セットアップ不要、GKE ネイティブ統合、だがベンダーロックイン
  - Grafana Cloud: SaaS で運用負荷ゼロ、だが有料（$0/月の Free tier あり、制限あり）
  - Datadog: 高機能だが高コスト（ホスト単位課金）

### 議論ポイント
- **Prometheus の長期保持**: メトリクスを何日間保持するか？15 日で足りるか、90 日以上必要か
- **Grafana Cloud Free tier で十分か？**: 10k metrics/月、50GB logs/月の無料枠がある。初期はこれで十分な可能性
- **self-hosted vs SaaS**: ポータビリティ原則を重視するなら self-hosted だが、運用負荷と天秤にかける必要あり

---

## 変更 5: CI/CD パイプラインの大幅刷新

### 既存設計
- `.github/workflows/ci.yml`:
  - TypeScript / Rust / Python の validate（lint + test + build）のみ
  - コンテナイメージのビルド・プッシュなし
  - Terraform / K8s マニフェストの検証なし
- `.github/workflows/cd.yml`:
  - `docker compose build` + smoke test
  - **Deploy ジョブが Placeholder**（`echo "Deploy step is not connected yet."`)

### 新決定
- CI: GitHub Actions → lint/test/build + Docker build → **Artifact Registry push** + **Terraform validate**
- CD: **ArgoCD** が K8s マニフェスト変更を検知 → **Argo Rollouts で Canary デプロイ**
- DB migration: CI 検証 → staging 自動 → prod 手動承認 → 自動実行

### メリット
- 完全自動化されたデプロイパイプライン
- Canary デプロイでリスク最小化（エラー率ベースの自動ロールバック）
- GitOps: Git が唯一の真実の源。手動操作不要
- ArgoCD の UI で運用者がデプロイ状態を可視化できる
- DB migration の段階的適用（staging → 承認 → prod）

### デメリット
- **複雑性の大幅増加**: 既存の 58 行の CI + 40 行の CD が、数百行 + ArgoCD + Argo Rollouts + Terraform に拡大
- **学習コスト**: ArgoCD、Argo Rollouts、Helm、Kustomize、Terraform すべてを理解する必要がある
- **デバッグの困難さ**: パイプラインが複雑になるとデプロイ失敗時の原因特定が難しい
- **過剰設計のリスク**: 初期ユーザー数が少ないフェーズで Canary デプロイが本当に必要か？
- **代替案**:
  - シンプルに GitHub Actions から `kubectl apply` する Push 型デプロイ（GitOps なし）
  - Rolling Update（K8s デフォルト）で十分な可能性

### 議論ポイント
- **段階的導入は可能か？**
  1. Phase 1: GitHub Actions → `kubectl apply`（最もシンプル）
  2. Phase 2: ArgoCD 導入（GitOps 化）
  3. Phase 3: Argo Rollouts 導入（Canary）
  - この段階的アプローチなら初期の複雑性を抑えられる
- **Canary の判定基準**: どのメトリクスで成功/失敗を判定するか（エラー率? レイテンシ? WebSocket 切断率?）

---

## 変更 6: シークレット管理の変更（.env → External Secrets + Secret Manager）

### 既存設計
- `.env.example`: 全環境変数をファイルで定義（52 行）
- `docker-compose.yml`: `.env` から直接読み込み
- Firebase キー、DB パスワード等が `.env` ファイルに平文で記載

### 新決定
- **GCP Secret Manager** + **External Secrets Operator** で K8s Secret に自動同期

### メリット
- シークレットが Git に入らない（セキュリティ向上）
- 監査ログ: Secret Manager で誰がいつアクセスしたか追跡可能
- ローテーション: Secret Manager でシークレットのバージョン管理・ローテーションが可能
- K8s ネイティブ: アプリからは通常の K8s Secret として参照するだけ

### デメリット
- **ローカル開発との乖離**: 開発は `.env`、本番は Secret Manager。環境差異が発生する
- **追加コンポーネント**: External Secrets Operator の運用が増える
- **GCP 依存**: Secret Manager は GCP サービス。ポータビリティ原則との矛盾
  - ただし ESO は AWS Secrets Manager / Azure Key Vault / Vault にも対応しているため、バックエンド切り替えは容易
- **初期セットアップコスト**: Secret Manager にすべてのシークレットを登録する作業が必要

### 議論ポイント
- **ローカル開発フロー**: 開発者は引き続き `.env` を使い、本番だけ Secret Manager にするのが現実的
- **Vault（HashiCorp）vs Secret Manager**: Vault はクラウド非依存だが運用負荷が高い。Secret Manager + ESO の組み合わせならクラウド間移行も容易

---

## 影響まとめ

### 更新が必要な既存ドキュメント

| ドキュメント | 更新内容 | 優先度 |
|------------|---------|--------|
| `AGENTS.md` | `docs/infra/01_decisions.md` への参照追加 | 高 |
| `README.md` | 本番環境は `docs/infra/` 参照と脚注追加 | 中 |
| `docs/runbooks/postgres-pitr-runbook.md` | Cloud SQL 固有コマンド例を追加 | 中 |
| `docs/runbooks/scylla-node-loss-backup-runbook.md` | ScyllaDB Cloud オプション追加 | 中 |
| `docs/runbooks/edge-rest-ws-routing-drain-runbook.md` | GCP LB / GKE Ingress 設定例追加 | 中 |
| `docs/runbooks/dr-v0-recovery-tabletop-velero-runbook.md` | Velero + GCS バックエンド設定追加 | 低 |
| `.github/workflows/ci.yml` | Artifact Registry push + Terraform validate 追加 | Phase 1 |
| `.github/workflows/cd.yml` | ArgoCD デプロイに置き換え | Phase 1 |

### 変更なしで整合する既存ドキュメント

| ドキュメント | 理由 |
|------------|------|
| ADR-001〜005 | アプリケーション層の設計。インフラ非依存 |
| DB Contracts（全14本） | スキーマ・運用ポリシー。インフラ非依存 |
| `docs/RUST.md` | コーディング規約。インフラ非依存 |
| `docs/PYTHON.md` | コーディング規約。インフラ非依存 |
| `docs/runbooks/observability-v0-*` | Prometheus 形式前提。新決定と完全整合 |
| `docs/runbooks/session-resume-*` | Dragonfly 契約。ホスティング方式非依存 |

---
