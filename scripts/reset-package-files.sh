#!/usr/bin/env bash
set -euo pipefail

# Files that frequently cause pull failures when they have local edits
FILES=("package.json" "package-lock.json")

# Fail early if we are not inside the repository root
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "This script must be run inside a git repository." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

echo "Resetting package manifests back to HEAD..."
for file in "${FILES[@]}"; do
  if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    # Clear skip-worktree if it was ever set so git restore works reliably
    git update-index --no-skip-worktree "$file" 2>/dev/null || true
    git restore --staged --worktree "$file" || true
    echo " - Reset $file"
  else
    echo " - Skipped $file (not tracked)"
  fi
done

echo "Done. Run 'git status' to confirm and then retry 'git pull'."
