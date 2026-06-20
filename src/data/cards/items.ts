/**
 * Active items + wisp variants + banish-from-hand structures + the
 * legendary-sword `ancient-blade`.
 *
 * REQ-4 / amendment A6, u-2d: every item carries the
 * item-active/item-passive discriminant. Cooldown fields are declared
 * up front even though v2.0 Relics + wisp all use `cooldownTurns: 0` —
 * the start-of-turn hook in applyStartOfTurnItems decrements them
 * (guarded at 0) so the readout is ready when v2.1 ships cooldown-gated
 * items.
 */

import type { Card } from '../../types/card';
import type { LegendaryItemCard } from './types';

export const items: readonly Card[] = [
  {
    id: 'short-sword',
    role: 'item',
    cost: { green: 2 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Classic Aurelia blade tool — combat-attack boost on equip.
    cardType: 'item',
  },
  {
    id: 'tower-shield',
    role: 'item',
    cost: { green: 2 },
    effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
    // ppf9.3.1 (embertide-y0tr): first dual-slot v2.0 market item.
    // Mirrors the iron-ward shape (damage-reduction +1 on every incoming
    // hit). The on-damage passive layer makes tower-shield read as a
    // literal shield, not a palette swap of short-sword. Surfaces a
    // green:2 vs iron-ward green:5 dominance question — tracked on
    // embertide-2kid (designer call A-E).
    passive: {
      kind: 'item-passive',
      description: 'Reduce damage taken by 1',
      trigger: 'on-damage',
      effect: { kind: 'damage-reduction', amount: 1 },
    },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon defensive tool — shield with damage reduction passive.
    cardType: 'item',
  },
  {
    id: 'short-bow',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon ranged tool — bow equip grants power.
    cardType: 'item',
  },
  {
    id: 'curved-throwing-blade',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-feel throwing weapon tool — equip grants power.
    cardType: 'item',
  },
  // ---------------------------------------------------------------------
  // v2.1 gm0.15 new supply items (embertide-9hy). Five weapon/tool
  // cards added to the main supply market, extending the existing four
  // v2.0 items. Each pairs a main-board on-equip `equip-bonus` fire
  // (embertide-s2ub, wun Track A) with a distinct in-combat effect
  // wired via `EXPLICIT_OVERRIDES` in src/data/combatEffects.ts.
  //
  // Cost / power curve (in-combat behaviour stays sourced from
  // EXPLICIT_OVERRIDES; the equip-bonus column is the new main-phase fire):
  //   bow            green:3 — equip +1 power, multishot 2×2 in combat.
  //   boomerang      green:3 — equip +1 power, attack-stun 2+1 in combat.
  //   elysian-shield  green:4 — equip +1 gem, absorb 4 in combat.
  //   cinder-bloom    green:3 — equip +2 power, attack 4 in combat.
  //   ancient-sword  green:5 — equip draw 1, attack 5 in combat (supply ×1
  //                             rather than ×2 to keep the legendary
  //                             scarcity curve beside `ancient-blade`;
  //                             the SUPPLY_PLAN entry overrides the
  //                             default ×2 copies below).
  // The sixth new card, `chimera-sword`, ships as a silver-chimera secondary
  // heirloom drop — authored alongside the other heirloom templates
  // (NOT in this `items` array) so it stays out of SUPPLY_PLAN.
  // ---------------------------------------------------------------------
  // embertide-4t2d (wun Track A schema + dispatcher) introduced the
  // `equip-bonus` EffectSpec discriminant; embertide-s2ub completed
  // Track A by migrating every supply item from the legacy
  // `combat-bonus` / `damage-reduction` rules-text shim (which never
  // dispatched — see docs/design/dual-phase-card-effects-audit.md §2)
  // to the live equip-bonus shape. The runtime dispatcher in
  // `applyEquipBonusOnEquip` (src/store/slices/inventory.ts) applies
  // each item's main-phase fire the moment it enters the player's
  // Items zone via `playCard` or `buyFromField`. Combat behaviour is
  // unchanged — `EXPLICIT_OVERRIDES` in src/data/combatEffects.ts stays
  // the authoritative combat shape; EffectSpec only owns the main-phase
  // fire after this migration.
  {
    id: 'bow',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon bow — equip grants power; multishot 2×2 in combat.
    cardType: 'item',
  },
  {
    id: 'boomerang',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon boomerang — equip grants power; attack-stun in combat.
    cardType: 'item',
  },
  {
    id: 'elysian-shield',
    role: 'item',
    cost: { green: 4 },
    effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
    // ppf9.4.2 (embertide-kspj): second dual-slot v2.1 market item.
    // Mirrors the iron-ward / tower-shield damage-reduction shape (-1
    // per incoming hit). The v2.1 amendment keeps the gem+1 on-equip
    // and combat-side absorb hp 4 (EXPLICIT_OVERRIDES) intact; the
    // passive layer is the third behaviour. Designer-locked 2026-04-29
    // (memory embertide-designer-ruling-cinder-bloom-passive-2026-
    // 04-29) — bow / boomerang / cinder-bloom / ancient-sword stay
    // single-slot per the same ruling. Dominance vs iron-ward green:5
    // tracked on embertide-2kid; not addressed here.
    passive: {
      kind: 'item-passive',
      description: 'Reduce damage taken by 1',
      trigger: 'on-damage',
      effect: { kind: 'damage-reduction', amount: 1 },
    },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon Elysian Shield — equip grants gem; passive absorb 4
    // and damage reduction in combat.
    cardType: 'item',
  },
  {
    id: 'cinder-bloom',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 2, trigger: 'on-equip' },
    // lhlo.20 (kw.item-check-card-tags): tag required by the Item-Check
    // archetype resolver so Cinderwyrm (COLOSSEUM_CINDERWYRM_T2), Ashen Tyrant,
    // and Vinemaw T3 can be unguarded at runtime. The resolver reads
    // card.tags and flips guarded{until:'item-tag-bomb'} → exposed when this
    // card is played in combat.
    tags: ['item-tag-bomb'],
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon explosive tool — equip grants power+2; breaks guard
    // (item-tag-bomb) in combat. Classic item-check tech tool.
    cardType: 'item',
  },
  {
    id: 'ancient-sword',
    role: 'item',
    cost: { green: 5 },
    effects: { kind: 'equip-bonus', resource: 'card-draw', amount: 1, trigger: 'on-equip' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Ancient weapon — equip draws a card; combat-attack 5 in hand.
    // Aurelia-feel legendary sword tool.
    cardType: 'item',
  },
  // ---------------------------------------------------------------------
  // embertide-akop: three item-check opener cards. Each carries an
  // `item-tag-*` that the Item-Check archetype resolver
  // (applyItemCheckOpenTrigger) reads to flip a boss's
  // guarded{until:'item-tag-*'} → exposed when the card is played in
  // combat — same substrate as cinder-bloom (lhlo.20). Designer ruling
  // 2026-05-26 (memory embertide-designer-ruling-item-check-openers-
  // 2026-05-26) sets the cost / equip / combat curve; no reflect/pull
  // combat primitive exists, so canon maps onto combat-attack /
  // combat-multishot. Combat behaviour lives in EXPLICIT_OVERRIDES
  // (src/data/combatEffects.ts), matching the existing supply-item
  // pattern. Auto-enter SUPPLY_PLAN (×2) + KID_CARDS via the `items`
  // spread.
  //
  // Art: bespoke item-check opener portraits (tib8, nano-banana-pro) are
  // registered in SPEC_BY_BASE_ID (src/ui/CardArt.tsx) — same pr2 portrait
  // pattern as bow / boomerang / elysian-shield. Display names are set in
  // src/theme/generic.ts.
  {
    id: 'grapplethorn',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    // Breaks Tidewraith's guard (Maren region boss, ZONE_BOSS_SPECS.tidewraith).
    tags: ['item-tag-grapplethorn'],
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon grapple tool — equip grants power+1; the grapple-strike
    // (combat-attack 3) breaks the item-tag-grapplethorn guard in combat.
    cardType: 'item',
  },
  {
    id: 'grapnels',
    role: 'item',
    cost: { green: 4 },
    effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
    // Breaks Voltwyrm T3's guard (COLOSSEUM_VOLTWYRM_T3).
    tags: ['item-tag-grapnels'],
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon Double Grapnels — equip grants power+1; the twin
    // grapples (combat-multishot 2×2) ground a flyer and break the
    // item-tag-grapnels guard in combat.
    cardType: 'item',
  },
  {
    id: 'aegis-pane',
    role: 'item',
    cost: { green: 4 },
    effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
    // Breaks the Sentinel's guard (Gilded Cage wild boss,
    // ZONE_BOSS_SPECS.sentinel). Distinct from elysian-shield, which is a
    // pure absorb shield and must NOT carry this tag.
    tags: ['item-tag-aegis-pane'],
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    // Aurelia-canon laser-reflect shield — equip grants gem+1; reflecting
    // the beam into the eye (combat-attack 4) breaks the
    // item-tag-aegis-pane guard in combat. Reflect = offensive burst,
    // not absorb (that is elysian-shield's lane).
    cardType: 'item',
  },
];

// Wisp (u-1d amendment A6, u-2d): full-revive item-active played on a
// downed teammate via the store action `playWispOn`. Held in its own
// singleton so it stays OUT of SUPPLY_PLAN — fairies are never buyable in
// the market. Acquisition paths are chest loot (u-2b: 5% in chest-std,
// 15% in chest-boss) and guaranteed wild-boss drops (u-6a/b/c). The
// mechanic is still dispatched by `playWispOn` (keying on baseId
// 'wisp'), not by the effectText switch — same pattern as mystic /
// militia-grunt / wild-wolf. The card-face rules-text is rendered by
// effectTextFor's baseId branch ("Revive teammate to full HP") because
// the literal heal amount is computed at dispatch (target.hpMax),
// not authored on the card.
//
// REQ-13 Phase 2c (gm0.3): the EffectSpec migrates from the inert
// `gain` placeholder to `{ kind: 'heal', target: 'team', amount: 0 }`,
// making the on-play intent legible at the type level. `amount: 0` is
// a sentinel — the dispatcher (`playWispOn`) ignores the authored
// amount and substitutes `target.hpMax`, but the type-level shape now
// declares "this card heals a teammate" rather than pretending to be
// a no-op resource gain.
//
// Cooldown: 0 turns, no "last used" bookkeeping — wisp is consumed
// on successful revive so subsequent uses need a fresh card.
export const wisp: Card = {
  id: 'wisp',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'heal', target: 'team', amount: 0 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Aurelia-canon wisp revive — full-HP revival of a downed teammate.
  // Classic Aurelia tool effect.
  cardType: 'item',
};

// Great Wisp (v2.1 gm0.16): enhanced wisp variant. Acquired ONLY from
// chest premium-item / boss-chest drops. Same consume-on-downed revive
// contract as plain wisp (`playWispOn` in gameStore.ts accepts any of
// the three wisp baseIds: 'wisp' | 'great-wisp' | 'wisp-in-bottle'),
// but the in-combat effect is a stronger heal (combat-heal amount:5 vs
// plain wisp's amount:3 — see EXPLICIT_OVERRIDES in combatEffects.ts).
// NOT in SUPPLY_PLAN — drop-only item.
//
// ppf9.2 (2026-04-29): EffectSpec migrated from the inert `gain`
// placeholder to `{ kind: 'heal', target: 'team', amount: 0 }`, mirroring
// the plain wisp shape. `amount: 0` is a sentinel — the dispatcher
// (`playWispOn`) substitutes `target.hpMax` at use time. The shape now
// declares "this card heals a teammate" at the type level rather than
// pretending to be a no-op resource gain. `applyHeirloomOnEquip` and
// `applyEquipBonusOnEquip` both short-circuit on non-matching effect
// kinds, so the on-equip path is unchanged.
export const greatWisp: Card = {
  id: 'great-wisp',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'heal', target: 'team', amount: 0 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Enhanced Aurelia-canon wisp revive — stronger heal on revival.
  cardType: 'item',
};

// Wisp in Bottle (v2.1 gm0.16): reusable-once-per-combat wisp variant.
// Acquired from the wisp-reward chest roll (50/50 split with plain
// wisp — see `pickWispVariant` in slices/chests.ts). On revive the
// bottle is CONSUMED, but `playWispOn` re-equips it into the owner's
// items zone so it can fuel ONE more revive in the same combat — the
// per-player `usedWispInBottleIds` set blocks a second refill of the
// same bottle within the same combat (reset at COMBAT_ENTER). Combat
// effect is combat-heal amount:3 (same as plain wisp).
//
// ppf9.2 (2026-04-29): EffectSpec migrated from `gain` placeholder to
// `{ kind: 'heal', target: 'team', amount: 0 }` — same migration
// rationale as great-wisp above.
export const wispInBottle: Card = {
  id: 'wisp-in-bottle',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'heal', target: 'team', amount: 0 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Reusable wisp bottle — revive once then re-equip for a second
  // revival. Classic Aurelia consumable tool.
  cardType: 'item',
};

// ---------------------------------------------------------------------------
// embertide-91p (b) — per-card banish wiring. Two item-active cards
// declare `effects: { kind: 'banish-from-hand', amount: 1 }` so the
// playCard pipeline surfaces the banish choice modal (CardSelectionModal)
// when either resolves on play. Authored OUTSIDE `SUPPLY_PLAN` (mirroring
// the wisp drop-only pattern) so they don't perturb the
// existing market shuffle; they are accessible by id from `KID_CARDS`
// for catalog tests / future drop-source wiring.
//
// ppf9.6 (2026-04-30) — designer ruling
// (memory embertide-designer-ruling-ppf9-6-items-2026-04-30) layers a
// distinct Card.passive on each card so they no longer share an identical
// effect shape:
//   - blacksmith-forge: start-of-turn `gain green:1` — the forge keeps
//     working while you adventure (sustainability / passive economy).
//   - ritual-relic: on-monster-defeated `draw 1` — the relic records every
//     defeated foe, yielding knowledge (post-combat draw).
// Passes the ppf9.1 "only always-on flavour qualifies" precedent. Both
// keep `banish-from-hand 1` as the on-play active; the source-pile and
// amount-bump differentiation routes were rejected (require framework
// changes — `pendingBanishChoiceFor` reads only `kind`, and
// `banishFromHandSlice` banishes a single card per call).
// ---------------------------------------------------------------------------

export const blacksmithForge: Card = {
  id: 'blacksmith-forge',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'banish-from-hand', amount: 1 },
  passive: {
    kind: 'item-passive',
    description: '+1 gem at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'gain', green: 1 },
  },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Thin your deck (banish) AND generate +1 gem per turn via the
  // passive — dual economy-scaling engine.
  cardType: 'engine',
};

