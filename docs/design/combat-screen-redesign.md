# Combat Screen Redesign (embertide-nz8)

**Status:** Draft — 2026-04-24. Designer sign-off required before implementation beads dispatch.

## Problem

Post art-wiring (y5x/797/j5x/y88/3ub/wnj/9o9/jw6/zbr), the combat screen still
reads as placeholder:

1. **Hand cards render as buttons, not cards** — `CombatHand.tsx` places a
   56px illustration above a name + one-line combat summary inside a plain
   `<button>` styled with `CARD_BUTTON_STYLE`. `CardTemplate` (the
   stained-glass card face used on the main board via `Hand.tsx`) is NOT
   used. Players lose the "these are real cards" affordance the moment they
   enter combat.
2. **No printed effect text** — only `combatSummaryTextFor(card)` (one line)
   surfaces. Players cannot scan what each card actually does on the
   battlefield without memorizing it off the main board.
3. **Flat colored panes dominate** — `CombatBossPanel`, `CombatHand`, and
   `CombatBattlefield` each sit in their own solid-colored rectangle
   (`--hc-shadow-500/600/700` + gold border). The zone raster backdrop
   renders inside a narrow `BACKGROUND_SLOT_STYLE` 96px-min strip at the top
   of the screen rather than behind the entire arena.
4. **Boss portrait is 80px inside a flat panel** — per 797's wiring; reads
   as an inline avatar, not the combat centerpiece.

## Direction (designer-validated 2026-04-24)

```
┌──────────────────────── [zone raster covers whole viewport, vignetted] ─────────────────────────┐
│ Hearts  [P1 ♥♥♥♥♥ Name 5/5]   [P2 ♥♥♥♥♥ Name 5/5]                                               │
│                                                                                                  │
│                 ╔═══════════════ BOSS STAGE ═══════════════╗                                    │
│                 ║          [BOSS PORTRAIT ~256px           ║                                    │
│                 ║           in stained-glass arch]          ║                                    │
│                 ║    Name                       HP  N/M    ║                                    │
│                 ║    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ (HP bar)        ║                                    │
│                 ║    [telegraph banner when activeActor=boss]║                                   │
│                 ╚═════════════════════════════════════════╝                                    │
│                                                                                                  │
│                 Battlefield (minions defending in front of boss):                                │
│                 [ CardTemplate ]   [ CardTemplate ]   [ CardTemplate ]                           │
│                     hp 3/4             hp 2/4             hp 1/1                                 │
│                                                                                                  │
│                                    Plays this turn: 1/2                                         │
│                                                                                                  │
│    Hand (full-art CardTemplates, tap to play):                                                   │
│    [CardTemplate] [CardTemplate] [CardTemplate] [CardTemplate] [CardTemplate]                    │
│                                                                                                  │
│                            [ Pass Turn ]                                                         │
│    CombatLog (last 3 entries)                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Visual contract

- **No flat-color panel backgrounds on the four children.** The zone raster
  from `CombatScreen`'s `BACKGROUND_SLOT_STYLE` is promoted to a full-viewport
  layer behind everything else, with a light vignette/scrim for text
  legibility. Panels either sit transparent on top of the raster, or carry
  only a stained-glass arch/border (no solid fill).
- **Boss portrait dominates.** Raised from 80px to ~256px (mobile) /
  ~320px (tablet), framed by a dedicated stained-glass stage component
  (`CombatBossStage`). HP bar + name + telegraph sit below the portrait,
  still inside the stage frame — the panel is vertical, not a side-by-side
  portrait+info row.
- **Hand uses `CardTemplate`.** Swap `CombatHand`'s custom-styled `<button>`
  for the same `CardTemplate` rendering pattern that `Hand.tsx` uses on the
  main board (wrap in `<button>`, pass `card` and a computed `effect`, size
  via `illustrationSize`). Preserves the 44×44 tap-target contract. Players
  see the real card face (frame + art + cost + effect text) during combat.
- **Battlefield uses `CardTemplate`.** Same swap as above — replace the
  `CARD_STYLE` flat tile in `CombatBattlefield.tsx` with `CardTemplate` +
  the `hp N/M` readout overlaid or appended (minion semantics). The card
  reads as a minion-card in front of the boss rather than a row-item with a
  text label.

### Components and reuse

| Concern | New or Reuse | Source |
| --- | --- | --- |
| Full-viewport zone backdrop | Existing (promote) | `CombatScreen` `ZONE_BACKGROUND_SRC` + `<img>` — move from scoped slot to the screen's main background layer |
| Stained-glass arch frame for boss | **New** | `CombatBossStage` — wraps the existing `CombatBossPanel` portrait + HP + telegraph in a dedicated stained-glass arch. See `BossAltarPane` (`src/ui/BossAltarPane.tsx`) for prior-art arch styling — evaluate whether to extract its arch SVG as a shared primitive |
| Boss portrait at 256px+ | Existing | `illustrationForBaseId(boss.sourceCardId, ...)` already powers the 80px portrait; resize only |
| Hand card tiles | Reuse | `CardTemplate` via `Hand.tsx`'s wrap pattern |
| Battlefield card tiles | Reuse | `CardTemplate` + HP overlay/append |
| HP bar / telegraph | Existing | `CombatBossPanel` internals survive — they move inside `CombatBossStage` rather than next to the portrait |
| Plays counter / Pass button / CombatLog | Existing | No change |

### Layout composition

`CombatScreen` restructures to:

```tsx
<div className="combat-screen"> {/* full-viewport relative */}
  <div className="combat-bg" />  {/* absolute fill, zone raster + vignette */}
  <div className="combat-arena"> {/* relative z=1, column flex */}
    <CombatPlayerHpRow />
    <CombatBossStage boss={boss} activeActor={activeActor} />
    <CombatBattlefieldCards battlefield={battlefield} />
    <CombatPlaysCounter playsThisTurn={playsThisTurn} />
    <CombatHandCards cards={combatHand} onPlayCard={...} />
    <CombatPassButton ... />
    <CombatLog events={logEvents} />
  </div>
