#!/bin/bash

# LinkLynx-AI 環境構築スクリプト
# 対応OS: macOS, Linux (Ubuntu/Debian, Fedora/RHEL, Arch)

set -e

# 色設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'
CHECK='✅'
CROSS='❌'
ARROW='➜'
MIN_CARGO_VERSION="1.85.0"
MIN_NODE_MAJOR="20"
MIN_ELIXIR_VERSION="1.16.0"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     LinkLynx-AI 環境構築スクリプト       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# OS検出
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        PKG_MANAGER="apt"
    elif [[ -f /etc/fedora-release ]]; then
        OS="fedora"
        PKG_MANAGER="dnf"
    elif [[ -f /etc/arch-release ]]; then
        OS="arch"
        PKG_MANAGER="pacman"
    else
        OS="unknown"
        PKG_MANAGER="unknown"
    fi
    echo -e "${ARROW} 検出されたOS: ${GREEN}$OS${NC} (パッケージマネージャー: $PKG_MANAGER)"
}

# コマンドの存在確認
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

version_ge() {
    local current=$1
    local required=$2
    [[ "$(printf '%s\n%s\n' "$required" "$current" | sort -V | tail -n1)" == "$current" ]]
}

cargo_version_number() {
    local cargo_cmd=$1
    "$cargo_cmd" --version 2>/dev/null | awk '{print $2}'
}

node_version_number() {
    local node_cmd=$1
    "$node_cmd" --version 2>/dev/null | sed 's/^v//'
}

node_major_version() {
    local node_cmd=$1
    node_version_number "$node_cmd" | cut -d. -f1
}

elixir_version_number() {
    local elixir_cmd=$1
    "$elixir_cmd" --version 2>/dev/null | awk '/Elixir/ {print $2; exit}'
}

load_rust_env() {
    if [[ -f "$HOME/.cargo/env" ]]; then
        # shellcheck disable=SC1090
        source "$HOME/.cargo/env"
    fi

    case ":$PATH:" in
        *":$HOME/.cargo/bin:"*) ;;
        *) export PATH="$HOME/.cargo/bin:$PATH" ;;
    esac
}

# Pythonのバージョン判定
python_major_version() {
    local python_cmd=$1
    "$python_cmd" -c 'import sys; print(sys.version_info.major)' 2>/dev/null
}

python_minor_version() {
    local python_cmd=$1
    "$python_cmd" -c 'import sys; print(sys.version_info.minor)' 2>/dev/null
}

python_supports_project() {
    local python_cmd=$1
    local major minor
    major=$(python_major_version "$python_cmd")
    minor=$(python_minor_version "$python_cmd")
    [[ "$major" == "3" && -n "$minor" && "$minor" -ge 10 && "$minor" -le 13 ]]
}

python_has_module() {
    local python_cmd=$1
    local module_name=$2
    "$python_cmd" -c "import ${module_name}" >/dev/null 2>&1
}

docker_compose_available() {
    docker compose version >/dev/null 2>&1
}

docker_daemon_available() {
    docker info >/dev/null 2>&1
}

# プロジェクトで利用可能なPython(3.10-3.13)を選択
select_python_for_project() {
    local candidates=(python3.13 python3.12 python3.11 python3.10 python3)

    for python_cmd in "${candidates[@]}"; do
        if command_exists "$python_cmd"; then
            if python_supports_project "$python_cmd"; then
                echo "$python_cmd"
                return 0
            fi
        fi
    done

    return 1
}

# Homebrewのインストール (macOS)
install_homebrew() {
    if [[ "$OS" == "macos" ]] && ! command_exists brew; then
        echo -e "${YELLOW}Homebrewをインストール中...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
}

