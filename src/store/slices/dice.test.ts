import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../../data/cards';
import type { KidGameState, KidPlayer } from '../types';
import {
  commitDungeonBossRewardSlice,
  commitForestSageOmenSlice,
  rollDungeonBossRewardSlice,
  rollForestSageOmenSlice,
} from './dice';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

/**
 * Pure-transformer tests for the dice slice. Integration coverage of
 * the wired-up createGameStore actions lives in
 * src/store/rollDungeonBossReward.test.ts and gameStore.test.ts; this
 * file pins the slice contracts.
 */

const REGION_BOSS = KID_CARDS.find((c) => c.bossTier === 'region-boss')!;
const WILD_BOSS = KID_CARDS.find((c) => c.bossTier === 'wild-boss')!;

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    ...overrides,
  });
}

describe('rollDungeonBossRewardSlice', () => {
  it('hydrates pendingDungeonBossRoll for a region-boss', () => {
    const state = makeState();
    const next = rollDungeonBossRewardSlice(state, REGION_BOSS.id, () => 0.5);
    expect(next.pendingDungeonBossRoll).not.toBeNull();
    expect(next.pendingDungeonBossRoll?.bossId).toBe(REGION_BOSS.id);
    expect(next.pendingDungeonBossRoll?.playerId).toBe('p0');
    expect(next.pendingDungeonBossRoll?.face).toBeGreaterThanOrEqual(1);
    expect(next.pendingDungeonBossRoll?.face).toBeLessThanOrEqual(20);
  });

  it('returns state unchanged when outcome is already set', () => {
    const state = { ...makeState(), outcome: 'win' as const };
    expect(rollDungeonBossRewardSlice(state, REGION_BOSS.id, () => 0)).toBe(state);
  });

  it('returns state unchanged when a roll is already pending', () => {
    const state = makeState({
      pendingDungeonBossRoll: { bossId: REGION_BOSS.id, playerId: 'p0', face: 5 },
    });
    expect(rollDungeonBossRewardSlice(state, REGION_BOSS.id, () => 0)).toBe(state);
  });

  it('throws when bossId is unknown', () => {
    const state = makeState();
    expect(() => rollDungeonBossRewardSlice(state, 'no-such-boss', () => 0)).toThrow(
      /unknown bossId/,
    );
  });

  it('throws when bossId resolves to a non-region-boss', () => {
    const state = makeState();
    expect(() => rollDungeonBossRewardSlice(state, WILD_BOSS.id, () => 0)).toThrow(
      /not a Dungeon \(region\) Boss/,
    );
  });
});

describe('commitDungeonBossRewardSlice', () => {
  it('throws when no roll is pending', () => {
    const state = makeState();
    expect(() => commitDungeonBossRewardSlice(state)).toThrow(/no Dungeon Boss reward roll/);
  });

  it('clears pendingDungeonBossRoll on success', () => {
    const state = makeState({
      pendingDungeonBossRoll: { bossId: REGION_BOSS.id, playerId: 'p0', face: 1 },
    });
    const next = commitDungeonBossRewardSlice(state);
    expect(next.pendingDungeonBossRoll).toBeNull();
  });
});

describe('rollForestSageOmenSlice', () => {
  it('hydrates pendingForestSageRoll', () => {
    const state = makeState();
    const next = rollForestSageOmenSlice(state, 'p0', () => 0.5);
    expect(next.pendingForestSageRoll).not.toBeNull();
    expect(next.pendingForestSageRoll?.playerId).toBe('p0');
    expect(next.pendingForestSageRoll?.face).toBeGreaterThanOrEqual(1);
    expect(next.pendingForestSageRoll?.face).toBeLessThanOrEqual(6);
  });

  it('returns state unchanged when outcome is already set', () => {
    const state = { ...makeState(), outcome: 'loss' as const };
    expect(rollForestSageOmenSlice(state, 'p0', () => 0)).toBe(state);
  });

  it('returns state unchanged when a roll is already pending', () => {
    const state = makeState({
      pendingForestSageRoll: { cardId: 'forest-sage:p0', playerId: 'p0', face: 3 },
    });
    expect(rollForestSageOmenSlice(state, 'p0', () => 0)).toBe(state);
  });

  it('throws when player id is unknown', () => {
    const state = makeState();
    expect(() => rollForestSageOmenSlice(state, 'p99', () => 0)).toThrow(/no player with id/);
  });
});

describe('commitForestSageOmenSlice', () => {
  it('throws when no roll is pending', () => {
    const state = makeState();
    expect(() => commitForestSageOmenSlice(state)).toThrow(/no Forest-Sage omen roll/);
  });

  it('clears pendingForestSageRoll on success', () => {
    const state = makeState({
      pendingForestSageRoll: { cardId: 'forest-sage:p0', playerId: 'p0', face: 1 },
    });
    const next = commitForestSageOmenSlice(state);
    expect(next.pendingForestSageRoll).toBeNull();
  });
});
