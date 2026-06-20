/**
 * ZONE_BOSS_SPECS — keyword-vocabulary forward-compat registry for the
 * existing zone-mode bosses (embertide-lhlo.1 et seq).
 *
 * **No production consumer today.** This registry is authored ahead of
 * `embertide-lhlo.7` (per-zone activation), under user ruling
 * 2026-05-04 (Option 4: ship metadata first, gate consumers). Until
 * lhlo.7 wires it into `combatBootstrap`, `ZONE_BOSS_SPECS` is read
 * only by the spec-shape tests in `bossSpecs.test.ts` — zone-mode
 * combat math is unaffected.
 *
 * The activation flip lives in `lhlo.7`, not here. Adding an entry to
 * this map does NOT change runtime behavior. lhlo.7 will read from
 * this registry per a per-zone allowlist so designer/playtest signal
 * can validate the math zone-by-zone before the keyword vocabulary
 * fires for live play.
 *
 * Per-card archetype assignments are documented in
 * `bd memories embertide-zone-boss-archetype-assignments-2026-05-04`.
 *
 * Authoring conventions (mirrors colosseum tier-1 shape, see
 * `src/data/colosseum/tier1.ts`):
 *  - Keys are `Card.id` strings.
 *  - Both `archetype` and `stateTags` are required — a half-populated
 *    entry is a type error.
 *  - Eye-archetype entries: `[guarded{until:'cycle-trigger'},
 *    cycle{counter:0, threshold, trigger:'flip-to-exposed'}]`.
 */

import type { BossArchetype, BossStateTag } from '../../types/combat';

/**
 * Per-card spec entry. Both fields required so a partial entry is a
 * compile-time error — if you only have one, file a follow-up bead.
 */
export interface ZoneBossSpec {
  readonly archetype: BossArchetype;
  readonly stateTags: readonly BossStateTag[];
}

/**
 * Forward-compat keyword-vocabulary registry. See file header for the
 * full activation contract.
 */
