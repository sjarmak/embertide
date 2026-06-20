import { describe, it, expect } from 'vitest';

import { HP_CAP, applyHeartReward } from './vitalEmber';
import { HEART_PIECES_PER_CONTAINER, addEmberShard } from '../store/gameStore';
import type { KidPlayer } from '../store/types';
import { makeKidPlayer } from '../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player',
    championId: 'champion-courage',
    championSlot: null,
    ...overrides,
  });

describe('applyHeartReward (embertide 2026-04-22 vital-ember pass)', () => {
  it('heals when hp is below hpMax (no hpMax growth)', () => {
    const start = makePlayer({ hp: 2, hpMax: 5 });
    const next = applyHeartReward(start, 2);
    expect(next.hp).toBe(4);
    expect(next.hpMax).toBe(5);
  });

  it('caps at hpMax when amount would overheal, no hpMax growth yet', () => {
    const start = makePlayer({ hp: 4, hpMax: 5 });
    const next = applyHeartReward(start, 1);
    // Exactly at hpMax, no overflow.
    expect(next.hp).toBe(5);
    expect(next.hpMax).toBe(5);
  });

  it('at full hp, each extra heart grows hp AND hpMax by 1 up to HP_CAP', () => {
    const start = makePlayer({ hp: 5, hpMax: 5 });
    const next = applyHeartReward(start, 3);
    expect(next.hp).toBe(8);
    expect(next.hpMax).toBe(8);
  });

  it('mixed heal + grow: damaged player with overflow heals first then grows', () => {
    const start = makePlayer({ hp: 4, hpMax: 5 });
    const next = applyHeartReward(start, 3);
    // +1 heals to hpMax=5. +1 grows hp+hpMax to 6/6. +1 grows to 7/7.
    expect(next.hp).toBe(7);
    expect(next.hpMax).toBe(7);
  });

  it('stops growing at HP_CAP', () => {
    const start = makePlayer({ hp: HP_CAP, hpMax: HP_CAP });
    const next = applyHeartReward(start, 5);
    expect(next.hp).toBe(HP_CAP);
    expect(next.hpMax).toBe(HP_CAP);
  });

  it('grows up to HP_CAP but wastes the rest', () => {
    const start = makePlayer({ hp: HP_CAP - 2, hpMax: HP_CAP - 2 });
    const next = applyHeartReward(start, 10);
    expect(next.hp).toBe(HP_CAP);
    expect(next.hpMax).toBe(HP_CAP);
  });

  it('zero or negative amount is a no-op (same reference)', () => {
    const start = makePlayer({ hp: 3, hpMax: 5 });
    expect(applyHeartReward(start, 0)).toBe(start);
    expect(applyHeartReward(start, -1)).toBe(start);
  });

  it('returns the same reference when heal would have no effect (at HP_CAP already)', () => {
    const start = makePlayer({ hp: HP_CAP, hpMax: HP_CAP });
    expect(applyHeartReward(start, 1)).toBe(start);
  });

  it('wakes a downed player when healing pulls hp above 0', () => {
    const start = makePlayer({ hp: 0, hpMax: 5, downed: true });
    const next = applyHeartReward(start, 2);
    expect(next.hp).toBe(2);
    expect(next.hpMax).toBe(5);
    expect(next.downed).toBe(false);
  });

  it('keeps downed flag when the reward is a no-op (0 amount)', () => {
    const start = makePlayer({ hp: 0, hpMax: 5, downed: true });
    expect(applyHeartReward(start, 0)).toBe(start);
    expect(applyHeartReward(start, 0).downed).toBe(true);
  });
});

describe('addEmberShard (v2.1 gm0.16)', () => {
  it('increments heartPieces by 1 without touching hp/hpMax while below the promotion threshold', () => {
    const start = makePlayer({ hp: 3, hpMax: 5, heartPieces: 0 });
    const next = addEmberShard(start);
    expect(next.heartPieces).toBe(1);
    expect(next.hp).toBe(3);
    expect(next.hpMax).toBe(5);
  });

  it('stacks up to HEART_PIECES_PER_CONTAINER - 1 without promoting', () => {
    let p = makePlayer({ hp: 5, hpMax: 5, heartPieces: 0 });
    for (let i = 0; i < HEART_PIECES_PER_CONTAINER - 1; i += 1) {
      p = addEmberShard(p);
    }
    expect(p.heartPieces).toBe(HEART_PIECES_PER_CONTAINER - 1);
    expect(p.hpMax).toBe(5);
  });

  it('promotes to a vital ember on the 4th piece: counter resets AND hp+hpMax grow', () => {
    const start = makePlayer({
      hp: 5,
      hpMax: 5,
      heartPieces: HEART_PIECES_PER_CONTAINER - 1,
    });
    const next = addEmberShard(start);
    expect(next.heartPieces).toBe(0);
    expect(next.hpMax).toBe(6);
    expect(next.hp).toBe(6);
  });

  it('promotion at partial HP heals to hpMax first (no grow) when a single heart would only heal', () => {
    // hp=3/5 + 3 pieces already held. 4th piece triggers a
    // vital-ember grant = applyHeartReward(p, 1). Since hp is below
    // hpMax, the single reward just heals hp → 4. Counter resets to 0.
    const start = makePlayer({
      hp: 3,
      hpMax: 5,
      heartPieces: HEART_PIECES_PER_CONTAINER - 1,
    });
    const next = addEmberShard(start);
    expect(next.heartPieces).toBe(0);
    expect(next.hp).toBe(4);
    expect(next.hpMax).toBe(5);
  });

  it('promotion wakes a downed player when the vital-ember grant lifts hp above 0', () => {
    const start = makePlayer({
      hp: 0,
      hpMax: 5,
      downed: true,
      heartPieces: HEART_PIECES_PER_CONTAINER - 1,
    });
    const next = addEmberShard(start);
    expect(next.heartPieces).toBe(0);
    expect(next.hp).toBe(1);
    expect(next.downed).toBe(false);
  });
});
