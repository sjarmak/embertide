import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../../data/cards';
import type { Card } from '../../types/card';
import type { KidGameState, KidPlayer } from '../types';
import { banishFromDiscardSlice, banishFromHandSlice, cancelBanishChoiceSlice } from './banish';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

/**
 * Pure-transformer tests for the banish slice. The integration coverage
 * lives in src/store/banish.test.ts (which exercises the wired-up
 * createGameStore action); this file pins the slice's contract so future
 * refactors can land without spelunking through the integration suite.
 */

const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!;

function makeCard(id: string): Card {
  return { ...GRUNT_ORC, id };
}

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    ...overrides,
  });
}

describe('banishFromHandSlice', () => {
  it('moves a hand card into the banished pile + voided mirror', () => {
    const card = makeCard('orc-1');
    const p0 = makePlayer({ id: 'p0', hand: [card] });
    const p1 = makePlayer({ id: 'p1' });
    const state = makeState({ players: [p0, p1] });

    const next = banishFromHandSlice(state, 'orc-1');
    expect(next.players[0].hand).toEqual([]);
    expect(next.players[0].banished).toEqual([card]);
    expect(next.voided).toEqual([card]);
  });

  it('clears pendingBanishChoice on success', () => {
    const card = makeCard('orc-1');
    const p0 = makePlayer({ id: 'p0', hand: [card] });
    const state = makeState({
      players: [p0, makePlayer({ id: 'p1' })],
      pendingBanishChoice: { playerId: 'p0', cardIds: ['orc-1'] },
    });

    const next = banishFromHandSlice(state, 'orc-1');
    expect(next.pendingBanishChoice).toBeNull();
  });

  it('returns input state unchanged when outcome is already set', () => {
    const state = { ...makeState(), outcome: 'win' as const };
    expect(banishFromHandSlice(state, 'orc-1')).toBe(state);
  });

  it('throws when phase is not Main', () => {
    const state = { ...makeState(), phase: 'Draw' as const };
    expect(() => banishFromHandSlice(state, 'orc-1')).toThrow(/main-phase/);
  });

  it('throws when active player is downed', () => {
    const card = makeCard('orc-1');
    const p0 = makePlayer({ id: 'p0', hand: [card], downed: true });
    const state = makeState({ players: [p0, makePlayer({ id: 'p1' })] });
    expect(() => banishFromHandSlice(state, 'orc-1')).toThrow(/downed/);
  });

  it('throws when card is not in hand', () => {
    const state = makeState();
    expect(() => banishFromHandSlice(state, 'missing-id')).toThrow(/not in hand/);
  });
});

describe('banishFromDiscardSlice', () => {
  it('moves a discard card into the banished pile + voided mirror', () => {
    const card = makeCard('orc-1');
    const p0 = makePlayer({ id: 'p0', discard: [card] });
    const state = makeState({ players: [p0, makePlayer({ id: 'p1' })] });

    const next = banishFromDiscardSlice(state, 'orc-1');
    expect(next.players[0].discard).toEqual([]);
    expect(next.players[0].banished).toEqual([card]);
    expect(next.voided).toEqual([card]);
  });

  it('returns input state unchanged when outcome is already set', () => {
    const state = { ...makeState(), outcome: 'loss' as const };
    expect(banishFromDiscardSlice(state, 'orc-1')).toBe(state);
  });

  it('throws when card is not in discard', () => {
    const state = makeState();
    expect(() => banishFromDiscardSlice(state, 'missing-id')).toThrow(/not in discard/);
  });
});

describe('cancelBanishChoiceSlice', () => {
  it('returns input state unchanged when no choice is pending', () => {
    const state = makeState();
    expect(cancelBanishChoiceSlice(state)).toBe(state);
  });

  it('clears pendingBanishChoice', () => {
    const state = makeState({
      pendingBanishChoice: { playerId: 'p0', cardIds: ['orc-1'] },
    });
    const next = cancelBanishChoiceSlice(state);
    expect(next.pendingBanishChoice).toBeNull();
  });
});
