import { describe, it, expect } from 'vitest';
import {
  initialColosseumProgression,
  isTierUnlocked,
  unlockTier,
  type TierId,
} from './progression';

describe('initialColosseumProgression (embertide-4hr1.3)', () => {
  it('starts with no tiers unlocked — caller seeds tier 1 explicitly on first colosseum entry', () => {
    const p = initialColosseumProgression();
    expect(p.unlockedTiers).toEqual([]);
  });
});

describe('unlockTier (embertide-4hr1.3)', () => {
  it('appends the tier and returns a new state on first unlock', () => {
    const p = initialColosseumProgression();
    const next = unlockTier(p, 1);
    expect(next).not.toBe(p);
    expect(next.unlockedTiers).toEqual([1]);
    // Original untouched.
    expect(p.unlockedTiers).toEqual([]);
  });

  it('preserves prior unlocks when adding a new tier', () => {
    let p = initialColosseumProgression();
    p = unlockTier(p, 1);
    p = unlockTier(p, 2);
    p = unlockTier(p, 5);
    expect(p.unlockedTiers).toEqual([1, 2, 5]);
  });

  it('is idempotent — re-unlocking returns the same state reference', () => {
    let p = initialColosseumProgression();
    p = unlockTier(p, 1);
    const same = unlockTier(p, 1);
    expect(same).toBe(p);
  });
});

describe('isTierUnlocked (embertide-4hr1.3)', () => {
  it('returns false on a fresh progression for every known tier', () => {
    const p = initialColosseumProgression();
    const tiers: readonly TierId[] = [1, 2, 3, 4, 5];
    for (const t of tiers) {
      expect(isTierUnlocked(p, t)).toBe(false);
    }
  });

  it('returns true only for unlocked tiers', () => {
    let p = initialColosseumProgression();
    p = unlockTier(p, 1);
    p = unlockTier(p, 5);
    expect(isTierUnlocked(p, 1)).toBe(true);
    expect(isTierUnlocked(p, 2)).toBe(false);
    expect(isTierUnlocked(p, 5)).toBe(true);
  });
});
