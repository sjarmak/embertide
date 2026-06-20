import { useState, type JSX, type ReactNode } from 'react';
import type { Card } from '../types/card';
import type { ChestVariant } from '../rules/chestPool';
import AlwaysAvailableRow from './AlwaysAvailableRow';
import ChestRow from './ChestRow';
import type { ZoomedCardContext } from './Field';

export interface AlwaysRowStripProps {
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly usedKeyVendorThisTurn: boolean;
  readonly chestRow: readonly Card[];
  readonly onBuy: (baseId: string) => void;
  readonly onFight: (baseId: string) => void;
  readonly onTrade: (vendorId: string) => void;
  readonly onOpenChest: (variant: ChestVariant) => void;
  /**
   * Right-rail slot rendered when the strip is expanded. Hosts the full
   * game-state HUD (turn / deck / discard / active player / zone gauges)
   * relocated out of the cathedral title strip so the title bar can
   * shrink. Separated from the chevron by a vertical gold-leading
   * divider so the rail reads as a discrete "stats" cluster.
   */
  readonly statsExpanded?: ReactNode;
  /**
   * Right-rail slot rendered when the strip is collapsed. Reserved for
   * the simple active-player line ("P1 · Hero") so the rail still
   * carries useful info in the 44px chip band.
   */
  readonly statsCollapsed?: ReactNode;
  /**
   * round2: routes expanded top-row card taps through the shared
   * CardDetailModal (name+image tile → full rules on tap). Forwarded to
   * the expanded `AlwaysAvailableRow`; the collapsed chip strip ignores
   * it. Omit to keep direct-dispatch clicks.
   */
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
}

/**
 * embertide-uwg5 (2026-04-26): Always-available + Chest rows
 * collapse into a single full-width top chip strip above the board
 * grid. Replaces the side-rail placement that lived under
 * `.board-side` pre-uwg5. Default state is EXPANDED (per user
 * ratification 2026-04-26: kids need to discover the always-available
 * cards on first sight); the chevron at the right edge toggles to a
 * 44px tall chip strip so the player can reclaim board space mid-game.
 *
 * Open/closed state lives here as local React state — does NOT enter
 * the game store (per spec).
 */
export default function AlwaysRowStrip({
  green,
  red,
  keys,
  usedKeyVendorThisTurn,
  chestRow,
  onBuy,
  onFight,
  onTrade,
  onOpenChest,
  statsExpanded,
  statsCollapsed,
  onZoomCard,
}: AlwaysRowStripProps): JSX.Element {
  // Default-expanded (re-revised 2026-04-26): user direction is "show
  // the cards visible by default but keep them collapsible". The strip
  // renders full CardTemplate tiles on first paint so kids see the
  // always-buyable cards immediately; the chevron collapses to the
  // 44px parchment-chip band when the player wants the field band back.
  const [expanded, setExpanded] = useState(true);

  return (
    <section
      className="always-row-strip"
      data-testid="always-row-strip"
      data-expanded={expanded ? 'true' : 'false'}
      aria-label="Always available cards"
    >
      <div className="always-row-strip-body">
        {expanded ? (
          <>
            <AlwaysAvailableRow
              green={green}
              red={red}
              usedKeyVendorThisTurn={usedKeyVendorThisTurn}
              onBuy={onBuy}
              onFight={onFight}
              onTrade={onTrade}
              onZoomCard={onZoomCard}
            />
            <ChestRow cards={chestRow} keys={keys} onOpenChest={onOpenChest} />
          </>
        ) : (
          <>
            <AlwaysAvailableRow
              green={green}
              red={red}
              usedKeyVendorThisTurn={usedKeyVendorThisTurn}
              onBuy={onBuy}
              onFight={onFight}
              onTrade={onTrade}
              compact
            />
            <ChestRow cards={chestRow} keys={keys} onOpenChest={onOpenChest} compact />
          </>
        )}
      </div>
      {(expanded ? statsExpanded : statsCollapsed) ? (
        <div
          className="always-row-strip-rail"
          data-testid="always-row-strip-rail"
          aria-label="Active player stats"
        >
          {expanded ? statsExpanded : statsCollapsed}
        </div>
      ) : null}
      <button
        type="button"
        className="always-row-strip-chevron"
        data-testid="always-row-strip-chevron"
        data-touch-target="true"
        aria-expanded={expanded}
        aria-controls="always-row-strip-body"
        title={expanded ? 'Collapse always-available cards' : 'Expand always-available cards'}
        style={{ minWidth: 44, minHeight: 44 }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <svg
          viewBox="0 0 16 16"
          width={14}
          height={14}
          aria-hidden="true"
          focusable="false"
          style={{
            transition: 'transform 200ms ease-out',
            transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          <path
            d="M3 6 L8 11 L13 6"
            fill="none"
            stroke="var(--hc-lead-iron-900, #0e0c14)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </section>
  );
}
