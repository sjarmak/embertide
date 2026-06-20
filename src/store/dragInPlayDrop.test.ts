import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from './types';

/**
 * Regression coverage for embertide-0qby: "cards sometimes disappear
 * when dragged from hand to the play area (non-starter cards)."
 *
 * Root cause was NOT a race or a duplicate-id collision — non-starter
 * cards all carry unique ids and no card is ever destroyed. The "vanish"
 * was an ITEM dragged onto the in-play drop zone: it equipped into the
 * Items tray, leaving the in-play area empty so the player perceived the
 * card as gone. `playCardFromInPlayDrop` now treats an item drop on the
 * in-play zone as invalid and leaves it in hand; tap-to-play still equips.
 */

const SAGE = KID_CARDS.find((c) => c.id === 'sage-keeper')!; // non-starter hero
const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!; // non-starter item
const LEGENDARY = KID_CARDS.find((c) => c.role === 'legendary-sword')!;

/** A dynamically-added non-starter item, mirroring the unique-id mint path
 *  (expandTemplate / ensureUniqueItemId) the supply uses for extra copies. */
const ADDED_ITEM: Card = { ...SHORT_SWORD, id: 'short-sword-2', baseId: 'short-sword' } as Card;

function newGame(seed = 1) {
  const store = createGameStore(seed);
  store.getState().initGame({ players: 2, championIds: ['champion-courage', 'champion-wisdom'] });
  return store;
}

function setHand(store: ReturnType<typeof newGame>, hand: readonly Card[]): void {
  store.setState((s: KidGameState) => {
    const players = s.players.slice();
    players[0] = { ...players[0], green: 20, red: 20, keys: 20, hand: [...hand] };
    return { players } as Partial<KidGameState>;
  });
}

function zoneCount(p: KidPlayer): number {
  return p.hand.length + p.inPlay.length + p.items.length + p.discard.length + p.deck.length;
}

describe('playCardFromInPlayDrop (drag hand → in-play zone)', () => {
  it('plays a non-starter HERO into the in-play area', () => {
    const store = newGame();
    setHand(store, [SAGE]);
    const before = zoneCount(store.getState().players[0]);

    store.getState().playCardFromInPlayDrop(SAGE.id);

    const p = store.getState().players[0];
    expect(p.inPlay.map((c) => c.id)).toContain(SAGE.id);
    expect(p.hand.map((c) => c.id)).not.toContain(SAGE.id);
    expect(zoneCount(p)).toBe(before);
  });

  it('does NOT silently equip a dynamically-added ITEM — it stays in hand', () => {
    const store = newGame();
    setHand(store, [ADDED_ITEM]);
    const before = zoneCount(store.getState().players[0]);

    store.getState().playCardFromInPlayDrop(ADDED_ITEM.id);

    const p = store.getState().players[0];
    // The card never disappears: it remains visibly in hand, and never
    // leaks into the in-play area or the Items tray via this drop path.
    expect(p.hand.map((c) => c.id)).toContain(ADDED_ITEM.id);
    expect(p.inPlay.map((c) => c.id)).not.toContain(ADDED_ITEM.id);
    expect(p.items.map((c) => c.id)).not.toContain(ADDED_ITEM.id);
    expect(zoneCount(p)).toBe(before);
  });

  it('treats a legendary-sword drop on the in-play zone as invalid (stays in hand)', () => {
    const store = newGame();
    setHand(store, [LEGENDARY]);

    store.getState().playCardFromInPlayDrop(LEGENDARY.id);

    const p = store.getState().players[0];
    expect(p.hand.map((c) => c.id)).toContain(LEGENDARY.id);
    expect(p.items.map((c) => c.id)).not.toContain(LEGENDARY.id);
  });

  it('tap-to-play (playCard) STILL equips the same item — drag guard is drag-only', () => {
    const store = newGame();
    setHand(store, [ADDED_ITEM]);

    store.getState().playCard(ADDED_ITEM.id);

    const p = store.getState().players[0];
    expect(p.items.map((c) => c.id)).toContain(ADDED_ITEM.id);
    expect(p.hand.map((c) => c.id)).not.toContain(ADDED_ITEM.id);
  });

  it('is a no-op for a card id not in hand (never throws)', () => {
    const store = newGame();
    setHand(store, [SAGE]);
    const before = zoneCount(store.getState().players[0]);

    expect(() => store.getState().playCardFromInPlayDrop('not-a-real-card')).not.toThrow();
    expect(zoneCount(store.getState().players[0])).toBe(before);
  });
});
