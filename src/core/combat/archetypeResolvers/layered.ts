/**
 * Layered-archetype end-of-boss-turn resolver (embertide-lhlo.11,
 * sub of lhlo). Pure boss-only transform — no `CombatState` dependency.
 *
 * The resolver owns ONLY the end-of-boss-turn tick bookkeeping for the
 * layered archetype — there is no state-tag transition to advance each
 * boss-turn (layers don't auto-cycle; they absorb damage). This resolver
 * therefore acts as the registration peg in `ARCHETYPE_RESOLVERS` so
 * `applyArchetypeTick` dispatches cleanly for layered bosses, but its
 * tick implementation is a verified no-op (returns the same reference).
 *
 * The ACTUAL layered mechanic — routing incoming player damage to the
 * first non-defeated layer, carrying overflow to subsequent layers, and
 * flagging core (last layer) death — lives in `routeLayeredDamage` in
 * `src/core/combat/damage.ts`. That function is called at every
 * player-attack site (combat-attack, combat-attack-stun,
 * combat-multishot) before the legacy boss.hp path.
 *
 * OVERFLOW DECISION: overflow IS carried to the next layer.
 *
 * Rationale: `BossLayer.hp` models actual structural HP — the ore
 * shell and crystal core are sequential barriers, not parallel buckets.
 * A single strike that over-powers the outer layer in real play DOES
 * reach the inner layer. Carrying overflow makes combat length
 * predictable (no "partial tick wasted on a 1-hp shell" feel), and the
 * BossStateLayered shape already models per-layer hp as integers with
 * no explicit "wasted-overflow" field — absence of such a field is
 * evidence that the type's author expected overflow to flow through.
 * Not carrying overflow would introduce a "splash damage floor"
 * mechanic that has no analogue in any other archetype and would need
 * explicit designer sign-off. Carry overflow is the safe default.
 *
 * COLOSSEUM bosses (kind: 'boss' entry via enterCombatAction) carry
 * archetype + stateTags pre-populated on their spec literal and are
 * ALWAYS active — no zone-allowlist gate.
 *
 * ZONE bosses (kind: 'card' entry) require the card's zone to appear in
 * `KEYWORD_VOCABULARY_ZONE_ALLOWLIST` before their spec from
 * `ZONE_BOSS_SPECS` is merged into the CombatBoss. This gating happens
 * entirely in `enterCombatAction` (combatBootstrap.ts) before the boss
 * is handed to the combat engine — the resolver itself never sees a
 * zone boss with archetype:'layered' unless the allowlist gate has
 * already passed.
 */

import type { BossLayer, BossStateLayered, BossStateTag, CombatBoss } from '../../../types/combat';

/**
 * Apply one end-of-boss-turn Layered-archetype tick to `boss`. Returns
 * the same reference when no transformation applies — lets the caller
 * use `result === boss` to short-circuit downstream work.
 *
 * A layered boss has NO end-of-boss-turn state-tag transition (layers
 * don't cycle; they absorb damage via `routeLayeredDamage` at
 * player-attack sites). This function exists solely as the registry peg
 * in `ARCHETYPE_RESOLVERS` — the same-reference return is intentional
 * and correct, not an oversight.
 */
export function applyLayeredArchetypeTick(boss: CombatBoss): CombatBoss {
  if (boss.archetype !== 'layered') return boss;
  // Layered has no end-of-boss-turn state-tag evolution — layers are
  // depleted by player-damage routing, not by a tick. Return same ref.
  return boss;
}

// ---------------------------------------------------------------------------
// Damage routing (called at every player-attack site in playerTurn.ts).
// ---------------------------------------------------------------------------

/**
 * Module-private type predicate narrowing a `BossStateTag` to
 * `BossStateLayered`. Lets `Array.prototype.find` return a properly-typed
 * result without a follow-up re-check.
 */
function isLayeredTag(tag: BossStateTag): tag is BossStateLayered {
  return tag.kind === 'layered';
}

/**
 * Locate the layered tag + its index. Returns `null` for any boss the
 * layered router should leave untouched (non-layered archetype, missing
 * stateTags, no layered tag).
 */
function findLayered(boss: CombatBoss): {
  tags: readonly BossStateTag[];
  layeredTag: BossStateLayered;
  tagIndex: number;
} | null {
  if (boss.archetype !== 'layered') return null;
  const tags = boss.stateTags;
  if (!tags) return null;
  const tagIndex = tags.findIndex(isLayeredTag);
  if (tagIndex < 0) return null;
  const layeredTag = tags[tagIndex] as BossStateLayered;
  return { tags, layeredTag, tagIndex };
}

/**
 * Apply `damage` to a single layer (clamped at hp 0; `defeated` flips
 * once hp reaches 0). Returns the same layer reference when damage is 0.
 */
function applyLayerDamage(layer: BossLayer, damage: number): BossLayer {
  if (damage <= 0) return layer;
  const nextHp = Math.max(0, layer.hp - damage);
  return { ...layer, hp: nextHp, defeated: nextHp <= 0 };
}

/**
 * Route `damage` through the layered structure of `boss`. Damage falls
 * on the FIRST non-defeated layer (outermost); overflow carries to the
 * NEXT non-defeated layer, and so on until all damage is absorbed or
 * all layers are defeated.
 *
 * Overflow semantics: when a hit exceeds a layer's remaining HP, the
 * surplus carries to the next non-defeated layer. This reflects the
 * structural sequential-barrier model (shell then core) and matches
 * player intuition ("one big swing pierces the armor").
 *
 * Returns the SAME boss reference (===) when:
 *  - `boss.archetype !== 'layered'`, OR
 *  - the boss carries no `stateTags[].kind === 'layered'`, OR
 *  - `damage <= 0`, OR
 *  - all layers are already defeated (damage lands nowhere — callers
 *    use boss.hp for win detection, which is already 0 in this state).
 *
 * When the last (core) layer is defeated, the returned boss has
 * `boss.hp = 0`, signaling combat win to the playerTurn win-check.
 *
 * Pure: input boss / stateTags / layers arrays are not mutated.
 */
export function routeLayeredDamage(boss: CombatBoss, damage: number): CombatBoss {
  if (damage <= 0) return boss;
  const found = findLayered(boss);
  if (found === null) return boss;

  const { tags, layeredTag, tagIndex } = found;
  const layers = layeredTag.layers;

  // Distribute damage through layers outermost-first, carrying overflow.
  let remaining = damage;
  const nextLayers = layers.slice() as BossLayer[];

  for (let i = 0; i < nextLayers.length; i += 1) {
    const layer = nextLayers[i];
    if (layer.defeated) continue; // already down — skip
    if (remaining <= 0) break;

    const absorbed = Math.min(layer.hp, remaining);
    remaining -= absorbed;
    nextLayers[i] = applyLayerDamage(layer, absorbed);
  }

  // If nothing changed (all layers already defeated, damage bounced),
  // return the same reference to honor the no-op contract.
  const anyChanged = nextLayers.some((l, i) => l !== layers[i]);
  if (!anyChanged) return boss;

  // Rebuild stateTags with the updated layered tag in place.
  const nextTags = tags.slice();
  nextTags[tagIndex] = { kind: 'layered', layers: nextLayers };

  // boss.hp tracks aggregate HP. Compute as sum of non-defeated layer
  // remaining HPs (defeated layers contribute 0). When the last layer
  // falls, this sum becomes 0 — the playerTurn win-check detects it.
  const aggregateHp = nextLayers.reduce((sum, l) => sum + (l.defeated ? 0 : l.hp), 0);

  return { ...boss, hp: aggregateHp, stateTags: nextTags };
}
