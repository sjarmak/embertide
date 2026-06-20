/**
 * EffectSpec — typed discriminated union for card effects (REQ-13 Phase 1).
 *
 * Phase 1 covers ONLY the effect kinds already present in v1 cards.ts. Phase 2
 * (v2.1+) adds new members one at a time, each as an independently shippable
 * PR. The v2.1 effect kinds are intentionally NOT enumerated here — see the
 * PRD's deferred-REQ list (u-1b-effectspec-phase1's acceptance includes a
 * ripgrep guard asserting this file doesn't name them).
 *
 * Consumers narrow via an exhaustive switch on `kind` with a compiler-level
 * `never` check in the default branch — see `effectTextFor` in
 * src/ui/effectText.tsx for the canonical pattern.
 *
 * Field-naming note (v2 co-op pivot, amendment A2): `MonsterDropEffect.hearts`
 * is mechanically an HP heal in v2 (the field name survives for schema-compat
 * with v1 authoring; hearts the GAME CONCEPT has been replaced by HP per
 * u-1a). A v2.1 rename to `healHp` would churn too many call sites for u-1b's
 * scope.
 */

/** `gain`: flat resource income on play (heroes). */
export interface GainEffect {
  readonly kind: 'gain';
  readonly green?: number;
  readonly red?: number;
  readonly keys?: number;
}

/**
 * `shard`: starter resource template (starter-green-shard / starter-red-shard).
 * Exactly one of green/red is set per template.
 */
export interface RupeeEffect {
  readonly kind: 'shard';
  readonly green?: number;
  readonly red?: number;
}

/** `draw`: draw N cards on play (sentinel-eye heirloom; scholar-princess
 * was the original consumer until mvjx wun Track C migrated it to gain). */
export interface DrawEffect {
  readonly kind: 'draw';
  readonly amount: number;
}

/**
 * `combat-bonus`: +red in combat. `on` narrows when the bonus applies
 * ('fight' = any combat, 'boss' = mini/region-boss). `per` gates the
 * bonus to every Nth combat (curved-throwing-blade).
 */
export interface CombatBonusEffect {
  readonly kind: 'combat-bonus';
  readonly red: number;
  readonly on?: 'fight' | 'boss';
  readonly per?: number;
}

/** `damage-reduction`: reduce incoming damage by N (tower-shield). */
export interface DamageReductionEffect {
  readonly kind: 'damage-reduction';
  readonly amount: number;
}

/**
 * `monster-drop`: HP-heal awarded to the defeating player (v2 semantics).
 * The `hearts` field name is v1 schema-compat; the mechanic is HP heal
 * clamped at `hpMax` per u-1a. Endgame suffix removed per v2 pivot.
 *
 * Optional `keys` drop (u-6a/u-6b/u-6c): some beasts additionally drop
 * a key on defeat — examples include scrabling (Sylvanwood regular),
 * skittermite (Emberpeak regular) and gulpmaw (Gilded Cage
 * regular, pickpocket theme). The value is awarded to the defeating
 * player by `fightMonster` / `defeatAlwaysAvailableMonster` in
 * `src/store/slices/combat.ts`; the combat slice has always read
 * `drop.keys ?? 0`, and u-6a/u-6b/u-6c make the field type-valid at
 * the shared EffectSpec boundary so zone-enemy declarations no longer
 * require a local type-assertion to compile. The field is optional so
 * pre-u-6 cards (grunt-orc / spear-orc / sea-cephalopod, plus the
 * Layer-6/7 boss cards themselves) stay unchanged.
 *
 * Defeat-drop variety extension (embertide-r94e): two additional
 * optional resource drops layer on top of `hearts` + `keys` so monster
 * defeats reward more than HP. Inspired by Ascension's HONOR /
 * card-draw cadence and Slay the Spire's gold + relic-tier loot:
 *  - `gems`: green-shard drop. Generic regulars award the cheaper
 *    "1 heart OR 1 gem"-style alt drop; tougher regulars layer
 *    +1 heart + +1 gem; mini-bosses scale to +2 hearts + +2 gems.
 *  - `cardDraw`: how many extra cards the defeating player draws on
 *    kill (uses the shared seeded RNG so replays stay deterministic;
 *    empty-deck reshuffle is handled by `drawCards`). Reserved for
 *    wild-boss tier drops where the bonus is the on-defeat narrative
 *    beat rather than incidental loot.
 *
 * Intentional omissions: NO `runes` (not a v2 resource) and NO `shards`
 * (those flow through the dedicated `shard-grant` discriminant and the
 * `CombatOnDefeatShardGrant` payload — shards are story-driven rewards,
 * never part of the beast-drop loot table).
 */
