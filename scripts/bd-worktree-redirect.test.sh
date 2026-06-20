#!/usr/bin/env bash
# Smoke test for scripts/bd-worktree-redirect.sh.
#
# Creates a temporary worktree, runs the redirect helper, and verifies that
# bd commands work inside the worktree AND that writes propagate back to
# the main repo's bd state. Uses a throwaway bead for isolation.
#
# Run from the main repo root:
#   bash scripts/bd-worktree-redirect.test.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/test-bd-redirect-$$"
TEST_BEAD_ID=""

cleanup() {
  local exit_code=$?
  set +e
  if [[ -n "$TEST_BEAD_ID" ]]; then
    bd close "$TEST_BEAD_ID" -r "test cleanup" >/dev/null 2>&1 || true
  fi
  if [[ -d "$WORKTREE_PATH" ]]; then
    git worktree remove --force "$WORKTREE_PATH" >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "==> Phase 0: ensure helper script exists"
[[ -x "$REPO_ROOT/scripts/bd-worktree-redirect.sh" ]] \
  || fail "scripts/bd-worktree-redirect.sh missing or not executable"

echo "==> Phase 1: create throwaway test bead"
TEST_BEAD_ID=$(
  bd create "TEST-bd-worktree-redirect-$$ — DELETE ME" \
    -p 4 -t task -d "Throwaway bead for bd-worktree-redirect smoke test. Closed by cleanup trap." \
    --json 2>&1 | sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' | head -1
)
[[ -n "$TEST_BEAD_ID" ]] || fail "could not create test bead — bd create returned no id"
[[ "$TEST_BEAD_ID" =~ ^[a-z][a-z0-9-]*-[a-z0-9.]+$ ]] \
  || fail "extracted bead id '$TEST_BEAD_ID' does not match expected format"
echo "    test bead: $TEST_BEAD_ID"

echo "==> Phase 2: create temp worktree at $WORKTREE_PATH"
git worktree add -d "$WORKTREE_PATH" >/dev/null

echo "==> Phase 3: confirm bd is broken inside worktree BEFORE redirect"
# Capture stderr to confirm the failure mode is the expected one (Dolt
# unreachable / per-project mode), not an unrelated cause (bd not in PATH,
# Dolt server crashed, etc.).
PRE_OUT=$( (cd "$WORKTREE_PATH" && bd ready 2>&1 1>/dev/null) || true )
if (cd "$WORKTREE_PATH" && bd ready >/dev/null 2>&1); then
  fail "bd ready unexpectedly works in fresh worktree — repro condition not met"
fi
if [[ "$PRE_OUT" != *"Dolt"* && "$PRE_OUT" != *"unreachable"* && "$PRE_OUT" != *"redirect"* ]]; then
  echo "----- pre-redirect bd ready stderr -----"
  printf '%s\n' "$PRE_OUT"
  echo "----- end -----"
  fail "bd ready failed for an unexpected reason — repro mode not the missing-redirect case"
fi
echo "    confirmed: bd ready fails with expected Dolt/redirect error"

echo "==> Phase 4: run the redirect helper"
(cd "$WORKTREE_PATH" && bash "$REPO_ROOT/scripts/bd-worktree-redirect.sh") \
  || fail "redirect helper exited non-zero"

echo "==> Phase 5: verify .beads/redirect was written"
[[ -f "$WORKTREE_PATH/.beads/redirect" ]] \
  || fail ".beads/redirect not created by helper"
REDIRECT_CONTENT=$(cat "$WORKTREE_PATH/.beads/redirect")
echo "    redirect content: $REDIRECT_CONTENT"

echo "==> Phase 6: verify redirect resolves to main .beads/"
RESOLVED="$WORKTREE_PATH/$REDIRECT_CONTENT"
[[ -f "$RESOLVED/config.yaml" ]] \
  || fail "redirect resolves to $RESOLVED but config.yaml missing — wrong path"

echo "==> Phase 7: verify bd ready works from inside worktree"
(cd "$WORKTREE_PATH" && bd ready >/dev/null) \
  || fail "bd ready still fails after redirect"

echo "==> Phase 8: verify bd note from worktree propagates to main"
NOTE_MARKER="REDIRECT-SMOKE-MARKER-$$"
(cd "$WORKTREE_PATH" && bd note "$TEST_BEAD_ID" "$NOTE_MARKER") >/dev/null \
  || fail "bd note from worktree failed"
# Read bd show into a variable explicitly — avoids subtle pipefail
# interactions between `bd show 2>&1 | grep -q`.
SHOW_OUT=$(bd show "$TEST_BEAD_ID" 2>&1)
if [[ "$SHOW_OUT" != *"$NOTE_MARKER"* ]]; then
  echo "----- bd show output begin -----"
  printf '%s\n' "$SHOW_OUT"
  echo "----- bd show output end -----"
  fail "bd note from worktree did not propagate to main repo (marker=$NOTE_MARKER)"
fi

echo "==> Phase 9: verify helper is idempotent (second run is no-op)"
(cd "$WORKTREE_PATH" && bash "$REPO_ROOT/scripts/bd-worktree-redirect.sh") \
  || fail "second invocation of helper failed"
SECOND_CONTENT=$(cat "$WORKTREE_PATH/.beads/redirect")
[[ "$REDIRECT_CONTENT" = "$SECOND_CONTENT" ]] \
  || fail "redirect content changed on second invocation"

echo "==> Phase 10: verify helper is no-op when run from main repo"
(cd "$REPO_ROOT" && bash "$REPO_ROOT/scripts/bd-worktree-redirect.sh") \
  || fail "helper failed when run from main repo"
[[ ! -f "$REPO_ROOT/.beads/redirect" ]] \
  || fail "helper wrote redirect file to main repo (should no-op)"

echo
echo "OK — bd-worktree-redirect.sh smoke test passed"
