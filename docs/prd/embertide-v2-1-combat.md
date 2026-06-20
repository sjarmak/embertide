# PRD: Embertide v2.1 — MTG-Style Boss Combat (REQ-31)

> **Source of truth**: this is a scoped extract of `docs/prd/embertide-v2.md` Amendment 2 (REQ-31). Any conflict resolves to the canonical doc.
> **Status**: SIGNED OFF 2026-04-20. Canonical bead: `embertide-95m` (P1, feature). Parent PRD: `docs/prd/embertide-v2.md`.
> **Scope instruction for `/prd-build`**: decompose ONLY the u-8 DAG defined in §B10 below. v2.0 REQs are already landed (tag `v2-final@5da6dee`); do NOT touch them.

## Background

v2.0 shipped the co-op + map structure (`sharedTriforce`, 3-zone spine, HPStrip, downed/revive/wisp state). `applyDamage()` is implemented + exported but never called by any gameplay mechanic, so hearts drops silently clamp against `hpMax` and HPStrip reads as decoration (bug `embertide-q00`).

**REQ-31** is the structural resolution: when a Wild Boss or Region Boss is engaged from the main board, the game transitions into a **bounded combat sub-state**. Combat uses a deck curated from gathered cards, a boss turn loop that routes damage via `applyDamage` (resolving q00 structurally), and returns to the main board with a structured `CombatResult`.

## Design decisions (resolved at sign-off)

| # | Question | Decision |
|---|---|---|
| 1 | Per-turn action budget | 3 plays/turn |
| 2 | Deck-empty behaviour | No re-shuffle in v2.1 |
| 3 | Combat-hand cap | 5 cards |
| 4 | Co-op turn ordering | Shared turn (either player plays from shared hand) |
| 5 | Downed players in combat | Excluded (no card plays, no damage target), BUT receive hearts-drop share on WIN |
| 6 | Hearts-drop tuning | No tune in v2.1 — mechanics first, balance after |
| 7 | Retreat / flee | No retreat in v2.1 |
| 8 | Vurmox fight framing | Same schema as other Region Bosses (no mid-fight phase transitions in v2.1) |
| 9 | Combat RNG | Deterministic seed: `state.seed + combatEntryTurn` |

## Schema (B1)

`CombatState` with fields: `boss` (CombatBoss), `combatDeck` (Card[]), `combatHand` (Card[]), `combatDiscard` (Card[]), `battlefield` (BattlefieldCard[]), `turnIndex` (number), `activeActor` ('players'|'boss'), `entryContext` (CombatEntryContext).

Add `KidGameState.activeCombat: CombatState | null` field (null when not in combat).

New reducer action types: `COMBAT_ENTER`, `COMBAT_RESOLVE_WIN`, `COMBAT_RESOLVE_LOSS`.

`CombatBoss`: `{ hp, hpMax, attackPattern: BossAttackPattern, sourceCardId }`.
`BattlefieldCard`: `{ cardId, hp, hpMax, combatEffectId }`.
`BossAttackPattern`: `{ damagePerTurn: number, targeting: 'player-hp'|'battlefield-then-player'|'aoe', onDefeatEffect: CombatOnDefeatEffect|null }`.
`CombatEffect` discriminated union: `combat-attack`, `combat-absorb`, `combat-heal`, `combat-draw`, `combat-multishot`.

All types are pure data. No timers, no async in reducer.

## Combat deck construction (B2)

`buildCombatDeck(state, entryContext): Card[]` pure function:
- **Eligible**: starter cards (`starter-green`, `starter-red`, `starter-home`); heroes in `KidPlayer.championSlot` and any heroes currently `inPlay`; items in `KidPlayer.items` with `kind: 'item-active'`. **Fairies excluded** — they remain main-board-revive only.
- **Ineligible**: main-board draw deck, discard pile, chest contents, gems, re-roll tokens.
- **Shared in co-op**: single pool contributed by both players; no per-player ownership during combat.
- **Deterministic shuffle**: `mulberry32(state.seed + combatEntryTurn)`. Reproducible per combat entry.
- **Draw**: 5 on combat entry; 1 at each players-turn start; hand cap **5** (per Q3). Excess drawn cards discard to `combatDiscard`.
- **Deck empty**: no auto-shuffle. Players play what remains in hand.

