# Dual-Phase Card Effects — Audit & Design (embertide-wun)

**Status:** [v2.2-direction] design doc — no code changes. Implementation gated on designer sign-off and per-change follow-up beads.
**Author:** assistant, 2026-04-24
**Bead:** embertide-wun

## Goal

Every playable card should feel meaningful in BOTH gameplay phases:

- **Main phase** (deck-building): an on-play effect fires, granting resources, triggering an ability, or shaping the next combat.
- **Combat phase** (boss mini-game): the card contributes damage, absorbs damage, heals, draws, multishots, or stuns.

Today the game has a clean **combat** layer (every card resolves to a `CombatEffect` via `combatEffectFor`) but a fragmented **main-phase** layer:

- **Heroes** are the high-water mark — every hero has a real main-phase effect (gain, draw, conditional-heart, per-kill, play-extra) AND a unique combat effect.
- **Items** are the gap — all 10 supply items declare `combat-bonus` / `damage-reduction` as their `effects.kind`, but the store never dispatches those kinds. Items go directly into the Items zone with no main-phase fire; their combat behaviour is sourced separately from `EXPLICIT_OVERRIDES` in `src/data/combatEffects.ts`.
- **Drop-only items** (fairies, heirlooms, freed-princess) declare `effects: { kind: 'gain' }` (a no-op shim) and rely entirely on out-of-band reducers (`playFairyOn`, `combatEffectFor`) for their behaviour.
- **Always-available heroes** are dual-phase complete (mystic, militia-grunt).
- **Champion-signature cards** (spirit-arrow, seer-rune, warblade, ancient-keepsake) have full main-phase effects but fall back to the **default 1-damage combat-attack** because they are no longer in any deck (post-8bh) — handled by embertide-j49z follow-up.

## Audit Table

Cost notation: `g` = green, `r` = red, `k` = keys.

### 1. Buyable Heroes (role='hero', main supply)

| Card | Cost | Main-phase effect | Combat effect | Dual-phase? |
|---|---|---|---|---|
| sage-keeper | g4 | gain g2 + k1 | combat-absorb hp:3 | ✅ strong |
| water-warrior | g3 | gain r2 | combat-attack 3 | ✅ |
| scholar-princess | g5 | draw 2 | combat-draw 2 | ⚠️ same shape both phases — feels redundant |
| wandering-merchant | g3 | gain g1 + r1 | combat-attack 2 | ✅ |
| ranch-keeper | g4 | conditional-heart on boss only | combat-heal 3 | ⚠️ main-phase rarely fires (boss-only); combat-heavy |
| forest-sage | g5 | play-extra hero ×2 | combat-multishot 2×2 | ✅ best example |
| mountain-king | g5 | per-kill +r1 | combat-attack-stun 2 + 1 | ✅ |

### 2. Buyable Items (role='item', main supply)

| Card | Cost | Main-phase effect (declared) | Main-phase effect (dispatched) | Combat effect | Dual-phase? |
|---|---|---|---|---|---|
| short-sword | g3 | combat-bonus r1 fight | **none** | combat-attack 2 | ❌ MAIN-PHASE INERT |
| tower-shield | g3 | damage-reduction 1 | **none** | combat-absorb 2 | ❌ |
| short-bow | g4 | combat-bonus r1 boss | **none** | combat-multishot 1×3 | ❌ |
| curved-throwing-blade | g4 | combat-bonus r1 per:2 | **none** | combat-attack-stun 2 + 1 | ❌ |
| bow | g4 | combat-bonus r1 boss | **none** | combat-multishot 2×2 | ❌ |
| boomerang | g4 | combat-bonus r1 per:2 | **none** | combat-attack-stun 2 + 1 | ❌ |
| elysian-shield | g5 | damage-reduction 2 | **none** | combat-absorb 4 | ❌ |
| cinder-bloom | g4 | combat-bonus r2 fight | **none** | combat-attack 4 | ❌ |
| ancient-sword | g6 | combat-bonus r1 | **none** | combat-attack 5 | ❌ |
| ancient-blade (legendary) | g6 | combat-bonus r2 | **none** | combat-attack 5 | ❌ |

