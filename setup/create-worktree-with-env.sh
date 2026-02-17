#!/bin/bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./setup/create-worktree-with-env.sh <new-worktree-path> <branch-name> [source-repo-path]

Examples:
  ./setup/create-worktree-with-env.sh ../linklinx-feature feat/my-task
  ./setup/create-worktree-with-env.sh /tmp/linklinx-test feat/my-task /path/to/linklinx
EOF
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
    usage
    exit 1
fi

TARGET_WORKTREE_PATH="$1"
BRANCH_NAME="$2"
SOURCE_REPO_PATH="${3:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

if [[ ! -d "$SOURCE_REPO_PATH" ]]; then
    echo "Error: source repository path does not exist: $SOURCE_REPO_PATH" >&2
    exit 1
fi

if [[ -e "$TARGET_WORKTREE_PATH" ]]; then
    echo "Error: target worktree path already exists: $TARGET_WORKTREE_PATH" >&2
    exit 1
fi

if [[ ! -d "$SOURCE_REPO_PATH/.git" && ! -f "$SOURCE_REPO_PATH/.git" ]]; then
    echo "Error: source path is not a git repository: $SOURCE_REPO_PATH" >&2
    exit 1
fi

echo "Creating git worktree..."
if git -C "$SOURCE_REPO_PATH" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    git -C "$SOURCE_REPO_PATH" worktree add "$TARGET_WORKTREE_PATH" "$BRANCH_NAME"
else
    git -C "$SOURCE_REPO_PATH" worktree add -b "$BRANCH_NAME" "$TARGET_WORKTREE_PATH"
fi

echo "Copying env files..."
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

echo "Done. Created worktree: $TARGET_WORKTREE_PATH"
echo "Copied env files: $copied_count"
