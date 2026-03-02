.PHONY: help setup setup-db-tools setup-bootstrap setup-check dev build up down logs clean test format lint ci validate gen
.PHONY: ts-dev ts-build ts-format ts-lint ts-test ts-validate rust-dev rust-build rust-test rust-fmt rust-clippy rust-lint rust-ci rust-validate py-dev py-install py-format py-lint py-test py-validate elixir-dev elixir-build
.PHONY: db-up db-down db-reset db-migrate db-migrate-revert db-migrate-info db-schema db-schema-check db-seed db-table-regex db-doc worktree-sync-env codex-worktree

# 色設定
GREEN  := \033[0;32m
RED    := \033[0;31m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
NC     := \033[0m

DATABASE_URL ?= postgres://postgres:password@localhost:5432/linklynx
POSTGRES_DB_NAME ?= linklynx
SQLX_MIGRATIONS_DIR ?= ../database/postgres/migrations
SCHEMA_SNAPSHOT_PATH ?= database/postgres/schema.sql
DB_SEED_PATH ?= database/postgres/seed.sql
DB_GENERATED_DIR ?= database/postgres/generated
DB_TABLE_REGEX_PATH ?= $(DB_GENERATED_DIR)/table_names.regex
TBLS_DSN ?= postgres://postgres:password@localhost:5432/linklynx?sslmode=disable
TBLS_DOCKER_DSN ?= postgres://postgres:password@postgres:5432/linklynx?sslmode=disable
TBLS_DOCKER_IMAGE ?= ghcr.io/k1low/tbls:latest
TBLS_DOC_PATH ?= $(DB_GENERATED_DIR)
TBLS_ER_FORMAT ?= svg
POSTGRES_DUMP_CMD ?= docker compose exec -T postgres pg_dump -U postgres -d $(POSTGRES_DB_NAME) --schema-only --no-owner --no-privileges --exclude-table=_sqlx_migrations
WORKTREE_SYNC_IGNORED_PATHS ?= .env,**/.env,.env.local,**/.env.local,.env.*.local,**/.env.*.local

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

setup: setup-db-tools ## 各言語のローカル依存関係をセットアップ
	@echo "$(BLUE)TypeScript 依存関係をセットアップ中...$(NC)"
	@$(MAKE) -C typescript setup
	@echo "$(BLUE)Rust 依存関係をセットアップ中...$(NC)"
	@$(MAKE) -C rust setup
	@echo "$(BLUE)Python 依存関係をセットアップ中...$(NC)"
	@$(MAKE) -C python setup
	@echo "$(BLUE)Elixir 依存関係をセットアップ中...$(NC)"
	@$(MAKE) -C elixir setup
	@echo "$(GREEN)全言語の依存関係セットアップが完了しました$(NC)"

setup-db-tools: ## DB開発ツール(sqlx/tbls)をセットアップ
	@echo "$(BLUE)DB開発ツールを確認中...$(NC)"
	@if command -v sqlx >/dev/null 2>&1; then \
		echo "$(GREEN)sqlx はインストール済みです: $$(sqlx --version)$(NC)"; \
	else \
		if ! command -v cargo >/dev/null 2>&1; then \
			echo "$(RED)cargo が見つかりません。先に Rust をセットアップしてください$(NC)"; \
			exit 1; \
		fi; \
		echo "$(BLUE)sqlx-cli をインストール中...$(NC)"; \
		cargo install sqlx-cli --no-default-features --features rustls,postgres; \
	fi
	@if command -v tbls >/dev/null 2>&1; then \
		echo "$(GREEN)tbls はインストール済みです: $$(tbls version)$(NC)"; \
	else \
		if command -v brew >/dev/null 2>&1; then \
			echo "$(BLUE)tbls を Homebrew でインストール中...$(NC)"; \
			brew install tbls; \
		else \
			echo "$(YELLOW)tbls が未インストールです。brew がない環境では make gen が docker フォールバックで動作します$(NC)"; \
		fi; \
	fi

setup-bootstrap: ## 既存の自動セットアップスクリプトを実行
	@./setup/setup.sh

setup-check: ## 環境構築状況を確認
	@./setup/check-env.sh

worktree-sync-env: ## 現在のworktreeへgitignore済み開発用ファイルをコピー(既定: .env系)
	@WORKTREE_SYNC_IGNORED_PATHS='$(WORKTREE_SYNC_IGNORED_PATHS)' ./setup/create-worktree-with-env.sh

codex-worktree: ## 新規worktreeを作成しCodex CLIを起動 (例: make codex-worktree NAME=lin-300 BASE=origin/main)
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)NAME を指定してください。例: make codex-worktree NAME=lin-300$(NC)"; \
		exit 1; \
	fi
	@WORKTREE_SYNC_IGNORED_PATHS='$(WORKTREE_SYNC_IGNORED_PATHS)' ./setup/create-worktree-and-codex.sh "$(NAME)" $(if $(BASE),--base $(BASE),)

# ============================================
# Docker コマンド
# ============================================

up: ## 全サービスを起動
	docker compose up -d

up-build: ## ビルドして全サービスを起動
	docker compose up -d --build

down: ## 全サービスを停止
	docker compose down

logs: ## 全サービスのログを表示
	docker compose logs -f

logs-ts: ## TypeScript/Next.js のログを表示
	docker compose logs -f typescript

logs-rust: ## Rust のログを表示
	docker compose logs -f rust

logs-py: ## Python のログを表示
	docker compose logs -f python

logs-elixir: ## Elixir のログを表示
	docker compose logs -f elixir

clean: ## コンテナ・ボリューム・イメージを削除
	docker compose down -v --rmi local

# ============================================
# TypeScript/Next.js コマンド
# ============================================

ts-dev: ## Next.js 開発サーバーを起動
	cd typescript && pnpm run dev

ts-build: ## Next.js を本番用にビルド
	cd typescript && pnpm run build

ts-lint: ## ESLint でコードチェック
	cd typescript && make lint

ts-format: ## TypeScript をフォーマット
	cd typescript && make format

ts-test: ## TypeScript テストを実行
	cd typescript && pnpm run test

ts-validate: ## TypeScript の format / lint / test を実行
	cd typescript && make validate

ts-install: ## 依存パッケージをインストール
	cd typescript && CI=true pnpm install --frozen-lockfile

# ============================================
# Rust コマンド
# ============================================

rust-dev: ## Rust 開発サーバーを起動
	cd rust && cargo run -p linklynx_backend

rust-build: ## Rust を本番用にビルド
	cd rust && cargo build -p linklynx_backend --release

rust-test: ## Rust テストを実行
	cd rust && cargo test --workspace

rust-check: ## Rust コードをチェック
	cd rust && cargo check --workspace

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
# 共通品質ゲート（TypeScript / Rust / Python）
# ============================================

rust-validate: ## Rust の format / lint / test を実行
	cd rust && make validate

format: ts-format rust-fmt py-format ## フォーマットを実行

lint: ts-lint rust-lint py-lint ## Lintを実行

ci: lint ## CI相当のチェックを実行

validate: format lint test ## format / lint / test をすべて実行

# ============================================
# Python コマンド
# ============================================

py-dev: ## Python FastAPI サーバーを起動
	cd python && uvicorn main:app --reload --host 0.0.0.0 --port 8000

py-install: ## 依存パッケージをインストール
	cd python && make install-dev

py-format: ## Python をフォーマット
	cd python && make format

py-lint: ## Python Lint を実行
	cd python && make lint

py-test: ## Python テストを実行
	cd python && make test

py-validate: ## Python の format / lint / test を実行
	cd python && make validate

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
	docker compose up -d postgres scylladb

db-down: ## データベースを停止
	docker compose stop postgres scylladb

db-reset: ## データベースをリセット（※データ全削除）
	docker compose down -v postgres scylladb
	docker compose up -d postgres scylladb

db-migrate: ## sqlx migration を適用
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate run --source $(SQLX_MIGRATIONS_DIR)

db-migrate-revert: ## sqlx migration を1件ロールバック
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate revert --source $(SQLX_MIGRATIONS_DIR)

db-migrate-info: ## sqlx migration の適用状態を表示
	cd rust && DATABASE_URL=$(DATABASE_URL) sqlx migrate info --source $(SQLX_MIGRATIONS_DIR)

db-schema: ## 現在のDBから schema.sql スナップショットを生成
	@mkdir -p "$(dir $(SCHEMA_SNAPSHOT_PATH))"
	@raw_file="$$(mktemp)"; \
	tmp_file="$$(mktemp)"; \
	if ! $(POSTGRES_DUMP_CMD) > "$$raw_file"; then \
		rm -f "$$raw_file" "$$tmp_file"; \
		echo "$(RED)pg_dump の実行に失敗しました$(NC)"; \
		exit 1; \
	fi; \
	sed -e '/^--/d' -e '/^[\\]restrict /d' -e '/^[\\]unrestrict /d' "$$raw_file" > "$$tmp_file"; \
	if [ ! -s "$$tmp_file" ]; then \
		rm -f "$$raw_file" "$$tmp_file"; \
		echo "$(RED)schema.sql の生成結果が空です。DB接続を確認してください$(NC)"; \
		exit 1; \
	fi; \
	mv "$$tmp_file" "$(SCHEMA_SNAPSHOT_PATH)"; \
	rm -f "$$raw_file"; \
	echo "$(GREEN)$(SCHEMA_SNAPSHOT_PATH) を更新しました$(NC)"

db-schema-check: ## schema.sql と現在DBスキーマの差分を検証
	@if [ ! -f "$(SCHEMA_SNAPSHOT_PATH)" ]; then \
		echo "$(RED)$(SCHEMA_SNAPSHOT_PATH) がありません。make db-schema を実行してください$(NC)"; \
		exit 1; \
	fi
	@raw_file="$$(mktemp)"; \
	tmp_file="$$(mktemp)"; \
	if ! $(POSTGRES_DUMP_CMD) > "$$raw_file"; then \
		rm -f "$$raw_file" "$$tmp_file"; \
		echo "$(RED)pg_dump の実行に失敗しました$(NC)"; \
		exit 1; \
	fi; \
	sed -e '/^--/d' -e '/^[\\]restrict /d' -e '/^[\\]unrestrict /d' "$$raw_file" > "$$tmp_file"; \
	if [ ! -s "$$tmp_file" ]; then \
		rm -f "$$raw_file" "$$tmp_file"; \
		echo "$(RED)schema比較用の生成結果が空です。DB接続を確認してください$(NC)"; \
		exit 1; \
	fi; \
	if ! diff -u "$(SCHEMA_SNAPSHOT_PATH)" "$$tmp_file"; then \
		echo "$(RED)schema.sql が最新ではありません。make db-schema を実行してください$(NC)"; \
		rm -f "$$raw_file" "$$tmp_file"; \
		exit 1; \
	fi; \
	rm -f "$$raw_file" "$$tmp_file"; \
	echo "$(GREEN)schema snapshot は最新です$(NC)"

db-seed: ## PostgreSQL へ開発用の仮データを注入（再実行可）
	@if [ ! -f "$(DB_SEED_PATH)" ]; then \
		echo "$(RED)$(DB_SEED_PATH) がありません$(NC)"; \
		exit 1; \
	fi
	@if ! docker compose exec -T postgres psql -U postgres -d "$(POSTGRES_DB_NAME)" -tAc "SELECT to_regclass('public.users') IS NOT NULL;" | grep -q t; then \
		echo "$(RED)スキーマが未適用です。先に make db-migrate を実行してください$(NC)"; \
		exit 1; \
	fi
	@cat "$(DB_SEED_PATH)" | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$(POSTGRES_DB_NAME)"
	@echo "$(GREEN)$(DB_SEED_PATH) の投入が完了しました$(NC)"

db-table-regex: ## tbls で現在DBからテーブル名正規表現を生成
	@python3 database/postgres/scripts/gen_table_regex.py --dsn "$(TBLS_DSN)" --docker-dsn "$(TBLS_DOCKER_DSN)" --docker-image "$(TBLS_DOCKER_IMAGE)" --schema "$(SCHEMA_SNAPSHOT_PATH)" --output "$(DB_TABLE_REGEX_PATH)"
	@echo "$(GREEN)$(DB_TABLE_REGEX_PATH) を更新しました$(NC)"

db-doc: ## tbls でDBドキュメント/ER図を生成
	@python3 database/postgres/scripts/gen_table_regex.py --dsn "$(TBLS_DSN)" --docker-dsn "$(TBLS_DOCKER_DSN)" --docker-image "$(TBLS_DOCKER_IMAGE)" --schema "$(SCHEMA_SNAPSHOT_PATH)" --output "$(DB_TABLE_REGEX_PATH)" --doc-path "$(TBLS_DOC_PATH)" --er-format "$(TBLS_ER_FORMAT)"
	@echo "$(GREEN)$(TBLS_DOC_PATH) にDB生成物を出力しました$(NC)"

gen: db-doc ## 生成タスクを実行（regex + tbls doc/ER）

# ============================================
# 開発ワークフロー
# ============================================

dev: db-up ## 開発環境を起動（DB + Frontend）
	@if ! command -v node >/dev/null 2>&1; then \
		echo "$(RED)Node.js が見つかりません。先に make setup か setup/setup.sh を実行してください$(NC)"; \
		exit 1; \
	fi
	@if ! command -v pnpm >/dev/null 2>&1; then \
		echo "$(RED)pnpm が見つかりません。先に make setup か setup/setup.sh を実行してください$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)データベースを起動しました。Frontend を起動します:$(NC)"
	@echo "  Next.js: http://localhost:3000"
	@cd typescript && CI=true pnpm install --frozen-lockfile
	@$(MAKE) ts-dev

test: ## 全テストを実行
	@echo "$(BLUE)TypeScript テスト実行中...$(NC)"
	cd typescript && make test
	@echo "$(BLUE)Rust テスト実行中...$(NC)"
	cd rust && make test
	@echo "$(BLUE)Python テスト実行中...$(NC)"
	cd python && make test
