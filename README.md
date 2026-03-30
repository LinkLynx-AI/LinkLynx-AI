# LinkLynx-AI

LinkLynx-AI は、Discord 風のリアルタイムチャットアプリを目指すマルチサービス構成の開発リポジトリです。

- Frontend: Next.js (`typescript/`)
- Backend API: Rust + Axum (`rust/`)
- AI/ML service: Python (`python/`)
- Additional service: Elixir (`elixir/`)
- Local data stores: PostgreSQL, ScyllaDB, SpiceDB

この README は、ローカルで迷わず起動することを最優先に整理しています。

## 最初に読む

日常的によく使うのは次の 3 パターンです。

1. 全体を起動したい

```bash
make dev
```

2. Rust API だけ起動したい

```bash
make db-up
make scylla-bootstrap
make db-migrate
make rust-dev
```

3. 認可まで含めて確認したい

```bash
make db-up
make scylla-bootstrap
make db-migrate
make authz-spicedb-up
make authz-spicedb-health
make rust-dev
```

## 動作要件

- Docker / Docker Compose
- Make
- Node.js
- pnpm
- Rust / Cargo
- Python 3.13 以下

確認:

```bash
make setup-check
```

セットアップ:

```bash
make setup
```

## 主要ポート

| Service | URL / Port | 用途 |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Next.js |
| Rust API | `http://localhost:8080` | REST / WS |
| Python | `http://localhost:8000` | FastAPI |
| Elixir | `http://localhost:4000` | 補助サービス |
| SpiceDB gRPC | `localhost:50051` | AuthZ |
| SpiceDB HTTP | `localhost:8443` | AuthZ health/check |
| ScyllaDB | `localhost:9042` | message runtime |
| PostgreSQL | `localhost:5432` | principal / guild / invite / audit |

## クイックスタート

### 全体を起動する

DB を Docker で上げ、Frontend と Rust API をローカル実行します。

```bash
make dev
```

`make dev` は内部で次を行います。

- `make db-up`
- `make scylla-bootstrap`
- `make rust-dev`
- `make ts-dev`

起動後:

- Frontend: `http://localhost:3000`
- Rust API: `http://localhost:8080`

### Rust API だけ起動する

Frontend を起動せず、backend だけ確認したいときの最短手順です。

```bash
make db-up
make scylla-bootstrap
make db-migrate
make rust-dev
```

補足:

- `make db-up`
  - PostgreSQL と ScyllaDB を起動します。
- `make scylla-bootstrap`
  - Scylla にローカル開発用 schema を適用します。
- `make db-migrate`
  - PostgreSQL migration を適用します。
- `make rust-dev`
  - `.env` を読み込んで `cargo run -p linklynx_backend` を実行します。

### AuthZ も使う

権限制御や route guard まで確認したい場合は SpiceDB も起動します。

```bash
make authz-spicedb-up
make authz-spicedb-health
```

そのうえで API を起動します。

```bash
make rust-dev
```

## 起動確認

Rust API が起動したら、別ターミナルで確認します。

```bash
curl -i -sS http://127.0.0.1:8080/health
curl -i -sS http://127.0.0.1:8080/internal/scylla/health
```

期待値:

- `/health`
  - `200 OK`
  - body: `OK`
- `/internal/scylla/health`
  - schema 適用済みなら `200`
  - body: `{"service":"scylla","status":"ready"}`

## よくある起動順

### フロントも API も動かしたい

```bash
make dev
```

### API だけ見たい

```bash
make db-up
make scylla-bootstrap
make db-migrate
make rust-dev
```

### message runtime のみ確認したい

```bash
make db-up
make scylla-bootstrap
make rust-dev
make scylla-health
```

### AuthZ fail-close を確認したい

```bash
make authz-spicedb-up
make authz-spicedb-health
make rust-dev
```

## `main` 最新化とデプロイ

このリポジトリの deploy は「image を publish する段階」と「runtime / infra に反映する段階」が分かれています。

- `CD`
  - GitHub Actions で image build / smoke test / publish を行います。
- staging deploy
  - 現状は Terraform-managed の smoke workload を手動で反映します。
- prod deploy
  - GitHub Actions の `Infra Deploy (prod)` を `main` から手動実行します。

### `main` を最新化する

作業前に `main` を最新へ合わせる基本手順です。

```bash
git fetch origin
git switch main
git pull --ff-only origin main
```

補足:

- untracked file が `main` 側の tracked file と衝突する場合は、先に退避か削除が必要です。
- `--ff-only` を使うと、意図しない merge commit を作らずに更新できます。

### branch / PR を staging で確認する

「この branch のコードで staging 向け image を作って smoke deploy まで確認したい」ときの流れです。

