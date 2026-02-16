#!/bin/bash

# LinkLynx-AI 環境構築状況チェックスクリプト
# 各言語/ツールのセットアップ状況を表示

# 色設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# シンボル
CHECK='✅'
CROSS='❌'
WARN='⚠️'

# スクリプトのディレクトリを取得してプロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BOLD}${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          LinkLynx-AI 環境構築状況チェック                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# コマンドの存在確認とバージョン取得
check_command() {
    local cmd=$1
    local name=$2
    local version_cmd=$3

    if command -v "$cmd" >/dev/null 2>&1; then
        local version=$(eval "$version_cmd" 2>/dev/null | head -1)
        echo -e "  ${CHECK} ${name}: ${GREEN}${version}${NC}"
        return 0
    else
        echo -e "  ${CROSS} ${name}: ${RED}未インストール${NC}"
        return 1
    fi
}

# ファイル/ディレクトリの存在確認
check_exists() {
    local path=$1
    local name=$2

    if [[ -e "$path" ]]; then
        echo -e "  ${CHECK} ${name}"
        return 0
    else
        echo -e "  ${CROSS} ${name}: ${RED}見つかりません${NC}"
        return 1
    fi
}

# node_modulesの確認
check_node_modules() {
    local dir=$1
    if [[ -d "$dir/node_modules" ]]; then
        local count=$(ls -1 "$dir/node_modules" 2>/dev/null | wc -l | tr -d ' ')
        echo -e "  ${CHECK} 依存パッケージ インストール済み (${count} パッケージ)"
        return 0
    else
        echo -e "  ${CROSS} 依存パッケージ: ${RED}未インストール${NC} (実行: npm install)"
        return 1
    fi
}

# ============================================
# システムツール
# ============================================
echo -e "${BOLD}${CYAN}🔧 システムツール${NC}"
echo "────────────────────────────────────────────"

sys_ok=0
sys_total=4

check_command "docker" "Docker" "docker --version | cut -d' ' -f3 | tr -d ','" && ((sys_ok++))
check_command "docker-compose" "Docker Compose" "docker-compose --version 2>/dev/null | cut -d' ' -f4 || docker compose version | cut -d' ' -f4" && ((sys_ok++))
check_command "git" "Git" "git --version | cut -d' ' -f3" && ((sys_ok++))
check_command "make" "Make" "make --version | head -1" && ((sys_ok++))

echo ""
echo -e "  状態: ${BOLD}${sys_ok}/${sys_total}${NC} ツール準備完了"
echo ""

# ============================================
# TypeScript / Next.js
# ============================================
echo -e "${BOLD}${CYAN}📘 TypeScript / Next.js${NC}"
echo "────────────────────────────────────────────"

ts_ok=0
ts_total=4

check_command "node" "Node.js" "node --version" && ((ts_ok++))
check_command "npm" "npm" "npm --version" && ((ts_ok++))
check_exists "typescript/package.json" "package.json" && ((ts_ok++))
check_node_modules "typescript" && ((ts_ok++))

echo ""
if [[ $ts_ok -eq $ts_total ]]; then
    echo -e "  状態: ${GREEN}${CHECK} 準備完了${NC} (${ts_ok}/${ts_total})"
else
    echo -e "  状態: ${YELLOW}${WARN} 未完了${NC} (${ts_ok}/${ts_total})"
fi
echo ""

# ============================================
# Rust
# ============================================
echo -e "${BOLD}${CYAN}🦀 Rust${NC}"
echo "────────────────────────────────────────────"

rust_ok=0
rust_total=3

check_command "rustc" "Rust" "rustc --version | cut -d' ' -f2" && ((rust_ok++))
check_command "cargo" "Cargo" "cargo --version | cut -d' ' -f2" && ((rust_ok++))
check_exists "rust/Cargo.toml" "Cargo.toml" && ((rust_ok++))

# 依存パッケージの確認
if [[ -d "rust/target" ]] || cargo metadata --manifest-path rust/Cargo.toml >/dev/null 2>&1; then
    echo -e "  ${CHECK} 依存パッケージ 設定済み"
else
    echo -e "  ${WARN} 依存パッケージ: ${YELLOW}rust/ で 'cargo fetch' を実行してください${NC}"
fi

echo ""
if [[ $rust_ok -eq $rust_total ]]; then
    echo -e "  状態: ${GREEN}${CHECK} 準備完了${NC} (${rust_ok}/${rust_total})"
else
    echo -e "  状態: ${YELLOW}${WARN} 未完了${NC} (${rust_ok}/${rust_total})"
fi
echo ""

