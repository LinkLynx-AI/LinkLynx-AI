# インフラ設計ディスカッション

## ステータス: 議論中

---

## 1. 現状の理解（確定済み事項）

### プロダクト
- Discord クローン（リアルタイムチャット）
- 低レイテンシ・高スケーラビリティ志向

### アプリケーション構成（実装済み）
| サービス | 技術 | 役割 |
|---------|------|------|
| Frontend | Next.js 16 (App Router + FSD) | UI |
| Main API | Rust / Axum + Tokio | REST + WebSocket |
| Python Service | FastAPI | 補助（役割未確定） |
| Elixir Service | Plug + Cowboy | 補助（役割未確定） |

### データストア設計（ADR/Contract で確定済み）
| DB | 用途 | 本番想定 |
|----|------|---------|
| PostgreSQL 16 | メタデータ正データ | Cloud SQL (GCP) |
| ScyllaDB | メッセージ SoR | GCP / self-managed |
| GCS | 添付ファイル SoR | GCS (署名URL, 5分TTL) |
| Dragonfly | Session/Cache/RateLimit L2 | Redis互換 |
| Redpanda | イベントストリーム v1 | self-managed / cloud |
| NATS Core | リアルタイム配信 v0 | self-managed |
| Elastic/OpenSearch | 全文検索 (派生) | Elastic Cloud / GKE上 |

### 認証・認可（確定済み）
- AuthN: Firebase Authentication (JWT JWKS検証)
- AuthZ: fail-close 必須 → SpiceDB ハンドオフ予定（現状 noop allow-all）

### CI/CD（現状）
- CI: GitHub Actions (TypeScript/Rust/Python validate)
- CD: Docker build + smoke test → **deploy は placeholder（未接続）**

### 運用契約・ADR（確定済み）
- ADR-001: イベントスキーマ互換性（additive only）
- ADR-002: Class A/B イベント分類
- ADR-003: 検索一貫性 SLO
- ADR-004: AuthZ fail-close
- ADR-005: Dragonfly レート制限障害ポリシー
- 14本の Runbook（PITR, Scylla障害, GCS, Redpanda, Session, 監視, DR等）

---

## 2. 未決定事項（議論が必要）

### A. クラウド基盤
- [ ] GCP 一択か？マルチクラウドの可能性は？
- [ ] リージョン選定（asia-northeast1? us-central1?）
- [ ] 組織・プロジェクト構成（dev / staging / prod の分離方法）
- [ ] 予算感・コスト制約

### B. コンピュート基盤
- [ ] GKE (Kubernetes) vs Cloud Run vs GCE？
- [ ] 4サービス全部を同一クラスタに載せるか？
- [ ] ノードプール戦略（spot / preemptible の活用）
- [ ] オートスケール方針（HPA / VPA / cluster autoscaler）

### C. ネットワーク
- [ ] VPC 設計（サブネット、CIDR）
- [ ] ロードバランサー構成（L7? L4? WebSocket対応）
- [ ] CDN（Cloud CDN? Cloudflare?）
- [ ] ドメイン・DNS 管理
- [ ] TLS 証明書管理
- [ ] API Gateway の必要性

### D. データストア運用
- [ ] Cloud SQL の構成（インスタンスサイズ、HA、リードレプリカ）
- [ ] ScyllaDB のホスティング（GKE上 self-managed? ScyllaDB Cloud?）
- [ ] Dragonfly のホスティング（GKE上? Memorystore?）
- [ ] Redpanda のホスティング（GKE上? Redpanda Cloud?）
- [ ] NATS のホスティング（GKE上? Synadia Cloud?）
- [ ] OpenSearch のホスティング（Elastic Cloud? GKE上?）
- [ ] バックアップ戦略の具体実装

### E. デプロイ戦略
- [ ] IaC ツール選定（Terraform? Pulumi? Crossplane?）
- [ ] コンテナレジストリ（Artifact Registry? GitHub Container Registry?）
- [ ] デプロイ方式（Blue/Green? Canary? Rolling?）
- [ ] GitOps（ArgoCD? Flux?）の採用有無
- [ ] 環境別の構成管理（Helm? Kustomize?）
- [ ] シークレット管理（Secret Manager? Sealed Secrets?）

### F. 監視・オブザーバビリティ
- [ ] メトリクス基盤（Cloud Monitoring? Prometheus + Grafana?）
- [ ] ログ基盤（Cloud Logging? Loki?）
- [ ] トレーシング（Cloud Trace? Jaeger? Tempo?）
- [ ] アラート設計（PagerDuty? Slack? OpsGenie?）
- [ ] SLO ダッシュボード

### G. セキュリティ
- [ ] IAM 設計（サービスアカウント、Workload Identity）
- [ ] ネットワークセキュリティ（Private Service Connect, VPC-SC?）
- [ ] WAF の必要性
- [ ] DDoS 対策（Cloud Armor?）
- [ ] 脆弱性スキャン（コンテナ、依存関係）
- [ ] SAST/DAST の CI 統合

