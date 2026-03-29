.PHONY: help setup setup-db-tools setup-bootstrap setup-check dev build up down logs clean test format lint ci validate gen
.PHONY: ts-dev ts-build ts-format ts-lint ts-test ts-validate ts-fsd-check rust-dev rust-build rust-test rust-fmt rust-clippy rust-lint rust-ci rust-validate py-dev py-install py-format py-lint py-test py-validate elixir-dev elixir-build
.PHONY: db-up db-down db-reset db-migrate db-migrate-revert db-migrate-info db-schema db-schema-check db-seed db-table-regex db-doc worktree-sync-env codex-worktree
.PHONY: authz-spicedb-up authz-spicedb-down authz-spicedb-health
.PHONY: scylla-wait scylla-bootstrap scylla-health
.PHONY: message-scylla-integration
.PHONY: infra-fmt infra-validate infra-gitops-validate

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
	@echo "$(BLUE)LinkLynx-AI$(NC) - 開発用 Makefile"
	@echo ""
	@echo "$(YELLOW)使い方:$(NC) make [コマンド]"
	@echo ""
	@echo "$(YELLOW)初回/環境整備$(NC)"
	@echo "  $(GREEN)setup$(NC)             各言語のローカル依存関係をセットアップ"
	@echo "  $(GREEN)setup-db-tools$(NC)     DB開発ツール(sqlx/tbls)を確認・インストール"
	@echo "  $(GREEN)setup-check$(NC)        環境構築状況を確認"
	@echo "  $(GREEN)setup-bootstrap$(NC)    自動セットアップスクリプトを実行"
	@echo ""
	@echo "$(YELLOW)開発起動/停止$(NC)"
	@echo "  $(GREEN)dev$(NC)                DB + Frontend + Rust API の開発環境を起動"
	@echo "  $(GREEN)up$(NC)                 全サービスを起動"
	@echo "  $(GREEN)down$(NC)               全サービスを停止"
	@echo "  $(GREEN)logs$(NC)               全サービスのログを表示"
	@echo "  $(GREEN)logs-ts$(NC)            TypeScript/Next.js のログ"
	@echo "  $(GREEN)logs-rust$(NC)          Rust のログ"
	@echo "  $(GREEN)logs-py$(NC)            Python のログ"
	@echo ""
	@echo "$(YELLOW)品質ゲート$(NC)"
	@echo "  $(GREEN)format$(NC)             フォーマットを実行 (ts / rust / py)"
	@echo "  $(GREEN)lint$(NC)               リントを実行 (ts / rust / py)"
	@echo "  $(GREEN)test$(NC)               テストを実行 (ts / rust / py)"
	@echo "  $(GREEN)validate$(NC)           format / lint / test"
	@echo "  $(GREEN)infra-fmt$(NC)          Terraform format check"
	@echo "  $(GREEN)infra-validate$(NC)     Terraform init(-backend=false) + validate"
	@echo "  $(GREEN)infra-gitops-validate$(NC) GitOps kustomize render validate"
	@echo ""
	@echo "$(YELLOW)言語別ショートカット$(NC)"
	@echo "  $(GREEN)ts-*$(NC)               ts-dev / ts-build / ts-format / ts-lint / ts-test / ts-validate / ts-fsd-check"
	@echo "  $(GREEN)rust-*$(NC)             rust-dev / rust-build / rust-fmt / rust-lint / rust-test / rust-validate"
	@echo "  $(GREEN)message-scylla-integration$(NC)  実Scylla/実Postgres前提の message integration test"
	@echo "  $(GREEN)py-*$(NC)               py-dev / py-install / py-format / py-lint / py-test / py-validate"
	@echo ""
	@echo "$(YELLOW)DB運用$(NC)"
	@echo "  $(GREEN)db-up$(NC)              DBを起動"
	@echo "  $(GREEN)db-migrate$(NC)         sqlx migration 適用"
	@echo "  $(GREEN)db-migrate-info$(NC)    migration 適用状態を表示"
	@echo "  $(GREEN)db-reset$(NC)           DBをリセット"
	@echo "  $(GREEN)db-schema-check$(NC)    schema.sql の整合性チェック"
	@echo "  $(GREEN)db-seed$(NC)            開発データを投入"
	@echo ""
	@echo "$(YELLOW)codex-worktree系$(NC)"
	@echo "  $(GREEN)codex-worktree$(NC)       worktreeを作成しCodex CLIを起動"
	@echo "  $(GREEN)worktree-sync-env$(NC)    .env等の同期"
	@echo ""
	@echo "$(YELLOW)補助$(NC)"
	@echo "  $(GREEN)clean$(NC)              コンテナ/イメージ/ボリュームを削除"

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
		cargo install sqlx-cli --locked --no-default-features --features rustls,postgres; \
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