# Dockerのインストール
install_docker() {
    local has_docker=0
    local has_compose=0

    if command_exists docker; then
        has_docker=1
    fi

    if [[ "$has_docker" -eq 1 ]] && docker_compose_available; then
        has_compose=1
    fi

    if [[ "$has_docker" -eq 1 ]] && [[ "$has_compose" -eq 1 ]]; then
        echo -e "${CHECK} Docker インストール済み ($(docker --version | cut -d',' -f1))"
    else
        echo -e "${YELLOW}Dockerをインストール中...${NC}"
        case $OS in
            macos)
                brew install --cask docker
                echo -e "${YELLOW}Docker Desktopを起動してインストールを完了してください${NC}"
                ;;
            debian)
                sudo apt-get update
                sudo apt-get install -y docker.io docker-compose-plugin
                sudo systemctl enable docker
                sudo systemctl start docker
                sudo usermod -aG docker $USER
                ;;
            fedora)
                sudo dnf install -y docker docker-compose-plugin
                sudo systemctl enable docker
                sudo systemctl start docker
                sudo usermod -aG docker $USER
                ;;
            arch)
                sudo pacman -S --noconfirm docker docker-compose
                sudo systemctl enable docker
                sudo systemctl start docker
                sudo usermod -aG docker $USER
                ;;
        esac
    fi

    if ! command_exists docker; then
        echo -e "${CROSS} docker コマンドを確認できませんでした${NC}"
        return 1
    fi

    if ! docker_compose_available; then
        echo -e "${CROSS} 'docker compose' が利用できません${NC}"
        return 1
    fi

    if docker_daemon_available; then
        echo -e "${CHECK} Docker daemon は利用可能です"
        if [[ "$OS" == "debian" || "$OS" == "fedora" || "$OS" == "arch" ]]; then
            echo -e "${YELLOW}注意: docker グループ追加直後は再ログインまたは 'newgrp docker' が必要な場合があります${NC}"
        fi
        return
    fi

    case $OS in
        debian|fedora|arch)
            echo -e "${YELLOW}Docker daemon を起動中...${NC}"
            sudo systemctl enable docker
            sudo systemctl start docker
            ;;
        macos)
            echo -e "${YELLOW}Docker Desktop を起動して初期セットアップを完了してください${NC}"
            ;;
    esac

    if docker_daemon_available; then
        echo -e "${CHECK} Docker daemon は利用可能です"
        if [[ "$OS" == "debian" || "$OS" == "fedora" || "$OS" == "arch" ]]; then
            echo -e "${YELLOW}注意: docker グループ追加直後は再ログインまたは 'newgrp docker' が必要な場合があります${NC}"
        fi
        return
    fi

    if [[ "$OS" == "macos" ]]; then
        echo -e "${YELLOW}Docker daemon に接続できません。Docker Desktop を起動して初期セットアップを完了してください${NC}"
    else
        echo -e "${YELLOW}Docker daemon に接続できません。Linux では再ログインまたは 'newgrp docker' が必要な場合があります${NC}"
    fi
}

# Node.jsのインストール
install_nodejs() {
    local node_version=""
    local node_major=""

    if command_exists node; then
        node_version=$(node_version_number node)
        node_major=$(node_major_version node)
        if [[ -n "$node_major" ]] && [[ "$node_major" -ge "$MIN_NODE_MAJOR" ]] && command_exists npm; then
            echo -e "${CHECK} Node.js インストール済み (v${node_version})"
            return
        fi
    fi

    echo -e "${YELLOW}Node.jsをインストール中...${NC}"
    case $OS in
        macos)
            brew install node
            ;;
        debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora)
            sudo dnf install -y nodejs npm
            ;;
        arch)
            sudo pacman -S --noconfirm nodejs npm
            ;;
    esac

    node_version=$(node_version_number node)
    node_major=$(node_major_version node)
    if [[ -z "$node_major" ]] || [[ "$node_major" -lt "$MIN_NODE_MAJOR" ]] || ! command_exists npm; then
        echo -e "${CROSS} Node.js ${MIN_NODE_MAJOR} 以上と npm が必要ですが、現在は v${node_version:-unknown} です${NC}"
        return 1
    fi

    echo -e "${CHECK} Node.js インストール済み (v${node_version})"
}

# pnpmの有効化
install_pnpm() {
    if command_exists pnpm; then
        echo -e "${CHECK} pnpm インストール済み ($(pnpm --version))"
        return
    fi

    if command_exists corepack; then
        echo -e "${YELLOW}corepackでpnpmを有効化中...${NC}"
        corepack enable
        corepack prepare pnpm@latest --activate
    else
        echo -e "${YELLOW}corepackが見つからないためnpm経由でpnpmをインストールします...${NC}"
        npm install -g pnpm
    fi

    if ! command_exists pnpm; then
        echo -e "${CROSS} pnpm のセットアップに失敗しました${NC}"
        return 1
    fi

    echo -e "${CHECK} pnpm インストール済み ($(pnpm --version))"
}

