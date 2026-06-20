import { useEffect, type JSX } from 'react';
import { createPortal } from 'react-dom';

import type { Card } from '../types/card';
import { cardDisplayName } from './CardTemplate';

export interface CardSelectionModalProps {
  /**
   * Choosable card set rendered as tap-targets. Empty arrays are
   * permitted (the modal renders a "no cards" hint) but callers should
   * usually short-circuit upstream so the modal never mounts in that
   * state.
   */
  readonly cards: readonly Card[];
  /**
   * Fired with the chosen card's id. The parent is responsible for
   * dispatching the actual mutation (e.g. `banishFromHand`) and
   * unmounting the modal.
   */
  readonly onSelect: (cardId: string) => void;
  /**
   * Fired on dismiss (ESC, backdrop tap). The parent clears the
   * pending choice surface; no card is banished.
   */
  readonly onCancel: () => void;
  /**
   * Optional headline shown at the top of the panel. Defaults to
   * "Choose a card to banish" — the only consumer in embertide-91p
   * (b) is the banish prompt.
   */
  readonly title?: string;
}

const DEFAULT_TITLE = 'Choose a card to banish';

/**
 * Generic per-card selection prompt (embertide-91p, commit b).
 *
 * Mirrors the structural pattern of {@link ChestReveal} (portal-based
 * full-screen overlay, click-to-dismiss) but renders a tappable list
 * of cards rather than an animated reward. Used today by the
 * banish-from-hand resolution path; the props are intentionally
 * generic so future "choose a card" surfaces (return-from-banish,
 * discard-pile sift, etc.) can reuse the same component.
 *
 * Accessibility:
 *   - The backdrop carries role="dialog" + aria-modal so assistive tech
 *     announces the focus trap.
 *   - ESC fires `onCancel` so keyboard users have a parity escape with
 *     the backdrop tap.
 *   - Each card tap-target is a real <button> with an accessible name
 *     derived from `cardDisplayName(card)`.
 */
export default function CardSelectionModal({
  cards,
  onSelect,
  onCancel,
  title = DEFAULT_TITLE,
}: CardSelectionModalProps): JSX.Element {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const target =
    typeof document !== 'undefined' ? (document.body ?? document.documentElement) : null;

  const panel = (
    <div
      className="card-selection-backdrop"
      data-testid="card-selection-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        // Backdrop-only click cancels; clicks bubbling up from the
        // panel itself stop at the inner handler.
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="card-selection-panel"
        data-testid="card-selection-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="card-selection-title">{title}</h2>
        {cards.length === 0 ? (
          <p className="card-selection-empty" data-testid="card-selection-empty">
            No cards available.
          </p>
        ) : (
          <ul className="card-selection-list">
            {cards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="card-selection-card"
                  data-testid={`card-selection-card-${card.id}`}
                  onClick={() => onSelect(card.id)}
                >
                  {cardDisplayName(card)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="card-selection-cancel"
          data-testid="card-selection-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  // Portal to document.body for the same reason ChestReveal portals —
  // a full-screen `position: fixed` overlay must escape ancestor
  // transform/filter contexts to anchor against the viewport.
  if (target === null) return panel;
  return createPortal(panel, target);
}
