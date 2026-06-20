import type { DragEvent, JSX } from 'react';
import type { Card } from '../types/card';
import CardTemplate from './CardTemplate';
import { effectFor } from './effectText';
import type { ZoomedCardContext } from './Field';

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export interface HandProps {
  readonly cards: readonly Card[];
  readonly onPlay: (cardId: string) => void;
  /** When provided, taps open the card-detail zoom modal instead of
   *  immediately playing the card. The modal then invokes the
   *  onPlay action when the player confirms. Used on touch devices
   *  (landscape mobile). */
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
}

/**
 * Hand renderer using the shared CardTemplate, sized down via the
 * `.hand-card-tile` modifier so a full hand fits in one row at the
 * bottom of the board. Hidden `effect-text-${id}` spans preserve the
 * existing test contract.
 *
 * fsyd (2026-04-26): Hand cards become HTML5-draggable so the player can
 * drag a card onto the InPlay drop-zone gap to play it. Tap-to-play
 * (onClick) stays the unchanged primary affordance for keyboard + touch
 * users (kid-on-iPad). The drag mime is the project-namespaced
 * `application/x-embertide-card-id` so accidental drops from the
 * browser chrome / external drags can't trigger playCard.
 */
export default function Hand({ cards, onPlay, onZoomCard }: HandProps): JSX.Element {
  const handleDragStart =
    (cardId: string) =>
    (e: DragEvent<HTMLButtonElement>): void => {
      e.dataTransfer.setData('application/x-embertide-card-id', cardId);
      e.dataTransfer.effectAllowed = 'move';
    };

  return (
    <div className="hand" data-testid="hand">
      {cards.length === 0 ? (
        <span data-testid="hand-empty" className="hand-empty">
          Empty hand
        </span>
      ) : null}
      {cards.map((card, idx) => {
        const effect = effectFor(card);
        const handleClick = onZoomCard
          ? () =>
              onZoomCard({
                card,
                actionLabel: 'Play',
                action: () => onPlay(card.id),
                disabled: false,
              })
          : () => onPlay(card.id);
        return (
          <button
            key={`${card.id}-${idx}`}
            type="button"
            className="card-tile field-card-tile hand-card-tile tap-target"
            data-testid={`hand-card-${card.id}`}
            data-role={card.role}
            data-touch-target="true"
            style={TOUCH_TARGET_STYLE}
            draggable
            onDragStart={handleDragStart(card.id)}
            onClick={handleClick}
          >
            <CardTemplate card={card} illustrationSize={96} effect={effect} />
            {effect.text ? (
              <span hidden data-testid={`effect-text-${card.id}`}>
                {effect.text}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
