/**
 * Damage routing helpers (§B3): battlefield absorption, player-hp
 * splitting, AoE, desperation-targeting override, and the pessimistic
 * LOSS check used by the boss-turn reducer.
 */

import type {
  ArenaState,
  BattlefieldCard,
  BossAttackPattern,
  BossLayer,
  BossStateSwarm,
  BossStateTag,
  CombatBoss,
  CombatState,
  Hazard,
} from '../../types/combat';
import type { CombatEffect } from '../../types/combatEffect';
import type { Card } from '../../types/card';
import type { KidPlayer } from '../../store/types';
import { applyDamage } from '../../store/gameStore';
import { reduceIncomingDamage } from '../../store/slices/endgame';
import { DESPERATION_HP_PCT } from '../balance';
import { combatEffectFor } from '../../data/combatEffects';

/**
 * Front-to-back damage absorption across the battlefield. The first
 * card absorbs as much damage as its `hp` allows; if its hp drops to
 * 0 or below, the card is removed and any residual damage spills
 * into the next card. Returns the new battlefield AND the residual
 * damage that leaked past the last card — callers route residual to
 * players for `'battlefield-then-player'` targeting.
 *
 * Pure: input `battlefield` array is not mutated.
 */
export function applyBattlefieldDamage(
  battlefield: readonly BattlefieldCard[],
  amount: number,
): { battlefield: BattlefieldCard[]; residual: number } {
  if (amount <= 0) {
    return { battlefield: battlefield.slice(), residual: 0 };
  }
  const remaining = battlefield.slice();
  let damage = amount;
  const survivors: BattlefieldCard[] = [];

  for (let i = 0; i < remaining.length; i += 1) {
    const card = remaining[i];
    if (damage <= 0) {
      survivors.push(card);
      continue;
    }
    if (card.hp > damage) {
      survivors.push({ ...card, hp: card.hp - damage });
      damage = 0;
    } else {
      damage -= card.hp;
      // card drops — do not push
    }
  }

  return { battlefield: survivors, residual: damage };
}

/**
 * Combat-effect resolver. Delegates to u-8d's data-sheet
 * (`src/data/combatEffects.ts`) so per-card overrides (tower-shield →
 * combat-absorb, wisp → combat-heal) land automatically. The
 * default rule there maps unoverridden cards to `combat-attack`
 * with damage = card.cost.red ?? 1.
 */
export function resolveCombatEffect(card: Card): CombatEffect {
  return combatEffectFor(card);
}

/**
 * Read the bonus damage modifier from `boss.stateTags` if an
 * `exposed` tag is present (embertide-z45d, sub of lhlo).
 * Returns 0 when no exposed tag exists or its `bonus` is undefined.
 *
 * Archetype-agnostic — keys off the tag, not `boss.archetype`. Any
 * future archetype that exposes a vulnerability window via the same
 * tag (item-check after the bomb tag breaks the guard, layered after
 * the shell falls, etc.) picks up bonus consumption for free.
 *
 * Consumed by the player→boss damage sites in `applyPlayerEffect`
 * (combat-attack, combat-attack-stun, combat-multishot — bonus
 * stacks per-shot for multishot since each volley is an independent
 * attack landing on the exposed boss).
 */
export function exposedBonusFor(boss: CombatBoss): number {
  const tags = boss.stateTags;
  if (!tags) return 0;
  for (const tag of tags) {
    if (tag.kind === 'exposed') {
      return tag.bonus ?? 0;
    }
  }
  return 0;
}

/**
 * Sum the global damage modifier contributed by the combat's arena
 * (embertide-lhlo.26). Returns 0 when the combat carries no arena
 * (every field / wild-boss / region-boss combat) or when the arena
 * declares no `global-damage-modifier` effect.
 *
 * Read at BOTH damage directions so the modifier is "visible to both
 * player and boss damage math": the player→boss sites in
 * `applyPlayerEffect` add it alongside `exposedBonusFor`, and the
 * boss→player site in `reduceBossResolve` adds it to the resolved
 * per-turn damage. Multiple modifiers sum additively; the read sites
 * clamp the final per-attack total at 0.
 */
