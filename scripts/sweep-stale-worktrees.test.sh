#!/usr/bin/env bash
# Tests for sweep-stale-worktrees.sh.
#
# Each test runs in its own subshell with an EXIT trap that removes the
# temp repo. setup_repo() sets TEST_DIR + cds there; the trap is set by
# run_test on the subshell to fire exactly once. Run:
#   bash scripts/sweep-stale-worktrees.test.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWEEPER="$SCRIPT_DIR/sweep-stale-worktrees.sh"

PASSED=0
FAILED=0
FAILURES=()

# ---------- helpers ----------
# Each test runs in a subshell (run_test), so counter mutations inside the
# test wouldn't propagate to the parent. fail/pass print to stdout/stderr;
# the parent reads the subshell exit code (0 = pass, nonzero = fail) and
# updates counters based on that.

fail() {
  echo "  FAIL: $1" >&2
  return 1
}

pass() {
  echo "  ok"
  return 0
}

assert_eq() {
  local expected="$1" actual="$2" msg="$3"
  if [ "$expected" = "$actual" ]; then return 0; fi
  fail "$msg (expected='$expected' actual='$actual')"
  return 1
}

assert_contains() {
  local haystack="$1" needle="$2" msg="$3"
  if echo "$haystack" | grep -qF "$needle"; then return 0; fi
  fail "$msg (output did not contain '$needle')"
  return 1
}

# Find a guaranteed-dead pid by spawning + killing a short-lived process.
# More reliable than guessing a number — kernel won't reuse the slot for at
# least one cycle through pid_max, and we re-verify before use.
get_dead_pid() {
  local pid
  sleep 0.01 & pid=$!
  wait "$pid" 2>/dev/null || true
  # Re-verify the pid is actually dead (it should be).
  if kill -0 "$pid" 2>/dev/null; then
    echo "FATAL: could not obtain dead pid (got $pid, still alive)" >&2
    exit 2
  fi
  echo "$pid"
}

DEAD_PID=$(get_dead_pid)

# Sanity: every merge/commit helper assumes cwd is the test repo root.
_assert_in_repo() {
  if [ ! -d .git ] && [ ! -f .git ]; then
    echo "FATAL: helper '${FUNCNAME[1]}' called outside repo (cwd=$PWD)" >&2
    exit 2
  fi
}

setup_repo() {
  TEST_DIR=$(mktemp -d)
  cd "$TEST_DIR"
  git init -q -b master
  git -c commit.gpgsign=false commit --allow-empty -m "init" -q
  mkdir -p .claude/worktrees
}

# Add a worktree with a specific branch and lock state.
# Args: <slug> <lock-mode: alive|dead|empty|none> [<extra-commit-msg>]
add_worktree() {
  _assert_in_repo
  local slug="$1" lockmode="$2" extra="${3:-}"
  local path=".claude/worktrees/agent-$slug"
  local branch="worktree-agent-$slug"
  git worktree add -q -b "$branch" "$path" master
  if [ -n "$extra" ]; then
    # Create a real file change — empty commits have no diff for
    # `git merge --squash` to stage, breaking the squash-merge fixture.
    echo "$extra" > "$path/$slug.txt"
    git -C "$path" add "$slug.txt"
    git -C "$path" -c commit.gpgsign=false commit -m "$extra" -q
  fi
  case "$lockmode" in
    alive)
      # $$ is the test-runner's pid; alive for the duration of this test.
      # Using $$ rather than a magic number guarantees the pid exists when
      # the sweeper checks `kill -0`, since we ARE that process.
      git worktree lock --reason "pid=$$ added by test" "$path"
      ;;
    dead)
      git worktree lock --reason "pid=$DEAD_PID added by test" "$path"
      ;;
    empty)
      # `git worktree lock` without --reason writes empty body.
      # Sweeper must SKIP this case (architect C2) — empty != "no owner".
      git worktree lock "$path"
      ;;
    none)
      : # no lock file
      ;;
    *) echo "unknown lock mode: $lockmode" >&2; exit 2 ;;
  esac
}

# Force a merge commit (not a fast-forward). Branch tip remains an ancestor
# of master, which is the case the sweeper's --is-ancestor fast-path catches.
merge_commit() {
  _assert_in_repo
  local branch="$1"
  git -c commit.gpgsign=false merge --no-ff "$branch" -q -m "merge $branch" --no-edit
}

