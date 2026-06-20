/**
 * Defeating-hero resolution (u-9c / REQ-32 slot engagement).
 */

import type { CombatState } from '../../types/combat';
import type { KidPlayer } from '../../store/types';

/**
 * Resolve which player's seat landed the finishing blow in a combat.
 * Used by `COMBAT_RESOLVE_WIN` to route the `HEIRLOOM_DROPS[bossBaseId]`
 * heirloom card to the correct `player.items` zone on a
 * `entrySource === 'wild-boss-slot'` resolution.
 *
 * Algorithm:
 *   1. If `combat.lastPlayerToPlay` is set AND matches a current
 *      `KidPlayer.id`, return that id. `reducePlayerPlayCard` persists
 *      this field on every successful `PLAYER_PLAY_CARD`, so on a
 *      normal WIN the value points at whoever played the killing blow.
 *   2. Otherwise return `players[0].id` (tiebreak to player-1). This
 *      is the "genuinely ambiguous" case — e.g. the combat log is
 *      empty, which shouldn't be possible on a real WIN but shouldn't
 *      crash the reducer either.
 *
 * Pure. No state mutation.
 */
export function determineDefeatingHero(players: readonly KidPlayer[], combat: CombatState): string {
  const candidate = combat.lastPlayerToPlay;
  if (candidate !== undefined) {
    const match = players.find((p) => p.id === candidate);
    if (match !== undefined) return match.id;
  }
  // Fallback: tiebreak to player-1 (first seat). `players[0]` is
  // guaranteed non-null in any reachable state (initGame requires
  // `players >= 1`) — defensive `?? 'p0'` for pathological mocks.
  return players[0]?.id ?? 'p0';
}
