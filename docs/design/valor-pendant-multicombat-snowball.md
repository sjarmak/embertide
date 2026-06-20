# Valor-Pendant Multi-Combat Snowball — Synthesis (embertide-4uyn.6)

_Date: 2026-04-25 · Bead: embertide-4uyn.6 · Follow-up to: 4uyn.4_

## Research question

Bead `4uyn.5` flagged a snowball concern: with `valor-pendant`
firing `+2 power` on every `on-combat-enter`, and a typical zone
running 3-5 regular monster fights + 1 wild boss + 1 region boss,
the bead anticipated **5-7 valor fires per zone** (up to +14 power).
This pass measures the actual fire count.

## Method

- New spec `tools/playtester/valor-pendant-multicombat.spec.ts`
  walking the full Sylvani combat surface (regulars + wild + region)
  in two arms:
    - `control` — `?debug=wild-boss-slot` baseline
    - `valor` — same boot + injects `valor-pendant` into `p0.items`
      via the exposed `window.__gameStore`
- Pre-seeds p0/p1 with red=30 / green=10 / keys=5 so every combat is
  affordable.
- Reads `state.players[0].red` BEFORE and AFTER each engagement to
  isolate the on-combat-enter delta.

## Findings

| Tier | Control Δred | Valor Δred | Valor – Control |
| --- | --- | --- | --- |
| Regular monster (jellet-3, role=`'monster'`) | −2 (cost paid) | −2 (cost paid) | **0** — no valor fire |
| Wild boss entry (craghorn) | 0 | +2 | **+2** — valor fires |
| Region boss entry (broodmaw) | 0 | +2 | **+2** — valor fires |
| **Per-zone cumulative** | 0 | **+4** | **+4 red / zone** |

## Why the regular monster doesn't fire

Code-level confirmation (validated by the empirical data above):

- `gameStore.ts:1850` — `fightMonster` branches on `bossTier`:
  - `wild-boss` / `region-boss` route through `enterCombatAction` →
    dispatches `COMBAT_ENTER` → applies `on-combat-enter` passives
    at `gameStore.ts:2417`.
  - Regular monsters take the synchronous `fightMonsterSlice` path
    (`gameStore.ts:1883`). **No `COMBAT_ENTER` dispatch, so no
    on-combat-enter passive fires.**
- `engageWildBossSlot` / `engageRegionBossSlot` (the slot-altar UI
  buttons) bypass the red/keys cost check entirely
  (`gameStore.ts:1915` "u-9c") — that's why the boss-entry deltas
  isolate exactly the valor +2 with no cost noise.

## Why the bead's "5-7 fires/zone" figure was high

The bead description anticipated valor firing on every combat in a
zone. In v2.1, only **2** of those combats (wild + region boss)
dispatch `COMBAT_ENTER`. Regulars instant-resolve through
`fightMonsterSlice` and are effectively invisible to on-combat-enter
triggers.

Per-zone valor grant is therefore **+4 red, not +10–14**.

## Game-scale impact

- v2.1 ships 5 zones (sylvani, emberpeak, gilded-cage, maren,
  hollow-shrine, dune-sanctum — 6 zones, but Gilded Cage is the
  Embertide-assemble zone with Vurmox-only).
- Realistic combat-zone count for valor accumulation: **~5 zones × 2
  fires = 10 fires per game = +20 red total.**
- For comparison, `valor-pendant` costs 6 green to acquire from a
  chest. Over 5 zones it returns +20 red. That's a strong relic but
  not game-warping; main-board red flows from played hero/monster
  cards routinely deliver 5-15 red per turn-end.

## Recommendation

**Ship-as-is.** No retune required.

- The actual snowball is +4 red per zone, not +10–14. The bead's
  framing materially overstated the surface.
- Slay-the-Spire-style relic-tier cadence (~+2-4 stat per relic per
  combat) is a familiar shape for the target audience; +20 red over
  a full game is well inside that envelope.
- If a future signal shows valor-pendant pushing combat tempo too
  far on its own, the cleanest tuning lever is the **green cost**
  (currently 6) rather than the per-fire amount.

## Caveats

- **Data points: 1 jellet in the field, 1 wild, 1 region.** The
  `wild-boss-slot` seed produces a single regular in the field at
  boot time. Higher regular counts would not change the snowball
  math (regulars don't fire) but would let the spec assert across
  more samples. For a future iteration, see
  `embertide-4uyn.5` (full N=5+ zone-traversal harness).
- **No combat-internal red gain measured.** The valor +2 lands at
  `COMBAT_ENTER`; whether the player can actually USE the +2 inside
  the combat (where damage uses the combat-deck, not main-board red)
  is a separate concern. The 4uyn.4 single-combat spec already
  confirmed rounds-to-terminal is unchanged within a single combat;
  the true value of the +2 lives in the AFTER-combat carryover into
  the next main-phase.
- **Single-arm runs are deterministic.** Debug-seeded games skip
  `Date.now()` reseed (same caveat as the 7itk dune-sanctum pass).
  Pacing-counter analytics here are RNG-independent so the +4
  number stands.

## Decision

**Ship-as-is per the data.** Closing 4uyn.6 with this synthesis.
4uyn.5 (full N=5+ zone-traversal) can be opened as a follow-up if
the designer wants higher-confidence numbers, but the headline
finding is unlikely to shift.
