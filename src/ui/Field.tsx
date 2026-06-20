import { memo, type JSX } from 'react';
import type { Card } from '../types/card';
import type { ChestVariant } from '../rules/chestPool';
import { isMonsterDropEffect } from '../types/effectSpec';
import CardTemplate, { cardDisplayName } from './CardTemplate';
import { effectFor } from './effectText';
import { Magnifier } from '../icons';

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

export interface ZoomedCardContext {
  readonly card: Card;
  /** Visible label on the modal's primary action button. Omit (along
   *  with `action`) for read-only zooms — the modal then renders only
   *  the Close button. Used by DiscardPile / VoidPane for inspecting a
   *  pile's top card without an action to dispatch. */
  readonly actionLabel?: string;
  /** Fired when the player taps the modal's action button. Omit for
   *  read-only zooms (see `actionLabel`). */
  readonly action?: () => void;
  readonly disabled: boolean;
}

export interface FieldProps {
  readonly cards: readonly Card[];
  readonly onFight: (cardId: string) => void;
  readonly onBuy: (cardId: string) => void;
  readonly onOpenChest: (variant: ChestVariant) => void;
  /** Active player's currently held green/red/keys — used to grey out
   *  cards the player cannot pay for. Optional for tests/back-compat. */
  readonly green?: number;
  readonly red?: number;
  readonly keys?: number;
  /** When provided, tile clicks open the card-detail zoom modal
   *  instead of dispatching the action immediately. The modal then
   *  invokes `action()` when the player confirms. Used on touch
   *  devices (landscape mobile) so players can read the full card
   *  text before acting on a tiny art-only tile. */
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
}

function canAfford(
  card: Card,
  isMonster: boolean,
  green: number,
  red: number,
  keys: number,
): boolean {
  if (isMonster) {
    // embertide-sij3 (2026-04-25): mini-bosses + region/wild bosses
    // ship with cost.keys=1 alongside their power threshold. The
    // pre-sij3 check only walked cost.red, so the tile lit up enabled
    // when the player had enough power but no keys — the click would
    // then throw inside `fightMonster` ("Insufficient keys"). Now
    // both costs gate the affordance read so the tile dims until the
    // player can actually engage.
    return red >= (card.cost.red ?? 0) && keys >= (card.cost.keys ?? 0);
  }
  return (
    green >= (card.cost.green ?? 0) && red >= (card.cost.red ?? 0) && keys >= (card.cost.keys ?? 0)
  );
}

function chestVariant(role: Card['role']): ChestVariant | null {
  if (role === 'chest-std') return 'std';
  if (role === 'chest-mid') return 'mid';
  if (role === 'chest-boss') return 'boss';
  return null;
}

/** Props accepted by the memoized per-card tile. Primitive + referentially
 *  stable function props only — see `FieldCard` notes below. */
export interface FieldCardProps {
  readonly card: Card;
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly onFight: (cardId: string) => void;
  readonly onBuy: (cardId: string) => void;
  readonly onOpenChest: (variant: ChestVariant) => void;
  readonly onZoomCard?: (ctx: ZoomedCardContext) => void;
}

/**
 * Single tile within {@link Field}. Extracted and wrapped in `React.memo`
 * (embertide-2a9) so each tile's `aria-label` string is only recomputed
 * when its own inputs change, not on every parent re-render. This
 * stabilizes the accessible name across store ticks and prevents iOS
 * VoiceOver from re-announcing the tile on unrelated renders.
 *
 * Memoization contract:
 *   - `card` identity is stable per turn (backed by store slices).
 *   - `green` / `red` / `keys` are numeric primitives — shallow compare wins.
 *   - `onFight` / `onBuy` / `onOpenChest` come from Zustand selectors in
 *     `GameBoard`, which return the same function reference across renders.
 *
 * React.memo's default shallow prop comparison is sufficient given those
 * invariants; a custom comparator would only add surface area without
 * additional skips.
 */
