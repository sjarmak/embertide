/**
 * Phase-threshold resolver (embertide-lhlo.17 — kw.phase-thresholds).
 *
 * Applies pending phase transitions when the boss's HP fraction crosses
 * a registered threshold for the first time. Pure function — no store
 * imports. State flows in via parameter and out via return value.
 *
 * ## Remix-only contract
 *
 * `BossPhaseTransition` can only carry `stateTags` and/or `attackPattern`
 * replacements — both fields are already defined on `CombatBoss`, so every
 * transition is a remix of existing mechanics. No brand-new-mechanic field
 * is representable in the type. `applyPhaseThresholds` enforces this again
 * at runtime via `assertPhaseTransitionRemixOnly`.
 *
 * ## Idempotency / once-per-crossing
 *
 * `boss.crossedPhaseThresholds` records every `atHpFraction` value that has
 * already fired. On each call, only thresholds NOT in that set AND whose
 * fraction is ≥ the current HP fraction are applied. After application the
 * newly crossed fractions are appended and the set is kept sorted + deduped.
 *
 * ## Evaluation order
 *
 * When HP drops through multiple thresholds in a single boss-turn (e.g. a
 * burst from 80 % → 20 %), all newly-crossed transitions fire in DESCENDING
 * atHpFraction order (75 % → 50 % → 25 %) so the final state reflects the
 * deepest-crossed transition last, which wins the spread.
 */

import type { BossPhaseThreshold, BossPhaseTransition, CombatBoss } from '../../types/combat';
import type { BossStateTagKind } from '../../types/combatBossState';

// ---------------------------------------------------------------------------
// Runtime remix-only invariant.
// ---------------------------------------------------------------------------

/**
 * Assert that a `BossPhaseTransition` only remixes existing mechanics.
 *
 * The type-level enforcement (limiting `BossPhaseTransition` to `stateTags`
 * and `attackPattern`) is our primary guard. This runtime check is the
 * belt-and-suspenders backstop for:
 *   1. Tests that want an explicit invariant assertion (not just type errors).
 *   2. Future callers that build transitions dynamically from external data.
 *
 * Rules checked:
 *   - Every `kind` in `transition.stateTags` must appear in the boss's
 *     entry-time `stateTags` set — you can't introduce a tag kind that was
 *     never declared at combat entry.
 *   - `transition.attackPattern`, when present, must not introduce a
 *     `bossAttackResolver` that wasn't already wired on the boss's original
 *     `attackPattern`. (Re-using the same resolver id is fine; upgrading to
 *     a different pre-existing resolver is fine; conjuring a new one mid-fight
 *     is not.)
 *
 * Throws with a descriptive message identifying the offending kind/field.
 *
 * @param boss       the boss as it stands at the moment of evaluation
 * @param transition the transition to validate
 * @param label      caller-supplied identifier for error messages
 */
export function assertPhaseTransitionRemixOnly(
  boss: CombatBoss,
  transition: BossPhaseTransition,
  label = 'phase transition',
): void {
  // Collect the set of stateTag kinds already declared on this boss.
  const declaredKinds = new Set<BossStateTagKind>((boss.stateTags ?? []).map((t) => t.kind));

  // Check stateTags remix.
  if (transition.stateTags !== undefined) {
    for (const tag of transition.stateTags) {
      if (!declaredKinds.has(tag.kind)) {
        throw new Error(
          `${label}: stateTag kind '${tag.kind}' is not present in the boss's entry-time stateTags — ` +
            `phase transitions may only remix existing tag kinds, not inject new ones. ` +
            `Declared kinds: [${[...declaredKinds].join(', ')}].`,
        );
      }
    }
  }

  // Check attackPattern remix: bossAttackResolver must stay within
  // already-declared resolver ids (or remain absent).
  if (transition.attackPattern !== undefined) {
    const originalResolverId = boss.attackPattern.bossAttackResolver;
    const newResolverId = transition.attackPattern.bossAttackResolver;
    if (newResolverId !== undefined && newResolverId !== originalResolverId) {
      throw new Error(
        `${label}: attackPattern.bossAttackResolver '${newResolverId}' differs from the boss's ` +
          `original resolver '${String(originalResolverId)}' — phase transitions may only remap ` +
          `an already-wired resolver, not inject a new one.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Phase-threshold application.
// ---------------------------------------------------------------------------

/**
 * Apply any newly-crossed phase thresholds to `boss`. Returns the same
 * reference when no threshold fires (cheap caller-side short-circuit).
 *
 * Steps:
 *  1. If `phaseThresholds` is absent or empty, return `boss` unchanged.
 *  2. Compute `hpFraction = boss.hp / boss.hpMax` (clamped ≥ 0 defensively).
 *  3. Collect thresholds whose `atHpFraction >= hpFraction` and which have
 *     NOT yet been recorded in `crossedPhaseThresholds`. Sort them
 *     descending by `atHpFraction` so higher thresholds apply first and the
 *     deepest-crossed transition wins the final spread.
 *  4. For each pending threshold, run `assertPhaseTransitionRemixOnly` and
 *     spread the transition onto the working boss copy.
 *  5. Record all newly-crossed fractions in `crossedPhaseThresholds` (sorted,
 *     deduped) and return the updated boss.
 *
 * Pure. No store imports.
 */
export function applyPhaseThresholds(boss: CombatBoss): CombatBoss {
  const thresholds = boss.phaseThresholds;
  if (!thresholds || thresholds.length === 0) return boss;

  const hpFraction = boss.hpMax > 0 ? Math.max(0, boss.hp / boss.hpMax) : 0;
  const crossed = new Set<number>(boss.crossedPhaseThresholds ?? []);

  // Find all thresholds that should fire now: hpFraction has reached or
  // passed them (hp <= atHpFraction * hpMax) and they haven't fired yet.
  const pending: BossPhaseThreshold[] = [];
  for (const threshold of thresholds) {
    if (!crossed.has(threshold.atHpFraction) && hpFraction <= threshold.atHpFraction) {
      pending.push(threshold);
    }
  }

  if (pending.length === 0) return boss;

  // Sort descending so higher-fraction (earlier) thresholds apply first and
  // the deepest (latest) transition overwrites last.
  pending.sort((a, b) => b.atHpFraction - a.atHpFraction);

  // Apply transitions in order, accumulating onto a working boss copy.
  let working: CombatBoss = boss;
  for (const threshold of pending) {
    assertPhaseTransitionRemixOnly(
      boss, // validate against the ENTRY-TIME boss (pre-transition)
      threshold.transition,
      `phase threshold ${threshold.atHpFraction}`,
    );
    working = applyTransition(working, threshold.transition);
    crossed.add(threshold.atHpFraction);
  }

  // Record crossed thresholds (sorted ascending for deterministic equality).
  const sortedCrossed: readonly number[] = [...crossed].sort((a, b) => a - b);

  return { ...working, crossedPhaseThresholds: sortedCrossed };
}

/**
 * Spread a single `BossPhaseTransition` onto `boss`. Only touches the
 * fields declared in the transition; other fields are preserved verbatim.
 * Pure; called only by `applyPhaseThresholds` after invariant checks pass.
 */
function applyTransition(boss: CombatBoss, transition: BossPhaseTransition): CombatBoss {
  return {
    ...boss,
    ...(transition.stateTags !== undefined ? { stateTags: transition.stateTags } : {}),
    ...(transition.attackPattern !== undefined ? { attackPattern: transition.attackPattern } : {}),
  };
}
