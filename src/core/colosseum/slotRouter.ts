/**
 * Colosseum — boss slot router (embertide-4hr1.3, sub of 4hr1).
 *
 * Pure module. Picks a `CombatBoss` from the appropriate tier roster
 * based on `ColosseumProgression.unlockedTiers`.
 *
 * Selection policy: HIGHEST UNLOCKED TIER, uniform within roster.
 * Mirrors the StS Ascension Act-progression analogue (see
 * `bd memories embertide-colosseum-mode-2026-05-02-designer-ruling`).
 * Once T2 unlocks, T1 leaves the pool — the player doesn't backslide.
 * Tier-weighting tuning (e.g. 30% T1 + 70% T2) belongs in `selectTier`:
 * one function, one grep target.
 *
 * Re-fights within a tier are allowed — `selectBossFromTier` picks
 * uniformly across the full roster every call. Defeat-tracking and
 * clearance semantics live in the rewards bead (4hr1.6).
 */

import type { CombatBoss } from '../../types/combat';
import { TIER_1_ROSTER } from '../../data/colosseum/tier1';
import { TIER_2_ROSTER } from '../../data/colosseum/tier2';
import { TIER_3_ROSTER } from '../../data/colosseum/tier3';
import { TIER_4_ROSTER } from '../../data/colosseum/tier4';
import { TIER_5_ROSTER } from '../../data/colosseum/tier5';
import type { ColosseumProgression, TierId } from './progression';

const ROSTER_BY_TIER: Readonly<Record<TierId, readonly CombatBoss[]>> = {
  1: TIER_1_ROSTER,
  2: TIER_2_ROSTER,
  3: TIER_3_ROSTER,
  4: TIER_4_ROSTER,
  5: TIER_5_ROSTER,
};

// Typed ordered tier list — single source of truth for iteration.
// Mirrors ROSTER_BY_TIER's keys; widening `TierId` requires updating both.
const TIER_IDS: readonly TierId[] = [1, 2, 3, 4, 5];

/** Highest unlocked tier, or `null` if none. Order-independent. */
export function selectTier(progression: ColosseumProgression): TierId | null {
  const tiers = progression.unlockedTiers;
  if (tiers.length === 0) return null;
  return Math.max(...tiers) as TierId;
}

/**
 * Uniform pick across `tier`'s full roster. Inject `rng` for test
 * determinism (mulberry32 in production; `Math.random` for unseeded play).
 */
export function selectBossFromTier(tier: TierId, rng: () => number): CombatBoss {
  const roster = ROSTER_BY_TIER[tier];
  // Defensive: matches `pickColosseumBoss`'s "throws are reserved for
  // genuine programming errors (empty roster constant)" docstring. Today
  // every roster has ≥1 entry; without this guard, an accidentally-empty
  // future roster would return `undefined` typed as `CombatBoss` and
  // crash downstream. Asserts the type signature.
  if (roster.length === 0) {
    throw new Error(`[colosseum] ROSTER_BY_TIER[${tier}] is empty — programming error`);
  }
  return roster[Math.floor(rng() * roster.length)];
}

/**
 * Returns `null` when no tiers are unlocked so HUD/preview callers
 * (4hr1.4) can render a "colosseum locked" UX without a try/catch.
 * Throws are reserved for genuine programming errors (e.g. a future
 * bug that allows an empty roster constant to ship).
 */
export function pickColosseumBoss(
  progression: ColosseumProgression,
  rng: () => number,
): CombatBoss | null {
  const tier = selectTier(progression);
  if (tier === null) return null;
  return selectBossFromTier(tier, rng);
}

/**
 * Reverse lookup: given a `CombatBoss.sourceCardId`, return the tier
 * whose roster contains it. Returns `null` when the id is not in any
 * colosseum roster (embertide-4hr1.5 — the combat-loop integration
 * uses this on COMBAT_RESOLVE_WIN to identify which tier just cleared
 * and unlock the next one).
 *
 * Iterates ROSTER_BY_TIER directly so future tier additions (T3 / T4)
 * are picked up automatically. Linear scan is fine — the total roster
 * size across all tiers is < 20.
 */
export function tierForColosseumBoss(sourceCardId: string): TierId | null {
  for (const tier of TIER_IDS) {
    if (ROSTER_BY_TIER[tier].some((boss) => boss.sourceCardId === sourceCardId)) {
      return tier;
    }
  }
  return null;
}

/**
 * Successor lookup: given a defeated tier, return the tier to unlock
 * next (embertide-4hr1.5). Walks the sorted tier ids and returns
 * the next one larger than `tier`. Returns `null` when `tier` is the
 * highest shipping tier (no further unlock — currently T5 caps the
 * progression).
 *
 * Sort + scan keeps the helper resilient to future tier additions:
 * adding T3 / T4 to ROSTER_BY_TIER widens the union and this function
 * automatically threads them in order without a manual cap update.
 */
export function nextTierAfter(tier: TierId): TierId | null {
  const sorted = [...TIER_IDS].sort((a, b) => a - b);
  const idx = sorted.indexOf(tier);
  if (idx === -1 || idx === sorted.length - 1) return null;
  return sorted[idx + 1];
}
