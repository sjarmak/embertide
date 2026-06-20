/**
 * Colosseum slot router — tests (embertide-4hr1.3).
 *
 * A2 acceptance: (a) tier-1 only → tier-1 boss; (b) tier-1+2 → tier-2
 * boss (highest-unlocked-tier semantic, NOT uniform); (c) tier-5 →
 * tier-5 boss. Plus null-on-no-tiers contract for the composed picker.
 */
import { describe, it, expect } from 'vitest';
import type { CombatBoss } from '../../types/combat';
import { pickColosseumBoss, selectBossFromTier, selectTier } from './slotRouter';
import { initialColosseumProgression, unlockTier } from './progression';
import { TIER_1_ROSTER } from '../../data/colosseum/tier1';
import { TIER_2_ROSTER } from '../../data/colosseum/tier2';
import { TIER_5_ROSTER } from '../../data/colosseum/tier5';

/**
 * Deterministic step RNG — yields 0.0, 0.1, 0.2, …, 0.9, then loops.
 * Drives `Math.floor(rng() * n)` across enough indices to hit every
 * roster entry within reasonable iteration counts.
 */
function makeStepRng(): () => number {
  let i = 0;
  return () => {
    const v = (i % 10) / 10;
    i += 1;
    return v;
  };
}

const idsOf = (roster: readonly CombatBoss[]): Set<string> =>
  new Set(roster.map((b) => b.sourceCardId));

/**
 * Narrow `pickColosseumBoss`'s `CombatBoss | null` return for the
 * A2 happy paths. Vitest's `.not.toBeNull()` does NOT narrow the TS
 * type, so a non-null assertion would mask a regression to the null
 * path. Explicit throw narrows + fails loudly with a useful frame.
 */
function expectBoss(picked: CombatBoss | null): CombatBoss {
  if (picked === null) throw new Error('pickColosseumBoss returned null but a boss was expected');
  return picked;
}

describe('selectTier (embertide-4hr1.3)', () => {
  it('returns null when no tiers are unlocked', () => {
    expect(selectTier(initialColosseumProgression())).toBeNull();
  });

  it('returns the highest unlocked tier (tier-1 only → 1)', () => {
    const p = unlockTier(initialColosseumProgression(), 1);
    expect(selectTier(p)).toBe(1);
  });

  it('returns the highest unlocked tier (tier-1 + tier-2 → 2)', () => {
    let p = unlockTier(initialColosseumProgression(), 1);
    p = unlockTier(p, 2);
    expect(selectTier(p)).toBe(2);
  });

  it('returns the highest unlocked tier (tier-1 + tier-5 → 5)', () => {
    let p = unlockTier(initialColosseumProgression(), 1);
    p = unlockTier(p, 5);
    expect(selectTier(p)).toBe(5);
  });

  it('is order-independent (tier-5 unlocked before tier-1 still picks 5)', () => {
    let p = unlockTier(initialColosseumProgression(), 5);
    p = unlockTier(p, 1);
    expect(selectTier(p)).toBe(5);
  });
});

describe('selectBossFromTier (embertide-4hr1.3)', () => {
  it('returns a member of the tier roster (tier 1)', () => {
    const ids = idsOf(TIER_1_ROSTER);
    const rng = makeStepRng();
    for (let i = 0; i < 50; i += 1) {
      expect(ids.has(selectBossFromTier(1, rng).sourceCardId)).toBe(true);
    }
  });

  it('covers the full tier-1 roster across enough picks (uniform within tier)', () => {
    const seen = new Set<string>();
    const rng = makeStepRng();
    for (let i = 0; i < 100; i += 1) {
      seen.add(selectBossFromTier(1, rng).sourceCardId);
    }
    for (const boss of TIER_1_ROSTER) {
      expect(seen.has(boss.sourceCardId)).toBe(true);
    }
  });

  it('returns the only entry for a single-boss roster (tier 5)', () => {
    const onlyId = TIER_5_ROSTER[0].sourceCardId;
    const rng = makeStepRng();
    expect(selectBossFromTier(5, rng).sourceCardId).toBe(onlyId);
  });
});

describe('pickColosseumBoss — A2 acceptance (embertide-4hr1.3)', () => {
  // Tier rosters MUST have disjoint sourceCardId sets — A2(b)'s
  // anti-leak assertion only catches a uniform-tier-pick regression
  // while this holds. If a future roster reuses an id across tiers,
  // this test fires before the loop so the brittleness is visible.
  it('precondition: TIER_1, TIER_2, TIER_5 sourceCardId sets are pairwise disjoint', () => {
    const t1 = idsOf(TIER_1_ROSTER);
    const t2 = idsOf(TIER_2_ROSTER);
    const t5 = idsOf(TIER_5_ROSTER);
    for (const id of t1) {
      expect(t2.has(id)).toBe(false);
      expect(t5.has(id)).toBe(false);
    }
    for (const id of t2) {
      expect(t5.has(id)).toBe(false);
    }
  });

  it('A2(a) tier-1 only unlocked → every pick is from TIER_1_ROSTER', () => {
    const p = unlockTier(initialColosseumProgression(), 1);
    const tier1Ids = idsOf(TIER_1_ROSTER);
    const rng = makeStepRng();
    for (let i = 0; i < 50; i += 1) {
      const picked = expectBoss(pickColosseumBoss(p, rng));
      expect(tier1Ids.has(picked.sourceCardId)).toBe(true);
    }
  });

  it('A2(b) tier-1 + tier-2 unlocked → every pick is from TIER_2 (highest-unlocked-tier semantic, no T1 leak)', () => {
    let p = unlockTier(initialColosseumProgression(), 1);
    p = unlockTier(p, 2);
    const tier2Ids = idsOf(TIER_2_ROSTER);
    const tier1Ids = idsOf(TIER_1_ROSTER);
    const rng = makeStepRng();
    for (let i = 0; i < 100; i += 1) {
      const picked = expectBoss(pickColosseumBoss(p, rng));
      expect(tier2Ids.has(picked.sourceCardId)).toBe(true);
      expect(tier1Ids.has(picked.sourceCardId)).toBe(false);
    }
  });

  it('A2(c) tier-5 only unlocked → returns the tier-5 boss', () => {
    const p = unlockTier(initialColosseumProgression(), 5);
    const tier5Ids = idsOf(TIER_5_ROSTER);
    const rng = makeStepRng();
    for (let i = 0; i < 20; i += 1) {
      const picked = expectBoss(pickColosseumBoss(p, rng));
      expect(tier5Ids.has(picked.sourceCardId)).toBe(true);
    }
  });

  it('returns null when no tiers are unlocked (no throw — caller chooses UX)', () => {
    const p = initialColosseumProgression();
    expect(pickColosseumBoss(p, Math.random)).toBeNull();
  });
});
