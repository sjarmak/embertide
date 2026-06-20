/**
 * phantom-vurmox-volley resolver (embertide-nlr8 — Colosseum
 * tier-2 sequence-archetype boss).
 *
 * Reads the boss's sequence stateTag `currentIndex` (set BEFORE the
 * j0ik archetype tick advances it at end-of-boss-turn) and dispatches
 * the 2-step ball-volley:
 *
 *   - 'ball-volley-charge': telegraph turn — 0 damage, forecast log
 *     naming the upcoming fire value so the player can plan a block.
 *   - 'ball-volley-fire': payoff turn — `pattern.damagePerTurn +
 *     PHANTOM_VURMOX_VOLLEY_FIRE_BONUS` routed via the spec's
 *     `'battlefield-then-player'` targeting + cackling-volley log.
 *
 * Defensive default: when no sequence stateTag is present (or the
 * step name is unknown / empty steps), falls back to
 * `pattern.damagePerTurn` so behavior matches the legacy static-dpt
 * path. Numbers are illustrative — first-pass placeholders matching
 * the tier-2 dpt baseline (PG dpt=3); final tuning is a playtest
 * follow-up.
 */

import type { CombatState } from '../../../types/combat';
import type { BossResolveOutcome } from './types';
import { currentSequenceStep } from './sequenceStep';

export const PHANTOM_VURMOX_VOLLEY_FIRE_BONUS = 1;

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.phantomVurmoxResolver.test.ts` import these
 * constants and assert `entry.includes(PHANTOM_VURMOX_LOG_*)` instead of
 * hard-coding bare substring literals. If a flavor rephrasing removes
 * one of these fragments from the rendered log without also updating
 * the constant, the test fails loudly — the substring/constant pair is
 * the contract, not the surrounding prose.
 */
export const PHANTOM_VURMOX_LOG_CHARGE = 'charges';
export const PHANTOM_VURMOX_LOG_VOLLEY = 'volley';

export function phantomVurmoxVolleyResolver(combat: CombatState): BossResolveOutcome {
  const baseDpt = combat.boss.attackPattern.damagePerTurn;
  const step = currentSequenceStep(combat.boss);
  const fireDmg = baseDpt + PHANTOM_VURMOX_VOLLEY_FIRE_BONUS;

  if (step === 'ball-volley-charge') {
    return {
      damage: 0,
      combatLog: [
        `Phantom Vurmox ${PHANTOM_VURMOX_LOG_CHARGE} a sorcerous volley — ${fireDmg} damage incoming next turn!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  if (step === 'ball-volley-fire') {
    return {
      damage: fireDmg,
      combatLog: [
        `Phantom Vurmox's ${PHANTOM_VURMOX_LOG_VOLLEY} cackles across the arena for ${fireDmg}!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  // Defensive default — no sequence tag, empty steps, or unknown step.
  return {
    damage: baseDpt,
    combatLog: [],
    playerSideEffect: null,
    combatPatch: {},
  };
}
