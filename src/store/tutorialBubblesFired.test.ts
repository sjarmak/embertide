/**
 * REQ-32 (u-9e) — `fireTutorialBubbleOnce` idempotency tests.
 *
 * The wild-boss-slot-revealed / region-boss-slot-revealed / heirloom-drop
 * / destiny-slot-revealed bubbles MUST fire AT MOST ONCE per run. This
 * suite asserts the gating primitive on the game store behaves correctly:
 *
 *   (1) First call surfaces the bubble and appends the id to
 *       `tutorialBubblesFired`.
 *   (2) Second call is a no-op — neither `combatTutorialBubble` nor
 *       `tutorialBubblesFired` changes.
 *
 * Covered ids: the 4 REQ-32 bubbles plus a cross-cut test that proves
 * independence between ids (firing A does not gate B).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { TutorialBubbleId } from '../tutorial/v20';

describe('fireTutorialBubbleOnce — REQ-32 idempotency (u-9e)', () => {
  beforeEach(() => {
    // Fresh 2-player init resets tutorialBubblesFired to [] and the
    // bubble slot to null. No champion-dependent behaviour is exercised
    // below; any valid setup suffices.
    useGameStore.getState().initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['P1', 'P2'],
    });
  });

  const slotBubbleIds: readonly TutorialBubbleId[] = [
    'wild-boss-slot-revealed',
    'region-boss-slot-revealed',
    'heirloom-drop',
    'destiny-slot-revealed',
  ];

  for (const id of slotBubbleIds) {
    it(`'${id}' fires on first call — surfaces bubble + appends to tutorialBubblesFired`, () => {
      const before = useGameStore.getState();
      expect(before.tutorialBubblesFired).not.toContain(id);
      expect(before.combatTutorialBubble).toBeNull();

      useGameStore.getState().fireTutorialBubbleOnce(id);

      const after = useGameStore.getState();
      expect(after.combatTutorialBubble).toBe(id);
      expect(after.tutorialBubblesFired).toContain(id);
    });

    it(`'${id}' is idempotent — second call is a no-op`, () => {
      useGameStore.getState().fireTutorialBubbleOnce(id);
      // Dismiss the overlay so the second attempt has a clean slot
      // to race against — proves the gate is on `tutorialBubblesFired`,
      // not on whether the overlay happens to be showing.
      useGameStore.getState().clearCombatTutorialBubble();

      const afterDismiss = useGameStore.getState();
      expect(afterDismiss.combatTutorialBubble).toBeNull();
      expect(afterDismiss.tutorialBubblesFired).toContain(id);
      const firedBefore = afterDismiss.tutorialBubblesFired;

      useGameStore.getState().fireTutorialBubbleOnce(id);

      const afterSecond = useGameStore.getState();
      // Bubble slot should still be null — second fire was suppressed.
      expect(afterSecond.combatTutorialBubble).toBeNull();
      // tutorialBubblesFired should have exactly the same contents (no
      // duplicate append).
      expect(afterSecond.tutorialBubblesFired).toEqual(firedBefore);
    });
  }

  it('firing bubble A does not gate bubble B (per-id idempotency, not global)', () => {
    useGameStore.getState().fireTutorialBubbleOnce('wild-boss-slot-revealed');
    useGameStore.getState().clearCombatTutorialBubble();
    useGameStore.getState().fireTutorialBubbleOnce('region-boss-slot-revealed');

    const s = useGameStore.getState();
    expect(s.combatTutorialBubble).toBe('region-boss-slot-revealed');
    expect(s.tutorialBubblesFired).toContain('wild-boss-slot-revealed');
    expect(s.tutorialBubblesFired).toContain('region-boss-slot-revealed');
  });

  it('bodyOverride is plumbed through to tutorialBubbleBodyOverride on fire', () => {
    useGameStore.getState().fireTutorialBubbleOnce('heirloom-drop', 'You got the Craghorn Tusk!');

    const s = useGameStore.getState();
    expect(s.combatTutorialBubble).toBe('heirloom-drop');
    expect(s.tutorialBubbleBodyOverride).toBe('You got the Craghorn Tusk!');
  });

  it('clearCombatTutorialBubble also clears tutorialBubbleBodyOverride', () => {
    useGameStore.getState().fireTutorialBubbleOnce('heirloom-drop', 'You got the Craghorn Tusk!');
    useGameStore.getState().clearCombatTutorialBubble();

    const s = useGameStore.getState();
    expect(s.combatTutorialBubble).toBeNull();
    expect(s.tutorialBubbleBodyOverride).toBeNull();
  });

  it('initGame resets tutorialBubblesFired to []', () => {
    useGameStore.getState().fireTutorialBubbleOnce('wild-boss-slot-revealed');
    useGameStore.getState().initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['P1', 'P2'],
    });

    const s = useGameStore.getState();
    expect(s.tutorialBubblesFired).toEqual([]);
    expect(s.combatTutorialBubble).toBeNull();
    expect(s.tutorialBubbleBodyOverride).toBeNull();
  });
});
