import type { JSX } from 'react';
import type { Card } from '../types/card';
import CardTemplate from './CardTemplate';
import { effectFor } from './effectText';
import './CombatHand.css';

/**
 * Illustration size inside CardTemplate for combat-hand tiles. Matches the
 * main-board Hand.tsx sizing so the same card face reads consistently
 * across the main board and the combat surface (embertide-3d5).
 */
const COMBAT_HAND_ILLUSTRATION_SIZE = 96;

export interface CombatHandProps {
  readonly cards: readonly Card[];
  /**
   * Called with the tapped card's id. CombatScreen wraps this into a
   * `{ type: 'PLAYER_PLAY_CARD', cardId }` dispatch.
   */
  readonly onPlayCard: (cardId: string) => void;
}

/**
 * CombatHand — tap-to-play shared combat hand rendered with the shared
 * CardTemplate component, matching the main-board Hand.tsx pattern. Each
 * card surfaces its full stained-glass face (frame + illustration + cost
 * + printed effect text) inside a 44×44-minimum tap target.
 *
 * embertide-3d5 (nz8-b): replaces the previous custom-styled button
 * layout (56px icon + one-line combat summary) with CardTemplate so
 * combat cards read as real cards rather than button tiles. Pure
 * presentational: `onPlayCard(cardId)` is invoked on click; the parent
 * (CombatScreen) packages the cardId into the `PLAYER_PLAY_CARD` action
 * and dispatches it.
 */
export default function CombatHand({ cards, onPlayCard }: CombatHandProps): JSX.Element {
  return (
    <div data-testid="combat-hand" data-ornate-frame="true" className="combat-hand">
      {cards.length === 0 ? (
        <span data-testid="combat-hand-empty" className="combat-hand-empty">
          Empty hand
        </span>
      ) : null}
      {cards.map((card, idx) => {
        // Duplicates of the same card id are legitimate in a combat
        // hand (buildStarterDeck pushes 7 references to the same
        // STARTER_GREEN object). Use positional key + slot-indexed
        // testid so React reconciles cleanly and Playwright can
        // target each slot uniquely.
        const effect = effectFor(card);
        return (
          <button
            key={`slot-${idx}-${card.id}`}
            type="button"
            className="card-tile field-card-tile hand-card-tile combat-hand-card-tile tap-target"
            data-testid={`combat-hand-slot-${idx}`}
            data-card-id={card.id}
            data-role={card.role}
            data-touch-target="true"
            onClick={() => onPlayCard(card.id)}
          >
            <CardTemplate
              card={card}
              illustrationSize={COMBAT_HAND_ILLUSTRATION_SIZE}
              effect={effect}
            />
          </button>
        );
      })}
    </div>
  );
}
