import { determineDefeatingHero } from '../core/combatEngine';
import type { ColosseumReward, TierId } from '../core/colosseum';
import { replacePlayer } from './_shared';
import { addEmberShard } from './playerRewards';
import { grantHeirloom } from './slices/combat';
import type { KidGameState } from './types';

/** Apply and record a tier clear as one immutable game-state transaction. */
export function applyColosseumRewards(
  state: KidGameState,
  tier: TierId,
  rewards: readonly ColosseumReward[],
): KidGameState {
  const combat = state.activeCombat;
  if (combat === null) return state;

  const defeaterId = determineDefeatingHero(state.players, combat);
  const defeaterIdx = state.players.findIndex((player) => player.id === defeaterId);
  let next: KidGameState = {
    ...state,
    colosseumClaimedRewards: [
      ...state.colosseumClaimedRewards,
      ...rewards.map((reward) => ({ tier, reward })),
    ],
  };

  if (defeaterIdx === -1) return next;

  for (const reward of rewards) {
    switch (reward.kind) {
      case 'ember-shard': {
        const player = next.players[defeaterIdx];
        if (player !== undefined) {
          next = replacePlayer(next, defeaterIdx, addEmberShard(player));
        }
        break;
      }
      case 'golden-rainbow-heirloom':
        next = grantHeirloom(next, defeaterIdx, reward.heirloomId);
        break;
      case 'cosmetic-unlock-placeholder':
      case 'unique-cosmetic':
        break;
      default: {
        const exhaustive: never = reward;
        return exhaustive;
      }
    }
  }

  return next;
}
