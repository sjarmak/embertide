/**
 * Combat engine public API barrel (v2.1 combat layer, u-8b, PRD §B2/B3/B4).
 *
 * Pure functions + a reducer that power the MTG-style boss-combat
 * sub-state. This module is intentionally isolated from main-board
 * glue: it imports the combat schema (u-8a), the KidPlayer shape, and
 * the `applyDamage` helper, but it does NOT touch the Zustand store or
 * the main-board action router. The wiring layer (u-8c
 * `src/core/combat.ts`) composes this module's output into the
 * `KidGameState.activeCombat` field via the `COMBAT_ENTER` /
 * `COMBAT_RESOLVE_WIN` / `COMBAT_RESOLVE_LOSS` reducer actions.
 *
 * Implementation lives under `./combat/`:
 *   - `types.ts` — engine state envelope + action union
 *   - `identity.ts` — base-id stripping + role predicates
 *   - `deck.ts` — deck assembly, initial draw, refill, mulberry32
 *   - `damage.ts` — battlefield absorption, hp routing, desperation
 *   - `playerTurn.ts` — players-turn handlers + `playPower`
 *   - `bossResolvers/*` — per-boss dynamic resolvers + dispatch table
 *   - `bossTurn.ts` — boss-turn reducer
 *   - `turnReducer.ts` — master `combatTurnReducer`
 *   - `endgame.ts` — `determineDefeatingHero`
 *
 * Per-card combat-effect resolution lives in `src/data/combatEffects.ts`
 * (u-8d data sheet). The default rule there maps unoverridden cards to
 * `combat-attack` with damage = card.cost.red ?? 1.
 */

export type {
  CombatTerminal,
  CombatTurnState,
  PlayerPlayCardAction,
  PlayerPassAction,
  BossResolveAction,
  CombatTurnAction,
} from './combat/types';

export { baseIdOf, isWispCard } from './combat/identity';

export { mulberry32, buildCombatDeck, initialCombatDraw } from './combat/deck';

export {
  applyArenaHazards,
  applyBattlefieldDamage,
  arenaDamageModifier,
  exposedBonusFor,
} from './combat/damage';

export { combatTurnReducer } from './combat/turnReducer';

export {
  TIDEWRAITH_TENTACLE_GRAB_BASE_DPT,
  TIDEWRAITH_TENTACLE_GRAB_MAX_DPT,
  TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD,
  tidewraithTentacleGrabDpt,
  TIDEWRAITH_LOG_TELEGRAPH_PREFIX,
  TIDEWRAITH_LOG_WILL_HIT,
  TIDEWRAITH_LOG_TENTACLES_DRAG,
  IRON_SENTINEL_BURST_BONUS,
  IRON_SENTINEL_LOG_WINDUP,
  IRON_SENTINEL_LOG_HEAVY_SWING,
  IRON_SENTINEL_LOG_STAGGERED,
  IRON_SENTINEL_LOG_ARMOR_CRACKS,
  HOLLOW_EFFIGY_BASE_DPT,
  HOLLOW_EFFIGY_MAX_DPT,
  HOLLOW_EFFIGY_LOG_FINDS_NOTHING,
  HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST,
  PHANTOM_VURMOX_VOLLEY_FIRE_BONUS,
  PHANTOM_VURMOX_LOG_CHARGE,
  PHANTOM_VURMOX_LOG_VOLLEY,
  KNELL_LOG_TELEGRAPH,
  KNELL_LOG_SLAM,
  HEXTWINS_LOG_FIRE_HITS,
  HEXTWINS_LOG_ICE_FREEZES,
  TRINITY_AUROGAX_LOG_GLOOM,
  TRINITY_AUROGAX_LOG_UMBRA,
  TRINITY_AUROGAX_LOG_ANCIENT,
  TRINITY_AUROGAX_LOG_AUREN,
} from './combat/bossResolvers';

export {
  applyArchetypeTick,
  applyDuelArchetypeTick,
  applyDuelAdaptivePenalty,
  applyEyeArchetypeTick,
  EYE_EXPOSED_BONUS,
  EYE_REVERT_GUARDED_UNTIL,
} from './combat/archetypeResolvers';

export { determineDefeatingHero } from './combat/endgame';
