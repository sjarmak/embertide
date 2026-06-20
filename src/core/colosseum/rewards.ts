/**
 * Colosseum — per-tier reward table (embertide-4hr1.6, sub of 4hr1).
 *
 * Pure module. The reducer (`COMBAT_RESOLVE_WIN` colosseum branch in
 * `gameStore.ts`) calls `rewardsForTier(clearedTier)` after the tier
 * advance and pipes the result into the per-run reward ledger
 * (`colosseumMetaStore.ts`). Persistence is a FULL PER-RUN RESET: the
 * ledger is in-memory and `initGame` clears it at run start, so rewards
 * never survive across runs (designer ruling 2026-06-04 — 4hr1.19).
 *
 * Per the 2026-05-02 designer ruling
 * (`bd memories embertide-colosseum-mode-2026-05-02-designer-ruling`):
 *   - tier-5 = top-tier rewards (rare heirloom drops, golden-rainbow
 *     card variants per the 044 Prism Chimera precedent, unique
 *     cosmetic unlocks).
 *   - lower tiers cannot drop top-tier loot — A3 acceptance criterion.
 *
 * A3 is enforced STRUCTURALLY: this table is the single source of
 * truth for tier→reward, and the `golden-rainbow-heirloom` /
 * `unique-cosmetic` kinds appear only in the tier-5 row. There is no
 * runtime "is this lower than tier-5?" check; the type system + table
 * shape make the regression unrepresentable.
 *
 * Per-tier final content for T1/T2/T3/T4 is a designer-pass placeholder
 * shape — the structural invariants (T5 = best loot; persistence;
 * A3 enforcement) are locked. T3 / T4 reward content authoring lands
 * with the roster beads for those tiers (out of scope here).
 */

import type { TierId } from './progression';

/**
 * Discriminated union over reward shapes the colosseum can emit.
 *
 * Tier-restricted kinds:
 *   - `golden-rainbow-heirloom` — tier-5 only (044 GR Chimera precedent;
 *     `rainbow-ancient-chimera-sword`).
 *   - `unique-cosmetic` — tier-5 only.
 *
 * Cross-tier kinds:
 *   - `reroll-token` — tier-1 reward today; could expand to other tiers
 *     in a future ruling.
 *   - `ember-shard` — tier-2 reward today.
 *   - `cosmetic-unlock-placeholder` — sentinel for T3/T4 until those
 *     rosters ship; carries no consumer surface yet.
 */
export type ColosseumReward =
  | { readonly kind: 'reroll-token'; readonly id: string }
  | { readonly kind: 'ember-shard'; readonly id: string }
  | { readonly kind: 'cosmetic-unlock-placeholder'; readonly id: string }
  | { readonly kind: 'golden-rainbow-heirloom'; readonly heirloomId: string }
  | { readonly kind: 'unique-cosmetic'; readonly id: string };

const TIER_1_REWARDS: readonly ColosseumReward[] = [
  { kind: 'reroll-token', id: 'colosseum-t1-reroll-token' },
];

const TIER_2_REWARDS: readonly ColosseumReward[] = [
  { kind: 'ember-shard', id: 'colosseum-t2-ember-shard' },
];

// T3 + T4 ride the `cosmetic-unlock-placeholder` sentinel until the
// designer pass that locks the per-tier reward content lands. The
// sentinel kind is documented above as "carries no consumer surface
// yet"; the type-level lockdown in `rewards.test.ts`
// (embertide-4hr1.16) forces any future HUD reward-display
// consumer to explicitly handle this kind rather than silently
// render it as nothing — see the `describeReward` exhaustive switch
// + `const _exhaustive: never` narrowing for the canonical pattern.
const TIER_3_REWARDS: readonly ColosseumReward[] = [
  { kind: 'cosmetic-unlock-placeholder', id: 'colosseum-t3-cosmetic-placeholder' },
];

const TIER_4_REWARDS: readonly ColosseumReward[] = [
  { kind: 'cosmetic-unlock-placeholder', id: 'colosseum-t4-cosmetic-placeholder' },
];

const TIER_5_REWARDS: readonly ColosseumReward[] = [
  // 044 Prism Chimera precedent — the rainbow heirloom card
  // shipped as `rainbow-ancient-chimera-sword` (see HEIRLOOM_DROPS in
  // src/data/cards/heirlooms.ts).
  { kind: 'golden-rainbow-heirloom', heirloomId: 'rainbow-ancient-chimera-sword' },
  // Unique cosmetic capstone — final slot id locked per
  // embertide-4hr1.17 designer ruling (2026-05-15). The cosmetic-pass
  // bead picks CONTENT (visual/thematic), not plumbing; multi-cosmetic
  // bundles (if elected) fan out at the HUD consumer surface, one
  // ledger row per T5 clear.
  { kind: 'unique-cosmetic', id: 'colosseum-t5-cosmetic-capstone' },
];

const REWARDS_BY_TIER: Readonly<Record<TierId, readonly ColosseumReward[]>> = {
  1: TIER_1_REWARDS,
  2: TIER_2_REWARDS,
  3: TIER_3_REWARDS,
  4: TIER_4_REWARDS,
  5: TIER_5_REWARDS,
};

/**
 * Returns the rewards emitted on a tier-N WIN. Pure: no allocation per
 * call beyond the constant table reference. Returns a frozen-shape
 * tuple keyed off `TierId` — when T3 / T4 widen the union, every
 * exhaustive consumer picks them up automatically and the table
 * additions force the test suite (rewardsForTier shape lockdown) to
 * widen accordingly.
 */
export function rewardsForTier(tier: TierId): readonly ColosseumReward[] {
  return REWARDS_BY_TIER[tier];
}
