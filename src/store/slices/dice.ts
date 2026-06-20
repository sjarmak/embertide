import type { KidGameState } from '../types';
import { KID_CARDS } from '../../data/cards';
import { d6, d20 } from '../../rules/dice';
import {
  DUNGEON_BOSS_REWARD_TABLE,
  FOREST_SAGE_OMEN_TABLE,
  applyDungeonBossRewardOutcome,
  applyForestSageOmenOutcome,
} from '../../data/dice-tables';

/**
 * Pure transformers for the v2.1 d20 / d6 reward-roll surfaces:
 *
 *   Dungeon Boss onDefeat reward (REQ-9d, embertide-4hz6 + 3wd6):
 *     rollDungeonBossRewardSlice → hydrate pendingDungeonBossRoll
 *     commitDungeonBossRewardSlice → dispatch outcome via applyDungeonBossRewardOutcome
 *
 *   Forest-Sage on-play omen (REQ-6, embertide-gm0.10):
 *     rollForestSageOmenSlice → hydrate pendingForestSageRoll
 *     commitForestSageOmenSlice → dispatch outcome via applyForestSageOmenOutcome
 *
 * Originally lived inline in gameStore.ts; extracted as part of
 * embertide-hik1's per-domain decomposition pass. The outcome
 * resolvers (applyDungeonBossRewardOutcome / applyForestSageOmenOutcome)
 * already live in src/data/dice-tables.ts; these slices wrap the
 * roll-stage and commit-stage state transitions around them.
 */

/**
 * Stage a Dungeon-Boss onDefeat reward roll (4hz6). Pre-rolls a single
 * d20 face via the supplied rng and hydrates `pendingDungeonBossRoll`.
 *
 * Returns the input state (===) when:
 *   - state.outcome is already set, OR
 *   - a roll is already pending (per-encounter cap, REQ-9f).
 *
 * Throws when:
 *   - bossId does not resolve to a card in KID_CARDS, OR
 *   - the resolved card's bossTier is not 'region-boss' (the bead
 *     explicitly cuts wild-boss reward rolls), OR
 *   - state has no players to receive the roll.
 */
export function rollDungeonBossRewardSlice(
  state: KidGameState,
  bossId: string,
  rng: () => number,
): KidGameState {
  if (state.outcome !== null) return state;
  if (state.pendingDungeonBossRoll !== null) return state;
  const bossCard = KID_CARDS.find((c) => c.id === bossId);
  if (!bossCard) {
    throw new Error(`rollDungeonBossReward: unknown bossId "${bossId}"`);
  }
  if (bossCard.bossTier !== 'region-boss') {
    throw new Error(
      `rollDungeonBossReward: bossId "${bossId}" is not a Dungeon (region) Boss — bossTier="${bossCard.bossTier ?? 'null'}". Wild Boss reward rolls are explicitly cut per the bead's locked design.`,
    );
  }
  const activeForRoll = state.players[state.currentPlayerIndex] ?? state.players[0];
  if (!activeForRoll) {
    throw new Error('rollDungeonBossReward: no active player to receive the roll');
  }
  const face = d20(rng);
  return {
    ...state,
    pendingDungeonBossRoll: {
      bossId,
      playerId: activeForRoll.id,
      face,
    },
  };
}

/**
 * Commit the pending Dungeon-Boss reward roll. Throws when no roll is
 * pending or no outcome is authored for the rolled face. Clears
 * `pendingDungeonBossRoll` on success.
 */
export function commitDungeonBossRewardSlice(state: KidGameState): KidGameState {
  const pending = state.pendingDungeonBossRoll;
  if (pending === null) {
    throw new Error('commitDungeonBossReward: no Dungeon Boss reward roll is pending');
  }
  const outcome = DUNGEON_BOSS_REWARD_TABLE[pending.face];
  if (!outcome) {
    throw new Error(`commitDungeonBossReward: no outcome authored for face ${pending.face}`);
  }
  const next = applyDungeonBossRewardOutcome(state, pending.playerId, outcome);
  return { ...next, pendingDungeonBossRoll: null };
}

/**
 * Stage a Forest-Sage on-play omen roll (gm0.10). Pre-rolls a single d6
 * face and hydrates `pendingForestSageRoll`. The standard fire path is
 * `playCard` itself; this slice is the explicit-dispatch entry point
 * for tests + future debug surfaces.
 *
 * Returns the input state (===) when:
 *   - state.outcome is already set, OR
 *   - a roll is already pending (per-encounter cap, REQ-9f).
 *
 * Throws when no player matches the supplied id.
 */
export function rollForestSageOmenSlice(
  state: KidGameState,
  playerId: string,
  rng: () => number,
): KidGameState {
  if (state.outcome !== null) return state;
  if (state.pendingForestSageRoll !== null) return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`rollForestSageOmen: no player with id "${playerId}" in state`);
  }
  const face = d6(rng);
  return {
    ...state,
    pendingForestSageRoll: {
      // The cardId field is informational on the explicit-dispatch
      // path (no live forest-sage card to correlate to outside of
      // `playCard`'s wiring); use the player id as the stable handle.
      cardId: `forest-sage:${playerId}`,
      playerId,
      face,
    },
  };
}

/**
 * Commit the pending Forest-Sage omen roll. Throws when no roll is
 * pending or no outcome is authored for the rolled face. Clears
 * `pendingForestSageRoll` on success.
 */
export function commitForestSageOmenSlice(state: KidGameState): KidGameState {
  const pending = state.pendingForestSageRoll;
  if (pending === null) {
    throw new Error('commitForestSageOmen: no Forest-Sage omen roll is pending');
  }
  const outcome = FOREST_SAGE_OMEN_TABLE[pending.face];
  if (!outcome) {
    throw new Error(`commitForestSageOmen: no outcome authored for face ${pending.face}`);
  }
  const next = applyForestSageOmenOutcome(state, pending.playerId, outcome);
  return { ...next, pendingForestSageRoll: null };
}
