# LinkLynx-AI

Discord Clone プロジェクト - 低レイテンシ・高スケーラビリティを目指したリアルタイムチャットアプリケーション

## 環境構築状況の確認

```bash
make setup-check
```

を実行すると、以下のような環境構築状況が確認できます：

```
╔═══════════════════════════════════════════════════════════╗
║          LinkLynx-AI 環境構築状況チェック                 ║
╚═══════════════════════════════════════════════════════════╝

🔧 システムツール
────────────────────────────────────────────
  ✅ Docker: 24.0.0
  ✅ Docker Compose: 2.20.0
  ✅ Git: 2.40.0
  ✅ Make: GNU Make 4.4

📘 TypeScript / Next.js
────────────────────────────────────────────
  ✅ Node.js: v20.10.0
  ✅ npm: 10.2.0
  ✅ package.json
  ✅ 依存パッケージ インストール済み (346 パッケージ)

🦀 Rust
────────────────────────────────────────────
  ✅ Rust: 1.75.0
  ✅ Cargo: 1.75.0
  ✅ Cargo.toml

🐍 Python
────────────────────────────────────────────
  ✅ Python: 3.12.0
  ✅ pip: 23.3.1
  ✅ requirements.txt

💧 Elixir
────────────────────────────────────────────
  ✅ Elixir: 1.16.0
  ✅ Mix: 1.16.0
  ✅ mix.exs

🗄️  データベース
────────────────────────────────────────────
  ✅ PostgreSQL 初期化スクリプト
  ✅ Docker Compose 設定
```

## Python バージョン要件

- `python/requirements.txt` は一部ネイティブ依存（`pydantic-core`）を含むため、**Python 3.13 以下**を使用してください。
- Python 3.14 ではビルドに失敗する場合があります。
- `make setup` は `python3.13` → `python3.12` → `python3.11` → `python3.10` の順で利用可能なPythonを自動選択します。

## クイックスタート

### 1. 環境構築（macOS / Linux）

```bash
# 全ての依存関係を自動インストール
# (sqlx/tbls を含む)
make setup

# 環境構築状況を確認
make setup-check
```

### 2. サービス起動

```bash
# Docker Compose で全サービスを起動
make up

# または開発モード（DBのみDocker、サービスはローカル）
make dev
```

### 3. 各サービスにアクセス

| サービス | URL | 説明 |
|---------|-----|------|
| TypeScript (Next.js) | http://localhost:3000 | フロントエンド |
| Rust (Axum) | http://localhost:8080 | メインAPI |
| Python (FastAPI) | http://localhost:8000 | Pythonサービス |
| Elixir | http://localhost:4000 | Elixirサービス |

## Codex CLI で新規 worktree を開始

```bash
# codex/lin-300 ブランチを作成し、worktreeで Codex CLI を起動
make codex-worktree NAME=lin-300

# ベースブランチを明示する場合
make codex-worktree NAME=lin-300 BASE=origin/main
```

- 実体スクリプト: `setup/create-worktree-and-codex.sh`
- `setup/create-worktree-with-env.sh` で `gitignore` 済み開発用ファイルを同期します（既定は `.env` 系）。
- 追加対象は `WORKTREE_SYNC_IGNORED_PATHS`（カンマ区切りの git pathspec）で上書きできます。

## プロジェクト構成

```
LinkLynx-AI/
├── typescript/          # 📘 Next.js (App Router + FSD)
│   ├── src/
│   │   ├── app/         # App Router ページ
│   │   ├── features/    # Feature-Sliced Design
│   │   ├── entities/
│   │   ├── shared/
│   │   └── widgets/
│   └── Dockerfile
│
├── rust/                # 🦀 Axum + Tokio
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── Dockerfile
│
├── python/              # 🐍 FastAPI
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── elixir/              # 💧 Elixir + Plug
│   ├── lib/
│   ├── config/
│   ├── mix.exs
│   └── Dockerfile
│
├── database/            # 🗄️ データベース
│   ├── init.sql         # 初期化導線（スキーマ本体は database/postgres/migrations で管理）
│   ├── postgres/        # PostgreSQL運用SQL / migrations
│   ├── scylla/          # Scylla CQL
│   └── contracts/       # Search/PubSub/Redis運用契約
│
├── setup/               # 🔧 セットアップスクリプト
│   ├── setup.sh         # 自動環境構築
│   └── check-env.sh     # 環境構築状況確認
│
├── docker-compose.yml
├── Makefile
└── README.md
```

## 環境構築（詳細）

### macOS

```bash
# Homebrewがインストールされていない場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 依存関係のインストール
brew install node rust python elixir
brew install --cask docker

# プロジェクトのセットアップ
make setup
```

### Linux (Ubuntu/Debian)

```bash
# システムパッケージの更新
sudo apt update

# Docker
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Python
sudo apt install -y python3 python3-pip python3-venv
# 必要に応じて Python 3.13 を追加インストール

# Elixir
sudo apt install -y elixir

# プロジェクトのセットアップ
make setup
```

### Linux (Fedora/RHEL)

```bash
# Docker
sudo dnf install -y docker docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Node.js, Python, Elixir
sudo dnf install -y nodejs npm python3 python3-pip elixir
# 必要に応じて Python 3.13 を追加インストール

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# プロジェクトのセットアップ
make setup
```

