import type { Card } from '../../types/card';
import type { KidPlayer } from '../types';
import { drawCards } from './deck';

/**
 * @deprecated (embertide-9yu) Legacy 2-slot inventory costs. Items are
 * now slotted into the persistent Items zone — no slot, no slot cost. Kept
 * as a named export purely so existing consumers (store + slices tests)
 * continue to compile during the v2 pivot; new code MUST NOT reference
 * this constant.
 */
export const SLOT_COSTS = [4, 6] as const;
/** @deprecated (embertide-9yu) — see SLOT_COSTS. */
export const SLOT_COUNT = SLOT_COSTS.length;

/**
 * embertide-nmmc (2026-04-26): the legacy ITEM_CAP=3 cap is
 * retired. Items are unbounded per player — every drop / purchase /
 * chest reward enters the Items zone, and the bag chip + popover
 * render however many the player has earned. Pre-nmmc the cap forced
 * cap-overflow routing through teammate / discard / inPlay; post-nmmc
 * those branches collapse to the always-equip path.
 */

/**
 * Owner shape accepted by the Item equip helper. Narrow on purpose so
 * the same helper can operate on both a KidPlayer and the smaller "owner"
 * structs used inside playCard / chest handlers.
 */
export interface ItemOwner {
  readonly items: readonly Card[];
  readonly discard: readonly Card[];
}

export interface ItemEquipOutcome<T extends ItemOwner> {
  readonly owner: T;
}

/**
 * Roles that equip into the persistent Items zone on play rather than
 * landing face-up in the in-play area. `playCard` routes these through
 * `equipAsItem`; everything else (heroes / starters) moves hand → inPlay.
 *
 * Shared so the drag-to-play guard (`playCardFromInPlayDrop`) can decide
 * whether a dropped card actually belongs in the in-play drop zone — an
 * item dropped there returns to hand instead of silently equipping out of
 * the player's sightline (embertide-0qby).
 */
export function routesToItemsZone(card: Card): boolean {
  return card.role === 'item' || card.role === 'legendary-sword';
}

/**
 * Mint a copy of `item` whose `id` is unique within `existingIds`. When the
 * input id is already taken, append a `-<n>` suffix and set `baseId` to
 * the original id (mirrors `expandTemplate` / `mintFreshWisp` patterns).
 * When the input id is fresh, return the input untouched. Pure.
 *
 * embertide-i2xe (2026-04-25): chest mints (item / premium-item /
 * wisp) previously appended raw KID_CARDS templates to
 * the player's items[], which collided with React's per-card `key`
 * prop in ItemsRow / ChestRow / Field whenever a player accumulated
 * multiple copies of the same baseId from chests. Surfaced as 30-50
 * dev-mode console errors per playtest run. Centralizing the unique-
 * id mint here means EVERY equip path (chest reward, playCard, buy-
 * FromField) gets collision-free ids without each caller needing to
 * remember to suffix.
 */
function ensureUniqueItemId(item: Card, existingIds: ReadonlySet<string>): Card {
  if (!existingIds.has(item.id)) return item;
  const base = (item as { baseId?: string }).baseId ?? item.id;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n += 1;
  return { ...item, id: `${base}-${n}`, baseId: base } as Card;
}

/**
 * Place `item` into the Items zone (REQ-4, u-2d). The Items zone is
 * unbounded per embertide-nmmc — every equip lands the card. No
 * green is deducted here; callers handle cost deduction upstream.
 *
 * Mints a unique id when `item.id` collides with anything already in
 * the owner's `items` or `discard`. See `ensureUniqueItemId` for
 * rationale.
 */
export function equipAsItem<T extends ItemOwner>(owner: T, item: Card): ItemEquipOutcome<T> {
  const existing = new Set<string>();
  for (const c of owner.items) existing.add(c.id);
  for (const c of owner.discard) existing.add(c.id);
  const minted = ensureUniqueItemId(item, existing);
  return {
    owner: {
      ...owner,
      items: [...owner.items, minted],
    },
  };
}

