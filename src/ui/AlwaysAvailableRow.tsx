import type { JSX } from 'react';
import { ALWAYS_AVAILABLE, KEY_VENDOR_ID, VENDORS } from '../data/cards';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import type { Card } from '../types/card';
import { cardArtForCard } from './CardArt';
import { cardDisplayName } from './CardTemplate';
import type { ZoomedCardContext } from './Field';
import { Magnifier } from '../icons';

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export interface AlwaysAvailableRowProps {
  /** Current player's green shards — disables heroes the player cannot afford. */
  readonly green: number;
  /** Current player's red power — disables wild-wolf fight when short on power. */
  readonly red: number;
  /**
   * Whether the active player has already traded with a key-vendor this
   * seat-turn (5y13 knob 2). When true, Pell's tile disables — clicking
   * post-cap previously fired the reducer throw at gameStore.ts:2595 and
   * surfaced as a pageerror.
   */
  readonly usedKeyVendorThisTurn: boolean;
  /** Buy an always-available hero (mystic / militia-grunt). */
  readonly onBuy: (baseId: string) => void;
  /** Fight an always-available monster (wild-wolf). */
  readonly onFight: (baseId: string) => void;
  /**
   * Trade with a vendor service (embertide-1eby). Today only Pell
   * (`key-vendor`) routes here — pays green directly for keys with no
   * card mint, no draw cycle. The id parameter is forward-compatible
   * for additional vendors.
   */
  readonly onTrade: (vendorId: string) => void;
  /**
   * uwg5 (2026-04-26): when the parent AlwaysRowStrip is collapsed,
   * render each card as a 44px parchment chip (icon glyph + cost only)
   * instead of the full CardTemplate. Click semantics + disabled
   * states are preserved.
   */
  readonly compact?: boolean;
  /**
   * round2 (player layout pass): when provided, a tap on an expanded
   * top-row card opens the shared CardDetailModal (full rules text +
   * confirm button) instead of firing the buy/fight/trade immediately.
   *
   * The expanded top-row tiles render a NAME + IMAGE face only — the
   * cramped, clipped rules text that the player flagged is gone. The
   * full rules live in the zoom modal, one tap away. When omitted the
   * row falls back to direct-dispatch clicks (tests / non-board hosts).
   *
   * Has no effect in `compact` mode (the collapsed chip strip keeps its
   * own direct-dispatch behavior).
   */
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
}

/**
 * Always Available row (§12 / embertide-9yu). Renders three buyable/
 * defeatable templates plus any vendor services (embertide-1eby) so
 * the player always has a fallback play when the field is tapped out.
 * Buttons disable when the active player cannot pay the listed cost.
 */
// Short-form labels for the compact chip strip (uwg5). The full
// names from GENERIC_BASE_ID_THEME (`Elysian Soldier`, `Oracle`,
// `Scrabling`, `Pell`) overflow the chip footprint at 9px Cinzel; the
// chips need to fit in a 44px collapsed band. These are intentionally
// terse — the full name is available the moment the player expands.
const COMPACT_CHIP_LABEL: Record<string, string> = {
  mystic: 'Oracle',
  'militia-grunt': 'Soldier',
  'wild-wolf': 'Scrab',
  'key-vendor': 'Pell',
};

