/**
 * Role identifiers used throughout game logic.
 *
 * IP-safety note: role strings are generic/mechanical (e.g. 'final-boss',
 * 'legendary-sword'). All display-facing text lives in a runtime theme
 * (see src/theme/). No franchise-specific names appear in this file.
 */

/**
 * Sub-classification layer for playable cards (lhlo.32 / kw.card-typing).
 *
 * This is ADDITIVE to {@link CardRole} — both fields coexist on a card.
 * CardRole is NEVER replaced or altered.
 *
 * Definitions per the keyword-glossary §CARD-TYPING:
 *   - `'attack'`  — primarily deals damage.
 *   - `'skill'`   — utility / effect without core damage.
 *   - `'item'`    — a Aurelia-feel tool effect.
 *   - `'engine'`  — generates resources or scales your economy over time.
 *   - `'tech'`    — an answer / counter to a specific situation.
 *   - `'hybrid'`  — (rare) meaningfully spans two sub-classes at once.
 *
 * Consumer hook (future):
 *   kw.duel-resolver (lhlo.14) should key the Adaptive repeated-type
 *   penalty on `Card.cardType` instead of `CombatEffect['kind']` once
 *   every combat-deck card has a `cardType`. The TODO comment in
 *   `src/core/combat/archetypeResolvers/duel.ts` marks the exact callsite.
 *
 * Omission contract:
 *   Non-playable roles (monster, mini-boss, final-boss, chest-std,
 *   chest-mid, chest-boss) are intentional omissions — they are defeated
 *   with Power or opened with Keys, never played from hand for an effect.
 *   Starter cards (starter-green, starter-red) are pure filler in the
 *   10-card starter deck and are also intentional omissions.
 *   The completeness test in src/data/cards/cardTyping.test.ts enforces
 *   the omission set is explicit and ASSERTED so it can't silently grow.
 */
export type CardType = 'attack' | 'skill' | 'item' | 'engine' | 'tech' | 'hybrid';
export const CARD_ROLES = [
  'hero',
  'item',
  'legendary-sword',
  'revealer-item',
  'monster',
  'mini-boss',
  'final-boss',
  // v2 chest taxonomy (REQ-5a, u-2b → embertide-tq5):
  //
  // History: v1 shipped {small, medium, big} → v2 collapsed to {std, boss}
  // → vy9 re-expanded to {std, enchanted, boss, ancient} → tq5 (2026-04-24)
  // settled on the final 3-tier progression {std, mid, boss}. The middle
  // tier is "Ornate Chest" (kid-recognizable + cathedral-coherent +
  // BotW-canon). The retired `enchanted` and `ancient` roles fold into
  // `chest-mid`.
  //
  // The role naming is kept flat (one role per tier) rather than a
  // discriminant field so the existing role-based art-spec map, theme
  // dictionary, and supply filters stay unchanged.
  'chest-std',
  'chest-mid',
  'chest-boss',
  'starter-green',
  'starter-red',
] as const;

export type CardRole = (typeof CARD_ROLES)[number];

export interface CardCost {
  readonly [resource: string]: number;
}

import type { EffectSpec, ItemPassiveEffect } from './effectSpec';
import type { CombatEffect } from './combatEffect';

/**
 * Boss tier taxonomy (amendment A5). Declared here (not in store/types) so
 * Card can reference it without a circular `import type` pair.
 *  - 'wild-boss':   in-zone mini-boss. Multiple per zone OK. Shared-HP.
 *                   Defeat drops a wisp (amendment A6). NO zone advance.
 *  - 'region-boss': zone-clear gatekeeper. ONE per zone. Defeat triggers
 *                   advanceZone. REQ-32 (u-9a): the region slot is
 *                   always engageable once the zone is active — the
 *                   "wild-bosses-cleared" gate is retired.
 *
 * Absent on regular beasts. u-6a/b/c populate the tier on specific cards
 * (Craghorn/Broodmaw/Boulderkin/King-Ashjaw/Sentinel/Silver-Chimera/Vurmox).
 * u-5a treats `bossTier === undefined` as a regular enemy.
 */
export type BossTier = 'wild-boss' | 'region-boss';

/**
 * Item discriminant (REQ-4 / amendment A6, u-2d). Applies only to cards
 * with `role === 'item'` or `role === 'legendary-sword'`.
 *
 *  - 'item-active':  has an activate-able effect (or a start-of-turn
 *                    trigger) and carries cooldown bookkeeping fields.
 *                    v2.0 ships every item as 'item-active'.
 *  - 'item-passive': reserved for v2.1. Schema-allowed today but no v2.0
 *                    card declares it (narrows the EffectSpec cascade
 *                    surface per the REQ-4 premortem edit at L5).
 *
 * Absent on non-item roles (heroes, monsters, chests, starters).
 */