/**
 * embertide-4t2d (wun Track A): apply a card's `equip-bonus`
 * EffectSpec on-equip fire to a player. Called from `playCard` and
 * `buyFromField` AFTER the card has successfully landed in the player's
 * Items zone via `equipAsItem`. Items are unbounded per nmmc — every
 * equip fires the on-equip bonus.
 *
 * Resource semantics:
 *   - 'gem'        → +amount green
 *   - 'power'      → +amount red
 *   - 'card-draw'  → owner draws `amount` cards via the shared seeded RNG
 *   - 'shield'     → schema-only authoring tag for v2.1; the runtime
 *                    damage-reduction reducer is deferred to a tuning
 *                    bead, so this branch leaves player state unchanged
 *
 * Pure: returns a new `KidPlayer` (or the same reference when the bonus
 * is a no-op for the current schema). Cards whose `effects.kind` is not
 * `'equip-bonus'` short-circuit to the input unchanged.
 */
export function applyEquipBonusOnEquip(
  player: KidPlayer,
  card: Card,
  rng: () => number,
): KidPlayer {
  const effects = card.effects;
  if (effects.kind !== 'equip-bonus') return player;
  const { resource, amount } = effects;
  if (amount <= 0) return player;
  switch (resource) {
    case 'gem':
      return { ...player, green: player.green + amount };
    case 'power':
      return { ...player, red: player.red + amount };
    case 'card-draw': {
      const drawn = drawCards(
        { deck: player.deck, hand: player.hand, discard: player.discard },
        amount,
        rng,
      );
      return { ...player, deck: drawn.deck, hand: drawn.hand, discard: drawn.discard };
    }
    case 'shield':
      // Schema-only authoring tag for v2.1. Runtime damage-reduction
      // dispatch lands in a follow-up bead — leave player state
      // unchanged so the type is exhaustive without forcing a
      // half-implemented mutation here.
      return player;
    default: {
      const _exhaustive: never = resource;
      return _exhaustive;
    }
  }
}

/**
 * embertide-uz7k (wun Track B): apply a heirloom card's main-phase
 * "trophy" fire on equip. Drop-only items (craghorn-tusk / boulderkin-core
 * / sentinel-eye / rainbow-ancient-chimera-sword / chimera-sword /
 * freed-princess) declare a real `gain` or `draw` EffectSpec instead of
 * the historical no-op shim, so playing one from hand now yields a small
 * economy / card-velocity bundle in addition to its in-combat override.
 *
 * Dispatch contract mirrors `applyEquipBonusOnEquip`:
 *   - Only fires for `role: 'item'` cards (legendary-sword cards land via
 *     equip-bonus, not gain/draw).
 *   - Items are unbounded per nmmc — every equip fires the heirloom
 *     bonus. There is no cap-overflow path anymore.
 *   - Disjoint from equip-bonus by `effects.kind`: this dispatcher only
 *     handles `gain` and `draw`; equip-bonus is handled by the sibling
 *     `applyEquipBonusOnEquip`. Composition order is irrelevant — they
 *     never both fire on the same card.
 *
 * Short-circuit (return input unchanged) cases:
 *   - `card.role !== 'item'`
 *   - effect kind is not `'gain'` or `'draw'`
 *   - `gain` with no green / red / keys fields (placeholder shims on
 *     great-wisp / wisp-in-bottle and similar drop-only
 *     items whose real behaviour fires from a dedicated reducer)
 *   - `draw` with `amount <= 0`
 */
export function applyHeirloomOnEquip(player: KidPlayer, card: Card, rng: () => number): KidPlayer {
  if (card.role !== 'item') return player;
  const effects = card.effects;
  if (effects.kind === 'gain') {
    const greenDelta = effects.green ?? 0;
    const redDelta = effects.red ?? 0;
    const keysDelta = effects.keys ?? 0;
    if (greenDelta === 0 && redDelta === 0 && keysDelta === 0) return player;
    return {
      ...player,
      green: player.green + greenDelta,
      red: player.red + redDelta,
      keys: player.keys + keysDelta,
    };
  }
  if (effects.kind === 'draw') {
    const amount = effects.amount;
    if (amount <= 0) return player;
    const drawn = drawCards(
      { deck: player.deck, hand: player.hand, discard: player.discard },
      amount,
      rng,
    );
    return { ...player, deck: drawn.deck, hand: drawn.hand, discard: drawn.discard };
  }
  return player;
}
