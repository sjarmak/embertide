import { applyHeartReward } from '../core/vitalEmber';
import type { KidPlayer } from './types';

/** Four ember shards promote to one vital ember. */
export const HEART_PIECES_PER_CONTAINER = 4;

/** Add one ember shard, promoting a full stack into a vital ember. */
export function addEmberShard(player: KidPlayer): KidPlayer {
  const next = player.heartPieces + 1;
  if (next >= HEART_PIECES_PER_CONTAINER) {
    const grown = applyHeartReward(player, 1);
    return { ...grown, heartPieces: 0 };
  }
  return { ...player, heartPieces: next };
}
