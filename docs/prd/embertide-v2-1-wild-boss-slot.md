# PRD: Embertide v2.1 — Wild & Region Boss Encounter Slots

> **Source of truth**: this is a scoped extract documenting the post-REQ-31 playtest finding that prompted bead `embertide-3uj` (P1, ship-gate).
> **Status**: design signed off 2026-04-21 via Q1-Q9 walkthrough on bead `embertide-3uj`. Parent PRD: `docs/prd/embertide-v2.md` (amendment 2, A5/B6). Predecessor extract: `docs/prd/embertide-v2-1-combat.md` (REQ-31 / u-8 DAG).
> **Scope instruction for `/prd-build`**: decompose ONLY the u-9 DAG defined in §C10 below. REQ-31 combat sub-state (u-8) is already landed on `prd-build/embertide-v2-1-combat`; this PRD sits on top of it and does NOT revisit that work.

## Background

REQ-31 shipped MTG-style combat on the v2.1 integration branch. Playtest on 2026-04-21 exposed a structural UX problem upstream of combat itself: bosses (Craghorn, Broodmaw, Boulderkin, Ashen Tyrant, Sentinel, Silver Chimera, Cagewright Vurmox) live in the center-row supply and must be grinded-to-engage via their red + keys costs (Craghorn: red 10 / key 1; Broodmaw: red 13 / key 1; Vurmox: red 18 / key 2). Engaging a boss requires drawing enough resources to pay the cost AND catching the boss card while it's in the field. This is a UX dealbreaker — the designer's words on 2026-04-21:

> "The wild boss and region boss actually should always be available and shown in a separate area like under Aurelia's crystal, and you should be able to fight either whenever you want with the wild boss optional BUT if you defeat it it drops good loot that helps you defeat the region boss."

**REQ-32** is the structural resolution: relocate boss engagement out of the center row into dedicated always-available **Encounter Slots** under the Princess Crystal area. Center-row gameplay remains the deckbuilding loop for regular monsters; boss fights become deliberate, deck-prep-driven choices.

## Design decisions (Q1-Q9, bead embertide-3uj, 2026-04-21)

| # | Question | Decision |
|---|---|---|
| 1 | Slot count & cycling | Two always-available slots (wild + region), both shown simultaneously under Princess Crystal. Neither gates the other. Wild = optional prep, region = zone transition gate. |
| 2 | Wild-boss drop shape | Unique heirloom-tier item card added permanently to defeating hero's combat deck. One thematic drop per wild boss. |
| 3 | Regular monster engagement | Unchanged — regulars stay in center row with current red+keys engagement. Economy retune owned by `embertide-ycj` + `embertide-2gp` post-3uj. |
| 4 | Turn-gate on slots | None. Slots live from turn 1. Difficulty IS the gate — tuned HP/attack patterns make "tap when ready" the self-regulator. |
| 5 | "Good loot" definition | Same as Q2 — unique deck-insert item, not wisp-only. |
| 6 | Visual treatment | Hybrid — stained-glass pane base (shared with `.tray`/`.field`/`.hand`) + boss-altar variant (ember glow border + carved ENCOUNTER header). Ships inline in 3uj; `embertide-b56` absorbs the variant into the Pane primitive later. |
| 7 | Vurmox final-zone treatment | Special endgame DESTINY slot/ritual — distinct visual treatment (bigger art, dramatic frame, cinematic trigger) matching Princess Crystal's reliquary weight. Victory flow unchanged. |
| 8 | `canSpawnRegionBoss` gating | REMOVED. Region boss always engageable. Wild-first-then-region dependency is dead. |
| 9 | Supply pool compensation | None in 3uj. Ship with reduced pool (~67, down from 79); `ycj`/`2gp` add monster variety + utility cards after playtest validates whether 67 feels thin. |

## Zone / boss mapping (ground truth from current code)

Existing `src/rules/zones.ts`:

| Zone | Wild boss(es) | Region boss |
|------|---------------|-------------|
| `sylvani` | Craghorn | Broodmaw |
| `emberpeak` | Boulderkin | Ashen Tyrant |
| `gilded-cage` | **Sentinel + Silver Chimera** (2 wilds) | Cagewright Vurmox |