## Boss attack pattern + damage routing (B3)

Three targeting modes:

- **`player-hp`**: split damage evenly across non-downed players. Excess rounding goes to active-attacker first. Call `applyDamage(player, amountPerPlayer)` and **IMMEDIATELY** `checkCoopLoss(state)` after each `applyDamage` (contract at `src/store/gameStore.ts:195-202`).
- **`battlefield-then-player`**: absorb damage front-to-back across `battlefield` cards until empty. Each battlefield card takes damage up to its `hp`; at 0 hp it moves to `combatDiscard`. Residual damage spills to `player-hp` rule.
- **`aoe`**: apply damage to every battlefield card AND every non-downed player simultaneously. Same `checkCoopLoss` rule.

New helper: `applyBattlefieldDamage(battlefield: BattlefieldCard[], amount: number): BattlefieldCard[]` in `src/core/combat.ts`. Unit-tested in isolation.

**Desperation**: when `boss.hp < DESPERATION_HP_PCT * boss.hpMax`, switch to `'aoe'` targeting. `DESPERATION_HP_PCT` lives in `src/core/balance.ts`; v2.1 default 0.25.

## Combat turn loop (B4)

```
CombatEntry:
  build combatDeck, draw 5, activeActor='players', turnIndex=0
Repeat:
  PlayersTurn (shared turn per Q4):
    Either player may play up to 3 cards (Q1) from shared hand, or pass.
    Each played card resolves its CombatEffect.
    On pass → BossTurn.
  BossTurn:
    Resolve boss.attackPattern (apply damage per B3).
    Check boss.hp<=0 (WIN), all-non-downed-players-downed (LOSS via checkCoopLoss).
    Increment turnIndex.
    Apply desperation if boss.hp < DESPERATION_HP_PCT * hpMax.
Until WIN or LOSS.
```

`BOSS_TURN_THRESHOLDS` and `DESPERATION_HP_PCT` live in `src/core/balance.ts` as named constants.

## Card combat effects (B5)

`CombatEffect` discriminated union:
- `combat-attack`: deal N damage to `boss.hp`
- `combat-absorb`: enter battlefield with `hp: N`
- `combat-heal`: restore N hp to a battlefield card or non-downed player
- `combat-draw`: draw N from `combatDeck`
- `combat-multishot`: deal X damage Y times

Data sheet `src/data/combatEffects.ts` maps each card in `src/data/cards.ts` to its combat effect. **Default for cards without explicit `CombatEffect`**: `combat-attack` with damage = card's main-board `power` stat. Every card in the combat deck is playable.

## Entry/exit hooks (B6)

**Entry** (in `src/core/combat.ts` — the main-board file, NOT the sub-state): inspect engaged beast `tier` in `fightMonster` / `defeatAlwaysAvailableMonster`. If `tier ∈ {'wild-boss', 'region-boss'}`, dispatch `COMBAT_ENTER` action. Ordinary monsters keep existing instant-resolution path.

**Exit — WIN** (`COMBAT_RESOLVE_WIN`): apply existing drop rules:
- hearts heal attackers up to `hpMax` (per REQ-2)
- wisp drop for Wild Boss (per A6)
- shard grant for Region Boss (per A5: Power on Vurmox defeat; Courage on Gilded-cage clear if coincident)
- zone advance for Region Boss
- `activeCombat = null`

**Exit — LOSS** (`COMBAT_RESOLVE_LOSS`): residual damage already applied during combat; ensure `checkCoopLoss` fired. If `outcome === 'loss'` → loss screen; else main board resumes with one/both downed (revive paths from A3 apply). `activeCombat = null`.

**No retreat in v2.1** (per Q7).

## UI surfaces (B7)