# ============================================
# Python
# ============================================
echo -e "${BOLD}${CYAN}🐍 Python${NC}"
echo "────────────────────────────────────────────"

py_ok=0
py_total=3

check_command "python3" "Python" "python3 --version | cut -d' ' -f2" && ((py_ok++))
check_command "pip3" "pip" "pip3 --version | cut -d' ' -f2" && ((py_ok++))
check_exists "python/requirements.txt" "requirements.txt" && ((py_ok++))

# 仮想環境またはパッケージの確認
if [[ -d "python/.venv" ]]; then
    echo -e "  ${CHECK} 仮想環境 作成済み"
elif pip3 show fastapi >/dev/null 2>&1; then
    echo -e "  ${CHECK} 依存パッケージ インストール済み (グローバル)"
else
    echo -e "  ${WARN} 依存パッケージ: ${YELLOW}python/ で 'pip install -r requirements.txt' を実行してください${NC}"
fi

echo ""
if [[ $py_ok -eq $py_total ]]; then
    echo -e "  状態: ${GREEN}${CHECK} 準備完了${NC} (${py_ok}/${py_total})"
else
    echo -e "  状態: ${YELLOW}${WARN} 未完了${NC} (${py_ok}/${py_total})"
fi
echo ""

# ============================================
# Elixir
# ============================================
echo -e "${BOLD}${CYAN}💧 Elixir${NC}"
echo "────────────────────────────────────────────"

elixir_ok=0
elixir_total=3

check_command "elixir" "Elixir" "elixir --version 2>/dev/null | grep Elixir | cut -d' ' -f2" && ((elixir_ok++))
check_command "mix" "Mix" "mix --version 2>/dev/null | head -1" && ((elixir_ok++))
check_exists "elixir/mix.exs" "mix.exs" && ((elixir_ok++))

# 依存パッケージの確認
if [[ -d "elixir/deps" ]]; then
    echo -e "  ${CHECK} 依存パッケージ 取得済み"
else
    echo -e "  ${WARN} 依存パッケージ: ${YELLOW}elixir/ で 'mix deps.get' を実行してください${NC}"
fi

echo ""
if [[ $elixir_ok -eq $elixir_total ]]; then
    echo -e "  状態: ${GREEN}${CHECK} 準備完了${NC} (${elixir_ok}/${elixir_total})"
else
    echo -e "  状態: ${YELLOW}${WARN} 未完了${NC} (${elixir_ok}/${elixir_total})"
fi
echo ""

# ============================================
# データベース
# ============================================
echo -e "${BOLD}${CYAN}🗄️  データベース${NC}"
echo "────────────────────────────────────────────"

check_exists "database/init.sql" "PostgreSQL 初期化スクリプト"
check_exists "docker-compose.yml" "Docker Compose 設定"

# コンテナの起動状態確認
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres"; then
    echo -e "  ${CHECK} PostgreSQL: ${GREEN}起動中${NC}"
else
    echo -e "  ${WARN} PostgreSQL: ${YELLOW}停止中${NC} (実行: make db-up)"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "scylla"; then
    echo -e "  ${CHECK} ScyllaDB: ${GREEN}起動中${NC}"
else
    echo -e "  ${WARN} ScyllaDB: ${YELLOW}停止中${NC} (実行: make db-up)"
fi

echo ""

# ============================================
# サマリー
# ============================================
echo -e "${BOLD}${BLUE}"
echo "═══════════════════════════════════════════════════════════"
echo "                        サマリー"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"

total_ok=$((sys_ok + ts_ok + rust_ok + py_ok + elixir_ok))
total=$((sys_total + ts_total + rust_total + py_total + elixir_total))

echo -e "  システムツール:  ${sys_ok}/${sys_total}"
echo -e "  TypeScript:      ${ts_ok}/${ts_total}"
echo -e "  Rust:            ${rust_ok}/${rust_total}"
echo -e "  Python:          ${py_ok}/${py_total}"
echo -e "  Elixir:          ${elixir_ok}/${elixir_total}"
echo ""
echo -e "  ${BOLD}合計: ${total_ok}/${total}${NC}"

if [[ $total_ok -eq $total ]]; then
    echo ""
    echo -e "  ${GREEN}${CHECK} 全ての環境が準備完了です！${NC}"
    echo -e "  ${YELLOW}make up${NC} で全サービスを起動できます"
else
    echo ""
    echo -e "  ${YELLOW}${WARN} 一部のコンポーネントがセットアップ必要です${NC}"
    echo -e "  ${YELLOW}make setup${NC} で不足している依存パッケージをインストールできます"
fi

echo ""
