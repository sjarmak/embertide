import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import { createGameStore } from './gameStore';

/**
 * embertide-91p framework: deck-thinning via banish.
 *
 * Two store actions ship together — `banishFromHand(cardId)` and
 * `banishFromDiscard(cardId)` — each moving a single card from the
 * named source pile into the active player's permanent `banished`
 * pile. No card in the v2.0/v2.1 catalog currently triggers these
 * effects; cards that dispatch `banish-from-hand` / `banish-from-
 * discard` EffectSpec kinds land in 91p follow-up beads (commit
 * sequence (b) per the bead's design note).
 *
 * Coverage:
 *   (a) banishFromHand moves the card hand → banished pile.
 *   (b) banishFromHand throws when the cardId is not in hand.
 *   (c) banishFromHand throws when active player is downed.
 *   (d) banishFromHand is a no-op once the game outcome is set.
 *   (e) banishFromDiscard moves the card discard → banished pile.
 *   (f) banishFromDiscard throws when the cardId is not in discard.
 *   (g) banished pile accumulates across multiple banishes.
 *   (h) non-active player piles are not touched.
 */

const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!;

function makeHandCard(id: string): Card {
  return { ...GRUNT_ORC, id };
}

function bootstrapStore() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
  });
  return store;
}

describe('banishFromHand (91p framework)', () => {
  it('(a) moves the named card from hand → banished pile', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('banish-target-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [...players[0].hand, victim] };
      return { ...s, players };
    });
    const before = store.getState().players[0];
    expect(before.hand.some((c) => c.id === 'banish-target-1')).toBe(true);
    expect(before.banished).toHaveLength(0);

    store.getState().banishFromHand('banish-target-1');

    const after = store.getState().players[0];
    expect(after.hand.some((c) => c.id === 'banish-target-1')).toBe(false);
    expect(after.banished.map((c) => c.id)).toEqual(['banish-target-1']);
    expect(after.hand.length).toBe(before.hand.length - 1);
  });

  it('(b) throws when the cardId is not in hand', () => {
    const store = bootstrapStore();
    expect(() => store.getState().banishFromHand('does-not-exist')).toThrow(
      /banishFromHand: card does-not-exist not in hand/,
    );
  });

  it('(c) throws when the active player is downed', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('banish-downed-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hand: [...players[0].hand, victim],
        downed: true,
        hp: 0,
      };
      return { ...s, players };
    });
    expect(() => store.getState().banishFromHand('banish-downed-1')).toThrow(
      /banishFromHand: active player is downed/,
    );
  });

  it('(d) is a no-op once the game outcome is set', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('banish-terminal-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [...players[0].hand, victim] };
      return { ...s, players, outcome: 'win' };
    });
    store.getState().banishFromHand('banish-terminal-1');
    const after = store.getState().players[0];
    expect(after.hand.some((c) => c.id === 'banish-terminal-1')).toBe(true);
    expect(after.banished).toHaveLength(0);
  });
});

describe('banishFromDiscard (91p framework)', () => {
  it('(e) moves the named card from discard → banished pile', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('banish-disc-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], discard: [...players[0].discard, victim] };
      return { ...s, players };
    });
    store.getState().banishFromDiscard('banish-disc-1');
    const after = store.getState().players[0];
    expect(after.discard.some((c) => c.id === 'banish-disc-1')).toBe(false);
    expect(after.banished.map((c) => c.id)).toEqual(['banish-disc-1']);
  });

  it('(f) throws when the cardId is not in discard', () => {
    const store = bootstrapStore();
    expect(() => store.getState().banishFromDiscard('not-in-discard')).toThrow(
      /banishFromDiscard: card not-in-discard not in discard/,
    );
  });
});

describe('banished pile accumulation + non-active isolation (91p framework)', () => {
  it('(g) accumulates across multiple banishes in order', () => {
    const store = bootstrapStore();
    const a = makeHandCard('banish-accum-a');
    const b = makeHandCard('banish-accum-b');
    const c = makeHandCard('banish-accum-c');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hand: [...players[0].hand, a],
        discard: [...players[0].discard, b, c],
      };
      return { ...s, players };
    });
    store.getState().banishFromHand('banish-accum-a');
    store.getState().banishFromDiscard('banish-accum-c');
    store.getState().banishFromDiscard('banish-accum-b');
    const after = store.getState().players[0];
    expect(after.banished.map((x) => x.id)).toEqual([
      'banish-accum-a',
      'banish-accum-c',
      'banish-accum-b',
    ]);
  });

  it('(h) banishing from the active player does NOT touch p1', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('banish-iso-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [...players[0].hand, victim] };
      return { ...s, players };
    });
    const p1Before = store.getState().players[1];
    store.getState().banishFromHand('banish-iso-1');
    const p1After = store.getState().players[1];
    expect(p1After).toBe(p1Before);
    expect(p1After.banished).toHaveLength(0);
  });
});
