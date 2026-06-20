/**
 * Colosseum — Tier 4 boss specs (embertide-wacl + bngt, sub of 4hr1).
 *
 * VOCABULARY-COMPLETE. The wacl roster placeholder shipped without
 * archetype + stateTags; bngt's designer pass (`bd memories
 * embertide-designer-ruling-colosseum-tier3-tier4-archetypes-2026-05-10`)
 * locks both fields per spec. Mirror of the tier1 + tier2 + tier3
 * vocabulary smoke-tests.
 *
 * Tier-4 roster (designer ruling 2026-05-05 —
 * `bd memories embertide-designer-ruling-colosseum-bg-tiers-2026-05`,
 * "cursed revival pit" tier — and ruling 2026-05-10 for archetype +
 * stateTag mapping):
 *
 *   - Ossiarch (Twilit Fossil) — layered (Twilit Spine → Floating
 *                                  Skull, TP canon).
 *   - The Fettered           — sequence (toe-charge → toe-strike →
 *                                  lap-up, SS canon — three steps,
 *                                  one longer than Phantom Vurmox T2's
 *                                  2-step volley).
 *   - Pyrax                    — eye (chained-eye weakpoint, TP canon;
 *                                  threshold 1 = faster cycle than
 *                                  Craghorn T1).
 *   - Oblivar                   — sequence (charge → lightning → sword,
 *                                  SS canon — capstone-sized 3-beat).
 *
 * NUMBERS ARE ILLUSTRATIVE. HP / damagePerTurn are first-pass
 * placeholders chosen to read as a step harder than tier-3 and a step
 * easier than tier-5 capstone. Layered HP totals match aggregate `hp`
 * (mirror Boulderkin T1 + Blackguard T2 + Skrall/Sandscourge T3
 * convention so untaught read-sites still see a sensible aggregate).
 * Final tuning is a playtest follow-up after the per-archetype
 * resolver beads consume these stateTags.
 *
 * Card-data registration in `KID_CARDS` (parallel to `trinityAurogax`)
 * lands alongside the per-boss art batch beads — the sourceCardId
 * strings here are the canonical kebab-case names those card entries
 * will use.
 */

import type { CombatBoss } from '../../types/combat';

/**
 * Layered archetype — Twilit Spine (18 HP) → Floating Skull (18 HP).
 * Outer spine must be downed before the airborne skull takes damage.
 * Aggregate `hp` / `hpMax` = sum of layer hpMax (36). Ossiarch canon:
 * TP revival fossil — shatter the spine in the arena phase, then
 * pursue the floating skull above.
 */
export const COLOSSEUM_OSSIARCH_T4: CombatBoss = {
  hp: 36,
  hpMax: 36,
  attackPattern: {
    damagePerTurn: 5,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'ossiarch',
  archetype: 'layered',
  stateTags: [
    {
      kind: 'layered',
      layers: [
        { id: 'spine', name: 'Twilit Spine', hp: 18, hpMax: 18, defeated: false },
        { id: 'skull', name: 'Floating Skull', hp: 18, hpMax: 18, defeated: false },
      ],
    },
  ],
};

/**
 * Sequence archetype — three-step toe-cycle as the colossus climbs the
 * spiral pit. Step ids name the beat firing this boss-turn; the
 * sequence resolver bead reads `currentIndex` to dispatch per-step
 * damage/effect and advances the pointer modulo `steps.length`. One
 * step longer than Phantom Vurmox T2's 2-step volley to climb the
 * difficulty step.
 *
 * The Fettered canon: SS sealed Oblivar predecessor — climbs the
 * spiral pit toe-by-toe, with each lap a charge → toe-strike → repeat
 * cadence; Link's job is to interrupt the lap-up beat before it
 * crests.
 */
export const COLOSSEUM_THE_FETTERED_T4: CombatBoss = {
  hp: 32,
  hpMax: 32,
  attackPattern: {
    damagePerTurn: 5,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'the-fettered',
  archetype: 'sequence',
  stateTags: [
    {
      kind: 'sequence',
      steps: ['toe-charge', 'toe-strike', 'lap-up'],
      currentIndex: 0,
    },
  ],
};

/**
 * Eye archetype — chained-eye weakpoint. Threshold 1 = every other
 * boss-turn the player gets a hit-window (faster than Craghorn T1's
 * threshold-2 cycle to read as a tier harder). Pyrax canon: TP fire-
 * titan — arrow-to-the-eye stuns him, then chain-the-leg sword phase.
 */
export const COLOSSEUM_PYRAX_T4: CombatBoss = {
  hp: 34,
  hpMax: 34,
  attackPattern: {
    damagePerTurn: 5,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'pyrax',
  archetype: 'eye',
  stateTags: [
    { kind: 'guarded', until: 'cycle-trigger' },
    { kind: 'cycle', counter: 0, threshold: 1, trigger: 'flip-to-exposed' },
  ],
};

/**
 * Sequence archetype — three-beat capstone dance. Step ids name the
 * beat firing this boss-turn; the sequence resolver bead reads
 * `currentIndex` to dispatch per-step damage/effect. Same length as
 * The Fettered (3 steps) but capstone-sized HP — final pre-T5
 * sequence boss before Trinity Aurogax's 3-head rotation.
 *
 * Oblivar canon: SS final boss — charge → lightning → sword three-beat
 * cadence; Link's job is to read the tell each beat and react.
 */
export const COLOSSEUM_OBLIVAR_T4: CombatBoss = {
  hp: 40,
  hpMax: 40,
  attackPattern: {
    damagePerTurn: 5,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'oblivar',
  archetype: 'sequence',
  stateTags: [
    {
      kind: 'sequence',
      steps: ['charge', 'lightning', 'sword'],
      currentIndex: 0,
    },
  ],
};

/**
 * Tier-4 roster, ordered by the bead-stated designer ruling (Ossiarch
 * → The Fettered → Pyrax → Oblivar — Oblivar as the final, hardest
 * pre-capstone fight). Consumers iterate this tuple to build the
 * tier-4 unlock pool when the per-boss art batch registers the
 * matching card data in `KID_CARDS`.
 */
export const TIER_4_ROSTER = [
  COLOSSEUM_OSSIARCH_T4,
  COLOSSEUM_THE_FETTERED_T4,
  COLOSSEUM_PYRAX_T4,
  COLOSSEUM_OBLIVAR_T4,
] as const satisfies readonly CombatBoss[];
