import { useEffect, useMemo, useRef, type JSX } from 'react';
import {
  createDwellTracker,
  getBubblesForGame,
  type DwellTracker,
  type TutorialBubble,
  type TutorialGameNumber,
} from '../tutorial/v20';

export interface TutorialProps {
  readonly turn: number;
  readonly seen: boolean;
  readonly onSeen: () => void;
  /**
   * Which of the first three games the player is on. Drives the
   * progressive-disclosure bubble set per REQ-24 (u-4, amendment A9).
   * Defaults to game 1 so callers that have not yet wired a game
   * counter (existing App.tsx integration) still see the co-op-survival
   * arc.
   */
  readonly gameNumber?: TutorialGameNumber;
  /**
   * Optional dwell-time tracker injection point (u-4, amendment A11).
   * When supplied, each bubble shown/dismissed event is logged so a
   * scripted playthrough fixture can assert a ≥3s median dwell. Default
   * is an internal tracker the component owns — exposing it via prop
   * lets tests + analytics bind the same instance.
   */
  readonly dwellTracker?: DwellTracker;
}

/**
 * Map a game-1..3 schedule of fallback turns to v20 bubbles. The v20
 * module carries the trigger + fallbackTurn on each bubble; this helper
 * extracts the deterministic turn-based schedule as a simple lookup.
 */
function scheduledBubbleAtTurn(
  gameNumber: TutorialGameNumber,
  turn: number,
): TutorialBubble | null {
  const bubbles = getBubblesForGame(gameNumber);
  return bubbles.find((b) => b.fallbackTurn === turn) ?? null;
}

/**
 * v2.0 co-op tutorial overlay (u-4, REQ-24 abbreviated, amendment A9/A11).
 *
 * Renders the single v20 bubble scheduled for the current turn within
 * the active game. Progressive-disclosure arc:
 *   - Game 1: hp-downed (turn 1) → revive-prompt (turn 3) →
 *             wisp-on-downed (turn 5).
 *   - Game 2: shared-shards (turn 1) → zone-advance (turn 4).
 *   - Game 3: vurmox-climax (turn 9).
 *
 * Returns null on all other turns or when the player has already marked
 * the tutorial seen. A dismiss button calls `onSeen` so the caller can
 * persist the flag. Dwell-time bookkeeping fires on mount/unmount per
 * bubble so a fixture playthrough can assert the ≥3s median-dwell gate.
 */
export default function Tutorial({
  turn,
  seen,
  onSeen,
  gameNumber = 1,
  dwellTracker,
}: TutorialProps): JSX.Element | null {
  // Own an internal tracker so the component always ticks dwell events,
  // even when no external tracker is injected. useMemo gives us a stable
  // instance across renders.
  const internalTracker = useMemo<DwellTracker>(() => createDwellTracker(), []);
  const effectiveTracker = dwellTracker ?? internalTracker;

  // Track the last-shown bubble id so we can fire dismiss bookkeeping
  // when the bubble unmounts or changes.
  const lastShownRef = useRef<string | null>(null);

  const bubble = !seen ? scheduledBubbleAtTurn(gameNumber, turn) : null;

  useEffect(() => {
    // Transition: close out the previous bubble (if any).
    const prev = lastShownRef.current;
    if (prev !== null && prev !== (bubble?.id ?? null)) {
      effectiveTracker.markDismissed(prev as TutorialBubble['id']);
    }
    // Open the new one.
    if (bubble && prev !== bubble.id) {
      effectiveTracker.markShown(bubble.id);
      lastShownRef.current = bubble.id;
    } else if (!bubble) {
      lastShownRef.current = null;
    }
  }, [bubble, effectiveTracker]);

  if (!bubble) return null;

  const handleDismiss = (): void => {
    effectiveTracker.markDismissed(bubble.id);
    lastShownRef.current = null;
    onSeen();
  };

  return (
    <div className="tutorial-backdrop" data-testid="tutorial-backdrop">
      <div
        role="dialog"
        aria-label="Tutorial"
        data-testid="tutorial-overlay"
        data-turn={turn}
        data-bubble-id={bubble.id}
        data-game={gameNumber}
        className="tutorial-overlay"
      >
        <h2 className="tutorial-title">{bubble.title}</h2>
        <p className="tutorial-body">{bubble.body}</p>
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="tutorial-dismiss"
          className="tutorial-dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
