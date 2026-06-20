import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayAllStartersButton from './PlayAllStartersButton';
import { createGameStore } from '../store/gameStore';
import { STARTER_GREEN, STARTER_RED } from '../store/slices/deck';
import { KID_CARDS } from '../data/cards';
import type { KidPlayer } from '../store/types';

describe('PlayAllStartersButton (now Play all cards)', () => {
  it('plays every playable card in hand on click (2026-04-25)', () => {
    const store = createGameStore(42);
    store.getState().initGame({
      players: 1,
      championIds: ['champion-courage'],
    });

    // Seed a deterministic hand: 3 greens + 1 red + 1 hero. All of
    // these have either no cost or a cost the seeded hand resources
    // can pay. Click should empty the hand into inPlay.
    const hero = KID_CARDS.find((c) => c.role === 'hero');
    if (!hero) throw new Error('KID_CARDS missing a hero');

    store.setState((s) => {
      const players = s.players.slice();
      const p: KidPlayer = {
        ...players[0],
        hand: [STARTER_GREEN, STARTER_GREEN, STARTER_GREEN, hero, STARTER_RED],
        // Pre-pay the hero's typical green cost (3) so it plays through.
        green: 3,
        red: 0,
        discard: [],
        inPlay: [],
      };
      players[0] = p;
      return { ...s, players };
    });

    render(<PlayAllStartersButton store={store} />);
    const btn = screen.getByTestId('play-all-cards');
    fireEvent.click(btn);

    const after = store.getState().players[0];
    // 5 cards played → moved out of hand. Heroes typically end in
    // discard (instant cards), starters end in inPlay; counted via
    // hand-size invariant: all 5 cards left the hand zone.
    expect(after.hand).toHaveLength(0);
    expect(after.red).toBe(1);
  });

  it('survives an unplayable card without aborting the bulk action (try/catch contract)', () => {
    const store = createGameStore(7);
    store.getState().initGame({
      players: 1,
      championIds: ['champion-courage'],
    });

    // Force a guaranteed-throw card: a stub with an unknown id that
    // playCard cannot resolve. The starter before it must still play.
    const sentinelCard = {
      id: 'play-all-cards-test-unknown-stub',
      role: 'item' as const,
      cost: {},
      effects: { kind: 'gain' as const },
    };

    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hand: [STARTER_GREEN, sentinelCard],
        green: 0,
        red: 0,
        discard: [],
        inPlay: [],
      };
      return { ...s, players };
    });

    render(<PlayAllStartersButton store={store} />);
    expect(() => fireEvent.click(screen.getByTestId('play-all-cards'))).not.toThrow();

    const after = store.getState().players[0];
    // Starter played even though sentinel after it could throw.
    expect(after.green).toBe(1);
  });

  // embertide-0p8c (playtest 2026-05-26): an empty hand means no
  // cards left to play. Instead of a greyed/textless "Play all cards"
  // button, the slot swaps to a lit, enabled "End Turn" button so the
  // next action is obvious.
  it('swaps to a lit End Turn button when the hand is empty', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 1,
      championIds: ['champion-courage'],
    });

    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [] };
      return { ...s, players };
    });

    render(<PlayAllStartersButton store={store} />);
    // The greyed play-all control is gone…
    expect(screen.queryByTestId('play-all-cards')).toBeNull();
    // …replaced by an enabled End Turn button.
    const endBtn = screen.getByTestId('play-all-end-turn') as HTMLButtonElement;
    expect(endBtn.disabled).toBe(false);
    expect(endBtn.textContent).toContain('End Turn');
  });

  it('End Turn button ends the turn on click when the hand is empty', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 1,
      championIds: ['champion-courage'],
    });

    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hand: [] };
      return { ...s, players };
    });

    const turnBefore = store.getState().turn;
    render(<PlayAllStartersButton store={store} />);
    fireEvent.click(screen.getByTestId('play-all-end-turn'));
    // endTurn advances the phase loop; a single-player turn wraps back to
    // its own Main with the turn counter incremented.
    expect(store.getState().turn).toBeGreaterThan(turnBefore);
  });

  it('renders nothing when the store has no players', () => {
    const store = createGameStore(1);
    const { container } = render(<PlayAllStartersButton store={store} />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes a 44px touch target on the button', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 1,
      championIds: ['champion-courage'],
    });

    render(<PlayAllStartersButton store={store} />);
    const btn = screen.getByTestId('play-all-cards') as HTMLButtonElement;
    expect(btn.getAttribute('data-touch-target')).toBe('true');
  });
});