1. GitHub Actions の `CD` workflow を `workflow_dispatch` で実行する
2. branch は確認したい branch を選ぶ
3. `target_environment=staging` を選ぶ
4. workflow 完了後、Rust image digest を job summary か artifact から控える
5. `infra/environments/staging/terraform.tfvars` で少なくとも次を確認する
   - `enable_rust_api_smoke_deploy = true`
   - `rust_api_public_hostname = "<stg_api_host>"`
   - `rust_api_image_digest = "<Rust image digest>"`
6. Terraform を apply する
7. `/health` と `/ws` を verify する

実行コマンド:

```bash
cd infra/environments/staging
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

verify:

```bash
curl -i -sS https://<stg_api_host>/health
wscat -c wss://<stg_api_host>/ws
```

詳細は [docs/runbooks/staging-rust-api-smoke-deploy-operations-runbook.md](docs/runbooks/staging-rust-api-smoke-deploy-operations-runbook.md) を参照してください。

### prod に deploy する

prod は branch から直接 apply せず、`main` から行います。

1. 変更を `main` に反映する
2. `main` push で `CD` が走る、または `CD` を `workflow_dispatch` で `target_environment=prod` 実行する
3. publish 済み digest を確認する
4. GitHub Actions の `Infra Deploy (prod)` を `operation=plan` で実行する
5. Rust API image だけ差し替える場合は workflow input の `rust_api_image_digest=<digest>` を入力する
6. `prod-terraform-plan` artifact を確認する
7. 問題なければ同じ digest で `operation=apply` を実行する
8. `confirm_production_apply=prod` を入れる
9. GitHub の `prod` environment approval を通す

重要:

- prod apply は `main` からしか実行できません。
- `CD` は image publish で、prod runtime 反映は `Infra Deploy (prod)` が担当します。

Rust API image だけ差し替える場合の基本フロー:

1. `CD` で新しい digest を publish
2. `Infra Deploy (prod)` を `plan` で実行
3. plan を確認
4. 同じ digest で `apply`

詳細は [docs/runbooks/terraform-low-budget-prod-deploy-runbook.md](docs/runbooks/terraform-low-budget-prod-deploy-runbook.md) を参照してください。

## よくあるエラー

### `ERR_CONNECTION_REFUSED`

ブラウザが接続先に到達できていません。多くは Rust API 未起動です。

まず確認:

```bash
curl -i -sS http://127.0.0.1:8080/health
```

失敗する場合は:

```bash
make db-up
make scylla-bootstrap
make db-migrate
make rust-dev
```

このリポジトリでは frontend が `.env` の `NEXT_PUBLIC_API_URL=http://localhost:8080` を前提にしています。

### `認証基盤が一時的に利用できません`

意味:

- 認証か認可の依存サービスが落ちている
- 安全側に倒して処理を止めた
- `request_id` は backend ログ追跡用

まず見るもの:

```bash
make authz-spicedb-health
curl -i -sS http://127.0.0.1:8080/health
```

### `Scylla schema applied` の warning

`make scylla-bootstrap` 実行時の replication factor warning は、ローカル単一ノード構成では正常です。エラーではありません。

## 主要コマンド

```bash
make help

# setup
make setup
make setup-check

# local runtime
make dev
make ts-dev
make rust-dev
make py-dev
make elixir-dev

# docker / databases
make up
make down
make logs
make db-up
make db-down
make db-reset
make db-migrate
make db-migrate-info
make scylla-bootstrap
make scylla-health
make authz-spicedb-up
make authz-spicedb-health
make authz-spicedb-down

# quality
make validate
make rust-lint
cd typescript && npm run typecheck
```

## ディレクトリ構成

```text
LinkLynx-AI/
├── typescript/   # Next.js frontend
├── rust/         # Rust API
├── python/       # FastAPI service
├── elixir/       # Elixir service
├── database/     # migrations / contracts / Scylla schema
├── docs/         # rules / ADR / runbooks
├── setup/        # local setup scripts
├── docker-compose.yml
├── Makefile
└── README.md
```

## 開発時の参照先

- Rust 実装ルール: `docs/RUST.md`
- TypeScript 実装ルール: `docs/TYPESCRIPT.md`
- DB 状態と契約: `docs/DATABASE.md`
- Scylla ローカル起動: `docs/runbooks/scylla-local-runtime-bootstrap-runbook.md`
- SpiceDB ローカル起動: `docs/runbooks/authz-spicedb-local-ci-runtime-runbook.md`

## 補足

- Python は `3.13` 以下を使ってください。
- `main` へ auto-merge は禁止です。
- child issue は `1 issue = 1 PR` がルールです。

## License

MIT
