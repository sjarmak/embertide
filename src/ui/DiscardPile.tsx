import type { JSX } from 'react';

import type { Card } from '../types/card';
import CardPile from './CardPile';

export interface DiscardPileProps {
  /** Active player's discard pile (most-recently-acquired card last). */
  readonly cards: readonly Card[];
  /** Tap-to-open full-pile viewer. See {@link CardPile} for semantics. */
  readonly onOpenPile?: () => void;
}

/**
 * Visible-discard pane (embertide-lqg6). Surfaces the topmost card
 * of the active player's discard pile face-up so the kid can SEE what
 * they just bought / claimed / played without opening a menu.
 *
 * Thin wrapper over {@link CardPile} so the void pane (g294) can reuse
 * the same single-slot shape with a different chrome variant.
 */
export default function DiscardPile({ cards, onOpenPile }: DiscardPileProps): JSX.Element {
  return (
    <CardPile
      variant="discard"
      label="Discard"
      cards={cards}
      testId="discard-pile"
      onOpenPile={onOpenPile}
    />
  );
}
