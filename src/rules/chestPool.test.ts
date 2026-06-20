import { describe, it, expect } from 'vitest';
import {
  CHEST_KEY_COSTS,
  CHEST_WEIGHT_TABLE,
  createSeededRng,
  openChest,
  type ChestReward,
  type ChestVariant,
} from './chestPool';

describe('createSeededRng', () => {
  it('produces identical sequences for the same seed', () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 100; i++) {
      seqA.push(rngA());
      seqB.push(rngB());
    }
    expect(seqA).toEqual(seqB);
  });

  it('yields values in [0, 1)', () => {
    const rng = createSeededRng(1234);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const rngA = createSeededRng(1);
    const rngB = createSeededRng(2);
    const firstA = Array.from({ length: 5 }, () => rngA());
    const firstB = Array.from({ length: 5 }, () => rngB());
    expect(firstA).not.toEqual(firstB);
  });
});

describe('openChest — tq5 final 3-tier taxonomy (std / mid / boss)', () => {
  it('produces identical reward sequences for the same seed across all three tiers', () => {
    const rngA = createSeededRng(12345);
    const rngB = createSeededRng(12345);
    const rewardsA: ChestReward[] = [];
    const rewardsB: ChestReward[] = [];
    const variants: ChestVariant[] = ['std', 'mid', 'boss', 'std', 'mid', 'boss'];
    for (const v of variants) {
      rewardsA.push(openChest(v, rngA).reward);
      rewardsB.push(openChest(v, rngB).reward);
    }
    expect(rewardsA).toEqual(rewardsB);
  });
});

function emptyCounts(): Record<ChestReward, number> {
  return {
    heart: 0,
    'double-heart': 0,
    hero: 0,
    item: 0,
    'premium-item': 0,
    wisp: 0,
    'ember-shard': 0,
    'vital-ember': 0,
  };
}

function countRewards(
  variant: ChestVariant,
  seed: number,
  samples: number,
): Record<ChestReward, number> {
  const rng = createSeededRng(seed);
  const counts = emptyCounts();
  for (let i = 0; i < samples; i++) {
    const { reward } = openChest(variant, rng);
    counts[reward]++;
  }
  return counts;
}