### H. 開発者体験 (DX)
- [ ] ローカル開発 → staging → 本番のフロー
- [ ] Preview 環境（PR ごと?）
- [ ] Feature flags 基盤
- [ ] DB マイグレーションの本番適用フロー

### I. スケール・パフォーマンス
- [ ] 初期想定ユーザー数
- [ ] 同時接続 WebSocket 数の見積もり
- [ ] メッセージスループット目標
- [ ] レイテンシ目標（P95, P99）

### J. 運用
- [ ] オンコール体制
- [ ] インシデント対応フロー
- [ ] ポストモーテム運用
- [ ] Chaos Engineering の導入時期

---

## 3. 議論ログ

### Round 1: 基本前提の確認（2026-03-03）

**Q: クラウドプロバイダー**
- 回答: GCP一択ではない。成長フェーズに応じてクラウド → ハイブリッド → 自社サーバーへの移行を視野に入れる
- 結論: **クラウド非依存（ポータビリティ重視）で設計する必要がある**
- 影響: GCP マネージドサービス（Cloud SQL, Memorystore等）への依存を最小化する設計が必要

**Q: 規模**
- 回答: 初期ユーザー数は未定。マーケティング次第でバイラルな急成長もあり得る
- 結論: **急激なスパイクに耐えるスケーラビリティ設計が必須**

**Q: 予算**
- 回答: 値段は一旦考えない
- 結論: **コスト最適化よりも正しいアーキテクチャを優先**

**Q: チーム**
- 回答: 構築は1人（自分）、運用は別の人
- 結論: **運用しやすさ・ドキュメント・自動化が極めて重要。属人化を避ける設計が必須**

### Round 2: 設計原則と依存関係の深堀り（2026-03-03）

**3原則の確認**: ポータビリティ・バイラル耐性・運用引き継ぎ → **確定**

**Q: Firebase Authentication**
- 回答: 議論が必要
- 現状: フロント(Web SDK) + バックエンド(JWT検証) + DB(auth_identities) と深く結合済み
- 論点: クラウド非依存を目指すなら Firebase は最大の vendor lock-in

**Q: Python / Elixir サービス**
- 回答: 実は不要かも
- 現状: 両方とも「補助」程度で明確な責務がない
- 論点: 本番サービス数の削減 → インフラ複雑性の大幅削減

**Q: ターゲットリージョン**
- 回答: グローバル
- 影響: マルチリージョン展開が必要。CDN必須。DB レプリケーション戦略が複雑化
- 参考: Discord は初期 US-East → 後にグローバル Edge + Region 分散

### Round 3: サービス構成・認証・展開戦略（2026-03-03）

**Q: サービス構成**
- 回答: Python は AI 機能で必要。Elixir は不要
- 結論: **本番は 3 サービス構成（Rust API + Next.js Frontend + Python AI/ML）**
- Elixir は本番インフラから除外

**Q: Firebase**
- 回答: ベストプラクティスであれば使ってよい
- 結論: **Firebase は認証レイヤーとして維持。ただしインフラ設計ではアプリ層の抽象化（Authorizer trait 等）を通じて将来の置き換え可能性を確保**
- Firebase は SaaS なのでインフラ側での構築不要。JWT 検証のみ

**Q: グローバル展開**
- 回答: 初期は1リージョン
- 結論: **Phase 1 は単一リージョン。ただしマルチリージョン拡張を妨げない設計にする**
- リージョン選定は次の議論で決定

### Round 4: コンピュート・リージョン・IaC・データストア・GitOps（2026-03-03）

**Q: Kubernetes 経験**
- 回答: ほぼ未経験
- 影響: フル K8s 運用は学習コスト大。GKE Autopilot 等のマネージド層が必要

**Q: 初期リージョン**
- 回答: us-east1（米国東部）
- 結論: **GCP us-east1 で開始**（Discord と同じ戦略）
- 理由: グローバル平均レイテンシ最適、クラウドサービスの充実度

**Q: IaC ツール**
- 回答: Terraform
- 結論: **Terraform で IaC 管理**
- 補足: OpenTofu への移行も容易（HCL互換）

**Q: K8s 戦略**
- 回答: わからないので説明してほしい → Autopilot の説明実施
- 結論: **GKE Autopilot で開始**（ノード管理不要、K8s 学習コスト最小化）
- 将来: Standard → Self-hosted への段階的移行パス確保

**Q: データストア運用**
- 回答: ハイブリッド
- 結論: 各 DB ごとにマネージド / セルフマネージドを選定
  - **PostgreSQL → Cloud SQL**（マネージド。PITR/HA/バックアップ自動）
  - **ScyllaDB → ScyllaDB Cloud or GCE 専用インスタンス**（K8s 外。Autopilot制限回避）
  - **Dragonfly → K8s 上 StatefulSet**（Redis互換、軽量）
  - **Redpanda → K8s 上 Helm chart**（公式 Operator あり）
  - **NATS → K8s 上 Helm chart**（軽量、K8s native）
  - **OpenSearch → Elastic Cloud or K8s 上**（初期は Elastic Cloud 推奨）
  ※上記は提案。各 DB の選定は別途議論
  → **同意済み**

