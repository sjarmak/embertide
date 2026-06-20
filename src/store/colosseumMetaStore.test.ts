import { describe, it, expect } from 'vitest';
import { createColosseumMetaStore } from './colosseumMetaStore';
import type { ColosseumReward } from '../core/colosseum';

/**
 * embertide-4hr1.6 / 4hr1.19 — per-run colosseum reward ledger.
 *
 * The reducer pipes `recordReward` for every reward emitted on a
 * colosseum-slot WIN. Per the 2026-06-04 designer ruling the ledger is a
 * FULL PER-RUN RESET: it is in-memory only and `gameStore.initGame`
 * clears it at run start, so no reward survives across runs.
 */

const SAMPLE_T1_REWARD: ColosseumReward = {
  kind: 'reroll-token',
  id: 'colosseum-t1-reroll-token',
};
const SAMPLE_T5_REWARD: ColosseumReward = {
  kind: 'golden-rainbow-heirloom',
  heirloomId: 'rainbow-ancient-chimera-sword',
};

describe('colosseumMetaStore — initial state', () => {
  it('starts with an empty ledger', () => {
    const store = createColosseumMetaStore();
    expect(store.getState().claimedRewards).toEqual([]);
  });
});

describe('colosseumMetaStore — recordReward', () => {
  it('appends a reward to the in-memory ledger', () => {
    const store = createColosseumMetaStore();
    store.getState().recordReward(1, SAMPLE_T1_REWARD);
    expect(store.getState().claimedRewards).toEqual([{ tier: 1, reward: SAMPLE_T1_REWARD }]);
  });

  it('appends multiple rewards in order across multiple calls', () => {
    const store = createColosseumMetaStore();
    store.getState().recordReward(1, SAMPLE_T1_REWARD);
    store.getState().recordReward(5, SAMPLE_T5_REWARD);
    expect(store.getState().claimedRewards).toEqual([
      { tier: 1, reward: SAMPLE_T1_REWARD },
      { tier: 5, reward: SAMPLE_T5_REWARD },
    ]);
  });
});

describe('colosseumMetaStore — per-run reset (no cross-run persistence)', () => {
  it('reset() clears the in-memory ledger', () => {
    const store = createColosseumMetaStore();
    store.getState().recordReward(1, SAMPLE_T1_REWARD);
    store.getState().reset();
    expect(store.getState().claimedRewards).toEqual([]);
  });

  it('a fresh store does not see a prior store’s rewards', () => {
    const runA = createColosseumMetaStore();
    runA.getState().recordReward(1, SAMPLE_T1_REWARD);

    // A fresh store is an isolated run — there is no localStorage to
    // hydrate from, so run B begins with an empty ledger.
    const runB = createColosseumMetaStore();
    expect(runB.getState().claimedRewards).toEqual([]);
  });

  it('a reset store starts the next run empty even after prior rewards', () => {
    const store = createColosseumMetaStore();
    store.getState().recordReward(1, SAMPLE_T1_REWARD);
    store.getState().recordReward(5, SAMPLE_T5_REWARD);

    // Mirrors `gameStore.initGame` clearing the singleton at run start.
    store.getState().reset();
    expect(store.getState().claimedRewards).toEqual([]);

    store.getState().recordReward(5, SAMPLE_T5_REWARD);
    expect(store.getState().claimedRewards).toEqual([{ tier: 5, reward: SAMPLE_T5_REWARD }]);
  });
});
