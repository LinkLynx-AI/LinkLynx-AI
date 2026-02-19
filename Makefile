.PHONY: help setup setup-check dev build up down logs clean test
.PHONY: ts-dev ts-build ts-lint ts-test rust-dev rust-build rust-test rust-fmt rust-clippy rust-lint rust-ci py-dev py-test elixir-dev elixir-build
.PHONY: db-up db-down db-reset db-migrate db-migrate-revert db-migrate-info worktree-sync-env

# 色設定
GREEN  := \033[0;32m
RED    := \033[0;31m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
NC     := \033[0m

DATABASE_URL ?= postgres://postgres:password@localhost:5432/linklynx
SQLX_MIGRATIONS_DIR ?= ../database/postgres/migrations

help: ## ヘルプを表示
	@echo "$(BLUE)LinkLynx-AI$(NC) - Discord Clone 開発コマンド"
	@echo ""
	@echo "$(YELLOW)使い方:$(NC)"
	@echo "  make [コマンド]"
	@echo ""
	@echo "$(YELLOW)コマンド一覧:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

# ============================================
# セットアップ・環境確認
# ============================================

setup: ## 全環境の自動セットアップを実行
	@./setup/setup.sh

setup-check: ## 環境構築状況を確認
	@./setup/check-env.sh

worktree-sync-env: ## 現在のworktreeへ.envファイルを自動検出元からコピー
	@./setup/create-worktree-with-env.sh

# ============================================
# Docker コマンド
# ============================================

up: ## 全サービスを起動
	docker-compose up -d

up-build: ## ビルドして全サービスを起動
	docker-compose up -d --build

down: ## 全サービスを停止
	docker-compose down

logs: ## 全サービスのログを表示
	docker-compose logs -f

logs-ts: ## TypeScript/Next.js のログを表示
	docker-compose logs -f typescript

logs-rust: ## Rust のログを表示
	docker-compose logs -f rust

logs-py: ## Python のログを表示
	docker-compose logs -f python

logs-elixir: ## Elixir のログを表示
	docker-compose logs -f elixir

clean: ## コンテナ・ボリューム・イメージを削除
	docker-compose down -v --rmi local

# ============================================
# TypeScript/Next.js コマンド
# ============================================

ts-dev: ## Next.js 開発サーバーを起動
	cd typescript && npm run dev

ts-build: ## Next.js を本番用にビルド
	cd typescript && npm run build

ts-lint: ## ESLint でコードチェック
	cd typescript && npm run lint

ts-test: ## TypeScript テストを実行
	cd typescript && npm run test

ts-install: ## 依存パッケージをインストール
	cd typescript && npm install

# ============================================
# Rust コマンド
# ============================================

rust-dev: ## Rust 開発サーバーを起動
	cd rust && cargo run

rust-build: ## Rust を本番用にビルド
	cd rust && cargo build --release

rust-test: ## Rust テストを実行
	cd rust && cargo test

rust-check: ## Rust コードをチェック
	cd rust && cargo check

rust-fmt: ## Rust フォーマットを実行（workspace準拠）
	cd rust && cargo fmt --all

rust-clippy: ## Rust Clippy を実行（warningをエラー化）
	cd rust && cargo clippy --workspace --all-targets --all-features -- -D warnings

rust-lint: ## Rust 規約チェック（fmt + clippy + test）
	cd rust && cargo fmt --all --check
	cd rust && cargo clippy --workspace --all-targets --all-features -- -D warnings
	cd rust && cargo test --workspace

rust-ci: rust-lint ## CI相当のRust品質ゲートを実行

# ============================================
# Python コマンド
# ============================================

py-dev: ## Python FastAPI サーバーを起動
	cd python && uvicorn main:app --reload --host 0.0.0.0 --port 8000

py-install: ## 依存パッケージをインストール
	cd python && pip install -r requirements.txt

py-test: ## Python テストを実行
	cd python && pytest

# ============================================
# Elixir コマンド
# ============================================

elixir-dev: ## Elixir 開発サーバーを起動
	cd elixir && mix run --no-halt

elixir-build: ## Elixir を本番用にビルド
	cd elixir && MIX_ENV=prod mix release

elixir-deps: ## 依存パッケージをインストール
	cd elixir && mix deps.get

elixir-test: ## Elixir テストを実行
	cd elixir && mix test

# ============================================
# データベース コマンド
# ============================================

db-up: ## データベースのみ起動
	docker-compose up -d postgres scylladb

db-down: ## データベースを停止
	docker-compose stop postgres scylladb

db-reset: ## データベースをリセット（※データ全削除）
	docker-compose down -v postgres scylladb
	docker-compose up -d postgres scylladb

db-migrate: ## sqlx migration を適用
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate run --source $(SQLX_MIGRATIONS_DIR)

db-migrate-revert: ## sqlx migration を1件ロールバック
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate revert --source $(SQLX_MIGRATIONS_DIR)

db-migrate-info: ## sqlx migration の適用状態を表示
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate info --source $(SQLX_MIGRATIONS_DIR)

# ============================================
# 開発ワークフロー
# ============================================

dev: db-up ## 開発環境を起動（DB + ローカルサービス）
	@echo "$(GREEN)データベースを起動しました。各サービスをローカルで起動:$(NC)"
	@echo "  make ts-dev     - Next.js    http://localhost:3000"
	@echo "  make rust-dev   - Rust       http://localhost:8080"
	@echo "  make py-dev     - Python     http://localhost:8000"
	@echo "  make elixir-dev - Elixir     http://localhost:4000"

test: ## 全テストを実行
	@echo "$(BLUE)TypeScript テスト実行中...$(NC)"
	cd typescript && npm run test
	@echo "$(BLUE)Rust テスト実行中...$(NC)"
	cd rust && cargo test
	@echo "$(BLUE)Python テスト実行中...$(NC)"
	-cd python && pytest 2>/dev/null || echo "$(YELLOW)テスト未設定$(NC)"
	@echo "$(BLUE)Elixir テスト実行中...$(NC)"
	-cd elixir && mix test 2>/dev/null || echo "$(YELLOW)テスト未設定$(NC)"
