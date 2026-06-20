/**
 * Shared tier-based combat HP helper (embertide-bw6 — unifies the
 * duplicated logic previously split between
 * `defaultCombatHpFor` in `src/store/gameStore.ts` and
 * `bossSlotHpFor` in `src/ui/BossAltarPane.tsx`).
 *
 * Returns the fallback HP for a card without an explicit per-boss tune in
 * `BOSS_HP` (see `src/data/bossAttackPatterns.ts`):
 *
 *   1. `card.power` (legacy defensive read — balance sim uses it for
 *      synthetic mocks; no shipping card sets it today)
 *   2. Tier fallback:
 *        - 'region-boss' → 12
 *        - 'wild-boss'   →  8
 *        - else          →  5
 *
 * Kept in `src/core/` (framework-neutral) so both the UI slot readout and
 * the store's COMBAT_ENTER builder can import without either depending
 * on the other.
 */

import type { Card } from '../types/card';

export const TIER_HP_REGION_BOSS = 12;
export const TIER_HP_WILD_BOSS = 8;
export const TIER_HP_REGULAR = 5;

/**
 * Fallback HP used when no per-boss `BOSS_HP` tuning exists for the card.
 * Reads `card.power` defensively (not declared on the `Card` type; legacy
 * balance-sim mocks attach it) then falls back to the bossTier defaults.
 */
export function tierCombatHpFor(card: Card): number {
  const withPower = card as Card & { readonly power?: number };
  if (typeof withPower.power === 'number' && withPower.power > 0) {
    return withPower.power;
  }
  if (card.bossTier === 'region-boss') return TIER_HP_REGION_BOSS;
  if (card.bossTier === 'wild-boss') return TIER_HP_WILD_BOSS;
  return TIER_HP_REGULAR;
}
