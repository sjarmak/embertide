/**
 * Colosseum engine — public API barrel (embertide-4hr1.3).
 *
 * Pure module. Consumed by the colosseum HUD entry (4hr1.4) and
 * combat-loop integration (4hr1.5). See `progression.ts` for state
 * shape + `slotRouter.ts` for selection policy.
 */

export type { ColosseumProgression, TierId } from './progression';
export { initialColosseumProgression, isTierUnlocked, unlockTier } from './progression';
export {
  nextTierAfter,
  pickColosseumBoss,
  selectBossFromTier,
  selectTier,
  tierForColosseumBoss,
} from './slotRouter';
export type { ColosseumReward } from './rewards';
export { rewardsForTier } from './rewards';
