// Dice substrate for v2.1 player-visible rolls (REQ-9 / ynn4 die-roll
// animation pass 2026-04-25 + embertide-3wd6 d20 region-boss loot
// pass 2026-04-25).
//
// Player-visible rolls now span two die sizes:
//   - d6  : forest-sage omen (REQ-6) — six authored faces.
//   - d20 : Dungeon Boss onDefeat reward (3wd6) — face is the loot-tier
//           roll; the table maps face ranges to std/mid/legendary tiers.
// Invisible rolls (chest-loot weights) still use d6.
//
// The pre-ynn4 `pickOneOfThreeD6` 3-tuple chooser was retired alongside
// the reroll-token system — with no reroll spend the "pick 1 of 3 random
// faces" affordance was a meaningless choice. The `DieRollReveal` UI
// animates a single die landing on the pre-rolled face deterministically;
// the d20 visual variant lives alongside the d6 in the same component.
//
// Pure — the RNG is the only side effect. The project-wide RNG
// signature is `() => number` returning a value in [0, 1), matching
// `createSeededRng` in ./chestPool and `mulberry32` in
// ../core/combatEngine.

/**
 * Roll a single six-sided die using the provided PRNG.
 *
 * Returns a uniform integer in the inclusive range 1..6.
 */
export function d6(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

/**
 * Roll a single twenty-sided die using the provided PRNG.
 *
 * Returns a uniform integer in the inclusive range 1..20. Used by the
 * Dungeon Boss onDefeat reward roll (embertide-3wd6) — the face
 * determines the loot tier (std / mid / legendary) via the table in
 * gameStore.ts (`DUNGEON_BOSS_REWARD_TABLE`).
 */
export function d20(rng: () => number): number {
  return Math.floor(rng() * 20) + 1;
}
