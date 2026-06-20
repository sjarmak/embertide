#!/usr/bin/env bash
# Auto-remove stale .claude/worktrees/agent-* directories left behind by
# parallel /focus, /diverge-prototype, and prd-build runs.
#
# Wires via .githooks/post-merge (default --dry-run) or cron. Default mode
# is dry-run; pass --apply to actually delete.
#
# Detection layers (architect C1 — single ancestor check is not enough):
#   1. branch is ancestor of master       → merged-ancestor
#   2. `git cherry master <branch>` clean → merged-patch (squash-merges)
#   3. (--aggressive only) tip > N days   → merged-age
#
# Lock policy (architect C2 — empty lock != no owner):
#   - lock file present with parseable pid=N + dead   → eligible
#   - lock file absent (no-lock)                       → SKIP (anomalous)
#   - lock file present but empty / no pid (empty-lock) → SKIP
#   - lock file present + pid alive                    → SKIP (live-pid)
#
# Race protection: flock on .claude/worktrees/.sweep.lock; re-stat the
# worktree directory inode immediately before rm.

set -u
set -o pipefail
# Don't set -e — many checks (kill -0, grep, git rev-parse) intentionally
# fail and we handle their exit codes. pipefail is orthogonal: ensures
# `printf | tee` propagates a tee failure (audit log unwritable).

# ---------- defaults ----------

APPLY=0
AGGRESSIVE=0
MASTER="master"
WORKTREES_DIR=".claude/worktrees"
AGE_DAYS=14

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Auto-remove stale agent-* worktrees that are merged into master and whose
owning agent process is dead.

Options:
  --apply              Actually delete (default: dry-run).
  --aggressive         Add age-based fallback: tip older than --age-days
                       AND dead-pid counts as merged.
  --master <branch>    Branch to compare against (default: master).
  --worktrees-dir <p>  Path to worktrees dir (default: .claude/worktrees).
  --age-days <N>       Age threshold for --aggressive (default: 14).
  --help               This help.

Wiring:
  Recommended: install .githooks/post-merge so this runs --dry-run after
  every merge to master. Promote to --apply once the .sweep.log looks sane.
EOF
}

# ---------- arg parsing ----------

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --aggressive) AGGRESSIVE=1; shift ;;
    --master) MASTER="$2"; shift 2 ;;
    --worktrees-dir) WORKTREES_DIR="$2"; shift 2 ;;
    --age-days) AGE_DAYS="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ! -d "$WORKTREES_DIR" ]; then
  # Nothing to sweep — exit 0 silently. Common case: clean repo, no worktrees.
  exit 0
fi

LOCK_FILE="$WORKTREES_DIR/.sweep.lock"
LOG_FILE="$WORKTREES_DIR/.sweep.log"

# ---------- mutual exclusion ----------

# flock -n: exit immediately if another sweep is running. fd 9 is arbitrary.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "another sweep is in progress (lock=$LOCK_FILE) — exiting" >&2
  exit 1
fi

# ---------- helpers ----------

mode_label() {
  if [ "$APPLY" = "1" ]; then echo "APPLY"; else echo "DRY-RUN"; fi
}

log() {
  local entry="$1" reason="$2"
  local ts; ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s [%s] %s: %s\n' "$ts" "$(mode_label)" "$entry" "$reason" \
    | tee -a "$LOG_FILE"
}

# Extract the worktree admin dir from a worktree path.
# Each worktree has a .git FILE containing "gitdir: <admin-dir>".
get_admin_dir() {
  local wt_path="$1"
  [ -f "$wt_path/.git" ] || return 1
  sed -n 's/^gitdir: //p' "$wt_path/.git" | head -1
}

