import { useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

import type { Card } from '../types/card';
import CardTemplate, { cardDisplayName } from './CardTemplate';
import CardDetailModal from './CardDetailModal';
import { effectFor } from './effectText';

export interface PileViewerModalProps {
  /**
   * Pile label shown in the panel heading (e.g. "Discard", "Void").
   * Drives the dialog's accessible name.
   */
  readonly label: string;
  /**
   * All cards in the pile, in pile order (most-recently-added LAST,
   * matching the CardPile contract). The viewer renders them
   * most-recent-FIRST so the card the player just sent here reads as
   * the first tile — "the one I just got" mental model.
   */
  readonly cards: readonly Card[];
  /** Fired on dismiss (ESC, backdrop tap, close button). */
  readonly onClose: () => void;
}

/**
 * embertide-vj6s / k64i: full-pile viewer. Tapping a discard / void
 * pile opens this overlay showing EVERY card in the pile — not just the
 * top card. Each tile renders ART-FORWARD (the illustration dominates,
 * the rules text is clamped to a short teaser; see `.pile-viewer-cell`
 * in app.css) so the pile reads as a row of pictures, not a wall of text.
 * Tapping a tile expands it to the full card detail via {@link
 * CardDetailModal} (read-only — there is no action to take on a pile card).
 *
 * Pattern mirrors {@link CardDetailModal} / {@link CardSelectionModal}:
 * portal-based overlay with role=dialog, ESC handler, backdrop tap to
 * dismiss. Reuses CardTemplate so each tile matches the board affordance.
 */
export default function PileViewerModal({
  label,
  cards,
  onClose,
}: PileViewerModalProps): JSX.Element {
  // k64i: tap-to-expand. Holds the card the player is inspecting at full
  // detail; null while the grid is showing. ESC / Close on the detail
  // modal clears this back to the grid (handled by CardDetailModal's own
  // ESC handler + our onClose), so the grid's ESC only fires once the
  // detail modal is dismissed.
  const [expandedCard, setExpandedCard] = useState<Card | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // While a card is expanded its own modal owns ESC; let it close
        // the detail view first rather than collapsing the whole pile.
        if (expandedCard) return;
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, expandedCard]);

  const target =
    typeof document !== 'undefined' ? (document.body ?? document.documentElement) : null;

  // Most-recent-first: pile order is oldest-first / top-last, so reverse
  // a shallow copy for display without mutating the source array.
  const ordered = [...cards].reverse();
  const count = cards.length;
  const title = `${label} (${count} card${count === 1 ? '' : 's'})`;

  const panel = (
    <div
      className="pile-viewer-backdrop"
      data-testid="pile-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="pile-viewer-panel" data-testid="pile-viewer-modal">
        <h2 className="pile-viewer-title">{title}</h2>
        {count === 0 ? (
          <p className="pile-viewer-empty" data-testid="pile-viewer-empty">
            No cards yet.
          </p>
        ) : (
          <ul className="pile-viewer-grid" data-testid="pile-viewer-grid">
            {ordered.map((card) => (
              <li key={card.id} className="pile-viewer-cell">
                <button
                  type="button"
                  className="pile-viewer-card card-tile field-card-tile hand-card-tile"
                  data-testid="pile-viewer-card"
                  aria-label={`Expand ${cardDisplayName(card)}`}
                  onClick={() => setExpandedCard(card)}
                >
                  <CardTemplate card={card} illustrationSize={96} effect={effectFor(card)} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="pile-viewer-close"
          data-testid="pile-viewer-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
      {target ? createPortal(panel, target) : panel}
      {expandedCard ? (
        <CardDetailModal card={expandedCard} onClose={() => setExpandedCard(null)} />
      ) : null}
    </>
  );
}
