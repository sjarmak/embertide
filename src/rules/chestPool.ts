// Chest reward-pool rules for chest variants (v2 / REQ-5a, u-2b → tq5).
// Self-contained module: does not import from src/data/.

/**
 * Chest taxonomy (embertide-tq5, 2026-04-24).
 *
 * History: v1 shipped {small, medium, big}; v2/REQ-5a (u-2b) collapsed to
 * {std, boss}; embertide-vy9 re-expanded to four tiers (std, enchanted,
 * boss, ancient); tq5 settles on the final 3-tier progression — the middle
 * tier is "Ornate Chest" (kid-recognizable + cathedral-coherent +
 * BotW-canon).
 *
 * Tier semantics:
 *   - 'std'   Sturdy Chest. 1 key. Common-tier rewards (heart / item /
 *             ember-shard / wisp). The supply-plan workhorse.
 *   - 'mid'   Ornate Chest. 2 keys. Sits between Sturdy and Vault on
 *             the value curve — same reward vocabulary as std plus a
 *             slice of boss-tier (double-heart + premium-item).
 *   - 'boss'  Grand Vault. 3 keys (premium but achievable). Premium-item
 *             heavy, anchored wisp + vital-ember.
 *
 * Wisp drops are spread across mid + boss only at higher rates. The
 * design rule "fairies are mid-game-or-later" is honored by the strictly
 * increasing rate (std 7% < mid 11% < boss 15% post-8xp9 renormalization).
 */
export type ChestVariant = 'std' | 'mid' | 'boss';

/**
 * Chest rewards (u-2b + u-1d amendment A6 + gm0.16 ember-shard /
 * vital-ember).
 *  - 'heart'          → +1 HP heal (v1 schema name 'heart' retained;
 *                       v2 combat interprets as HP-heal; see u-1a)
 *  - 'double-heart'   → +2 HP heal
 *  - 'hero'           → spawn a random hero card into the player's discard
 *  - 'item'           → spawn a random standard item into the player's
 *                       items zone (unbounded per nmmc 2026-04-26)
 *  - 'premium-item'   → spawn the legendary-sword item into the items zone
 *  - 'wisp'          → spawn a wisp / wisp-in-bottle card into the
 *                       player's items zone (50/50 split, gm0.16)
 *  - 'ember-shard'    → +1 ember-shard (gm0.16). Accumulator: 4 pieces
 *                       auto-promote to a vital ember (+1 hpMax +
 *                       full heal) and reset the counter to 0.
 *  - 'vital-ember'→ direct vital-ember drop (gm0.16). Applies
 *                       `applyHeartReward(player, 1)` immediately — +1
 *                       hpMax + full heal. Does NOT touch heartPieces.
 */
export type ChestReward =
  | 'heart'
  | 'double-heart'
  | 'hero'
  | 'item'
  | 'premium-item'
  | 'wisp'
  | 'ember-shard'
  | 'vital-ember';

export interface ChestOpenResult {
  reward: ChestReward;
}

interface WeightedEntry {
  reward: ChestReward;
  weight: number;
}

/**
 * Weight tables (embertide-tq5, hero slot removed in 8xp9 2026-05-26):
 *   chest-std:  7% wisp, 13% ember-shard, 0% vital-ember. (Pre-8xp9
 *               this was 5/10 + a 25% hero slot; removing hero and
 *               renormalizing the remaining four rewards lifted these.)
 *   chest-mid: 11% wisp, 12% ember-shard, 0% vital-ember — middle
 *               tier (Ornate Chest); blends std's reward vocabulary with a
 *               slice of boss-tier (double-heart + premium-item).
 *   chest-boss: 15% wisp, 20% ember-shard (was 15 + retired 5%
 *               seers-omen slot, ynn4 2026-04-25), 2% vital-ember.
 *
 * Monotonic on the rare rewards: wisp (7 < 11 < 15) and premium-item
 * (0 < 14 < 27). Vital-ember is boss-tier exclusive (mid keeps it
 * at 0 to preserve the boss-tier "best ceiling" feel).
 *
 * Weights sum to 100 for each variant so tests can assert absolute
 * percentages against seeded draws.
 */
const CHEST_WEIGHTS: Record<ChestVariant, readonly WeightedEntry[]> = {
  // embertide-8xp9 (playtest 2026-05-26): hero cards must NOT drop from
  // chests. The former 'hero' slots (std 25 / mid 13) were removed and the
  // freed weight redistributed proportionally across each tier's remaining
  // rewards (largest-remainder rounding), preserving the reward *shape* so
  // the only behavioral change is "no heroes from chests". Sums stay 100.
  // (Dungeon-boss defeat rewards still grant heroes — that is not a chest.)
  std: [
    { reward: 'heart', weight: 60 },
    { reward: 'item', weight: 20 },
    { reward: 'ember-shard', weight: 13 },
    { reward: 'wisp', weight: 7 },
  ],
  mid: [
    { reward: 'heart', weight: 29 },
    { reward: 'double-heart', weight: 17 },
    { reward: 'item', weight: 17 },
    { reward: 'premium-item', weight: 14 },
    { reward: 'ember-shard', weight: 12 },
    { reward: 'wisp', weight: 11 },
  ],
  boss: [
    { reward: 'double-heart', weight: 36 },
    { reward: 'premium-item', weight: 27 },
    { reward: 'wisp', weight: 15 },
    // ynn4 (2026-04-25): retired 5% seers-omen slot folded into
    // ember-shard (15 → 20). Sum still 100.
    { reward: 'ember-shard', weight: 20 },
    { reward: 'vital-ember', weight: 2 },
  ],
};

export const CHEST_WEIGHT_TABLE: Record<ChestVariant, readonly WeightedEntry[]> = CHEST_WEIGHTS;

/**
 * Key cost per chest variant (embertide-tq5).
 *   std=1, mid=2, boss=3 — boss-chest cost was lifted from 2 → 3 to make
 *   the Grand Vault premium but achievable; the new mid (Ornate Chest)
 *   takes over the 2-key slot.
 */
export const CHEST_KEY_COSTS: Record<ChestVariant, number> = {
  std: 1,
  mid: 2,
  boss: 3,
};

/**
 * Deterministic seedable PRNG (mulberry32).
 * Returns a function that yields values in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample a reward from the chest pool for the given variant using the
 * provided PRNG. Walks the weight table, accumulating weights, and returns
 * the first bucket whose running total exceeds r * totalWeight.
 */
export function openChest(variant: ChestVariant, rng: () => number): ChestOpenResult {
  const entries = CHEST_WEIGHTS[variant];
  let totalWeight = 0;
  for (const entry of entries) {
    totalWeight += entry.weight;
  }

  const r = rng() * totalWeight;
  let running = 0;
  for (const entry of entries) {
    running += entry.weight;
    if (r < running) {
      return { reward: entry.reward };
    }
  }

  // Fallback (should be unreachable for finite weights and rng in [0,1)):
  // return the last entry to preserve a deterministic output.
  const last = entries[entries.length - 1];
  return { reward: last.reward };
}
