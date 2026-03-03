# Terraform vs Terragrunt 比較

## そもそも何が違うのか

```
Terraform = インフラをコードで定義・構築するツール（IaC エンジン本体）
Terragrunt = Terraform の上に被せるラッパー（DRY化・複数環境管理・依存関係の自動化）
```

Terragrunt は Terraform を置き換えるものではない。Terraform の上に乗るオーケストレーション層。
Terraform なしでは動かないが、Terraform は Terragrunt なしで動く。

---

## LinkLynx-AI の前提条件

| 条件 | 値 |
|------|-----|
| 環境数 | 3（dev / staging / prod） |
| GCP プロジェクト | 環境ごとに分離（3プロジェクト） |
| 管理対象リソース | GKE Autopilot, Cloud SQL, VPC, LB, Artifact Registry, Secret Manager, IAM, Cloudflare DNS 等 |
| 将来のマルチクラウド | あり（AWS / ベアメタル移行の可能性） |
| インフラ担当 | 構築1人、運用は別の人 |
| Terraform 経験 | これから |

---

## ディレクトリ構造の比較

### 素の Terraform（ディレクトリ分離方式）

```
infra/
├── modules/                     # 再利用可能なモジュール
│   ├── gke/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloudsql/
│   ├── vpc/
│   ├── artifact-registry/
│   └── secret-manager/
│
├── environments/
│   ├── dev/
│   │   ├── main.tf              # module 呼び出し
│   │   ├── variables.tf
│   │   ├── terraform.tfvars     # dev 固有の値
│   │   ├── backend.tf           # state 保存先（dev 用 GCS bucket）
│   │   └── providers.tf
│   ├── staging/
│   │   ├── main.tf              # ← dev とほぼ同じ内容をコピー
│   │   ├── variables.tf         # ← dev とほぼ同じ
│   │   ├── terraform.tfvars     # staging 固有の値
│   │   ├── backend.tf           # state 保存先（staging 用 GCS bucket）
│   │   └── providers.tf
│   └── prod/
│       ├── main.tf              # ← またコピー
│       ├── variables.tf
│       ├── terraform.tfvars
│       ├── backend.tf
│       └── providers.tf
```

**問題点**: `main.tf`, `variables.tf`, `providers.tf` が3環境でほぼ同一内容のコピーになる

### Terragrunt

```
infra/
├── modules/                     # 再利用可能なモジュール（Terraform のまま）
│   ├── gke/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloudsql/
│   ├── vpc/
│   ├── artifact-registry/
│   └── secret-manager/
│
├── terragrunt.hcl               # ルート設定（全環境共通: provider, backend 自動生成）
│
├── environments/
│   ├── _env/
│   │   └── common.hcl           # 全環境共通の変数
│   ├── dev/
│   │   ├── env.hcl              # dev 固有の値（リージョン、インスタンスサイズ等）
│   │   ├── gke/
│   │   │   └── terragrunt.hcl   # ← 数行。module パスと dev 固有の inputs だけ
│   │   ├── cloudsql/
│   │   │   └── terragrunt.hcl
│   │   └── vpc/
│   │       └── terragrunt.hcl
│   ├── staging/
│   │   ├── env.hcl
│   │   ├── gke/
│   │   │   └── terragrunt.hcl   # ← dev と同じ構造。値だけ違う
│   │   ├── cloudsql/
│   │   └── vpc/
│   └── prod/
│       ├── env.hcl
│       ├── gke/
│       ├── cloudsql/
│       └── vpc/
```

**ポイント**: 各 `terragrunt.hcl` は数行〜十数行。共通部分はルートの `terragrunt.hcl` から継承

---

## 機能比較

