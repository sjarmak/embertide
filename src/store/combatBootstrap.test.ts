import { describe, it, expect } from 'vitest';
import {
  buildInitialCombatState,
  enterCombatAction,
  keywordVocabularyActive,
  KEYWORD_VOCABULARY_ZONE_ALLOWLIST,
} from './combatBootstrap';
import { COLOSSEUM_CRAGHORN_T1 } from '../data/colosseum/tier1';
import { COLOSSEUM_CRAGHORN_ARENA } from '../data/colosseum/arenas';
import { ZONE_BOSS_SPECS } from '../data/zones/bossSpecs';
import { KID_CARDS } from '../data/cards';
import { makeKidGameState, makeKidPlayer } from '../testing/stateFixtures';
import type { CombatBoss, CombatEntryContext } from '../types/combat';
import type { Card } from '../types/card';
import type { ZoneId } from './types';

/**
 * embertide-4hr1.14 — discriminated-union refactor of enterCombatAction.
 *
 * Pins the new contract:
 *  - The source of boss data is encoded as a `CombatEntry` discriminated
 *    union (`{ kind: 'card'; card }` | `{ kind: 'boss'; boss }`), so the
 *    "neither card nor boss" runtime throw is unrepresentable at compile
 *    time (AC4).
 *  - The `entry.kind` axis must stay paired with `entrySource`: today the
 *    boss-only data path exists exclusively to serve the colosseum slot
 *    router. Mismatched pairs surface as programmer errors at the
 *    dispatch seat rather than as silent zone-mechanic drift downstream
 *    (AC1).
 */

const CRAGHORN = KID_CARDS.find((c) => c.id === 'craghorn');
if (!CRAGHORN) {
  throw new Error('Test fixture: craghorn missing from KID_CARDS');
}
const CRAGHORN_CARD: Card = CRAGHORN;

/**
 * `sourceCardId: 'coilworm'` is a colosseum-only roster entry with no
 * main-game Card counterpart (see `src/data/colosseum/tier1.ts` and the
 * docstring on `enterCombatAction`). Using a colosseum-only id makes the
 * boss-pass-through test self-policing: any silent fall-through into the
 * card path would invoke `attackPatternFor('coilworm')` and throw because
 * `coilworm` has no entry in BOSS_ATTACK_PATTERNS.
 */
const BOSS_FIXTURE: CombatBoss = {
  hp: 8,
  hpMax: 8,
  attackPattern: {
    damagePerTurn: 1,
    targeting: 'player-hp',
    onDefeatEffect: null,
  },
  sourceCardId: 'coilworm',
};

const NON_COLOSSEUM_ENTRY_SOURCES: ReadonlyArray<CombatEntryContext['entrySource']> = [
  'field',
  'wild-boss-slot',
  'region-boss-slot',
];

function baseState() {
  return makeKidGameState({ players: [makeKidPlayer({ id: 'p0' })] });
}

describe('enterCombatAction — CombatEntry discriminated union (AC2)', () => {
  it('accepts kind=card for non-colosseum entrySources and routes the card lookup', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
    );
    expect(action.type).toBe('COMBAT_ENTER');
    expect(action.boss.sourceCardId).toBe(CRAGHORN_CARD.id);
  });

  it('accepts kind=boss for colosseum-slot entries and passes the boss through structurally unchanged', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'boss', boss: BOSS_FIXTURE },
      'fightMonster',
      'colosseum-slot',
    );
    expect(action.type).toBe('COMBAT_ENTER');
    // Structural equality only — pass-through semantics are about the
    // payload, not the reference. A future implementation that shallow-
    // copies for immutability hygiene must still pass this assertion.
    expect(action.boss).toEqual(BOSS_FIXTURE);
    expect(action.boss.sourceCardId).toBe('coilworm');
  });
});

