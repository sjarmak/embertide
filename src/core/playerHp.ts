import { getPassives } from '../data/cardPassives';
import type { KidPlayer } from '../types/kidPlayer';

/**
 * Centralized HP-damage helper (amendment A3). Damaging a player clamps
 * their HP at 0 and transitions them into the `downed` state if HP
 * reaches zero. A fresh downed incident resets `revivedThisIncident` to
 * false so the teammate-revive budget refreshes for this incident.
 *
 * Pure: returns a new `KidPlayer`.
 */
export function applyDamage(player: KidPlayer, amount: number): KidPlayer {
  if (amount <= 0) return player;
  const nextHp = Math.max(0, player.hp - amount);
  if (nextHp === 0) {
    return {
      ...player,
      hp: 0,
      downed: true,
      revivedThisIncident: false,
    };
  }
  return { ...player, hp: nextHp };
}

/** Sum all equipped on-damage item-passive reductions. */
function totalOnDamageReduction(player: KidPlayer): number {
  let sum = 0;
  for (const item of player.items) {
    for (const passive of getPassives(item)) {
      if (passive.trigger !== 'on-damage') continue;
      if (passive.effect.kind !== 'damage-reduction') continue;
      sum += passive.effect.amount;
    }
  }
  return sum;
}

/**
 * Compute the damage that lands after equipped on-damage item passives.
 * Each hit is reduced independently, reductions stack additively, and the
 * result is clamped at zero. Pure: does not mutate the player.
 */
export function reduceIncomingDamage(player: KidPlayer, amount: number): number {
  if (amount <= 0) return amount;
  const reduction = totalOnDamageReduction(player);
  if (reduction <= 0) return amount;
  return Math.max(0, amount - reduction);
}
