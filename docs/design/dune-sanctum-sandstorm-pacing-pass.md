# Dune Sanctum Pacing Pass — Synthesis (embertide-7itk)

_Date: 2026-04-25 · Bead: embertide-7itk · Prereq for: embertide-ricb_

## Research question

The bead `embertide-ricb` defers full sandstorm-discard semantics
("every 3 turns the wind blows, discard one hand-card", gdd.3.4)
behind a playtester pacing pass. The substrate ships a cap-3 flat-adder
on `attackPattern.damagePerTurn` instead. Designer ruling
(`embertide-designer-ruling-dune-sanctum-substrate-2026-04-25`)
flagged the sand-timer as **"cruel pacing risk for 6yo without
tuning."** This pass collects the data needed to confirm or refute
that ruling.

## Method

- New debug seed `zone-dune-sanctum` (mirrors existing `zone-temple`
  pattern + exposes `window.__gameStore` for state reads).
- New spec `tools/playtester/smart-dune-sanctum-walk.spec.ts` —
  smart-policy 16-turn × 2-seat walk, capturing tick samples
  (`turn`, `activeSeat`, `sandstormCounter`, both seats' hand sizes,
  `currentZone`) at every end-phase boundary.
- 3 runs of the spec.

## Raw findings (3 runs, identical data)

| Metric | Value |
| --- | --- |
| In-zone ticks per 16-turn walk | **32** (2 ticks per game-turn in 2P) |
| Ticks at counter cap (3) | **30 / 32** |
| Counter trajectory | `1 → 2 → 3 → 3 × 30` (saturates after 3 ticks) |
| Hand size at tick (active-seat POV) | min 0 / **avg 2.5** / max 5 |
| Hypothetical discards under rule (a) "every 3 ticks" | **10** per 16-turn walk |
| Hypothetical discards under rule (b) "every 3 game-turns" | **5** per 16-turn walk |
| Hand sizes at rule-(a) discard moments | `[5, 0, 5, 0, 5, 0, 5, 0, 5, 0]` |

Per-run reports (gitignored, regen via the spec):

- `docs/playtest-reports/2026-04-25-smart-dune-sanctum-walk-run-1.md`
- `docs/playtest-reports/2026-04-25-smart-dune-sanctum-walk-run-2.md`
- `docs/playtest-reports/2026-04-25-smart-dune-sanctum-walk-run-3.md`

## Interpretation

### Counter saturation

The cap-3 ceiling fires by the **3rd** end-phase tick (1.5 game-turns
in 2P) and stays saturated for the rest of the zone visit. So under
any "discard fires when counter reaches 3" interpretation, the rule
fires nearly every tick once it's primed. Reset semantics matter:
without a reset-after-firing, the discard fires every single tick
once primed (catastrophic). Assuming "fire and reset to 0", the cycle
stabilizes to `0 → 1 → 2 → 3 (fire+reset) → 0 → ...` — i.e., a
discard every 3 ticks.

### Frequency

- **Rule (a)** "every 3 seat-turn ticks → discard"
  - 10 discards over 16 game-turns
  - That's a discard roughly every 1.5 game-turns in 2P
  - **Verdict: cruel.** A 6yo loses hand control in the majority of
    turns. Even an MTG-literate adult would feel this is high-tempo
    pressure compounding on top of the boss damage.
- **Rule (b)** "every 3 game-turns → discard" (one seat's perspective)
  - 5 discards over 16 game-turns
  - One discard every ~3 game-turns
  - **Verdict: moderate.** Tempo penalty is meaningful but absorbable
    for a player who keeps a couple of cards in reserve.

### Hand availability at fire moment

The smart walk plays every card greedily before ending turn, so
hand-size-at-tick alternates `0` (the seat that just played) and `5`
(the seat that just refilled at start-of-turn). The 0-hand cases mean
a discard rule would no-op on those ticks — effectively halving rule
(a) to ~5 real discards. But this is a policy artifact: a real 6yo
session leaves 1-3 cards unplayed per turn (combat-only cards, cards
they "save for later"), so the no-op rate is much lower in real play.
Real-play discards/run is likely closer to the headline number than
the 5-no-op-adjusted figure.

## Recommendations

1. **Do NOT ship rule (a)** as currently described in the gdd.3.4
   memo. At 10+ discards per 16-turn game (in 2P) it materially
   removes hand agency from the player and stacks badly against the
   already-active flat-adder boss damage. Designer's "cruel pacing
   risk for 6yo" hypothesis is **confirmed**.

2. **Rule (b) "every 3 game-turns → 1 discard" is shippable** if the
   discard hook is desired. ~5 discards per typical Dune Sanctum
   visit is in the same blast-radius as a moderate boss damage roll;
   it shapes hand decisions without dominating them.

3. **Alternative: keep the cap-3 flat-adder as the only sandstorm
   pressure.** This is what ships today. The pacing pass shows the
   flat-adder by itself is already a meaningful zone-flavor mechanic
   (saturates fast, applies throughout the visit). Layering a discard
   on top doubles the zone's pressure surface; rule (b) is acceptable
   but not necessary.

4. **If shipping rule (b), set the trigger at counter≥3 with reset
   to 0 on fire,** so the cadence is deterministic and inspectable.
   The discard target should be the **just-ended seat** (the player
   whose turn ended causes their wind to blow); reads more like a
   personal weather event and lines up with the active-seat tracking
   already done at the tick site (`gameStore.ts:2320`).

## Caveats

- **All 3 runs produced identical numbers.** Debug-seeded games
  bypass the fresh-`Date.now()` RNG seed used by the Setup-flow init
  (visible in `smart-2p-coop-walk` reports, where each run differed).
  Pacing analytics for sandstorm-counter trajectory are RNG-
  independent (the counter ticks deterministically per end-phase) so
  the headline numbers stand. If we end up tuning hand-discard math
  using the seeded reports, we should re-run with a Date.now() reseed
  hook in `applyDebugSeed`.
- **Walk plays every card greedily.** Real 6yo play leaves more cards
  in hand at tick time — see "Hand availability" above. The
  hand-size-at-tick numbers undercount real availability.
- **No combat fired in the walk.** The smart-policy harness farms
  resources/chests but doesn't engage the wild/region boss. If the
  designer wants to measure pacing during/around combat (where the
  flat-adder boss damage lands), a follow-up spec that engages the
  Dune Sanctum bosses would close that gap.

## Decision (2026-04-25)

**Won't ship.** Designer call: "I don't want the discards — it's not
a fun mechanic." The cap-3 flat-adder remains the Dune Sanctum
zone-mechanic ceiling. `ricb` closed as won't-ship; the substrate
comment in `src/store/slices/zones.ts` (`incrementSandstormCounter`)
points back here for context.
