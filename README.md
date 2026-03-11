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