export function arenaDamageModifier(combat: CombatState): number {
  const arena = combat.arena;
  if (!arena) return 0;
  let sum = 0;
  for (const effect of arena.effects) {
    switch (effect.kind) {
      case 'global-damage-modifier':
        sum += effect.amount;
        break;
      default: {
        // Exhaustiveness proof: a new ArenaEffect variant forces a touch
        // here rather than silently contributing 0 to the modifier.
        const _exhaustive: never = effect.kind;
        return _exhaustive;
      }
    }
  }
  return sum;
}

/**
 * Tick every end-of-turn hazard on the combat's arena once
 * (embertide-lhlo.26). Called from the end-of-boss-turn pass in
 * `reduceBossResolve` (both the stun-skip and normal branches) so a
 * hazard fires on every boss-turn regardless of boss stun.
 *
 * For each hazard with `remainingTurns > 0`: apply its effect to the
 * live players, then decrement `remainingTurns`. Hazards that reach 0
 * after firing are pruned from the returned arena, so a hazard authored
 * with `remainingTurns: N` fires exactly N times.
 *
 * Returns the (possibly-undefined) input arena unchanged plus the
 * untouched player snapshot when there is no arena or no live hazard —
 * making the call a cheap no-op for every non-colosseum combat.
 *
 * Pure: inputs are not mutated.
 */
export function applyArenaHazards(
  arena: ArenaState | undefined,
  players: readonly KidPlayer[],
): {
  arena: ArenaState | undefined;
  players: readonly KidPlayer[];
  logs: readonly string[];
} {
  if (!arena || arena.hazards.length === 0) {
    return { arena, players, logs: [] };
  }

  let nextPlayers = players;
  const logs: string[] = [];
  const nextHazards: Hazard[] = [];

  for (const hazard of arena.hazards) {
    if (hazard.remainingTurns <= 0) continue; // spent — prune.
    switch (hazard.kind) {
      case 'eot-damage': {
        // Guard the damage + log on a positive amount so a malformed
        // hazard (amount <= 0) is an inert tick — it still counts down
        // its duration but deals nothing and emits no misleading log
        // line. `routeAoePlayerDamage` already no-ops on amount <= 0;
        // the guard keeps the combat log consistent with that.
        if (hazard.amount > 0) {
          nextPlayers = routeAoePlayerDamage(nextPlayers, hazard.amount);
          logs.push(`${hazard.label}: ${hazard.amount} damage to all heroes.`);
        }
        break;
      }
      default: {
        const _exhaustive: never = hazard.kind;
        return _exhaustive;
      }
    }
    const remaining = hazard.remainingTurns - 1;
    if (remaining > 0) {
      nextHazards.push({ ...hazard, remainingTurns: remaining });
    }
  }

  return { arena: { ...arena, hazards: nextHazards }, players: nextPlayers, logs };
}

/**
 * Effective targeting after desperation override. §B3 + §B4: when
 * `boss.hp < DESPERATION_HP_PCT * boss.hpMax`, switch to `'aoe'`
 * regardless of the pattern's declared targeting.
 */
export function effectiveTargeting(boss: CombatBoss): BossAttackPattern['targeting'] {
  if (boss.hp < DESPERATION_HP_PCT * boss.hpMax) {
    return 'aoe';
  }
  return boss.attackPattern.targeting;
}

/**
 * Split damage evenly across non-downed players per `'player-hp'`
 * targeting. Remainder (from integer division) lands on the
 * active-attacker — the first id in `entryContext.attackerPlayerIds`
 * that resolves to a non-downed player.
 *
 * Returns the new KidPlayer[] with `applyDamage` applied.
 */
