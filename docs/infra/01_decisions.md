# インフラ設計 決定事項サマリー

## ステータス: 議論完了 → 設計フェーズへ

議論ログ: [00_discussion.md](./00_discussion.md)

---

## 設計原則

| # | 原則 | 説明 |
|---|------|------|
| 1 | **ポータビリティ** | クラウド → ハイブリッド → 自社サーバーへの移行パスを常に確保 |
| 2 | **バイラル耐性** | 予測不能なスパイクに耐えるスケーラビリティ |
| 3 | **運用引き継ぎ** | 構築者 ≠ 運用者。すべてコード化・ドキュメント化・自動化 |

---

## アーキテクチャ全体像

```
                        ┌─────────────┐
                        │   ユーザー    │
                        └──────┬──────┘
                               │
                    ┌──────────▼──────────┐
                    │    Cloudflare        │
                    │  DNS + CDN + WAF     │
                    │  + DDoS 防御         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  GCP Global LB (L7)  │
                    │  WebSocket 対応       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────┐
     │  Next.js (SSR)  │ │  Rust API   │ │  Python AI   │
     │  Frontend       │ │  REST + WS  │ │  ML Service  │
     │  :3000          │ │  :8080      │ │  :8000       │
     └────────────────┘ └─────┬──────┘ └──────────────┘
                              │
         ┌─────────┬──────────┼──────────┬─────────┐
         │         │          │          │         │
    ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌────▼───┐ ┌───▼────┐
    │Postgres│ │ScyllaDB│ │Dragon│ │Redpanda│ │  NATS  │
    │CloudSQL│ │  外部   │ │ fly  │ │  K8s   │ │  K8s   │
    └────────┘ └────────┘ └──────┘ └────────┘ └────────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ OpenSearch │
                                              │ (派生検索)  │
                                              └───────────┘
```

---

## 決定事項一覧

### 1. サービス構成

| サービス | 技術 | 本番運用 | 備考 |
|---------|------|---------|------|
| Frontend | Next.js 16 | ○ | SSR + 静的アセット |
| Main API | Rust / Axum | ○ | REST + WebSocket。コアサービス |
| AI/ML | Python / FastAPI | ○ | AI 機能用 |
| Elixir | Plug + Cowboy | ✕ | **本番から除外** |

### 2. クラウド・リージョン

| 項目 | 決定 |
|------|------|
| 初期クラウド | **GCP** |
| 初期リージョン | **us-east1**（米国東部） |
| マルチリージョン | Phase 1 では単一リージョン。拡張を妨げない設計 |
| 長期方針 | クラウド非依存。将来の移行を前提に抽象化 |
| Bootstrap / State | **`linklynx-bootstrap` project + GCS state bucket** を採用。runtime 環境とは分離 |

### 3. コンピュート

| 項目 | 決定 |
|------|------|
| 基盤 | **GKE Autopilot** |
| 段階 | Autopilot → Standard → Self-hosted (成長に応じて) |
| 環境 | **dev + staging + prod**（3環境、GCPプロジェクト分離） |
| 標準 path cluster baseline | **`staging` / `prod` に 1 cluster ずつ** |
| 標準 path namespace baseline | **`frontend` / `api` / `ai` / `data` / `ops` / `observability`** |
| autoscaling baseline | **VPA primary / HPA later**。`ai` は spot-ready、core path は通常 capacity |

### 4. データストア

| DB | ホスティング | 理由 |
|----|------------|------|
| **PostgreSQL** | Cloud SQL（マネージド） | PITR/バックアップ自動。標準 path は `staging=ZONAL / prod=REGIONAL(HA)`、初期 read replica なし。low-budget path は `prod-only` 単一 instance から開始 |
| **ScyllaDB** | ScyllaDB Cloud or GCE 専用 | K8s 外。Autopilot の制限回避。low-budget path は external Scylla の runtime wiring と ops baseline を先に整える |
| **Dragonfly** | K8s 上（標準 path は StatefulSet、low-budget path は volatile single Deployment） | 軽量。Redis 互換 |
| **Redpanda** | Redpanda Cloud（標準 path） | low-budget path は Secret Manager placeholder と ops baseline を先に整える |
| **NATS** | Synadia Cloud（標準 path） | low-budget path は Secret Manager placeholder と ops baseline を先に整える |
| **OpenSearch** | Elastic Cloud（初期） | 運用負荷回避。将来 K8s 上も可。low-budget path は Elastic Cloud secret placeholder と snapshot / lifecycle baseline を先に整える |

### 5. 認証・認可

| 項目 | 決定 |
|------|------|
| AuthN | **Firebase Authentication 維持** |
| AuthZ | **SpiceDB ハンドオフ予定**（現状 noop） |
| 方針 | Firebase がベストプラクティスである限り使用。アプリ層の抽象化で将来の置き換え可能性確保 |

### 6. ネットワーク・セキュリティ

