/**
 * Colosseum — per-account progression state + immutable mutators
 * (embertide-4hr1.3, sub of 4hr1).
 *
 * Pure module. The slot router reads `unlockedTiers` to decide which
 * roster to draw from; persistence + threading through gameStore is
 * the caller's job (combat-loop 4hr1.5, HUD 4hr1.4).
 *
 * `unlockedTiers` is empty by default — the caller seeds tier 1
 * explicitly on first colosseum entry. Keeping the entry-tier policy
 * in the caller means there is exactly one grep target for "where do
 * tiers get added" and no hidden invariant that
 * `initialColosseumProgression()` produces a playable state.
 *
 * `TierId = 1 | 2 | 3 | 4 | 5` matches the rosters that ship today
 * (`src/data/colosseum/tier{1,2,3,4,5}.ts`). Every consumer keyed by
 * `Record<TierId, ...>` is forced exhaustive by the union, so future
 * roster widenings (or contractions) propagate automatically.
 *
 * Defeat-tracking + tier-clearance live in the rewards bead (4hr1.6).
 */

export type TierId = 1 | 2 | 3 | 4 | 5;

export interface ColosseumProgression {
  readonly unlockedTiers: readonly TierId[];
}

export function initialColosseumProgression(): ColosseumProgression {
  return { unlockedTiers: [] };
}

/**
 * Idempotent: re-unlocking returns the input reference unchanged so
 * consumers can compare by identity to detect no-op transitions.
 * Mirrors the `recordBossDefeat` precedent in
 * `src/store/slices/zones.ts`.
 */
export function unlockTier(progression: ColosseumProgression, tier: TierId): ColosseumProgression {
  if (progression.unlockedTiers.includes(tier)) return progression;
  return {
    ...progression,
    unlockedTiers: [...progression.unlockedTiers, tier],
  };
}

export function isTierUnlocked(progression: ColosseumProgression, tier: TierId): boolean {
  return progression.unlockedTiers.includes(tier);
}