# Squash-merge: branch tip is NOT an ancestor of master, but the patches are
# present. Architect C1 — sweeper must detect this via `git cherry`.
squash_merge() {
  _assert_in_repo
  local branch="$1"
  git -c commit.gpgsign=false merge --squash "$branch" -q
  git -c commit.gpgsign=false commit -m "squash $branch" -q
}

run_test() {
  CURRENT_TEST="$1"
  echo "TEST: $CURRENT_TEST"
  shift
  if (
    trap 'rm -rf "${TEST_DIR:-/nonexistent/never}"' EXIT
    "$@"
  ); then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    FAILURES+=("$CURRENT_TEST")
  fi
}

# ---------- tests ----------

test_ancestor_merged_removed_in_apply() {
  setup_repo
  add_worktree m1 dead "work on m1"
  merge_commit worktree-agent-m1
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ -e ".claude/worktrees/agent-m1" ]; then
    fail "agent-m1 dir still exists after --apply"; return
  fi
  if git rev-parse --verify worktree-agent-m1 2>/dev/null; then
    fail "worktree-agent-m1 branch still exists after --apply"; return
  fi
  assert_contains "$out" "merged-ancestor" "decision log should mention merged-ancestor" || return
  pass
}

test_squash_merged_removed() {
  setup_repo
  add_worktree s1 dead "squash-target"
  squash_merge worktree-agent-s1
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ -e ".claude/worktrees/agent-s1" ]; then
    fail "squash-merged worktree should be removed but still exists"; return
  fi
  assert_contains "$out" "merged-patch" "should detect via cherry/patch-id" || return
  pass
}

test_unmerged_skipped() {
  setup_repo
  add_worktree u1 dead "unique work never merged"
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent-u1" ]; then
    fail "unmerged worktree was removed — should have been skipped"; return
  fi
  assert_contains "$out" "unmerged" "should log unmerged skip reason" || return
  pass
}

test_alive_pid_skipped() {
  setup_repo
  add_worktree a1 alive "would-be-merged"
  merge_commit worktree-agent-a1
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent-a1" ]; then
    fail "alive-pid worktree was removed — should have been skipped"; return
  fi
  assert_contains "$out" "live-pid" "should log live-pid skip" || return
  pass
}

test_empty_lock_skipped() {
  setup_repo
  add_worktree e1 empty "would-be-merged"
  merge_commit worktree-agent-e1
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent-e1" ]; then
    fail "empty-lock worktree was removed — should have been skipped (architect C2)"; return
  fi
  assert_contains "$out" "empty-lock" "should log empty-lock skip" || return
  pass
}

test_no_lock_skipped() {
  setup_repo
  add_worktree n1 none "would-be-merged"
  merge_commit worktree-agent-n1
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent-n1" ]; then
    fail "unlocked worktree was removed — agent-* without lock is anomalous, must skip"; return
  fi
  assert_contains "$out" "no-lock" "should log no-lock skip" || return
  pass
}

test_dry_run_mutates_nothing() {
  setup_repo
  add_worktree d1 dead "merged"
  merge_commit worktree-agent-d1
  # Capture VISIBLE worktrees only (excludes .sweep.lock / .sweep.log
  # which the sweeper creates in dry-run too — those are audit-trail,
  # not state-mutation. M2: use a precise comparison so the test asserts
  # what it claims rather than relying on `ls` hiding dotfiles silently.
  before=$(find .claude/worktrees -mindepth 1 -maxdepth 1 ! -name '.*' | sort)
  out=$("$SWEEPER" --master master 2>&1)  # default is dry-run
  after=$(find .claude/worktrees -mindepth 1 -maxdepth 1 ! -name '.*' | sort)
  assert_eq "$before" "$after" "dry-run must not mutate worktree dirs" || return
  if ! git rev-parse --verify worktree-agent-d1 >/dev/null 2>&1; then
    fail "dry-run deleted the branch"; return
  fi
  assert_contains "$out" "DRY-RUN" "dry-run output should advertise itself" || return
  pass
}

