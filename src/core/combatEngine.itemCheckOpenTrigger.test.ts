/**
 * Item-Check archetype OPEN-WINDOW player-action trigger wiring tests
 * (embertide-4hr1.1, sub of lhlo + 4hr1). Companion to the
 * colocated unit tests in
 * `combat/archetypeResolvers/itemCheck.test.ts` — those exercise the
 * pure boss-only transform; this file proves the WIRING into
 * `reducePlayerPlayCard` fires when a player plays a card whose
 * `tags` overlap with the boss's `BossStateGuarded.until`.
 *
 * Sister wiring file: `combatEngine.eyeArchetypeResolver.test.ts`
 * covers the eye archetype's end-of-boss-turn flip; this file covers
 * the item-check open-trigger's player-action flip.
 */

import { describe, it, expect } from 'vitest';
import type {
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { Card } from '../types/card';
import type { KidPlayer } from '../store/types';
import { combatTurnReducer, type CombatTurnState } from './combatEngine';
import { ITEM_CHECK_EXPOSED_BONUS } from './combat/archetypeResolvers';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'cinderwyrm',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'colosseum-slot',
};

const CINDERWYRM_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
};

function makeVolvagia(): CombatBoss {
  return {
    hp: 16,
    hpMax: 16,
    attackPattern: CINDERWYRM_PATTERN,
    sourceCardId: 'cinderwyrm',
    archetype: 'item-check',
    stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
  };
}

function makeBombItemCard(): Card {
  return {
    id: 'cinder-bloom-test-copy',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'gain', red: 1 },
    combatEffect: { kind: 'combat-attack', damage: 1 },
    tags: ['item-tag-bomb'],
  };
}

function makeNonBombItemCard(): Card {
  return {
    id: 'ancient-sword-test-copy',
    role: 'item',
    cost: { green: 5 },
    effects: { kind: 'gain', red: 1 },
    combatEffect: { kind: 'combat-attack', damage: 1 },
    tags: ['item-tag-arrow'],
  };
}

function makeUntaggedAttackCard(): Card {
  return {
    id: 'starter-attack-1',
    role: 'starter-red',
    cost: { red: 1 },
    effects: { kind: 'shard', red: 1 },
    combatEffect: { kind: 'combat-attack', damage: 1 },
  };
}

function makeCombat(boss: CombatBoss, hand: readonly Card[]): CombatState {
  return {
    boss,
    combatDeck: [],
    combatHand: hand,
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext: ENTRY_CTX,
    combatLog: [],
    playsThisTurn: 0,
    bossStunTurns: 0,
    tideGaugeSnapshot: 0,
    echoQueue: null,
  };
}

function makeTurnState(
  combat: CombatState,
  players: readonly KidPlayer[] = [
    makeKidPlayer({ id: 'p0', hp: 10 }),
    makeKidPlayer({ id: 'p1', hp: 10 }),
  ],
): CombatTurnState {
  return { combat, players, terminal: null, playsThisTurn: 0 };
}

// ---------------------------------------------------------------------------
// Wiring — open-window flip via PLAYER_PLAY_CARD.
// ---------------------------------------------------------------------------

