import type { KidGameState } from '../types';
import { KEY_VENDOR_ID, findVendor } from '../../data/cards';
import { replacePlayer, requireMainPhase } from '../_shared';

/**
 * Pure transformer for the v2.1 Key Vendor (Pell, embertide-1eby)
 * trade action. Originally lived inline in gameStore.ts; extracted as
 * part of embertide-hik1's per-domain decomposition pass.
 *
 * Reads cost (green) and grant (keys) from the `key-vendor` template in
 * VENDORS so the rates stay declarative — the slice owns guard logic
 * (outcome / phase / downed / per-turn cap / insufficient green) and
 * the resource-mutation transaction.
 */

/**
 * Trade with the Key Vendor: pay green, gain keys, flip the
 * `usedKeyVendorThisTurn` 1-per-seat-turn cap (embertide-5y13).
 *
 * Returns the input state (===) when state.outcome is already set.
 *
 * Throws when:
 *   - phase is not 'Main' (via requireMainPhase)
 *   - active player is downed
 *   - active player already traded this seat-turn (cap exceeded)
 *   - the `key-vendor` template is missing from data/cards (defensive)
 *   - active player has insufficient green
 */
export function tradeWithKeyVendorSlice(state: KidGameState): KidGameState {
  if (state.outcome !== null) return state;
  requireMainPhase(state, 'tradeWithKeyVendor');
  const activeIdx = state.currentPlayerIndex;
  const active = state.players[activeIdx];
  if (active.downed) {
    throw new Error('tradeWithKeyVendor: active player is downed');
  }
  // embertide-5y13 (knob 2): cap to 1 trade per seat-turn so the
  // green→key→chest treadmill no longer dominates field-buy economy.
  // Flag resets in the End-phase reset block alongside
  // wildWolfKillsThisTurn.
  if (active.usedKeyVendorThisTurn) {
    throw new Error('tradeWithKeyVendor: already traded this turn (1-per-seat-turn cap)');
  }
  const template = findVendor(KEY_VENDOR_ID);
  if (!template) {
    throw new Error('tradeWithKeyVendor: key-vendor template missing');
  }
  const greenCost = template.cost.green ?? 0;
  const keysGranted = template.effects.kind === 'gain' ? (template.effects.keys ?? 0) : 0;
  if (active.green < greenCost) {
    throw new Error(
      `tradeWithKeyVendor: insufficient green (have ${active.green}, need ${greenCost})`,
    );
  }
  return replacePlayer(state, activeIdx, {
    ...active,
    green: active.green - greenCost,
    keys: active.keys + keysGranted,
    usedKeyVendorThisTurn: true,
  });
}