authz-spicedb-up: ## SpiceDB を起動
	docker compose up -d spicedb

authz-spicedb-down: ## SpiceDB を停止
	docker compose stop spicedb

authz-spicedb-health: ## SpiceDB gRPC/HTTP ポートのヘルス確認（localhost:50051/8443）
	@for i in $$(seq 1 30); do \
		if nc -z 127.0.0.1 50051 >/dev/null 2>&1 && nc -z 127.0.0.1 8443 >/dev/null 2>&1; then \
			echo "$(GREEN)SpiceDB gRPC/HTTP endpoints are ready$(NC)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "$(RED)SpiceDB gRPC/HTTP endpoints are not reachable on localhost:50051/8443$(NC)"; \
	docker compose logs spicedb; \
	exit 1

scylla-wait: ## Scylla の CQL 応答待ち
	@for i in $$(seq 1 60); do \
		if docker compose exec -T scylladb cqlsh -e "SELECT release_version FROM system.local;" >/dev/null 2>&1; then \
			echo "$(GREEN)Scylla CQL endpoint is ready$(NC)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "$(RED)Scylla CQL endpoint did not become ready in time$(NC)"; \
	docker compose logs scylladb; \
	exit 1

scylla-bootstrap: ## Scylla schema をローカル compose に適用
	@set -eu; \
	set -a; \
	[ -f .env ] && . ./.env; \
	set +a; \
	$(MAKE) scylla-wait; \
	keyspace="$${SCYLLA_KEYSPACE:-chat}"; \
	case "$$keyspace" in \
		(*[!A-Za-z0-9_]*|'') \
			echo "$(RED)SCYLLA_KEYSPACE は英数字またはアンダースコアのみ使用できます: $$keyspace$(NC)"; \
			exit 1; \
			;; \
	esac; \
	dc="$$(docker compose exec -T scylladb cqlsh -e "SELECT data_center FROM system.local;" | awk 'NF > 0 && $$1 != "data_center" && $$1 !~ /^-+$$/ && $$1 !~ /^\(/ { print $$1; exit }')"; \
	if [ -z "$$dc" ]; then \
		echo "$(RED)Scylla data_center を取得できませんでした$(NC)"; \
		docker compose logs scylladb; \
		exit 1; \
	fi; \
	tmp_file="$$(mktemp)"; \
	trap 'rm -f "$$tmp_file"' EXIT; \
	perl -0pe "s/'dc1': 3/'$$dc': 1/g; s/CREATE KEYSPACE IF NOT EXISTS chat/CREATE KEYSPACE IF NOT EXISTS $$keyspace/g; s/CREATE TABLE IF NOT EXISTS chat\\./CREATE TABLE IF NOT EXISTS $$keyspace\\./g" \
		database/scylla/001_lin139_messages.cql > "$$tmp_file"; \
	docker compose exec -T scylladb cqlsh < "$$tmp_file"; \
	echo "$(GREEN)Scylla schema applied (data_center=$$dc, keyspace=$$keyspace, rf=1)$(NC)"

scylla-health: ## API の Scylla health probe を確認
	curl -i -sS http://127.0.0.1:8080/internal/scylla/health