export function routePlayerHpDamage(
  players: readonly KidPlayer[],
  amount: number,
  attackerPlayerIds: readonly string[],
): readonly KidPlayer[] {
  if (amount <= 0) return players;
  const live = players.filter((p) => !p.downed);
  if (live.length === 0) return players;

  const per = Math.floor(amount / live.length);
  const remainder = amount - per * live.length;

  // Pick the active attacker: first entry in attackerPlayerIds that
  // resolves to a non-downed player. If none resolves, fall back to
  // the first non-downed player in the list.
  let attackerId: string | null = null;
  for (const id of attackerPlayerIds) {
    const match = live.find((p) => p.id === id);
    if (match !== undefined) {
      attackerId = match.id;
      break;
    }
  }
  if (attackerId === null && live.length > 0) {
    attackerId = live[0].id;
  }

  return players.map((player) => {
    if (player.downed) return player;
    const baseAmount = per;
    const extra = player.id === attackerId ? remainder : 0;
    const total = baseAmount + extra;
    if (total <= 0) return player;
    // embertide-4uyn.1: per-player on-damage passive reduction
    // (iron-ward et al.) fires once per damage instance — each player
    // pays their own reduction against their own share. Stacking is
    // additive; clamped at 0 inside reduceIncomingDamage.
    const reduced = reduceIncomingDamage(player, total);
    if (reduced <= 0) return player;
    return applyDamage(player, reduced);
  });
}

/**
 * Apply `amount` damage to every non-downed player simultaneously.
 * Used by `'aoe'` targeting and by the desperation override.
 */
export function routeAoePlayerDamage(
  players: readonly KidPlayer[],
  amount: number,
): readonly KidPlayer[] {
  if (amount <= 0) return players;
  return players.map((player) => {
    if (player.downed) return player;
    // embertide-4uyn.1: AoE damage is also reduced per-player by
    // on-damage passives — each seat pays its own reduction. A player
    // holding iron-ward in an AoE wave eats 1 less while the teammate
    // without iron-ward eats the full hit.
    const reduced = reduceIncomingDamage(player, amount);
    if (reduced <= 0) return player;
    return applyDamage(player, reduced);
  });
}

/**
 * Swarm-archetype damage router (embertide-ki0o, sub of lhlo +
 * 4hr1). Single-target version: damage hits the FIRST non-defeated
 * minion (left-to-right scan); if every minion is defeated, damage
 * lands on `boss.hp` (the central head). Overdamage on a minion is
 * WASTED — no spillover to the next minion or to the head — keeping
 * each finger an explicit target the player must clear (Dead Hand
 * canon: "fingers grasp first, head bites only when caught").
 *
 * Returns the SAME boss reference (===) when:
 *  - `boss.archetype !== 'swarm'`, OR
 *  - the boss carries no `stateTags[].kind === 'swarm'`, OR
 *  - `damage <= 0`.
 *
 * That short-circuit lets call sites in `playerTurn.ts` route every
 * single-target hit through this helper without per-archetype guards
 * — non-swarm bosses fall through to the legacy `boss.hp - damage`
 * arithmetic the caller already runs (the routed boss is unchanged
 * here; the caller still does its own `Math.max(0, …)` clamp).
 *
 * For consumer callers, the typical pattern is:
 *
 *   const total = effect.damage + exposedBonusFor(boss);
 *   const routed = routeSwarmAttack(boss, total);
 *   if (routed === boss) {
 *     // legacy: hit boss.hp directly with clamp
 *     const nextHp = Math.max(0, boss.hp - total);
 *     return { ...boss, hp: nextHp };
 *   }
 *   return routed;
 *
 * Pure: input boss / stateTags / minions arrays are not mutated.
 *
 * AoE companion: see `routeSwarmAoeAttack` — currently no card emits
 * `combat-aoe-attack` against the boss, but the helper ships
 * dead-but-correct so a future AoE consumer drops in cleanly.
 */
export function routeSwarmAttack(boss: CombatBoss, damage: number): CombatBoss {
  if (damage <= 0) return boss;
  const swarm = findSwarm(boss);
  if (swarm === null) return boss;

  const { tags, swarmTag, minions } = swarm;
  const targetIndex = minions.findIndex((m) => !m.defeated);

  if (targetIndex < 0) {
    // Every minion is defeated (or list is empty) — damage hits the
    // central head directly.
    return { ...boss, hp: Math.max(0, boss.hp - damage) };
  }

  // Single-target: drop full damage onto the first non-defeated
  // minion, no spillover. Overdamage is wasted by design.
  const nextMinions = minions.slice();
  nextMinions[targetIndex] = applyMinionDamage(minions[targetIndex], damage);
  return { ...boss, stateTags: replaceSwarmTag(tags, swarmTag, nextMinions) };
}

