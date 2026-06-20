import type { JSX } from 'react';

import type { Card } from '../types/card';
import { GENERIC_BASE_ID_THEME, GENERIC_THEME } from '../theme/generic';
import { baseIdOf } from '../data/cards';
import { cardArtForCard } from './CardArt';
import CostGem from './CostGem';
import { type CardEffect, cardFaceSections, effectFor } from './effectText';
import { Chest } from '../icons';

/**
 * Card frame variant (embertide-4jxh).
 *
 * Drives the per-card-class chrome (border, name plate, accent) so the
 * five card classes read as distinct at a glance. Resolution of variant
 * happens via {@link deriveCardVariant} when the consumer doesn't pass
 * one explicitly — call sites can trust `<CardTemplate card={...} />`
 * to render the right variant for the card's role + bossTier.
 *
 * Visual treatment per variant lives in `src/styles/app.css` under the
 * `.card-template[data-variant="…"]` selector blocks; every color comes
 * from a `--hc-*` token (lint:tokens enforced).
 */
export type CardTemplateVariant = 'regular' | 'wild-boss' | 'region-boss' | 'item' | 'champion';

const ITEM_ROLES: ReadonlySet<Card['role']> = new Set(['item', 'legendary-sword']);

/**
 * Resolve the card-frame variant for a Card from its role + bossTier.
 *
 * Priority:
 *   1. `bossTier === 'wild-boss'` → 'wild-boss' (in-zone mini-boss)
 *   2. `bossTier === 'region-boss'` → 'region-boss' (zone gatekeeper)
 *   3. `role === 'final-boss'` → 'region-boss' (Vurmox-class crown)
 *   4. `role === 'hero'` → 'champion' (playable champion portrait)
 *   5. `role === 'item' | 'legendary-sword'` → 'item' (inventory crate)
 *   6. fallback → 'regular' (generic monsters, chests, starters)
 *
 * Exported so the variant table can be unit-tested independently of
 * the React render path and so consumers wanting to override (e.g. a
 * preview that should always read as 'regular') can compare against
 * the default.
 */
export function deriveCardVariant(card: Card): CardTemplateVariant {
  if (card.bossTier === 'wild-boss') return 'wild-boss';
  if (card.bossTier === 'region-boss') return 'region-boss';
  if (card.role === 'final-boss') return 'region-boss';
  if (card.role === 'hero') return 'champion';
  if (ITEM_ROLES.has(card.role)) return 'item';
  return 'regular';
}

export interface CardTemplateProps {
  readonly card: Card;
  readonly illustrationSize?: number;
  /**
   * Pre-computed effect summary. Pass this when the caller has already
   * derived text+nodes for an aria-label or hidden test-span so the
   * template avoids a second `effectTextFor` traversal per render
   * (embertide-c5p). When omitted, the template computes it itself.
   */
  readonly effect?: CardEffect;
  /**
   * Frame variant override (embertide-4jxh). When omitted, resolves
   * from the card's role + bossTier via {@link deriveCardVariant}. Pass
   * explicitly only when a surface needs to render a card AS a different
   * class than its data declares (e.g. previews, modal overrides).
   */
  readonly variant?: CardTemplateVariant;
}

const DEFAULT_ILLUSTRATION_SIZE = 168;

/**
 * Resolve the display name for a Card with a guaranteed non-empty result.
 *
 * Lookup order:
 *   1. Per-baseId override in GENERIC_BASE_ID_THEME (bespoke champion names).
 *   2. Role-level fallback in GENERIC_THEME. TypeScript types this map as
 *      Record<CardRole, string>, which enforces WRITE-SITE exhaustiveness —
 *      the declaration in theme/generic.ts must contain every CardRole.
 *      The runtime `trim().length > 0` guard below is a separate defense
 *      against (a) empty-string theme values that the type system cannot
 *      catch, and (b) role values cast via `as CardRole` from outside the
 *      type system (theme JSON loader, future migration shims).
 *   3. Humanized role string (e.g. 'final-boss' -> 'Final Boss') as the
 *      final runtime safety net. Keeps the Field tile button's accessible
 *      name non-empty even when a future regression would otherwise leave
 *      the card unnamed — a WCAG 4.1.2 violation (embertide-0kl).
 */