</div>
```

The four panel-styled children (`CombatBossPanel`, `CombatBattlefield`,
`CombatHand`) are replaced in-place by transparent-background renderers that
use `CardTemplate`. `CombatBossStage` is the one genuinely-new component.

## Implementation sub-beads (to file after designer sign-off)

1. **nz8-a — `CombatBossStage` centerpiece.** New component wrapping the
   boss portrait (resize 80 → 256px), HP bar, name, and telegraph banner in
   a stained-glass arch frame. Deletes the flat-panel background from
   `CombatBossPanel` (portrait no longer sits in a solid `PANEL_STYLE`
   rectangle). Reuses `CombatBossPanel`'s existing damage-pulse +
   `HP_SOCKET_COUNT` logic — just repositions it inside the arch.
2. **nz8-b — Hand → `CardTemplate`.** Rewrite `CombatHand.tsx` to map each
   card to `<button><CardTemplate card={card} illustrationSize={96} ... /></button>`
   (pattern: `Hand.tsx`). Removes the custom `CARD_BUTTON_STYLE` /
   `ART_WRAPPER_STYLE` / `combatSummaryTextFor` inline layout. Preserves
   the `combat-hand-slot-${idx}-*` testid contract (covered by
   `CombatHand.test.tsx` — any testid drift must update the tests + any
   Playwright journey).
3. **nz8-c — Battlefield → `CardTemplate`.** Rewrite
   `CombatBattlefield.tsx` to render each `BattlefieldCard` as a
   `CardTemplate` with an `hp N/M` chip overlaid (top-right) or appended
   (below the rules box). Removes the flat `CARD_STYLE` tile and the
   manual name/illustration composition.
4. **nz8-d — Full-viewport backdrop + arena composition.** Moves the zone
   raster out of `BACKGROUND_SLOT_STYLE` and into a `combat-bg`
   absolute-fill layer behind the arena. Deletes the three panels' solid
   background colors (`--hc-shadow-500/600/700`); each child either renders
   transparent or adopts a stained-glass border ornament only. Adds the
   readability vignette/scrim. Touches CSS on the three panel files + new
   shared layout CSS.

Each sub-bead is independently mergeable — `nz8-b` and `nz8-c` are pure
component swaps with test updates; `nz8-a` is a new-component addition;
`nz8-d` is the CSS/composition pass that ties them together.

## Test contract

- **Unit:** `CombatHand.test.tsx`, `CombatBattlefield.test.tsx`, and
  `CombatBossPanel.test.tsx` (the last becomes
  `CombatBossStage.test.tsx`) must continue to assert the same
  user-observable behaviors (play-card dispatch, HP readout, telegraph
  visibility, tap-target dimensions). Internal DOM structure changes are
  allowed; testids that external journeys depend on
  (`combat-hand-slot-${idx}`, `combat-boss-hp-bar`, etc.) must stay
  stable.
- **Integration:** `CombatScreen.test.tsx` full-flow tests
  (card-played → boss-turn → pass-turn) must still pass against the
  restructured DOM.
- **Visual:** `tools/playtester/visual-combat-*.spec.ts` will fail
  expectedly on the layout change. Snapshot refresh requires designer
  sign-off per `bd memories visual-combat`.

## Art throughput (REQ-30)

**Zero new rasters required** for this redesign. Every art surface touched
(zone backdrops, boss portraits, card illustrations, chest illustrations)
is already wired. The stained-glass arch for `CombatBossStage` is vector
(reusing the existing `BossAltarPane` ornament language); no raster
budget is consumed.

## Open questions

None blocking implementation. If the 256px boss portrait crowds the
screen on very narrow viewports (mobile portrait), `nz8-a` may need to
scale responsively via CSS `min(256px, 40vh)` — deferred to implementation
time because the exact breakpoint depends on how the new `combat-bg`
layer + vignette look side-by-side with the 1.5× portrait.