# Classify lock file. Echoes one of: no-lock, empty-lock, live-pid:N, dead-pid:N
classify_lock() {
  local admin_dir="$1"
  local lockfile="$admin_dir/locked"
  if [ ! -f "$lockfile" ]; then
    echo "no-lock"
    return
  fi
  local content; content=$(cat "$lockfile" 2>/dev/null || true)
  if [ -z "$content" ]; then
    echo "empty-lock"
    return
  fi
  local pid; pid=$(printf '%s' "$content" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  if [ -z "$pid" ]; then
    # Lock file has content but no parseable pid — treat as empty-lock.
    # Architect C2: never delete on ambiguous owner info.
    echo "empty-lock"
    return
  fi
  # Sec H2: reject obviously-bogus pids that any attacker could set to
  # permanently exempt their worktree from sweep. pid<100 is reserved/init
  # range; pid==$$ would be the sweeper spoofing itself. Anything else,
  # trust kill -0.
  if [ "$pid" -lt 100 ] || [ "$pid" = "$$" ]; then
    echo "suspicious-pid:$pid"
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    echo "live-pid:$pid"
  else
    echo "dead-pid:$pid"
  fi
}

# Echo: merged-ancestor, merged-patch, merged-age, or unmerged
classify_merge() {
  local branch="$1"
  if git merge-base --is-ancestor "$branch" "$MASTER" 2>/dev/null; then
    echo "merged-ancestor"
    return
  fi
  # `git cherry` lists each commit on <branch> not in <master>: '+' = unique,
  # '-' = patch-id already present (squash-merged). Zero '+' lines → merged.
  local unique
  unique=$(git cherry "$MASTER" "$branch" 2>/dev/null | grep -c '^+' || true)
  if [ "$unique" = "0" ]; then
    echo "merged-patch"
    return
  fi
  if [ "$AGGRESSIVE" = "1" ]; then
    local tip_ts now_ts age_secs
    tip_ts=$(git log -1 --format=%ct "$branch" 2>/dev/null || echo 0)
    now_ts=$(date +%s)
    age_secs=$(( now_ts - tip_ts ))
    if [ "$tip_ts" != "0" ] && [ "$age_secs" -gt $(( AGE_DAYS * 86400 )) ]; then
      echo "merged-age"
      return
    fi
  fi
  echo "unmerged"
}

get_inode() {
  stat -c '%i' "$1" 2>/dev/null || echo "missing"
}

remove_worktree() {
  local wt_path="$1" branch="$2"
  git worktree unlock "$wt_path" 2>/dev/null || true
  if ! git worktree remove --force "$wt_path" 2>/dev/null; then
    # Code M1: distinguish git-managed removal from rm-fallback in caller's log.
    rm -rf "$wt_path"
    git worktree prune 2>/dev/null || true
    REMOVE_FALLBACK=1
  fi
  git branch -D "$branch" 2>/dev/null || true
}

# ---------- main sweep ----------

shopt -s nullglob
for wt_path in "$WORKTREES_DIR"/agent-*; do
  [ -d "$wt_path" ] || continue
  slug=$(basename "$wt_path" | sed 's/^agent-//')
  # Sec H1: validate slug before passing to git ref operations. Rejects
  # path-traversal, option-injection (slugs starting with -), and any
  # slug with shell-meta characters that could confuse downstream git.
  if ! [[ "$slug" =~ ^[a-zA-Z0-9._]+$ ]]; then
    log "$wt_path" "invalid-slug SKIP"
    continue
  fi
  branch="worktree-agent-$slug"

  admin_dir=$(get_admin_dir "$wt_path") || admin_dir=""
  if [ -z "$admin_dir" ]; then
    log "$wt_path" "no-admin-dir (anomalous, SKIP)"
    continue
  fi

  lock_state=$(classify_lock "$admin_dir")
  case "$lock_state" in
    dead-pid:*) ;; # eligible — fall through to merge check
    *)          log "$wt_path" "$lock_state SKIP"; continue ;;
  esac

  # Sec CRITICAL / Code L: capture inode BEFORE the merge check so the
  # re-stat at rm-time spans the whole classification window. Detects
  # an attacker swapping the worktree dir for a symlink between our
  # decision and the rm call. Without this position, both stats happen
  # back-to-back and the guard never fires.
  pre_inode=$(get_inode "$wt_path")

  merge_state=$(classify_merge "$branch")
  if [ "$merge_state" = "unmerged" ]; then
    log "$wt_path" "$lock_state unmerged SKIP"
    continue
  fi

  if [ "$APPLY" = "1" ]; then
    cur_inode=$(get_inode "$wt_path")
    if [ "$pre_inode" != "$cur_inode" ]; then
      log "$wt_path" "$lock_state $merge_state inode-changed ABORT"
      continue
    fi
    REMOVE_FALLBACK=0
    remove_worktree "$wt_path" "$branch"
    if [ "$REMOVE_FALLBACK" = "1" ]; then
      log "$wt_path" "$lock_state $merge_state REMOVED rm-fallback"
    else
      log "$wt_path" "$lock_state $merge_state REMOVED"
    fi
  else
    log "$wt_path" "$lock_state $merge_state would-remove"
  fi
done
shopt -u nullglob

# ---------- dangling branches (no worktree dir) ----------

# Branches matching worktree-agent-* with no associated worktree.
# Code H1: read line-by-line (safe IFS) and use grep -qxF for membership
# (literal-match, no glob risk). Branch names CAN contain glob metas in
# theory; never trust the input format.
existing_branches=$(git for-each-ref --format='%(refname:short)' 'refs/heads/worktree-agent-*' 2>/dev/null || true)
worktree_branches=$(git worktree list --porcelain 2>/dev/null \
  | sed -n 's|^branch refs/heads/||p' || true)

while IFS= read -r branch; do
  [ -z "$branch" ] && continue
  if printf '%s\n' "$worktree_branches" | grep -qxF "$branch"; then
    continue  # has a worktree, handled above
  fi
  merge_state=$(classify_merge "$branch")
  case "$merge_state" in
    merged-ancestor|merged-patch|merged-age)
      if [ "$APPLY" = "1" ]; then
        git branch -D "$branch" >/dev/null 2>&1 || true
        log "$branch" "dangling $merge_state REMOVED"
      else
        log "$branch" "dangling $merge_state would-remove"
      fi
      ;;
    unmerged)
      log "$branch" "dangling unmerged SKIP"
      ;;
  esac
done <<< "$existing_branches"

exit 0
