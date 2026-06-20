import type { JSX } from 'react';
import type { Card } from '../types/card';
import { CHEST_KEY_COSTS, type ChestVariant } from '../rules/chestPool';
import CardTemplate from './CardTemplate';

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export interface ChestRowProps {
  /** The dedicated chest row (up to 3 chest cards). */
  readonly cards: readonly Card[];
  /** Current player's key count — disables buttons the player cannot afford. */
  readonly keys: number;
  readonly onOpenChest: (variant: ChestVariant) => void;
  /**
   * uwg5 (2026-04-26): when the parent AlwaysRowStrip is collapsed,
   * render each chest slot as a 44px parchment chip (chest variant
   * label + key cost) instead of the full CardTemplate. Click
   * semantics + disabled states are preserved.
   */
  readonly compact?: boolean;
}

function chestVariant(role: Card['role']): ChestVariant | null {
  if (role === 'chest-std') return 'std';
  if (role === 'chest-mid') return 'mid';
  if (role === 'chest-boss') return 'boss';
  return null;
}

const CHEST_VARIANT_LABEL: Record<ChestVariant, string> = {
  std: 'Sturdy',
  mid: 'Ornate',
  boss: 'Grand',
};

/**
 * Dedicated chest row (embertide-7c1). Always visible alongside the main
 * market so chests — the signature treasure mechanic — are never mixed with
 * heroes / items / monsters. Each slot is a button that dispatches
 * `openChest(variant)` and is disabled when the active player cannot pay the
 * key cost for that variant.
 */
export default function ChestRow({
  cards,
  keys,
  onOpenChest,
  compact = false,
}: ChestRowProps): JSX.Element {
  const tileClass = compact ? 'chest-chip' : 'card-tile field-card-tile tap-target';
  return (
    <div className="chest-row" data-testid="chest-row" data-compact={compact ? 'true' : 'false'}>
      {cards.map((card) => {
        const variant = chestVariant(card.role);
        if (!variant) return null;
        const keyCost = CHEST_KEY_COSTS[variant];
        const disabled = keys < keyCost;

        const cardWithKeyCost: Card = { ...card, cost: { ...card.cost, keys: keyCost } };
        return (
          <button
            key={card.id}
            type="button"
            className={tileClass}
            data-testid={`chest-slot-${variant}`}
            data-role={card.role}
            data-touch-target="true"
            style={TOUCH_TARGET_STYLE}
            disabled={disabled}
            onClick={() => onOpenChest(variant)}
          >
            {compact ? (
              <span className="chest-chip-face">
                <span className="chest-chip-label">{CHEST_VARIANT_LABEL[variant]}</span>
                <span className="chest-chip-cost">{keyCost}🗝</span>
              </span>
            ) : (
              <CardTemplate card={cardWithKeyCost} />
            )}
          </button>
        );
      })}
    </div>
  );
}