New React components:
- `src/ui/CombatScreen.tsx` — full-viewport; replaces main board visually while `activeCombat !== null`
- `src/ui/CombatBossPanel.tsx` — boss HP bar + attack telegraph
- `src/ui/CombatBattlefield.tsx` — played cards row; each shows `hp/hpMax`
- `src/ui/CombatHand.tsx` — shared combat hand; tap-to-play
- `src/ui/CombatLog.tsx` — last 3 events in plain language

Boss attack telegraph: 1-line banner before BossTurn resolves ("Craghorn winds up for 3"). Telegraph is legibility-only; attack resolves without user input.

Art budget (REQ-30 structural): combat background raster (1 new), boss-portrait slot re-uses u-6a/b/c rasters, UI chrome vector-only. `<ArtPendingFrame>` fallback acceptable.

## Tutorial coverage (B8)

Progressive disclosure per REQ-24 premortem edit. New tutorial bubbles:
- `combat-entry` — "You engaged Craghorn! Play cards from your combat deck to fight."
- `combat-card-played` — "Nice! You dealt 2 damage."
- `combat-boss-turn` — "Craghorn attacks for 3 — your hero blocked 2, you took 1."
- `combat-win` — "Craghorn down! You got 2 hearts."
- `combat-loss` — "You went down. Heroes can still revive you."

First combat fires `combat-entry` + `combat-card-played` only. Subsequent combats introduce boss-turn telegraphing.

## Tests + balance gates (B9)

- Unit tests on `applyBattlefieldDamage`, `buildCombatDeck`, each `CombatEffect` resolver, each `BossAttackPattern.targeting` branch
- Integration test: full Craghorn combat entry → WIN (hearts applied, wisp dropped, shards unchanged)
- Integration test: full Craghorn combat entry → LOSS with both players (assert `checkCoopLoss` fired, `outcome === 'loss'`)
- **q00 regression**: fight Broodmaw to victory with partial HP going in; assert post-combat HP reflects hearts drop (NOT silently clamping at hpMax)
- **Balance sim extension**: greedy-shard sim runs 1000 games per strategy (Wisdom-rush, Map-rush, Vurmox-rush, mixed); assert median combat-length per boss in 3–7 turns window
- Test count target: +~40 tests over 819 baseline

## Work-unit DAG (B10) — decomposition input

Each unit targets ≤600 lines diff, ≤8 files (A11 context-window fit).

### u-8a — schema (MEDIUM)
**Scope**: `src/types/combat.ts` (new), `src/types/kidGameState.ts`, `src/store/gameStore.ts` (type imports only).
**Deps**: none (Layer 0).
**Description**: Introduce `CombatState`, `CombatBoss`, `BattlefieldCard`, `BossAttackPattern`, `CombatEffect` discriminated union, `CombatOnDefeatEffect`, `CombatEntryContext`. Add `KidGameState.activeCombat: CombatState | null` field. Add reducer action type discriminants `COMBAT_ENTER`, `COMBAT_RESOLVE_WIN`, `COMBAT_RESOLVE_LOSS` to the action union — types only, no reducer logic yet. Update initial-state factory to set `activeCombat: null`.
**Acceptance**:
- `src/types/combat.ts` exports `CombatState`, `CombatBoss`, `BattlefieldCard`, `BossAttackPattern`, `CombatEffect`, `CombatOnDefeatEffect`, `CombatEntryContext` as TypeScript types
- `KidGameState` has `activeCombat: CombatState | null` field
- Reducer action union includes `COMBAT_ENTER`, `COMBAT_RESOLVE_WIN`, `COMBAT_RESOLVE_LOSS` discriminants
- Initial state returns `activeCombat: null`
- `pnpm typecheck` passes with 0 errors
- `pnpm lint` passes with 0 warnings
- `pnpm test` passes (all existing 819 tests green — no behavior change)

