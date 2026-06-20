import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import { createGameStore } from './gameStore';

/**
 * embertide-g294: the visible-Void pane reads `state.voided` and
 * shows the topmost card face-up over a TOTK-gloom backdrop. The store
 * mirrors EVERY card the player just lost permanent access to —
 * defeated monsters from the field AND banished cards from a player's
 * hand or discard — into this shared array, in append order.
 *
 * Coverage:
 *   (a) initGame seeds an empty voided array.
 *   (b) banishFromHand appends the banished card to state.voided.
 *   (c) banishFromDiscard appends the banished card to state.voided.
 *   (d) Successive banishes accumulate in append order (most-recent
 *       last — the VoidPane reads `voided[voided.length - 1]`).
 *   (e) Banishes from different source players share the same shared
 *       voided array (single board surface).
 *
 * Combat-defeat coverage lives alongside the existing fightMonster +
 * COMBAT_RESOLVE_WIN tests in slices/combat.test.ts and the boss-fight
 * suites — see `defeated` mirror at slices/combat.ts:547 and the
 * COMBAT_RESOLVE_WIN branch in gameStore.ts.
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

describe('state.voided (embertide-g294)', () => {
  it('(a) seeds empty on initGame', () => {
    const store = bootstrapStore();
    expect(store.getState().voided).toEqual([]);
  });

  it('(b) banishFromHand mirrors the banished card into voided', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('void-from-hand-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [...players[0].hand, victim] };
      return { ...s, players };
    });

    store.getState().banishFromHand('void-from-hand-1');

    const after = store.getState();
    expect(after.voided.map((c) => c.id)).toEqual(['void-from-hand-1']);
    expect(after.players[0].banished.map((c) => c.id)).toEqual(['void-from-hand-1']);
  });

  it('(c) banishFromDiscard mirrors the banished card into voided', () => {
    const store = bootstrapStore();
    const victim = makeHandCard('void-from-discard-1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], discard: [...players[0].discard, victim] };
      return { ...s, players };
    });

    store.getState().banishFromDiscard('void-from-discard-1');

    const after = store.getState();
    expect(after.voided.map((c) => c.id)).toEqual(['void-from-discard-1']);
    expect(after.players[0].banished.map((c) => c.id)).toEqual(['void-from-discard-1']);
  });

  it('(d) successive banishes accumulate in append order', () => {
    const store = bootstrapStore();
    const a = makeHandCard('void-acc-a');
    const b = makeHandCard('void-acc-b');
    const c = makeHandCard('void-acc-c');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hand: [...players[0].hand, a, b],
        discard: [...players[0].discard, c],
      };
      return { ...s, players };
    });

    store.getState().banishFromHand('void-acc-a');
    store.getState().banishFromDiscard('void-acc-c');
    store.getState().banishFromHand('void-acc-b');

    expect(store.getState().voided.map((x) => x.id)).toEqual([
      'void-acc-a',
      'void-acc-c',
      'void-acc-b',
    ]);
  });

  it('(e) shared across both players (single board surface)', () => {
    const store = bootstrapStore();
    const p0Card = makeHandCard('void-p0');
    const p1Card = makeHandCard('void-p1');
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [...players[0].hand, p0Card] };
      players[1] = { ...players[1], hand: [...players[1].hand, p1Card] };
      return { ...s, players };
    });

    store.getState().banishFromHand('void-p0');
    // Hand turn over to p1 by manually updating the active index — the
    // shared-pile contract is what we care about, not turn rotation.
    store.setState((s) => ({ ...s, currentPlayerIndex: 1 }));
    store.getState().banishFromHand('void-p1');

    expect(store.getState().voided.map((c) => c.id)).toEqual(['void-p0', 'void-p1']);
  });
});