| 機能 | Terraform 単体 | Terragrunt |
|------|---------------|------------|
| **DRY（重複排除）** | modules で一部可能。ただし `backend.tf`, `providers.tf` は環境ごとにコピーが必要 | **ルート `terragrunt.hcl` で backend/provider を自動生成。コピー不要** |
| **State 管理** | 手動で backend を環境ごとに設定 | **自動。環境名から GCS bucket/key を自動生成** |
| **依存関係** | module 間の依存は `depends_on` で手動管理 | **`dependency` ブロックで宣言的に管理。自動で apply 順序を決定** |
| **一括操作** | 環境ごとに `cd` して `terraform apply` を繰り返す | **`terragrunt run-all apply` で全モジュール一括デプロイ（依存順序自動）** |
| **環境間の差分** | `terraform.tfvars` で分離。ただし構造ファイルのコピーが必要 | **`env.hcl` + inputs で分離。構造ファイルのコピー不要** |
| **学習コスト** | HCL だけ学べばよい | **HCL + Terragrunt 固有の構文（include, dependency, generate 等）** |
| **ツールチェーン** | Terraform のみ | Terraform + Terragrunt の2つをインストール・バージョン管理 |
| **CI/CD 統合** | `terraform plan/apply` のみ | `terragrunt plan/apply` または `terragrunt run-all`。CI 設定が若干複雑 |
| **コミュニティ・情報量** | 圧倒的に多い | Terraform より少ない。トラブル時の情報収集がやや難しい |
| **TACOS 対応** | Terraform Cloud, Spacelift, Env0 等すべて対応 | 一部制限あり（Terraform Cloud は非対応） |

---

## このプロジェクトでの具体的な比較

### 管理対象リソース（Phase 1〜5）

| リソース | Terraform module | 環境差分 |
|---------|-----------------|---------|
| GCP プロジェクト | `project` | プロジェクト名のみ |
| VPC + サブネット | `vpc` | CIDR のみ |
| GKE Autopilot | `gke` | ノードスペック、オートスケール上限 |
| Cloud SQL | `cloudsql` | インスタンスサイズ、HA有無 |
| Artifact Registry | `artifact-registry` | ほぼ同一 |
| Secret Manager | `secret-manager` | シークレット値のみ |
| Cloud LB + SSL | `lb` | ドメイン名 |
| IAM | `iam` | ほぼ同一 |
| Cloudflare DNS | `cloudflare` | レコード値のみ |

**観察**: 環境間の差分はほとんどが「値の違い」だけ。構造は同一。

### Terraform 単体の場合のコード量見積もり

```
modules/     : 9 modules × 平均 80行 = 約 720行
environments/: 3環境 × (main.tf + variables.tf + backend.tf + providers.tf + tfvars)
             = 3環境 × 約 150行 = 約 450行
合計: 約 1,170行
重複: 約 300行（main.tf, variables.tf, providers.tf のコピー × 3環境）
```

### Terragrunt の場合のコード量見積もり

```
modules/        : 同じ 720行
terragrunt.hcl  : ルート 約 30行
environments/   : 3環境 × (env.hcl + 9 modules × terragrunt.hcl 約 10行)
                = 3環境 × 約 120行 = 約 360行
合計: 約 1,110行
重複: ほぼ 0行
```

---

## メリット・デメリット詳細

### Terraform 単体

#### メリット
1. **シンプル**: 学ぶものが1つだけ（HCL）
2. **情報量が多い**: Stack Overflow、公式ドキュメント、ブログ記事が豊富
3. **運用引き継ぎが容易**: Terraform を知っている人は多い。Terragrunt を知っている人は少ない
4. **CI/CD がシンプル**: `terraform plan` → `terraform apply` だけ
5. **依存ツールなし**: Terragrunt のバージョン互換性問題が発生しない
6. **Terraform Cloud / Spacelift 等のマネージドサービスがフル対応**

#### デメリット
1. **DRY 違反**: `backend.tf`, `providers.tf`, `main.tf` が環境ごとにコピーされる
2. **State 管理が手動**: 環境ごとに backend 設定を手書き
3. **一括操作不可**: 環境 × モジュール数の `cd` + `apply` が必要
4. **設定ドリフト**: コピーされたファイルが環境間で意図せず乖離するリスク
5. **スケール時の限界**: 環境 × リージョンが増えると管理が爆発する

### Terragrunt

#### メリット
1. **DRY**: 共通設定を1箇所に集約。環境固有の値だけ各 `env.hcl` に記載
2. **State 自動管理**: GCS bucket 名やキーを自動生成。手動設定不要
3. **依存関係の宣言的管理**: `dependency` ブロックで「VPC → GKE → アプリ」の順序を自動化
4. **`run-all`**: `terragrunt run-all apply` で全モジュール・全環境を依存順に一括デプロイ
5. **マルチクラウド展開時に真価を発揮**: AWS リージョン追加時もディレクトリ構造のコピーだけ
6. **v0.80 でパフォーマンス改善**: 42% 高速化、43% メモリ削減

