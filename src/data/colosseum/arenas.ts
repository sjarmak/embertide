/**
 * Colosseum — per-slot arena specs (embertide-lhlo.26, sub of lhlo
 * + 4hr1).
 *
 * An arena is the colosseum's identity primitive: a global combat
 * modifier in force for the whole fight PLUS a rotating end-of-turn
 * hazard. Arenas are keyed by the engaged slot's boss `sourceCardId`
 * (the "slot") and looked up at colosseum-combat entry only — see
 * `enterCombatAction` in `src/store/combatBootstrap.ts`. A slot with no
 * entry here enters with no arena (`CombatState.arena === undefined`).
 *
 * NUMBERS ARE ILLUSTRATIVE, matching the tier-roster convention in
 * `tier1.ts` — `amount` / `remainingTurns` are first-pass placeholders
 * chosen to make the proof readable, not designer-balance-locked. Final
 * tuning is a playtest follow-up. The point of this file is the SHAPE:
 * proving the Arena/Hazard vocabulary wires onto a real colosseum slot.
 */

import type { ArenaState } from '../../types/arena';

/**
 * Example arena wired onto the Tier-1 Craghorn slot. Demonstrates both
 * halves of the primitive:
 *
 *  - **Effect** — a `+1` global damage modifier (the arena is a tight,
 *    aggressive pit: every attack, from either side, hits harder).
 *  - **Hazard** — `Falling Rubble` deals 1 damage to all heroes at the
 *    end of each of the first 3 boss-turns, then subsides.
 */
export const COLOSSEUM_CRAGHORN_ARENA: ArenaState = {
  name: 'Quaking Coliseum',
  effects: [
    {
      kind: 'global-damage-modifier',
      amount: 1,
      label: 'Quaking Coliseum: +1 to all attacks',
    },
  ],
  hazards: [
    {
      kind: 'eot-damage',
      amount: 1,
      remainingTurns: 3,
      label: 'Falling Rubble',
    },
  ],
};

/**
 * Arena lookup keyed by colosseum boss `sourceCardId`. A boss id absent
 * from this table enters its colosseum combat with no arena. Read only
 * inside the `entrySource === 'colosseum-slot'` branch of
 * `enterCombatAction`, so arena state can never attach to a field /
 * wild-boss / region-boss combat.
 */
export const COLOSSEUM_ARENAS: Readonly<Record<string, ArenaState>> = {
  craghorn: COLOSSEUM_CRAGHORN_ARENA,
};

/**
 * Look up the arena for a colosseum slot by its boss `sourceCardId`.
 * Returns `undefined` when the slot declares no arena.
 */
export function arenaForColosseumBoss(sourceCardId: string): ArenaState | undefined {
  return COLOSSEUM_ARENAS[sourceCardId];
}
