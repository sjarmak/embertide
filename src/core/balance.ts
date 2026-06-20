/**
 * Combat balance constants (v2.1 combat layer, u-8b, PRD §B2/B3/B4).
 *
 * Named tunables referenced by the combat engine (`src/core/combatEngine.ts`)
 * and the entry/exit wiring layer (u-8c `src/core/combat.ts`). Keeping them
 * here rather than inline gives playtest + the balance-sim extension
 * (u-8h) a single location to tweak dials without searching through
 * reducer code.
 *
 * No runtime logic lives in this module — it is data-only. New constants
 * land here rather than in reducer modules so the tuning surface is
 * enumerable at a glance.
 */

/**
 * Desperation threshold (PRD §B3 + §B4). When `boss.hp < DESPERATION_HP_PCT
 * * boss.hpMax`, the effective `BossAttackPattern.targeting` becomes
 * `'aoe'` regardless of the pattern's declared targeting. v2.1 ships at
 * 0.25 — the final quarter of boss HP forces a panic-mode AoE on every
 * boss-turn until the fight resolves.
 */
export const DESPERATION_HP_PCT = 0.25;

/**
 * Combat-hand cap (PRD §B2 / sign-off Q3). Any draw effect that would
 * push `combatHand.length` above this value routes the overflow straight
 * to `combatDiscard` instead of the hand. Applies to the initial
 * combat-entry draw AND to any in-combat `combat-draw` effect.
 */
export const COMBAT_HAND_CAP = 5;

/**
 * Initial combat-entry draw (PRD §B2). The count of cards dealt from
 * `combatDeck` into `combatHand` at `COMBAT_ENTER` time. Matches the
 * hand cap so a fresh combat starts with a full hand.
 */
export const COMBAT_INITIAL_DRAW = 5;

/**
 * Per-players-turn action budget (PRD §B4 / sign-off Q1). Shared across
 * both seats during a players-turn — either player may spend any
 * portion of the three plays. The `combatTurnReducer` tracks the count
 * via `CombatTurnState.playsThisTurn` and refuses further
 * `PLAYER_PLAY_CARD` actions once the budget is exhausted.
 */
export const COMBAT_PLAYS_PER_TURN = 3;