#### デメリット
1. **学習コストが高い**: Terraform + Terragrunt の両方を理解する必要がある
2. **デバッグが難しい**: エラーが Terraform 由来か Terragrunt 由来かの切り分けが必要
3. **コミュニティが小さい**: トラブル時に参考情報が Terraform 単体より少ない
4. **運用引き継ぎのハードル**: 「Terragrunt を知っている」運用者を見つけるのが難しい
5. **ツールバージョン管理**: Terraform と Terragrunt の互換性を常に意識する必要がある
6. **Terraform Cloud 非対応**: マネージド TACOS を使いたい場合に制限がある
7. **過剰設計リスク**: 3環境 × 9モジュール程度なら素の Terraform でも十分管理可能

---

## このプロジェクトへの推奨

### 判定基準

| 基準 | Terraform | Terragrunt | 備考 |
|------|-----------|------------|------|
| 学習コスト | ○ 低い | △ 高い | K8s 未経験 + Terraform 未経験の状態で Terragrunt も加えるのは重い |
| 運用引き継ぎ | ○ 人材多い | △ 人材少ない | 「構築者≠運用者」の原則に直結 |
| DRY | △ 重複あり | ○ 重複なし | 3環境 × 9モジュール = 27回の apply だが管理可能な範囲 |
| スケーラビリティ | △ 環境増で辛い | ○ 強い | マルチリージョン展開時に差が出る |
| ポータビリティ | ○ どこでも | ○ どこでも | 両方ともクラウド非依存 |
| デバッグ容易性 | ○ シンプル | △ 複雑 | 初心者にとって重要 |
| CI/CD 統合 | ○ シンプル | △ やや複雑 | GitHub Actions との統合 |

### 推奨: 段階的アプローチ

```
Phase 1〜3: Terraform 単体（ディレクトリ分離方式）
  ↓ マルチリージョン展開 or 環境数増加で管理が辛くなったら
Phase 4〜:  Terragrunt に移行
```

**理由:**
1. 今の規模（3環境 × 9モジュール）なら Terraform 単体で十分管理可能
2. K8s + Terraform + ArgoCD + Helm + Kustomize を同時に学ぶ負荷が既に大きい。さらに Terragrunt を加えるのは過剰
3. Terraform のモジュールをきちんと作れば、後から Terragrunt を被せるのは容易（Terraform モジュールはそのまま流用できる）
4. 運用者への引き継ぎを考えると、学ぶべきツールは少ないほうが良い

### ただし、最初から Terragrunt が適切なケース

以下のいずれかに該当するなら、Phase 1 から Terragrunt を採用すべき:

- **初期から5環境以上ある**（dev / staging / prod / perf / dr 等）
- **初期からマルチリージョン**（us-east1 + asia-northeast1 + eu-west1）
- **Terragrunt 経験者がチームにいる**
- **複数の GCP プロジェクト × 複数リージョンの組み合わせが確定している**

---

## 参考

- [Terragrunt vs. Terraform - Spacelift](https://spacelift.io/blog/terragrunt-vs-terraform)
- [Why I Use Terragrunt Over Terraform/OpenTofu in 2025](https://www.axelmendoza.com/posts/terraform-vs-terragrunt/)
- [How to Understand Terragrunt vs Terraform](https://oneuptime.com/blog/post/2026-02-23-how-to-understand-terragrunt-vs-terraform/view)
- [Terragrunt vs Terraform Modules: When & Why (2025 Guide)](https://aws.plainenglish.io/430-terragrunt-vs-terraform-modules-when-why-to-use-terragrunt-2025-guide-e9ad56b7bc91)
- [Manage Multiple K8s Clusters on GKE with Terragrunt](https://blog.alterway.fr/en/manage-multiple-kubernetes-clusters-on-gke-with-terragrunt.html)
- [How to Manage Multiple Environments with Terragrunt](https://www.gruntwork.io/blog/how-to-manage-multiple-environments-with-terraform-using-terragrunt)
- [Terraform Workspaces vs Folders vs Terragrunt](https://hamza-aziz.github.io/terraform/Terraform-workspace-terragrunt/)
- [Effective Terraform and Terragrunt on GCP](https://rahulvatsya.medium.com/effective-terraform-and-terragrunt-practices-for-cloud-infrastructure-management-on-gcp-b0c17c1d3995)
