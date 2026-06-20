import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ColosseumReward, TierId } from '../core/colosseum';

/**
 * embertide-4hr1.6 / 4hr1.19 — per-run colosseum reward ledger.
 *
 * Holds the `claimedRewards` ledger for the CURRENT run only. Per the
 * 2026-06-04 designer ruling (Stephanie), colosseum persistence is a
 * FULL PER-RUN RESET: clearing a tier-N boss grants that tier's rewards
 * for the current run, and starting a new run begins with an empty
 * ledger. The ledger is therefore purely in-memory with no cross-run
 * survival — `gameStore.initGame` calls `reset()` at run start to clear
 * the singleton, mirroring the per-run lifetime of
 * `state.colosseumProgression.unlockedTiers` (which already resets per
 * run in the main game store).
 */

/**
 * One row of the claimed-rewards ledger. `tier` is the cleared-tier
 * provenance (so the HUD reward-display surface — sibling bead — can
 * group by tier without re-deriving from the reward shape).
 */
export interface ColosseumRewardEarned {
  readonly tier: TierId;
  readonly reward: ColosseumReward;
}

export interface ColosseumMetaState {
  readonly claimedRewards: readonly ColosseumRewardEarned[];
  recordReward(tier: TierId, reward: ColosseumReward): void;
  reset(): void;
}

/**
 * Factory — exported so each test gets an isolated store instance
 * rather than sharing the module singleton. Production uses the
 * `useColosseumMetaStore` singleton below.
 */
export function createColosseumMetaStore(): UseBoundStore<StoreApi<ColosseumMetaState>> {
  return create<ColosseumMetaState>((set, get) => ({
    claimedRewards: [],
    recordReward(tier, reward) {
      set({
        claimedRewards: [...get().claimedRewards, { tier, reward }],
      });
    },
    reset() {
      set({ claimedRewards: [] });
    },
  }));
}

/**
 * Default singleton reward ledger for the current run. The colosseum-WIN
 * branch in `gameStore.ts` calls
 * `useColosseumMetaStore.getState().recordReward(...)` for each reward
 * emitted by `rewardsForTier(clearedTier)`; `gameStore.initGame` calls
 * `reset()` at run start so the ledger never survives across runs.
 */
export const useColosseumMetaStore = createColosseumMetaStore();