test_idempotency() {
  setup_repo
  add_worktree i1 dead "merged"
  add_worktree i2 dead "unmerged-keep"
  merge_commit worktree-agent-i1
  "$SWEEPER" --apply --master master >/dev/null 2>&1
  if ! "$SWEEPER" --apply --master master >/dev/null 2>&1; then
    fail "second --apply run should be idempotent (exit 0)"; return
  fi
  pass
}

test_suspicious_pid_skipped() {
  setup_repo
  # A lock file claiming pid=1 (init) — a malicious agent could write this
  # to permanently exempt itself from sweep, since kill -0 1 always succeeds.
  # Sweeper must reject pid<100 as suspicious.
  add_worktree sp1 none "would-be-merged"
  merge_commit worktree-agent-sp1
  admin=$(sed -n 's/^gitdir: //p' .claude/worktrees/agent-sp1/.git)
  printf 'pid=1 fake init claim\n' > "$admin/locked"
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent-sp1" ]; then
    fail "suspicious-pid worktree was removed — must SKIP (sec H2)"; return
  fi
  assert_contains "$out" "suspicious-pid" "should log suspicious-pid skip reason" || return
  pass
}

test_invalid_slug_skipped() {
  setup_repo
  # A directory matching agent-* glob but with a name the slug-validator
  # rejects (slug starts with -, looks like an option to git). Manually
  # create the dir; git worktree add wouldn't accept this slug normally.
  # Use a leading dash inside the slug to trigger validation reject.
  mkdir -p ".claude/worktrees/agent--injected"
  # Even with no .git file, the sweeper must reject before doing any
  # git operations on the bogus slug.
  out=$("$SWEEPER" --apply --master master 2>&1)
  if [ ! -e ".claude/worktrees/agent--injected" ]; then
    fail "invalid-slug worktree was removed — must SKIP (sec H1)"; return
  fi
  assert_contains "$out" "invalid-slug" "should log invalid-slug skip reason" || return
  pass
}

test_dangling_merged_branch_removed() {
  setup_repo
  add_worktree dg1 dead "would-be-merged"
  merge_commit worktree-agent-dg1
  # Remove just the worktree dir + admin files, leaving the branch dangling.
  git worktree unlock .claude/worktrees/agent-dg1
  git worktree remove --force .claude/worktrees/agent-dg1
  if ! git rev-parse --verify worktree-agent-dg1 >/dev/null 2>&1; then
    fail "test setup error: branch should still exist"; return
  fi
  out=$("$SWEEPER" --apply --master master 2>&1)
  if git rev-parse --verify worktree-agent-dg1 2>/dev/null; then
    fail "dangling merged branch should be deleted"; return
  fi
  assert_contains "$out" "dangling" "should report dangling-branch sweep" || return
  pass
}

# TODO: inode-changed test — add after sweeper implements re-stat. Plan M1
# requires aborting an entry if the worktree dir's inode changes between
# scan and rm. Test would: scan → mv worktree dir aside → invoke rm path →
# assert sweeper reports `inode-changed` and skips. Defer until sweeper is
# written so we know the precise hook point.

# ---------- driver ----------

main() {
  if [ ! -x "$SWEEPER" ]; then
    echo "FATAL: $SWEEPER not executable (chmod +x scripts/sweep-stale-worktrees.sh)" >&2
    exit 2
  fi

  run_test "ancestor_merged_removed_in_apply"  test_ancestor_merged_removed_in_apply
  run_test "squash_merged_removed"             test_squash_merged_removed
  run_test "unmerged_skipped"                  test_unmerged_skipped
  run_test "alive_pid_skipped"                 test_alive_pid_skipped
  run_test "empty_lock_skipped"                test_empty_lock_skipped
  run_test "no_lock_skipped"                   test_no_lock_skipped
  run_test "suspicious_pid_skipped"            test_suspicious_pid_skipped
  run_test "invalid_slug_skipped"              test_invalid_slug_skipped
  run_test "dry_run_mutates_nothing"           test_dry_run_mutates_nothing
  run_test "idempotency"                       test_idempotency
  run_test "dangling_merged_branch_removed"    test_dangling_merged_branch_removed

  echo
  echo "RESULT: $PASSED passed, $FAILED failed"
  if [ "$FAILED" -gt 0 ]; then
    printf '  - %s\n' "${FAILURES[@]}" >&2
    exit 1
  fi
}

main
