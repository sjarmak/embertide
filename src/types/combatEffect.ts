/**
 * CombatEffect — discriminated union of every combat-card effect shape
 * (PRD §B5). Extracted from `combat.ts` (embertide-bq9b / ppf9-7a) so
 * `Card.combatEffect` can declare an in-card combat behaviour without
 * pulling the full combat sub-state shape into card.ts.
 *
 * Pure data; no Card dependency. `combat.ts` re-exports every name in
 * this module so existing import sites continue to work; downstream
 * cleanup migrates direct importers to this path over time.
 */

/** Deal N damage to `boss.hp`. */
export interface CombatAttackEffect {
  readonly kind: 'combat-attack';
  readonly damage: number;
}

/**
 * Enter the battlefield with `hp: N`. The card becomes a
 * `BattlefieldCard` for the front-to-back damage absorption chain.
 */
export interface CombatAbsorbEffect {
  readonly kind: 'combat-absorb';
  readonly hp: number;
}

/** Restore N hp to a battlefield card or non-downed player. */
export interface CombatHealEffect {
  readonly kind: 'combat-heal';
  readonly amount: number;
}

/** Draw N cards from `combatDeck` into `combatHand`. */
export interface CombatDrawEffect {
  readonly kind: 'combat-draw';
  readonly count: number;
}

/** Deal `damage` Y (`shots`) times to `boss.hp` — independent volleys. */
export interface CombatMultishotEffect {
  readonly kind: 'combat-multishot';
  readonly damage: number;
  readonly shots: number;
}

/**
 * Deal `damage` to `boss.hp` AND stun the boss for `stunTurns` upcoming
 * boss-turns (increments `CombatState.bossStunTurns`). u-9b / REQ-32
 * heirloom wiring: `craghorn-tusk` ships `{damage:4, stunTurns:1}` — the
 * signature "damage + control" beat that separates heirlooms from
 * vanilla `combat-attack` cards. When stun is resolving,
 * `reduceBossResolve` skips the attack routing and decrements
 * `bossStunTurns` by one; the turnIndex still advances so desperation
 * and session telemetry stay consistent.
 */
export interface CombatAttackStunEffect {
  readonly kind: 'combat-attack-stun';
  readonly damage: number;
  readonly stunTurns: number;
}

/**
 * Apply a Weaken X debuff to the boss: the boss's NEXT attack deals X
 * less damage (increments `CombatState.bossWeakenStacks`). Consumed on
 * the boss's next attack — `reduceBossResolve` subtracts `bossWeakenStacks`
 * from the resolved damage then clears the counter to 0. Multiple Weaken
 * plays accumulate additively (two Weaken 2 plays = 4 reduction on the
 * next boss attack). The counter clears after a single boss-turn
 * regardless of whether the boss attacked (mirrors stun's
 * decrement-on-boss-turn pattern: consumed on the very next boss turn).
 *
 * lhlo.23 keyword-glossary §WEAKEN.
 */
export interface CombatWeakenEffect {
  readonly kind: 'combat-weaken';
  readonly amount: number;
}

/**
 * Apply a Vulnerable X buff to the target: the target takes X MORE
 * damage from ALL sources until END OF TURN (increments
 * `CombatState.vulnerableBonus`). The bonus stacks additively with
 * other damage modifiers at every player→boss attack site and is cleared
 * at the end of the boss's next turn (EOT). Stacks additively when
 * multiple Vulnerable plays land in the same players-turn.
 *
 * lhlo.23 keyword-glossary §VULNERABLE.
 */
export interface CombatVulnerableEffect {
  readonly kind: 'combat-vulnerable';
  readonly amount: number;
}

/**
 * Discriminated union of every combat-card effect shape. Exhaustive by
 * construction — adding a new kind requires updating every consumer's
 * switch statement (`never` default branch enforces this at the type
 * level).
 */
export type CombatEffect =
  | CombatAttackEffect
  | CombatAbsorbEffect
  | CombatHealEffect
  | CombatDrawEffect
  | CombatMultishotEffect
  | CombatAttackStunEffect
  | CombatWeakenEffect
  | CombatVulnerableEffect;

/** Convenience alias for switch-statement exhaustiveness proofs. */
export type CombatEffectKind = CombatEffect['kind'];
