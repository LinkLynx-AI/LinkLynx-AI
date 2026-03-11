#!/bin/bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./setup/create-worktree-and-codex.sh <task-name> [--base <ref>] [--no-open] [-- <codex-args...>]

Examples:
  ./setup/create-worktree-and-codex.sh lin-300
  ./setup/create-worktree-and-codex.sh lin-300 --base origin/main
  ./setup/create-worktree-and-codex.sh lin-300 -- --profile default --full-auto
  ./setup/create-worktree-and-codex.sh lin-300 --no-open

Environment:
  CODEX_WORKTREE_ROOT  Destination root for created worktrees (default: $HOME/.codex/worktrees)
EOF
}

require_command() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: required command not found: $cmd" >&2
        exit 1
    fi
}

slugify() {
    local value="$1"
    value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
    value="$(printf '%s' "$value" | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
    printf '%s' "$value"
}

resolve_default_base_ref() {
    local repo_root="$1"
    local current_branch
    current_branch="$(git -C "$repo_root" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
    if [[ -n "$current_branch" ]]; then
        printf '%s\n' "$current_branch"
        return
    fi

    local origin_head
    origin_head="$(git -C "$repo_root" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
    if [[ -n "$origin_head" ]]; then
        printf '%s\n' "$origin_head"
        return
    fi

    if git -C "$repo_root" show-ref --verify --quiet refs/heads/main; then
        printf 'main\n'
        return
    fi

    if git -C "$repo_root" show-ref --verify --quiet refs/heads/master; then
        printf 'master\n'
        return
    fi

    git -C "$repo_root" rev-parse --short HEAD
}

task_name=""
base_ref=""
open_codex=1
codex_args=()
codex_default_args=(--ask-for-approval never)

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -b|--base)
            if [[ $# -lt 2 ]]; then
                echo "Error: --base requires a value" >&2
                usage
                exit 1
            fi
            base_ref="$2"
            shift 2
            ;;
        --no-open)
            open_codex=0
            shift
            ;;
        --)
            shift
            codex_args=("$@")
            break
            ;;
        -*)
            echo "Error: unknown option: $1" >&2
            usage
            exit 1
            ;;
        *)
            if [[ -n "$task_name" ]]; then
                echo "Error: task-name is already specified: $task_name" >&2
                usage
                exit 1
            fi
            task_name="$1"
            shift
            ;;
    esac
done

if [[ -z "$task_name" ]]; then
    echo "Error: task-name is required" >&2
    usage
    exit 1
fi

require_command git
if [[ "$open_codex" -eq 1 ]]; then
    require_command codex
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$repo_root" ]]; then
    echo "Error: current directory is not inside a git repository" >&2
    exit 1
fi

if [[ -z "$base_ref" ]]; then
    base_ref="$(resolve_default_base_ref "$repo_root")"
fi

if ! git -C "$repo_root" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
    echo "Error: base ref not found: $base_ref" >&2
    exit 1
fi

branch_suffix="${task_name#codex/}"
slug="$(slugify "$branch_suffix")"
if [[ -z "$slug" ]]; then
    echo "Error: task-name must contain at least one alphanumeric character" >&2
    exit 1
fi

branch_name="codex/$slug"

if git -C "$repo_root" worktree list --porcelain | awk '/^branch / {print $2}' | grep -Fxq "refs/heads/$branch_name"; then
    echo "Error: branch is already checked out in another worktree: $branch_name" >&2
    exit 1
fi

worktree_root="${CODEX_WORKTREE_ROOT:-$HOME/.codex/worktrees}"
mkdir -p "$worktree_root"
session_dir="$(mktemp -d "${worktree_root%/}/${slug}-XXXXXX")"
session_dir="$(cd "$session_dir" && pwd -P)"
repo_name="$(basename "$repo_root")"
worktree_path="$session_dir/$repo_name"

if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch_name"; then
    git -C "$repo_root" worktree add "$worktree_path" "$branch_name"
else
    git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path" "$base_ref"
fi

env_sync_script="$repo_root/setup/create-worktree-with-env.sh"
if [[ -x "$env_sync_script" ]]; then
    env WORKTREE_SYNC_IGNORED_PATHS="${WORKTREE_SYNC_IGNORED_PATHS:-}" \
        "$env_sync_script" --source "$repo_root" --target "$worktree_path"
fi

echo "Created worktree: $worktree_path"
echo "Branch: $branch_name"
echo "Base ref: $base_ref"

if [[ "$open_codex" -eq 0 ]]; then
    printf 'Run: codex'
    for arg in "${codex_default_args[@]}"; do
        printf ' %q' "$arg"
    done
    printf ' --cd %q' "$worktree_path"
    if [[ ${#codex_args[@]} -gt 0 ]]; then
        for arg in "${codex_args[@]}"; do
            printf ' %q' "$arg"
        done
    fi
    printf '\n'
    exit 0
fi

if [[ ${#codex_args[@]} -gt 0 ]]; then
    exec codex "${codex_default_args[@]}" --cd "$worktree_path" "${codex_args[@]}"
else
    exec codex "${codex_default_args[@]}" --cd "$worktree_path"
fi