export interface MonsterDropEffect {
  readonly kind: 'monster-drop';
  readonly hearts: number;
  readonly keys?: number;
  readonly gems?: number;
  readonly cardDraw?: number;
}

/**
 * `heal`: explicit HP-heal effect (REQ-13 Phase 2c, gm0.3). Separates
 * heal intent from the `monster-drop` discriminant — `monster-drop`
 * stays the on-defeat trigger schema (the `hearts` field name carries
 * v1 schema-compat per u-1a; see `MonsterDropEffect` doc), while `heal`
 * is the first-class shape for non-defeat heal sources: the wisp
 * full-revive (target='team', amount = teammate.hpMax in the
 * dispatcher), future item-active consume cards, and REQ-22 Seer's
 * Omen heal faces.
 *
 * Field contract:
 *  - `amount`: HP restored. Dispatch sites clamp at the target's
 *    `hpMax`; a wisp-style "full revive" passes the target's hpMax
 *    through this field (computed at dispatch, not authored).
 *  - `target`: which player(s) receive the heal:
 *      - 'self'   — the card's owner only.
 *      - 'team'   — a chosen teammate (wisp-revive shape; the picker
 *                   UI lives in `playFairyOn` for the v2.0/v2.1 wisp
 *                   variants and stays untouched by this schema landing).
 *      - 'active' — whichever player is currently the active player at
 *                   dispatch time (used by Seer's Omen heal faces where
 *                   the active player rolled the dice).
 *
 * Schema-only landing (gm0.3): the existing wisp revive dispatcher in
 * `playFairyOn` (src/store/gameStore.ts) keys on `baseIdOf(card) ===
 * 'wisp'` and continues to set `target.hp = target.hpMax`; migrating
 * wisp's main-board EffectSpec from the inert `gain` placeholder to
 * `heal` makes the on-play intent legible at the type level without
 * changing runtime behaviour. Wider migration of in-combat heal sources
 * (ranch-keeper passive, wisp combat-heal) stays scoped to its own
 * follow-up because those go through the separate `CombatEffect`
 * channel (see `src/types/combat.ts`), not EffectSpec.
 */
export interface HealEffect {
  readonly kind: 'heal';
  readonly amount: number;
  readonly target: 'self' | 'team' | 'active';
}

/**
 * `chest-draw`: opens a chest of the specified variant (u-2b → tq5).
 *
 * Tiers (embertide-tq5, 2026-04-24 — final 3-tier progression):
 *   - 'std'  — Sturdy Chest. Common wooden chest, 1 key.
 *   - 'mid'  — Ornate Chest. Decorated wood + iron banding + gem inlay,
 *              2 keys; sits between Sturdy and Vault on the value curve.
 *   - 'boss' — Grand Vault. Premium-item heavy boss reward, 3 keys.
 * All three share the same reward distribution shape; weights live in
 * CHEST_WEIGHT_TABLE (src/rules/chestPool.ts).
 */
export interface ChestDrawEffect {
  readonly kind: 'chest-draw';
  readonly tier: 'std' | 'mid' | 'boss';
}

/**
 * `on-play-power`: grant +red when this card is played. Originally authored
 * for the `starter-home` champion-starter cards (j49z retired the role);
 * the kind is retained on the EffectSpec union for forward compatibility
 * with future on-play heroes / items that grant red on play.
 */
export interface OnPlayPowerEffect {
  readonly kind: 'on-play-power';
  readonly red: number;
}

/** `on-play-green-and-draw`: grant +green AND draw N on play (seer-rune). */
export interface OnPlayGreenAndDrawEffect {
  readonly kind: 'on-play-green-and-draw';
  readonly green: number;
  readonly draw: number;
}