Gilded Cage has **two** wild bosses. The slot design must handle this:

- **Wild slot queue** per zone: holds an ordered list of wild boss ids. The slot displays the head of the queue; on defeat, the next entry populates. Sylvani/Emberpeak have queues of length 1; Temple has [Sentinel, Silver Chimera]. When the queue empties, the slot shows a "cleared" state (ember extinguished / no tap target).
- **Region slot** is independent — always shows the zone's region boss, always engageable, regardless of wild queue state.
- The data model already supports this: `ZONE_METADATA[zone].wildBossIds: readonly string[]` is already an array.

## Heirloom item drops (C1)

Four new item cards, one per wild boss. Each is a distinct archetype so the player's deck composition varies based on which wilds they engage. All are `kind: 'item-active'` (or variant — see below) and combat-deck eligible under existing REQ-31 rules.

### Craghorn Tusk (Sylvani wild drop) — **WEAPON (active)**
- **Effect**: `combat-multishot` variant — deal 4 damage + inflict **stun 1** on boss (boss skips next attack).
- **Rationale**: Craghorn's signature frontal charge. Stun is the first control-effect card in the combat pool; breaks Broodmaw's aggressive attack rhythm so mid-game Sylvani wild→region transition feels earned.
- **Balance target**: replaces one average-damage play with a damage+control beat. Shouldn't stack (stun non-cumulative).
- **Implementation note**: requires extending `CombatEffect` union with `combat-attack-stun` OR adding a `stunTurns: number` field to `combat-multishot`. Scoping question for u-9b.

### Boulderkin Core (Emberpeak wild drop) — **AMULET (passive)**
- **Effect**: Passive — once per combat, when the player who owns this card would take damage, reduce incoming damage by 2 (min 0). Fires automatically on first damage event, then exhausts for the rest of combat.
- **Rationale**: Boulderkin is a walking rock body; its core is the weak point, which lore-wise doubles as armor when worn. Gives the player a defensive layer against Ashen Tyrant's aoe pattern.
- **Balance target**: soaks a single big hit per combat. Not stackable within a single combat.
- **Implementation note**: requires a new `item-passive` card kind (or `CombatEffect: 'combat-passive-damage-reduce'`). Scoping question for u-9b.

