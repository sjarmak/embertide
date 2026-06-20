/**
 * Colosseum — Tier 5 capstone boss spec (embertide-p24m, sub of
 * 4hr1). Trinity Aurogax (Aurogax) sits at the end of the
 * unlockable progression per the 2026-05-02 designer ruling
 * (`bd memories
 * embertide-designer-ruling-colosseum-tiers-archetypes-2026-05-02-rev2`).
 *
 * Archetype: SEQUENCE. The three heads carry three eras of Elysian
 * power — Demon-King gloom, Umbra ancient-tech, Auren sacred
 * machinery — and the boss-turn rotates ordered head-attacks via a
 * sequence stateTag. The step ids name the head firing this turn;
 * resolver wiring (consumes `currentIndex` and dispatches per-head
 * damage/effect) lands in a downstream resolver bead.
 *
 * Numbers are illustrative. HP / damagePerTurn / step-count are
 * first-pass placeholders; final tuning is a playtest follow-up after
 * the resolver bead consumes the sequence tag and the whole tier-5
 * roster ships for difficulty-ramp playtest.
 *
 * Art: APPROVED 2026-05-02 — cathedral_monster_aurogax
 * raster + JSON spec already shipped (see bd 4hr1 notes). Card-data +
 * CardArt + display-name wiring lands alongside this spec in p24m.
 */

import type { CombatBoss } from '../../types/combat';

/**
 * Trinity Aurogax — three-headed dragon. Sequence archetype. Attack
 * pattern fires the head named by the sequence's `currentIndex` step
 * each turn; wraps modulo `steps.length`. HP scales to capstone tier
 * (illustrative 60); damagePerTurn 4 puts the team under genuine
 * pressure but still leaves room for blocks/heals to absorb.
 */
export const COLOSSEUM_TRINITY_AUROGAX_T5: CombatBoss = {
  hp: 60,
  hpMax: 60,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
    bossAttackResolver: 'trinity-aurogax-heads',
  },
  sourceCardId: 'trinity-aurogax',
  archetype: 'sequence',
  stateTags: [
    {
      kind: 'sequence',
      steps: ['gloom-head', 'umbra-head', 'auren-head'],
      currentIndex: 0,
    },
  ],
};

/**
 * Tier-5 roster placeholder. Per the designer ruling rev2 the full
 * tier holds 4 bosses (Malgar/Vexel/Gyorg/Trinity Aurogax). Only
 * Trinity Aurogax ships now — the other three are queued behind the
 * art batch (their rasters are net-new, see `colosseum.art.batch-1`
 * follow-up bead in 4hr1's pipeline). Consumers iterate this tuple to
 * build the tier-5 unlock pool when the colosseum slot lands.
 */
export const TIER_5_ROSTER = [COLOSSEUM_TRINITY_AUROGAX_T5] as const satisfies readonly CombatBoss[];
