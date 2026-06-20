/**
 * Boss-turn reducer (§B4): consumes the static attack pattern + any
 * dynamic resolver, routes damage by targeting, applies player
 * side-effects, advances the turn counter, and flags terminal LOSS.
 */

import type { BattlefieldCard, CombatState } from '../../types/combat';
import type { CombatTerminal, CombatTurnState } from './types';
import {
  applyArenaHazards,
  applyBattlefieldDamage,
  arenaDamageModifier,
  effectiveTargeting,
  routeAoePlayerDamage,
  routePlayerHpDamage,
  wouldAllBeDowned,
} from './damage';
import { BOSS_ATTACK_RESOLVERS, type BossResolveOutcome } from './bossResolvers';
import { applyArchetypeTick } from './archetypeResolvers';
import { applyPhaseThresholds } from './phaseThresholds';

export function reduceBossResolve(state: CombatTurnState): CombatTurnState {
  if (state.combat.activeActor !== 'boss') return state;

  // u-9b / REQ-32 heirloom stun: if `bossStunTurns > 0`, skip the
  // attack routing for this boss-turn, decrement the counter by one,
  // and hand control back to players. turnIndex still advances so
  // desperation thresholds and combat-log ordering stay consistent.
  const stun = state.combat.bossStunTurns ?? 0;
  if (stun > 0) {
    // embertide-lhlo.26: arena hazards are environmental — they
    // tick at end-of-boss-turn even when the boss itself is stunned
    // and skips its attack. A hazard can down the last live player on
    // a stun turn, so recompute terminal from the post-hazard snapshot.
    const hz = applyArenaHazards(state.combat.arena, state.players);
    const terminal: CombatTerminal = wouldAllBeDowned(hz.players) ? 'loss' : null;
    const existingLog = state.combat.combatLog ?? [];
    // lhlo.17: phase-threshold step fires even on stun turns — HP may
    // have dropped below a threshold during the players-turn (before
    // the stun was checked), so we must check and record any crossing.
    const tickedBossStun = applyArchetypeTick(state.combat.boss);
    const phaseTickedBossStun = applyPhaseThresholds(tickedBossStun);
    return {
      ...state,
      combat: {
        ...state.combat,
        boss: phaseTickedBossStun,
        arena: hz.arena,
        bossStunTurns: stun - 1,
        // lhlo.23: EOT clears weaken and vulnerable even on a stun-skip
        // turn — the boss-turn ticked; the debuffs are consumed.
        bossWeakenStacks: 0,
        vulnerableBonus: 0,
        turnIndex: state.combat.turnIndex + 1,
        activeActor: terminal === null ? 'players' : 'boss',
        combatLog: hz.logs.length > 0 ? [...existingLog, ...hz.logs] : existingLog,
      },
      players: hz.players,
      terminal,
      playsThisTurn: 0,
      // embertide-lhlo.14: reset the duel-archetype tracker at EOT
      // so the next players-turn starts with a clean slate.
      adaptiveTurnTracker: undefined,
    };
  }

  const boss = state.combat.boss;
  const targeting = effectiveTargeting(boss);

  // gdd.1.2: optional dynamic resolver dispatch. When the pattern
  // declares `bossAttackResolver`, route the boss-turn through the
  // named resolver (damage + side effects + log entries). Falls back
  // to the legacy static `damagePerTurn` path when absent or unknown.
  const resolverId = boss.attackPattern.bossAttackResolver;
  const resolver = resolverId !== undefined ? BOSS_ATTACK_RESOLVERS[resolverId] : undefined;
  const outcome: BossResolveOutcome | null = resolver ? resolver(state.combat) : null;
  const baseDamage = outcome !== null ? outcome.damage : boss.attackPattern.damagePerTurn;
  // embertide-lhlo.26: the arena's global damage modifier is also
  // visible to the boss→player direction.
  // lhlo.23 §WEAKEN: subtract the accumulated weaken stacks from the
  // boss's resolved damage this turn, then consume the counter. Clamp
  // at 0 so a dampening arena + weaken can't turn a boss attack into a
  // player heal.
  const weakenReduction = state.combat.bossWeakenStacks ?? 0;
  const damage = Math.max(0, baseDamage + arenaDamageModifier(state.combat) - weakenReduction);

  let battlefield = state.combat.battlefield;
  let players = state.players;

  if (targeting === 'aoe') {
    // AoE: hit every battlefield card with full damage, AND every
    // non-downed player with full damage, simultaneously.
    const nextField: BattlefieldCard[] = [];
    for (const card of battlefield) {
      const hp = card.hp - damage;
      if (hp > 0) nextField.push({ ...card, hp });
    }
    battlefield = nextField;
    players = routeAoePlayerDamage(players, damage);
  } else if (targeting === 'battlefield-then-player') {
    const result = applyBattlefieldDamage(battlefield, damage);
    battlefield = result.battlefield;
    if (result.residual > 0) {
      players = routePlayerHpDamage(
        players,
        result.residual,
        state.combat.entryContext.attackerPlayerIds,
      );
    }
  } else {
    // 'player-hp'
    players = routePlayerHpDamage(players, damage, state.combat.entryContext.attackerPlayerIds);
  }

  // gdd.1.2: post-routing resolver side-effects (chain-discard,
  // resource drain). Run AFTER damage routing so the player snapshot
  // already reflects HP changes when the side effect projects onto
  // it; ensures a chain-discard doesn't double-fire on a player who
  // just got downed by the same boss-turn.
  if (outcome?.playerSideEffect) {
    players = outcome.playerSideEffect(players);
  }

  // embertide-lhlo.26: end-of-boss-turn arena hazard tick. Fires
  // each hazard once and decrements its duration, applying hazard
  // damage to the live players. Runs AFTER the boss attack + resolver
  // side-effects so terminal LOSS reflects the full turn's damage.
  // No-op (same references) for every non-colosseum combat.
  const hz = applyArenaHazards(state.combat.arena, players);
  players = hz.players;

  const terminal: CombatTerminal = wouldAllBeDowned(players) ? 'loss' : null;

  const existingLog = state.combat.combatLog ?? [];
  const outcomeLog = outcome !== null && outcome.combatLog.length > 0 ? outcome.combatLog : [];
  const mergedLog =
    outcomeLog.length > 0 || hz.logs.length > 0
      ? [...existingLog, ...outcomeLog, ...hz.logs]
      : existingLog;

  // embertide-3986: end-of-boss-turn archetype tick. Evolves
  // `boss.stateTags` by one step (e.g. Eye archetype's guarded↔exposed
  // cycle). No-op when `boss.archetype` is undefined or the archetype
  // has no resolver wired yet.
  const tickedBoss = applyArchetypeTick(state.combat.boss);

  // embertide-lhlo.17: phase-threshold step. Checks whether the boss's
  // current HP fraction has crossed any registered threshold for the first
  // time and applies the (idempotent, remix-only) transition. No-op for
  // bosses without `phaseThresholds`. Runs AFTER archetype tick so the tick
  // and the phase remix are both visible in the resulting boss state.
  const phaseTickedBoss = applyPhaseThresholds(tickedBoss);

  // embertide-4hr1.9 / 4w8a: spread-order contract. `combatPatch` is
  // spread AFTER `boss: tickedBoss` to apply resolver-specific bookkeeping
  // (e.g. hollow-effigy clearing `echoQueue`). The contract — that resolvers
  // MUST NOT include `boss` in `combatPatch`, since doing so would roll back
  // the archetype tick from `applyArchetypeTick` — is now compile-time
  // enforced via `Omit<Partial<CombatState>, 'boss'>` on
  // `BossResolveOutcome.combatPatch`. If a resolver legitimately needs to
  // override the post-tick boss (multi-phase transitions), add a dedicated
  // `bossOverride` field rather than reopening the `boss` key.
  //
  // embertide-lhlo.26: `arena: hz.arena` carries this turn's hazard
  // tick and is subject to the same contract — `arena` is likewise
  // excluded from `combatPatch` so a resolver can't roll back the tick.
  const nextCombat: CombatState = {
    ...state.combat,
    boss: phaseTickedBoss,
    battlefield,
    arena: hz.arena,
    turnIndex: state.combat.turnIndex + 1,
    activeActor: terminal === null ? 'players' : 'boss',
    combatLog: mergedLog,
    // lhlo.23: EOT clears both debuff counters — weaken was already
    // applied to `damage` above; vulnerable was applied at the
    // player→boss attack sites. Both reset so the next players-turn
    // starts clean.
    bossWeakenStacks: 0,
    vulnerableBonus: 0,
    ...(outcome?.combatPatch ?? {}),
  };

  return {
    ...state,
    combat: nextCombat,
    players,
    terminal,
    playsThisTurn: 0,
    // embertide-lhlo.14: reset the duel-archetype tracker at EOT
    // so the next players-turn starts with a clean slate.
    adaptiveTurnTracker: undefined,
  };
}
