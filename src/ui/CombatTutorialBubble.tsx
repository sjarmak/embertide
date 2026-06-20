import type { JSX } from 'react';
import { useGameStore } from '../store/gameStore';
import { getBubbleById } from '../tutorial/v20';

/**
 * CombatTutorialBubble — v2.1 combat-layer tutorial overlay (u-8g, PRD
 * §B8). Renders the bubble whose id currently sits on
 * `state.combatTutorialBubble`, reusing the same visual shell as the
 * v2.0 `Tutorial.tsx` overlay (shared CSS classes) but keyed on an
 * event-driven store field rather than the turn-based schedule.
 *
 * Lives alongside <CombatScreen /> (mounted in GameBoard) because the
 * win / loss bubbles need to survive the `activeCombat → null`
 * transition that unmounts CombatScreen. Returns `null` when no bubble
 * is pending.
 */
export default function CombatTutorialBubble(): JSX.Element | null {
  const bubbleId = useGameStore((s) => s.combatTutorialBubble);
  const bodyOverride = useGameStore((s) => s.tutorialBubbleBodyOverride);
  const clearBubble = useGameStore((s) => s.clearCombatTutorialBubble);
  if (bubbleId === null) return null;
  const bubble = getBubbleById(bubbleId);
  if (!bubble) return null;
  // u-9e: runtime-templated bodies (e.g. heirloom-drop embeds the
  // heirloom's display name). When `tutorialBubbleBodyOverride` is set,
  // it replaces `bubble.body`; the title always comes from the
  // declaration.
  const body = bodyOverride ?? bubble.body;
  return (
    <div className="tutorial-backdrop" data-testid="combat-tutorial-backdrop">
      <div
        role="dialog"
        aria-label="Combat tutorial"
        data-testid="combat-tutorial-overlay"
        data-bubble-id={bubble.id}
        className="tutorial-overlay"
      >
        <h2 className="tutorial-title">{bubble.title}</h2>
        <p className="tutorial-body">{body}</p>
        <button
          type="button"
          onClick={clearBubble}
          data-testid="combat-tutorial-dismiss"
          data-touch-target="true"
          className="tutorial-dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
