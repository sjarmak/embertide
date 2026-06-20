/**
 * Colosseum — Tier 2 boss specs (embertide-acon, sub of 4hr1 + lhlo).
 *
 * VOCABULARY SMOKE-TEST — TIER 2. Extends `tier1.ts` (v8ei) with four
 * more bosses chosen to exercise archetype shapes Tier-1 didn't cover
 * (Item-Check + Sequence) plus a second Layered + a second Duel that
 * sit one knob harder than their T1 siblings. Together with Tier-1
 * (Eye + Layered + Duel) and Tier-5 (Sequence via Trinity Aurogax) this
 * leaves only Swarm uncovered — that's deferred to a follow-up bead
 * pair (kw.boss-state-swarm + colosseum.tier2.palegrasp-spec) because
 * the `BossStateTag` union doesn't yet ship a `swarm` variant.
 *
 * Tier-2 roster + archetype assignment (designer ruling rev2 —
 * `bd memories
 * embertide-designer-ruling-colosseum-tiers-archetypes-2026-05-02-rev2`):
 *
 *   - Chimera         — duel archetype (sharper adaptive penalty than Bonereaver T1).
 *   - Blackguard       — layered archetype (armor → bare-warrior strip).
 *   - Cinderwyrm      — item-check archetype (guarded until bomb-tag breaks the guard).
 *   - Phantom Vurmox — sequence archetype (ball-volley step rotation).
 *   - Palegrasp     — swarm archetype (central head + finger-minions, canon — see
 *                     `bd memories embertide-tone-filter-canon-over-kid-2026-05-02`).
 *
 * NUMBERS ARE ILLUSTRATIVE. HP / damagePerTurn / threshold / penalty
 * are first-pass placeholders chosen to read cleanly against Tier-1
 * (slightly bigger HP pools, slightly higher damage, slightly tighter
 * archetype knobs). Final tuning is a playtest follow-up after the
 * resolver beads (item-check, sequence, layered) consume these tags.
 *
 * Consumers do not exist yet — the colosseum slot/engine ships in
 * 4hr1. Until then this file is dead-data on purpose; the test suite
 * asserts the spec literals satisfy the new vocabulary.
 */

import type { CombatBoss } from '../../types/combat';

// ---------------------------------------------------------------------------
// Tier-2 boss specs.
// ---------------------------------------------------------------------------

/**
 * Duel archetype — Adaptive penalty 2. Chimera is the canonical Aurelia
 * mirror-duel: every repeated card-kind each turn lands at -2 effect
 * (vs Bonereaver T1's -1). Encourages tight tech-mix discipline; spam
 * one trick and the centaur-warrior reads it. Golden-rainbow chimera
 * art already shipped (`gildedCage.ts` zone roster).
 */
export const COLOSSEUM_CHIMERA_T2: CombatBoss = {
  hp: 18,
  hpMax: 18,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'chimera',
  archetype: 'duel',
  stateTags: [{ kind: 'adaptive', penalty: 2 }],
};

/**
 * Layered archetype — Iron-armor (10 HP) → Bare warrior (8 HP). Strip
 * the armor before the warrior takes damage. Aggregate `hp` / `hpMax`
 * = sum of layer hpMax (18) so damage read-sites that haven't been
 * taught about layers still see a sensible aggregate; the layered
 * resolver bead consumes `stateTags[0].layers` for actual routing.
 *
 * Sits one tier of hp above Boulderkin T1 (20 → 18 here, but armor's
 * 10 inner shell shifts the balance toward "outer-layer pressure").
 */
export const COLOSSEUM_BLACKGUARD_T2: CombatBoss = {
  hp: 18,
  hpMax: 18,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'blackguard',
  archetype: 'layered',
  stateTags: [
    {
      kind: 'layered',
      layers: [
        { id: 'armor', name: 'Iron Armor', hp: 10, hpMax: 10, defeated: false },
        { id: 'warrior', name: 'Bare Warrior', hp: 8, hpMax: 8, defeated: false },
      ],
    },
  ],
};

