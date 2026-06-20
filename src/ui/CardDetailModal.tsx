import { useEffect, type JSX } from 'react';
import { createPortal } from 'react-dom';

import type { Card } from '../types/card';
import CardTemplate, { cardDisplayName } from './CardTemplate';
import { effectFor } from './effectText';

export interface CardDetailModalProps {
  /** Card to display in the zoomed view. */
  readonly card: Card;
  /** Visible label on the primary action button (e.g. "Buy", "Play").
   *  Omit (along with `onAction`) for read-only zooms — e.g. inspecting
   *  the top card of the discard pile / void where there is no action
   *  to take. The action button is then unmounted and only the Close
   *  button remains. */
  readonly actionLabel?: string;
  /** Fired when the player taps the action button. The parent is
   *  responsible for unmounting the modal after the action runs.
   *  Omit for read-only zooms (see `actionLabel`). */
  readonly onAction?: () => void;
  /** Fired on dismiss (ESC, backdrop tap, close button). */
  readonly onClose: () => void;
  /** When true the action button is disabled (e.g. unaffordable).
   *  Has no effect when the action button is absent (read-only). */
  readonly disabled?: boolean;
}

/**
 * embertide-gy7n: tap-to-zoom card detail modal for landscape mobile.
 *
 * On phones in landscape, market / hand / chest tiles render at art-only
 * thumbnail size to fit the play area in a single viewport. Tapping any
 * tile opens this modal so the player can read the full card text + cost
 * and confirm the action via the explicit action button.
 *
 * Pattern mirrors {@link CardSelectionModal}: portal-based overlay with
 * role=dialog, ESC handler, backdrop tap to dismiss. Reuses CardTemplate
 * so the rendered card matches the desktop affordance exactly (full
 * effect / combat / rules text).
 */
export default function CardDetailModal({
  card,
  actionLabel,
  onAction,
  onClose,
  disabled = false,
}: CardDetailModalProps): JSX.Element {
  const hasAction = actionLabel !== undefined && onAction !== undefined;
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const target =
    typeof document !== 'undefined' ? (document.body ?? document.documentElement) : null;

  const effect = effectFor(card);

  const panel = (
    <div
      className="card-detail-backdrop"
      data-testid="card-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${cardDisplayName(card)} detail`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="card-detail-panel">
        <div className="card-detail-card">
          <CardTemplate card={card} illustrationSize={240} effect={effect} />
        </div>
        <div className="card-detail-actions">
          {hasAction ? (
            <button
              type="button"
              className="card-detail-action"
              data-testid="card-detail-action"
              onClick={onAction}
              disabled={disabled}
            >
              {actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="card-detail-cancel"
            data-testid="card-detail-cancel"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return target ? createPortal(panel, target) : panel;
}