describe('enterCombatAction — entry/entrySource consistency assertion (AC1)', () => {
  it.each(NON_COLOSSEUM_ENTRY_SOURCES)(
    'throws on kind=boss paired with non-colosseum entrySource=%s, naming the boss-side offender',
    (entrySource) => {
      const state = baseState();
      expect(() =>
        enterCombatAction(state, { kind: 'boss', boss: BOSS_FIXTURE }, 'fightMonster', entrySource),
      ).toThrow(/kind=['"]?boss['"]?/);
    },
  );

  it('throws on kind=card paired with the colosseum-slot entrySource, naming the card-side offender', () => {
    const state = baseState();
    expect(() =>
      enterCombatAction(
        state,
        { kind: 'card', card: CRAGHORN_CARD },
        'fightMonster',
        'colosseum-slot',
      ),
    ).toThrow(/kind=['"]?card['"]?/);
  });
});

/**
 * AC4 — the old `(monsterCard === null && bossOverride === null)` runtime
 * throw is unrepresentable in the new API. The `CombatEntry` union has
 * no third arm and both arms carry a non-null payload by construction.
 *
 * Each `@ts-expect-error` below pins the compile-time guarantee: a
 * future widening (e.g. back to `Card | null`) would silently consume
 * the suppression and fail the typecheck gate as an unused-error
 * directive. The accompanying runtime invocation gives a secondary
 * signal — calling `entry.kind` on a non-conformant value throws a
 * TypeError, so the function fails fast rather than fabricating a
 * default branch.
 */
/**
 * embertide-4hr1.18 — tideGaugeSnapshot parallel-mode suppression.
 *
 * The colosseum is parallel to the current map zone, not in it. Zone
 * mechanics (shadowCreep, sandstormCounter, tideGauge) must not bleed
 * into colosseum combats. shadowCreep + sandstormCounter already follow
 * this contract by virtue of the kind/entrySource invariant (the adder
 * branch only runs for kind='card', and kind='card' is forbidden with
 * entrySource='colosseum-slot'). tideGaugeSnapshot lives OUTSIDE that
 * branch — it's threaded onto the action payload unconditionally — so
 * it needs an explicit colosseum opt-out to honor the same invariant.
 */
describe('enterCombatAction — tideGaugeSnapshot parallel-mode suppression (4hr1.18)', () => {
  it('preserves state.tideGauge into the snapshot for non-colosseum entries (gdd.1.2 contract)', () => {
    const state = makeKidGameState({
      players: [makeKidPlayer({ id: 'p0' })],
      currentZone: 'maren',
      tideGauge: 4,
    });
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
    );
    expect(action.tideGaugeSnapshot).toBe(4);
  });

  it('zeroes the snapshot for colosseum-slot entries even when state.tideGauge > 0', () => {
    const state = makeKidGameState({
      players: [makeKidPlayer({ id: 'p0' })],
      currentZone: 'maren',
      tideGauge: 4,
    });
    const action = enterCombatAction(
      state,
      { kind: 'boss', boss: BOSS_FIXTURE },
      'fightMonster',
      'colosseum-slot',
    );
    expect(action.tideGaugeSnapshot).toBe(0);
  });
});

describe('enterCombatAction — AC4 (null/null pair is unrepresentable)', () => {
  it('rejects null at the entry parameter (compile-time + runtime)', () => {
    const state = baseState();
    expect(() =>
      // @ts-expect-error null is not assignable to CombatEntry
      enterCombatAction(state, null, 'fightMonster'),
    ).toThrow();
  });

  it('rejects a kindless empty object at the entry parameter (compile-time + runtime)', () => {
    const state = baseState();
    expect(() =>
      // @ts-expect-error missing required `kind` discriminator and payload
      enterCombatAction(state, {}, 'fightMonster'),
    ).toThrow();
  });
});

/**
 * embertide-lhlo.7 — keyword-vocabulary activation gate.
 *
 * The production allowlist is empty (off by default), so default
 * `kind:'card'` entries must remain identity-preserving against the
 * pre-vocabulary boss shape. Activation is opt-in via a per-zone set
 * passed through the test seam; the bootstrap merges
 * `ZONE_BOSS_SPECS[card.id]` into the constructed boss only when the
 * card's zone is on the allowlist AND a spec entry exists.
 */
const BROODMAW = KID_CARDS.find((c) => c.id === 'broodmaw');
if (!BROODMAW) {
  throw new Error('Test fixture: broodmaw missing from KID_CARDS');
}
const BROODMAW_CARD: Card = BROODMAW;

describe('keywordVocabularyActive — pure helper (A1)', () => {
  it('exports an empty production allowlist (off by default)', () => {
    expect(KEYWORD_VOCABULARY_ZONE_ALLOWLIST.size).toBe(0);
  });

  it('returns false against the empty production allowlist for every zone-affinity card', () => {
    expect(keywordVocabularyActive(CRAGHORN_CARD)).toBe(false);
    expect(keywordVocabularyActive(BROODMAW_CARD)).toBe(false);
  });

  it('returns true when the card-zone is on the supplied allowlist', () => {
    const allowlist: ReadonlySet<ZoneId> = new Set<ZoneId>(['sylvani']);
    expect(keywordVocabularyActive(CRAGHORN_CARD, allowlist)).toBe(true);
    expect(keywordVocabularyActive(BROODMAW_CARD, allowlist)).toBe(true);
  });

  it('returns false for cards in zones not on the supplied allowlist', () => {
    const allowlist: ReadonlySet<ZoneId> = new Set<ZoneId>(['sylvani']);
    const SHADOW_BOSS = KID_CARDS.find((c) => c.id === 'hollow-effigy');
    if (!SHADOW_BOSS) throw new Error('Test fixture: hollow-effigy missing');
    expect(keywordVocabularyActive(SHADOW_BOSS, allowlist)).toBe(false);
  });

  it('returns false for cards without zone affinity', () => {
    const EMBER_SHARD = KID_CARDS.find((c) => !c.zone);
    if (!EMBER_SHARD) throw new Error('Test fixture: no zoneless card found');
    const allowlist: ReadonlySet<ZoneId> = new Set<ZoneId>([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    expect(keywordVocabularyActive(EMBER_SHARD, allowlist)).toBe(false);
  });
});

describe('enterCombatAction — keyword-vocabulary merge (A2 + A3)', () => {
  it('is identity-preserving against the empty production allowlist (no archetype/stateTags written)', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
    );
    expect(action.boss.archetype).toBeUndefined();
    expect(action.boss.stateTags).toBeUndefined();
  });

  it('is identity-preserving when the card-zone is not on the supplied allowlist', () => {
    const state = baseState();
    const allowlist: ReadonlySet<ZoneId> = new Set<ZoneId>(['hollow-shrine']);
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
      allowlist,
    );
    expect(action.boss.archetype).toBeUndefined();
    expect(action.boss.stateTags).toBeUndefined();
  });
});

describe('enterCombatAction — sylvani activation (A4)', () => {
  const allowlist: ReadonlySet<ZoneId> = new Set<ZoneId>(['sylvani']);

  it('merges craghorn spec (eye + guarded + cycle threshold:2) when sylvani is on the allowlist', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
      allowlist,
    );
    expect(action.boss.archetype).toBe('eye');
    expect(action.boss.stateTags).toEqual(ZONE_BOSS_SPECS.craghorn.stateTags);
  });

  it('merges broodmaw spec (eye + guarded + cycle threshold:2) when sylvani is on the allowlist', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'card', card: BROODMAW_CARD },
      'fightMonster',
      'region-boss-slot',
      allowlist,
    );
    expect(action.boss.archetype).toBe('eye');
    expect(action.boss.stateTags).toEqual(ZONE_BOSS_SPECS.broodmaw.stateTags);
  });

  it('preserves the constructed CombatBoss core fields when merging the spec', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'card', card: CRAGHORN_CARD },
      'fightMonster',
      'wild-boss-slot',
      allowlist,
    );
    // The merge is additive — hp, hpMax, attackPattern, sourceCardId
    // come from the bootstrap path, not the spec. Drift here would
    // mean the spec accidentally overwrote the per-zone HP curve.
    expect(action.boss.sourceCardId).toBe('craghorn');
    expect(action.boss.hp).toBeGreaterThan(0);
    expect(action.boss.hp).toBe(action.boss.hpMax);
    expect(action.boss.attackPattern.damagePerTurn).toBeGreaterThan(0);
  });

  it('leaves hollow-shrine bosses dormant when only sylvani is allowed (per-zone independence)', () => {
    const state = baseState();
    const SHADOW_BOSS = KID_CARDS.find((c) => c.id === 'hollow-effigy');
    if (!SHADOW_BOSS) throw new Error('Test fixture: hollow-effigy missing');
    const action = enterCombatAction(
      state,
      { kind: 'card', card: SHADOW_BOSS },
      'fightMonster',
      'wild-boss-slot',
      allowlist,
    );
    expect(action.boss.archetype).toBeUndefined();
    expect(action.boss.stateTags).toBeUndefined();
  });
});