message-scylla-integration: ## 実Scylla/実Postgres前提の message integration test を実行
	cd rust && \
	DATABASE_URL="$(DATABASE_URL)" \
	AUTH_ALLOW_POSTGRES_NOTLS=true \
	SCYLLA_HOSTS="$${SCYLLA_HOSTS:-127.0.0.1:9042}" \
	SCYLLA_KEYSPACE="$${SCYLLA_KEYSPACE:-chat}" \
	MESSAGE_SCYLLA_INTEGRATION=true \
	cargo test -p linklynx_backend message_scylla_integration_ -- --nocapture

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

ts-fsd-check: ## TypeScript のFSD依存ルールをチェック
	cd typescript && make fsd-check

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
	@set -a; \
	[ -f .env ] && . ./.env; \
	set +a; \
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

infra-fmt: ## Terraform format check を実行
	@if ! command -v terraform >/dev/null 2>&1; then \
		echo "$(RED)terraform が見つかりません。Terraform をインストールしてください$(NC)"; \
		exit 1; \
	fi
	terraform fmt -check -recursive infra

infra-validate: ## Terraform init(-backend=false) + validate を実行
	@if ! command -v terraform >/dev/null 2>&1; then \
		echo "$(RED)terraform が見つかりません。Terraform をインストールしてください$(NC)"; \
		exit 1; \
	fi
	@set -e; \
	for dir in infra/environments/bootstrap infra/environments/staging infra/environments/prod; do \
		echo "$(BLUE)Terraform validate: $$dir$(NC)"; \
		terraform -chdir=$$dir init -backend=false >/dev/null; \
		terraform -chdir=$$dir validate; \
	done

infra-gitops-validate: ## GitOps kustomize render validate を実行
	@if ! command -v kubectl >/dev/null 2>&1; then \
		echo "$(RED)kubectl が見つかりません。kubectl をインストールしてください$(NC)"; \
		exit 1; \
	fi
	@set -e; \
	for dir in \
		infra/gitops/apps/staging/canary-smoke \
		infra/gitops/apps/prod/canary-smoke \
		infra/gitops/bootstrap/staging \
		infra/gitops/bootstrap/prod; do \
		echo "$(BLUE)GitOps render validate: $$dir$(NC)"; \
		kubectl kustomize $$dir >/dev/null; \
	done

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

dev: db-up ## 開発環境を起動（DB + Frontend + Rust）
	@if ! command -v node >/dev/null 2>&1; then \
		echo "$(RED)Node.js が見つかりません。先に make setup か setup/setup.sh を実行してください$(NC)"; \
		exit 1; \
	fi
	@if ! command -v pnpm >/dev/null 2>&1; then \
		echo "$(RED)pnpm が見つかりません。先に make setup か setup/setup.sh を実行してください$(NC)"; \
		exit 1; \
	fi
	@if ! command -v cargo >/dev/null 2>&1; then \
		echo "$(RED)cargo が見つかりません。先に make setup か setup/setup.sh を実行してください$(NC)"; \
		exit 1; \
	fi
	@$(MAKE) scylla-bootstrap
	@echo "$(GREEN)データベースを起動しました。Frontend と Rust API を起動します:$(NC)"
	@echo "  Next.js: http://localhost:3000"
	@echo "  Rust API: http://localhost:8080"
	@cd typescript && CI=true pnpm install --frozen-lockfile
	@set -e; \
	cleanup() { \
		trap - INT TERM EXIT; \
		command -v pkill >/dev/null 2>&1 && pkill -TERM -P $$rust_pid 2>/dev/null || true; \
		kill -TERM -$$rust_pid 2>/dev/null || kill -TERM $$rust_pid 2>/dev/null || true; \
		wait $$rust_pid 2>/dev/null || true; \
	}; \
	if command -v setsid >/dev/null 2>&1; then \
		setsid $(MAKE) rust-dev & \
	else \
		$(MAKE) rust-dev & \
	fi; \
	rust_pid=$$!; \
	trap cleanup INT TERM EXIT; \
	$(MAKE) ts-dev

test: ## 全テストを実行
	@echo "$(BLUE)TypeScript テスト実行中...$(NC)"
	cd typescript && make test
	@echo "$(BLUE)Rust テスト実行中...$(NC)"
	cd rust && make test
	@echo "$(BLUE)Python テスト実行中...$(NC)"
	cd python && make test