### Sentinel Eye (Temple wild #1 drop) — **ITEM (active)**
- **Effect**: `combat-attack` — deal 5 damage to boss. **Ignores battlefield absorb** (damage applies directly to `boss.hp`, skipping `applyBattlefieldDamage`).
- **Rationale**: Sentinel's laser is canonically piercing. Mechanically: counters Silver Chimera's `'battlefield-then-player'` targeting (if the player built a battlefield wall, Chimera's attacks absorb into it; Sentinel Eye returns the favor).
- **Balance target**: single-target 5 dmg is above the starter-hero ceiling (most heroes deal 2-3 in combat). Counter-play against absorb-heavy bosses.
- **Implementation note**: requires a targeting modifier on `combat-attack` — e.g. `pierce: true` or a new effect `combat-attack-pierce`.

### Silver Chimera Mane (Temple wild #2 drop) — **HEIRLOOM (passive utility)**
- **Effect**: Passive — on the player's first players-turn in combat, draw **+1 card** above the normal hand-cap refill.
- **Rationale**: Silver Chimera is the hardest wild; its drop should feel like prestige loot — not raw damage, but card advantage, which is the deckbuilder's highest-value currency. Scales with deck quality (drawing 1 more from a well-curated deck is massively impactful).
- **Balance target**: +1 card ≈ +2-4 damage over the course of a combat. Non-stackable (the player only gets one "first turn").
- **Implementation note**: requires `combat-passive-draw` OR a pre-turn hook registry. Interacts with hand-cap enforcement — extra draw does NOT round-trip to discard.

### Design alternatives for user review

For each item, a simpler fallback if `CombatEffect` union expansion is heavier than desired:

- **Craghorn Tusk alt**: plain `combat-multishot` (2 dmg × 2 hits = 4 total, no stun). Loses control beat, ships without union extension.
- **Boulderkin Core alt**: active `combat-absorb` with hp=4 (battlefield shield, reuses existing effect). Loses passive elegance but ships with zero schema changes.
- **Sentinel Eye alt**: plain `combat-attack` dmg=6, no pierce. Still above-curve, ships without `pierce` modifier.
- **Silver Chimera Mane alt**: active `combat-draw` with N=2 (reuses existing effect). Loses passive persistence — fires once when played, not once-per-combat.

Scoping decision for u-9b: ship alternates if the ambitious versions would bloat the unit past 600-line diff target.

## State shape (C2)

Derive slot state from existing `defeatedBossIds` + zone metadata rather than adding new persistent state. No new `KidGameState` fields needed.

Two new pure selectors in `src/rules/zones.ts`:

```
currentWildBossForZone(state, zoneId): string | null
  // returns the head of ZONE_METADATA[zoneId].wildBossIds
  // that is NOT in state.defeatedBossIds.
  // returns null when all wilds cleared.

currentRegionBossForZone(state, zoneId): string | null
  // returns ZONE_METADATA[zoneId].regionBossId
  // unless it's in state.defeatedBossIds, then null.
```

`canSpawnRegionBoss` is **deleted** from `src/rules/zones.ts`. All callers (there's at least one in `src/store/slices/combat.ts`) are updated — region boss is always spawnable once the zone is active.

## Supply changes (C3)

`src/data/cards.ts`:

- `SUPPLY_PLAN` loses 7 boss entries (12 total copies removed): `craghorn × 3`, `broodmaw × 1`, `boulderkin × 3`, `ashen-tyrant × 1`, `sentinel × 2`, `silver-chimera × 1`, `cagewright-vurmox × 1`.
- `SUPPLY_CARD_COUNT` drops from 79 → 67.
- Boss templates themselves (`craghorn`, `broodmaw`, etc.) remain exported for reference by `ZONE_METADATA` and the new slot selectors — they just don't populate the center-row market.
- `KID_CARDS` retains the templates (id lookups still resolve).
- 4 new heirloom item cards (`craghorn-tusk`, `boulderkin-core`, `sentinel-eye`, `silver-chimera-mane`) are added to `KID_CARDS` but NOT to `SUPPLY_PLAN` — they enter player decks only via wild-boss defeat, never via center-row purchase.

## Engagement flow (C4)

### Wild slot tap
1. User taps `<WildBossEncounterSlot />` for currently-displayed wild boss.
2. Dispatch `ENGAGE_WILD_BOSS_SLOT` action with `{ zoneId, bossId }`.
3. Reducer dispatches `COMBAT_ENTER` (existing u-8 action) with `entryContext: { sourceCardId: bossId, entrySource: 'wild-boss-slot' }`.
4. Combat resolves normally via u-8 combat sub-state.
5. On WIN → existing `COMBAT_RESOLVE_WIN` flow PLUS new heirloom drop routing (C5).
6. On LOSS → existing `COMBAT_RESOLVE_LOSS` flow (unchanged).

### Region slot tap
1. User taps `<RegionBossEncounterSlot />` for the zone's region boss.
2. Dispatch `ENGAGE_REGION_BOSS_SLOT` action with `{ zoneId, bossId }`.
3. Reducer dispatches `COMBAT_ENTER` with `entryContext: { sourceCardId: bossId, entrySource: 'region-boss-slot' }`.
4. Combat resolves normally.
5. On WIN → existing shard grant + zone advance (A5/B6 unchanged).
6. On LOSS → existing loss flow.

### Red + keys cost
The existing red + keys gate in `fightMonster` / `defeatAlwaysAvailableMonster` is bypassed entirely for slot engagement. The slot dispatches `COMBAT_ENTER` directly, skipping the cost check. (Cost check still applies to center-row regulars.)

## Heirloom drop routing (C5)

Extend `COMBAT_RESOLVE_WIN` reducer logic:

```
on COMBAT_RESOLVE_WIN:
  apply existing hearts/wisp/shard drops (u-8c behavior preserved)
  if entrySource === 'wild-boss-slot':
    heirloomId = HEIRLOOM_DROPS[bossId]  // lookup table
    targetHeroId = determineDefeatingHero(state)
    append heirloomId to that hero's persistent deck
    fire tutorial 'heirloom-drop' (new bubble)
```

New `HEIRLOOM_DROPS` table in `src/data/cards.ts`:
```
craghorn           → craghorn-tusk
boulderkin     → boulderkin-core
sentinel        → sentinel-eye
silver-chimera    → silver-chimera-mane
```

`determineDefeatingHero(state)` returns the id of the hero who dealt the killing blow. For co-op shared-turn combats, use the most-recent-card-played's owner. Tie-break to player-1 if ambiguous.

Heirloom insert target: the hero's **own deck** (distinct from shared combat deck) — items travel with the hero card. On subsequent combat entries, `buildCombatDeck` picks them up via the existing "items with `kind: 'item-active'`" eligibility rule.

## UI surfaces (C6)

### New components

- `src/ui/WildBossEncounterSlot.tsx` — altar-variant pane, displays current wild boss art + HP + tap-to-engage. "Cleared" state when wild queue empty for current zone.
- `src/ui/RegionBossEncounterSlot.tsx` — altar-variant pane, displays region boss art + HP + tap-to-engage. "Cleared" state when region boss defeated (rare; triggers zone advance before user sees it).
- `src/ui/BossAltarPane.tsx` — shared pane primitive used by both slots above. Inline stained-glass variant with `--boss-altar-glow` CSS var + ENCOUNTER header strip. **This is the b56 seed** — the file should be structured so b56 can absorb it into a general Pane primitive with `variant="boss-altar"` without rewrite.
- `src/ui/GanonDestinySlot.tsx` — special variant of `RegionBossEncounterSlot` for Gilded Cage. Larger dimensions, distinct color palette (deep purple / gold), ceremonial animation on tap. Only renders when `currentZone === 'gilded-cage'`.

### Board layout changes

`src/ui/Board.tsx` (or equivalent — verify current path): insert a new row directly beneath `<PrincessCrystalCell />`. Row contains `<WildBossEncounterSlot />` + `<RegionBossEncounterSlot />` side by side. When zone is `gilded-cage` and Sentinel + Silver Chimera both defeated, swap `<RegionBossEncounterSlot />` for `<GanonDestinySlot />`.

### Visual spec (rough)

- **Altar pane background**: stained-glass texture from existing pane primitive, tinted with 10% red overlay, ember-glow border animation (0.5s pulse cycle).
- **ENCOUNTER header**: small carved banner atop the pane, serif font, gold-on-black, renders "WILD ENCOUNTER" or "REGION ENCOUNTER".
- **Tap affordance**: the pane gains a shimmer on hover/long-press to signal interactivity. Locked/cleared state: desaturated, no shimmer.
- **DESTINY slot**: pane dimensions 1.5× normal altar, purple-to-gold gradient border, persistent flame animation (not pulse), ENCOUNTER header reads "DESTINY".

## Tutorial coverage (C7)

New bubbles in `src/tutorial/v20.ts`:

- `wild-boss-slot-revealed` — first time `currentWildBossForZone` returns non-null after zone entry. "This is the zone's wild boss. Fighting it is optional, but defeating it drops powerful heirloom items that help you against the region boss."
- `region-boss-slot-revealed` — first time player sees region slot. "The region boss guards the path to the next zone. You can fight it any time — but it's hard. Build up your deck first."
- `heirloom-drop` — on first heirloom drop. "You got the {itemName}! It's now in your hero's deck — it'll show up in future combats."
- `destiny-slot-revealed` — first time player sees Vurmox's DESTINY slot. "This is your final fight. When you're ready, tap to face the Demon King."

Progressive disclosure: fire each bubble once per run.

## Balance goals (C8)

No explicit numeric changes in u-9a..u-9e. u-9f owns tuning:

- **Region boss HP/attack targets** assume player arrives with 0-2 heirlooms (not requiring all 4). Vurmox balance assumes ~2-3 heirlooms present for a typical completionist run, 0-1 for a speedrun.
- **Combat length**: still 3-7 turns per boss (matches u-8's balance sim target).
- **Playtester scenarios** (new, in `tools/playtester/`): `wild-then-region.spec.ts` (full completion path), `region-only.spec.ts` (skip-wilds speedrun), `wild-heirloom-wins-region.spec.ts` (prove heirloom materially helps).

## Tests + gates (C9)

- Unit tests on `currentWildBossForZone`, `currentRegionBossForZone` (zones.test.ts extension).
- Unit tests on each heirloom CombatEffect resolver (combatEffects.test.ts extension).
- Unit tests on `HEIRLOOM_DROPS` lookup + `determineDefeatingHero` edge cases.
- Integration test: full Craghorn slot engagement → WIN → Craghorn Tusk appears in Link's deck → subsequent Broodmaw engagement → Craghorn Tusk playable in combat.
- Integration test: region slot is engageable from turn 1 (assert `canSpawnRegionBoss` is not called / deleted).
- Regression test: center-row regulars (Thorn Scrub, Scrabling) unchanged — engagement cost still applies.
- Supply test: `SUPPLY_CARD_COUNT === 67` (was 79).
- Playtester: 3 new Playwright scenarios per C8.
- Test count target: +~35 tests over current 940 baseline (→ ~975).

## Work-unit DAG (C10) — decomposition input

Each unit targets ≤600 lines diff, ≤8 files (per v2 A11 context-window fit). All units depend on u-8 (REQ-31 combat sub-state) being landed — that's the current state of `prd-build/embertide-v2-1-combat`.

### u-9a — schema + supply changes (MEDIUM)
**Scope**: `src/rules/zones.ts`, `src/data/cards.ts`, `src/store/slices/combat.ts` (caller of `canSpawnRegionBoss`), `src/rules/zones.test.ts`, `src/store/zones.test.ts`.
**Deps**: none (Layer 0 within u-9 DAG — assumes u-8 is merged).
**Description**: Add `currentWildBossForZone` + `currentRegionBossForZone` selectors to `src/rules/zones.ts`. Delete `canSpawnRegionBoss` and all its callers — update call sites to use the new selectors. Remove 7 boss entries (12 copies) from `SUPPLY_PLAN` in `src/data/cards.ts`. Verify `SUPPLY_CARD_COUNT` resolves to 67. Retain boss templates in module scope (they're still referenced by `ZONE_METADATA`).
**Acceptance**:
- `currentWildBossForZone(state, zoneId)` returns the first `wildBossIds` entry not in `state.defeatedBossIds`, or null
- `currentRegionBossForZone(state, zoneId)` returns the `regionBossId` unless defeated, or null
- `canSpawnRegionBoss` is removed (no re-exports, no call sites)
- `SUPPLY_PLAN` no longer contains any boss entries (craghorn, broodmaw, boulderkin, ashen-tyrant, sentinel, silver-chimera, cagewright-vurmox)
- `SUPPLY_CARD_COUNT === 67`
- `KID_CARDS` still exports all 7 boss templates (id lookups like `KID_CARDS.find(c => c.id === 'craghorn')` still resolve)
- Unit tests cover both new selectors across all 3 zones, including Temple's 2-wild queue
- `pnpm typecheck` passes with 0 errors
- `pnpm lint` passes with 0 warnings
- `pnpm test` passes (existing 940 tests green minus any that assumed 79-card supply; those are updated to 67)

### u-9b — heirloom item data + combat effects (MEDIUM)
**Scope**: `src/data/cards.ts`, `src/data/combatEffects.ts`, `src/types/combat.ts` (CombatEffect union extension), `src/data/combatEffects.test.ts`.
**Deps**: u-9a.
**Description**: Add 4 new `Card` entries to `KID_CARDS`: `craghorn-tusk`, `boulderkin-core`, `sentinel-eye`, `silver-chimera-mane`. Wire each to a `CombatEffect` in `src/data/combatEffects.ts`. Extend `CombatEffect` discriminated union as needed (stun, pierce, passive-damage-reduce, passive-draw). Add `HEIRLOOM_DROPS: Record<string, string>` lookup table to `src/data/cards.ts` mapping wild-boss id → heirloom id. **Scoping note for implementer**: if ambitious CombatEffect extensions would bloat the diff past 600 lines, ship the fallback alternates listed in §C1 "Design alternatives" and record the deferral in a follow-on bead.
**Acceptance**:
- `KID_CARDS` includes `craghorn-tusk`, `boulderkin-core`, `sentinel-eye`, `silver-chimera-mane`
- Each heirloom is `kind: 'item-active'` (or a new `'item-passive'` kind if implementing passive versions)
- `HEIRLOOM_DROPS` lookup resolves all 4 wild boss ids correctly
- `CombatEffect` resolver in `src/data/combatEffects.ts` handles each heirloom's effect
- Unit tests cover each heirloom's combat effect (damage, stun, pierce, passive-defense, passive-draw) in isolation
- Heirlooms are NOT in `SUPPLY_PLAN` (not buyable via center row)
- `pnpm typecheck` + `pnpm lint` + `pnpm test` pass

### u-9c — slot engagement + heirloom drop routing (LARGE)
**Scope**: `src/store/slices/combat.ts`, `src/store/gameStore.ts`, `src/core/combatEngine.ts` (if helper needed for `determineDefeatingHero`), `src/store/slices/combat.test.ts`.
**Deps**: u-9a, u-9b.
**Description**: Add reducer actions `ENGAGE_WILD_BOSS_SLOT` + `ENGAGE_REGION_BOSS_SLOT`. Both dispatch `COMBAT_ENTER` with appropriate `entryContext` (including new `entrySource` field: `'wild-boss-slot' | 'region-boss-slot'`). Bypass red + keys cost check for slot engagements. Extend `COMBAT_RESOLVE_WIN` reducer: when `entrySource === 'wild-boss-slot'`, look up `HEIRLOOM_DROPS[bossId]`, append the heirloom card to the defeating hero's persistent deck. Implement `determineDefeatingHero(state)` — last-card-played's owner, tie-break player-1. Extend `CombatEntryContext` type with `entrySource` field.
**Acceptance**:
- `ENGAGE_WILD_BOSS_SLOT` reducer dispatches `COMBAT_ENTER` without calling the red/keys cost check
- `ENGAGE_REGION_BOSS_SLOT` reducer dispatches `COMBAT_ENTER` without calling the red/keys cost check
- `CombatEntryContext` includes `entrySource: 'wild-boss-slot' | 'region-boss-slot' | 'field'` (legacy 'field' preserves u-8 compatibility for center-row fights — which are now only regulars)
- `COMBAT_RESOLVE_WIN` routes heirloom drop on `entrySource === 'wild-boss-slot'` via `HEIRLOOM_DROPS` lookup
- `determineDefeatingHero(state)` implemented + unit tested (last-card-played owner, p1 tiebreak)
- Heirloom appends to `state.players[heroOwner].heroes.find(h => h.id === heroId).deck` (or wherever the hero-persistent deck lives — verify in current code)
- Subsequent `buildCombatDeck` picks up the heirloom via existing item-active eligibility
- Integration test: Craghorn slot → WIN → Craghorn Tusk in Link's deck → Broodmaw slot → Craghorn Tusk playable
- `pnpm typecheck` + `pnpm lint` + `pnpm test` pass

### u-9d — UI surfaces (MEDIUM)
**Scope**: `src/ui/WildBossEncounterSlot.tsx` (new), `src/ui/RegionBossEncounterSlot.tsx` (new), `src/ui/BossAltarPane.tsx` (new), `src/ui/GanonDestinySlot.tsx` (new), `src/ui/Board.tsx` (or equivalent — the top-level board layout file), `src/ui/BossAltarPane.css` (styles).
**Deps**: u-9a, u-9c.
**Description**: Build the 4 new React components per C6. `BossAltarPane` is the shared primitive — inline stained-glass + boss-altar variant (ember glow border, ENCOUNTER header). `WildBossEncounterSlot` + `RegionBossEncounterSlot` wrap it with slot-specific state (current boss, HP, tap handler). `GanonDestinySlot` is a specialized variant with larger dimensions + DESTINY treatment. Board layout gains a new row under Princess Crystal hosting the two slots. Swap region slot for Vurmox DESTINY slot when zone is gilded-cage AND both wilds defeated.
**Acceptance**:
- `<WildBossEncounterSlot />` renders when `currentWildBossForZone` returns non-null; tapping dispatches `ENGAGE_WILD_BOSS_SLOT`
- `<RegionBossEncounterSlot />` renders when `currentRegionBossForZone` returns non-null; tapping dispatches `ENGAGE_REGION_BOSS_SLOT`
- `<GanonDestinySlot />` renders for `zone === 'gilded-cage'` when both wild bosses defeated
- Both slots show boss art + name + HP + engagement affordance
- Slots disable (desaturated, no tap) when boss already defeated
- `BossAltarPane` CSS variables structured so `embertide-b56` can later absorb the variant without rewriting consumers
- Bosses no longer spawn in the center-row field (verify visually + via test)
- Visual regression: Princess Crystal area shows the new row without obscuring existing UI
- `pnpm typecheck` + `pnpm lint` + `pnpm test` pass

### u-9e — tutorial + playtester scenarios (SMALL)
**Scope**: `src/tutorial/v20.ts`, `src/tutorial/v20.test.ts`, `tools/playtester/wild-then-region.spec.ts` (new), `tools/playtester/region-only.spec.ts` (new), `tools/playtester/wild-heirloom-wins-region.spec.ts` (new).
**Deps**: u-9d.
**Description**: Add 4 tutorial bubbles per C7 (wild-slot-revealed, region-slot-revealed, heirloom-drop, destiny-slot-revealed). Each fires once per run via existing tutorial progression. Add 3 Playwright scenarios to `tools/playtester/`: full wild-then-region completion, region-only skip-wilds path, heirloom-enables-region-win path. Scenarios run against `:5173` dev server per existing harness.
**Acceptance**:
- 4 new tutorial bubbles added with correct trigger conditions
- Each bubble fires exactly once per run
- 3 Playwright scenarios exist in `tools/playtester/` and pass against `:5173`
- Scenarios use the existing `?debug=` seed mechanism or a new `?debug=wild-boss-slot` seed
- `pnpm playtest` runs all scenarios (existing + new) green
- `pnpm typecheck` + `pnpm lint` + `pnpm test` pass

### u-9f — balance tuning pass (MEDIUM)
**Scope**: `src/data/bossAttackPatterns.ts`, `src/data/cards.ts` (boss `hp`/`power` fields), `src/balance/combatLengthSim.ts`, `src/balance/greedyShardSimulation.test.ts`.
**Deps**: u-9e.
**Description**: Tune wild + region boss HP + attack patterns so "difficulty is the gate." Target: a player with 0 heirlooms arriving at a region boss has a ~30-40% win rate (hard but possible); with 2 heirlooms, ~65%; with 3+, ~85%. Wild boss HP tuned so the fight is ~4-6 turns for a turn-1 attempt. Extend `combatLengthSim.ts` to model heirloom presence as an input variable. Update `greedyShardSimulation` to use slot engagement instead of field engagement.
**Acceptance**:
- Wild boss median combat length: 4-6 turns across 1000 sim runs per wild
- Region boss median combat length: 5-8 turns across 1000 sim runs
- Vurmox median combat length: 7-10 turns across 1000 sim runs
- Win rate curve: 0 heirlooms → ~30-40%; 2 → ~65%; 3+ → ~85% for a "typical" deck composition
- `combatLengthSim` accepts an `heirloomCount: number` parameter
- `greedyShardSimulation` uses slot engagement (not field engagement)
- All balance sims green
- `pnpm typecheck` + `pnpm lint` + `pnpm test` pass

## Dependencies graph

```
u-8 (REQ-31 landed)
  ↓
u-9a (schema + supply)
  ↓
u-9b (heirloom data)
  ↓
u-9c (slot engagement + heirloom drop)
  ↓
u-9d (UI surfaces)
  ↓
u-9e (tutorial + playtester)
  ↓
u-9f (balance tuning)
```

Linear DAG — each unit builds on the previous. No parallelism opportunity within u-9.

## Out of scope (flagged for follow-on beads)

- Center-row economy rebalance → `embertide-ycj` (reward tuning) + `embertide-2gp` (purchase optimization).
- Monster pool expansion (Nightbat, Skittermite, etc.) → `embertide-ycj`.
- Utility cards (+draw, banish, +buy, +fight, keys-for-chests) → `embertide-2gp`.
- Pane primitive consolidation → `embertide-b56` (cathedral pane template). u-9d's `BossAltarPane` is the seed.
- Combat-arena raster → `embertide-m6l`.
- Enhanced CombatLog → `embertide-1c4`.
- Boss-defeat cinematic for Vurmox DESTINY slot → may spawn new bead post-u-9d if designer wants more than the in-slot animation.