/**
 * embertide-lhlo.26 — Arena/Hazard wiring. The arena primitive is
 * attached ONLY to colosseum-slot combats, looked up by the engaged
 * boss `sourceCardId`. Field / wild-boss / region-boss combats carry no
 * arena state by construction (the lookup never runs outside the
 * colosseum branch).
 */
describe('enterCombatAction — arena wiring (lhlo.26)', () => {
  it('attaches the wired arena to a colosseum-slot entry on the Craghorn slot', () => {
    const state = baseState();
    const action = enterCombatAction(
      state,
      { kind: 'boss', boss: COLOSSEUM_CRAGHORN_T1 },
      'fightMonster',
      'colosseum-slot',
    );
    expect(action.arena).toEqual(COLOSSEUM_CRAGHORN_ARENA);
  });

  it('leaves the arena undefined for a colosseum slot with no wired arena', () => {
    const state = baseState();
    // BOSS_FIXTURE.sourceCardId === 'coilworm' has no entry in COLOSSEUM_ARENAS.
    const action = enterCombatAction(
      state,
      { kind: 'boss', boss: BOSS_FIXTURE },
      'fightMonster',
      'colosseum-slot',
    );
    expect(action.arena).toBeUndefined();
  });

  it.each(NON_COLOSSEUM_ENTRY_SOURCES)(
    'leaves the arena undefined for non-colosseum entrySource=%s (zone combats carry no arena)',
    (entrySource) => {
      const state = baseState();
      const action = enterCombatAction(
        state,
        { kind: 'card', card: CRAGHORN_CARD },
        'fightMonster',
        entrySource,
      );
      expect(action.arena).toBeUndefined();
    },
  );

  it('hydrates CombatState.arena from the COMBAT_ENTER payload, undefined when absent', () => {
    const ctx = {
      bossCardId: 'craghorn',
      combatEntryTurn: 0,
      attackerPlayerIds: ['p0'],
      engagementSource: 'fightMonster' as const,
      entrySource: 'colosseum-slot' as const,
    };
    const withArena = buildInitialCombatState(
      COLOSSEUM_CRAGHORN_T1,
      [],
      ctx,
      0,
      COLOSSEUM_CRAGHORN_ARENA,
    );
    expect(withArena.arena).toEqual(COLOSSEUM_CRAGHORN_ARENA);

    const withoutArena = buildInitialCombatState(COLOSSEUM_CRAGHORN_T1, [], ctx, 0);
    expect(withoutArena.arena).toBeUndefined();
    expect('arena' in withoutArena).toBe(false);
  });
});