export const ZONE_BOSS_SPECS: Readonly<Record<string, ZoneBossSpec>> = {
  // Craghorn — Sylvani wild boss (lhlo.1). Eye archetype; canon
  // club-spin telegraph window. Mirrors COLOSSEUM_CRAGHORN_T1 shape.
  craghorn: {
    archetype: 'eye',
    stateTags: [
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ],
  },

  // Broodmaw — Sylvani region boss (lhlo.1). Eye archetype; locked by
  // designer spec — Guarded + Cycle → Exposed. Same threshold as
  // craghorn at this cut; per-boss tuning lands with lhlo.7 activation.
  broodmaw: {
    archetype: 'eye',
    stateTags: [
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ],
  },

  // Boulderkin — Emberpeak wild boss (lhlo.2). Layered
  // archetype — Shell → Core. Mirrors COLOSSEUM_BOULDERKIN_T1 shape
  // (src/data/colosseum/tier1.ts) but layer HP is tuned to the
  // zone-mode aggregate (BOSS_HP['boulderkin'] = 10, vs colosseum
  // tier-1's 20). Holds the colosseum 40%/60% Shell-vs-Core split:
  // shell=4, core=6. Per-boss tuning revisits with lhlo.7 activation.
  'boulderkin': {
    archetype: 'layered',
    stateTags: [
      {
        kind: 'layered',
        layers: [
          { id: 'shell', name: 'Ore Shell', hp: 4, hpMax: 4, defeated: false },
          { id: 'core', name: 'Crystal Core', hp: 6, hpMax: 6, defeated: false },
        ],
      },
    ],
  },

  // Ashen Tyrant — Emberpeak region boss (lhlo.2). Item-check
  // archetype — bomb-only weak point matches the Cinderwyrm T2 shape
  // (src/data/colosseum/tier2.ts). The exposed window itself is NOT
  // pre-baked into stateTags — it appears only after the player plays
  // the matching item-tag card and is closed by the item-check
  // resolver at end-of-boss-turn.
  'ashen-tyrant': {
    archetype: 'item-check',
    stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
  },

  // Maelstrom — Maren wild boss (lhlo.3). Eye archetype; canon
  // weak-point gameplay (single tail spin window) maps to Guarded
  // + Cycle → Exposed, mirrors the craghorn/broodmaw threshold:2 shape.
  // Per-boss tuning lands with lhlo.7 activation.
  'maelstrom': {
    archetype: 'eye',
    stateTags: [
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ],
  },

  // Tidewraith — Maren region boss (lhlo.3). Item-check archetype;
  // grapplethorn-pulls-nucleus is the textbook spec (Cinderwyrm tier-2
  // precedent: guarded{until:'item-tag-bomb'}; here the unblock
  // tag is grapplethorn). Single guarded tag — no sequence flavor for
  // the nucleus hop: that pattern is owned by the bespoke
  // tidewraith-tentacle-grab resolver (`src/core/combat/bossResolvers/
  // tidewraith.ts`), which reads tideGaugeSnapshot independently of
  // stateTags. Coexistence is intentional — the archetype tag is
  // additive metadata for the lhlo.7 telegraph affordance, not a
  // replacement for the bespoke resolver.
  tidewraith: {
    archetype: 'item-check',
    stateTags: [{ kind: 'guarded', until: 'item-tag-grapplethorn' }],
  },

  // Hollow-Effigy — Hollow Shrine wild boss (lhlo.4). Duel archetype —
  // Adaptive penalty 2 mirrors the canon Dark-Link mirror-fight: a
  // strong play this turn comes back next turn (clamped 2..4 by the
  // bespoke `hollow-effigy-mirror` resolver in
  // `src/core/combat/bossResolvers/hollowEffigy.ts`).
  //
  // Penalty derivation: HOLLOW_EFFIGY_MAX_DPT (4) − HOLLOW_EFFIGY_BASE_DPT
  // (2) = 2 — the worst-case extra echo damage the mirror inflicts
  // above the static floor. The literal 2 sits in the data file (per
  // the colosseum tier-1/2 precedent of literal stateTag values); the
  // test file imports the resolver constants and asserts the penalty
  // matches, catching drift if either constant moves. This entry is
  // additive metadata; the bespoke hollow-effigy-mirror resolver stays
  // in place per the lhlo.4 bead's "bespoke resolvers stay" note.
  'hollow-effigy': {
    archetype: 'duel',
    stateTags: [{ kind: 'adaptive', penalty: 2 }],
  },

  // Knell — Hollow Shrine region boss (lhlo.4). Sequence
  // archetype — 2-step drum cadence: telegraph (forecast log only,
  // 0 dmg) → slam (full pattern dpt). Steps derive directly from the
  // bespoke `knell-drum` resolver
  // (`src/core/combat/bossResolvers/knell.ts`), which keys off
  // `combat.turnIndex % 2` (phase 0 = telegraph, phase 1 = slam).
  //
  // currentIndex starts at 0 per the colosseum precedent
  // (`COLOSSEUM_PHANTOM_VURMOX_T2`). The bespoke resolver does NOT
  // currently read currentIndex — it derives phase from turnIndex —
  // so the spec value is forward-compat metadata for the lhlo.7
  // telegraph affordance. Coexistence with the bespoke resolver is
  // intentional; this entry is additive metadata, not a replacement.
  'knell': {
    archetype: 'sequence',
    stateTags: [
      {
        kind: 'sequence',
        steps: ['telegraph', 'slam'],
        currentIndex: 0,
      },
    ],
  },

  // Iron Sentinel — Dune Sanctum wild boss (lhlo.5). Layered archetype
  // — armor → naked-faster phase (claude-code ruling per
  // `bd memories embertide-zone-boss-archetype-assignments-2026-05-04`:
  // canonical 'armor breaks off' beat is structurally Talus-class, not
  // Adaptive). Mirrors COLOSSEUM_BLACKGUARD_T2 shell-vs-core shape; layer
  // HP sums to BOSS_HP['iron-sentinel'] = 6 with the heavier shell
  // (armor=4) carrying the wind-up pressure and the smaller naked
  // phase (naked=2) anchoring the canonical "fast lethal expose" beat.
  // Bespoke `iron-sentinel-stagger` resolver stays — this metadata is
  // additive (telegraph affordance + future archetype-tick routing).
  'iron-sentinel': {
    archetype: 'layered',
    stateTags: [
      {
        kind: 'layered',
        layers: [
          { id: 'armor', name: 'Iron Armor', hp: 4, hpMax: 4, defeated: false },
          { id: 'naked', name: 'Bare Knight', hp: 2, hpMax: 2, defeated: false },
        ],
      },
    ],
  },

  // Hextwins — Dune Sanctum region boss (lhlo.5). Sequence archetype
  // (locked by spec — Fire→Ice→Fire). Steps mirror the bespoke
  // `hextwins-fire-ice` resolver's `combat.turnIndex % 3` phase
  // mapping (phase 0 = fire, phase 1 = ice, phase 2 = fire). The
  // resolver's per-step attack-pattern bindings stay in the resolver
  // bead; this entry is additive metadata (sequence-archetype
  // telegraph affordance + future archetype-tick routing).
  hextwins: {
    archetype: 'sequence',
    stateTags: [{ kind: 'sequence', steps: ['fire', 'ice', 'fire'], currentIndex: 0 }],
  },

  // Sentinel — Gilded Cage wild boss (lhlo.6). Item-check
  // archetype — canon laser-reflect (aegis-pane) is the textbook
  // item gate. The `until` discriminant `item-tag-aegis-pane` is
  // the contract the item-check resolver bead reads to know which
  // item-tag flips the guard to a 1-turn exposed window. Mirrors
  // COLOSSEUM_CINDERWYRM_T2 shape (single guarded tag); the exposed
  // window is NOT pre-baked and lands only after a matching item-
  // tagged card resolves. No bespoke resolver today — the existing
  // GILDED_CAGE_BOSSES are stat-driven via bossAttackPatterns;
  // lhlo.7 activation will route through this spec for the
  // telegraph affordance.
  sentinel: {
    archetype: 'item-check',
    stateTags: [{ kind: 'guarded', until: 'item-tag-aegis-pane' }],
  },

  // Silver Chimera — Gilded Cage wild boss #2 (lhlo.6). Duel
  // archetype — Adaptive penalty 3. Locked by spec (Chimera listed
  // under duel). Penalty 3 sits one knob above COLOSSEUM_CHIMERA_T2's
  // penalty:2 — Gilded Cage is the terminal zone, so duel
  // discipline tightens vs the colosseum tier-2 rehearsal. Final
  // tuning revisits with lhlo.7 activation.
  'silver-chimera': {
    archetype: 'duel',
    stateTags: [{ kind: 'adaptive', penalty: 3 }],
  },

  // Cagewright Vurmox — Gilded Cage region boss / v2.0 final
  // fight (lhlo.6). Sequence archetype — three-phase rotation
  // captures the canonical 75/50/25 HP-threshold cadence of multi-
  // phase Vurmox (gloom-charge → bolt-volley → sword-strike).
  // Mirrors COLOSSEUM_TRINITY_AUROGAX_T5's 3-step shape
  // (src/data/colosseum/tier5.ts) — capstone-tier sequence length.
  // Step ids name the phase firing this boss-turn; the sequence
  // resolver bead consumes `currentIndex` and dispatches per-step
  // damage/effect, advancing modulo `steps.length`. Multi-phase
  // HP-threshold consumer is OUT OF SCOPE here (file follow-up
  // bead) — this entry ships the metadata only.
  'cagewright-vurmox': {
    archetype: 'sequence',
    stateTags: [
      {
        kind: 'sequence',
        steps: ['gloom-charge', 'bolt-volley', 'sword-strike'],
        currentIndex: 0,
      },
    ],
  },

  // Prism Chimera — post-completion bonus wild boss (lhlo.6).
  // Duel archetype — Adaptive penalty 4. Chimera-class Adaptive
  // variant sitting one knob above silver-chimera (penalty:3); the
  // post-completion encounter earns the tightest duel-discipline
  // knob in v2.0. Dynamic-spawn path —
  // `computePrismChimeraSpawnChance` (src/rules/zones.ts)
  // rolls the encounter at silver-chimera's defeat; the lhlo.7
  // activation must read this spec via the same Card.id lookup as
  // the FIFO queue path so the dynamic-spawn case picks up the
  // duel telegraph identically.
  'prism-chimera': {
    archetype: 'duel',
    stateTags: [{ kind: 'adaptive', penalty: 4 }],
  },
};
