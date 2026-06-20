# PRD: Embertide v2

> **Status**: risk-annotated, ready for `/prd-build` on v2.0 scope.
> **Source bead**: `embertide-gm0` (canonical mirror of this file).
> **Produced**: 2026-04-20 via `/research-project` (`/diverge` 4 lenses → `/converge` 4 advocates + arbiter → `/premortem` 5 failure narratives). All premortem lenses rated Critical/High severity and likelihood; mitigations applied inline.
> **Scope instruction for `/prd-build`**: decompose **v2.0 REQs only** into active work units. v2.1 / v2.2 REQs should be filed as `status=deferred`.

## Candidate PRD beads (source material)
- embertide-0pb — Systems Designer (A)
- embertide-jkf — Content Designer (B)
- embertide-h85 — Encounter Designer (C)
- embertide-fcw — UX + Kid-Friendliness + Randomness (D)

## MVP PHASING (added post-premortem — L5 mitigation)

The 29 REQs below are NOT all v2.0. They split into three releases. `/prd-build` should scope ONLY the v2.0 beads as active work; v2.1 and v2.2 beads get filed as `status=deferred` until v2.0 ships and playtests clean.

### v2.0 — Minimum viable pivot (target: 4-5 week ship)
Core win-condition pivot + one safety valve + one Wild Boss + the load-bearing schema refactor. No dice site classes beyond chest. No champion-unlock items.

**v2.0 REQs**: 1, 2, 3, 4 (item-active only; item-passive deferred), 5a (frame only), 7, 8, 11, 12, 13, 16 (soft-clock — single safety valve), 18, 19 (phase structure, no Stirring blocks yet), 20a (Hill Brute only), 24 (abbreviated tutorial), 30 (art throughput budget — new).

### v2.1 — Content breadth (after v2.0 plays clean, ~2-3 weeks)
Adds dice substrate + more Wild Bosses + full item catalog.