export const ritualRelic: Card = {
  id: 'ritual-relic',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'banish-from-hand', amount: 1 },
  passive: {
    kind: 'item-passive',
    description: 'Draw 1 when you defeat a monster',
    trigger: 'on-monster-defeated',
    effect: { kind: 'draw', amount: 1 },
  },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Thin your deck (banish) AND draw a card on every kill via the
  // passive — card-draw engine that scales with kill count.
  cardType: 'engine',
};

// ppf9.6 (2026-04-30): equip-bonus bumped power+1 → power+2 so the
// legendary main-board read (g=5 cost) is no longer identical to short-
// sword's (g=3, power+1). Combat-attack damage:5 in EXPLICIT_OVERRIDES
// stays the same, as does the per-turn `applyItemTrigger` +2 red. No
// Card.passive — sword flavour fails the ppf9.1 always-on test (a sword
// in your bag doesn't naturally do anything per turn — same call as
// cinder-bloom / craghorn-tusk / chimera-sword).
export const ancientBlade: LegendaryItemCard = {
  id: 'ancient-blade',
  role: 'legendary-sword',
  cost: { green: 5 },
  effects: { kind: 'equip-bonus', resource: 'power', amount: 2, trigger: 'on-equip' },
  metadata: { spawnTurn: 6 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  // Legendary sword — equip grants power+2; combat-attack 5 + per-turn
  // +2 red. Primary value is combat damage output. Attack.
  cardType: 'attack',
};
