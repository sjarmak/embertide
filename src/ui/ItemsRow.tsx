import type { JSX } from 'react';
import type { Card } from '../types/card';
import ItemCell from './ItemCell';

export interface ItemsRowProps {
  /** The active player's persistent Items zone (REQ-4 / u-2d). */
  readonly cards: readonly Card[];
  /**
   * Id of the currently-downed teammate, or `null` when no teammate is
   * downed. Forwarded to the wisp cell's tap-to-use button.
   */
  readonly downedTeammateId?: string | null;
  /**
   * Tap-to-use dispatcher for the wisp. Forwarded to the wisp cell;
   * non-wisp cells ignore it. See `ItemCell` for the full contract.
   */
  readonly onPlayFairy?: (teammateId: string) => void;
}

/**
 * Persistent Items zone (REQ-4 / amendment A6, u-2d — renamed from the
 * v1 Constructs zone). Renders each item as a small tile so the player
 * can see every start-of-turn trigger they own + the wisp's
 * tap-to-use affordance. Empty when the player has no items.
 *
 * Unbounded per embertide-nmmc (2026-04-26); this component
 * iterates whatever slice it's given.
 */
export default function ItemsRow({
  cards,
  downedTeammateId,
  onPlayFairy,
}: ItemsRowProps): JSX.Element {
  return (
    <div className="items-row" data-testid="items-row">
      {cards.length === 0 ? (
        <span className="items-row-empty" data-testid="items-row-empty">
          No items yet
        </span>
      ) : null}
      {cards.map((card) => (
        <ItemCell
          key={card.id}
          card={card}
          downedTeammateId={downedTeammateId}
          onPlayFairy={onPlayFairy}
        />
      ))}
    </div>
  );
}