# Rustのインストール
install_rust() {
    load_rust_env

    local needs_rustup=0
    local cargo_version=""

    if ! command_exists rustup; then
        needs_rustup=1
    fi

    if command_exists cargo; then
        cargo_version=$(cargo_version_number cargo)
        if [[ -z "$cargo_version" ]] || ! version_ge "$cargo_version" "$MIN_CARGO_VERSION"; then
            needs_rustup=1
        fi
    else
        needs_rustup=1
    fi

    if [[ "$needs_rustup" -eq 1 ]]; then
        echo -e "${YELLOW}Rustup と最新 stable Rust をセットアップ中...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        load_rust_env
    fi

    if ! command_exists rustup; then
        echo -e "${CROSS} rustup のセットアップに失敗しました${NC}"
        return 1
    fi

    echo -e "${YELLOW}Rust stable toolchain を更新中...${NC}"
    rustup toolchain install stable --profile default
    rustup default stable
    rustup component add rustfmt clippy
    hash -r

    cargo_version=$(cargo_version_number cargo)
    if [[ -z "$cargo_version" ]] || ! version_ge "$cargo_version" "$MIN_CARGO_VERSION"; then
        echo -e "${CROSS} cargo ${MIN_CARGO_VERSION} 以上が必要ですが、現在は ${cargo_version:-unknown} です${NC}"
        return 1
    fi

    echo -e "${CHECK} Rust インストール済み ($(rustc --version | cut -d' ' -f2), cargo ${cargo_version})"
}

# Pythonのインストール
install_python() {
    local python_cmd=""
    python_cmd=$(select_python_for_project || true)

    if [[ -n "$python_cmd" ]]; then
        if ! python_has_module "$python_cmd" venv; then
            echo -e "${YELLOW}${python_cmd} に venv がないため、補助パッケージを確認します...${NC}"
        elif ! python_has_module "$python_cmd" pip; then
            echo -e "${YELLOW}${python_cmd} に pip がないため、補助パッケージを確認します...${NC}"
        else
            echo -e "${CHECK} Python インストール済み ($($python_cmd --version | cut -d' ' -f2))"
            return
        fi
    fi

    echo -e "${YELLOW}Pythonをインストール中...${NC}"
    case $OS in
        macos)
            brew install python@3.13
            ;;
        debian)
            sudo apt-get update
            sudo apt-get install -y python3 python3-pip python3-venv
            ;;
        fedora)
            sudo dnf install -y python3 python3-pip
            ;;
        arch)
            sudo pacman -S --noconfirm python python-pip
            ;;
    esac

    python_cmd=$(select_python_for_project || true)
    if [[ -z "$python_cmd" ]]; then
        echo -e "${CROSS} Python 3.10 から 3.13 を確認できませんでした${NC}"
        return 1
    fi

    if ! python_has_module "$python_cmd" venv; then
        echo -e "${CROSS}${python_cmd} で venv が利用できません${NC}"
        return 1
    fi

    if ! python_has_module "$python_cmd" pip; then
        "$python_cmd" -m ensurepip --upgrade >/dev/null 2>&1 || true
    fi

    if ! python_has_module "$python_cmd" pip; then
        echo -e "${CROSS}${python_cmd} で pip が利用できません${NC}"
        return 1
    fi

    echo -e "${CHECK} Python インストール済み ($($python_cmd --version | cut -d' ' -f2))"
}

# Elixirのインストール
install_elixir() {
    local elixir_version=""

    if command_exists elixir && command_exists mix; then
        elixir_version=$(elixir_version_number elixir)
        if [[ -n "$elixir_version" ]] && version_ge "$elixir_version" "$MIN_ELIXIR_VERSION"; then
            echo -e "${CHECK} Elixir インストール済み (${elixir_version})"
            return
        fi
    fi

    echo -e "${YELLOW}Elixirをインストール中...${NC}"
    case $OS in
        macos)
            brew install elixir
            ;;
        debian)
            sudo apt-get install -y elixir
            ;;
        fedora)
            sudo dnf install -y elixir
            ;;
        arch)
            sudo pacman -S --noconfirm elixir
            ;;
    esac

    if ! command_exists elixir || ! command_exists mix; then
        echo -e "${CROSS} Elixir または mix を確認できませんでした${NC}"
        return 1
    fi

    elixir_version=$(elixir_version_number elixir)
    if [[ -z "$elixir_version" ]] || ! version_ge "$elixir_version" "$MIN_ELIXIR_VERSION"; then
        echo -e "${CROSS} Elixir ${MIN_ELIXIR_VERSION} 以上が必要ですが、現在は ${elixir_version:-unknown} です${NC}"
        return 1
    fi

    echo -e "${CHECK} Elixir インストール済み (${elixir_version})"
}