/** `on-play-green-and-power`: grant +green AND +red on play (ancient-keepsake). */
export interface OnPlayGreenAndPowerEffect {
  readonly kind: 'on-play-green-and-power';
  readonly green: number;
  readonly red: number;
}

/**
 * `item-passive`: v2.1 passive-item EffectSpec (REQ-13 Phase 2b,
 * REQ-4 PREMORTEM EDIT L5). Describes an always-on trigger that fires the
 * nested `effect` payload whenever the `trigger` condition matches. All
 * four trigger reducers are wired (`start-of-turn`, `on-combat-enter`,
 * `on-damage`, `on-monster-defeated`) — see per-trigger doc below for
 * dispatch sites.
 *
 * Recursion constraint: the nested `effect` is `InnerEffectSpec`, i.e.
 * EffectSpec minus `item-passive` itself. A passive cannot carry another
 * passive as its payload — enforced at the type level so nonsensical
 * `{ kind: 'item-passive', effect: { kind: 'item-passive', ... } }` trees
 * are a compile error at authoring time (keeps the cascade surface narrow
 * per the REQ-13 Phase 2 discipline).
 *
 * Field contract:
 *  - `description`: human-readable summary — rendered verbatim by
 *    `effectTextFor` as "Passive: <description>". Authors write this
 *    flavour-style ("+1 power at the start of your turn"); the tokenizer
 *    will turn resource words into inline icons on the card face.
 *  - `trigger`: when the passive fires. Triggers:
 *      - 'start-of-turn' — begin of the owner's turn (Ascension construct
 *        flavour). Dispatched by `applyStartOfTurnItems` in
 *        src/store/slices/endgame.ts.
 *      - 'on-combat-enter' — when combat resolution begins (StS-relic
 *        flavour). Dispatched per-player by the `COMBAT_ENTER` case in
 *        src/store/gameStore.ts (embertide-4uyn.3) — fires once per
 *        combat lifecycle; revive flows do NOT re-fire it.
 *      - 'on-damage' — when the owner's Champion takes damage (StS-relic
 *        flavour). Dispatched via `reduceIncomingDamage` in
 *        src/store/slices/endgame.ts, called from every combat
 *        damage-routing site in src/core/combat/damage.ts
 *        (embertide-4uyn.1). Currently the only authored payload is
 *        `damage-reduction`, which stacks additively across owned items
 *        and clamps at 0 incoming damage.
 *      - 'on-monster-defeated' — when the owner defeats a monster (any
 *        kind: regular, mini-boss, wild-boss, region-boss). Dispatched
 *        by `applyMonsterDefeatedPassives` from `fightMonster` and
 *        `defeatAlwaysAvailableMonster` in src/store/slices/combat.ts.
 *        StS-relic event-trigger flavour: the kid earns a small reward
 *        per kill (e.g. +1 gem, draw 1) on top of the monster's drop.
 *    Additional triggers land in later units if the reducer hook set grows.
 *  - `effect`: the nested payload fired when `trigger` matches.
 */
export interface ItemPassiveEffect {
  readonly kind: 'item-passive';
  readonly description: string;
  readonly trigger: 'start-of-turn' | 'on-combat-enter' | 'on-damage' | 'on-monster-defeated';
  readonly effect: InnerEffectSpec;
}

/**
 * A single face of a `roll-die` outcome table (REQ-13 Phase 2a / gm0.7).
 * `DieFace` is the closed tuple `1 | 2 | 3 | 4 | 5 | 6` — a template-
 * literal type would widen to `string`, so we keep it as a union. The
 * outcomes map is typed as `Record<DieFace, RollDieOutcomeEffect>` which
 * enforces REQ-10 fail-forward-floor coverage at the type level: every
 * face 1..6 is REQUIRED, so a partial outcomes table is a compile error.
 */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Cosmetic flavor tag for an `Omen` (the named keyword that the
 * `roll-die` EffectSpec implements — keyword-glossary §DICE/OMEN). The
 * tag is **purely cosmetic**: it changes the card's wording/theme only
 * (`Omen(Song)` / `Omen(Ancient)` / `Omen(Shadow)`), never the roll
 * mechanics. No resolver branches on this value — see
 * `src/core/omen.ts` (`resolveOmenFace` ignores the flavor) and its
 * cosmetic-only test. `'none'` is the untagged default; the field is
 * optional on `RollDieEffect` and absence is equivalent to `'none'`.
 */
