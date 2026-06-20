import type { JSX } from 'react';

import type { Card } from '../types/card';
import CardPile from './CardPile';

export interface VoidPaneProps {
  /**
   * Shared `state.voided` array (most-recently-voided card last). Holds
   * defeated monsters AND banished cards across both players — see
   * KidGameState.voided for the append contract (embertide-g294).
   */
  readonly cards: readonly Card[];
  /** Tap-to-open full-pile viewer. See {@link CardPile} for semantics. */
  readonly onOpenPile?: () => void;
}

/**
 * Visible-Void pane (embertide-g294). Sibling to {@link DiscardPile}
 * in the trays-row pile column. Surfaces the topmost voided card face-up
 * over a TOTK-gloom backdrop so the kid can SEE that the monster they
 * just killed (or the card they just banished) is GONE — distinct from
 * the discard parchment plate next to it.
 *
 * Thin wrapper over {@link CardPile} variant=void; the gloom raster is
 * applied via the `.card-pile-void` class in app.css.
 */
export default function VoidPane({ cards, onOpenPile }: VoidPaneProps): JSX.Element {
  return (
    <CardPile
      variant="void"
      label="Void"
      cards={cards}
      testId="void-pane"
      onOpenPile={onOpenPile}
    />
  );
}