**v2.1 REQs**: 5b (raster interior), 6, 9 (full substrate + roll sites), 10 (type invariant on roll-die), 14 (re-roll tokens, with v2.0-lesson-learned tuning), 20b (Gel Blob + Centaur Brigand), 21 (chest-attached monsters), 22 (revised — Seer's Omen as re-roll grant, NOT die-pool unlock — see REQ-22 edit), 23.

### v2.2 — Polish + safety-rail stack (only if v2.1 playtest reveals rage-quits)
Adds pity, second safety valve, bonus-chest effects.

**v2.2 REQs**: 5c (reveal animation), 15 (pity — may be retired if v2.1's fail-forward floor + re-roll tokens prove sufficient), 17 (boss-chest shard-bonus — EDITED per REQ-17 mitigation), 25 (TTS), 26, 27, 28, 29 (pity glow — same gating as 15).

**Principle**: no v2.1 REQ begins until v2.0 is shipping clean to the kid. No v2.2 REQ begins until v2.1 similarly clean.

## Problem Statement

Embertide v1 is a working 2-player deckbuilder with a Elysian Cathedral visual theme (508 tests passing, prd-build/elysian-cathedral branch). A 2026-04-20 playtest with the designer's 6yo surfaced structural feedback requiring a v2 pivot: the win counter (5 hearts) and the core combat reward (heart drops) are conflated, which creates a 'farm-the-permanent-beast' exploit. The 'Play Two Heroes' hero ability is a no-op. Champions draw from the deck which breaks their identity fantasy. The treasure-chest mechanic and key-gated champions are loved and must survive. The kid requested wild bosses, items instead of relics, a princess-in-crystal mechanic, die-roll boss encounters, richer hero/beast capabilities, a embertide-piece win condition, and a Demon King final boss.

## Goals

- Fix the farm exploit structurally (not via re-tuning drop values): split HP-heals from win-progress.
- Introduce a vertical progression (encounter ladder) with Embertide pieces as the win state.
- Give each hero AND each beast a distinct, readable special capability.
- Add age-appropriate randomness (die rolls) that preserves agency and prevents rage-quits.
- Preserve the Elysian Cathedral visual substrate; v2 must be additive not rewrite.
- Keep session length at 30-45 min for a 6yo.
- Keep 508-test v1 suite as an asset. **PREMORTEM NOTE (L2)**: "via mode-flag coexistence" was the original plan; L2 identifies this as the #1 root-cause stall. Mitigation options: (a) retain coexistence with strict limits; (b) branch-and-tag v1-final, ship v2 clean on main. **RECOMMENDED**: go with (b) — see REQ-11 edit.

## Non-Goals

- Re-scope of the HC visual substrate (shipped).
- Rename Verdant → Gem (embertide-wtr; standalone).
- Champion-popup theming (embertide-jrw; standalone).
- Networked multiplayer.
- Solo/single-player campaign mode (stays 2-player hotseat).

## Requirements

### Must-Have (v2.0)

- **REQ-1: Win condition pivot — Embertide pieces (3), not hearts (5).**
  - Acceptance: `STANDARD_VICTORY_HEARTS` removed; new `EMBERTIDE_PIECES_TO_WIN = 3`. Tests `victory.test.ts` assert a player wins at 3 pieces, not at 5 hearts. Endgame ticker `tickEndgame`/`beginEndgame` replaced by an instant Embertide-completion check.

- **REQ-2: Hearts-as-HP, shards-as-win-progress.**
  - Acceptance: `KidPlayer.hearts` renamed/split into `hp` (current) + `hpMax` (cap). `KidPlayer.triforceShards` new field (int 0-3). Every beast defeat produces an HP-heal event; only Wild Bosses, Princess, and Demon King produce a shard. Monster heart-drop values are deterministic (floor 1, no variance). Tests: defeating three 2-power beasts produces 3 HP and 0 shards.
  - **PREMORTEM EDIT (L1)**: add explicit game-over-at-0-HP behavior. When `hp === 0`, player cannot take main-phase actions except (a) use re-roll tokens if held, (b) spend gems on market for HP-heal items if available. If both players reach 0 HP simultaneously, the player with more shards wins (tiebreaker: more HP spent = more engagement).

- **REQ-3: Champion as dedicated passive slot (not deck card).**
  - Acceptance: Champion chosen at Setup occupies a new `KidPlayer.championSlot` tray UI element. Champion card is NOT in any deck. Champion passive fires via existing passive trigger harness. v1 4-buy 'extra champion trade' retired; replaced by a generic `+key` action.
  - **PREMORTEM EDIT (L3)**: championSlot tile pulses with a champion-tinted glow + particle on every passive fire event. Tutorial line on first fire: "Your champion helped!" Ensures always-on passive is legible to a 6yo.

- **REQ-4: Items extend the existing Constructs zone (rename + reshape, not new system).**
  - **v2.0 Acceptance**: `KidPlayer.constructs` → `KidPlayer.items`. Cap reduced 6→3. Item cards carry a `kind: 'item-active' | 'item-passive'` discriminant. Active items carry `cooldownTurns` + `lastUsedTurn`. Start-of-turn hook reduces cooldown readout. Existing `constructs-row` tests migrate to `items-row`; v1 cap-of-6 tests adjust to cap-of-3.
  - **PREMORTEM EDIT (L5)**: v2.0 ships item-active ONLY. `item-passive` deferred to v2.1 to narrow EffectSpec cascade surface.

- **REQ-5a: Chest pool collapse — frame-only for v2.0.** (**PREMORTEM EDIT L4: split from original REQ-5**.)
  - v2.0 Acceptance: `chest-small` / `chest-medium` / `chest-big` roles → `chest-std` + `chest-boss`. Boss-chest FRAME is a new vector variant (ornate gold rim, gem inlay vector path) in `src/illustration/ornament.ts`. Interior raster cell falls back to `chest-std` raster until REQ-5b ships. Weights published as a data table. Tests `chestPool.test.ts` assert probability distribution.
  - **REQ-5b (v2.1)**: Nano Banana Pro raster interior for boss-chest (new surface). **REQ-5c (v2.2)**: ornate reveal animation.

- **REQ-6: Forest-sage ability replacement — d6 omen roll. [DEFERRED to v2.1.]**
  - Deferred because REQ-9 dice substrate is also v2.1. For v2.0, forest-sage retains its v1 effect (or gets a simple deterministic swap if trivial — TBD).

- **REQ-7: Beast reward parity fix (structural — via REQ-2).**
  - Acceptance: Verified that no reward is claimable by farming a 2-power permanent beast that is not equally or more claimable from higher-tier encounters. Integration test demonstrates that a hypothetical 'infinite-permanent-farm' player cannot achieve 3 shards without engaging higher-tier encounters.
  - **PREMORTEM EDIT (L1)**: REQ-7b (tightening). Add: "Integration test suite includes a greedy-shard simulation — a scripted agent attempts all known farm vectors (permanent-beast repeat-kill, Wild Boss chest-farm, reroll-token forcing, Seer's Omen exploitation). Assertion: no single strategy achieves 3 shards in more than 5% of 1000 simulated games." Runs as `pnpm test:balance`. Any single-strategy win rate > 5% blocks v2.0 ship.

- **REQ-8: Princess-in-Crystal as kill-counter zone.**
  - Acceptance: Crystal has `charges: 5` initial; any player's monster kill (from any slot, any tier) decrements via `fightMonster` / `defeatAlwaysAvailableMonster`. When charges reach 0, the next Strike action on the Crystal frees her — that Strike's owner gets the Wisdom Embertide piece; BOTH players receive a shared `wisdoms-light` passive. Tests: crystal charges decrement on all kill paths; both players get the passive; only one player gets the piece.

- **REQ-9: Randomness substrate + bounded scope. [DEFERRED MOSTLY to v2.1.]**

  **v2.0 scope (minimal)**: Chest loot uses existing `mulberry32` + `chestPool.ts`. No new `dice.ts` module, no roll-die EffectSpec, no player-visible rolls.

  **v2.1 scope**: full REQ-9a/9b/9c/9d as previously drafted, WITH these post-converge edits:

  **REQ-9e (EDITED per L3 mitigation — polarity inverted)**: **Die-pool IS the baseline for all player-visible rolls.** `pickOneOfThreeD6` is the default affordance — three fanned d6 cards appear, player taps one to commit. Used for: forest-sage omen (REQ-6), Dungeon Boss onDefeat, Demon King to-hit, item procs. Single-d6 (`d6`) is reserved for chest-loot weight rolls (invisible to player) and was the polarity baseline for v2.1 draft prior to premortem. RATIONALE: L3 showed the 5% unlock gate effectively kept die-pool invisible across all kid-length sessions; inverting polarity guarantees the most legible randomness primitive is always present.

  **REQ-9f**: Per-encounter cap of 1 roll (pacing discipline unchanged).

- **REQ-10: Fail-forward floor on all rolled effects. [v2.1 — requires REQ-9b to exist.]**
  - Acceptance: The `RollDieEffect['outcomes']` type invariant enforces that every declared face has a non-zero effect. Schema test asserts no outcome row equals `{}`. Unit test per rolled effect asserts min outcome > 0.

- **REQ-11: Migration strategy. [REVISED per L2 mitigation — branch-and-tag replaces coexistence.]**
  - **Acceptance (REVISED)**: v1 is tagged `v1-final` on branch `prd-build/elysian-cathedral`. v2 develops on a NEW branch `prd-build/embertide-v2` (forked from `v1-final`) with a clean `KidPlayer`/`KidGameState` shape — NO mode flag, NO coexistence proxies. v1 tests are not maintained going forward; the `v1-final` tag preserves the reference implementation for rollback or comparison. v2 authors a fresh test suite on the v2 state shape.
  - **DISSENT RECORDED**: Original plan (coexistence via `mode` flag) is preserved in this PRD's history. Branch-and-tag has a one-time cost (fork + initial v2 test scaffolding) but removes the 1.9x sustaining tax L2 identified. Designer approval required to commit to this strategy before /prd-build.

- **REQ-12: HPStrip + TriforceStrip components on PlayerTray.**
  - Acceptance: New `HPStrip.tsx` renders current/max HP in stained-glass heart-shard sockets. New `TriforceStrip.tsx` renders 3 triangles (filled on piece-acquire). Both visible at all times on tray, no hover-to-reveal. Embertide progress also mirrored top-center HUD above market row. Visual regression snapshot matches HC aesthetic.
  - **PREMORTEM EDIT (L3)**: Re-roll tokens (REQ-14) are INTEGRATED into HPStrip (parchment chip row below heart sockets), NOT a separate RerollTokenStrip. Reduces persistent tray zone count from 5 → 4. Tap-target audit required on target tablet (1024x768 min).

- **REQ-13: EffectSpec typed union (load-bearing schema refactor). [PHASED per L2 mitigation.]**
  - **Phase 1 (v2.0)**: Introduce `EffectSpec` discriminated union with ONLY existing v1 effect kinds as members. Migrate all `src/data/cards.ts` entries and `src/ui/effectText.tsx` consumers behind the union. Ships as ONE PR, reviewable in one pass.
  - **Phase 2 (v2.1)**: Add new members one at a time, each as an independently shippable PR gated on Phase 1 green CI. New members: `roll-die`, `item-active`, `item-passive` (future), `heal`, `shard-grant`. No new member lands concurrently with Phase 1.

- **REQ-14: Re-roll tokens. [REVISED per L3 mitigation.] [v2.1.]**
  - **Acceptance (REVISED)**: Each player starts with 1 `rerollToken` at game start. Additional tokens earned on: +1 at first Wild Boss defeat, +1 at Dungeon Boss pin, +1 at Princess-crystal break. Max 3 held. Rendered as parchment chips integrated into HPStrip (REQ-12 edit). Unused tokens convert to 1 gem at game end.
  - **PREMORTEM EDIT (L1)**: Re-roll tokens MAY NOT be spent on a roll whose outcome set includes a `embertide-shard` result (specifically Dungeon Boss onDefeat per REQ-9c). Tokens are HP/draw safety, not shard-acquisition amplifiers. Unit test asserts rejection.
  - **PREMORTEM EDIT (L3)**: Original plan delivered all 3 tokens at Dungeon Boss pin (turn 6-8), leaving turns 1-5 with only fail-forward-floor protection. Revised plan delivers 1 token at game start so rage-quit windows in early turns are covered.

### Must-Have (v2.0 — core structure)

- **REQ-15: Pity system. [DEFERRED to v2.2. May be retired entirely.]**
  - Deferred per L5 (scope) + L3 (3-step causation concern). Ship v2.1 with fail-forward floor + re-roll tokens; if playtest shows residual rage-quits, add pity in v2.2. If not, retire. Acceptance unchanged from pre-premortem if it ships.

- **REQ-16: Soft-clock safety valve for Embertide progression.**
  - **Acceptance (REVISED per L1 mitigation)**: If at start of turn 10, the TRAILING player (min-shards across both players; tiebreak by min-HP) has fewer than 2 Embertide pieces, each un-claimed boss ticks +1 HP easier per subsequent turn (cumulative). Easing is symmetric (both players see same easier boss) but the TRIGGER evaluates ONLY the trailing player's state. Test: leading 2 shards + trailing 0 shards → fires. Leading 2 + trailing 2 → does NOT fire. Leading 1 + trailing 0 → fires (trailing < 2).
  - **PREMORTEM NOTE (L1)**: original quantifier "if a player has fewer than 2" was ambiguous and would have fired asymmetrically on the leader's state, accelerating the winner's victory. Revised quantifier pins to trailing-player.

- **REQ-17: Embertide-shard bonus weight on boss-chests. [DEFERRED to v2.2 per L5 mitigation + L1 scope fix.]**
  - **Acceptance (REVISED per L1 mitigation, IF it ships in v2.2)**: The shard-bonus weight attaches to the Dungeon Boss key-pin TRIGGER, not to the `chest-boss` POOL. When a player opens a chest via the Dungeon Boss key-pin event specifically, that open has a 10% chance of yielding a shard. NO other chest draw — monster-attached chests (REQ-21), Seer's Omen rare drops, normal boss-chest market buys — inherits this weight. Acceptance tests: (1) Dungeon-Boss-pin chest: 10% shard rate; (2) Wild-Boss-attached chest opening from `chest-boss` pool: 0% shard rate; (3) market-bought boss-chest: 0% shard rate.
  - **L1 root cause addressed**: the original pool-scoped weight leaked into Wild-Boss-attached chest opens and, combined with REQ-14 reroll scope, enabled a 3-shard win by turn 10 via chest-farm. Trigger-scoping plus REQ-14 denylist plus REQ-7b greedy-shard test eliminates the vector.
  - **DISSENT (from REQ-5 premortem)**: Advocate-C originally opposed ANY stochastic fallback; arbiter retained it. Premortem L5 recommends DEFERRING to v2.2 (soft-clock REQ-16 alone may suffice). Final decision deferred to designer before v2.2 build.

### Should-Have (deferred to v2.1 / v2.2 per phasing above)

- **REQ-18: 5-phase explicit turn structure. [v2.0 core — retained as must-have because phase hooks are load-bearing for everything else.]**
  - Acceptance: `endTurn()` replaced with `advancePhase()`; phases enum: `Upkeep | Draw | Main | BossResolve | End`. Existing tests re-expressed in phase terms. This enables REQ-19's session arc without requiring it.

- **REQ-19: 4-phase session arc (Stirring → Rising → Boss → Climax). [Partial v2.0, full v2.1.]**
  - **v2.0 acceptance**: Boss phase (turn 6+) gates the Dungeon Boss appearance. Climax phase (turn 9+) forces Demon King pin. Stirring/Rising distinction deferred (v2.0 allows Wild Boss spawns from turn 1).
  - **v2.1 acceptance**: Full 4-phase arc. Stirring (turns 1-2) blocks wild-boss spawns; Rising enables them. Re-roll token grants wire to phase events per REQ-14 revised.

- **REQ-20a (v2.0 — PREMORTEM EDIT L4): Wild Boss — Hill Brute only.**
  - Acceptance: Hill Brute (humanoid upright silhouette, Craghorn-inspired). 4 copies in supply. Unique on-encounter + on-defeat effects. Hill Brute chosen because `heroWarriorUpright`-family segmentation in `src/illustration/` already supports upright humanoid silhouettes — no new vector substrate required.
- **REQ-20b (v2.1): Gel Blob + Centaur Brigand.**
  - Acceptance: Requires new silhouette path family in `src/illustration/silhouettePaths/` (Gel Blob needs radial symmetry; vertical-cathedral segmentation will fail, so a new segmentation path family must ship first). Art-throughput budget per REQ-30 required before merge.

- **REQ-21: Chest-attached-to-monster (non-key loot path). [v2.1.]**
  - Acceptance: ~40% of spawned center-row monsters carry a chest flag (stamped at supply build time, NOT rolled at reveal). Defeating opens the chest at no key cost; loot table is explicitly `chest-std` (NOT `chest-boss`, per L1 mitigation — tightens the underspecified "tighter than key-chest" PRD line).

- **REQ-22: Seer's Omen item. [REVISED per L3 mitigation + polarity flip.] [v2.1.]**
  - **Acceptance (REVISED)**: Seer's Omen is a rare boss-chest drop (5% weight). When held and played, it grants +2 re-roll tokens (pushing to max 3). Item discards after use. **This is NOT a die-pool unlock** — die-pool is now baseline per REQ-9e edit, so unlocking it is no longer meaningful. Visual: parchment scroll icon with eye motif.
  - **Effect of the flip**: the `pickOneOfThreeD6` primitive is always visible (REQ-9e baseline), and Seer's Omen becomes a safety-rail amplifier instead of a rare substrate gate.

- **REQ-23: Soft-clock on Demon King. [FOLDED into REQ-16.]**
  - The Demon King soft-clock is the same mechanism as REQ-16 applied to the Demon King boss; acceptance absorbed into REQ-16.

- **REQ-24: Tutorial rewrite. [v2.0 abbreviated, v2.1 full.]**
  - **v2.0**: Tutorial covers HP damage, shard acquisition, Crystal weakening, Wild Boss encounter, item cooldown tick. No dice-related prompts (deferred with REQ-9).
  - **v2.1**: Add dice-mechanic intro, re-roll token grant, Seer's Omen, soft-clock telegraph.
  - **PREMORTEM EDIT (L3)**: Tutorial delivered progressively across first 3 games (not all 6 concepts in first game). Per-bubble dwell-time instrumented; median < 3s triggers re-design.

### Nice-to-Have (v2.2)

- **REQ-25**: TTS narrator.
- **REQ-26**: Embertide-shard overflow-to-power conversion.
- **REQ-27**: 2-player parallel Embertide progress top-HUD.
- **REQ-28**: Unused-reroll-token → gem conversion (v2.1 already — integrated into REQ-14 revised).
- **REQ-29**: Pity-incoming glow telegraph. [Gated on REQ-15 shipping at all.]

### v2.0 Must-Have — NEW (PREMORTEM-ORIGIN)

- **REQ-30 (NEW — L4 mitigation): Art throughput budget and pipeline governance.**
  - Acceptance: Every v2 REQ that introduces a new illustration surface MUST declare: (a) required vector artifacts (silhouette/segmentation/ornament path files under `src/illustration/`), (b) required raster artifacts (Nano Banana Pro prompts committed to a prompts directory, conditioned on `mockup_cards.png`), (c) required icon glyphs (extensions to `src/ui/CostGem.tsx`), (d) required `--hc-*` token additions. A surface MAY NOT be merged without all four declared. Unstamped surfaces ship as a pinned-placeholder frame with a visible `[v2-art-pending]` ribbon — partial visual chaos becomes EXPLICIT, not silent.
  - A weekly art-throughput audit: count finalized HC-grade raster cells per week. If < 3 per week for 2 consecutive weeks, freeze new art-demanding REQs until backlog clears.

## Design Decisions — post-converge (unchanged)

### D1 — Randomness UI: RESOLVED (polarity-flipped per L3 premortem)
Baseline: `pickOneOfThreeD6` for all kid-visible rolls. Single-d6 reserved for invisible chest weights. Fail-forward floor as type invariant. Re-roll tokens granted 1 at game start, more earned at Wild Boss / Dungeon Boss / Princess beats. Pity deferred to v2.2 or retired.

### D2 — Embertide paths: RESOLVED (valve count reduced per L5 premortem)
Three fixed single-owner paths. ONE safety valve in v2.0: soft-clock REQ-16 (trailing-player-anchored per L1). Boss-chest shard-bonus REQ-17 deferred to v2.2 with trigger-scoped acceptance IF it ships at all.

### D3 — Randomness scope: RESOLVED (narrowed per L5 premortem)
v2.0: chest loot only (existing substrate). v2.1: all 5 site classes. Per-encounter cap of 1 roll preserved.

## Premortem Findings (2026-04-20) — Risks & Mitigations

### Risk Registry

| # | Lens | Severity | Likelihood | Risk Score | Root Cause | Top Mitigation |
|---|------|----------|------------|------------|------------|----------------|
| 1 | Scope discipline (L5) | Critical | High | 12 | Converge synthesis bias → 29 REQs, no MVP cut | **APPLIED**: MVP v2.0/v2.1/v2.2 phasing section added. REQs 5, 6, 9, 14, 15, 17, 20 phased. |
| 2 | Complexity creep (L2) | Critical | High | 12 | REQ-11 mode-flag tax + REQ-13 concurrent union + new members | **APPLIED**: REQ-11 revised to branch-and-tag. REQ-13 phased. REQ-30 adds governance. |
| 3 | 6yo UX (L3) | Critical | High | 12 | REQ-22 die-pool behind 5% gate; tray clutter; frequency vs inclusion | **APPLIED**: REQ-9e polarity inverted (die-pool baseline). REQ-22 revised (Seer's Omen → re-roll grant). REQ-12 collapses re-roll into HPStrip. REQ-14 delivers 1 token at game start. REQ-3 adds visible passive fire event. |
| 4 | Balance blowup (L1) | Critical | High | 12 | REQ-17 weight pool-scoped; REQ-14 reroll scope; REQ-16 quantifier ambiguity | **APPLIED**: REQ-17 trigger-scoped. REQ-14 denylist on shard rolls. REQ-16 pinned to trailing-player. REQ-7b greedy-shard simulation. |
| 5 | Theme coherence (L4) | Critical | High | 12 | REQ-20 three named Wild Bosses + ~18 net-new raster cells vs throughput | **APPLIED**: REQ-20 split 20a/20b (Hill Brute only in v2.0). REQ-5 split 5a/5b/5c. REQ-30 new art throughput budget. |

### Cross-cutting themes surfaced by multiple lenses

- **Converge produces merges, not cuts** (L5 root, L2/L3 amplifier) → MVP phasing is the core mitigation.
- **Mode-flag coexistence was a footgun** (L2 root, L4 + L1 amplifier) → branch-and-tag.
- **"Winning inclusion is not winning frequency"** (L3 root, L4 amplifier on art) → REQ-9e polarity flip + REQ-20a single-boss MVP.
- **Five safety nets for the Embertide race** (REQ-10/14/15/16/17 stack) surfaced by L5 (redundant), L1 (compose into exploit), L3 (clutter) → cut to 1 in v2.0 (fail-forward floor + soft-clock), add re-roll tokens in v2.1, add pity only if v2.1 playtest shows rage-quits.

### Early-Warning Signals (to watch 4 weeks into v2.0 build)

- PR touching any reducer exceeds 400 lines or spawns 2+ follow-up beads → branch-and-tag strategy is the right call.
- EffectSpec Phase 1 PR open > 10 days or rebased 3+ times → Phase 2 kinds are leaking in; freeze until Phase 1 clean.
- `docs/e2e/wave-1-review/` screenshots show >1 non-HC art style → art pipeline is behind; hold REQ-5/20 until REQ-30 audit clears.
- `chest-boss` pool referenced from >1 trigger site (grep) → REQ-17 trigger-scoping has slipped.
- Open bead count rising WoW at week 4 → scope creep; re-premortem and re-cut.
- Kid tutorial dwell time < 3s/bubble → REQ-24 progressive disclosure must replace front-loading.

### Open Questions Remaining

- Should REQ-11 branch-and-tag commit to full v1 freeze (no more v1 patches), or keep v1 patchable during v2 build? Recommend full freeze.
- Does v2.0 need a playable game-over state even without REQ-14 re-roll tokens? Yes — REQ-2 edit adds 0-HP behavior.
- Pity system REQ-15: ship in v2.2 or retire? Tie to v2.1 playtest signal.
- Art pipeline: single-designer throughput or bring in contractor? REQ-30 governance applies either way.

## Research Provenance

- **Diverge** (2026-04-20): 4 agents (Systems / Content / Encounter / UX) → 4 candidate PRDs in beads 0pb/jkf/h85/fcw.
- **Converge** (2026-04-20): 4 advocates steel-manned + arbiter synthesized D1/D2/D3 resolutions with dissent recorded.
- **Premortem** (2026-04-20): 5 failure-narrative agents (Balance / Complexity / 6yo UX / Theme / Scope). All 5 rated Critical/High. Risk-annotated mitigations applied above.
- Full candidate PRDs preserved in source beads.

---

## AMENDMENT — CO-OP + MAP PIVOT (2026-04-20, mid-build)

> **Status**: authoritative override of any prior-section language that conflicts.
> **Trigger**: designer clarified mid-build that v2 is COOPERATIVE, not competitive, and that the Courage Embertide path is gated on a new MAP-EXPLORATION system.
> **Scope effect**: u-0 already landed; u-1a, u-2e, u-3a, u-3b, u-4 from the original DAG need rework. Three new units added. DAG regenerates from 12 → 15 units.

### A1 — Mode: 2-player cooperative (not competitive)

Both players work together. Victory and loss are SHARED. No "whose shards are whose", no tiebreakers, no "I win, you lose". The old non-goal "Networked multiplayer" stands; hotseat-only.

This **supersedes**:
- REQ-2 PREMORTEM EDIT (L1) line "If both players reach 0 HP simultaneously, the player with more shards wins (tiebreaker…)" — deleted; both-at-0 with no revive available is a shared loss.
- REQ-16 language referring to "leading/trailing player" and "min-shards across both players" — reinterpreted: soft-clock fires when SHARED shard count is low at turn 10 (see A4 below).
- REQ-8 "that Strike's owner gets the Wisdom Embertide piece" — reframed: the Wisdom shard drops into the SHARED pool regardless of which player strikes.

### A2 — Win condition: shared 3-shard pool, one shard per path

The 3-shard win is now a SHARED pool. Each shard comes from exactly one distinct path:

| Shard | Path |
|---|---|
| **Wisdom** | Free Princess Aurelia from her crystal (REQ-8 mechanic, unchanged) |
| **Courage** | Complete map exploration — all currently-implemented zones cleared (NEW — see A5) |
| **Power** | Defeat Cagewright Vurmox (final boss, REQ-19 climax phase) |

**Important**: Wild Bosses, ordinary beasts, chests, and the market do NOT grant shards. Shards are strictly the three path-completion rewards above. This resolves the farm-exploit concern of REQ-7 structurally without needing the greedy-shard simulation to enumerate farm vectors — there are only three shard sources, all gated on specific events.

**REQ-7b greedy-shard simulation remains**, but its scope simplifies: the test asserts that no single strategy achieves 3 shards in a winnable turn-count distribution (per premortem), where "strategy" now enumerates (rushing Wisdom only, rushing map only, rushing Demon King only, mixed). Still v2.0 ship-gate.

### A3 — Death / downed / revive / fairies

Per-player HP is retained. At 0 HP a player enters **DOWNED** state (not game-over). Downed players:

- Cannot take main-phase actions.
- Cannot spend gems on the market.
- DO continue to count toward turn order (their turn becomes a single "wait for revive or pass" prompt).
- Are visually marked on the HPStrip with a distinct `downed` token.

Revive paths (in v2.0):

1. **Teammate revive action** — the non-downed player can spend a main-phase action to revive the downed teammate to 1 HP. One teammate-revive per game per downed-incident (prevents ping-pong), tracked as a per-player `revivedThisIncident: boolean` that resets on next downed event.
2. **Wisp item** — a new item card (acquired in chest loot or specific map encounters). When played on a downed teammate, restores them to `hpMax` (full revive). Consumed on use.

**Game-over** in co-op: both players downed at the start of a turn with no unplayed wisp in either player's items and no teammate-revive available (already used this incident by the other downed player). This is the only loss state.

### A4 — Soft-clock (REQ-16) reinterpreted for co-op

If at start of turn 10 the SHARED shard count is below 2 (0 or 1), each un-claimed boss ticks +1 HP easier per subsequent turn (cumulative). The trigger is shared-shard-based; there's no "leading/trailing" because co-op.

### A5 — NEW: Map exploration system + per-zone enemy rosters (Courage path spine)

The center row is now a **zone region**. The game tracks a `currentZone` index into a zone sequence. Full v2-design plan spans 6 zones; **v2.0 ships the first 3** and refines the design before expanding (Sylvani → Emberpeak → Gilded Cage). v2.1 inserts intermediate zones (Tidehold, Dark World / Hollow Shrine, Duneborn / Dune Sanctum) between Emberpeak and Gilded Cage without changing the win condition.

**Enemy tier taxonomy (NEW):**
- **Regular enemy** — ordinary beasts; defeat produces +1 HP heal (per REQ-2), no shard, no zone advance. Multiple copies per supply.
- **Wild Boss** — in-zone mini-boss; tougher (shared-HP pool attacked by both players); defeat produces a wisp drop (per A6) and a narrative beat, but does NOT advance the zone. Multiple Wild Bosses may exist per zone (see Gilded Cage).
- **Region Boss** — the zone-clear gatekeeper; one per zone; defeat triggers zone advance (per the map-advance mechanic below).

v2.0 per-zone rosters (authoritative):

| Zone | Regular enemies | Wild Boss(es) | Region Boss |
|---|---|---|---|
| **Sylvanwood** | Thorn Scrub, Snapvine, Jellet, Scrabling | Craghorn | Broodmaw |
| **Emberpeak** | Saurian, Ashjaw, Skittermite, Red Squidlet | Boulderkin | Ashen Tyrant |
| **Gilded Cage** | Wardeye, Bubble, Bone Knight, Gulpmaw, Hexrobe | Sentinel, Silver Chimera (hard) | Cagewright Vurmox |

**Map-advance mechanic**: zone transitions are explicit. On **Region-Boss** defeat, a banner fires ("Sylvanwood cleared — Emberpeak awaits"). Cleared zones are not revisited in v2.0 (linear progression — v2.1 may add optional return visits).

**Courage unlock**: when `currentZone` advances past the final v2.0-implemented zone (Gilded Cage reached AND its region-boss — Vurmox — defeated), the Courage shard drops into the shared pool. In v2.0 this coincides with the Power shard grant on Vurmox defeat (both shards land in the same defeat event — scope-correct because in v2.0 Gilded Cage IS the final fight). v2.1 may split them if intermediate zones and a separate Vurmox encounter land.

**Wild Boss → Region Boss pacing**: within a zone, Wild Bosses act as **region mini-bosses** — the Region Boss does not spawn until ALL of the zone's Wild Bosses have been defeated. Wild Bosses themselves spawn per session-arc rules (REQ-19 partial v2.0: Boss phase turn 6+). This means Gilded Cage's Vurmox (region) requires BOTH Sentinel AND Silver Chimera (wild) defeated first — Silver Chimera is the hard-gate before Vurmox.

### A6 — NEW: Wisp items

Fairies are a new **item card kind** (not a new EffectSpec member at the schema level — they slot into the existing `item-active` union). Acquisition in v2.0:

- Chest-std loot table: 5% weight (seeded)
- Chest-boss loot table: 15% weight
- Zone transition reward: guaranteed 1 wisp on clearing Sylvanwood (tutorial assist)

Effect: on play, if the target is a downed teammate, restore to `hpMax`. If played outside those conditions, the card is a no-op but NOT consumed (soft UX — prevents accidental burn).

### A7 — v2.0 ship-gate re-cut

**Landed**: u-0-art-governance.

**v2.0 in scope (17 units total — grew from 15 when u-3a Hill-Brute split into three per-zone content units u-6a/b/c)**: u-0, u-1a (rewritten), u-1b, u-1c, u-1d (new — downed/revive/wisp state), u-2a (tweak for shared-pool + downed), u-2b, u-2c, u-2d (adds wisp item card), u-2e (reframed for shared pool), u-5a (new — map-zone spine), u-5b (new — Courage unlock gate), **u-6a-sylvani-content** (new — Thorn Scrub/Baba/Jellet/Scrabling + Craghorn + Broodmaw), **u-6b-emberpeak-content** (new — Saurian/Ashjaw/Skittermite/Red-Squidlet + Boulderkin + Ashen Tyrant), **u-6c-gilded-cage-content** (new — Wardeye/Bubble/Bonereaver-Knight/Gulpmaw/Hexrobe + Sentinel + Silver Chimera + Vurmox), u-7 (rewritten — co-op softclock + REQ-19 climax phase; the Power-shard grant moved into u-6c on Vurmox defeat), u-4 (rewritten — co-op + map tutorial).

**Deferred to v2.1**:
- Intermediate zones (Tidehold, Dark World / Hollow Shrine, Duneborn / Dune Sanctum) with their enemy rosters
- Additional Wild-Boss variants per v2.0 zone (e.g., a second Sylvani Wild Boss)
- Fail-forward floor / REQ-10 (unchanged from original phasing)
- Re-roll tokens REQ-14 (unchanged)
- Optional zone revisits for resource gathering

**Deferred to v2.2**: unchanged from original phasing.

### A8 — Risk deltas vs original premortem

| Risk (original L#) | Delta after A1–A7 | New mitigation |
|---|---|---|
| L1 Balance blowup | shard sources collapsed from "beasts + WBs + princess + vurmox" to "princess + map + vurmox" — farm vectors fewer | u-1a greedy-shard test still runs but scope simplifies |
| L3 6yo UX | Co-op means kids play TOGETHER; reduces rage-quit pressure (peer-driven) but adds coordination load | Tutorial u-4 explicitly covers co-op etiquette and revive mechanic |
| L4 Theme coherence | Map adds ~3 zone rasters in v2.0 + wisp icon | REQ-30 `[v2-art-pending]` ribbons cover deferred Zone 2's final raster. Budget: 3 zones × 1 raster each + 1 wisp icon = 4 cells over the v2.0 build window. Within `<3 cells/week for 2 weeks` trigger if spread across 2+ weeks. |
| L5 Scope discipline | Scope grew 12 → 15 units | Offset: some units become simpler (u-1a loses the Wild-Boss shard-grant path; u-2e loses the striker-ownership logic) |

New risks introduced by the pivot:

- **R-A1**: Map-zone spine is new code surface (state machine, zone transitions, per-zone encounter sets). No prior art in the v1 substrate. Mitigation: u-5a ships a minimal state machine first; per-zone content sheets land as data, not code.
- **R-A2**: Co-op revive mechanic is tutorial-heavy for a 6yo ("Help your teammate!") — if poorly telegraphed, downed state feels punishing. Mitigation: u-1d ships with an explicit visual downed treatment and u-4 tutorial scripts the first revive.
- **R-A3**: Wisp-as-revive item can be hoarded, converting the "both-downed = game-over" loss state into a near-impossible one. Mitigation: wisp consume-on-use already planned; balance test in u-1a extends to assert shared-pool win rate in a holding-fairies strategy is within 40–70% band (neither trivial nor impossible).

### A9 — Acceptance updates summary (for DAG regen)

These REQ acceptance bullets are SUPERSEDED by the amendment. DAG units citing them must use the amended wording:

- REQ-1 / u-1a: `EMBERTIDE_PIECES_TO_WIN = 3` is a SHARED counter (moved from `KidPlayer` to `KidGameState.sharedTriforce`).
- REQ-2 / u-1a: downed state added; revive/wisp hooks added; "both-at-0 tiebreaker" deleted.
- REQ-7b / u-1a: greedy-shard simulation enumerates (Wisdom-rush, map-rush, Vurmox-rush, mixed) rather than farm vectors.
- REQ-8 / u-2e: Wisdom shard goes to shared pool; `wisdoms-light` passive remains a shared buff (unchanged in effect — both players always got it).
- REQ-16 / u-7: soft-clock trigger is `sharedTriforce < 2 at start-of-turn-10`.
- **REQ-20a is SUPERSEDED in its entirety**: the "Hill Brute only" framing is replaced by per-zone full rosters (u-6a/b/c). Hill Brute is no longer in the game — Sylvani's Wild Boss is Craghorn per proper Aurelia lore.
- REQ-24 / u-4: tutorial adds co-op etiquette, revive, map mechanic.

### A10 — Files changed by amendment (for future PRD readers)

This amendment supersedes inline wording in REQs 1, 2, 7, 7b, 8, 11 (indirectly), 16, 20a, 20b (subsumed into per-zone rosters), 24. When those REQs are revisited post-v2.0, consult this amendment first — the upstream REQ text is retained for research provenance but is not authoritative where A1–A11 override.

### A11 — Agent-era reinterpretation of time-based constraints

This is an agent-driven build where the designer (human) collaborates with multiple agents. Calendar-time constraints in upstream sections were authored against a human-team context and do not apply. Reinterpretation rules (authoritative):

**Stripped / reinterpreted** (formerly calendar, now meaningless):
- "4–5 week ship", "~2–3 weeks", "target: N weeks" — **ignore**. v2.0 ships when every v2.0 unit's acceptance gates pass AND the designer signs off after a playtest round.
- REQ-30's "fewer than 3 finalized HC-grade cells in a week for 2 consecutive weeks → freeze new art-demanding REQs" — **replaced** by: *no visual surface ships without either finalized art in all 4 categories OR an `[v2-art-pending]` placeholder linked to a follow-up bead.* Drift detection is structural (unpaired surfaces), not throughput-rate.
- Early-Warning Signals: "PR open > 10 days or rebased 3+ times" — **reinterpret** as "unit open across >3 designer-review iterations" (the iteration budget, not days).
- "Open bead count rising WoW at week 4" — **ignore** (WoW is meaningless); substitute: "if the bead backlog grows faster than units land across 3 consecutive review iterations, re-premortem".

**Preserved** (these are kid-experience timing, unchanged):
- Session length 30–45 minutes for a 6yo (non-goal).
- Tutorial per-bubble dwell time <3s triggers re-design (REQ-24 premortem edit).
- Any in-game turn-count gate (turn 6+ Boss phase, turn 9+ Climax, turn 10 softclock).

**New constraints that newly matter in agent-era**:
- **Designer-review-iteration count**: each unit should land in ≤3 review iterations against a designer playtest round, or get re-scoped. This is the new load-bearing discipline that scope phasing (v2.0 → v2.1 → v2.2) enforces.
- **Context-window fit**: a unit whose patch exceeds ~600 lines of diff or ~8 files is a re-scope signal (split into smaller units) so agent context windows don't evict mid-implementation.
- **Playtest cadence**: the designer plays v2.0 with the 6yo between unit landings (or at natural checkpoints); playtest signal is the actual gate for v2.1 entry.

REQ-30's underlying intent — *no silent art drift, every surface accountable* — is preserved. Only the weekly-rate machinery is gone. `docs/art-governance.md` will be updated in lockstep with this amendment.

**Art-first-pass posture (NEW, designer preference)**: The default for any new visual surface is to **attempt production-quality art on the first implementation pass**. Agents generate finalized vector + raster candidates eagerly so the designer has something concrete to review in the shortest possible iteration cycle. `<ArtPendingFrame>` is a fallback for surfaces that couldn't reach review-quality on the first pass — not the default state. This maximizes signal per review cycle: a concrete-but-imperfect raster is more reviewable than a ribbon-wrapped placeholder.

---

## AMENDMENT 2 — MTG-STYLE BOSS COMBAT MINI-GAME (2026-04-20, v2.1 scope) — SIGNED OFF

> **Status**: APPROVED 2026-04-20. §B11 open questions resolved; §B15 companion scope captured. Bead `embertide-95m` (P1, feature) is the canonical build-side mirror of this amendment; `/prd-build 95m` decomposes the u-8 DAG.
> **Trigger**: `embertide-q00` playtest feedback (2026-04-20) revealed that `applyDamage()` is implemented + exported but never called by any gameplay mechanic, so hearts drops silently clamp against `hpMax` and the HPStrip reads as decoration. The designer's chosen resolution is NOT a palliative tune (e.g. lowering `STARTING_HP`); it is a structural feature addition — a dedicated combat sub-state that fires on Wild-Boss and Region-Boss engagement and is the authoritative call-site for `applyDamage`.
> **Scope**: v2.1. v2.0 ship is preserved at tag `v2-final@5da6dee`. REQ-31 and the B-series sub-requirements below are filed as active v2.1 work once approved.
> **Relationship to prior amendment**: A1–A11 (co-op + map pivot) remain authoritative for all topline game structure. REQ-31 slots *inside* the existing turn flow — it is a new sub-state reached from the existing `fightMonster` / `defeatAlwaysAvailableMonster` entry paths when the engaged target has `tier: 'wild-boss' | 'region-boss'`, and returns to the main `BossResolve`/`Main` phase on resolution.

### REQ-31 — Boss combat sub-state (MTG-inspired)

When a Wild Boss or Region Boss is engaged from the main board, the game transitions from its current phase into a **bounded combat sub-state**. The sub-state has its own turn loop, its own play area (player combat zone + boss zone), and its own deck (a **combat deck** curated from resources the players have already gathered in the main game). On resolution (WIN or LOSS), the sub-state returns control to the main board with a structured `CombatResult` that the main `KidGameState` reducer consumes to apply drops, damage, and any downstream state transitions (e.g. shard grants, zone advances, revive prompts, co-op loss).

**Why this is the right shape (design rationale for reviewer)**:
1. It gives `applyDamage` a real call-site without inventing a counter-attack mechanic or a chest-trap mechanic that would feel bolted-on — the damage comes from the boss in a fight the kid is already expecting to be a fight.
2. It makes the heroes/items/starters the kid has been gathering *matter in the moment*, not just as passive buffs. "Play your Hero against the boss" is a legible kid action.
3. It's additive to the existing v2.0 substrate: the main board's `KidGameState` is untouched during combat except for the incoming `CombatResult`. No reducer branches inside the main loop need new logic beyond "enter combat" and "apply result."
4. It resolves `embertide-q00` structurally (applyDamage has a caller) rather than cosmetically.

---

### B-series sub-requirements

#### B1 — Combat sub-state shape (schema)

Introduce a `CombatState` type and a `KidGameState.activeCombat: CombatState | null` field (null when not in combat). `CombatState` carries:

- `boss: CombatBoss` — a projection of the engaged beast carrying `hp`, `hpMax`, `attackPattern` (see B3), and a back-reference to the main-board beast card.
- `combatDeck: Card[]` — the subset of player resources drafted into combat at sub-state entry (see B2). Shared across both players in co-op.
- `combatHand: Card[]` — cards currently in hand this combat turn.
- `combatDiscard: Card[]` — cards played or consumed.
- `battlefield: BattlefieldCard[]` — heroes/items currently in play on the combat zone; each has `hp`, `hpMax`, and absorbs boss damage per B3.
- `turnIndex: number` — combat-local turn counter (0 at entry).
- `activeActor: 'players' | 'boss'` — whose turn it currently is inside combat.
- `entryContext: CombatEntryContext` — the main-board reducer hook (see B6) that tells the exit path which beast was engaged, which players were attackers, and what drops / shard events to resolve on WIN.

`CombatState` is **pure-data**; all transitions are reducer-level. No timers, no async animations in the reducer. (Animation is the render layer's concern.)

#### B2 — Combat deck construction (draft rules)

On combat entry, a `buildCombatDeck(state, entryContext)` pure function assembles `combatDeck` from the players' current resources. v2.1 draft rules:

- **Eligible**: starter cards (`starter-green`, `starter-red`, `starter-home`), heroes in `KidPlayer.championSlot` and any heroes currently `inPlay`, items in `KidPlayer.items` with `kind: 'item-active'` (fairies explicitly excluded — fairies remain main-board-revive only), and any passive items (once REQ-4 v2.1 lands item-passive — not yet shippable; B2 is authored to be forward-compatible).
- **Ineligible** (v2.1 scope narrowing): deck cards in the main-board draw pile, discard pile, chest contents, gems (gems do not enter combat), re-roll tokens (unchanged from REQ-14 denylist spirit).
- **Shared pool in co-op**: both players contribute; the combat deck is a single pool. Neither player "owns" combat cards during combat — this mirrors the shared-victory / shared-loss co-op frame from A1.
- **Deterministic shuffle**: uses the existing `mulberry32` RNG seed from `KidGameState`, advanced by combat turn index. No new RNG substrate required.
- **Draw**: on combat entry each side draws 5; on combat-turn start players draw 1 up to a hand cap of 7.
- **Deck empty**: if the combat deck empties and players cannot play, no automatic shuffle-back — this is an explicit loss-pressure dial. v2.1 ships with no shuffle; v2.2 may add one re-shuffle at cost of 1 gem if playtest shows kids feel stuck.

#### B3 — Boss attack pattern (damage routing)

Each Wild Boss and Region Boss declares a `BossAttackPattern`:

- `damagePerTurn: number` — base damage the boss attempts each boss-turn.
- `targeting: 'player-hp' | 'battlefield-then-player' | 'aoe'` — how the damage is distributed.
- `onDefeatEffect: CombatOnDefeatEffect | null` — post-win effect (e.g. Sentinel drops an extra wisp; Vurmox grants the Power shard).

Damage routing rules (authoritative — these are the call-sites for `applyDamage` and `applyBattlefieldDamage`):

- **`player-hp`**: damage is split evenly across non-downed players using `applyDamage(player, amountPerPlayer)`. Excess damage (rounding) goes to the active-attacker player first. **`checkCoopLoss(state)` MUST fire immediately after each `applyDamage` call in this path**, per the contract at `src/store/gameStore.ts:195–202`, so a both-downed state triggers loss without waiting for the next `endTurn`.
- **`battlefield-then-player`**: damage is absorbed by `battlefield` cards (front-to-back by play order) until the battlefield is cleared; residual damage spills to players via the `player-hp` rule above. Each battlefield card has its own `hp/hpMax`; at 0 hp it's discarded to `combatDiscard`.
- **`aoe`**: damage is applied to EVERY battlefield card AND EVERY non-downed player simultaneously. Used for Region Boss "desperation" turns (see B4). Same `checkCoopLoss` rule applies after player-damage.

A new helper `applyBattlefieldDamage(battlefield: BattlefieldCard[], amount: number): BattlefieldCard[]` lives in `src/core/combat.ts` and is unit-tested in isolation.

**q00 resolution note**: this is the moment the heart-drop HP cap becomes meaningful. With applyDamage firing during boss combat, players enter fights with depleted HP after any non-trivial boss sequence, so a `hearts: N` drop after combat actually heals toward `hpMax` instead of silently clamping. The greedy-shard simulation (REQ-7b / u-1a) should extend to assert that median post-combat HP sits below `hpMax` in the Wisdom-rush and Power-rush strategies — that's the structural test that q00 is no longer live.

#### B4 — Combat turn loop

```
CombatEntry (one-time)
  → build combatDeck, draw 5, activeActor = 'players', turnIndex = 0
Repeat:
  PlayersTurn:
    Active player plays cards from hand (up to some per-turn action budget; default 3);
    each played card resolves its combat effect (see B5);
    activePlayer may pass at any time → BossTurn.
  BossTurn:
    Resolve boss.attackPattern per B3;
    check if boss.hp <= 0 (WIN) or all players downed (LOSS via checkCoopLoss);
    increment turnIndex;
    apply any "desperation" pattern if boss.hp below threshold (e.g. <25% → 'aoe').
Until WIN or LOSS.
```

Action budget (3 plays/turn) is a tuning dial. v2.1 ships with 3; playtest may adjust. `BOSS_TURN_THRESHOLDS` and `DESPERATION_HP_PCT` live in `src/core/balance.ts` as named constants, not magic numbers.

#### B5 — Card combat effects (behaviour in combat zone)

Cards need a combat-side `CombatEffect` (a discriminated union mirroring the existing `EffectSpec` pattern from REQ-13 Phase 1, so the schema extension is small and reviewable). Kinds (v2.1 draft):

- `combat-attack`: deal N damage to `boss.hp`. Most starter and hero cards carry this.
- `combat-absorb`: enter battlefield with `hp: N` and absorb boss damage per B3's `battlefield-then-player` pattern. Items like "Wooden Shield" or "Tunic" (if/when they exist) carry this.
- `combat-heal`: restore N hp to a battlefield card OR to a non-downed player. Wisp-adjacent effect; distinct from the main-board wisp-revive.
- `combat-draw`: draw N from `combatDeck` into `combatHand`.
- `combat-multishot`: deal X damage Y times; a late-tier item kind.

The full card/combat-effect mapping is a data sheet (`src/data/combatEffects.ts`) authored *after* the schema lands so the schema PR stays surgical (REQ-13 Phase 2 discipline). Data-sheet PR is the second unit, not part of the schema unit.

**Default for cards without an explicit `CombatEffect`**: `combat-attack` with damage = the card's existing main-board `power` stat. This gives every existing card a playable baseline so the combat deck never contains unplayable cards. Overrides author explicit `CombatEffect` entries for non-attack cards (items, healing, etc.).

#### B6 — Entry + exit hooks (main-board reducer integration)

- **Entry**: `fightMonster` / `defeatAlwaysAvailableMonster` in `src/core/combat.ts` (note: the main-board `combat.ts` file, distinct from B5's combat sub-state) inspects the engaged beast's `tier`. If `tier ∈ {'wild-boss', 'region-boss'}`, instead of the existing instant-resolution path, it dispatches a `COMBAT_ENTER` action whose reducer builds `CombatState` via B1+B2 and clears the main-phase `activeActor`. Ordinary monsters keep the existing instant-resolution path (regulars unaffected).
- **Exit — WIN**: a `COMBAT_RESOLVE_WIN` action (dispatched by the combat-sub-state reducer when `boss.hp <= 0`) consumes `entryContext` and applies:
  - existing heart-drop rules (hearts heal attackers, up to `hpMax` — per REQ-2 — **this is now the meaningful heal because applyDamage ran during combat**)
  - wisp drop for Wild Boss (per A6)
  - shard grant for Region Boss (Wisdom for Princess-crystal break path is unchanged — that's a Strike action, not boss combat; Power on Vurmox defeat per existing u-6c contract; Courage on Gilded-cage clear per A5, which *may* coincide with Vurmox defeat in v2.1)
  - zone advance for Region Boss (per A5)
  - `activeCombat: null`
- **Exit — LOSS**: a `COMBAT_RESOLVE_LOSS` action applies whatever residual damage the boss dealt in its final turn (already applied during combat via `applyDamage`), ensures `checkCoopLoss` has run, and:
  - if `outcome: 'loss'` already set → main board transitions to the loss screen
  - else → main board resumes at the engagement's originating phase (player can still play, but one or both are now downed; revive paths from A3 apply)
  - `activeCombat: null` either way
- **Abort (not v2.1)**: there is no mid-combat flee action in v2.1. Kids either win or go down. v2.2 may add a "retreat" at the cost of discarding half the combat hand, if playtest shows kids feel trapped.

#### B7 — UI surfaces (new views, v2.1 art budget)

New React surfaces (each is a unit candidate for the DAG):

- `CombatScreen.tsx` — the full-viewport combat view, replacing the main board visually while `activeCombat !== null`. Stained-glass Aurelia-cathedral aesthetic (REQ-5 family).
- `CombatBossPanel.tsx` — boss hp bar, attack pattern telegraph, onDefeat hint.
- `CombatBattlefield.tsx` — the played-heroes/items row; each battlefield card shows its `hp/hpMax`.
- `CombatHand.tsx` — player's current combat hand; tap-to-play interaction.
- `CombatLog.tsx` — last 3 events in plain language ("Craghorn attacked — Link blocked!" / "You played Spirit Arrow for 2"). Kid-legible.
- Boss attack telegraph: before the boss turn resolves, a 1-line banner shows what the boss is about to do ("Craghorn winds up for 3"). The attack still resolves without user input — the telegraph is about legibility, not interactivity. v2.1 iterates if playtest shows kids miss the telegraph.

Art budget (REQ-30 structural version): every new visual surface either ships finalized art across all 4 REQ-30 categories (vector, raster, icon, token) on first pass (art-first-pass posture), OR ships `<ArtPendingFrame>` with a follow-up bead. Target for the combat sub-state: combat background raster (1), boss-portrait slot (re-use existing beast rasters from u-6a/b/c), UI chrome (vector only, no raster needed). Minimum art debt.

#### B8 — Tutorial coverage

REQ-24 v2.1 extension. A new tutorial bubble sequence ships:

- `combat-entry` — "You engaged Craghorn! Play cards from your combat deck to fight."
- `combat-card-played` — "Nice! You dealt 2 damage."
- `combat-boss-turn` — "Craghorn attacks for 3 — your hero blocked 2, you took 1."
- `combat-win` — "Craghorn down! You got 2 hearts."
- `combat-loss` — "You went down. Heroes can still revive you."

Progressive disclosure per REQ-24 premortem edit — not all bubbles fire in the first combat. First combat shows `combat-entry` + `combat-card-played`; subsequent combats introduce boss-turn telegraphing.

#### B9 — Tests + balance gates

- Unit tests on `applyBattlefieldDamage`, `buildCombatDeck`, each `CombatEffect` resolver, each `BossAttackPattern.targeting` branch.
- Integration test: full Craghorn combat from entry to WIN — assert shards unchanged, hearts applied up to hpMax, wisp dropped.
- Integration test: full Craghorn combat from entry to LOSS with both players — assert `checkCoopLoss` fired and `outcome === 'loss'`.
- q00 regression test: fight Broodmaw (region-boss) to victory with partial HP going in; assert post-combat HP reflects the `hearts: N` drop moving the needle (not silently clamping).
- Balance sim extension: greedy-shard simulation (REQ-7b) runs 1000 games for each strategy (Wisdom-rush, Map-rush, Vurmox-rush, mixed) AND asserts median combat-length per boss falls in a 3–7 boss-turn window (too short = boss combat is decorative; too long = kids time out).
- Test suite target: +~40 tests over the current 819 baseline by v2.1 ship.

#### B10 — Work-unit decomposition (for `/prd-build` on 95m)

Proposed DAG (finalize during `/prd-build` after designer approval):

1. **u-8a — schema** — `CombatState`, `CombatBoss`, `CombatEffect` discriminated union, `KidGameState.activeCombat` field, reducer action types `COMBAT_ENTER` / `COMBAT_RESOLVE_WIN` / `COMBAT_RESOLVE_LOSS` with type-only stubs. No behaviour yet. One surgical PR per REQ-13 Phase 1 discipline.
2. **u-8b — combat engine core** — `buildCombatDeck`, `applyBattlefieldDamage`, combat turn-loop reducer. Unit tests land with this unit. No UI yet.
3. **u-8c — entry/exit wiring** — `fightMonster` / `defeatAlwaysAvailableMonster` tier branch; `COMBAT_RESOLVE_WIN` / `COMBAT_RESOLVE_LOSS` integration with existing drop/shard/zone-advance code. q00 regression test lands here.
4. **u-8d — combat effects data sheet** — `src/data/combatEffects.ts` mapping each existing card to its `CombatEffect`. Defaults to `combat-attack` with `power` as damage where unspecified.
5. **u-8e — boss attack patterns** — pattern definitions for Craghorn, Broodmaw, Boulderkin, Ashen Tyrant, Sentinel, Silver Chimera, Vurmox (7 patterns). Balance-test scoped per B9.
6. **u-8f — CombatScreen UI** — all 5 surfaces from B7 wired to the engine. Art-first-pass on the combat background raster.
7. **u-8g — tutorial bubbles** — B8 sequences, progressive disclosure.
8. **u-8h — balance sim extension** — greedy-shard scope expands to include combat-length assertions.

u-8a blocks everything. u-8b blocks u-8c, u-8e, u-8f. u-8d parallel-shippable with u-8e. u-8f blocks u-8g. u-8h last.

**Context-window fit check (per A11)**: each unit targets ≤600 lines diff, ≤8 files. u-8a and u-8b are the two tightest; u-8f is the largest (UI surfaces) and may need a further split during `/prd-build`.

### B11 — Open design questions — RESOLVED 2026-04-20

Designer answered all 9 at sign-off review. Answers are authoritative for the u-8 DAG.

1. **Per-turn action budget**: **3 plays/turn**.
2. **Deck-empty behaviour**: **no re-shuffle in v2.1**. Play what you have; v2.2 may add paid re-shuffle if playtest shows kids feel trapped.
3. **Combat-hand cap**: **5**.
4. **Co-op turn ordering in combat**: **shared turn** — either player may play any card from the shared hand on a single combined players' phase; turn-of-active-player on the main board doesn't gate participation during combat. Matches A1 co-op framing.
5. **Downed players in combat**: **excluded with partial reward** — cannot play cards, cannot be targeted by boss damage, BUT still receive their share of hearts-drop on WIN (partial reward for being on the team).
6. **q00 pacing tune**: **no tune yet**. Mechanics first; economy tuning after REQ-31 + B15 companion passes land. Greedy-shard sim (B9) will surface imbalance in data.
7. **Retreat / flee**: **no retreat in v2.1**. Revisit in v2.2 if playtest shows kids feel trapped.
8. **Vurmox fight framing**: **same schema** as other Region Bosses for v2.1. In-fight phase transitions deferred to v2.2+ if climax feels anticlimactic.
9. **Combat RNG** (added at review): **per-combat deterministic seed** — combat shuffle uses `state.seed + combatEntryTurn` derivation so combat outcomes are reproducible within a game but each combat entry sees fresh randomness.

### B12 — Risk deltas vs prior premortem

| Risk (original L#) | Delta after REQ-31 | New mitigation |
|---|---|---|
| L1 Balance blowup | New failure mode: combat-deck composition lets a player drop a 6-might warden on turn 1 of Vurmox and one-shot him | B9 balance sim asserts median combat-length 3–7 turns per boss. B2 eligibility rules exclude in-deck/in-discard cards so not every gathered card enters combat. |
| L3 6yo UX | Combat is a NEW screen + NEW interaction model. High tutorial load. Potential rage-quit if combat feels unfair. | B8 progressive disclosure. B3 boss-turn telegraph. B11 Q1/Q3/Q4 are deliberate simplicity dials. |
| L4 Theme coherence | New surfaces (CombatScreen, BossPanel, Battlefield, Hand, Log). Art burden grows. | B7 minimum-art-debt plan: re-use existing beast rasters, ship combat background raster on first pass per art-first-pass posture, UI chrome is vector. `[v2-art-pending]` ribbon fallback available. |
| L5 Scope discipline | Scope grew by 8 units (u-8a..h). This is a meaningful bulge. | REQ-31 is **v2.1 scope**, not v2.0. v2.0 ship is frozen at `v2-final@5da6dee`. REQ-31 is the v2.1 headline feature; other v2.1 REQs re-check against it (e.g. REQ-14 re-roll tokens may need a v2.1 re-scope to clarify whether tokens affect combat rolls). |

### B13 — Explicit non-goals for REQ-31

- Not a full MTG clone. No mana colors, no stack, no counterspells, no priority windows. The "MTG-style" framing is about *deck-of-cards-fighting-a-boss*, not rules complexity.
- Not a PvP mode. Co-op only (consistent with A1).
- Not a mid-game "challenge" in the collectible-card sense. Combat is a scripted consequence of engaging a boss on the main board, not an opt-in minigame.
- Not a way to grind XP / levels / currency. WIN drops are exactly REQ-2's hearts + wisp / shard per boss tier. LOSS drops nothing. No new economy.

### B14 — Acceptance criteria summary (for bead 95m / u-8 DAG)

A v2.1 ship of REQ-31 is acceptance-complete when:

- [ ] `activeCombat` enters on engaging any `wild-boss` or `region-boss` beast.
- [ ] `applyDamage` has at least one live call-site (the boss-turn resolver) with production telemetry confirming calls during playtest.
- [ ] `checkCoopLoss` fires after every `applyDamage` invocation from combat.
- [ ] WIN resolves with the same drops (hearts heal / wisp / shard / zone advance) as the existing instant-resolution path.
- [ ] LOSS leaves the main board in a consistent state — either `outcome: 'loss'` or a playable-with-downed-player state with revive paths intact.
- [ ] q00 regression test passes: post-combat hearts drop moves the HP needle.
- [ ] 819-baseline test count plus B9's ~40 new tests, all green.
- [ ] Designer playtests the first Craghorn combat with the 6yo and reports it's legible. If not legible in ≤3 designer-review iterations (per A11), B11 dials are adjusted.

---

### B15 — Companion v2.1 scope surfaced at REQ-31 sign-off (2026-04-20)

Designer flagged three adjacent concerns at sign-off review. They are NOT gated by REQ-31 and should not balloon the u-8 DAG; they are filed as separate v2.1 beads so REQ-31 work stays focused.

- **B15.1 — Enemy-defeat reward tuning pass.** The current heart-drop / wisp-drop / key-drop values across regulars, Wild Bosses, and Region Bosses are not tuned; they were stubbed during u-6a/b/c with placeholder numbers. Needs a data-sheet pass after REQ-31 lands so the hearts-drop values interact correctly with combat damage. **Bead**: filed as companion to 95m (see below).
- **B15.2 — Purchased-card ability optimization.** Market cards (starters, heroes, items sold through the market row) have under-developed or inert abilities in several cases; they work mechanically but are not individually compelling. Needs a design pass that makes each purchasable card feel like a meaningful choice — especially once REQ-31 gives cards a combat-side effect and so doubles their footprint. **Bead**: filed as companion to 95m.
- **B15.3 — Key retention / accumulation semantics.** Designer flagged the intent: playing a hero with a key-grant should credit a key to the player, keys should persist across turns, and playing a second key-granting hero should stack to 2 keys (enough for a larger chest). **Code audit at sign-off (`src/store/gameStore.ts:273,287,314`)**: the code ALREADY appears to satisfy this contract — `heroOnPlayDeltas` adds `keys: 1` for sage-keeper and another hero, and the reducer does `keys: player.keys + deltas.keys` (additive, persistent). If the designer is seeing a case where this doesn't hold in playtest, that's a BUG to file under q00's umbrella, not a feature. Otherwise, the ASK may actually be: "this contract should extend to MORE heroes" (i.e., a content/balance ask — which folds into B15.1 / B15.2). **Clarification pending** — see companion bead.

These three items are **not implementation blockers for REQ-31** — u-8a–h can start once the designer signs off on REQ-31 proper. But they should land in the same v2.1 window so the economy tunes together.

---

**SIGNED OFF 2026-04-20. `embertide-95m` in-progress. B15.3 (key retention) closed as working-as-designed after code audit + designer playtest confirmation. `/prd-build 95m` authorized to decompose u-8a..h into active beads.**