export type OmenFlavor = 'song' | 'ancient' | 'shadow' | 'none';

/**
 * `roll-die`: resolve a player-visible d6 via `pickOneOfThreeD6`
 * (REQ-9e) and dispatch the inner effect on the picked face.
 *
 * `outcomes` is a total map — every face 1..6 MUST declare an inner
 * effect, so the fail-forward-floor invariant (REQ-10) is satisfied by
 * the type alone: an outcomes table missing a face, or declaring a
 * face as `{}` / `null`, fails `tsc`. Runtime validation is therefore
 * limited to cross-check that every declared inner effect is a
 * well-formed EffectSpec (covered by `src/balance/rollDie.test.ts`).
 *
 * Nesting constraint: the inner effect is `RollDieOutcomeEffect`, i.e.
 * `EffectSpec` minus `item-passive` AND `roll-die` itself. Roll-die
 * outcomes cannot wrap another roll-die (cascading dice are out of
 * scope for v2.1 — a roll that produces a roll is a correctness /
 * balance hazard best handled by a dedicated effect shape later), and
 * cannot wrap an item-passive (item-passives are always-on triggers,
 * dispatching one from a dice face is a shape mismatch).
 *
 * Schema-only landing (gm0.7): the reducer path that drives the 3-d6
 * pick UI and dispatches the chosen face's effect ships in gm0.10
 * (forest-sage omen) / gm0.11 (tutorial wiring). This unit gates the
 * new kind through `effectTextFor` + `_exhaustivenessGate` so every
 * downstream consumer adds its own case the next time it touches the
 * cascade.
 */
export interface RollDieEffect {
  readonly kind: 'roll-die';
  readonly outcomes: Readonly<Record<DieFace, RollDieOutcomeEffect>>;
  /**
   * Optional cosmetic Omen flavor tag (keyword-glossary §DICE/OMEN).
   * Absence is equivalent to `'none'`. Never read by any resolver — it
   * only drives card-text theming. The bounded-variance invariant
   * (`assertOmenBoundedVariance` in `src/core/omen.ts`) requires the
   * `outcomes` map to be range-grouped (faces 1-2 / 3-4 / 5-6 share an
   * outcome) so a `roll-die` effect is a well-formed Omen.
   *
   * Soft-control (`±1` result adjustment) is deliberately NOT a field
   * here: per the glossary it ships as a relic-only modifier
   * (`OmenSoftControl` in `src/core/omen.ts`), never printed on a card.
   */
  readonly omen?: OmenFlavor;
}

/**
 * `banish-from-hand`: target player chooses N cards from their hand and
 * moves them to their `banished` pile. Deck-thinning mechanic landed as
 * the framework half of embertide-91p; no v2.0/v2.1 card declares
 * this kind yet (specific cards ship in follow-up beads per 91p's
 * commit-sequence plan (a) framework → (b) cards → (c) tuning).
 *
 * Mechanical contract:
 *  - `amount`: number of cards to banish (>= 1). Framework landing
 *    allows any positive integer; card authors decide the appropriate
 *    value per card. UI (selection modal) lands with the first card
 *    that uses this effect.
 *  - Banished cards move to `KidPlayer.banished` (a permanent pile
 *    retained for debug visibility + future "return N banished cards"
 *    mechanics without a schema migration).
 *  - Target player is the player on whose behalf the effect fires
 *    (playCard → active player; other dispatch sites TBD in (b)).
 */
export interface BanishFromHandEffect {
  readonly kind: 'banish-from-hand';
  readonly amount: number;
}

/**
 * `banish-from-discard`: target player chooses N cards from their
 * discard pile and moves them to their `banished` pile. Deck-thinning
 * mechanic landed as the framework half of embertide-91p; no v2.0/
 * v2.1 card declares this kind yet.
 *
 * Distinct from `banish-from-hand` because:
 *  - source pile differs (hand vs discard — UI shows different cards)
 *  - timing differs: discard banishing is asynchronous cleanup that
 *    rewards patient play; hand banishing is targeted, on-play agency
 *  - reducers keep separate call signatures so consumers can switch
 *    exhaustively without a mode-flag
 *
 * See `BanishFromHandEffect` for the general contract.
 */