**Finding:** All 10 items declare `combat-bonus` or `damage-reduction` as their EffectSpec, but **no consumer dispatches those kinds** (verified: `grep -rn "kind === 'combat-bonus'" src/store src/core` → zero hits). The declarations are rules-text shims for `effectTextFor`. When you click an item card on your main turn, it moves to your Items zone and does nothing else.

### 3. Drop-only Items (NOT in SUPPLY_PLAN; enter deck via combat drops / chests / crystal)

| Card | Source | Main-phase effect (declared) | Main-phase mechanic (out-of-band) | Combat effect | Dual-phase? |
|---|---|---|---|---|---|
| wisp | chest / wild-boss drop | gain (no-op) | `playFairyOn` revives a downed teammate | combat-heal 3 | ✅ via dedicated reducer |
| great-wisp | chest premium | gain (no-op) | `playFairyOn` (same) | combat-heal 5 | ✅ |
| wisp-in-bottle | wisp-reward chest | gain (no-op) | `playFairyOn` + reusable-once-per-combat | combat-heal 3 | ✅ |
| craghorn-tusk | craghorn heirloom | gain (no-op) | **none** | combat-attack-stun 4 + 1 | ❌ combat-only |
| boulderkin-core | boulderkin heirloom | gain (no-op) | **none** | combat-absorb 4 | ❌ |
| sentinel-eye | sentinel heirloom | gain (no-op) | **none** | combat-attack 6 | ❌ |
| chimera-sword | silver-chimera heirloom | gain (no-op) | **none** | combat-attack 7 | ❌ |
| rainbow-ancient-chimera-sword | rainbow-chimera heirloom | gain (no-op) | **none** | combat-attack 8 | ❌ |
| freed-princess | crystal break | gain (no-op) | **none** | combat-attack 5 | ❌ |

### 4. Always-Available (template; mints into deck)

| Card | Cost | Main-phase effect | Combat effect | Dual-phase? |
|---|---|---|---|---|
| mystic | g3 | gain g2 | combat-absorb 2 | ✅ |
| militia-grunt | g2 | gain r2 | combat-attack 2 | ✅ |
| wild-wolf | r2 | (monster-drop on defeat — N/A) | (default fallback — never drawn) | N/A monster |
| key-vendor (Pell) | g4 | (vendor service, not deck card — N/A) | N/A | N/A |

### 5. Starters (role='starter-green' / 'starter-red')

| Card | Main-phase effect | Combat effect | Dual-phase? |
|---|---|---|---|
| starter-green-shard | shard +g1 | combat-draw 1 | ✅ |
| starter-red-shard | shard +r1 | combat-attack 2 | ✅ |

### 6. Champion-signature (role='starter-home' — orphaned post-8bh)

These are listed for completeness; cleanup is owned by **embertide-j49z**, not by wun.

| Card | Main-phase effect | Combat effect | Status |
|---|---|---|---|
| spirit-arrow | on-play-power r1 | default combat-attack 1 | orphaned (no deck entry) |
| seer-rune | on-play-green-and-draw +g1 + draw1 | default combat-attack 1 | orphaned |
| warblade | on-play-power r2 | default combat-attack 1 | orphaned |
| ancient-keepsake | on-play-green-and-power g1 + r1 | default combat-attack 1 | orphaned |

### 7. Chests (purchase-only, never drawn into deck)

`chest-std`, `chest-enchanted`, `chest-boss`, `chest-ancient` are bought-and-resolved-immediately (`chest-draw` effect dispatches a reward roll). They never enter a player's deck and never reach the combat deck. **Out of scope for this audit** — chests are a market-row mechanic, not a card you play.