### u-8b — combat engine core (LARGE)
**Scope**: `src/core/combatEngine.ts` (new), `src/core/combatEngine.test.ts` (new).
**Deps**: u-8a.
**Description**: Implement `buildCombatDeck(state, entryContext): Card[]` (B2 rules); `applyBattlefieldDamage(battlefield, amount): BattlefieldCard[]` (B3 front-to-back absorption); `combatTurnReducer(state, action): CombatState` handling players-turn card plays, boss-turn damage routing per attack pattern, WIN/LOSS detection, turnIndex increment, desperation threshold switch. No UI integration. No main-board reducer wiring.
**Acceptance**:
- `src/core/combatEngine.ts` exports `buildCombatDeck`, `applyBattlefieldDamage`, `combatTurnReducer`
- `buildCombatDeck` eligibility rules match B2: starter cards, championSlot hero, inPlay heroes, item-active items included; fairies, main-board deck/discard/chest, gems, re-roll tokens excluded
- `buildCombatDeck` uses `mulberry32(state.seed + entryContext.combatEntryTurn)` for deterministic shuffle
- `buildCombatDeck` draws 5 cards initial, hand cap 5 (excess goes to combatDiscard)
- `applyBattlefieldDamage` absorbs front-to-back, drops cards at hp <= 0, returns residual damage if battlefield empties
- `combatTurnReducer` applies `'player-hp'` targeting: split evenly across non-downed players, rounding to active-attacker
- `combatTurnReducer` applies `'battlefield-then-player'` targeting: absorb via battlefield, spill to players
- `combatTurnReducer` applies `'aoe'` targeting: damage every battlefield card AND every non-downed player
- Desperation triggers when `boss.hp < DESPERATION_HP_PCT * boss.hpMax` — switches targeting to `'aoe'`
- `combatTurnReducer` detects WIN when `boss.hp <= 0`, LOSS when all non-downed players become downed
- Unit tests cover each rule above (at least 20 new tests)
- `pnpm test` passes (819 + 20+ new tests green)
- `pnpm typecheck` passes
- `pnpm lint` passes

### u-8c — entry/exit wiring (MEDIUM)
**Scope**: `src/core/combat.ts` (main-board file — existing), `src/store/gameStore.ts`, `src/core/combat.test.ts`.
**Deps**: u-8a, u-8b.
**Description**: Branch `fightMonster` and `defeatAlwaysAvailableMonster` on engaged beast `tier`. If `'wild-boss' | 'region-boss'`, dispatch `COMBAT_ENTER` (builds `CombatState` via `buildCombatDeck`) and clear main-phase actions. If regular tier, keep existing instant-resolution path. Implement `COMBAT_RESOLVE_WIN` reducer: apply hearts drop (route to attackers up to hpMax), wisp drop (wild-boss), shard grant (region-boss), zone advance (region-boss), set `activeCombat = null`. Implement `COMBAT_RESOLVE_LOSS` reducer: ensure `checkCoopLoss` has fired, set `activeCombat = null`, preserve downed/revive state. Write q00 regression test: fight Broodmaw with partial HP → assert post-combat HP reflects hearts drop (moves needle, not clamped at hpMax).
**Acceptance**:
- `fightMonster` + `defeatAlwaysAvailableMonster` dispatch `COMBAT_ENTER` when beast `tier` is `'wild-boss'` or `'region-boss'`
- Regular-tier beasts keep existing instant-resolution path (no behavior change)
- `COMBAT_RESOLVE_WIN` reducer applies hearts drop respecting hpMax cap
- `COMBAT_RESOLVE_WIN` drops wisp for wild-boss (`KidPlayer.items` gains wisp card)
- `COMBAT_RESOLVE_WIN` grants shard for region-boss (`sharedTriforce` increments correctly: Power on Vurmox, Courage on Gilded-cage clear)
- `COMBAT_RESOLVE_WIN` advances zone for region-boss (per A5)
- `COMBAT_RESOLVE_WIN` sets `activeCombat = null`
- `COMBAT_RESOLVE_LOSS` ensures `checkCoopLoss` ran; sets `activeCombat = null`
- `checkCoopLoss` is called after every `applyDamage` invocation routed through combat
- **q00 regression test**: fight Broodmaw starting at hp=1, hpMax=5; after combat WIN with `hearts: 2` drop, assert `player.hp >= 1 + hearts_received_from_drop` AND `player.hp < hpMax_before_damage_was_taken` (proves hearts actually healed, not silently clamped)
- `pnpm test` passes (previous count + new tests green)
- `pnpm typecheck` + `pnpm lint` pass

