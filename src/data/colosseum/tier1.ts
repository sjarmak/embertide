/**
 * Colosseum — Tier 1 entry-boss specs (embertide-v8ei, sub of 4hr1).
 *
 * VOCABULARY SMOKE-TEST. Each spec exercises the 2026-05-02 keyword
 * vocabulary (`bd memories embertide-keyword-glossary-2026-05-02`)
 * authored on top of the kw.boss-state / kw.boss-archetypes substrate
 * (k08m + auft) — `archetype` + `stateTags` populated; pre-existing
 * fields untouched.
 *
 * Tier-1 roster + archetype assignment from the designer ruling
 * (`bd memories
 * embertide-designer-ruling-colosseum-tiers-archetypes-2026-05-02-rev2`):
 *
 *   - Craghorn       — eye archetype (already-shipped art).
 *   - Coilworm     — eye archetype (net-new art pending).
 *   - Boulderkin — layered archetype (already-shipped art).
 *   - Bonereaver     — duel archetype (reskin from existing knight/desert).
 *
 * NUMBERS ARE ILLUSTRATIVE. HP / damagePerTurn / threshold / penalty
 * are first-pass placeholders chosen to make the spec readable, not
 * designer-balance-locked. Final tuning is a playtest follow-up after
 * the resolver bead consumes these stateTags. The point of this file is
 * the SHAPE — proving the keyword vocabulary describes the canonical
 * Tier-1 mechanics cleanly.
 *
 * Consumers do not exist yet — the colosseum slot/engine ships in 4hr1.
 * Until then, this file is dead-data on purpose; the test suite asserts
 * the spec literals satisfy the new vocabulary.
 */

import type { CombatBoss } from '../../types/combat';

// ---------------------------------------------------------------------------
// Tier-1 boss specs.
// ---------------------------------------------------------------------------

/**
 * Eye archetype — Guarded UNTIL Cycle threshold trips → 1-turn Exposed
 * window (with +1 bonus damage). Threshold 2 = roughly every third
 * boss-turn the player gets a hit-window. Bracelet-on-eye canon.
 */
export const COLOSSEUM_CRAGHORN_T1: CombatBoss = {
  hp: 14,
  hpMax: 14,
  attackPattern: {
    damagePerTurn: 2,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'craghorn',
  archetype: 'eye',
  stateTags: [
    { kind: 'guarded', until: 'cycle-trigger' },
    { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
  ],
};

/**
 * Eye archetype — tail-tip is the only weak point. Faster cycle
 * (threshold 1 = every other turn) than Craghorn so the player practices
 * the pattern with a tighter rhythm before T2 expands the vocabulary.
 */
export const COLOSSEUM_COILWORM_T1: CombatBoss = {
  hp: 12,
  hpMax: 12,
  attackPattern: {
    damagePerTurn: 2,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'coilworm',
  archetype: 'eye',
  stateTags: [
    { kind: 'guarded', until: 'tail-exposed-cycle' },
    { kind: 'cycle', counter: 0, threshold: 1, trigger: 'flip-to-exposed' },
  ],
};

/**
 * Layered archetype — ore shell (8 HP) → crystal core (12 HP). Outer
 * layer must be downed before the core takes damage. Aggregate
 * `hp` / `hpMax` = sum of layer hpMax (20) so existing combat-engine
 * read sites that haven't yet been taught about layers still see a
 * sensible aggregate. Resolver bead consumes `stateTags[0].layers`
 * for actual damage routing.
 */
export const COLOSSEUM_BOULDERKIN_T1: CombatBoss = {
  hp: 20,
  hpMax: 20,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'boulderkin',
  archetype: 'layered',
  stateTags: [
    {
      kind: 'layered',
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 8, hpMax: 8, defeated: false },
        { id: 'core', name: 'Crystal Core', hp: 12, hpMax: 12, defeated: false },
      ],
    },
  ],
};

/**
 * Duel archetype — Adaptive penalty 1. The first repeated card-kind
 * each turn lands at -1 effect; encourages varied plays over spamming
 * one trick. Skeletal mirror-fighter canon.
 */
export const COLOSSEUM_BONEREAVER_T1: CombatBoss = {
  hp: 10,
  hpMax: 10,
  attackPattern: {
    damagePerTurn: 2,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'bonereaver',
  archetype: 'duel',
  stateTags: [{ kind: 'adaptive', penalty: 1 }],
};

// ---------------------------------------------------------------------------
// Roster aggregator.
// ---------------------------------------------------------------------------

/**
 * Tier-1 roster, ordered from gentlest (single-Eye-cycle threshold-2)
 * to most variance (Adaptive). Consumers iterate this tuple to build
 * the tier-1 unlock pool when the colosseum slot ships.
 */
export const TIER_1_ROSTER = [
  COLOSSEUM_CRAGHORN_T1,
  COLOSSEUM_COILWORM_T1,
  COLOSSEUM_BOULDERKIN_T1,
  COLOSSEUM_BONEREAVER_T1,
] as const satisfies readonly CombatBoss[];