export type ItemKind = 'item-active' | 'item-passive';

/**
 * Zone affinity (amendment A5, u-6a). Declares which map zone a card
 * thematically belongs to — specifically the regular enemies + wild/region
 * bosses of each v2.0 zone (Sylvani / Emberpeak / Gilded Cage).
 *
 * Duplicated from `ZoneId` in `src/store/types.ts` (instead of imported)
 * to keep this type module free of store-layer dependencies. The u-6a
 * card test + ZONE_METADATA (src/rules/zones.ts) are both sources of
 * truth; the `zone` field is an authoring-time affinity declaration,
 * while ZONE_METADATA drives runtime spawn logic.
 *
 * Absent on heroes, items, chests, starters, and cards shared across
 * zones.
 */
export type CardZone =
  | 'sylvani'
  | 'emberpeak'
  | 'maren'
  | 'hollow-shrine'
  | 'dune-sanctum'
  | 'gilded-cage';

export interface Card {
  readonly id: string;
  readonly role: CardRole;
  readonly cost: CardCost;
  /**
   * Typed card effect (REQ-13 Phase 1 / u-1b). Discriminated on `kind`;
   * see {@link EffectSpec} for the exhaustive member list.
   */
  readonly effects: EffectSpec;
  /**
   * Optional boss tier (amendment A5, u-5a). Absent = regular enemy.
   * When set:
   *  - 'wild-boss':   in-zone mini-boss. Defeat drops a wisp (u-6a/b/c)
   *                   and appends to `state.defeatedBossIds`. Does NOT
   *                   trigger zone advance.
   *  - 'region-boss': zone-clear gatekeeper. Defeat appends to
   *                   `state.defeatedBossIds` AND, when the card id
   *                   matches the current zone's `regionBossId`,
   *                   triggers `advanceZone`.
   *
   * u-5a declares the field but leaves every existing card untagged —
   * u-6a/b/c populate specific bosses (Craghorn/Broodmaw/Boulderkin/
   * King-Ashjaw/Sentinel/Silver-Chimera/Vurmox).
   */
  readonly bossTier?: BossTier;
  /**
   * Item discriminant (REQ-4 / amendment A6, u-2d). Present on every
   * card with `role === 'item'` or `role === 'legendary-sword'`; absent
   * on every other role. See {@link ItemKind}.
   */
  readonly itemKind?: ItemKind;
  /**
   * Cooldown-turns readout for active items (REQ-4 / u-2d). Present on
   * cards with `itemKind === 'item-active'`. The start-of-turn hook in
   * `applyStartOfTurnItems` decrements this readout (floored at 0); the
   * ItemCell UI renders "Ready" when the value is 0 and the turns-
   * remaining count when > 0.
   *
   * v2.0 ships every item-active card with `cooldownTurns: 0` because
   * the current item set (Relics + wisp) either fires unconditionally
   * every turn (Relics) or is tap-to-use with no cooldown (wisp). The
   * hook exists for forward compatibility with v2.1 cooldown-gated
   * items (u-7 softclock, u-4 balance passes).
   */
  readonly cooldownTurns?: number;
  /**
   * Turn number on which this active item was most recently used
   * (REQ-4 / u-2d). `null` means the item has never been activated or
   * was just acquired. v2.0's Relics never set this (they fire
   * unconditionally via the SOT hook); the wisp sets it on successful
   * revive but since its cooldown is 0 the bookkeeping is display-only.
   */
  readonly lastUsedTurn?: number | null;
  /**
   * Optional zone affinity (amendment A5, u-6a/b/c). Present on monster /
   * mini-boss cards authored for a specific v2.0 map-zone; absent on
   * cards that live outside the zone spine (heroes, items, chests,
   * starters, and the legacy v1 monsters/mini-bosses that predate zones).
   *
   * The authoritative list of a zone's membership is
   * `ZONE_METADATA[zone].regularEnemyIds` / `wildBossIds` / `regionBossId`
   * in `src/rules/zones.ts` — the `zone` field on the card itself is a
   * convenience back-reference so UI / reward code can read affinity
   * directly without re-scanning zone metadata. Tests should prefer the
   * ZONE_METADATA membership assertion when verifying roster composition.
   *
   * Uses the local `CardZone` alias (not `ZoneId` from `store/types`) to
   * avoid a `store/types ↔ types/card` cycle at the module-graph level.
   * The two aliases are structurally identical and kept in sync by
   * `src/store/zones.test.ts`'s ZONE_ORDER assertion.
   */
  readonly zone?: CardZone;
  /**
   * Chest-attached-to-monster flag (v2.1 REQ-21 / gm0.6). Stamped at
   * supply-build time on ~40% of regular center-row monsters
   * (`role === 'monster'` && `bossTier === undefined`). Defeating a card
   * with `hasAttachedChest: true` opens a `chest-std` reward at NO key
   * cost (the chest is the kill bonus, not a separately-paid action).
   *
   * Stamped deterministically per seed by `buildSupply` so a given seed
   * always produces the same distribution. Absent (undefined) on every
   * other card; absent on supply monsters that did not roll the flag.
   *
   * UI: a small chest icon overlay renders on the card face when this
   * flag is true (data-testid="monster-chest-overlay") so the player can
   * see the bonus before engaging.
   */
  readonly hasAttachedChest?: boolean;
  /**
   * Optional second-slot passive trigger for dual-behaviour items
   * (embertide-ppf9.4 schema lock-in). Authored alongside a non-
   * passive `Card.effects` (e.g. an on-equip resource grant) when the
   * item should ALSO carry an always-on passive — letting one card
   * hold both an on-equip fire and a triggered passive without
   * collapsing the single-spec `Card.effects` contract.
   *
   * Mutually exclusive with `Card.effects.kind === 'item-passive'`:
   * declaring both is malformed authoring and is enforced by (a) the
   * test-time invariant in `src/data/cardPassives.test.ts`, and (b) a
   * runtime throw in `getPassives()` as a defense-in-depth backstop.
   *
   * Read via `getPassives(card)` from `src/data/cardPassives.ts` — the
   * single source of truth for passive iteration. Direct reads are
   * banned by the `hc/no-raw-item-passive-read` ESLint rule (allowlist:
   * cardPassives.ts itself, render-policy site `src/ui/effectText.tsx`
   * pending ppf9.4.4, and test files).
   */
  readonly passive?: ItemPassiveEffect;
  /**
   * Optional in-card combat behaviour declaration (embertide-bq9b /
   * ppf9-7a). When present, `combatEffectFor(card)` returns this value
   * directly — taking precedence over the `EXPLICIT_OVERRIDES` lookup in
   * `src/data/combatEffects.ts` and the `cost.red` default. Authored on
   * heirlooms (u-9b) so the in-combat shape lives next to the rest of
   * the card's main-board declaration; the broader migration of the
   * remaining `EXPLICIT_OVERRIDES` entries is deferred (see ppf9-7b
   * follow-up).
   */
  readonly combatEffect?: CombatEffect;
  /**
   * Sub-classification layer (lhlo.32 / kw.card-typing). Optional and
   * ADDITIVE to `role` — CardRole is never replaced. See {@link CardType}
   * for the full rubric and omission contract.
   *
   * Intentional omissions (no `cardType` authored, enforced by the
   * completeness test in src/data/cards/cardTyping.test.ts):
   *   - `role === 'monster'`      — defeated with Power, not played
   *   - `role === 'mini-boss'`    — defeated with Power, not played
   *   - `role === 'final-boss'`   — defeated with Power, not played
   *   - `role === 'chest-std'`    — opened with Keys, not played
   *   - `role === 'chest-mid'`    — opened with Keys, not played
   *   - `role === 'chest-boss'`   — opened with Keys, not played
   *   - `role === 'starter-green'`— basic starter filler (not in KID_CARDS)
   *   - `role === 'starter-red'`  — basic starter filler (not in KID_CARDS)
   */
  readonly cardType?: CardType;
  /**
   * Free-form keyword tag substrate (embertide-4hr1.1, sub of
   * lhlo + 4hr1). Surfaced today by the Item-Check archetype resolver
   * — when a card with `tags` overlapping the boss's
   * `BossStateGuarded.until` is played in combat, the open-trigger
   * resolver flips the boss to `exposed{revertsTo: <prior-guarded>}`
   * (e.g. Cinderwyrm: `guarded(item-tag-bomb)` + cinder-bloom with
   * `tags: ['item-tag-bomb']` → exposed window).
   *
   * Free string at the type level so the substrate can absorb future
   * keyword consumers (item-tag-fire-arrow, kw-elemental-flame, etc.)
   * without churning the Card schema. Optional + readonly so every
   * existing card literal stays valid without churn — read sites
   * guard on falsy `tags` and skip work (see
   * `applyItemCheckOpenTrigger`) rather than coalescing to `[]`.
   */
  readonly tags?: readonly string[];
}
