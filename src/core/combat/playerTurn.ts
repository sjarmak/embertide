/**
 * Players-turn handlers (§B4): card play, effect application, pass.
 *
 * These are pure helpers consumed by the master `combatTurnReducer`.
 * They never observe the boss's turn directly — only the players-turn
 * branch of the discriminated action union routes here.
 */

import type { BattlefieldCard } from '../../types/combat';
import type { CombatEffect } from '../../types/combatEffect';
import type { Card } from '../../types/card';
import { COMBAT_PLAYS_PER_TURN } from '../balance';
import { baseIdOf as baseIdOfCard } from '../../data/cards';
import type { CombatTurnState, PlayerPlayCardAction } from './types';
import { drawIntoHand, mulberry32 } from './deck';
import {
  arenaDamageModifier,
  exposedBonusFor,
  resolveCombatEffect,
  routeSwarmAttack,
} from './damage';
import type { CombatBoss } from '../../types/combat';
import {
  applyDuelAdaptivePenalty,
  applyItemCheckOpenTrigger,
  routeLayeredDamage,
} from './archetypeResolvers';

export function reducePlayerPlayCard(
  state: CombatTurnState,
  action: PlayerPlayCardAction,
): CombatTurnState {
  if (state.combat.activeActor !== 'players') return state;
  if (state.playsThisTurn >= COMBAT_PLAYS_PER_TURN) return state;

  const handIndex = state.combat.combatHand.findIndex((c) => c.id === action.cardId);
  if (handIndex < 0) return state;

  const card = state.combat.combatHand[handIndex];
  const nextHand = state.combat.combatHand.slice();
  nextHand.splice(handIndex, 1);
  const nextDiscard = state.combat.combatDiscard.slice();
  nextDiscard.push(card);

  const rawEffect = resolveCombatEffect(card);

  // embertide-lhlo.14: Duel-archetype Adaptive penalty. When the boss
  // carries `archetype: 'duel'` and the played effect kind has already
  // been played this turn, subtract `adaptive.penalty` from the effect's
  // damage (clamped at 0). The FIRST play of each kind is always
  // unaffected. Non-duel bosses return null (fast path — no allocation).
  //
  // Card-class key: `CombatEffect.kind` is the best available discriminant
  // until Card.cardType lands.
  // TODO(lhlo.32 / kw.card-typing): key on Card.cardType once it lands.
  const duelResult = applyDuelAdaptivePenalty(
    state.combat.boss,
    rawEffect,
    state.adaptiveTurnTracker,
  );
  const effect = duelResult !== null ? duelResult.effect : rawEffect;
  const nextAdaptiveTracker =
    duelResult !== null ? duelResult.nextTracker : state.adaptiveTurnTracker;

  const afterEffect = applyPlayerEffect(state, effect, nextHand, nextDiscard, card);

  // u-9c: persist the seat id that just played so `determineDefeatingHero`
  // can route the COMBAT_RESOLVE_WIN heirloom drop to the player whose
  // play landed the finishing blow. Write AFTER applyPlayerEffect so the
  // effect-builder doesn't have to worry about the field. Pure — never
  // mutates `state.combat` in place.
  // embertide-44w8: also update `echoQueue` with the running max
  // single-play power for this players-turn. The hollow-effigy-mirror
  // resolver reads this on the next boss-turn. Power 0 (combat-draw,
  // combat-absorb, combat-heal) leaves the queue untouched; the resolver
  // falls back to base dpt when echoQueue stays null. We store the FIRST
  // card to hit the running max (strict `>`) so the sourceCardId is
  // stable across ties.
  const playedPower = playPower(effect);
  const currentEcho = afterEffect.combat.echoQueue ?? null;
  const nextEcho =
    playedPower > 0 && (currentEcho === null || playedPower > currentEcho.power)
      ? { power: playedPower, sourceCardId: card.id }
      : currentEcho;

  // embertide-4hr1.1: Item-Check archetype open-trigger. When the
  // played card's `tags` include the boss's `guarded.until` (e.g.
  // cinder-bloom with `tags: ['item-tag-bomb']` against Cinderwyrm),
  // flip the boss to exposed{revertsTo: <prior-guarded>}. Pure boss-
  // only transform; no-op for every other archetype and for plays
  // without matching tags. The triggering play does NOT itself benefit
  // from the new exposed bonus — `applyPlayerEffect` already read
  // `exposedBonusFor` above. Subsequent plays this turn DO benefit
  // (mirror of the eye archetype's flip-then-next-play cadence).
  const bossAfterTrigger = applyItemCheckOpenTrigger(afterEffect.combat.boss, card);

  const withOwner: CombatTurnState = {
    ...afterEffect,
    // embertide-lhlo.14: thread the updated adaptive tracker so
    // subsequent plays in this players-turn see the accumulated history.
    adaptiveTurnTracker: nextAdaptiveTracker,
    combat: {
      ...afterEffect.combat,
      boss: bossAfterTrigger,
      lastPlayerToPlay: action.playerId,
      echoQueue: nextEcho,
    },
  };

  // WIN detection: boss.hp may have dropped to 0 after this play.
  if (withOwner.combat.boss.hp <= 0) {
    return {
      ...withOwner,
      combat: { ...withOwner.combat, activeActor: 'players' },
      terminal: 'win',
    };
  }

  return {
    ...withOwner,
    playsThisTurn: state.playsThisTurn + 1,
  };
}