export function cardDisplayName(card: Card): string {
  const baseName = GENERIC_BASE_ID_THEME[baseIdOf(card)];
  if (baseName && baseName.trim().length > 0) return baseName;

  const roleName = GENERIC_THEME[card.role];
  if (roleName && roleName.trim().length > 0) return roleName;

  return humanizeKebab(card.role);
}

/**
 * Resolve a display name for a bare baseId when no full Card object is
 * available (e.g. `CombatBoss.sourceCardId` in the combat layer, where
 * role is not tracked). Mirrors the baseId → humanized leg of
 * `cardDisplayName`'s fallback chain without the role-based middle step.
 *
 * Lookup order:
 *   1. Per-baseId override in GENERIC_BASE_ID_THEME (bespoke names).
 *   2. Humanized id (e.g. 'boulderkin' -> 'Boulderkin') as the final
 *      runtime safety net. Prevents future bosses that haven't been added
 *      to GENERIC_BASE_ID_THEME from surfacing as the literal string
 *      "Boss" or an empty label (embertide-jw6).
 */
export function nameForBaseId(id: string): string {
  const baseName = GENERIC_BASE_ID_THEME[id];
  if (baseName && baseName.trim().length > 0) return baseName;
  return humanizeKebab(id);
}

function humanizeKebab(value: string): string {
  const parts = value.split('-').filter((p) => p.length > 0);
  if (parts.length === 0) return 'Card';
  return parts.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

/**
 * Elysian Cathedral card face. Portrait card shape that gives the
 * illustration the maximum readable area while reserving a tight bottom
 * rules-text box for the small uppercase title and the effect copy.
 *
 * Cost is rendered as a stack of stained-glass shard gems anchored to the
 * top-left corner of the art panel.
 *
 * Interaction (click handlers, focus styling) is the consumer's
 * responsibility — wrap this template in a `<button>` (see Field.tsx).
 * All card info (name, effect, cost) is rendered on the card face
 * itself; there is no hover tooltip layer (removed in embertide-mwt).
 */
export default function CardTemplate({
  card,
  illustrationSize = DEFAULT_ILLUSTRATION_SIZE,
  effect,
  variant,
}: CardTemplateProps): JSX.Element {
  const name = cardDisplayName(card);
  const resolvedEffect = effect ?? effectFor(card);
  const { passiveNodes, passiveText } = resolvedEffect;
  // Standardized Market — / Combat — / Omen — section faces (lhlo.38).
  // Passive stays its own demoted span (it is NOT a Market/Combat/Omen
  // section — see keyword-glossary §RELIC / CONSTRUCT).
  const sections = cardFaceSections(card);
  const green = card.cost.green ?? 0;
  const red = card.cost.red ?? 0;
  const keys = card.cost.keys ?? 0;
  const isFree = green === 0 && red === 0 && keys === 0;
  const resolvedVariant = variant ?? deriveCardVariant(card);

  return (
    <div className="card-template" data-role={card.role} data-variant={resolvedVariant}>
      <div className="card-template-art" data-testid="card-template-art">
        {cardArtForCard(card, illustrationSize)}
      </div>

      {isFree ? null : (
        <div className="card-template-cost-overlay" data-testid="card-template-cost-overlay">
          {green > 0 ? <CostGem kind="green" value={green} /> : null}
          {red > 0 ? <CostGem kind="red" value={red} /> : null}
          {keys > 0 ? <CostGem kind="keys" value={keys} /> : null}
        </div>
      )}

      {card.hasAttachedChest ? (
        <div
          className="card-template-monster-chest-overlay"
          data-testid="monster-chest-overlay"
          aria-label="Bonus chest on defeat"
        >
          <Chest size={20} title="Bonus chest on defeat" />
        </div>
      ) : null}

      <div className="card-template-rules-box" data-testid="card-template-rules-box">
        <span className="card-template-name" data-testid="card-template-name">
          {name}
        </span>
        {sections.map((section) => {
          const isCombat = section.label === 'Combat';
          const className = isCombat ? 'card-template-combat' : 'card-template-effect';
          return (
            <span
              key={section.label}
              className={className}
              data-testid={className}
              data-section={section.label}
            >
              <span className="card-template-section-label">{section.label} — </span>
              {section.nodes}
            </span>
          );
        })}
        {passiveText.length > 0 ? (
          <span className="card-template-passive" data-testid="card-template-passive">
            {passiveNodes}
          </span>
        ) : null}
      </div>
    </div>
  );
}
