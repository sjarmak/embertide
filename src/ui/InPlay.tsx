import { useState, type DragEvent, type JSX } from 'react';
import type { Card } from '../types/card';
import CardTemplate from './CardTemplate';
import { useDropHintStore } from '../store/dropHintStore';

const TILE_TOUCH_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export interface InPlayProps {
  /** Cards played by the active player this turn. */
  readonly cards: readonly Card[];
  /**
   * Fires when a Hand card is dragged onto the drop-zone gap (fsyd
   * sub-ask 7). The handler dispatches `playCard` in the store. Optional
   * — components without DnD wiring (tests, snapshot fixtures) render
   * without the drag-drop affordance and rely on tap-to-play in Hand.
   */
  readonly onDropPlayCard?: (cardId: string) => void;
}

/**
 * Face-up "in play" zone (embertide-7c1). Shows every card the active
 * player has played this turn before `endTurn` flushes them to discard.
 * Tiles are read-only (same look as Hand tiles but not clickable) so the
 * player can see what they did without being able to re-trigger effects.
 *
 * fsyd (2026-04-26): the empty state is no longer "Nothing played yet"
 * placeholder text — it's a 64px-tall dashed-border drop-zone surface.
 * Hand cards are HTML5-draggable and dropping on this zone dispatches
 * `playCard`. The drop-zone shares the surface with the in-play tiles —
 * once cards have been played this turn they tile across the same band,
 * replacing the drop hint.
 *
 * Tap-to-play (Hand.tsx onClick) is the unchanged primary affordance and
 * works on touch + keyboard; HTML5 DnD is the secondary mouse-only
 * affordance. Pointer-events touch DnD is deferred (open question
 * pending designer ratification — see playarea-layout.md §7).
 */
export default function InPlay({ cards, onDropPlayCard }: InPlayProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const hintSeen = useDropHintStore((s) => s.seen);
  const markHintSeen = useDropHintStore((s) => s.markSeen);

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    if (!onDropPlayCard) return;
    if (e.dataTransfer.types.includes('application/x-embertide-card-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragOver) setDragOver(true);
    }
  };

  const handleDragLeave = (): void => {
    if (dragOver) setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    if (!onDropPlayCard) return;
    const cardId = e.dataTransfer.getData('application/x-embertide-card-id');
    if (cardId) {
      e.preventDefault();
      onDropPlayCard(cardId);
      if (!hintSeen) markHintSeen();
    }
    setDragOver(false);
  };

  const isEmpty = cards.length === 0;
  const showFirstRunHint = isEmpty && !hintSeen;

  return (
    <div
      className={`in-play${isEmpty ? ' in-play-empty-zone' : ''}${dragOver ? ' in-play-drag-over' : ''}`}
      data-testid="in-play"
      data-drop-active={dragOver ? 'true' : 'false'}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isEmpty ? (
        <div
          data-testid="drop-zone-empty"
          data-first-run={showFirstRunHint ? 'true' : 'false'}
          className={`drop-zone-empty${showFirstRunHint ? ' drop-zone-first-run' : ''}`}
          aria-hidden="true"
        >
          {showFirstRunHint ? (
            <span className="drop-zone-empty-label">Drag a card here to play it</span>
          ) : null}
        </div>
      ) : null}
      {cards.map((card, idx) => (
        <div
          key={`${card.id}-${idx}`}
          className="card-tile field-card-tile hand-card-tile in-play-tile"
          data-testid={`in-play-card-${card.id}`}
          data-role={card.role}
          style={TILE_TOUCH_STYLE}
        >
          <CardTemplate card={card} illustrationSize={96} />
        </div>
      ))}
    </div>
  );
}
