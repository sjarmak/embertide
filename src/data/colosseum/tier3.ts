/**
 * Colosseum — Tier 3 boss specs (embertide-wacl + bngt, sub of 4hr1).
 *
 * VOCABULARY-COMPLETE. The wacl roster placeholder shipped without
 * archetype + stateTags; bngt's designer pass (`bd memories
 * embertide-designer-ruling-colosseum-tier3-tier4-archetypes-2026-05-10`)
 * locks both fields per spec. Mirror of the tier1 + tier2 vocabulary
 * smoke-tests — every spec now exercises one of the six archetypes
 * (Eye / Item-Check / Layered / Sequence / Duel / Swarm).
 *
 * Tier-3 roster (designer ruling 2026-05-05 —
 * `bd memories embertide-designer-ruling-colosseum-bg-tiers-2026-05`,
 * "ancient stadium under storm-light" tier — and ruling 2026-05-10 for
 * archetype + stateTag mapping):
 *
 *   - Helmaroc King — layered (Iron Mask → Bare Head, WW canon).
 *   - Voltwyrm       — item-check (Double-Grapnels ground him, TP canon).
 *   - Kalle Demos   — item-check (bomb-flowers break tentacles, WW canon;
 *                     aligned with Cinderwyrm T2's bomb-tag — cinder-bloom
 *                     reads as bomb in the kw item vocabulary).
 *   - Sandscourge      — layered (twin pincers → tail-stinger, SS canon).
 *   - Idolarch      — swarm (6 detachable sword-arms in parallel,
 *                     SS canon). The 2026-05-10 ruling pins Swarm over
 *                     the docstring's also-listed Layered — arms coexist
 *                     rather than gating sequentially.
 *
 * NUMBERS ARE ILLUSTRATIVE. HP / damagePerTurn are first-pass
 * placeholders chosen to read as a step harder than tier-2 and a step
 * easier than tier-5. Layered HP totals match aggregate `hp` (mirror
 * Boulderkin T1 + Blackguard T2 convention so untaught read-sites still
 * see a sensible aggregate). Swarm aggregate `boss.hp` reads as the
 * central-torso channel; minion HP is parallel/independent (mirror
 * Dead Hand T2). Final tuning is a playtest follow-up after the
 * per-archetype resolver beads consume these stateTags.
 *
 * Card-data registration in `KID_CARDS` (parallel to `trinityGleeok`
 * in `src/data/cards/colosseum.ts`) lands alongside the per-boss art
 * batch beads — the sourceCardId strings here are the canonical
 * kebab-case names those card entries will use, so by-id lookups will
 * resolve once the cards ship.
 */

import type { CombatBoss } from '../../types/combat';

/**
 * Layered archetype — Iron Mask (14 HP) → Bare Head (14 HP). Outer
 * mask must be downed before the head takes damage. Aggregate
 * `hp` / `hpMax` = sum of layer hpMax (28). Helmaroc canon: WW masked
 * roc; the iron mask shatters under sustained hit-pressure.
 */
export const COLOSSEUM_HELMAROC_KING_T3: CombatBoss = {
  hp: 28,
  hpMax: 28,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'skrall-king',
  archetype: 'layered',
  stateTags: [
    {
      kind: 'layered',
      layers: [
        { id: 'mask', name: 'Iron Mask', hp: 14, hpMax: 14, defeated: false },
        { id: 'head', name: 'Bare Head', hp: 14, hpMax: 14, defeated: false },
      ],
    },
  ],
};

/**
 * Item-Check archetype — Guarded until a Grapnels-tagged card breaks
 * the guard. The `until` discriminant `'item-tag-grapnels'` is the
 * contract the item-check resolver bead reads to flip the guard to a
 * 1-turn exposed window. Voltwyrm canon: TP volcanic dragon — Double
 * Grapnels grapple the back-spikes to ground him for sword strikes.
 */
export const COLOSSEUM_VOLTWYRM_T3: CombatBoss = {
  hp: 26,
  hpMax: 26,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'voltwyrm',
  archetype: 'item-check',
  stateTags: [{ kind: 'guarded', until: 'item-tag-grapnels' }],
};