# TypeScriptプロジェクトのセットアップ
setup_typescript() {
    echo -e "\n${BLUE}TypeScript/Next.js をセットアップ中...${NC}"
    cd typescript
    if [[ -f package.json ]]; then
        pnpm install
        echo -e "${CHECK} TypeScript 依存パッケージをインストールしました"
    fi
    cd ..
}

# Rustプロジェクトのセットアップ
setup_rust() {
    echo -e "\n${BLUE}Rust をセットアップ中...${NC}"
    cd rust
    if [[ -f Cargo.toml ]]; then
        cargo fetch
        echo -e "${CHECK} Rust 依存パッケージを取得しました"
    fi
    cd ..
}

# Pythonプロジェクトのセットアップ
setup_python() {
    echo -e "\n${BLUE}Python をセットアップ中...${NC}"
    cd python
    if [[ -f requirements.txt ]]; then
        local python_cmd
        python_cmd=$(select_python_for_project || true)

        if [[ -z "$python_cmd" ]]; then
            echo -e "${CROSS} Python 3.10 から 3.13 が見つかりません"
            echo -e "${YELLOW}Python 3.13をインストールして再実行してください（例: macOSは 'brew install python@3.13'）${NC}"
            return 1
        fi

        if [[ -x .venv/bin/python ]]; then
            if ! python_supports_project .venv/bin/python; then
                local venv_version
                venv_version=$(.venv/bin/python --version 2>/dev/null | cut -d' ' -f2)
                echo -e "${YELLOW}既存の .venv は未対応バージョン (${venv_version:-unknown}) のため再作成します${NC}"
                rm -rf .venv
            fi
        fi

        "$python_cmd" -m venv .venv
        source .venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt -r requirements-dev.txt
        deactivate
        echo -e "${CHECK} Python 依存パッケージをインストールしました"
    fi
    cd ..
}

# Elixirプロジェクトのセットアップ
setup_elixir() {
    echo -e "\n${BLUE}Elixir をセットアップ中...${NC}"
    cd elixir
    if [[ -f mix.exs ]]; then
        mix local.hex --force
        mix local.rebar --force
        mix deps.get
        echo -e "${CHECK} Elixir 依存パッケージをインストールしました"
    fi
    cd ..
}

setup_db_tools() {
    echo -e "\n${BLUE}DB 開発ツールをセットアップ中...${NC}"
    make setup-db-tools
}

# .envファイルの作成
setup_env() {
    if [[ ! -f .env ]]; then
        cp .env.example .env
        echo -e "${CHECK} .env.example から .env ファイルを作成しました"
    else
        echo -e "${CHECK} .env ファイルは既に存在します"
    fi
}

# メイン処理
main() {
    detect_os

    if [[ "$OS" == "unknown" ]]; then
        echo -e "${RED}サポートされていないOSです${NC}"
        exit 1
    fi

    echo -e "\n${BLUE}システム依存パッケージをインストール中...${NC}"

    [[ "$OS" == "macos" ]] && install_homebrew

    install_docker
    install_nodejs
    install_pnpm
    install_rust
    install_python
    install_elixir

    echo -e "\n${BLUE}プロジェクトをセットアップ中...${NC}"

    # スクリプトのディレクトリを取得してプロジェクトルートに移動
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/.."

    setup_env
    setup_typescript
    setup_rust
    setup_python
    setup_elixir
    setup_db_tools

    echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        セットアップ完了！ 🎉             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}make setup-check${NC} で環境構築状況を確認できます"
    echo -e "${YELLOW}make up${NC} で全サービスをDockerで起動できます"
    echo -e "${YELLOW}make dev${NC} で開発モードを起動できます"
    if [[ "$OS" == "macos" ]]; then
        echo -e "${YELLOW}Docker Desktop をまだ起動していない場合は、一度起動して初期セットアップを完了してください${NC}"
    fi
    if [[ "$OS" == "debian" || "$OS" == "fedora" || "$OS" == "arch" ]]; then
        echo -e "${YELLOW}Docker 権限が反映されない場合は、再ログインまたは 'newgrp docker' を実行してください${NC}"
    fi
}

main "$@"