**Q: GitOps**
- 回答: おまかせ
- 推奨: **ArgoCD**
  - 理由: UI があり運用引き継ぎに有利、K8s デファクト、Helm/Kustomize 対応
  - GitHub Actions で Docker build → Artifact Registry push → ArgoCD が K8s にデプロイ
  - 運用者は ArgoCD UI でデプロイ状態を可視化できる

**Q: ドメイン**
- 回答: 取得済み
- TODO: 具体的なドメイン名を確認し、DNS設計に反映

**Q: アラート通知先**
- 回答: 後で決める
- 保留: 監視ツール選定後に決定

### Round 5: ネットワーク・監視・シークレット（2026-03-03）

**Q: ネットワーク/CDN/WAF**
- 回答: Cloudflare 同意
- 結論: **Cloudflare (DNS + CDN + WAF + DDoS) → GCP Global LB → GKE Autopilot**
- Cloudflare はクラウド非依存。将来の移行でもそのまま使える

**Q: 監視スタック**
- 回答: おまかせ
- 推奨: **Prometheus + Grafana（K8s 上 self-hosted）**
  - 理由:
    1. 既存 Runbook が Prometheus メトリクス形式を前提としている
    2. K8s 上の kube-prometheus-stack Helm chart で一括デプロイ可能
    3. ポータビリティ: どのクラウドでもベアメタルでも同じスタック
    4. 業界標準。運用引き継ぎしやすい
  - 構成:
    - Prometheus: メトリクス収集
    - Grafana: ダッシュボード・可視化
    - Alertmanager: アラート配信
    - Loki: ログ集約（Grafana スタック統合）
    - Tempo: 分散トレーシング（将来追加）

**Q: シークレット管理**
- 回答: おまかせ
- 推奨: **External Secrets Operator + GCP Secret Manager**
  - 理由:
    1. Secret Manager にシークレットを一元管理
    2. External Secrets Operator が自動的に K8s Secret へ同期
    3. 将来 AWS 移行時は AWS Secrets Manager に切り替えるだけ（ESO は両対応）
    4. Git にシークレットが一切入らない

### Round 6: 環境・マニフェスト管理・デプロイ（2026-03-03）

**Q: 環境分離**
- 回答: dev + staging + prod の3環境
- 結論: **GCP プロジェクトを環境ごとに分離**
  - `linklynx-dev` / `linklynx-staging` / `linklynx-prod`
  - 各環境に GKE Autopilot クラスタを1つずつ
  - Terraform workspace または directory で環境別管理

**Q: K8s マニフェスト管理**
- 回答: おまかせ
- 推奨: **Helm + Kustomize 併用**
  - サードパーティ（Prometheus, ArgoCD, NATS, Redpanda 等）→ Helm chart
  - 自社アプリ（Rust API, Next.js, Python AI）→ Kustomize（base + overlays/dev,staging,prod）
  - 理由: Kustomize は K8s ネイティブでシンプル。自社アプリのパラメータは少ないので Helm のテンプレート機能は不要

**Q: コンテナレジストリ**
- 回答: おまかせ
- 推奨: **GCP Artifact Registry**
  - 理由: GKE との認証統合が自動。脆弱性スキャン内蔵。マルチリージョンレプリケーション対応
  - CI (GitHub Actions) → Artifact Registry push → ArgoCD が pull

**Q: デプロイ方式**
- 回答: おまかせ
- 推奨: **Canary デプロイ（Argo Rollouts）**
  - 理由:
    1. リアルタイムチャットではゼロダウンタイムが必須
    2. 新バージョンを 10% → 50% → 100% と段階的に展開
    3. メトリクスベースの自動判定（エラー率が高ければ自動ロールバック）
    4. WebSocket の graceful drain にも対応
  - フロー: merge to main → CI build → image push → ArgoCD detect → Canary rollout

### Round 7: DB マイグレーション・最終確認（2026-03-03）

**Q: DB マイグレーション本番フロー**
- 回答: おまかせ
- 推奨: **CI で検証 → 手動承認 → 自動実行のハイブリッド**
  1. PR 作成時: CI が migration の dry-run + schema diff を生成
  2. staging 自動適用: staging 環境で自動実行 + smoke test
  3. prod 手動承認: GitHub Actions の manual approval gate
  4. prod 自動実行: 承認後に sqlx migrate run を自動実行
  - forward-only 原則は維持。失敗時は corrective forward migration

**Q: 漏れ確認**
- 回答: 特になし
- 結論: 主要論点は全て議論済み

---
