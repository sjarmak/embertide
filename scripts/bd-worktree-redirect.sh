#!/usr/bin/env bash
# bd-worktree-redirect.sh — make bd commands work inside a git worktree
# of this repo by writing a `.beads/redirect` file pointing at the main
# repo's `.beads/`.
#
# Background: when a worktree is created via `git worktree add`, the
# tracked subset of `.beads/` (config.yaml, issues.jsonl, metadata.json,
# hooks/, README.md, .gitignore) is checked out, but the gitignored Dolt
# state (.beads/dolt/, .beads/embeddeddolt/, dolt-server.{pid,port,...})
# is missing. Without that, bd cannot reach a Dolt server and every
# command errors with "Dolt server unreachable at 127.0.0.1:0".
#
# The fix is bd's built-in worktree-redirect feature: a `.beads/redirect`
# file containing a path (relative to the worktree root) that points at
# the main repo's `.beads/` directory. With the file present, bd uses the
# main repo's running Dolt server transparently. The file is gitignored
# (per .beads/.gitignore) because the relative path is per-checkout.
#
# This script is idempotent and a no-op when run from the main worktree.
# Run it inside any worktree before invoking `bd`:
#
#   bash scripts/bd-worktree-redirect.sh
#
# Sibling bead `embertide-cqvk` covers the orchestrator-side fix in
# the agent-workflows repo (orchestrator writes the redirect itself before
# dispatching subagents). This script is the recurring playbook for any
# non-orchestrator worktree usage.
set -euo pipefail

err() { echo "bd-worktree-redirect: $*" >&2; }

# ---------------------------------------------------------------------------
# 1. Detect main vs secondary worktree.
# ---------------------------------------------------------------------------
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  err "not inside a git repository — nothing to do"
  exit 1
fi

# --absolute-git-dir is available since git 2.13 (2017).
# --git-common-dir lacks an absolute variant before git 2.45, so we
# cd+pwd to resolve it.
GIT_DIR_ABS=$(git rev-parse --absolute-git-dir)
GIT_COMMON_ABS=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)

if [[ "$GIT_DIR_ABS" = "$GIT_COMMON_ABS" ]]; then
  echo "bd-worktree-redirect: in main worktree, no-op."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Locate main repo root and verify it has a usable .beads/.
# ---------------------------------------------------------------------------
# git common dir is <main-repo>/.git (or a bare-repo path). Its parent is
# the main worktree root for non-bare clones — which is what bd needs.
MAIN_ROOT=$(dirname "$GIT_COMMON_ABS")
MAIN_BEADS="$MAIN_ROOT/.beads"

if [[ ! -f "$MAIN_BEADS/config.yaml" ]]; then
  err "main repo .beads/ missing or invalid at: $MAIN_BEADS"
  err "expected $MAIN_BEADS/config.yaml. If this is a bare-repo layout, redirect is unsupported."
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. bd version check (warn-only — feature stable since v1.0.x).
# ---------------------------------------------------------------------------
if command -v bd >/dev/null 2>&1; then
  BD_VERSION=$(bd --version 2>/dev/null | sed -n 's/^bd version \([0-9][0-9.]*\).*/\1/p' | head -1)
  if [[ -n "$BD_VERSION" ]] && [[ ! "$BD_VERSION" =~ ^1\. ]]; then
    err "warning: bd version $BD_VERSION not in tested 1.x range — redirect semantics may differ"
  fi
else
  err "warning: 'bd' not in PATH — redirect file will be written but cannot be smoke-tested"
fi

# ---------------------------------------------------------------------------
# 4. Compute relative path from worktree root to main .beads/.
# ---------------------------------------------------------------------------
WORKTREE_ROOT=$(git rev-parse --show-toplevel)

# Pure-bash relative-path computation (no GNU realpath dependency).
# Walks $base up the tree, prepending '../' to $up, until $base is a
# prefix of $target — then appends the remaining tail of $target.
# Returns 1 if $target and $base share no common ancestor above '/'.
relpath() {
  local target=${1%/} base=${2%/} up=""
  while [[ "$target" != "$base" && "$target" != "$base"/* ]]; do
    if [[ "$base" = "/" || -z "$base" ]]; then
      return 1
    fi
    base=$(dirname "$base")
    up="../$up"
  done
  if [[ "$target" = "$base" ]]; then
    printf '%s' "${up%/}"
  else
    printf '%s%s' "$up" "${target#"$base"/}"
  fi
}

if ! REL=$(relpath "$MAIN_BEADS" "$WORKTREE_ROOT") || [[ -z "$REL" ]]; then
  err "could not compute relative path from $WORKTREE_ROOT to $MAIN_BEADS — paths share no common ancestor above /"
  exit 1
fi

# ---------------------------------------------------------------------------
# 5. Write redirect file (idempotent).
# ---------------------------------------------------------------------------
REDIRECT_FILE="$WORKTREE_ROOT/.beads/redirect"
mkdir -p "$WORKTREE_ROOT/.beads"

if [[ -f "$REDIRECT_FILE" ]]; then
  EXISTING=$(cat "$REDIRECT_FILE")
  if [[ "$EXISTING" = "$REL" ]]; then
    echo "bd-worktree-redirect: already configured ($REL), no change."
    exit 0
  fi
  err "warning: existing redirect '$EXISTING' does not match computed '$REL' — overwriting"
fi

printf '%s\n' "$REL" > "$REDIRECT_FILE"
echo "bd-worktree-redirect: wrote $REDIRECT_FILE → $REL"