### u-8d — combat effects data sheet (SMALL)
**Scope**: `src/data/combatEffects.ts` (new), `src/data/combatEffects.test.ts` (new).
**Deps**: u-8a.
**Description**: Map each card in `src/data/cards.ts` to a `CombatEffect`. Starter cards and generic heroes default to `combat-attack` with damage = card's `power`. Items get explicit non-attack effects where appropriate (shields → `combat-absorb`, heal items → `combat-heal`). Export `combatEffectFor(card: Card): CombatEffect` lookup function.
**Acceptance**:
- `src/data/combatEffects.ts` exports `combatEffectFor(card: Card): CombatEffect`
- Every card in `src/data/cards.ts` (starters, heroes, items) has a resolvable combat effect
- Cards without explicit override return `combat-attack` with damage = `card.power`
- Explicit overrides for shield-like items return `combat-absorb`
- Explicit overrides for heal-like items return `combat-heal`
- Unit test asserts no card returns `undefined` or throws
- `pnpm test` passes
- `pnpm typecheck` + `pnpm lint` pass

### u-8e — boss attack patterns (SMALL)
**Scope**: `src/data/bossAttackPatterns.ts` (new), `src/data/bossAttackPatterns.test.ts` (new).
**Deps**: u-8a.
**Description**: Define `BossAttackPattern` for each v2.0-implemented boss: Craghorn (Sylvani Wild), Broodmaw (Sylvani Region), Boulderkin (DM Wild), Ashen Tyrant (DM Region), Sentinel (ToT Wild), Silver Chimera (ToT Wild hard), Vurmox (ToT Region). Tune `damagePerTurn` and `targeting` per boss. Vurmox uses same schema as others (no phase transitions in v2.1, per Q8). Export `attackPatternFor(bossCardId: string): BossAttackPattern` lookup.
**Acceptance**:
- `src/data/bossAttackPatterns.ts` exports `attackPatternFor(bossCardId: string): BossAttackPattern`
- Seven patterns exist: craghorn, broodmaw, boulderkin, ashen-tyrant, sentinel, silver-chimera, vurmox
- Each pattern has `damagePerTurn > 0`, valid `targeting`, valid `onDefeatEffect` (null or CombatOnDefeatEffect)
- Vurmox's `onDefeatEffect` grants Power shard AND Courage shard (per A5: coincident in v2.1)
- Silver Chimera's `damagePerTurn` > Sentinel's (hard-gate before Vurmox)
- Unit test asserts `attackPatternFor` returns a valid pattern for all seven bosses
- `pnpm test` passes
- `pnpm typecheck` + `pnpm lint` pass

### u-8f — CombatScreen UI (LARGE)
**Scope**: `src/ui/CombatScreen.tsx` (new), `src/ui/CombatBossPanel.tsx` (new), `src/ui/CombatBattlefield.tsx` (new), `src/ui/CombatHand.tsx` (new), `src/ui/CombatLog.tsx` (new), `src/ui/GameBoard.tsx` (mount gate on `activeCombat`), `src/ui/CombatScreen.test.tsx` (new).
**Deps**: u-8a, u-8b.
**Description**: Implement all 5 combat UI surfaces. `GameBoard.tsx` renders `<CombatScreen />` when `state.activeCombat !== null`; otherwise the existing board. `CombatScreen` composes the four panels + log. Tap-to-play on `CombatHand`. Boss attack telegraph shows 1-line banner before BossTurn resolves. Use stained-glass HC aesthetic (re-use existing tokens from `--hc-*`). Art-first-pass: ship combat background raster OR `<ArtPendingFrame>` fallback.
**Acceptance**:
- `src/ui/CombatScreen.tsx` renders when `state.activeCombat !== null`; returns null otherwise
- `GameBoard.tsx` mounts `<CombatScreen />` gated on `state.activeCombat`
- `CombatBossPanel` renders `boss.hp` / `boss.hpMax` as a visible bar
- `CombatBossPanel` renders attack telegraph banner during `activeActor === 'boss'` phase transition
- `CombatBattlefield` renders each battlefield card with its `hp/hpMax`
- `CombatHand` renders shared combat hand; tap on a card dispatches a play action
- `CombatLog` shows last 3 combat events in plain-language strings
- Component tests assert each surface renders given a mock CombatState
- Component tests assert tap on a hand card dispatches the expected action
- No changes to main board rendering when `activeCombat === null`
- `pnpm test` passes
- `pnpm typecheck` + `pnpm lint` pass