/**
 * Item-Check archetype — Guarded until a Bomb-tagged card breaks the
 * guard. The `until` discriminant `'item-tag-bomb'` is the contract
 * the item-check resolver bead reads to know which item-tag flips the
 * guard to a 1-turn exposed window. Cinderwyrm canon: fire-dragon
 * coiled in lava — only bombs (or the Megaton Hammer in OoT) reach
 * it. Ship the bomb-tag here; expand to other item-tags via separate
 * specs.
 *
 * The exposed window itself is NOT pre-baked into stateTags — it
 * appears only after the player plays the matching item-tag card.
 * Closed by the item-check resolver at end-of-boss-turn (mirror of
 * the Eye archetype's exposed→guarded cleanup).
 */
export const COLOSSEUM_CINDERWYRM_T2: CombatBoss = {
  hp: 16,
  hpMax: 16,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'cinderwyrm',
  archetype: 'item-check',
  stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
};

/**
 * Sequence archetype — ordered ball-volley rotation. Step ids name
 * the volley pattern firing this boss-turn; the sequence resolver
 * bead reads `currentIndex` to dispatch per-step damage/effect and
 * advances the pointer modulo `steps.length`. Shorter sequence than
 * Trinity Aurogax T5 (2 steps vs 3) so the player learns the pattern
 * at Tier-2 before the capstone scales it up.
 *
 * Phantom Vurmox canon: cackling sorcerer-double of Vurmox,
 * volleying energy balls between paintings (OoT) or across the
 * arena (TP/WW). The two-step shape captures the tennis-rally tell.
 *
 * Phase thresholds (lhlo.17) — proof-of-concept wiring for the
 * remix-only phase primitive. Three thresholds escalate the danger
 * purely by re-pointing already-defined fields:
 *
 *   75 %  (≤16 HP) — switches to `aoe` targeting: the sorcerer starts
 *          scattering volleys across the whole arena.
 *   50 %  (≤11 HP) — damagePerTurn bumps to 4: the panic accelerates
 *          the volley cadence. (Keeps aoe targeting from the 75 % remix.)
 *   25 %  (≤5 HP)  — damagePerTurn bumps to 5: desperate final stand.
 *
 * All three only remap existing `attackPattern` fields; `bossAttackResolver`
 * stays `'phantom-vurmox-volley'` throughout. `stateTags` are untouched
 * (sequence tag evolves independently via `applySequenceArchetypeTick`).
 *
 * A3 PROOF BOSS (kw.colosseum-vocab-proof / lhlo.41): Phantom Vurmox is the
 * documented option-C proof that the new vocabulary works end-to-end. Its
 * spec exercises the broadest applicable slice — sequence archetype tick +
 * the sequence stateTag + all three phase thresholds + combat keywords
 * (Stun/Weaken/Vulnerable/Multiattack) played against it. The end-to-end
 * regression guard is src/core/colosseum.vocabProof.test.ts, which drives a
 * full fight through `combatTurnReducer` and asserts each behaves per
 * docs/design/keyword-glossary.md.
 */
