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

## クイックスタート

### 1. 環境構築（macOS / Linux）

```bash
# 全ての依存関係を自動インストール
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
│   ├── migrations/      # sqlx migrations (LIN-137/138/139)
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
│   ├── init.sql         # 初期化導線（スキーマ本体はmigration管理）
│   ├── postgres/        # PostgreSQL運用SQL
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
```

## DBスキーマ運用（LIN-135）

PostgreSQLスキーマは `rust/migrations` を正として管理します。

```bash
# 事前準備（未インストール時）
cargo install sqlx-cli --no-default-features --features rustls,postgres

# DB起動
make db-up

# 137 -> 138 -> 139 の順でmigration適用
make db-migrate

# 適用状態を確認
make db-migrate-info

# rollback確認（逆順で1件戻す）
make db-migrate-revert
```

検証チェックリストは `database/contracts/lin135_integration_verification.md` を参照してください。

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