/**
 * Single-play "power" for echo-queue tracking (embertide-44w8).
 *
 * Returns the damage scalar of a play, used by the hollow-effigy-mirror
 * resolver to mirror the player's strongest play back at them. Per the
 * spec at `docs/design/hollow-effigy-attack-pattern.md`:
 *
 *   - `combat-attack`: damage value
 *   - `combat-attack-stun`: damage component (the stun is orthogonal)
 *   - `combat-multishot`: per-shot damage scalar (NOT damage × shots —
 *     multishot is N independent volleys; the mirror reads the highest
 *     SINGLE play power, so multishot's "power" is its base damage)
 *   - `combat-absorb` / `combat-heal` / `combat-draw`: 0 (defensive /
 *     non-damage plays don't fuel the echo)
 *
 * Pure / total — exhaustive switch with `never` default keeps new
 * effect kinds visible at compile time.
 */
function playPower(effect: CombatEffect): number {
  switch (effect.kind) {
    case 'combat-attack':
      return effect.damage;
    case 'combat-attack-stun':
      return effect.damage;
    case 'combat-multishot':
      return effect.damage;
    // Defensive / control plays: no damage scalar contributed to echo queue.
    case 'combat-absorb':
    case 'combat-heal':
    case 'combat-draw':
    case 'combat-weaken':
    case 'combat-vulnerable':
      return 0;
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}

/**
 * Single-target damage application for the players-turn damage paths
 * (combat-attack, combat-attack-stun, combat-multishot per shot).
 *
 * Routes through `routeLayeredDamage` (embertide-lhlo.11) first:
 * when the boss is a Layered archetype, damage falls on the first
 * non-defeated layer with overflow carrying to subsequent layers.
 * Killing the last (core) layer sets boss.hp to 0, triggering the
 * win-check above.
 *
 * Routes through `routeSwarmAttack` (embertide-ki0o) next: when the
 * boss is a Swarm archetype with active minions — damage lands on the
 * first non-defeated minion (or on `boss.hp` once all minions are down).
 *
 * For every other archetype both routers short-circuit (return the same
 * reference), and we fall back to the legacy `boss.hp - damage` path
 * with `Math.max(0, …)` clamping.
 *
 * The `total` argument MUST already include `exposedBonusFor(boss)` —
 * the exposed-window bonus stacks on the routed damage regardless of
 * which target it lands on (the boss is exposed; every routed hit gets
 * the bonus).
 *
 * Pure: input boss is not mutated.
 */
function applySingleTargetBossDamage(boss: CombatBoss, total: number): CombatBoss {
  // embertide-lhlo.11: layered-archetype bosses route damage to the
  // first non-defeated layer, with overflow carrying to subsequent layers.
  const layered = routeLayeredDamage(boss, total);
  if (layered !== boss) return layered;
  const routed = routeSwarmAttack(boss, total);
  if (routed !== boss) return routed;
  // Legacy path: non-layered, non-swarm boss → damage hits boss.hp directly.
  const nextHp = Math.max(0, boss.hp - total);
  return { ...boss, hp: nextHp };
}

/**
 * Apply the (inline-default) combat-effect from a just-played card.
 * u-8b only fires `combat-attack`; other kinds of effect land with
 * u-8d's data sheet. For forward compatibility the function is
 * structured as an exhaustive switch so future kinds need explicit
 * handling.
 */
function applyPlayerEffect(
  state: CombatTurnState,
  effect: CombatEffect,
  nextHand: readonly Card[],
  nextDiscard: readonly Card[],
  playedCard: Card,
): CombatTurnState {
  switch (effect.kind) {
    case 'combat-attack': {
      const boss = state.combat.boss;
      // embertide-z45d: exposed-window bonus stacks onto played damage.
      // embertide-ki0o: swarm-archetype bosses route damage to their
      // first non-defeated minion (or the central head once all minions
      // are down). Non-swarm bosses fall through to the legacy boss.hp
      // path inside `applySingleTargetBossDamage`.
      // embertide-lhlo.26: the colosseum arena's global damage
      // modifier stacks onto the exposed bonus at every player→boss
      // attack site.
      // lhlo.23 §VULNERABLE: the vulnerable bonus accumulated this
      // players-turn stacks onto every attack. Clamp at 0 so combined
      // negative modifiers (dampening arena, etc.) can never heal boss.
      const total = Math.max(
        0,
        effect.damage +
          exposedBonusFor(boss) +
          arenaDamageModifier(state.combat) +
          (state.combat.vulnerableBonus ?? 0),
      );
      const nextBoss = applySingleTargetBossDamage(boss, total);
      return {
        ...state,
        combat: {
          ...state.combat,
          boss: nextBoss,
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-absorb': {
      // Persist the played card's base id (not the `'combat-absorb'` effect
      // literal) so the CombatBattlefield UI can resolve a Card from the
      // shared registries (KID_CARDS + ALWAYS_AVAILABLE) to render its
      // display name + illustration (embertide-y88).
      const newCard: BattlefieldCard = {
        cardId: baseIdOfCard(playedCard),
        hp: effect.hp,
        hpMax: effect.hp,
        combatEffectId: `combat-absorb:${effect.hp}`,
      };
      return {
        ...state,
        combat: {
          ...state.combat,
          battlefield: [...state.combat.battlefield, newCard],
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-heal': {
      // Heal routes to the front battlefield card if any exist, else
      // no-op (player-heal requires an explicit target selector that
      // u-8d's data sheet will introduce). Pure, conservative default.
      const field = state.combat.battlefield;
      if (field.length === 0) {
        return {
          ...state,
          combat: {
            ...state.combat,
            combatHand: nextHand,
            combatDiscard: nextDiscard,
          },
        };
      }
      const [head, ...rest] = field;
      const healedHp = Math.min(head.hpMax, head.hp + effect.amount);
      return {
        ...state,
        combat: {
          ...state.combat,
          battlefield: [{ ...head, hp: healedHp }, ...rest],
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-draw': {
      // Deterministic per-combat RNG for the discard→deck reshuffle.
      // Seeded off combatEntryTurn + turnIndex + current discard size
      // so re-running the same combat with the same sequence of
      // actions reshuffles the same way. `state.seed` is on the outer
      // KidGameState which isn't in CombatTurnState; using the combat-
      // local trio is still deterministic inside a given combat.
      const reshuffleRng = mulberry32(
        state.combat.entryContext.combatEntryTurn * 100003 +
          state.combat.turnIndex * 10007 +
          nextDiscard.length * 31 +
          7,
      );
      const drawn = drawIntoHand(
        state.combat.combatDeck,
        nextHand,
        nextDiscard,
        effect.count,
        reshuffleRng,
      );
      return {
        ...state,
        combat: {
          ...state.combat,
          combatDeck: drawn.deck,
          combatHand: drawn.hand,
          combatDiscard: drawn.discard,
        },
      };
    }
    case 'combat-multishot': {
      // embertide-z45d: exposed-window bonus stacks PER SHOT — each
      // volley is an independent attack landing on the exposed boss.
      // embertide-ki0o: each shot routes through the swarm router
      // independently, so a multishot can knock down a finger then move
      // its remaining shots to the next finger (or, after the last
      // finger drops, to the central head). Early-out on boss.hp <= 0
      // is still correct: minion damage doesn't touch boss.hp, so the
      // exit fires only after every minion is defeated AND the head
      // dies.
      // embertide-lhlo.26: arena global modifier stacks per shot,
      // same as the exposed bonus (each volley is an independent attack
      // landing inside the same arena). lhlo.23 §VULNERABLE: vulnerable
      // bonus stacks per shot too. Clamp at 0 per shot.
      const perShotDamage = Math.max(
        0,
        effect.damage +
          exposedBonusFor(state.combat.boss) +
          arenaDamageModifier(state.combat) +
          (state.combat.vulnerableBonus ?? 0),
      );
      let bossAcc = state.combat.boss;
      for (let i = 0; i < effect.shots; i += 1) {
        bossAcc = applySingleTargetBossDamage(bossAcc, perShotDamage);
        if (bossAcc.hp <= 0) break;
      }
      return {
        ...state,
        combat: {
          ...state.combat,
          boss: bossAcc,
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-attack-stun': {
      // u-9b / REQ-32: damage + control beat. Reduce boss HP by
      // `damage` AND accumulate `stunTurns` on `combat.bossStunTurns`;
      // `reduceBossResolve` consumes one stun counter per boss-turn and
      // skips the attack routing in that window. embertide-z45d:
      // exposed-window bonus stacks onto the damage component; the
      // stun count is unaffected by the exposed state (orthogonal).
      // embertide-ki0o: swarm-archetype bosses route the damage
      // component through `routeSwarmAttack` (first finger first, head
      // last); the stun is orthogonal and accrues regardless of which
      // body part absorbed the hit.
      const boss = state.combat.boss;
      // embertide-lhlo.26: the colosseum arena's global damage
      // modifier stacks onto the exposed bonus at every player→boss
      // attack site. lhlo.23 §VULNERABLE: vulnerable bonus stacks too.
      // Clamp at 0 so a negative (dampening) arena can never heal boss.
      const total = Math.max(
        0,
        effect.damage +
          exposedBonusFor(boss) +
          arenaDamageModifier(state.combat) +
          (state.combat.vulnerableBonus ?? 0),
      );
      const nextBoss = applySingleTargetBossDamage(boss, total);
      const currentStun = state.combat.bossStunTurns ?? 0;
      return {
        ...state,
        combat: {
          ...state.combat,
          boss: nextBoss,
          bossStunTurns: currentStun + effect.stunTurns,
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-weaken': {
      // lhlo.23 §WEAKEN: accumulate weaken stacks on the boss.
      // `reduceBossResolve` subtracts `bossWeakenStacks` from the
      // resolved damage on the boss's NEXT turn then clears the
      // counter. Purely a debuff — no damage component.
      const currentWeaken = state.combat.bossWeakenStacks ?? 0;
      return {
        ...state,
        combat: {
          ...state.combat,
          bossWeakenStacks: currentWeaken + effect.amount,
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    case 'combat-vulnerable': {
      // lhlo.23 §VULNERABLE: accumulate a damage bonus on the boss
      // that stacks onto player→boss attack sites for the remainder of
      // this players-turn (and is cleared at EOT in reduceBossResolve).
      const currentVulnerable = state.combat.vulnerableBonus ?? 0;
      return {
        ...state,
        combat: {
          ...state.combat,
          vulnerableBonus: currentVulnerable + effect.amount,
          combatHand: nextHand,
          combatDiscard: nextDiscard,
        },
      };
    }
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}

export function reducePlayerPass(state: CombatTurnState): CombatTurnState {
  if (state.combat.activeActor !== 'players') return state;
  return {
    ...state,
    combat: { ...state.combat, activeActor: 'boss' },
    playsThisTurn: 0,
    // embertide-lhlo.14: reset the duel-archetype tracker each
    // players-turn so each turn starts with a clean slate.
    adaptiveTurnTracker: undefined,
  };
}
