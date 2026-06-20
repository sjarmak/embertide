/**
 * BossStateTag — discriminated union of every boss-state keyword from
 * the 2026-05-02 glossary drop (`bd memories
 * embertide-keyword-glossary-2026-05-02`). Attached to
 * `CombatBoss.stateTags?` as a `readonly` array so multiple tags can
 * coexist (e.g. an Eye-archetype boss is BOTH `guarded` AND `cycle`
 * counting toward an `exposed` flip).
 *
 * Pure data; no resolver logic. The reducers/resolvers that consume
 * these tags ship in downstream beads (kw.boss-state-resolvers and the
 * per-archetype tier specs). This file is the schema source-of-truth.
 *
 * Adding a new variant: extend `BossStateTag`, then update every
 * exhaustive switch (the `_exhaustive: never` default branch enforces
 * this at the type level — see `combatBossState.test.ts`).
 */

/**
 * Per-layer HP shape used by `BossStateLayered` (Boulderkin
 * shell→core, Helmaroc King mask→head, Blackguard armor-strip, Idolarch
 * arm-by-arm). Layers resolve outermost-first — the first
 * non-`defeated` layer absorbs incoming damage; subsequent layers stay
 * untargetable until the layer in front of them is downed.
 *
 * `boss.hp` / `hpMax` retain their existing aggregate semantics; the
 * per-layer breakdown lives here so layered resolvers can route damage
 * without diverging from the existing CombatBoss shape.
 */
export interface BossLayer {
  /** Stable id within a boss (e.g. `'shell'`, `'core'`, `'mask'`, `'head'`). */
  readonly id: string;
  /** Display name surfaced to the player (e.g. `'Ore Shell'`, `'Crystal Core'`). */
  readonly name: string;
  /** Current HP remaining in this layer. */
  readonly hp: number;
  /** Initial HP capacity for this layer. */
  readonly hpMax: number;
  /** True once `hp` reaches 0; outer-layers-must-die-first gate. */
  readonly defeated: boolean;
}

/**
 * Boss is unhittable until an unblock condition fires. The optional
 * `until` discriminant names that condition — kept as a free string at
 * the type level so the schema doesn't bind to specific unblock keys
 * before the resolver bead lands. Examples expected in downstream
 * data: `'cycle-trigger'` (Eye), `'item-tag-bomb'` (Item-Check),
 * `'layer-shell-down'` (Layered).
 */
export interface BossStateGuarded {
  readonly kind: 'guarded';
  readonly until?: string;
}

/**
 * Boss is hittable. `bonus` (default 0) stacks additively on incoming
 * damage — the Eye-archetype "exposed window" pattern shipping a +X
 * for one turn after a Cycle threshold trips.
 *
 * `revertsTo` (Item-Check archetype, embertide-swlb) preserves the
 * original `BossStateGuarded` so the close-window resolver can restore
 * the exact same `until` discriminant after the exposed window
 * elapses. Without this field, every flip-cycle would forget which
 * item-tag re-arms the guard. Eye consumers leave this `undefined` —
 * eye reverts via the `EYE_REVERT_GUARDED_UNTIL` constant + cycle
 * counter and does not read `revertsTo`.
 */
export interface BossStateExposed {
  readonly kind: 'exposed';
  readonly bonus?: number;
  readonly revertsTo?: BossStateGuarded;
}

/**
 * End-of-turn auto-tick counter (Eye archetype). At each boss-turn end
 * `counter` increments by 1; when `counter >= threshold` the resolver
 * fires the action named by `trigger` and resets `counter` to 0.
 *
 * `trigger` is a free string at the type level; downstream beads will
 * tighten to a literal-union (e.g. `'flip-to-exposed' | 'spawn-minion'
 * | …`) when the resolver lookup table lands.
 */
export interface BossStateCycle {
  readonly kind: 'cycle';
  readonly counter: number;
  readonly threshold: number;
  readonly trigger: string;
}

/**
 * Player-paid counter primitive (`Break N`). Distinct from `cycle`
 * because Cycle is END-OF-TURN auto-tick while Break is PLAYER-ACTION
 * driven — cards/items "Break N" to pay these down as a cost to flip
 * a phase or unlock a guard.
 */
export interface BossStateBreak {
  readonly kind: 'break';
  readonly counter: number;
}

/**
 * Multi-part boss with explicit per-layer HP (Layered archetype —
 * Boulderkin, Blackguard, Helmaroc King, Idolarch, Ossiarch, Sandscourge,
 * Malgar). The reducer routes incoming damage to the first
 * non-defeated layer.
 */
export interface BossStateLayered {
  readonly kind: 'layered';
  readonly layers: readonly BossLayer[];
}

