/**
 * hollow-effigy-mirror resolver (embertide-44w8 / gdd.2.4 — Shadow wild-boss).
 *
 * Reads `combat.echoQueue` (populated by `reducePlayerPlayCard` via
 * `playPower`) and computes the mirror echo damage. Spec at
 * `docs/design/hollow-effigy-attack-pattern.md`:
 *
 *   - echoQueue null OR echo.power < BASE_DPT: damage = staticDpt
 *     (the base 2 plus any zone-adder baked in at combat-entry).
 *   - echoQueue power >= BASE_DPT: damage = max(staticDpt, min(power,
 *     MAX_DPT)). The static floor preserves the shadow-creep zone bump
 *     so high-creep zones never soften under the mirror; the
 *     MAX_DPT clamp caps the worst-case echo at 4 (REQ-16 soft-clock
 *     envelope — 4-cap keeps a 5hp kid alive through one mirror blast).
 *
 * After firing, the resolver clears `combat.echoQueue` via
 * `combatPatch` so the next players-turn starts fresh. boss-stun
 * grace turns (bossStunTurns > 0) take the early-return path in
 * `reduceBossResolve` and DON'T invoke the resolver, so the queue
 * naturally persists across stun windows.
 */

import type { CombatState } from '../../../types/combat';
import type { BossResolveOutcome } from './types';

export const HOLLOW_EFFIGY_BASE_DPT = 2;
export const HOLLOW_EFFIGY_MAX_DPT = 4;

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.gloomLinkResolver.test.ts` import these
 * constants and assert `entry.includes(HOLLOW_EFFIGY_LOG_*)` instead of
 * hard-coding bare substring literals. The constant is the contract —
 * a flavor rephrasing that drops the fragment from the rendered log
 * without updating the constant will fail the test loudly.
 */
export const HOLLOW_EFFIGY_LOG_FINDS_NOTHING = 'finds nothing';
export const HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST = 'mirrors your strongest';

export function gloomLinkMirrorResolver(combat: CombatState): BossResolveOutcome {
  const echo = combat.echoQueue ?? null;
  const staticDpt = combat.boss.attackPattern.damagePerTurn;
  let damage: number;
  let logEntry: string;
  if (echo === null || echo.power < HOLLOW_EFFIGY_BASE_DPT) {
    damage = staticDpt;
    logEntry = `Hollow-effigy's mirror ${HOLLOW_EFFIGY_LOG_FINDS_NOTHING} — swipes for ${damage}!`;
  } else {
    const cappedEcho = Math.min(echo.power, HOLLOW_EFFIGY_MAX_DPT);
    damage = Math.max(staticDpt, cappedEcho);
    logEntry = `Hollow-effigy ${HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST} play — echoes for ${damage}!`;
  }
  return {
    damage,
    combatLog: [logEntry],
    playerSideEffect: null,
    // Always clear the queue after firing so the next players-turn
    // starts from a clean slate. Cheap: a `null` write either replaces
    // a populated queue (the just-fired echo) or no-ops on null.
    combatPatch: { echoQueue: null },
  };
}