### Linux (Arch)

```bash
# パッケージのインストール
sudo pacman -S docker docker-compose nodejs npm python python-pip elixir rust

# Dockerの有効化
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# プロジェクトのセットアップ
make setup
```

## Makefile コマンド一覧

```bash
make help           # ヘルプを表示

# セットアップ
make setup          # 全環境を自動セットアップ
make setup-check    # 環境構築状況を確認
make codex-worktree NAME=lin-300 # 新規worktree作成 + Codex CLI起動

# Docker
make up             # 全サービスを起動
make up-build       # ビルドして起動
make down           # 全サービスを停止
make logs           # ログを表示
make clean          # コンテナ・ボリュームを削除

# TypeScript
make ts-dev         # 開発サーバー起動
make ts-build       # 本番ビルド
make ts-lint        # ESLint実行
make ts-test        # テスト実行
make ts-install     # 依存パッケージインストール

# Rust
make rust-dev       # 開発サーバー起動
make rust-build     # リリースビルド
make rust-test      # テスト実行

# Python
make py-dev         # 開発サーバー起動
make py-install     # 依存パッケージインストール
make py-test        # テスト実行

# Elixir
make elixir-dev     # 開発サーバー起動
make elixir-build   # リリースビルド
make elixir-deps    # 依存パッケージインストール

# データベース
make db-up          # DBのみ起動
make db-down        # DBを停止
make db-reset       # DBをリセット（※データ全削除）
make db-migrate     # sqlx migration適用
make db-migrate-revert # sqlx migrationを1件ロールバック
make db-migrate-info   # sqlx migrationの適用状態を確認
make db-schema      # 現在DBから schema.sql を生成
make db-schema-check # schema.sql と現在DBの差分を検証
make db-seed        # PostgreSQLへ開発用仮データを投入（再実行可）
make gen            # tbls で regex + DBドキュメント/ER図を生成（database/postgres/generated）
```

## DBスキーマ運用（LIN-135）

PostgreSQLスキーマは `database/postgres/migrations` を正として管理します。  
`database/postgres/schema.sql` は、レビューしやすいスナップショット（派生物）として扱います。

```bash
# 事前準備（未インストール時）
cargo install sqlx-cli --no-default-features --features rustls,postgres

# DB起動
make db-up

# 137 -> 138 -> 139 の順でmigration適用
make db-migrate

# 適用状態を確認
make db-migrate-info

# schema snapshot を更新
make db-schema

# schema snapshot のドリフト検証
make db-schema-check

# 開発用の仮データを投入（seed.sql）
make db-seed

# DB生成物（regex + ドキュメント/ER図）を再生成
make gen

# rollback確認（逆順で1件戻す）
make db-migrate-revert
```

検証チェックリストは `database/contracts/lin135_integration_verification.md` を参照してください。

## テスト・品質チェック手順（Rust / TypeScript）

```bash
# TypeScript
cd typescript
npm install
npm run lint
npm run test
npm run build

# Rust
cd ../rust
cargo test
cargo build --release
```

## CI/CD 運用

- CI (`.github/workflows/ci.yml`)
  - トリガー: `main` 向け Pull Request
  - 実行内容: TypeScript `lint/test/build`、Rust `test/build`
- CD (`.github/workflows/cd.yml`)
  - トリガー: `main` への push
  - 実行内容: Rust/TypeScript の Docker build、Rust `/health` の smoke test、deploy ジョブ枠（placeholder）

## 失敗時の確認ポイント

- まず GitHub Actions の失敗ジョブログを確認する
- TypeScript 失敗時:
  - `typescript-lint` / `typescript-test` / `typescript-build` のどのジョブで落ちたかを確認
- Rust 失敗時:
  - `rust-test` / `rust-build` のどちらで失敗したかを確認
- CD 失敗時:
  - `build-images` か `smoke-test` のログを確認（`/health` 到達可否と `docker compose logs rust`）
- 通知先（暫定）:
  - GitHub の通知（Web/メール）を一次導線とする

## 技術スタック

### フロントエンド (typescript/)
- **フレームワーク**: Next.js 16 (App Router)
- **状態管理**: TanStack Query + Zustand
- **スタイリング**: Tailwind CSS
- **アーキテクチャ**: Feature-Sliced Design (FSD)

### バックエンド (rust/)
- **フレームワーク**: Axum
- **ランタイム**: Tokio
- **WebSocket**: axum-ws
- **設計思想**: アクターモデル

### Python サービス (python/)
- **フレームワーク**: FastAPI
- **ASGIサーバー**: Uvicorn

### Elixir サービス (elixir/)
- **HTTP**: Plug + Cowboy
- **JSON**: Jason

### データベース
- **PostgreSQL**: 強整合が必要な正データ（ユーザー/ギルド/権限/招待/監査/既読）
- **ScyllaDB**: メッセージ本体（履歴ページング、編集/削除、水平スケール）
- **Search (Elastic/OpenSearch)**: 全文検索（派生、非同期更新）
- **Redis (Memorystore)**: Presence / 共有Cache + RateLimitのL2
- **Local Storage**: RateLimitのL1（ローカルGCRA / TAT）
- **Pub/Sub + DLQ**: 非同期処理（検索更新、last_message更新、通知、監査追記）

## ライセンス

MIT