## Gap Summary

Three populations of cards lack a main-phase effect:

| Population | Count | Gap |
|---|---:|---|
| Buyable items | 10 | Declared `combat-bonus`/`damage-reduction` is a rules-text shim; no dispatcher exists. Equipping costs green and gives you nothing visible until next combat. |
| Heirloom drops | 6 | Declared `gain` is an explicit no-op; cards exist purely for combat impact. Drawing one outside combat is dead weight. |
| Hero outliers | 2 | scholar-princess (same effect both phases — flat) and ranch-keeper (boss-conditional main effect rarely fires). |

Total: **~18 cards out of ~25 unique playable cards** lack a meaningful main-phase fire. This is the design hazard: a turn that draws an item-heavy hand FEELS like a wasted turn even though the item is in fact contributing to the next combat.

## Design Direction

Two complementary tracks. Both should ship; neither replaces the other.

### Track A — Item main-phase shim ("equip bonus")

Give every item a small, immediate main-phase fire when first equipped. Use a NEW EffectSpec kind so the shim stays distinguishable from rules-text.

Proposal: add `EquipBonusEffect`:

```ts
export interface EquipBonusEffect {
  readonly kind: 'equip-bonus';
  /** Resource granted at the moment the item enters the Items zone. */
  readonly green?: number;
  readonly red?: number;
  readonly keys?: number;
}
```

Authors then write items as a TUPLE of effects: equip-bonus (main-phase fire) + the existing combat-bonus/damage-reduction shim becomes redundant and is retired. The item-tuple shape needs a small change to `Card.effects`: from `EffectSpec` → `EffectSpec | readonly EffectSpec[]`. (Alternative: keep single-effect shape and let `combatEffectFor` continue sourcing combat behaviour from `EXPLICIT_OVERRIDES`; in that world `effects` becomes purely main-phase.)

**Recommended:** make `effects` purely main-phase, keep combat in `EXPLICIT_OVERRIDES`. This matches how heroes already work (their main-phase effect is in `effects`; their combat effect is in `combatEffects.ts`).

Per-card proposed equip-bonus values, sized by green-cost (cheaper items grant smaller bonuses):

| Item | Cost | Proposed main-phase | Existing combat | Notes |
|---|---|---|---|---|
| short-sword | g3 | gain r1 | combat-attack 2 | "swing on equip" |
| tower-shield | g3 | gain g1 | combat-absorb 2 | "ward on raise" |
| short-bow | g4 | gain r1 | combat-multishot 1×3 | |
| curved-throwing-blade | g4 | gain r1 | combat-attack-stun 2 + 1 | |
| bow | g4 | gain r1 | combat-multishot 2×2 | |
| boomerang | g4 | gain r1 | combat-attack-stun 2 + 1 | |
| elysian-shield | g5 | gain g1 + draw 1 | combat-absorb 4 | "fortify and steady" |
| cinder-bloom | g4 | gain r2 | combat-attack 4 | "primed and ready" |
| ancient-sword | g6 | draw 1 | combat-attack 5 | premium tier — card velocity instead of resources |
| ancient-blade (legendary) | g6 | draw 1 + gain r1 | combat-attack 5 | legendary should feel premium |

Total economy impact: g3 items grant +1 resource; g4 items grant +1 resource; g5 items grant +1 resource + a draw; g6 items grant a draw (+ for legendary, also +1 r). Net inflation ≈ 1 resource per item-slot turn — small enough not to break the cost curve. Tuning bead will validate via 2-3 playtests.

> **2026-04-25 ijge knob 1**: All 10 supply-item field costs reduced by 1g after acmf playtest showed field-buy bypass (0/1/0 buys vs 12/16/15 chests across 3 walks). Re-validate via follow-up playtest.

### Track B — Heirloom main-phase fire ("trophy effect")

