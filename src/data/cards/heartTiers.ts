/**
 * v2.1 gm0.17 (embertide-0jf) — ember-shard drop tiers.
 *
 * Three-tier monster-drop system (grep-friendly allowlists, not derived
 * from card role so new cards are opt-in):
 *
 *   Tier 1 — grunt: every 3rd kill from this set bumps `heartPieces` by
 *            1 (via `emberShardMeter` 0..2 accumulator on KidPlayer).
 *            The 4th piece auto-promotes to a vital ember, matching
 *            gm0.16's `addEmberShard` contract.
 *
 *   Tier 2 — tough: 1 kill = 1 ember shard (direct `addEmberShard`; no
 *            meter). 4 kills ≈ 1 container.
 *
 *   Tier 3 — slot boss (wild-boss + region-boss): 1 kill = full heart
 *            container on the defeating player (direct +1 hpMax + full
 *            heal via `applyHeartReward`). Wired in the
 *            COMBAT_RESOLVE_WIN reducer, not via this allowlist — boss
 *            tier is read from `card.bossTier`.
 *
 * A card must belong to EITHER grunt OR tough (never both); grunt takes
 * precedence if an id is accidentally added to both. Ids outside both
 * sets (e.g. `grunt-orc`, `brute`, `wild-wolf`) grant no piece.
 */

/**
 * Tier 1 drop allowlist: each defeat bumps `emberShardMeter` by 1. On
 * the 3rd kill the meter resets to 0 and `heartPieces` gains +1. Sized
 * at 7 to match the seven zone-regular-monster ids most likely to see
 * repeated kills during a run.
 */
export const GRUNT_HEART_METER_IDS: ReadonlySet<string> = new Set([
  'thorn-scrub',
  'snapvine',
  'jellet',
  'scrabling',
  'skittermite',
  'red-squidlet',
  'emberskull',
  // z9xq (2026-04-25): wild-wolf (always-available 'Scrabling' tile)
  // is repeatable across the run; routing it through the meter keeps
  // the +hp economy in line with zone-regular grunts.
  'wild-wolf',
]);

/**
 * Tier 2 drop allowlist: each defeat grants a ember shard directly (1
 * kill = 1 piece, 4 kills ≈ 1 container via auto-promotion). Sized at 6
 * to cover Emberpeak + Temple tougher regulars.
 */
export const TOUGH_EMBER_SHARD_IDS: ReadonlySet<string> = new Set([
  'saurian',
  'ashjaw',
  'wardeye',
  'bone-knight',
  'gulpmaw',
  'hexrobe',
]);
