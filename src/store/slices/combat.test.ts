import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSeededRng } from '../../rules/chestPool';
import type { Card } from '../../types/card';
import type { CombatState } from '../../types/combat';
import type { KidGameState, KidPlayer } from '../types';
import { grantHeirloom, HEIRLOOM_DROPS } from './combat';
import { determineDefeatingHero } from '../../core/combatEngine';
import { baseIdOf } from '../../data/cards';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Test fixtures (u-9c).
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer()],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    boss: {
      hp: 0,
      hpMax: 8,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'battlefield-then-player',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
    },
    combatDeck: [],
    combatHand: [],
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext: {
      bossCardId: 'craghorn',
      combatEntryTurn: 1,
      attackerPlayerIds: ['p0', 'p1'],
      engagementSource: 'fightMonster',
      entrySource: 'wild-boss-slot',
    },
    ...overrides,
  };
}

// Silence console.warn inside grantHeirloom's cap-exhausted path so the
// test output stays clean while still letting us assert the branch ran.
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// determineDefeatingHero (u-9c).
// ---------------------------------------------------------------------------

describe('determineDefeatingHero (u-9c)', () => {
  it('single-player state — returns p0 regardless of lastPlayerToPlay', () => {
    const players = [makePlayer({ id: 'p0' })];
    const combat = makeCombat({ lastPlayerToPlay: undefined });
    expect(determineDefeatingHero(players, combat)).toBe('p0');
  });

  it('co-op — both players contributed, last-played owner wins the credit', () => {
    const players = [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })];
    const combat = makeCombat({ lastPlayerToPlay: 'p1' });
    expect(determineDefeatingHero(players, combat)).toBe('p1');
  });

  it('tiebreak — empty/unset lastPlayerToPlay returns player-1', () => {
    const players = [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })];
    const combat = makeCombat({ lastPlayerToPlay: undefined });
    expect(determineDefeatingHero(players, combat)).toBe('p0');
  });

  it('tiebreak — lastPlayerToPlay references an unknown id → falls back to p0', () => {
    const players = [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })];
    const combat = makeCombat({ lastPlayerToPlay: 'p99' });
    expect(determineDefeatingHero(players, combat)).toBe('p0');
  });
});

// ---------------------------------------------------------------------------
// grantHeirloom routing (u-9c). Items are unbounded per nmmc — every
// drop lands in the defeater's items zone with no cap-overflow path.
// ---------------------------------------------------------------------------

describe('grantHeirloom (u-9c)', () => {
  it('appends the heirloom card to the defeater items zone (empty start)', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [] })],
    });
    const next = grantHeirloom(state, 0, 'craghorn-tusk');
    expect(next.players[0].items).toHaveLength(1);
    const equipped = next.players[0].items[0];
    expect(baseIdOf(equipped)).toBe('craghorn-tusk');
  });

  it('appends to the defeater even when they already hold many items (nmmc unbounded)', () => {
    const fillerItem: Card = {
      id: 'filler-1',
      role: 'item',
      cost: { green: 0 },
      effects: { kind: 'gain' },
      itemKind: 'item-active',
      cooldownTurns: 0,
      lastUsedTurn: null,
    };
    const defeater = makePlayer({
      id: 'p0',
      items: Array.from({ length: 5 }, (_, i) => ({
        ...fillerItem,
        id: `filler-${i}`,
      })),
    });
    const teammate = makePlayer({ id: 'p1', items: [] });
    const state = makeState({ players: [defeater, teammate] });
    const next = grantHeirloom(state, 0, 'boulderkin-core');
    // Defeater receives the heirloom on top of pre-existing items.
    expect(next.players[0].items).toHaveLength(6);
    expect(next.players[0].items.some((c) => baseIdOf(c) === 'boulderkin-core')).toBe(true);
    // Teammate items untouched.
    expect(next.players[1].items).toHaveLength(0);
  });

  it('HEIRLOOM_DROPS table is keyed on boss base id', () => {
    // Defensive schema check: the map u-9c consumes matches the u-9b
    // schema (bossBaseId → heirloomCardId).
    expect(HEIRLOOM_DROPS['craghorn']).toBe('craghorn-tusk');
    expect(HEIRLOOM_DROPS['boulderkin']).toBe('boulderkin-core');
    expect(HEIRLOOM_DROPS['sentinel']).toBe('sentinel-eye');
    // v2.1 gm0.17 (embertide-0jf): Silver Chimera now drops
    // `chimera-sword` as its sole wild-boss heirloom.
    expect(HEIRLOOM_DROPS['silver-chimera']).toBe('chimera-sword');
  });
});