/**
 * Item-Check archetype — Guarded until a Bomb-tagged card breaks the
 * guard. Reuses Cinderwyrm T2's `'item-tag-bomb'` discriminant rather
 * than opening a one-boss `'item-tag-cinder-bloom'` subtag — bomb-
 * flowers read as bombs in the kw item vocabulary. Kalle Demos canon:
 * WW giant flytrap — bomb-flowers break the tentacles guarding the
 * vulnerable bud, then sword/Boomerang.
 */
export const COLOSSEUM_KALLE_DEMOS_T3: CombatBoss = {
  hp: 24,
  hpMax: 24,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'vinemaw',
  archetype: 'item-check',
  stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
};

/**
 * Layered archetype — Twin Pincers (14 HP) → Tail Stinger (12 HP).
 * Outer pincer-claws must be downed before the stinger takes damage.
 * Aggregate `hp` / `hpMax` = sum of layer hpMax (26). Sandscourge canon:
 * SS giant scorpion — break both pincers, then strike the
 * tail-stinger.
 */
export const COLOSSEUM_SANDSCOURGE_T3: CombatBoss = {
  hp: 26,
  hpMax: 26,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'sandscourge',
  archetype: 'layered',
  stateTags: [
    {
      kind: 'layered',
      layers: [
        { id: 'pincers', name: 'Twin Pincers', hp: 14, hpMax: 14, defeated: false },
        { id: 'stinger', name: 'Tail Stinger', hp: 12, hpMax: 12, defeated: false },
      ],
    },
  ],
};

/**
 * Swarm archetype — central torso (boss.hp/hpMax channel) + 6
 * detachable sword-arm minions that parallel-coexist with the torso.
 * AoE attacks hit all arms + torso simultaneously; single-target picks
 * one. Whether downing all arms is required to expose the torso (or
 * just makes torso-damage easier) is a resolver-level decision left
 * for the swarm-resolver bead — the spec only carries the data shape.
 *
 * Idolarch canon: SS ancient stone temple sentinel — six articulated
 * arms each wielding a sword; arms detach when struck, can be reused
 * by Link to slice the central torso. The 2026-05-10 ruling pins
 * Swarm over the docstring's also-listed Layered: arms coexist
 * (parallel) rather than gating sequentially.
 *
 * Aggregate hp / hpMax = central-torso HP only (30). Minion HP totals
 * (6 × 4 = 24) are independent of the torso channel. Read-sites that
 * haven't been taught about swarm minions still see a sensible
 * torso-only aggregate; the swarm resolver bead consumes
 * `stateTags[0].minions` for actual damage routing (mirror of Dead
 * Hand T2's central-head + finger-minions convention).
 */
export const COLOSSEUM_IDOLARCH_T3: CombatBoss = {
  hp: 30,
  hpMax: 30,
  attackPattern: {
    damagePerTurn: 4,
    targeting: 'battlefield-then-player',
    onDefeatEffect: { kind: 'wisp-drop' },
  },
  sourceCardId: 'idolarch',
  archetype: 'swarm',
  stateTags: [
    {
      kind: 'swarm',
      minions: [
        { id: 'sword-arm-1', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
        { id: 'sword-arm-2', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
        { id: 'sword-arm-3', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
        { id: 'sword-arm-4', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
        { id: 'sword-arm-5', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
        { id: 'sword-arm-6', name: 'Sword Arm', hp: 4, hpMax: 4, defeated: false },
      ],
    },
  ],
};

/**
 * Tier-3 roster, ordered by the bead-stated designer ruling (Helmaroc
 * King → Voltwyrm → Kalle Demos → Sandscourge → Idolarch). Consumers
 * iterate this tuple to build the tier-3 unlock pool when the
 * per-boss art batch registers the matching card data in `KID_CARDS`.
 */
export const TIER_3_ROSTER = [
  COLOSSEUM_HELMAROC_KING_T3,
  COLOSSEUM_VOLTWYRM_T3,
  COLOSSEUM_KALLE_DEMOS_T3,
  COLOSSEUM_SANDSCOURGE_T3,
  COLOSSEUM_IDOLARCH_T3,
] as const satisfies readonly CombatBoss[];