| 項目 | 決定 |
|------|------|
| DNS + CDN | **Cloudflare** |
| WAF + DDoS | **Cloudflare** |
| ロードバランサー | **GCP Global HTTP(S) LB**（WebSocket 対応） |
| TLS | Cloudflare（エッジ）+ GCP managed cert（オリジン） |
| ドメイン | 取得済み（具体名は別途確認） |
| low-budget CI security scan | **Gitleaks（repo secret）+ Trivy config（`infra/` misconfig）** |
| low-budget cluster ingress isolation | **Kubernetes NetworkPolicy baseline**（`rust-api-smoke:8080 only`, `dragonfly:6379 only from rust-api-smoke`） |

### 7. CI/CD・デプロイ

| 項目 | 決定 |
|------|------|
| IaC | **Terraform 単体**（Phase 1〜3）→ 必要に応じて Terragrunt 導入（Phase 4〜） |
| CI | **GitHub Actions**（既存を拡張） |
| コンテナレジストリ | **GCP Artifact Registry** |
| GitOps | **ArgoCD** |
| マニフェスト管理 | **Helm（サードパーティ）+ Kustomize（自社アプリ）** |
| デプロイ方式 | **Canary（Argo Rollouts）** |
| standard path promotion gate | **staging auto-sync / prod manual sync** |
| DB マイグレーション | CI 検証 → staging 自動 → prod 手動承認 → 自動実行 |
| low-budget deploy path | **GitHub Actions + Terraform plan/apply + `prod` manual approval** |

### 8. 監視・オブザーバビリティ

| 項目 | 決定 |
|------|------|
| メトリクス | **Prometheus**（標準 path） / **Cloud Monitoring**（low-budget `prod-only` path） |
| ダッシュボード | **Grafana**（標準 path） / **Cloud Monitoring dashboard**（low-budget path） |
| アラート | **Alertmanager**（標準 path） / **Cloud Monitoring alert policy**（low-budget path） |
| ログ | **Loki**（標準 path） / **Cloud Logging**（low-budget path） |
| external dependency visibility | **provider manual checks + dependency-specific runbook**（low-budget path） |
| トレーシング | **Tempo**（将来追加） |
| 通知先 | 後で決定 |

### 9. シークレット管理

| 項目 | 決定 |
|------|------|
| バックエンド | **GCP Secret Manager** |
| low-budget baseline | **Workload Identity + direct Secret Manager access** |
| standard baseline | **Workload Identity + direct Secret Manager access**（`frontend` / `api` / `ai` の workload-scoped identity） |
| 標準 path 拡張 | **External Secrets Operator** を後続で検討 |
| 方針 | Git にシークレットは入れない。初期は長期静的キーを排除し、secret-level IAM と audit log を優先する |

### 10. 運用 baseline

| 項目 | 決定 |
|------|------|
| low-budget incident flow | **Discord thread + `hirwatan` / `sabe` / `miwasa` mention** |
| postmortem | **軽量 template を使って毎回残す** |
| capacity trigger | **登録者数ではなく observed traffic / latency / DB pressure を優先** |
| Chaos Engineering | **固定日ではなく readiness 条件が揃ってから開始** |

---

## フェーズ計画（概要）

### Phase 1: 基盤構築
- Terraform で GCP プロジェクト・VPC・GKE Autopilot を構築
- Cloud SQL (PostgreSQL) セットアップ
- Artifact Registry セットアップ
- 基本的な K8s マニフェスト（Kustomize）作成
- GitHub Actions → Artifact Registry の CI パイプライン

### Phase 2: アプリケーションデプロイ
- Rust API / Next.js / Python を K8s にデプロイ
- Cloud Load Balancer + Cloudflare 接続
- External Secrets Operator セットアップ
- DB マイグレーション自動化

### Phase 3: データストア・ミドルウェア
- Dragonfly を K8s にデプロイ
- Redpanda Cloud / Synadia Cloud 接続 / ops baseline を整備
- ScyllaDB セットアップ / ops baseline（K8s 外）
- Elastic Cloud 接続 / snapshot baseline

### Phase 4: GitOps・監視
- ArgoCD + Argo Rollouts セットアップ
- Prometheus + Grafana + Loki スタックデプロイ
- アラート設定
- Canary デプロイフロー確立

### Phase 5: 本番準備
- staging 環境で E2E テスト
- セキュリティ監査
- 負荷テスト
- Runbook の本番環境版整備
- prod デプロイ

---

## 既存 ADR/Contract への影響

| ドキュメント | 影響 | 対応 |
|------------|------|------|
| ADR-001〜005 | 影響なし | アプリケーション層の設計。インフラ非依存 |
| Runbooks（全14本） | **GCP 固有の記述を抽象化** | Postgres PITR → Cloud SQL PITR に読み替え等 |
| DB Contracts | 影響なし | スキーマ・運用契約はインフラ非依存 |
| `.env.example` | **更新必要** | K8s / Secret Manager ベースの構成に変更 |

---
