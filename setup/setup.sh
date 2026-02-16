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

# Homebrewのインストール (macOS)
install_homebrew() {
    if [[ "$OS" == "macos" ]] && ! command_exists brew; then
        echo -e "${YELLOW}Homebrewをインストール中...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
}

# Dockerのインストール
install_docker() {
    if command_exists docker; then
        echo -e "${CHECK} Docker インストール済み"
        return
    fi

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
}

# Node.jsのインストール
install_nodejs() {
    if command_exists node; then
        echo -e "${CHECK} Node.js インストール済み ($(node --version))"
        return
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
}

# Rustのインストール
install_rust() {
    if command_exists rustc; then
        echo -e "${CHECK} Rust インストール済み ($(rustc --version | cut -d' ' -f2))"
        return
    fi

    echo -e "${YELLOW}Rustをインストール中...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
}

# Pythonのインストール
install_python() {
    if command_exists python3; then
        echo -e "${CHECK} Python インストール済み ($(python3 --version | cut -d' ' -f2))"
        return
    fi

    echo -e "${YELLOW}Pythonをインストール中...${NC}"
    case $OS in
        macos)
            brew install python
            ;;
        debian)
            sudo apt-get install -y python3 python3-pip python3-venv
            ;;
        fedora)
            sudo dnf install -y python3 python3-pip
            ;;
        arch)
            sudo pacman -S --noconfirm python python-pip
            ;;
    esac
}

# Elixirのインストール
install_elixir() {
    if command_exists elixir; then
        echo -e "${CHECK} Elixir インストール済み ($(elixir --version | grep Elixir | cut -d' ' -f2))"
        return
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
}

# TypeScriptプロジェクトのセットアップ
setup_typescript() {
    echo -e "\n${BLUE}TypeScript/Next.js をセットアップ中...${NC}"
    cd typescript
    if [[ -f package.json ]]; then
        npm install
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
        python3 -m venv .venv 2>/dev/null || true
        if [[ -f .venv/bin/activate ]]; then
            source .venv/bin/activate
            pip install -r requirements.txt
            deactivate
        else
            pip3 install -r requirements.txt
        fi
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

    echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        セットアップ完了！ 🎉             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}make setup-check${NC} で環境構築状況を確認できます"
    echo -e "${YELLOW}make up${NC} で全サービスをDockerで起動できます"
    echo -e "${YELLOW}make dev${NC} で開発モードを起動できます"
}

main "$@"
