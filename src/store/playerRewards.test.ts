import { describe, expect, it } from 'vitest';

import type { KidPlayer } from '../types/kidPlayer';
import { makeKidPlayer } from '../testing/stateFixtures';
import { HEART_PIECES_PER_CONTAINER, addEmberShard } from './playerRewards';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player',
    championId: 'champion-courage',
    championSlot: null,
    ...overrides,
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