/**
 * Ordered-step state (Sequence archetype — Hextwins fire-ice-fire,
 * Phantom Vurmox ball-volley, The Imprisoned toe-cycle, Oblivar
 * charge-lightning-sword, Trinity Aurogax 3-head rotation). Each step
 * id is a free string at the type level; resolver beads bind them to
 * concrete attack-pattern resolvers.
 */
export interface BossStateSequence {
  readonly kind: 'sequence';
  readonly steps: readonly string[];
  /** 0-based pointer into `steps`; resolver wraps modulo `steps.length`. */
  readonly currentIndex: number;
}

/**
 * Repeat-punishing state (Duel archetype — Chimera, Bonereaver, Vexel,
 * Dark Link). The first repeated card-kind each turn takes `-penalty`
 * to its effect. Runtime trackers (which kinds have resolved this
 * turn, whether the penalty has fired) are owned by the resolver bead
 * and intentionally NOT modeled here — keeps the schema minimal until
 * the resolver pins down the precise tracking shape.
 */
export interface BossStateAdaptive {
  readonly kind: 'adaptive';
  readonly penalty: number;
}

/**
 * Parallel-minion state (Swarm archetype — Dead Hand finger-fields,
 * Idolarch detachable arms, Gyorg minor-fish). Holds the set of
 * minions that coexist alongside the central boss. Distinct from
 * `BossStateLayered` — Layered routes damage outermost-first
 * (must-defeat-shell-before-core), Swarm minions exist in PARALLEL
 * with each other and with the central boss; the resolver decides
 * how a given attack distributes (AoE hits all, single-target picks
 * one).
 *
 * Reuses the `BossLayer` shape for the per-minion record so the
 * (id / name / hp / hpMax / defeated) data path stays homogeneous
 * across both archetypes — only the resolver semantics differ. The
 * AoE-vs-single-target tradeoff knob is intentionally NOT modeled
 * here; routing rules live in the resolver bead so the schema stays
 * minimal until the per-consumer mechanics are pinned down (Dead
 * Hand vs Idolarch vs Gyorg may all want different rules).
 */
export interface BossStateSwarm {
  readonly kind: 'swarm';
  readonly minions: readonly BossLayer[];
}

/**
 * Discriminated union of every boss-state keyword tag.
 *
 * Multiple tags can coexist on `CombatBoss.stateTags`. Examples:
 *  - Eye boss: `[guarded, cycle]` until threshold flips to `[exposed]`.
 *  - Layered Item-Check boss: `[guarded(until:item-tag), layered]`.
 *  - Adaptive Sequence boss (capstone): `[adaptive, sequence]`.
 *  - Swarm boss: `[swarm]` with minions list (Dead Hand fingers).
 */
export type BossStateTag =
  | BossStateGuarded
  | BossStateExposed
  | BossStateCycle
  | BossStateBreak
  | BossStateLayered
  | BossStateSequence
  | BossStateAdaptive
  | BossStateSwarm;

/** Convenience alias for switch-statement exhaustiveness proofs. */
export type BossStateTagKind = BossStateTag['kind'];

// ---------------------------------------------------------------------------
// Boss-archetype taxonomy (embertide-auft, sub of lhlo).
// ---------------------------------------------------------------------------

/**
 * Six-archetype boss taxonomy from the 2026-05-02 designer ruling
 * (`bd memories
 * embertide-designer-ruling-colosseum-tiers-archetypes-2026-05-02-rev2`).
 *
 * Each archetype maps to a canonical Aurelia-boss play pattern and to a
 * characteristic combination of `BossStateTag` shapes:
 *
 *  - `'eye'`        — Guarded + Cycle → Exposed window (Craghorn, Broodmaw,
 *                     Coilworm, Pyrax).
 *  - `'item-check'` — Guarded until specific item-tag breaks the guard
 *                     (Cinderwyrm, Kalle Demos, Voltwyrm).
 *  - `'layered'`    — Multi-part Shell → Core (Boulderkin, Blackguard,
 *                     Helmaroc King, Idolarch, Ossiarch, Sandscourge,
 *                     Malgar).
 *  - `'sequence'`   — Ordered step rotation (Phantom Vurmox, The
 *                     Imprisoned, Oblivar, Trinity Aurogax).
 *  - `'duel'`       — Adaptive — repeated card-kinds get a penalty
 *                     (Chimera, Bonereaver, Vexel).
 *  - `'swarm'`      — Minions + AoE-vs-single-target tradeoff
 *                     (Dead Hand, Idolarch, Gyorg).
 *
 * Used by the engine for resolver-routing and by the UI for
 * archetype-themed telegraph affordances. Literal-union (rather than
 * open `string`) so consumer switches stay exhaustive at the type
 * level.
 */
export type BossArchetype = 'eye' | 'item-check' | 'layered' | 'sequence' | 'duel' | 'swarm';
