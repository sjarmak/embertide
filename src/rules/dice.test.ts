import { describe, it, expect } from 'vitest';
import { createSeededRng } from './chestPool';
import { d6, d20 } from './dice';

describe('d6', () => {
  it('produces identical sequences for the same seed (determinism)', () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 500; i++) {
      seqA.push(d6(rngA));
      seqB.push(d6(rngB));
    }
    expect(seqA).toEqual(seqB);
  });

  it('always returns an integer in 1..6', () => {
    const rng = createSeededRng(1234);
    for (let i = 0; i < 1000; i++) {
      const v = d6(rng);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('covers all six faces over 10,000 seeded samples with uniform-ish distribution', () => {
    const SAMPLES = 10_000;
    const rng = createSeededRng(7);
    const counts = [0, 0, 0, 0, 0, 0, 0]; // index 1..6 used
    for (let i = 0; i < SAMPLES; i++) {
      counts[d6(rng)]++;
    }

    // Every face must appear at least once.
    for (let face = 1; face <= 6; face++) {
      expect(counts[face], `face ${face} never rolled`).toBeGreaterThan(0);
    }

    // Chi-square goodness-of-fit against uniform p=1/6.
    // Expected = SAMPLES/6 ≈ 1666.67. For df=5, critical value at
    // p=0.001 is ≈20.515; we use 25 for headroom against seed drift
    // while still rejecting a genuinely skewed distribution.
    const expected = SAMPLES / 6;
    let chiSquare = 0;
    for (let face = 1; face <= 6; face++) {
      const diff = counts[face] - expected;
      chiSquare += (diff * diff) / expected;
    }
    expect(chiSquare, `chi-square too high (counts=${counts.slice(1).join(',')})`).toBeLessThan(25);
  });
});

describe('d20', () => {
  it('produces identical sequences for the same seed (determinism)', () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 500; i++) {
      seqA.push(d20(rngA));
      seqB.push(d20(rngB));
    }
    expect(seqA).toEqual(seqB);
  });

  it('always returns an integer in 1..20', () => {
    const rng = createSeededRng(1234);
    for (let i = 0; i < 1000; i++) {
      const v = d20(rng);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('covers all twenty faces over 20,000 seeded samples with uniform-ish distribution', () => {
    const SAMPLES = 20_000;
    const rng = createSeededRng(7);
    const counts = new Array(21).fill(0); // index 1..20 used
    for (let i = 0; i < SAMPLES; i++) {
      counts[d20(rng)]++;
    }

    // Every face must appear at least once.
    for (let face = 1; face <= 20; face++) {
      expect(counts[face], `face ${face} never rolled`).toBeGreaterThan(0);
    }

    // Chi-square goodness-of-fit against uniform p=1/20.
    // df=19, critical value at p=0.001 ≈ 43.82; pad to 60 for headroom
    // against seed drift.
    const expected = SAMPLES / 20;
    let chiSquare = 0;
    for (let face = 1; face <= 20; face++) {
      const diff = counts[face] - expected;
      chiSquare += (diff * diff) / expected;
    }
    expect(chiSquare).toBeLessThan(60);
  });
});
