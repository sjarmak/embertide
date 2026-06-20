import { useState, type JSX } from 'react';
import type { Card } from '../types/card';
import ItemCell from './ItemCell';

export interface ItemsBagChipProps {
  /** The owning player's persistent items zone (REQ-4 / u-2d). */
  readonly cards: readonly Card[];
  /**
   * 35rv (2026-04-26): each PlayerTray renders its own ItemsBagChip
   * scoped to that player's items, so the testids must disambiguate
   * across multiple chip instances. When `playerId` is provided the
   * chip exposes `items-bag-{playerId}` / `items-bag-chip-{playerId}` /
   * etc. Pre-35rv usage (a single shared chip in the trays band)
   * defaults to bare `items-bag` testids.
   */
  readonly playerId?: string;
  /**
   * 35rv: only the active player's chip is interactive — non-active
   * trays render the chip as a read-only count badge so the player-pane
   * grid stays consistent across seats. Defaults to true to preserve the
   * pre-35rv single-chip behaviour.
   */
  readonly interactive?: boolean;
  /**
   * Id of the currently-downed teammate, or `null` when no teammate is
   * downed. Forwarded to the wisp cell's tap-to-use button inside the
   * popover. Only meaningful for the active-player chip.
   */
  readonly downedTeammateId?: string | null;
  /** Tap-to-use dispatcher for the wisp. */
  readonly onPlayWisp?: (teammateId: string) => void;
}

/**
 * fsyd sub-ask 8 (2026-04-26): items "bag" chip that lives in the
 * .trays band between the active player's tray and the End-Turn
 * button. Default state is collapsed: a single parchment chip with a
 * bag SVG icon + a plain count label. Tap → expands UPWARD as a
 * popover floating above the tray band, showing one ItemCell per
 * earned item (no fixed slot grid).
 *
 * embertide-nmmc (2026-04-26): the legacy ITEM_CAP=3 cap is
 * gone — the chip no longer renders `count/3` and the popover wraps
 * however many items the player owns. Empty popover renders a single
 * placeholder cell so the chip's tap target still has visible
 * feedback at zero items.
 *
 * Open/closed state is local to this component so it scopes to the
 * active player only.
 */
export default function ItemsBagChip({
  cards,
  playerId,
  interactive = true,
  downedTeammateId,
  onPlayWisp,
}: ItemsBagChipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const count = cards.length;
  const toggle = (): void => {
    if (!interactive) return;
    setOpen((prev) => !prev);
  };
  const showOpen = interactive && open;
  const idSuffix = playerId ? `-${playerId}` : '';

  return (
    <div
      className="items-bag"
      data-testid={`items-bag${idSuffix}`}
      data-open={showOpen ? 'true' : 'false'}
      data-interactive={interactive ? 'true' : 'false'}
    >
      <button
        type="button"
        className="items-bag-chip"
        data-testid={`items-bag-chip${idSuffix}`}
        data-touch-target="true"
        aria-expanded={showOpen}
        aria-label={`Items bag, ${count} ${count === 1 ? 'item' : 'items'}`}
        title={
          interactive
            ? showOpen
              ? 'Close items bag'
              : 'Open items bag'
            : 'Items bag (active player only)'
        }
        disabled={!interactive}
        onClick={toggle}
      >
        <svg
          className="items-bag-chip-icon"
          viewBox="0 0 24 24"
          width={20}
          height={20}
          aria-hidden="true"
          focusable="false"
        >
          {/* Simple cinched-bag silhouette: rounded body + neck pinch + draw cord. */}
          <path
            d="M5 11 C5 7.5 8 6 12 6 C16 6 19 7.5 19 11 L19 18 C19 20 17 21.5 12 21.5 C7 21.5 5 20 5 18 Z"
            fill="var(--hc-parchment-100, #f4ebd3)"
            stroke="var(--hc-lead-gold-700, #8b6a2a)"
            strokeWidth="1.4"
          />
          <path
            d="M9 6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6"
            fill="none"
            stroke="var(--hc-lead-gold-700, #8b6a2a)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M7 10 H17"
            stroke="var(--hc-lead-gold-700, #8b6a2a)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        <span className="items-bag-chip-label">Items</span>
        <span className="items-bag-chip-count" data-testid={`items-bag-chip-count${idSuffix}`}>
          {count}
        </span>
      </button>
      {showOpen ? (
        <div
          className="items-bag-popover"
          data-testid={`items-bag-popover${idSuffix}`}
          role="dialog"
          aria-label="Items"
        >
          <div className="items-bag-popover-grid">
            {count === 0 ? (
              <div
                className="items-bag-popover-empty-slot"
                data-testid={`items-bag-empty-slot-0${idSuffix}`}
                aria-hidden="true"
              />
            ) : (
              cards.map((card) => (
                <ItemCell
                  key={card.id}
                  card={card}
                  downedTeammateId={downedTeammateId}
                  onPlayWisp={onPlayWisp}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
