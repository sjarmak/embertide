/**
 * Omen keyword — the single player-facing dice keyword (d6).
 *
 * `Omen` is the named keyword that the `roll-die` EffectSpec implements
 * (keyword-glossary §DICE/OMEN). This module is the pure home for the
 * Omen *rules contract* that the bare `RollDieEffect` shape cannot
 * express at the type level:
 *
 *   1. **No dead rolls** — every face 1..6 resolves to a non-empty
 *      outcome (already guaranteed by `Record<DieFace, …>` totality +
 *      `src/balance/rollDie.test.ts`).
 *   2. **Bounded variance** — outcomes are written as grouped ranges
 *      `1-2 / 3-4 / 5-6`, NEVER six separate outcomes. This is the
 *      invariant `assertOmenBoundedVariance` enforces.
 *   3. **No required-success** — never "roll 5+ or nothing". Implied by
 *      (1): if every face does something, no face is a whiff gate.
 *
 * The optional cosmetic flavor tag (`OmenFlavor`) is defined in
 * `src/types/effectSpec.ts`; `resolveOmenFace` proves it is cosmetic by
 * resolving outcomes from the `outcomes` map alone, never reading it.
 *
 * Pure module — no store imports. State flows in via parameters.
 */

import type { DieFace, OmenFlavor, RollDieEffect, RollDieOutcomeEffect } from '../types/effectSpec';

/**
 * The three Omen outcome ranges. Faces within a range MUST share an
 * outcome (bounded variance). Ordered low → high so card text can read
 * `1-2 / 3-4 / 5-6` left-to-right.
 */
export const OMEN_RANGES: readonly (readonly [DieFace, DieFace])[] = [
  [1, 2],
  [3, 4],
  [5, 6],
] as const;

/** All six d6 faces, in order. */
export const OMEN_FACES: readonly DieFace[] = [1, 2, 3, 4, 5, 6] as const;

/**
 * Resolve an Omen face to its outcome. Reads the `outcomes` map ONLY —
 * the flavor tag (`effect.omen`) is deliberately never consulted, which
 * is what makes the tag cosmetic. Co-locating the resolver here gives
 * the cosmetic-only invariant a single, testable choke point.
 */
export function resolveOmenFace(effect: RollDieEffect, face: DieFace): RollDieOutcomeEffect {
  return effect.outcomes[face];
}

/** Normalize an optional flavor tag to its `'none'` default. */
export function omenFlavorOf(effect: RollDieEffect): OmenFlavor {
  return effect.omen ?? 'none';
}

/**
 * Structural deep-equality for two outcome rows. Outcomes are flat,
 * JSON-shaped EffectSpec payloads (string/number/boolean fields, no
 * functions or cycles), so a stable-key JSON compare is sufficient and
 * avoids pulling in a deep-equal dependency.
 */
function outcomesEqual(a: RollDieOutcomeEffect, b: RollDieOutcomeEffect): boolean {
  const norm = (o: RollDieOutcomeEffect): string =>
    JSON.stringify(o, Object.keys(o as unknown as Record<string, unknown>).sort());
  return norm(a) === norm(b);
}

/**
 * True when the outcomes map is range-grouped: faces 1-2, 3-4 and 5-6
 * each resolve to a structurally-equal outcome. This is the
 * machine-checkable form of the "never six separate outcomes" rule.
 */
export function isOmenRangeGrouped(effect: RollDieEffect): boolean {
  return OMEN_RANGES.every(([lo, hi]) => outcomesEqual(effect.outcomes[lo], effect.outcomes[hi]));
}

/**
 * Assert that a `roll-die` effect is a well-formed Omen. Throws a
 * descriptive error otherwise so the failing card is named in the test
 * output. Checks bounded variance (range-grouped) and no-dead-roll
 * (every face non-empty); no-required-success follows from no-dead-roll
 * (every face rewards, so no face is a whiff gate).
 *
 * @param effect the roll-die effect to validate
 * @param label  caller-supplied identifier (e.g. card id) for errors
 */
export function assertOmenBoundedVariance(effect: RollDieEffect, label = 'roll-die effect'): void {
  for (const face of OMEN_FACES) {
    const outcome = effect.outcomes[face];
    if (outcome == null || Object.keys(outcome).length === 0) {
      throw new Error(
        `Omen "${label}" face ${face} is a dead roll (empty outcome) — every face must do something.`,
      );
    }
  }
  if (!isOmenRangeGrouped(effect)) {
    throw new Error(
      `Omen "${label}" has ungrouped outcomes — faces must be grouped into ranges 1-2 / 3-4 / 5-6 (bounded variance), never six separate outcomes.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Soft control (±1) — RELIC-ONLY modifier (keyword-glossary §DICE/OMEN).
//
// The "You may adjust the result by ±1" upgrade is NEVER printed on a
// card (there is no roll-adjust field on RollDieEffect — that absence is
// the compile-time guarantee). It ships exclusively as a relic-sourced
// modifier. This is the typed extension point a relic implementation
// hooks; no relic in the data set carries it yet (see omen.test.ts,
// which asserts no card declares a roll-adjust).
// ---------------------------------------------------------------------------

/** The legal soft-control adjustments. `0` is the no-op identity. */
export type OmenSoftControlAdjust = -1 | 0 | 1;

/**
 * A relic-sourced Omen soft-control modifier. The `source` discriminant
 * is pinned to `'relic'` so a card-side modifier is unrepresentable —
 * the type itself enforces the relic-only rule.
 */
export interface OmenSoftControl {
  readonly source: 'relic';
  readonly adjust: OmenSoftControlAdjust;
}

/**
 * Apply a relic soft-control adjustment to a rolled face, clamped to the
 * valid d6 range so a `1` cannot drop to `0` and a `6` cannot climb to
 * `7`. Pure; the caller (a relic activation) owns when this fires.
 */
export function applyOmenSoftControl(face: DieFace, mod: OmenSoftControl): DieFace {
  const adjusted = face + mod.adjust;
  const clamped = Math.min(6, Math.max(1, adjusted));
  return clamped as DieFace;
}
