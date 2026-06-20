/**
 * Master combat-turn reducer (§B4). Pure: returns a new
 * `CombatTurnState`; inputs are untouched. Fires `terminal = 'win'`
 * on boss.hp <= 0 and `terminal = 'loss'` when every non-downed
 * player would be downed after a boss attack. u-8c reads the
 * `terminal` field to dispatch `COMBAT_RESOLVE_WIN` /
 * `COMBAT_RESOLVE_LOSS` on the main-board reducer.
 */

import type { CombatTurnAction, CombatTurnState } from './types';
import { reducePlayerPass, reducePlayerPlayCard } from './playerTurn';
import { reduceBossResolve } from './bossTurn';

export function combatTurnReducer(
  state: CombatTurnState,
  action: CombatTurnAction,
): CombatTurnState {
  if (state.terminal !== null) {
    // Terminal states are sticky; ignore further actions.
    return state;
  }

  switch (action.type) {
    case 'PLAYER_PLAY_CARD':
      return reducePlayerPlayCard(state, action);
    case 'PLAYER_PASS':
      return reducePlayerPass(state);
    case 'BOSS_RESOLVE':
      return reduceBossResolve(state);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
