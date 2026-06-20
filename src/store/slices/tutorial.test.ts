import { describe, it, expect } from 'vitest';
import type { KidGameState, KidPlayer } from '../types';
import {
  clearCombatTutorialBubbleSlice,
  fireCombatTutorialBubbleSlice,
  fireTutorialBubbleOnceSlice,
} from './tutorial';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

/**
 * Pure-transformer tests for the tutorial slice. Integration coverage
 * (the wired-up createGameStore path) lives in
 * src/store/tutorialBubblesFired.test.ts and the GameBoard / CombatScreen
 * UI tests; this file pins the slice contracts.
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    ...overrides,
  });
}

describe('fireCombatTutorialBubbleSlice', () => {
  it('returns state unchanged when trigger is null', () => {
    const state = makeState();
    expect(fireCombatTutorialBubbleSlice(state, null)).toBe(state);
  });

  it('hydrates combatTutorialBubble on a first-combat entry trigger', () => {
    const state = makeState({ combatsEntered: 0 });
    const next = fireCombatTutorialBubbleSlice(state, 'combat-entry');
    expect(next.combatTutorialBubble).not.toBeNull();
  });

  it('returns state unchanged when re-fired with the same active bubble', () => {
    const state = makeState({ combatsEntered: 0 });
    const next1 = fireCombatTutorialBubbleSlice(state, 'combat-entry');
    const next2 = fireCombatTutorialBubbleSlice(next1, 'combat-entry');
    expect(next2).toBe(next1);
  });
});

describe('clearCombatTutorialBubbleSlice', () => {
  it('returns state unchanged when nothing is showing', () => {
    const state = makeState();
    expect(clearCombatTutorialBubbleSlice(state)).toBe(state);
  });

  it('clears combatTutorialBubble + tutorialBubbleBodyOverride', () => {
    const state = makeState({
      combatTutorialBubble: 'combat-entry',
      tutorialBubbleBodyOverride: 'overridden body',
    });
    const next = clearCombatTutorialBubbleSlice(state);
    expect(next.combatTutorialBubble).toBeNull();
    expect(next.tutorialBubbleBodyOverride).toBeNull();
  });
});

describe('fireTutorialBubbleOnceSlice', () => {
  it('returns state unchanged when the id is already in tutorialBubblesFired', () => {
    const state = makeState({ tutorialBubblesFired: ['combat-entry'] });
    expect(fireTutorialBubbleOnceSlice(state, 'combat-entry')).toBe(state);
  });

  it('sets the bubble + appends to tutorialBubblesFired on first fire', () => {
    const state = makeState();
    const next = fireTutorialBubbleOnceSlice(state, 'combat-entry');
    expect(next.combatTutorialBubble).toBe('combat-entry');
    expect(next.tutorialBubblesFired).toEqual(['combat-entry']);
    expect(next.tutorialBubbleBodyOverride).toBeNull();
  });

  it('templates the body when bodyOverride is provided', () => {
    const state = makeState();
    const next = fireTutorialBubbleOnceSlice(state, 'combat-entry', 'custom body');
    expect(next.tutorialBubbleBodyOverride).toBe('custom body');
  });
});
