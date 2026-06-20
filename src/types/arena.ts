/**
 * Arena — typed schema for the colosseum's identity primitive
 * (embertide-lhlo.26, sub of lhlo). An Arena bundles two
 * orthogonal, glossary-defined ideas:
 *
 *  - **Arena Effect** (`ArenaEffect`): a GLOBAL combat modifier that
 *    applies to BOTH the players' attacks and the boss's attacks for
 *    the duration of the combat. The keyword glossary
 *    (`bd memories embertide-keyword-glossary-2026-05-02`) defines
 *    an Arena Effect as "a rule that applies to both players" — here
 *    realized as a flat damage modifier read at every damage site.
 *  - **Hazard** (`Hazard`): an END-OF-TURN effect that fires once per
 *    boss-turn for a bounded number of turns (rotating environmental
 *    pressure per tier/slot).
 *
 * This is NOT a brand-new mid-fight mechanic — both pieces are remixes
 * of vocabulary the engine already speaks. The global modifier reuses
 * the additive-bonus shape that `exposedBonusFor` already stacks onto
 * player damage; the hazard reuses the boss's per-turn flat-damage
 * shape, fired from the same end-of-boss-turn pass as the archetype
 * tick.
 *
 * Pure data — no timers, no async, no React references. Consumers
 * narrow the discriminated unions via an exhaustive `kind` switch with
 * a compiler-level `never` check in the default branch.
 *
 * Adding a new variant: extend the relevant union, then update every
 * exhaustive switch (the `_exhaustive: never` default branch enforces
 * this at the type level — see `arena.test.ts`).
 */

// ---------------------------------------------------------------------------
// Arena Effect — global combat modifiers (apply to BOTH sides).
// ---------------------------------------------------------------------------

/**
 * A flat damage modifier added to every attack's damage scalar for the
 * duration of the combat — read at BOTH the player→boss damage sites
 * (`applyPlayerEffect`) and the boss→player damage site
 * (`reduceBossResolve`). `amount` may be negative (a "dampening" arena);
 * the final per-attack total is clamped at 0 by the read sites, so a
 * negative modifier can never heal a target.
 *
 * Stacks additively with `exposedBonusFor` on the player side — an
 * exposed window inside a `+1` arena lands `effect.damage + exposedBonus
 * + 1`.
 */
export interface ArenaGlobalDamageModifier {
  readonly kind: 'global-damage-modifier';
  /** Flat amount added to every attack's damage (may be negative). */
  readonly amount: number;
  /** Plain-language label surfaced to the combat log / UI. */
  readonly label: string;
}

/**
 * Discriminated union of arena-wide effects. One member today; the
 * `kind` discriminant keeps future global rules (e.g. a flat
 * damage-reduction shield, a draw-tax) additive without widening read
 * sites that only care about the damage modifier.
 */
export type ArenaEffect = ArenaGlobalDamageModifier;

/** Convenience alias for switch-statement exhaustiveness proofs. */
export type ArenaEffectKind = ArenaEffect['kind'];

// ---------------------------------------------------------------------------
// Hazard — end-of-turn environmental effects.
// ---------------------------------------------------------------------------

/**
 * End-of-boss-turn damage to every non-downed player. Fires once per
 * boss-turn (alongside the archetype tick) for `remainingTurns` turns,
 * decrementing by one each time it fires. A hazard authored with
 * `remainingTurns: N` fires exactly N times, then goes inert (and is
 * pruned from the arena's hazard list).
 *
 * Reuses the boss's flat per-turn damage shape — `amount` is dealt to
 * each live player via the same AoE router (`routeAoePlayerDamage`)
 * that the boss's own `'aoe'` targeting uses, so per-player on-damage
 * passives (iron-ward et al.) reduce hazard ticks just like any other
 * incoming damage.
 */
export interface ArenaEotDamageHazard {
  readonly kind: 'eot-damage';
  /** Damage dealt to each non-downed player on every tick. */
  readonly amount: number;
  /**
   * Number of end-of-turn ticks remaining. Decremented by one each
   * time the hazard fires; the hazard is dropped from the arena once
   * this reaches 0. Authored as the hazard's total duration.
   */
  readonly remainingTurns: number;
  /** Plain-language label surfaced to the combat log / UI. */
  readonly label: string;
}

/**
 * Discriminated union of end-of-turn hazards. One member today; the
 * `kind` discriminant keeps future hazards (e.g. an EOT discard, a
 * heal-the-boss spring) additive.
 */
export type Hazard = ArenaEotDamageHazard;

/** Convenience alias for switch-statement exhaustiveness proofs. */
export type HazardKind = Hazard['kind'];

// ---------------------------------------------------------------------------
// Arena container — attached to CombatState only for colosseum combats.
// ---------------------------------------------------------------------------

/**
 * The per-combat arena. Attached to `CombatState.arena` ONLY when a
 * combat is entered via the colosseum slot router
 * (`entrySource === 'colosseum-slot'`). Field/wild-boss/region-boss
 * combats leave `CombatState.arena` undefined — arena state never
 * bleeds into map-zone combats by construction.
 *
 *  - `effects`: global modifiers in force for the whole combat.
 *  - `hazards`: end-of-turn hazards, each ticking down independently.
 */
export interface ArenaState {
  /** Plain-language arena name (e.g. "Quaking Coliseum"). */
  readonly name: string;
  /** Global combat modifiers active for the duration. */
  readonly effects: readonly ArenaEffect[];
  /** End-of-turn hazards; each fires once per boss-turn until spent. */
  readonly hazards: readonly Hazard[];
}