export interface BanishFromDiscardEffect {
  readonly kind: 'banish-from-discard';
  readonly amount: number;
}

/**
 * `equip-bonus`: main-phase fire awarded when an item ENTERS the player's
 * Items zone (`trigger: 'on-equip'`). Schema landing for
 * embertide-wun Track A (embertide-4t2d) — gives buyable items a
 * small, immediate main-phase grant so equipping a g4 bow no longer feels
 * inert until the next combat. Combat behaviour stays in
 * `EXPLICIT_OVERRIDES` (src/data/combatEffects.ts); EffectSpec is the
 * authoring surface for the main-phase grant only.
 *
 * Resource alphabet (locked by designer for v2.1):
 *   - 'gem'        — +N green shards on the owning player.
 *   - 'power'      — +N red power on the owning player.
 *   - 'shield'     — declarative tag for a +N damage-reduction buff
 *                    on equip; combat-side absorb stays sourced from
 *                    `EXPLICIT_OVERRIDES.combat-absorb`. v2.1 ships the
 *                    schema; the runtime damage-reduction reducer
 *                    follows in a per-card tuning bead, so 'shield'
 *                    on-equip is currently authoring-only and the
 *                    dispatcher leaves player state unchanged.
 *   - 'card-draw'  — owner draws +N cards from their deck (uses the
 *                    shared seeded RNG so the draw is deterministic
 *                    under replay). Empty-deck reshuffle is handled
 *                    by `drawCards` per the standard deck contract.
 *
 * Trigger semantics:
 *   - 'on-equip' — fires ONCE at the moment the card enters the Items
 *                  zone (playCard → item branch, buyFromField → item
 *                  branch). Does NOT re-fire on subsequent turns.
 *                  Skipped when the equip falls back to discard (cap
 *                  overflow) — the bonus only lands if the card
 *                  actually slotted. Single-value tag retained for
 *                  authoring intent + symmetry with other discriminated
 *                  effect shapes; per-turn relic grants live on
 *                  `ItemPassiveEffect` (Card.passive) instead.
 */
export interface EquipBonusEffect {
  readonly kind: 'equip-bonus';
  readonly resource: 'gem' | 'power' | 'shield' | 'card-draw';
  readonly amount: number;
  readonly trigger: 'on-equip';
}

/**
 * `shard-grant`: declarative annotation that this card grants one or more
 * shared Embertide shards (REQ-13 Phase 2d / gm0.4). Parallel declarative
 * path alongside the existing `CombatOnDefeatShardGrant` payload that
 * COMBAT_RESOLVE_WIN consumes (`shardGrants` field on the resolve action,
 * sourced from `BossAttackPattern.onDefeatEffect`). The combat path stays
 * authoritative for region-boss defeats; this EffectSpec discriminant is
 * for OTHER shard sources — Princess-crystal grants, future shard-bearing
 * items, etc. — so authoring can declare the origin at the card schema
 * boundary rather than only via reducer code.
 *
 * Mechanical contract:
 *  - `shards`: non-empty list of embertide shard ids granted on the
 *    declared trigger. Order doesn't matter (the shared `sharedTriforce`
 *    setter is idempotent), but authoring should keep entries unique to
 *    avoid an obviously-wrong duplicate flip.
 *  - The reducer hooks that fire the grant on play (or on the
 *    appropriate trigger) ship in follow-up units. This unit lands the
 *    SCHEMA + the effectText render path so downstream consumers add
 *    their own case the next time they touch the EffectSpec cascade.
 *  - Discriminant naming MIRRORS `CombatOnDefeatShardGrant.kind` (also
 *    `'shard-grant'`) — the two unions are distinct (`EffectSpec` vs
 *    `CombatOnDefeatEffect`) so no real collision exists, but keeping
 *    the literal aligned makes the existing rerollTokens denylist
 *    (`outcomeProducesShard` in src/store/gameStore.ts) catch
 *    EffectSpec-shaped shard outcomes too without widening.
 */