Heirlooms are rare prestige drops; give each a one-shot main-phase fire that's narratively congruent and respects the rarity gradient. Reuse existing EffectSpec kinds — no new kinds needed.

| Heirloom | Source | Proposed main-phase | Existing combat | Rarity tier |
|---|---|---|---|---|
| craghorn-tusk | craghorn kill | gain r2 + k1 | combat-attack-stun 4 + 1 | mid |
| boulderkin-core | boulderkin kill | conditional-heart when:'boss' amount:1 (HP-heal next combat) | combat-absorb 4 | mid |
| sentinel-eye | sentinel kill | draw 2 | combat-attack 6 | high |
| chimera-sword | silver-chimera kill | gain r2 + g1 | combat-attack 7 | high |
| rainbow-ancient-chimera-sword | rainbow-chimera kill | draw 3 + gain r2 | combat-attack 8 | legendary (post-completion) |
| freed-princess | crystal break | gain g2 + r2 + k1 | combat-attack 5 | story-event tier |

These re-use shapes already in `effects`: `gain`, `conditional-heart`, `draw`. No new EffectSpec kind required.

### Track C — Hero refinements

Two hero outliers worth tuning, but both are smaller than tracks A/B.

- **scholar-princess (g5)**: main draw 2 + combat-draw 2. Same shape both phases is not a bug, but feels flat. Consider main → `draw 2 + gain g1` so the main-phase fire is a small economy step beyond the draw, distinguishing the two phases.
- **ranch-keeper (g4)**: conditional-heart only fires vs boss. Consider main → `conditional-heart when:'boss' amount:1` PLUS `gain g1` (small economy fire on every play, plus the boss bonus when applicable). This keeps the boss-payoff identity but stops the card from being inert in non-boss turns.

## Out of Scope

- Champion-signature cleanup (spirit-arrow / seer-rune / warblade / ancient-keepsake) — owned by **embertide-j49z** (8bh follow-up).
- Banish-from-hand / banish-from-discard authoring — owned by **embertide-2zrr** (91p (b) follow-up).
- Combat difficulty rebalancing after these effects land — owned by **embertide-z5e** (combat tuning pass).

## Recommended Sequencing

These should ship as separate beads, NOT one bundle. Each is independently shippable and independently tuneable.

1. **Track A schema + dispatcher** (1 bead): add `EquipBonusEffect` kind, wire dispatcher in `playCard` item branch + `buyFromField` item branch + `buyAlwaysAvailable` (if/when items become always-available). Tests for resource accounting.
2. **Track A authoring** (1 bead): apply equip-bonus values to all 10 items per the table above. Retire the `combat-bonus`/`damage-reduction` shims from `effects` (combat behaviour stays in `EXPLICIT_OVERRIDES`). Update `effectTextFor` to render the new shape.
3. **Track B authoring** (1 bead): apply heirloom main-phase fires per the table above. No schema changes — re-uses existing kinds.
4. **Track C tuning** (1 bead): apply scholar-princess + ranch-keeper refinements.
5. **Tuning playtest** (1 bead): 2-3 full runs verifying the +1-resource-per-item-equip economy doesn't trivialize the green-cost curve. Defer post-Track-A authoring.

Designer sign-off required on the Track A schema decision (single-effect with retired shims vs. tuple of effects) before bead 1 is opened.

## References

- `src/data/cards.ts` (card definitions, all roles)
- `src/data/combatEffects.ts` (combat behaviour overrides)
- `src/types/effectSpec.ts` (current EffectSpec union — 17 kinds)
- `src/store/gameStore.ts:651-691` (`heroOnPlayDeltas` — current main-phase dispatcher; hero-only)
- `src/store/gameStore.ts:1298-1346` (`playCard` — item branch routes to `equipAsItem` with no main-phase fire)
- `src/ui/effectText.tsx:367-368` (rules-text rendering of combat-bonus / damage-reduction shims)
