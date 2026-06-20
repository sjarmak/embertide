import type { JSX } from 'react';
import { ALWAYS_AVAILABLE, KEY_VENDOR_ID, VENDORS } from '../data/cards';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import CardTemplate from './CardTemplate';

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
  'wild-wolf': 'Boko',
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
}: AlwaysAvailableRowProps): JSX.Element {
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

        const handleClick = (): void => {
          if (isMonster) {
            onFight(card.id);
          } else {
            onBuy(card.id);
          }
        };

        return (
          <button
            key={card.id}
            type="button"
            className={tileClass}
            data-testid={`always-available-${card.id}`}
            data-role={card.role}
            data-touch-target="true"
            style={TOUCH_TARGET_STYLE}
            disabled={disabled}
            onClick={handleClick}
          >
            {compact ? (
              <ChipFace
                label={chipLabel(card.id)}
                cost={isMonster ? `${redCost}r` : `${greenCost}g`}
              />
            ) : (
              <CardTemplate card={card} />
            )}
          </button>
        );
      })}
      {VENDORS.map((card) => {
        const greenCost = card.cost.green ?? 0;
        const isKeyVendor = card.id === KEY_VENDOR_ID;
        const disabled = green < greenCost || (isKeyVendor && usedKeyVendorThisTurn);
        const handleClick = (): void => {
          if (isKeyVendor) {
            onTrade(card.id);
          }
        };
        return (
          <button
            key={card.id}
            type="button"
            className={vendorClass}
            data-testid={`always-available-${card.id}`}
            data-role="vendor"
            data-touch-target="true"
            style={TOUCH_TARGET_STYLE}
            disabled={disabled}
            onClick={handleClick}
          >
            {compact ? (
              <ChipFace label={chipLabel(card.id)} cost={`${greenCost}g`} />
            ) : (
              <CardTemplate card={card} />
            )}
          </button>
        );
      })}
    </div>
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
