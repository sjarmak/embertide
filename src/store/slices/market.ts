import type { Card } from '../../types/card';
import type { KidGameState } from '../types';

/**
 * Ascension-style center-row market size. Kid Mode shows six face-up cards at
 * all times (except when the supply runs out).
 */
export const FIELD_SIZE = 6;

/**
 * Cards marked "pinned" are not counted against the normal FIELD_SIZE cap
 * (e.g. the final-boss, which is injected on top of the market). Reserved
 * for future expansion — today the only pinned role is 'final-boss'.
 */
function isPinned(card: Card): boolean {
  return card.role === 'final-boss';
}

/**
 * Top up `state.field` to FIELD_SIZE market cards by drawing from the top of
 * `state.supply`. Pinned cards (like the final-boss) don't count toward the
 * cap — they sit alongside the market. Pure / immutable: returns a new state
 * with fresh array references, never mutates.
 *
 * Zone gating (a39d, 2026-04-25): zone-tagged cards (sylvani / emberpeak /
 * maren / hollow-shrine / dune-sanctum regulars) only enter the field while
 * `state.currentZone` matches their `card.zone`. Off-zone cards are skipped
 * during draw and rotated to the back of supply so they remain available
 * once the player advances into their zone. Untagged cards (generic
 * monsters, items, heroes) draw normally in every zone.
 *
 * If the supply is shorter than needed, the field is left with fewer than
 * FIELD_SIZE cards (no error).
 */
export function refillField(state: KidGameState): KidGameState {
  const supply = state.supply.slice();
  const field = state.field.slice();

  const marketCount = field.filter((c) => !isPinned(c)).length;
  let needed = FIELD_SIZE - marketCount;
  if (needed <= 0) return state;

  const skipped: Card[] = [];
  while (needed > 0 && supply.length > 0) {
    const card = supply.shift();
    if (!card) break;
    if (card.zone && card.zone !== state.currentZone) {
      skipped.push(card);
      continue;
    }
    field.push(card);
    needed -= 1;
  }
  for (const card of skipped) supply.push(card);

  return { ...state, field, supply };
}
