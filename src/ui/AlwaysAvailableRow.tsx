import type { JSX } from 'react';
import { ALWAYS_AVAILABLE, KEY_VENDOR_ID, VENDORS } from '../data/cards';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import type { Card } from '../types/card';
import { cardArtForCard } from './CardArt';
import { cardDisplayName } from './CardTemplate';
import type { ZoomedCardContext } from './Field';

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
  // round2: expanded top-row tiles are now NAME + IMAGE only; the click
  // opens the shared zoom modal for the full rules. Route through the
  // modal only in expanded mode (the collapsed chip strip keeps direct
  // dispatch). When no zoom handler is wired, fall back to direct
  // dispatch so non-board hosts + unit tests keep working.
  const useZoom = !compact && typeof onZoomCard === 'function';
  const tileClass = compact
    ? 'always-available-chip'
    : 'card-tile field-card-tile tap-target always-available-tile';
  const vendorClass = compact
    ? 'always-available-chip vendor-chip'
    : 'card-tile field-card-tile tap-target always-available-tile vendor-tile';

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

        const performAction = (): void => {
          if (isMonster) {
            onFight(card.id);
          } else {
            onBuy(card.id);
          }
        };

        const handleClick = useZoom
          ? () =>
              onZoomCard?.({
                card,
                actionLabel: isMonster ? 'Fight' : 'Buy',
                action: performAction,
                disabled,
              })
          : performAction;

        return (
          <button
            key={card.id}
            type="button"
            className={tileClass}
            data-testid={`always-available-${card.id}`}
            data-role={card.role}
            data-touch-target="true"
            data-affordable={disabled ? 'false' : 'true'}
            style={TOUCH_TARGET_STYLE}
            // In zoom mode the tile is always clickable so the player can
            // OPEN the card to read its rules even when they can't yet
            // afford it; the affordability gate lives on the modal's action
            // button (`disabled` passed into the zoom ctx). Direct-dispatch
            // fallback keeps the native disabled gate.
            disabled={useZoom ? false : disabled}
            aria-haspopup={useZoom ? 'dialog' : undefined}
            onClick={handleClick}
          >
            {compact ? (
              <ChipFace
                label={chipLabel(card.id)}
                cost={isMonster ? `${redCost}r` : `${greenCost}g`}
              />
            ) : (
              <ExpandedFace card={card} cost={isMonster ? `${redCost}r` : `${greenCost}g`} />
            )}
          </button>
        );
      })}
      {VENDORS.map((card) => {
        const greenCost = card.cost.green ?? 0;
        const isKeyVendor = card.id === KEY_VENDOR_ID;
        const disabled = green < greenCost || (isKeyVendor && usedKeyVendorThisTurn);
        const performAction = (): void => {
          if (isKeyVendor) {
            onTrade(card.id);
          }
        };
        const handleClick = useZoom
          ? () =>
              onZoomCard?.({
                card,
                actionLabel: 'Trade',
                action: performAction,
                disabled,
              })
          : performAction;
        return (
          <button
            key={card.id}
            type="button"
            className={vendorClass}
            data-testid={`always-available-${card.id}`}
            data-role="vendor"
            data-touch-target="true"
            data-affordable={disabled ? 'false' : 'true'}
            style={TOUCH_TARGET_STYLE}
            disabled={useZoom ? false : disabled}
            aria-haspopup={useZoom ? 'dialog' : undefined}
            onClick={handleClick}
          >
            {compact ? (
              <ChipFace label={chipLabel(card.id)} cost={`${greenCost}g`} />
            ) : (
              <ExpandedFace card={card} cost={`${greenCost}g`} />
            )}
          </button>
        );
      })}
    </div>
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
        {cardArtForCard(card, EXPANDED_FACE_ART_SIZE)}
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