function FieldCardImpl({
  card,
  green,
  red,
  keys,
  onFight,
  onBuy,
  onOpenChest,
  onZoomCard,
}: FieldCardProps): JSX.Element {
  const variant = chestVariant(card.role);
  const isMonster =
    card.role === 'monster' || card.role === 'mini-boss' || card.role === 'final-boss';

  const performAction = (): void => {
    if (isMonster) {
      onFight(card.id);
    } else if (variant) {
      onOpenChest(variant);
    } else {
      onBuy(card.id);
    }
  };

  const effect = effectFor(card);
  const disabled = !canAfford(card, isMonster, green, red, keys);

  // 2026-06-20 player ruling: a direct tap BUYS / FIGHTS / OPENS immediately
  // (the round2 tap-to-open-modal read as a speed bump). The full-rules
  // CardDetailModal moves onto the corner magnifier button below (when the
  // parent wires `onZoomCard`), so a young reader can still read the card
  // without the primary action being gated behind a modal step.
  const openZoom = onZoomCard
    ? () =>
        onZoomCard({
          card,
          actionLabel: isMonster ? 'Fight' : variant ? 'Open Chest' : 'Buy',
          action: performAction,
          disabled,
        })
    : null;

  // r94e drop-variety: surface a hidden, test-targetable summary of the
  // monster's loot bundle when it ships the new gems / cardDraw / keys
  // fields. Animated post-defeat icon-bar UX is out of scope here;
  // `data-testid="monster-drop-bar"` reserves the hook so a follow-up
  // bead can mount the visible bar without needing another schema or
  // Field.tsx restructure. The hidden span carries comma-separated
  // token labels (`heart`, `gem`, `key`, `card-draw`) so future tests
  // can assert the drop composition deterministically.
  const dropTokens =
    isMonster && isMonsterDropEffect(card.effects) ? extractDropTokens(card.effects) : [];
  // Belt-and-suspenders accessible name (embertide-0kl). The tile's
  // visible name text lives inside <CardTemplate>'s descendant spans;
  // binding aria-label here keeps the button's a11y name intact even if a
  // future refactor alters that internal DOM.
  const cardName = cardDisplayName(card);
  const accessibleName = effect.text ? `${cardName}, ${effect.text}` : cardName;

  return (
    <span className="board-tile-wrap">
      <button
        type="button"
        className="card-tile field-card-tile tap-target"
        data-testid={`field-card-${card.id}`}
        data-role={card.role}
        data-touch-target="true"
        style={TOUCH_TARGET_STYLE}
        disabled={disabled}
        aria-label={accessibleName}
        onClick={performAction}
      >
        <CardTemplate card={card} effect={effect} />
        {effect.text ? (
          <span hidden data-testid={`field-effect-text-${card.id}`}>
            {effect.text}
          </span>
        ) : null}
        {dropTokens.length > 0 ? (
          <span hidden data-testid="monster-drop-bar" data-card-id={card.id}>
            {dropTokens.join(',')}
          </span>
        ) : null}
      </button>
      {openZoom ? (
        <button
          type="button"
          className="board-tile-zoom"
          data-testid={`field-card-${card.id}-zoom`}
          data-touch-target="true"
          style={TOUCH_TARGET_STYLE}
          aria-haspopup="dialog"
          aria-label={`View ${cardName} details`}
          onClick={openZoom}
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
 * r94e: list the resource tokens packaged in a `monster-drop` payload.
 * Returns the token labels in canonical render order (`heart`, `gem`,
 * `key`, `card-draw`). Empty list when the drop has only the heart
 * baseline — keeps `monster-drop-bar` test-id off pre-r94e cards so
 * regression tests don't accidentally assert against the unchanged
 * monster roster.
 */
function extractDropTokens(drop: {
  readonly hearts: number;
  readonly keys?: number;
  readonly gems?: number;
  readonly cardDraw?: number;
}): readonly string[] {
  const tokens: string[] = [];
  if (drop.hearts > 0) tokens.push('heart');
  if ((drop.gems ?? 0) > 0) tokens.push('gem');
  if ((drop.keys ?? 0) > 0) tokens.push('key');
  if ((drop.cardDraw ?? 0) > 0) tokens.push('card-draw');
  // Pre-r94e cards (hearts-only) collapse to a single `heart` entry.
  // To keep the bar testid surface scoped to the variety extension we
  // only emit the bar when at least one EXTRA token (gem/key/cardDraw)
  // landed alongside the heart token. Hearts-only kept off the bar.
  const extraCount = tokens.filter((t) => t !== 'heart').length;
  if (extraCount === 0) return [];
  return tokens;
}

export const FieldCard = memo(FieldCardImpl);
FieldCard.displayName = 'FieldCard';

/**
 * Renders the shared field row (MH-3/MH-4). Each tile is a button that
 * dispatches the appropriate action based on its role:
 *   - monster/mini-boss/final-boss → onFight
 *   - chest-* → onOpenChest (tolerated but never expected — chests now live
 *     in the dedicated ChestRow per embertide-7c1; the main field
 *     filters them out defensively below)
 *   - hero/item/legendary-sword/revealer-item → onBuy
 *
 * Every tile carries a `<CostBadge />` in the corner so buy costs are
 * visible at a glance (issue embertide-2l9). Renders whatever cards
 * live in `state.field` — robust to an empty field during early turns and
 * to the full 6-card market populated by the parallel embertide-7kw
 * work stream.
 */
export default function Field({
  cards,
  onFight,
  onBuy,
  onOpenChest,
  green = Infinity,
  red = Infinity,
  keys = Infinity,
  onZoomCard,
}: FieldProps): JSX.Element {
  // embertide-7c1: chests moved out of the main market. If a stray
  // chest somehow reaches this component we silently drop it rather than
  // render a duplicate button alongside the ChestRow.
  const visible = cards.filter((c) => !c.role.startsWith('chest-'));
  return (
    <div className="field" data-testid="field">
      {visible.map((card) => (
        <FieldCard
          key={card.id}
          card={card}
          green={green}
          red={red}
          keys={keys}
          onFight={onFight}
          onBuy={onBuy}
          onOpenChest={onOpenChest}
          onZoomCard={onZoomCard}
        />
      ))}
    </div>
  );
}