export interface ShardGrantEffect {
  readonly kind: 'shard-grant';
  readonly shards: ReadonlyArray<'wisdom' | 'courage' | 'power'>;
}

/**
 * Discriminated union of every card effect shape currently authored in
 * src/data/cards.ts. Exhaustive by construction — adding a new kind requires
 * updating every consumer's switch statement (the `never` default branch
 * enforces this at the type level).
 */
export type EffectSpec =
  | GainEffect
  | RupeeEffect
  | DrawEffect
  | CombatBonusEffect
  | DamageReductionEffect
  | MonsterDropEffect
  | HealEffect
  | ChestDrawEffect
  | OnPlayPowerEffect
  | OnPlayGreenAndDrawEffect
  | OnPlayGreenAndPowerEffect
  | ItemPassiveEffect
  | RollDieEffect
  | BanishFromHandEffect
  | BanishFromDiscardEffect
  | ShardGrantEffect
  | EquipBonusEffect;

/**
 * EffectSpec restricted to kinds that may appear as the payload of an
 * `item-passive`. Excludes `item-passive` itself so the recursion bottoms
 * out at a single level — an `ItemPassiveEffect` cannot wrap another
 * `ItemPassiveEffect`. Enforced at the type level (compile-time).
 */
export type InnerEffectSpec = Exclude<EffectSpec, ItemPassiveEffect>;

/**
 * EffectSpec restricted to kinds that may appear as a `roll-die`
 * outcome payload (REQ-13 Phase 2a / gm0.7). Excludes:
 *  - `item-passive` (shape mismatch — passives are always-on triggers,
 *    not one-shot dice effects)
 *  - `roll-die` itself (cascading dice are out of scope for v2.1; a
 *    face that rolls another die re-enters the pick UI and is a UX
 *    hazard)
 *  - `shard-grant` (REQ-13 Phase 2d / gm0.4 — shards are story-driven
 *    rewards, NEVER a probabilistic dice outcome; mirrors the
 *    rerollTokens runtime denylist in `outcomeProducesShard` so the
 *    "no-shard-rolls" invariant is enforced both at compile time AND
 *    defensively at runtime per REQ-7b greedy-shard simulation)
 *  - `equip-bonus` (embertide-4t2d — the equip-bonus shape only
 *    has a coherent meaning when an item enters the Items zone;
 *    granting an equip-bonus from a transient dice face is a shape
 *    mismatch with no equip event to attach to)
 * Enforced at the type level.
 */
export type RollDieOutcomeEffect = Exclude<
  EffectSpec,
  ItemPassiveEffect | RollDieEffect | ShardGrantEffect | EquipBonusEffect
>;

/**
 * Discriminant type useful for switch-statement exhaustiveness proofs.
 */
export type EffectKind = EffectSpec['kind'];

/**
 * Type guard: runtime-narrow an unknown value to `MonsterDropEffect`.
 *
 * Same defect class as embertide-bv5 (fixed for `effectText.tsx`):
 * a structural `as MonsterDropEffect` cast on an `unknown`-shaped input
 * silently succeeds for primitives, arrays, `null`, and wrong-shape
 * objects — `effects.hearts` then evaluates to `undefined` instead of
 * failing fast. This guard gives callers a single safe narrowing point.
 *
 * Accepts non-null non-array objects carrying `kind === 'monster-drop'`
 * and a numeric `hearts`; the optional `keys` field (present on some
 * drops, u-6a/b/c) is checked only when present. Consumers should treat
 * a `false` return as "no drop" and fall back to a zero-heal / zero-key
 * default.
 */
export function isMonsterDropEffect(value: unknown): value is MonsterDropEffect {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.kind !== 'monster-drop') return false;
  if (typeof record.hearts !== 'number') return false;
  if (record.keys !== undefined && typeof record.keys !== 'number') return false;
  // r94e: gems / cardDraw are optional numerics layered onto the drop
  // shape. Mirror the keys check so malformed authoring is rejected at
  // the type-guard boundary instead of leaking `undefined` arithmetic
  // into the dispatcher.
  if (record.gems !== undefined && typeof record.gems !== 'number') return false;
  if (record.cardDraw !== undefined && typeof record.cardDraw !== 'number') return false;
  return true;
}