### u-8g — tutorial bubbles (SMALL)
**Scope**: `src/data/tutorialBubbles.ts` (or equivalent), `src/ui/TutorialBubble.tsx`, relevant test file.
**Deps**: u-8f.
**Description**: Add five tutorial bubble ids: `combat-entry`, `combat-card-played`, `combat-boss-turn`, `combat-win`, `combat-loss`. Progressive disclosure per REQ-24: first combat fires `combat-entry` + `combat-card-played` only; subsequent combats introduce `combat-boss-turn` telegraphing. Wire triggers into `CombatScreen` lifecycle.
**Acceptance**:
- Five tutorial bubble ids exist and have kid-legible text per B8
- First combat fires `combat-entry` + `combat-card-played` bubbles
- Second combat introduces `combat-boss-turn`
- `combat-win` fires on successful COMBAT_RESOLVE_WIN
- `combat-loss` fires on COMBAT_RESOLVE_LOSS when `outcome` is not yet 'loss'
- Bubble state persists across combats (first/second distinction tracked)
- Unit tests assert progressive disclosure rules
- `pnpm test` passes
- `pnpm typecheck` + `pnpm lint` pass

### u-8h — balance sim extension (SMALL)
**Scope**: `src/balance/greedySim.ts` (or equivalent existing balance sim), `src/balance/greedySim.test.ts`.
**Deps**: u-8b, u-8c, u-8e.
**Description**: Extend greedy-shard simulation (REQ-7b / u-1a) to route through combat when engaging wild-boss or region-boss. Assert median combat-length per boss falls in a 3–7 boss-turn window across 1000-game runs per strategy (Wisdom-rush, Map-rush, Vurmox-rush, mixed). Too short → combat decorative (damage-dial too low). Too long → kids time out (damage-dial too high).
**Acceptance**:
- Greedy-shard sim routes through combat for wild-boss / region-boss engagements
- Sim runs 1000 games per strategy: Wisdom-rush, Map-rush, Vurmox-rush, mixed
- `pnpm test:balance` command executes the sim
- Assertion: median combat-length per boss ∈ [3, 7] boss-turns in each strategy
- Assertion: no single strategy wins in less than a median 5-boss-turn campaign
- Test output logs per-boss median combat-length for observability
- `pnpm test:balance` passes
- `pnpm typecheck` + `pnpm lint` pass

## DAG summary

```
Layer 0: u-8a (schema)
Layer 1: u-8b (engine), u-8d (effects), u-8e (bosses)   [parallel after u-8a]
Layer 2: u-8c (wiring), u-8f (UI)                       [parallel after u-8b]
Layer 3: u-8g (tutorials)                               [after u-8f]
Layer 4: u-8h (balance sim)                             [after u-8b, u-8c, u-8e]
```

## Global acceptance (B14)

v2.1 REQ-31 is acceptance-complete when:
- [ ] `activeCombat` enters on engaging any `wild-boss` or `region-boss` beast
- [ ] `applyDamage` is called from boss-turn damage routing
- [ ] `checkCoopLoss` fires after every `applyDamage` invocation from combat
- [ ] WIN resolves drops correctly (hearts heal, wisp drop, shard grant, zone advance)
- [ ] LOSS leaves main board consistent (either `outcome: 'loss'` or playable-with-downed-player)
- [ ] q00 regression test passes
- [ ] 819-baseline + ~40 new tests all green
- [ ] `pnpm typecheck` + `pnpm lint` green

## Non-goals (B13)

- Not an MTG clone — no mana, no stack, no priority windows
- Not PvP — co-op only
- Not an opt-in minigame — combat is a scripted consequence of engaging a boss
- No new economy — WIN drops exactly match existing instant-resolution path