describe('openChest — distribution (10,000 seeded draws, tq5 3-tier system)', () => {
  const SAMPLES = 10_000;
  // 2pp tolerance on common weights; rare-anchor windows (wisp in std,
  // vital-ember, seers-omen) use a tighter / wider band as called out
  // per assertion.
  const TOLERANCE = 0.02;

  // 8xp9 (2026-05-26): hero slot removed from std/mid; weights renormalized
  // (largest-remainder). Heroes must never drop from any chest tier.
  it('chest-std distributes matching the published weight table (heart 60 / item 20 / ember-shard 13 / wisp 7) within ±2pp, and never drops a hero', () => {
    const counts = countRewards('std', 1, SAMPLES);
    const heart = counts.heart / SAMPLES;
    const item = counts.item / SAMPLES;
    const emberShard = counts['ember-shard'] / SAMPLES;
    expect(heart).toBeGreaterThanOrEqual(0.6 - TOLERANCE);
    expect(heart).toBeLessThanOrEqual(0.6 + TOLERANCE);
    expect(item).toBeGreaterThanOrEqual(0.2 - TOLERANCE);
    expect(item).toBeLessThanOrEqual(0.2 + TOLERANCE);
    expect(emberShard).toBeGreaterThanOrEqual(0.13 - TOLERANCE);
    expect(emberShard).toBeLessThanOrEqual(0.13 + TOLERANCE);
    expect(counts.hero).toBe(0);
    expect(counts['double-heart']).toBe(0);
    expect(counts['premium-item']).toBe(0);
    // vital-ember is boss-tier exclusive.
    expect(counts['vital-ember']).toBe(0);
  });

  it('chest-mid (Ornate Chest) distributes matching the published weight table (heart 29 / double-heart 17 / item 17 / premium-item 14 / ember-shard 12 / wisp 11) within ±2pp, and never drops a hero', () => {
    const counts = countRewards('mid', 7, SAMPLES);
    const heart = counts.heart / SAMPLES;
    const doubleHeart = counts['double-heart'] / SAMPLES;
    const item = counts.item / SAMPLES;
    const premiumItem = counts['premium-item'] / SAMPLES;
    const emberShard = counts['ember-shard'] / SAMPLES;
    const wisp = counts.wisp / SAMPLES;
    expect(heart).toBeGreaterThanOrEqual(0.29 - TOLERANCE);
    expect(heart).toBeLessThanOrEqual(0.29 + TOLERANCE);
    expect(doubleHeart).toBeGreaterThanOrEqual(0.17 - TOLERANCE);
    expect(doubleHeart).toBeLessThanOrEqual(0.17 + TOLERANCE);
    expect(item).toBeGreaterThanOrEqual(0.17 - TOLERANCE);
    expect(item).toBeLessThanOrEqual(0.17 + TOLERANCE);
    expect(premiumItem).toBeGreaterThanOrEqual(0.14 - TOLERANCE);
    expect(premiumItem).toBeLessThanOrEqual(0.14 + TOLERANCE);
    expect(emberShard).toBeGreaterThanOrEqual(0.12 - TOLERANCE);
    expect(emberShard).toBeLessThanOrEqual(0.12 + TOLERANCE);
    expect(wisp).toBeGreaterThanOrEqual(0.11 - TOLERANCE);
    expect(wisp).toBeLessThanOrEqual(0.11 + TOLERANCE);
    expect(counts.hero).toBe(0);
    // vital-ember is boss-tier exclusive.
    expect(counts['vital-ember']).toBe(0);
  });

  // ynn4 (2026-04-25): seers-omen 5% slot retired and absorbed into
  // ember-shard (15 → 20). Sum still 100. Tolerance widened to 1.5pp on
  // the ember-shard anchor since the band moved.
  it('chest-boss distributes matching the published weight table (ynn4: double-heart 36 / premium-item 27 / wisp 15 / ember-shard 20 / vital-ember 2) within ±2pp', () => {
    const counts = countRewards('boss', 99, SAMPLES);
    const dh = counts['double-heart'] / SAMPLES;
    const pi = counts['premium-item'] / SAMPLES;
    const emberShard = counts['ember-shard'] / SAMPLES;
    expect(dh).toBeGreaterThanOrEqual(0.36 - TOLERANCE);
    expect(dh).toBeLessThanOrEqual(0.36 + TOLERANCE);
    expect(pi).toBeGreaterThanOrEqual(0.27 - TOLERANCE);
    expect(pi).toBeLessThanOrEqual(0.27 + TOLERANCE);
    expect(emberShard).toBeGreaterThanOrEqual(0.2 - TOLERANCE);
    expect(emberShard).toBeLessThanOrEqual(0.2 + TOLERANCE);
    expect(counts.heart).toBe(0);
    expect(counts.hero).toBe(0);
    expect(counts.item).toBe(0);
    // Rare vital-ember anchor: ~2% with a generous 1.5pp tolerance.
    const hc = counts['vital-ember'] / SAMPLES;
    expect(hc).toBeGreaterThanOrEqual(0.02 - 0.015);
    expect(hc).toBeLessThanOrEqual(0.02 + 0.015);
  });

  it('vital-ember is boss-chest-only (zero weight in std and mid)', () => {
    const stdCounts = countRewards('std', 23, SAMPLES);
    const midCounts = countRewards('mid', 23, SAMPLES);
    expect(stdCounts['vital-ember']).toBe(0);
    expect(midCounts['vital-ember']).toBe(0);
  });

  // tq5 designer rule: wisp drops are spread across mid + boss only at
  // the elevated rate, honouring "fairies are mid-game-or-later" via the
  // monotonic progression. Rates lifted slightly post-8xp9 (hero slot
  // removed, remaining weights renormalized): std≈7 < mid≈11 < boss≈15.
  it('chest-std wisp drop rate is ≈7% within ±2pp', () => {
    const counts = countRewards('std', 1, SAMPLES);
    const wispRate = counts.wisp / SAMPLES;
    expect(wispRate).toBeGreaterThanOrEqual(0.07 - TOLERANCE);
    expect(wispRate).toBeLessThanOrEqual(0.07 + TOLERANCE);
  });

  it('chest-mid wisp drop rate is ≈11% within ±2pp', () => {
    const counts = countRewards('mid', 51, SAMPLES);
    const wispRate = counts.wisp / SAMPLES;
    expect(wispRate).toBeGreaterThanOrEqual(0.11 - TOLERANCE);
    expect(wispRate).toBeLessThanOrEqual(0.11 + TOLERANCE);
  });

  it('chest-boss wisp drop rate is ≈15% within ±2pp', () => {
    const counts = countRewards('boss', 99, SAMPLES);
    const wispRate = counts.wisp / SAMPLES;
    expect(wispRate).toBeGreaterThanOrEqual(0.15 - TOLERANCE);
    expect(wispRate).toBeLessThanOrEqual(0.15 + TOLERANCE);
  });

  it('wisp rate is monotonic non-decreasing across tiers (std < mid < boss)', () => {
    const std = countRewards('std', 3, SAMPLES).wisp / SAMPLES;
    const mid = countRewards('mid', 3, SAMPLES).wisp / SAMPLES;
    const boss = countRewards('boss', 3, SAMPLES).wisp / SAMPLES;
    // Compare to the published weights' rank rather than enforcing strict
    // ordering on sampled rates: std≈5 < mid≈10 < boss≈15.
    expect(std).toBeLessThan(mid);
    expect(mid).toBeLessThan(boss);
  });
});

describe('CHEST_WEIGHT_TABLE (exported for data inspection)', () => {
  it('exposes weights summing to 100 for each variant', () => {
    for (const variant of ['std', 'mid', 'boss'] as const) {
      const sum = CHEST_WEIGHT_TABLE[variant].reduce((acc, e) => acc + e.weight, 0);
      expect(sum, `variant=${variant}`).toBe(100);
    }
  });

  it('includes wisp in all three variants', () => {
    for (const variant of ['std', 'mid', 'boss'] as const) {
      const hasWisp = CHEST_WEIGHT_TABLE[variant].some((e) => e.reward === 'wisp');
      expect(hasWisp, `variant=${variant}`).toBe(true);
    }
  });

  // 8xp9 (playtest 2026-05-26): hero cards must never be obtainable from a
  // chest of any tier. Guards against a future re-tune reintroducing them.
  it('never includes a hero reward in any chest variant', () => {
    for (const variant of ['std', 'mid', 'boss'] as const) {
      const hasHero = CHEST_WEIGHT_TABLE[variant].some((e) => e.reward === 'hero');
      expect(hasHero, `variant=${variant}`).toBe(false);
    }
  });
});

describe('CHEST_KEY_COSTS (embertide-tq5 3-tier progression)', () => {
  it('std=1, mid=2, boss=3 (boss lifted from 2 → 3 to make the Vault premium but achievable)', () => {
    expect(CHEST_KEY_COSTS.std).toBe(1);
    expect(CHEST_KEY_COSTS.mid).toBe(2);
    expect(CHEST_KEY_COSTS.boss).toBe(3);
  });
});
