import type { KidGameState } from '../types';
import { replacePlayer, requireMainPhase } from '../_shared';

/**
 * Pure transformers for the v2.1 banish action surface (embertide-91p
 * framework). Originally lived inline in gameStore.ts; extracted to a
 * dedicated slice as part of embertide-hik1's per-domain decomposition
 * pass so the action handlers in createGameStore can stay thin.
 *
 * Each transformer accepts the full `KidGameState` plus the action args
 * and returns a new `KidGameState`. Outcome-gate + main-phase guards live
 * in the transformer (NOT the store action) so unit tests can exercise
 * them without booting a Zustand store.
 *
 * Related v2.1 docs:
 *   - banishFromHandSlice / banishFromDiscardSlice: embertide-91p (b)
 *   - cancelBanishChoiceSlice: embertide-91p (b) "soft cancel" contract
 *   - state.voided mirroring: embertide-g294
 */

/**
 * Banish a single card from the active player's hand to their banished
 * pile + the visible voided pile. Pure transformer. Returns the input
 * state unchanged (===) when `state.outcome` is already set so the
 * action wires up as a no-op once the game is over.
 *
 * Throws when the active player is downed OR when `cardId` is not in
 * hand — defensive: UI must dispatch with an authoritative card id.
 */
export function banishFromHandSlice(state: KidGameState, cardId: string): KidGameState {
  if (state.outcome !== null) return state;
  requireMainPhase(state, 'banishFromHand');
  const activeIdx = state.currentPlayerIndex;
  const active = state.players[activeIdx];
  if (active.downed) {
    throw new Error('banishFromHand: active player is downed');
  }
  const handIdx = active.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) {
    throw new Error(`banishFromHand: card ${cardId} not in hand`);
  }
  const card = active.hand[handIdx];
  const hand = [...active.hand.slice(0, handIdx), ...active.hand.slice(handIdx + 1)];
  const banished = [...active.banished, card];
  // embertide-91p (b): banish landing always clears any pending
  // choice surface — whether the choice was prompted by a
  // banish-from-hand on-play (the prompt is now answered) or the
  // action was dispatched directly (no prompt to clear, idempotent
  // null write).
  // embertide-g294: mirror into the visible Void pile so the
  // VoidPane shows the just-banished card face-up.
  return {
    ...replacePlayer(state, activeIdx, { ...active, hand, banished }),
    voided: [...state.voided, card],
    pendingBanishChoice: null,
  };
}

/**
 * Banish a single card from the active player's discard pile. Same
 * contract as `banishFromHandSlice` except the source pile is
 * `discard`. Throws when the card is not in discard.
 */
export function banishFromDiscardSlice(state: KidGameState, cardId: string): KidGameState {
  if (state.outcome !== null) return state;
  requireMainPhase(state, 'banishFromDiscard');
  const activeIdx = state.currentPlayerIndex;
  const active = state.players[activeIdx];
  if (active.downed) {
    throw new Error('banishFromDiscard: active player is downed');
  }
  const discardIdx = active.discard.findIndex((c) => c.id === cardId);
  if (discardIdx === -1) {
    throw new Error(`banishFromDiscard: card ${cardId} not in discard`);
  }
  const card = active.discard[discardIdx];
  const discard = [...active.discard.slice(0, discardIdx), ...active.discard.slice(discardIdx + 1)];
  const banished = [...active.banished, card];
  // embertide-g294: mirror into the visible Void pile.
  return {
    ...replacePlayer(state, activeIdx, { ...active, discard, banished }),
    voided: [...state.voided, card],
  };
}

/**
 * Soft-cancel the pending banish choice surface (embertide-91p, b).
 * Idempotent — returns the input state (===) when no choice is pending.
 * Triggering card's deltas / inPlay placement are NOT rolled back; the
 * banish effect simply fizzles.
 */
export function cancelBanishChoiceSlice(state: KidGameState): KidGameState {
  if (state.pendingBanishChoice === null) return state;
  return { ...state, pendingBanishChoice: null };
}
