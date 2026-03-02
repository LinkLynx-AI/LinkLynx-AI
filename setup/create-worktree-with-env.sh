#!/bin/bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./setup/create-worktree-with-env.sh [--source <path>] [--target <path>] [--pathspec <git-pathspec> ...]

Example:
  ./setup/create-worktree-with-env.sh
  ./setup/create-worktree-with-env.sh --source /path/to/main-checkout --target /path/to/new-worktree

Environment:
  WORKTREE_SYNC_IGNORED_PATHS
    Comma separated git pathspec list to sync.
    Default:
      .env,**/.env,.env.local,**/.env.local,.env.*.local,**/.env.*.local
EOF
}

canonical_path() {
    local path="$1"
    (cd "$path" && pwd -P)
}

resolve_repo_root() {
    local path="$1"
    git -C "$path" rev-parse --show-toplevel 2>/dev/null || true
}

resolve_git_common_dir() {
    local repo_root="$1"
    local common_dir
    common_dir="$(git -C "$repo_root" rev-parse --git-common-dir 2>/dev/null || true)"
    if [[ -z "$common_dir" ]]; then
        return 1
    fi

    if [[ "$common_dir" = /* ]]; then
        (cd "$common_dir" && pwd -P)
    else
        (cd "$repo_root/$common_dir" && pwd -P)
    fi
}

resolve_source_repo_path() {
    local target_repo_root="$1"
    local target_canonical
    target_canonical="$(canonical_path "$target_repo_root")"

    local candidates=()
    local primary_candidates=()
    while IFS= read -r worktree_path; do
        if [[ ! -d "$worktree_path" ]]; then
            continue
        fi

        local worktree_canonical
        worktree_canonical="$(canonical_path "$worktree_path")"
        if [[ "$worktree_canonical" == "$target_canonical" ]]; then
            continue
        fi

        if [[ -d "$worktree_canonical/.git" || -f "$worktree_canonical/.git" ]]; then
            candidates+=("$worktree_canonical")
            if [[ -d "$worktree_canonical/.git" ]]; then
                primary_candidates+=("$worktree_canonical")
            fi
        fi
    done < <(git -C "$target_repo_root" worktree list --porcelain | awk '/^worktree / {print substr($0, 10)}')

    if [[ ${#primary_candidates[@]} -gt 0 ]]; then
        printf '%s\n' "${primary_candidates[0]}"
        if [[ ${#primary_candidates[@]} -gt 1 ]]; then
            echo "Warning: multiple primary checkout candidates detected. Use first: ${primary_candidates[0]}" >&2
        fi
        return 0
    fi

    if [[ ${#candidates[@]} -eq 0 ]]; then
        echo "Error: could not auto-detect source local repo path from git worktree list" >&2
        return 1
    fi

    printf '%s\n' "${candidates[0]}"
    if [[ ${#candidates[@]} -gt 1 ]]; then
        echo "Warning: multiple source candidates detected. Use first: ${candidates[0]}" >&2
    fi
}

source_path_arg=""
target_path_arg=""
pathspecs=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --source)
            if [[ $# -lt 2 ]]; then
                echo "Error: --source requires a value" >&2
                usage
                exit 1
            fi
            source_path_arg="$2"
            shift 2
            ;;
        --target)
            if [[ $# -lt 2 ]]; then
                echo "Error: --target requires a value" >&2
                usage
                exit 1
            fi
            target_path_arg="$2"
            shift 2
            ;;
        --pathspec)
            if [[ $# -lt 2 ]]; then
                echo "Error: --pathspec requires a value" >&2
                usage
                exit 1
            fi
            pathspecs+=("$2")
            shift 2
            ;;
        *)
            echo "Error: unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
done

TARGET_WORKTREE_PATH="${target_path_arg:-$(resolve_repo_root .)}"
if [[ -z "$TARGET_WORKTREE_PATH" ]]; then
    TARGET_WORKTREE_PATH="$(pwd -P)"
fi
TARGET_WORKTREE_PATH="$(canonical_path "$TARGET_WORKTREE_PATH")"

if [[ ! -d "$TARGET_WORKTREE_PATH/.git" && ! -f "$TARGET_WORKTREE_PATH/.git" ]]; then
    echo "Error: target is not a git repository: $TARGET_WORKTREE_PATH" >&2
    exit 1
fi

if [[ -n "$source_path_arg" ]]; then
    SOURCE_REPO_PATH="$(resolve_repo_root "$source_path_arg")"
    if [[ -z "$SOURCE_REPO_PATH" ]]; then
        echo "Error: source is not inside a git repository: $source_path_arg" >&2
        exit 1
    fi
    SOURCE_REPO_PATH="$(canonical_path "$SOURCE_REPO_PATH")"
else
    SOURCE_REPO_PATH="$(resolve_source_repo_path "$TARGET_WORKTREE_PATH")"
fi

target_common_dir="$(resolve_git_common_dir "$TARGET_WORKTREE_PATH")"
source_common_dir="$(resolve_git_common_dir "$SOURCE_REPO_PATH")"
if [[ "$target_common_dir" != "$source_common_dir" ]]; then
    echo "Error: source and target are not in the same git worktree set" >&2
    echo "  source: $SOURCE_REPO_PATH" >&2
    echo "  target: $TARGET_WORKTREE_PATH" >&2
    exit 1
fi

if [[ ${#pathspecs[@]} -eq 0 ]]; then
    if [[ -n "${WORKTREE_SYNC_IGNORED_PATHS:-}" ]]; then
        temp_ifs="$IFS"
        IFS=','
        read -r -a pathspecs <<<"$WORKTREE_SYNC_IGNORED_PATHS"
        IFS="$temp_ifs"
    else
        pathspecs=(
            ".env"
            "**/.env"
            ".env.local"
            "**/.env.local"
            ".env.*.local"
            "**/.env.*.local"
        )
    fi
fi

echo "Copying ignored development files to current worktree: $TARGET_WORKTREE_PATH"
echo "Detected source local repo: $SOURCE_REPO_PATH"

copied_count=0
skipped_count=0
missing_source_count=0
detected_count=0

ignored_files_tmp="$(mktemp)"
cleanup_ignored_files_tmp() {
    if [[ -n "${ignored_files_tmp:-}" && -f "$ignored_files_tmp" ]]; then
        rm -f "$ignored_files_tmp"
    fi
}
trap cleanup_ignored_files_tmp EXIT

if ! git -C "$SOURCE_REPO_PATH" ls-files --others -i --exclude-standard -z -- "${pathspecs[@]}" >"$ignored_files_tmp"; then
    echo "Error: failed to list ignored files from source repository" >&2
    exit 1
fi

while IFS= read -r -d '' rel_path; do
    source_file="$SOURCE_REPO_PATH/$rel_path"
    dest_file="$TARGET_WORKTREE_PATH/$rel_path"
    detected_count=$((detected_count + 1))

    if [[ ! -f "$source_file" ]]; then
        missing_source_count=$((missing_source_count + 1))
        continue
    fi

    if [[ -e "$dest_file" ]]; then
        echo "Warning: destination file already exists, skipping: $dest_file" >&2
        skipped_count=$((skipped_count + 1))
        continue
    fi

    if [[ ! -r "$source_file" ]]; then
        echo "Warning: source file is not readable, skipping: $source_file" >&2
        skipped_count=$((skipped_count + 1))
        continue
    fi

    if ! mkdir -p "$(dirname "$dest_file")"; then
        echo "Warning: failed to create destination directory, skipping: $dest_file" >&2
        skipped_count=$((skipped_count + 1))
        continue
    fi

    if ! cp "$source_file" "$dest_file"; then
        echo "Warning: failed to copy file, skipping: $source_file" >&2
        skipped_count=$((skipped_count + 1))
        continue
    fi

    copied_count=$((copied_count + 1))
done < "$ignored_files_tmp"

echo "Done. Synced ignored development files to: $TARGET_WORKTREE_PATH"
echo "Detected files: $detected_count"
echo "Copied files: $copied_count"
echo "Skipped existing files: $skipped_count"
echo "Skipped missing source files: $missing_source_count"