export const COLOSSEUM_PHANTOM_VURMOX_T2: CombatBoss = {
  hp: 22,
  hpMax: 22,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
    bossAttackResolver: 'phantom-vurmox-volley',
  },
  sourceCardId: 'phantom-vurmox',
  archetype: 'sequence',
  stateTags: [
    {
      kind: 'sequence',
      steps: ['ball-volley-charge', 'ball-volley-fire'],
      currentIndex: 0,
    },
  ],
  phaseThresholds: [
    {
      // 75 % — scattered volleys: flip to aoe targeting.
      atHpFraction: 0.75,
      transition: {
        attackPattern: {
          damagePerTurn: 3,
          targeting: 'aoe',
          onDefeatEffect: { kind: 'wisp-drop' },
          bossAttackResolver: 'phantom-vurmox-volley',
        },
      },
    },
    {
      // 50 % — accelerated cadence: bump damage to 4 (keeps aoe).
      atHpFraction: 0.5,
      transition: {
        attackPattern: {
          damagePerTurn: 4,
          targeting: 'aoe',
          onDefeatEffect: { kind: 'wisp-drop' },
          bossAttackResolver: 'phantom-vurmox-volley',
        },
      },
    },
    {
      // 25 % — desperate final stand: damage 5.
      atHpFraction: 0.25,
      transition: {
        attackPattern: {
          damagePerTurn: 5,
          targeting: 'aoe',
          onDefeatEffect: { kind: 'wisp-drop' },
          bossAttackResolver: 'phantom-vurmox-volley',
        },
      },
    },
  ],
};

/**
 * Swarm archetype — central head (boss.hp/hpMax channel) + 3
 * grasping finger-minions that parallel-coexist with the head. AoE
 * attacks hit all minions + head simultaneously; single-target picks
 * one. Whether killing all fingers is required to expose the head
 * (or just makes head-damage easier) is a resolver-level decision
 * left for the swarm-resolver bead — the spec only carries the data
 * shape.
 *
 * Canon Palegrasp: OoT well-bottom sentinel — pale flesh-and-bone
 * fingers reaching from the floor to grasp Link, central head bites
 * once you're caught. User ruling 2026-05-02 (canon-over-kid filter)
 * keeps the canon body-horror direction; no 'Tendril Sentinel'
 * softening — see `bd memories
 * embertide-tone-filter-canon-over-kid-2026-05-02`.
 *
 * Aggregate hp / hpMax = central-head HP only (12). Minion HP totals
 * (3 × 4 = 12) are independent of the head channel. Existing
 * read-sites that haven't been taught about swarm minions still see
 * a sensible head-only aggregate; the swarm resolver bead consumes
 * `stateTags[0].minions` for actual damage routing.
 */
export const COLOSSEUM_PALEGRASP_T2: CombatBoss = {
  hp: 12,
  hpMax: 12,
  attackPattern: {
    damagePerTurn: 3,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'palegrasp',
  archetype: 'swarm',
  stateTags: [
    {
      kind: 'swarm',
      minions: [
        { id: 'finger-1', name: 'Grasping Finger', hp: 4, hpMax: 4, defeated: false },
        { id: 'finger-2', name: 'Grasping Finger', hp: 4, hpMax: 4, defeated: false },
        { id: 'finger-3', name: 'Grasping Finger', hp: 4, hpMax: 4, defeated: false },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Roster aggregator.
// ---------------------------------------------------------------------------

/**
 * Tier-2 roster, ordered Duel → Layered → Item-Check → Sequence →
 * Swarm to climb in mechanical complexity (penalty knob → multi-
 * layer routing → item-tag dependency → ordered-step rotation →
 * parallel-minion field). Consumers iterate this tuple to build the
 * tier-2 unlock pool when the colosseum slot lands in 4hr1.
 *
 * All 6 archetypes from the designer ruling rev2 are now exercised
 * by tier-1 + tier-2 + tier-5 specs (Eye via Craghorn/Coilworm, Layered
 * via Boulderkin + Blackguard, Duel via Bonereaver + Chimera, Item-Check via
 * Cinderwyrm, Sequence via Phantom Vurmox + Trinity Aurogax, Swarm via
 * Palegrasp). Vocabulary saturation complete.
 */
export const TIER_2_ROSTER = [
  COLOSSEUM_CHIMERA_T2,
  COLOSSEUM_BLACKGUARD_T2,
  COLOSSEUM_CINDERWYRM_T2,
  COLOSSEUM_PHANTOM_VURMOX_T2,
  COLOSSEUM_PALEGRASP_T2,
] as const satisfies readonly CombatBoss[];
