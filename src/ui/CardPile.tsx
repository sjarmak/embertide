import type { JSX } from 'react';

import type { Card } from '../types/card';
import CardTemplate from './CardTemplate';
import { effectFor } from './effectText';

const TILE_TOUCH_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export type CardPileVariant = 'discard' | 'void';

export interface CardPileProps {
  /**
   * Visual chrome family. `discard` paints a cream parchment plate
   * matching the rest of the board's cathedral palette; `void` is the
   * TOTK-gloom backdrop reserved for defeated monsters + banished
   * cards (embertide-g294).
   */
  readonly variant: CardPileVariant;
  /** Short uppercase label rendered above the slot. */
  readonly label: string;
  /** All cards in the pile. The LAST entry is the top, face-up card. */
  readonly cards: readonly Card[];
  /**
   * Test-id root. The wrapper carries this id verbatim; the top tile
   * is `<testId>-top`, the count badge is `<testId>-count`.
   */
  readonly testId: string;
  /**
   * When provided, tapping the pile opens the full-pile viewer showing
   * EVERY card in the pile face-up (not just the top card) — see
   * {@link PileViewerModal}. Wire the GameBoard's pile-viewer opener
   * here. Omit in test fixtures that want a non-interactive snapshot.
   */
  readonly onOpenPile?: () => void;
}

/**
 * Single-card-pile primitive (embertide-lqg6). Renders a cream
 * parchment slot with the topmost card face-up; the count of cards
 * underneath surfaces as a small badge so the kid can see "this is the
 * one I just got, and there are N total in the pile". Empty state shows
 * just the labelled frame so the slot is always visible — no
 * disappearing zone surfaces.
 *
 * Variant-driven so g294 can reuse the same shape for the VOID pane
 * (TOTK-gloom backdrop) without duplicating the layout code.
 */
export default function CardPile({
  variant,
  label,
  cards,
  testId,
  onOpenPile,
}: CardPileProps): JSX.Element {
  const top = cards.length > 0 ? cards[cards.length - 1] : null;
  const count = cards.length;
  const className = `card-pile card-pile-${variant}${top ? '' : ' card-pile-empty'}`;

  if (!top) {
    return (
      <div
        className={className}
        data-testid={testId}
        data-variant={variant}
        data-empty="true"
        aria-label={`${label} pile (empty)`}
      >
        <span className="card-pile-label" data-testid={`${testId}-label`}>
          {label}
        </span>
        <div className="card-pile-empty-frame" aria-hidden="true" />
      </div>
    );
  }

  const effect = effectFor(top);
  const countLabel = `${label} pile (${count} card${count === 1 ? '' : 's'})`;

  return (
    <div
      className={className}
      data-testid={testId}
      data-variant={variant}
      data-count={count}
      aria-label={countLabel}
    >
      <span className="card-pile-label" data-testid={`${testId}-label`}>
        {label}
      </span>
      {onOpenPile ? (
        <button
          type="button"
          className="card-tile field-card-tile hand-card-tile card-pile-tile tap-target"
          data-testid={`${testId}-top`}
          data-touch-target="true"
          style={TILE_TOUCH_STYLE}
          aria-label={`View all cards in ${countLabel}`}
          onClick={onOpenPile}
        >
          <CardTemplate card={top} illustrationSize={96} effect={effect} />
        </button>
      ) : (
        <div
          className="card-tile field-card-tile hand-card-tile card-pile-tile"
          data-testid={`${testId}-top`}
        >
          <CardTemplate card={top} illustrationSize={96} effect={effect} />
        </div>
      )}
      {count > 1 ? (
        <span className="card-pile-count" data-testid={`${testId}-count`}>
          {`×${count}`}
        </span>
      ) : null}
    </div>
  );
}
