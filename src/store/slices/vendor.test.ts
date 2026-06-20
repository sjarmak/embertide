import { describe, it, expect } from 'vitest';
import { findVendor, KEY_VENDOR_ID } from '../../data/cards';
import type { KidGameState, KidPlayer } from '../types';
import { tradeWithKeyVendorSlice } from './vendor';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

/**
 * Pure-transformer tests for the vendor slice. Integration coverage of
 * the wired-up createGameStore action lives in
 * src/store/keyVendor.test.ts; this file pins the slice contract.
 */

const KEY_VENDOR = findVendor(KEY_VENDOR_ID)!;
const GREEN_COST = KEY_VENDOR.cost.green ?? 0;

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({ green: 10, ...overrides });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    ...overrides,
  });
}

describe('tradeWithKeyVendorSlice', () => {
  it('deducts green, grants keys, flips the per-turn cap', () => {
    const state = makeState();
    const next = tradeWithKeyVendorSlice(state);
    expect(next.players[0].green).toBe(10 - GREEN_COST);
    expect(next.players[0].keys).toBeGreaterThan(0);
    expect(next.players[0].usedKeyVendorThisTurn).toBe(true);
  });

  it('returns input state unchanged when outcome is set', () => {
    const state = { ...makeState(), outcome: 'win' as const };
    expect(tradeWithKeyVendorSlice(state)).toBe(state);
  });

  it('throws when phase is not Main', () => {
    const state = { ...makeState(), phase: 'End' as const };
    expect(() => tradeWithKeyVendorSlice(state)).toThrow(/main-phase/);
  });

  it('throws when active player is downed', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', downed: true }), makePlayer({ id: 'p1' })],
    });
    expect(() => tradeWithKeyVendorSlice(state)).toThrow(/downed/);
  });

  it('throws when player has already traded this turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', usedKeyVendorThisTurn: true }), makePlayer({ id: 'p1' })],
    });
    expect(() => tradeWithKeyVendorSlice(state)).toThrow(/already traded/);
  });

  it('throws when active player has insufficient green', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', green: 0 }), makePlayer({ id: 'p1' })],
    });
    expect(() => tradeWithKeyVendorSlice(state)).toThrow(/insufficient green/);
  });
});
