import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../data/cards';
import type { KidGameState, KidPlayer } from './types';
import { WISP_BASE_IDS, checkCoopLoss, playerHasWisp, replacePlayer } from './_shared';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * Unit tests for the shared store-layer helpers extracted to ./_shared.ts
 * (embertide-hik1). These helpers are exercised end-to-end by the
 * existing slice + integration suites; this file pins the explicit
 * contracts for replacePlayer / playerHasWisp / checkCoopLoss so future
 * refactors can land without spelunking through downstream tests.
 */

const WISP = KID_CARDS.find((c) => c.id === 'wisp')!;
const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!;

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const makeState = (players: KidPlayer[]): KidGameState => makeKidGameState({ players });

describe('replacePlayer', () => {
  it('returns a NEW state with players[idx] replaced', () => {
    const p0 = makePlayer({ id: 'p0', hp: 5 });
    const p1 = makePlayer({ id: 'p1', hp: 5 });
    const state = makeState([p0, p1]);

    const next = replacePlayer(state, 1, { ...p1, hp: 1 });
    expect(next).not.toBe(state);
    expect(next.players).not.toBe(state.players);
    expect(next.players[0]).toBe(p0);
    expect(next.players[1].hp).toBe(1);
  });

  it('does not mutate the input state or players array', () => {
    const p0 = makePlayer({ id: 'p0' });
    const p1 = makePlayer({ id: 'p1' });
    const state = makeState([p0, p1]);
    const playersBefore = state.players;

    replacePlayer(state, 0, { ...p0, hp: 1 });
    expect(state.players).toBe(playersBefore);
    expect(state.players[0].hp).toBe(5);
  });
});

describe('playerHasWisp', () => {
  it('returns false for a player with no items', () => {
    expect(playerHasWisp(makePlayer({ items: [] }))).toBe(false);
  });

  it('returns true when the items zone contains a plain "wisp"', () => {
    expect(playerHasWisp(makePlayer({ items: [WISP] }))).toBe(true);
  });

  it('returns false for a non-wisp item', () => {
    expect(playerHasWisp(makePlayer({ items: [GRUNT_ORC] }))).toBe(false);
  });

  it('matches every baseId in WISP_BASE_IDS via baseIdOf', () => {
    for (const base of WISP_BASE_IDS) {
      const cardForBase = KID_CARDS.find((c) => c.id === base);
      expect(cardForBase, `wisp variant card "${base}" missing from KID_CARDS`).toBeTruthy();
      expect(playerHasWisp(makePlayer({ items: [cardForBase!] }))).toBe(true);
    }
  });
});

describe('checkCoopLoss', () => {
  it('preserves outcome when game already has one', () => {
    const both = [
      makePlayer({ id: 'p0', downed: true, revivedThisIncident: true }),
      makePlayer({ id: 'p1', downed: true, revivedThisIncident: true }),
    ];
    const state = { ...makeState(both), outcome: 'win' as const };
    expect(checkCoopLoss(state).outcome).toBe('win');
  });

  it('returns state unchanged when fewer than 2 players', () => {
    const state = makeState([makePlayer({ downed: true, revivedThisIncident: true })]);
    expect(checkCoopLoss(state)).toBe(state);
  });

  it('returns state unchanged when not all players are downed', () => {
    const state = makeState([
      makePlayer({ id: 'p0', downed: true, revivedThisIncident: true }),
      makePlayer({ id: 'p1', downed: false }),
    ]);
    expect(checkCoopLoss(state).outcome).toBeNull();
  });

  it('returns state unchanged when at least one player can still be revived', () => {
    const state = makeState([
      makePlayer({ id: 'p0', downed: true, revivedThisIncident: false }),
      makePlayer({ id: 'p1', downed: true, revivedThisIncident: true }),
    ]);
    expect(checkCoopLoss(state).outcome).toBeNull();
  });

  it('preserves outcome when both downed but a wisp is available', () => {
    const state = makeState([
      makePlayer({
        id: 'p0',
        downed: true,
        revivedThisIncident: true,
        items: [WISP],
      }),
      makePlayer({ id: 'p1', downed: true, revivedThisIncident: true }),
    ]);
    expect(checkCoopLoss(state).outcome).toBeNull();
  });

  it('flips outcome to loss when both downed, both already revived, no wisp', () => {
    const state = makeState([
      makePlayer({ id: 'p0', downed: true, revivedThisIncident: true }),
      makePlayer({ id: 'p1', downed: true, revivedThisIncident: true }),
    ]);
    const next = checkCoopLoss(state);
    expect(next.outcome).toBe('loss');
    expect(next).not.toBe(state);
  });
});