function chipLabel(baseId: string): string {
  const compact = COMPACT_CHIP_LABEL[baseId];
  if (compact) return compact;
  const themed = GENERIC_BASE_ID_THEME[baseId];
  if (themed) return themed;
  return baseId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AlwaysAvailableRow({
  green,
  red,
  usedKeyVendorThisTurn,
  onBuy,
  onFight,
  onTrade,
  compact = false,
  onZoomCard,
}: AlwaysAvailableRowProps): JSX.Element {
  // 2026-06-20 player ruling: a direct tap on a top-row tile performs the
  // buy / fight / trade IMMEDIATELY — it no longer opens the detail modal
  // first (the round2 tap-to-expand read as a speed bump). Full rules stay
  // one tap away via the corner magnifier button, which opens the shared
  // CardDetailModal (onZoomCard). Unaffordable tiles disable the action
  // button (native gate) while the magnifier stays live so the player can
  // still read the card. Compact chips keep their own direct dispatch.
  return (
    <div
      className="always-available-row"
      data-testid="always-available-row"
      data-compact={compact ? 'true' : 'false'}
    >
      {ALWAYS_AVAILABLE.map((card) => {
        const isMonster = card.role === 'monster';
        const greenCost = card.cost.green ?? 0;
        const redCost = card.cost.red ?? 0;
        const disabled = isMonster ? red < redCost : green < greenCost;
        const cost = isMonster ? `${redCost}r` : `${greenCost}g`;
        const performAction = (): void => {
          if (isMonster) onFight(card.id);
          else onBuy(card.id);
        };

        if (compact) {
          return (
            <button
              key={card.id}
              type="button"
              className="always-available-chip"
              data-testid={`always-available-${card.id}`}
              data-role={card.role}
              data-touch-target="true"
              data-affordable={disabled ? 'false' : 'true'}
              style={TOUCH_TARGET_STYLE}
              disabled={disabled}
              onClick={performAction}
            >
              <ChipFace label={chipLabel(card.id)} cost={cost} />
            </button>
          );
        }

        return (
          <ExpandedTile
            key={card.id}
            card={card}
            cost={cost}
            cardRole={card.role}
            disabled={disabled}
            performAction={performAction}
            actionLabel={isMonster ? 'Fight' : 'Buy'}
            onZoomCard={onZoomCard}
          />
        );
      })}
      {VENDORS.map((card) => {
        const greenCost = card.cost.green ?? 0;
        const isKeyVendor = card.id === KEY_VENDOR_ID;
        const disabled = green < greenCost || (isKeyVendor && usedKeyVendorThisTurn);
        const cost = `${greenCost}g`;
        const performAction = (): void => {
          if (isKeyVendor) onTrade(card.id);
        };

        if (compact) {
          return (
            <button
              key={card.id}
              type="button"
              className="always-available-chip vendor-chip"
              data-testid={`always-available-${card.id}`}
              data-role="vendor"
              data-touch-target="true"
              data-affordable={disabled ? 'false' : 'true'}
              style={TOUCH_TARGET_STYLE}
              disabled={disabled}
              onClick={performAction}
            >
              <ChipFace label={chipLabel(card.id)} cost={cost} />
            </button>
          );
        }

        return (
          <ExpandedTile
            key={card.id}
            card={card}
            cost={cost}
            cardRole="vendor"
            disabled={disabled}
            performAction={performAction}
            actionLabel="Trade"
            onZoomCard={onZoomCard}
            vendor
          />
        );
      })}
    </div>
  );
}

/**
 * Expanded top-row tile: a direct-action button (buy / fight / trade on tap)
 * paired with a small corner magnifier that opens the full-rules detail
 * modal. The magnifier is the "expand to view" affordance after the primary
 * tap was reclaimed for the action (2026-06-20 player ruling). Rendered as a
 * positioned wrapper so the magnifier sits in the tile's top-right corner
 * without nesting a button inside the action button (invalid HTML). The
 * action button keeps the `always-available-<id>` testid + native disabled
 * gate, so the affordability tests and the playtest harness selectors are
 * unchanged.
 */
function ExpandedTile({
  card,
  cost,
  cardRole,
  disabled,
  performAction,
  actionLabel,
  onZoomCard,
  vendor = false,
}: {
  readonly card: Card;
  readonly cost: string;
  readonly cardRole: string;
  readonly disabled: boolean;
  readonly performAction: () => void;
  readonly actionLabel: string;
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
  readonly vendor?: boolean;
}): JSX.Element {
  const name = cardDisplayName(card);
  const buttonClass = vendor
    ? 'card-tile field-card-tile tap-target always-available-tile vendor-tile'
    : 'card-tile field-card-tile tap-target always-available-tile';
  return (
    <span className="board-tile-wrap">
      <button
        type="button"
        className={buttonClass}
        data-testid={`always-available-${card.id}`}
        data-role={cardRole}
        data-touch-target="true"
        data-affordable={disabled ? 'false' : 'true'}
        style={TOUCH_TARGET_STYLE}
        disabled={disabled}
        aria-label={`${actionLabel} ${name}`}
        onClick={performAction}
      >
        <ExpandedFace card={card} cost={cost} />
      </button>
      {onZoomCard ? (
        <button
          type="button"
          className="board-tile-zoom"
          data-testid={`always-available-${card.id}-zoom`}
          data-touch-target="true"
          style={TOUCH_TARGET_STYLE}
          aria-haspopup="dialog"
          aria-label={`View ${name} details`}
          onClick={() => onZoomCard({ card, actionLabel, action: performAction, disabled })}
        >
          <span className="board-tile-zoom-badge">
            <Magnifier size={16} title="View details" />
          </span>
        </button>
      ) : null}
    </span>
  );
}

/**
 * round2 (player layout pass): expanded top-row card face. NAME + IMAGE
 * only — no rules-text plate. The player flagged the top row's rules
 * text as "cut off in an ugly way" at the compact top-row footprint; the
 * fix drops the cramped text entirely and surfaces the full rules via the
 * click-to-expand zoom modal instead.
 *
 * Art is rendered art-forward (fills the tile) with a thin gold-leaded
 * frame and a bottom name plate, mirroring the cathedral card vocabulary
 * without the clipped effect copy.
 */
const EXPANDED_FACE_ART_SIZE = 120;

function ExpandedFace({ card, cost }: { readonly card: Card; readonly cost: string }): JSX.Element {
  const name = cardDisplayName(card);
  return (
    <span className="always-available-face" aria-hidden="false">
      <span className="always-available-face-art" data-testid="always-available-face-art">
        {/* `slice` (cover) so the square raster fills the portrait art panel
            edge-to-edge — `meet` letterboxed it with parchment bands top +
            bottom (player report). Portrait subjects are centered, so the
            minimal left/right crop slice introduces is unnoticeable. */}
        {cardArtForCard(card, EXPANDED_FACE_ART_SIZE, 'slice')}
        <span className="always-available-face-cost">{cost}</span>
      </span>
      <span className="always-available-face-name">{name}</span>
    </span>
  );
}

/**
 * uwg5 (2026-04-26): chip face used when AlwaysAvailableRow + ChestRow
 * render in compact mode (parent strip collapsed). Cinzel small-cap
 * label + cost glyph on a parchment chip — matches the t78j cathedral
 * surface vocabulary so the strip reads as the same artifact family.
 */
function ChipFace({ label, cost }: { readonly label: string; readonly cost: string }): JSX.Element {
  return (
    <span className="always-available-chip-face" aria-hidden="false">
      <span className="always-available-chip-label">{label}</span>
      <span className="always-available-chip-cost">{cost}</span>
    </span>
  );
}
