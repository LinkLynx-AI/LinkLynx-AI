#!/bin/bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./setup/create-worktree-with-env.sh

Example:
  ./setup/create-worktree-with-env.sh
EOF
}

if [[ $# -ne 0 ]]; then
    usage
    exit 1
fi

TARGET_WORKTREE_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [[ ! -d "$TARGET_WORKTREE_PATH/.git" && ! -f "$TARGET_WORKTREE_PATH/.git" ]]; then
    echo "Error: current directory is not a git repository: $TARGET_WORKTREE_PATH" >&2
    exit 1
fi

SOURCE_REPO_PATHS=()
while IFS= read -r path; do
    if [[ "$path" != "$TARGET_WORKTREE_PATH" && -d "$path/.git" ]]; then
        SOURCE_REPO_PATHS+=("$path")
    fi
done < <(git -C "$TARGET_WORKTREE_PATH" worktree list --porcelain | awk '/^worktree / {print substr($0, 10)}')

if [[ ${#SOURCE_REPO_PATHS[@]} -eq 0 ]]; then
    echo "Error: could not auto-detect source local repo path from git worktree list" >&2
    exit 1
fi

if [[ ${#SOURCE_REPO_PATHS[@]} -gt 1 ]]; then
    echo "Error: multiple source local repo candidates detected. keep only one main checkout." >&2
    for path in "${SOURCE_REPO_PATHS[@]}"; do
        echo "  - $path" >&2
    done
    exit 1
fi

SOURCE_REPO_PATH="${SOURCE_REPO_PATHS[0]}"

echo "Copying env files to current worktree: $TARGET_WORKTREE_PATH"
echo "Detected source local repo: $SOURCE_REPO_PATH"
copied_count=0

while IFS= read -r source_file; do
    rel_path="${source_file#"$SOURCE_REPO_PATH"/}"
    dest_file="$TARGET_WORKTREE_PATH/$rel_path"

    mkdir -p "$(dirname "$dest_file")"
    cp "$source_file" "$dest_file"
    copied_count=$((copied_count + 1))
done < <(
    find "$SOURCE_REPO_PATH" \
        -type f \
        \( -name ".env" -o -name ".env.*" \) \
        -not -name ".env.example" \
        -not -name ".env.*.example" \
        -not -path "$SOURCE_REPO_PATH/.git/*"
)

echo "Done. Synced env files to: $TARGET_WORKTREE_PATH"
echo "Copied env files: $copied_count"
