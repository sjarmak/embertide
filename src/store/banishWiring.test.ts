import { describe, it, expect } from 'vitest';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import { createGameStore } from './gameStore';

/**
 * embertide-91p (b) — per-card banish-from-hand wiring.
 *
 * Validates that `playCard` surfaces a `pendingBanishChoice` when a
 * card whose `effects.kind === 'banish-from-hand'` resolves with a
 * non-empty hand, that `banishFromHand` clears the prompt and lands
 * the chosen card in `player.banished`, and that `cancelBanishChoice`
 * dismisses the prompt without touching the player's hand.
 */

const BLACKSMITH_FORGE = KID_CARDS.find((c) => c.id === 'blacksmith-forge')!;

function bootstrapStore() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
  });
  return store;
}

function injectIntoHand(store: ReturnType<typeof bootstrapStore>, card: Card) {
  store.setState((s) => {
    const players = s.players.slice();
    players[0] = { ...players[0], hand: [...players[0].hand, card] };
    return { ...s, players };
  });
}

describe('playCard → banish-from-hand wiring (91p b)', () => {
  it('sets pendingBanishChoice when playing a banish-from-hand card with non-empty hand; banishFromHand resolves the prompt and lands the chosen card in banished', () => {
    const store = bootstrapStore();
    // Ensure the active player has at least one OTHER card in hand to
    // banish — initGame's opening draw already populates it, but we
    // assert it here so the test is self-contained.
    const handBefore = store.getState().players[0].hand;
    expect(handBefore.length).toBeGreaterThan(0);

    // Inject a UNIQUE-ID hand card so the banish reducer's findIndex
    // can't ambiguously remove a starter copy. Starter shard cards
    // share ids across copies, so a unique id avoids hand-size
    // assertion noise.
    const banishTarget: Card = { ...BLACKSMITH_FORGE, id: 'banish-target-unique' };
    injectIntoHand(store, banishTarget);

    // Inject a fresh blacksmith-forge instance into the player's hand
    // (a different unique id) and play it.
    const forgeInstance: Card = { ...BLACKSMITH_FORGE, id: 'forge-instance-1' };
    injectIntoHand(store, forgeInstance);

    // Play it — items route to the items zone (or fallback inPlay)
    // BEFORE the banish-prompt branch fires, so the prompt's snapshot
    // never includes the just-played forge.
    store.getState().playCard('forge-instance-1');

    const stateAfterPlay = store.getState();
    expect(stateAfterPlay.pendingBanishChoice).not.toBeNull();
    expect(stateAfterPlay.pendingBanishChoice!.playerId).toBe(stateAfterPlay.players[0].id);
    // Snapshot must NOT include the forge (it's already left the hand
    // by the time the prompt is built).
    expect(stateAfterPlay.pendingBanishChoice!.cardIds).not.toContain('forge-instance-1');
    // Snapshot must include the unique target we injected.
    expect(stateAfterPlay.pendingBanishChoice!.cardIds).toContain('banish-target-unique');
    // Snapshot length matches the post-play hand size.
    expect(stateAfterPlay.pendingBanishChoice!.cardIds.length).toBe(
      stateAfterPlay.players[0].hand.length,
    );

    // Choose our unique target and assert it lands in banished while
    // the prompt clears. Using a unique id avoids any starter-deck
    // duplicate-id ambiguity.
    const handBeforeBanish = stateAfterPlay.players[0].hand.length;
    store.getState().banishFromHand('banish-target-unique');

    const stateAfterChoice = store.getState();
    expect(stateAfterChoice.pendingBanishChoice).toBeNull();
    expect(stateAfterChoice.players[0].banished.map((c) => c.id)).toContain('banish-target-unique');
    expect(stateAfterChoice.players[0].hand.some((c) => c.id === 'banish-target-unique')).toBe(
      false,
    );
    expect(stateAfterChoice.players[0].hand.length).toBe(handBeforeBanish - 1);
  });

  it('banish-from-hand on empty hand fizzles silently — no prompt, no banish', () => {
    const store = bootstrapStore();
    // Drain the player's hand so the only card we'll play (the forge)
    // is alone — the post-play hand is empty and the banish snapshot
    // helper should bail rather than surface an empty modal.
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [], banished: [] };
      return { ...s, players };
    });
    const forgeInstance: Card = { ...BLACKSMITH_FORGE, id: 'forge-instance-2' };
    injectIntoHand(store, forgeInstance);

    store.getState().playCard('forge-instance-2');

    const after = store.getState();
    expect(after.pendingBanishChoice).toBeNull();
    expect(after.players[0].banished).toHaveLength(0);
  });
});

describe('cancelBanishChoice (91p b)', () => {
  it('clears pendingBanishChoice without banishing or mutating the hand', () => {
    const store = bootstrapStore();
    const forgeInstance: Card = { ...BLACKSMITH_FORGE, id: 'forge-instance-3' };
    injectIntoHand(store, forgeInstance);
    store.getState().playCard('forge-instance-3');

    const stateAfterPlay = store.getState();
    expect(stateAfterPlay.pendingBanishChoice).not.toBeNull();
    const handSnapshotIds = stateAfterPlay.players[0].hand.map((c) => c.id);
    const banishedBefore = stateAfterPlay.players[0].banished.length;

    store.getState().cancelBanishChoice();

    const after = store.getState();
    expect(after.pendingBanishChoice).toBeNull();
    expect(after.players[0].hand.map((c) => c.id)).toEqual(handSnapshotIds);
    expect(after.players[0].banished.length).toBe(banishedBefore);
  });

  it('is idempotent when no choice is pending', () => {
    const store = bootstrapStore();
    expect(store.getState().pendingBanishChoice).toBeNull();
    expect(() => store.getState().cancelBanishChoice()).not.toThrow();
    expect(store.getState().pendingBanishChoice).toBeNull();
  });
});