describe('Item-Check open-window trigger via PLAYER_PLAY_CARD (4hr1.1)', () => {
  it('Cinderwyrm flips guarded(item-tag-bomb) → exposed{revertsTo} when an item-tag-bomb card is played', () => {
    const card = makeBombItemCard();
    const state = makeTurnState(makeCombat(makeVolvagia(), [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    expect(next.combat.boss.stateTags).toEqual([
      {
        kind: 'exposed',
        bonus: ITEM_CHECK_EXPOSED_BONUS,
        revertsTo: { kind: 'guarded', until: 'item-tag-bomb' },
      },
    ]);
  });

  it('Cinderwyrm stays guarded when a card without the matching tag is played', () => {
    const card = makeNonBombItemCard();
    const state = makeTurnState(makeCombat(makeVolvagia(), [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    expect(next.combat.boss.stateTags).toEqual([{ kind: 'guarded', until: 'item-tag-bomb' }]);
  });

  it('Cinderwyrm stays guarded when an untagged starter card is played', () => {
    const card = makeUntaggedAttackCard();
    const state = makeTurnState(makeCombat(makeVolvagia(), [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    expect(next.combat.boss.stateTags).toEqual([{ kind: 'guarded', until: 'item-tag-bomb' }]);
  });

  it('triggering play does NOT benefit from the freshly-applied exposed bonus (flip happens after damage)', () => {
    const card = makeBombItemCard(); // combat-attack damage=1
    const state = makeTurnState(makeCombat(makeVolvagia(), [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    // Cinderwyrm hpMax is 16; only the base 1 damage lands on the
    // triggering play (no exposed bonus yet — boss was guarded when
    // damage applied, and the item-check guard is purely tag-driven so
    // the read sees `bonus = 0`).
    expect(next.combat.boss.hp).toBe(16 - 1);
  });

  it('subsequent play in the same turn DOES benefit from the exposed bonus', () => {
    const bombCard = makeBombItemCard();
    const followUp = makeUntaggedAttackCard(); // damage=1 starter
    const state = makeTurnState(makeCombat(makeVolvagia(), [bombCard, followUp]));

    const afterBomb = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: bombCard.id,
      playerId: 'p0',
    });

    const afterFollowUp = combatTurnReducer(afterBomb, {
      type: 'PLAYER_PLAY_CARD',
      cardId: followUp.id,
      playerId: 'p0',
    });

    // Boss hp: 16 - 1 (bomb base, no bonus on triggering play)
    //         - (1 + ITEM_CHECK_EXPOSED_BONUS) (follow-up benefits from bonus)
    expect(afterFollowUp.combat.boss.hp).toBe(16 - 1 - (1 + ITEM_CHECK_EXPOSED_BONUS));

    // Boss is still in the exposed state after the follow-up (close-window
    // resolver only fires at end-of-boss-turn).
    expect(afterFollowUp.combat.boss.stateTags?.[0].kind).toBe('exposed');
  });

  it('non-item-check boss (eye) is unaffected by a tagged card play', () => {
    const eyeBoss: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: CINDERWYRM_PATTERN,
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };
    const card: Card = { ...makeBombItemCard(), tags: ['cycle-trigger'] };
    const state = makeTurnState(makeCombat(eyeBoss, [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    // Eye stateTags untouched — open-trigger is item-check-only.
    expect(next.combat.boss.stateTags).toEqual([
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ]);
  });

  it('a second matching-tag play while boss is already exposed is a no-op on stateTags (does not re-enter guarded)', () => {
    const bombCard = makeBombItemCard();
    const followUpBomb: Card = { ...makeBombItemCard(), id: 'cinder-bloom-test-copy-2' };
    const state = makeTurnState(makeCombat(makeVolvagia(), [bombCard, followUpBomb]));

    const afterFirst = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: bombCard.id,
      playerId: 'p0',
    });
    expect(afterFirst.combat.boss.stateTags?.[0].kind).toBe('exposed');

    const afterSecond = combatTurnReducer(afterFirst, {
      type: 'PLAYER_PLAY_CARD',
      cardId: followUpBomb.id,
      playerId: 'p0',
    });

    expect(afterSecond.combat.boss.stateTags).toEqual(afterFirst.combat.boss.stateTags);
  });

  it('preserves the original `until` discriminant byte-for-byte across the open flip (so close-window can restore it)', () => {
    const fireDragonGuard: CombatBoss = {
      ...makeVolvagia(),
      stateTags: [{ kind: 'guarded', until: 'item-tag-fire-arrow' }],
    };
    const card: Card = { ...makeBombItemCard(), tags: ['item-tag-fire-arrow'] };
    const state = makeTurnState(makeCombat(fireDragonGuard, [card]));

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });

    const tag = next.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag');
    expect(tag.revertsTo).toEqual({ kind: 'guarded', until: 'item-tag-fire-arrow' });
  });
});