/**
 * Swarm-archetype AoE damage router. Hits every non-defeated minion
 * AND the central head simultaneously, full damage to each. Pure;
 * returns the same boss reference for non-swarm bosses or non-positive
 * damage.
 *
 * No player card emits a boss-side AoE attack today; the helper ships
 * dead-but-correct so the spec's AoE-vs-single-target contract is
 * stamped in code (and so a future `combat-aoe-attack` effect can wire
 * straight in).
 */
export function routeSwarmAoeAttack(boss: CombatBoss, damage: number): CombatBoss {
  if (damage <= 0) return boss;
  const swarm = findSwarm(boss);
  if (swarm === null) return boss;

  const { tags, swarmTag, minions } = swarm;
  const nextMinions = minions.map((minion) =>
    minion.defeated ? minion : applyMinionDamage(minion, damage),
  );
  return {
    ...boss,
    hp: Math.max(0, boss.hp - damage),
    stateTags: replaceSwarmTag(tags, swarmTag, nextMinions),
  };
}

/**
 * Module-private type predicate narrowing a `BossStateTag` to
 * `BossStateSwarm`. Lets `Array.prototype.find` return a properly-typed
 * `BossStateSwarm | undefined` in one pass — no follow-up
 * `kind === 'swarm'` re-check or bracket lookup needed.
 */
function isSwarmTag(tag: BossStateTag): tag is BossStateSwarm {
  return tag.kind === 'swarm';
}

/**
 * Internal: locate a Swarm-archetype boss's swarm tag. Returns `null`
 * for any boss the swarm router should leave untouched (non-swarm
 * archetype, missing/empty stateTags, no swarm tag in the list).
 *
 * Pure / O(stateTags) on hit, O(1) on miss. Both swarm routers (single-
 * target and AoE) share this prelude so the exhaustiveness check stays
 * single-source. Returns the swarm tag itself (not its index) so the
 * writeback can use reference equality — no second `findIndex` pass.
 */
function findSwarm(boss: CombatBoss): {
  tags: readonly BossStateTag[];
  swarmTag: BossStateSwarm;
  minions: readonly BossLayer[];
} | null {
  if (boss.archetype !== 'swarm') return null;
  const tags = boss.stateTags;
  if (!tags) return null;
  const swarmTag = tags.find(isSwarmTag);
  if (swarmTag === undefined) return null;
  return { tags, swarmTag, minions: swarmTag.minions };
}

/**
 * Internal: produce a new `BossLayer` reflecting `damage` taken (clamped
 * at hp 0; `defeated` flips once hp reaches 0). Caller is responsible
 * for skipping already-defeated minions when AoE-iterating.
 */
function applyMinionDamage(minion: BossLayer, damage: number): BossLayer {
  const nextHp = Math.max(0, minion.hp - damage);
  return { ...minion, hp: nextHp, defeated: nextHp <= 0 };
}

/**
 * Internal: rebuild the `stateTags` array with `prevSwarmTag` replaced by
 * a new swarm tag carrying `nextMinions`. Reference-equality match — the
 * tag identified by `findSwarm` is the exact same object reference still
 * present in `tags`, so `Array.prototype.map` swaps it cleanly without a
 * second index lookup. All other tags (exposed, guarded, cycle, …) are
 * preserved by reference.
 *
 * Pure — returns a new array; the caller's input is untouched.
 */
function replaceSwarmTag(
  tags: readonly BossStateTag[],
  prevSwarmTag: BossStateSwarm,
  nextMinions: readonly BossLayer[],
): readonly BossStateTag[] {
  return tags.map((tag) => (tag === prevSwarmTag ? { kind: 'swarm', minions: nextMinions } : tag));
}

/**
 * Pessimistic LOSS check: project the incoming damage onto the
 * player snapshot and return true if every non-downed player would
 * be downed afterwards. Used by `combatTurnReducer` during
 * `BOSS_RESOLVE` to flag the terminal LOSS state without actually
 * committing the damage twice.
 *
 * Mirrors the `applyDamage` arithmetic exactly so the projection
 * stays faithful.
 */
export function wouldAllBeDowned(projectedPlayers: readonly KidPlayer[]): boolean {
  if (projectedPlayers.length === 0) return false;
  return projectedPlayers.every((p) => p.downed);
}
