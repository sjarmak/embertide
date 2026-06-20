# PRD: Embertide v2.1 — Boss Fight & Combat Art Pass

> **Source of truth**: this PRD scopes the v2.1 visual polish track for the boss fight area + combat screen. Canonical epic: `embertide-4m5` (EPIC: UI art + graphics polish track). Related: `embertide-m6l` (P3, v2.1 combat-screen background raster). Parent PRD: `docs/prd/embertide-v2.md`. Predecessor extracts: `docs/prd/embertide-v2-1-combat.md` (REQ-31 / u-8 DAG, LANDED) + `docs/prd/embertide-v2-1-wild-boss-slot.md` (REQ-32 / u-9 DAG, LANDED).
> **Scope instruction for `/prd-build`**: decompose the u-10 DAG defined in §D10 below. REQ-31 + REQ-32 are both already landed on `prd-build/embertide-v2-1-wild-boss-slot` — this build sits on top of them and does NOT revisit reducers, selectors, or tests outside the art-integration surface.

## Background

REQ-31 (u-8) shipped the MTG-style combat sub-state with a minimal UI: boss portrait slot populated by existing `cathedral_monster_*_001.webp` rasters, combat background is an `ArtPendingFrame` placeholder with a dashed `var(--hc-lead-gold-700)` border and solid `var(--hc-shadow-900)` fill. REQ-32 (u-9) added the wild/region boss encounter altars under Princess Crystal, but those altars are pure CSS — stained-glass pane + ember-glow border, no ornamental raster.

The result: the most frequently viewed surfaces (combat screen during every boss fight, altar row on every turn) are functionally correct but visually the weakest parts of the app. The existing per-card raster art is the game's aesthetic anchor (cathedral theme, nano-banana-pro 2K webp); the boss fight area doesn't yet participate in that language.

**REQ-33** is the structural resolution: generate and wire the art assets that finish the "cathedral" treatment on the boss fight surfaces — per-zone combat arena backgrounds, ornamental altar frames, a bespoke Vurmox DESTINY backdrop, and richer chrome on the combat UI panels.

## Design decisions (resolved 2026-04-21, designer absent — reasonable defaults)

| # | Question | Decision |
|---|---|---|
| 1 | Art style | Match existing "cathedral" theme (grep `cathedral_*` in public/illustrations). 2K webp, nano-banana-pro style, same palette family as `cathedral_monster_*`. |
| 2 | Combat backgrounds: one shared vs one per zone | One per zone (3 total: Sylvani forest interior, Emberpeak cavern, Gilded Cage sanctum). Zone-aware selection via `state.currentZone`. |
| 3 | Altar ornament source | Raster overlay layered on top of existing stained-glass CSS pane. Don't replace the CSS pane — enrich it. Keeps the BossAltarPane primitive working without art and lets b56 absorb the variant later. |
| 4 | Wild vs region altar ornaments | Two SHARED ornament rasters (one for wild variant, one for region variant) — NOT per-boss. Boss-specific art lives in the portrait inside the altar, not the frame. |
| 5 | DESTINY slot treatment | Bespoke Vurmox-specific backdrop raster + gold-flame mandala CSS overlay. Distinct from regional altars visually. |
| 6 | Combat UI chrome (panels) | Ornate CSS frame (brass-edge SVG or CSS-gradient border) around CombatBossPanel, CombatBattlefield, CombatHand. No raster for the frames — CSS/SVG keeps file weight down and scales cleanly. |
| 7 | Fallback behavior | When a raster is missing (404 / CORS / partial ship), fall back to existing `ArtPendingFrame` with no layout shift. Every surface must degrade gracefully. |
| 8 | File weight budget | Combat backgrounds: ≤200KB each (2K webp with mid-quality compression). Altar ornaments: ≤80KB each. Vurmox DESTINY: ≤250KB (bespoke detail warrants a higher budget). |
| 9 | Performance | Backgrounds use `loading="lazy"` + `decoding="async"`. CombatScreen preloads the current-zone background on first mount. No preload for altars (they're above the fold). |
| 10 | Tests | Visual-regression via Playwright screenshot assertions on key surfaces (combat screen per zone, altar row, DESTINY slot). Unit tests confirm raster src resolution per zone + fallback behavior. |

## Combat arena backgrounds (D1)

**Three zone-specific backdrops** rendered behind CombatScreen as a fixed-position background layer (inside CombatScreen, not document-level, so it doesn't leak outside combat):

| Zone | Filename | Scene |
|------|----------|-------|
| `sylvani` | `public/illustrations/cathedral_combat_bg_sylvani_001.webp` | Forest sanctum interior — ancient trees arching into stained-glass panels, dappled green light, mossy stone floor, faint Thornkin Tree silhouette in deep background |
| `emberpeak` | `public/illustrations/cathedral_combat_bg_emberpeak_001.webp` | Volcanic cathedral — lava-vein cracks in basalt walls, obsidian columns, distant forge glow, brimstone embers in air |
| `gilded-cage` | `public/illustrations/cathedral_combat_bg_gilded_cage_001.webp` | Gilded Cage sanctum — marble pillars, Emberblade pedestal silhouette, heavenly light shafts through Embertide-motif stained glass, ethereal blue-white atmosphere |

**Composition guidance**: all three should have a clear visual "stage" in the lower-center (where the boss portrait + battlefield sit) and darker/less-detailed peripheral areas (where card UI overlays). 2K (2048×1152) aspect 16:9. Dimmed contrast overall (30-40% luminance) so the UI stays legible.

**Schema addition**: extend `src/illustration/schema.ts` with an `IllustrationRole: 'combat-background'` union variant. Add matching example JSON at `src/illustration/examples/cathedral_combat_bg_*.json` documenting the prompt template used for generation.

**Wiring**: replace `BACKGROUND_SLOT_STYLE` in `src/ui/CombatScreen.tsx` with a selector-driven background that reads `state.currentZone` and resolves to the matching raster. Fallback to `ArtPendingFrame` if the raster is unavailable.

## Altar ornament overlays (D2)

Two shared ornament rasters layered on top of the stained-glass CSS pane:

| Variant | Filename | Design |
|---------|----------|--------|
| Wild | `public/illustrations/cathedral_altar_frame_wild_002.webp` | Carved stone arch with Embertide-of-Courage motif at apex, ivy creeping along the sides, two unlit torch sconces at the base (embers glow via CSS animation on the pane, not the raster) |
| Region | `public/illustrations/cathedral_altar_frame_region_001.webp` | Similar arch but heavier — darker stone, obsidian flourishes, Embertide-of-Power motif at apex, two LIT torches at base (ember animation stronger via CSS) |

**Resolution**: 1024×1536 (portrait, aspect 2:3) — matches the altar pane's approximate aspect. PNG with transparent background OR webp with alpha channel. The ornament is an OVERLAY, not a background — the existing stained-glass CSS shows through the ornament's openings.

**Wiring**: extend `BossAltarPane` (src/ui/BossAltarPane.tsx) with an optional `ornamentSrc` prop. When provided, render an `<img>` absolutely-positioned over the pane's existing stained-glass div, z-index above the CSS pane but below the child content (boss portrait, name, HP). Falls back to pane-without-ornament when `ornamentSrc` is undefined or the image fails to load.

Map variants to ornament src:
- `variant="wild"` → `cathedral_altar_frame_wild_002.webp`
- `variant="region"` → `cathedral_altar_frame_region_001.webp`
- `variant="destiny"` → resolved in D3 below (bespoke)

## DESTINY slot bespoke art (D3)

Vurmox's endgame slot gets a dedicated raster — not a shared altar frame:

| Asset | Filename | Design |
|-------|----------|--------|
| Backdrop | `public/illustrations/cathedral_altar_destiny_vurmox_001.webp` | Ornate obsidian-and-gold altar with Demon King silhouette carved into the back wall, purple-amethyst flame motifs, Embertide fragment inset at the top, skulls/dark relics at the base. Ceremonial, climactic. Resolution 1536×2304 (1.5× larger than standard altars to match VurmoxDestinySlot's 1.5× scale from u-9d). |

**CSS overlay** (on top of the raster): gold-flame mandala animation. Pure CSS (radial gradient + keyframe spin + conic-gradient for flame tongues). Spins slowly (8-10s cycle). Renders above the raster, below the boss portrait + HP text.

**Wiring**: `src/ui/VurmoxDestinySlot.tsx` passes `ornamentSrc="/illustrations/cathedral_altar_destiny_vurmox_001.webp"` to BossAltarPane AND adds a dedicated `.destiny-mandala` overlay div between the ornament and the children. The mandala CSS lives in BossAltarPane.css under a `[data-variant="destiny"]` selector block.

## Combat UI chrome upgrades (D4)

Ornate CSS/SVG frames around the existing combat panels. **NO new raster assets** — all CSS + inline SVG to keep payload tiny.

Panels to upgrade:
- `CombatBossPanel` — brass-edged frame with corner flourishes, HP bar gets a jeweled-socket treatment
- `CombatBattlefield` — a "stage" visual border (angled marble tiles, receding perspective illusion via CSS transform)
- `CombatHand` — a "scroll" or "book" bottom-edge treatment (curled parchment, subtle leather texture)

**Implementation**: CSS custom properties for all colors (match `--hc-*` token system established in the project). Each panel's frame is implemented via `::before` / `::after` pseudo-elements + inline SVG for corner flourishes (SVG can be embedded as CSS `background-image: url("data:image/svg+xml;utf8,...")`).

**Scope discipline**: if the full three-panel chrome set would bloat u-10e past 600 lines, ship just CombatBossPanel (the highest-visibility one) and record the remaining two as follow-on beads.

## Art generation pipeline (D5)

All rasters generated via the `fal-ai-media` skill (nano-banana-pro, 2K).

**Prompt template pattern** (from existing `cathedral_monster_*.json` schemas):
```
"Ornate cathedral-style [SUBJECT] illustration, dramatic lighting, stained glass accents, dark background, muted palette with gold and [ZONE_COLOR] highlights, mystical atmosphere, high detail, 2K resolution"
```

Per-asset prompts live in `src/illustration/examples/*.json` alongside the existing schemas. Each JSON documents:
- `id`: matches the webp filename
- `role`: new `combat-background` | `altar-frame` | `destiny-altar` union variant
- `prompt`: full nano-banana-pro prompt
- `palette`: zone-specific hue guidance
- `notes`: composition constraints (stage area, UI safe zones)

**Generation cost/quota**: 4 backgrounds + 2 altar frames + 1 DESTINY = 7 new rasters total. At nano-banana-pro 2K rates this is a manageable one-shot generation batch.

**Revision loop**: the generating agent may iterate up to 3× per raster if the first output doesn't match composition guidance (e.g. subject too centered, wrong palette). Budget cap: 21 generations across the build.

## Fallback & degradation (D6)

- Missing raster → `ArtPendingFrame` (existing component) renders at same dimensions. No layout shift.
- Slow-loading raster → render `ArtPendingFrame` for the first 200ms, swap in raster when `onLoad` fires. Prevents placeholder-flash on fast connections while still handling slow ones.
- 404 / decode error → permanent `ArtPendingFrame` fallback for that session; logged to `console.warn` once per asset (not per render).

## Tests + gates (D7)

**Unit tests**:
- `src/ui/BossAltarPane.test.tsx`: new tests for `ornamentSrc` prop — renders `<img>` when provided, omits when undefined, falls back on error.
- `src/ui/CombatScreen.test.tsx`: extend with zone-aware background resolution test (mock `state.currentZone`, assert correct `src`).
- `src/ui/VurmoxDestinySlot.test.tsx`: extend with DESTINY ornament + mandala overlay presence.
- `src/illustration/schema.test.ts`: validate new schema variants parse correctly.

**Visual regression** (new):
- `tools/playtester/visual-combat-sylvani.spec.ts` — screenshot CombatScreen in Sylvani, diff against committed baseline.
- `tools/playtester/visual-combat-emberpeak.spec.ts` — same for Emberpeak.
- `tools/playtester/visual-combat-temple.spec.ts` — same for Gilded Cage.
- `tools/playtester/visual-altar-row.spec.ts` — screenshot boss altar row under Princess Crystal.
- `tools/playtester/visual-destiny-slot.spec.ts` — screenshot VurmoxDestinySlot.

Baseline screenshots commit into `tools/playtester/__snapshots__/`. First-run establishes baselines; subsequent runs assert pixel-diff within tolerance (~2% pixel difference allowed to accommodate font rendering variance across environments).

**Gates**:
- `pnpm typecheck` 0 errors
- `pnpm lint` 0 warnings
- `pnpm test --run` all tests pass (baseline: 1031 post-Vurmox-retune; target +12-15 new)
- `pnpm playtest` all scenarios pass (baseline: 6; target +5)
- File sizes under budget (D0-9)

## Assets shipping checklist (D8)

Committed under `public/illustrations/`:
- [ ] cathedral_combat_bg_sylvani_001.webp (≤200KB)
- [ ] cathedral_combat_bg_emberpeak_001.webp (≤200KB)
- [ ] cathedral_combat_bg_gilded_cage_001.webp (≤200KB)
- [ ] cathedral_altar_frame_wild_002.webp (≤80KB, alpha)
- [ ] cathedral_altar_frame_region_001.webp (≤80KB, alpha)
- [ ] cathedral_altar_destiny_vurmox_001.webp (≤250KB, alpha)

Committed under `src/illustration/examples/`:
- [ ] cathedral_combat_bg_sylvani.json
- [ ] cathedral_combat_bg_emberpeak.json
- [ ] cathedral_combat_bg_gilded_cage.json
- [ ] cathedral_altar_frame_wild.json
- [ ] cathedral_altar_frame_region.json
- [ ] cathedral_altar_destiny_vurmox.json

## Work-unit DAG (D10) — decomposition input

Each unit targets ≤600 lines diff, ≤8 files. All units sit on top of u-8/u-9 (landed).

### u-10a — Art scaffolding (MEDIUM)
**Scope**: `src/illustration/schema.ts`, `src/ui/BossAltarPane.tsx`, `src/ui/BossAltarPane.css`, `src/ui/CombatScreen.tsx`, `src/ui/ArtPendingFrame.tsx` (extension only — existing behavior preserved).
**Deps**: none (Layer 0).
**Description**: Extend `IllustrationRole` union in src/illustration/schema.ts with `'combat-background' | 'altar-frame' | 'destiny-altar'` variants. Add `ornamentSrc?: string` prop to BossAltarPane — renders an `<img>` absolutely-positioned over the stained-glass div (z-index above pane, below children). Extend CombatScreen with a `backgroundSrc` resolver (reads state.currentZone) and replaces BACKGROUND_SLOT_STYLE's placeholder with a raster-or-fallback layer. Implement missing-raster graceful degradation per §D6.
**Acceptance**:
- `IllustrationRole` union in src/illustration/schema.ts includes `'combat-background'`, `'altar-frame'`, `'destiny-altar'`
- `BossAltarPane` accepts optional `ornamentSrc: string` prop; when provided renders `<img src={ornamentSrc}>` absolutely-positioned over pane, z-index above the pane's stained-glass but below children
- When `ornamentSrc` is undefined, BossAltarPane renders identically to the pre-u-10a behavior (u-9d regression safety)
- `img.onerror` logs once via `console.warn` and keeps the pane render intact (no broken-image icon)
- `CombatScreen` reads `state.currentZone` and resolves `backgroundSrc` from a per-zone map (sylvani/emberpeak/gilded-cage). When the raster is unavailable or fails to load, falls back to ArtPendingFrame at the same dimensions with no layout shift
- Unit tests: 4+ new tests covering ornament presence/absence + error fallback, combat background zone resolution, schema role validation
- pnpm typecheck 0 errors, pnpm lint 0 warnings, pnpm test passes (baseline 1031 + 4+ new)

### u-10b — Combat arena backgrounds (MEDIUM)
**Scope**: `public/illustrations/cathedral_combat_bg_*.webp` (3 rasters, new), `src/illustration/examples/cathedral_combat_bg_*.json` (3 schemas, new), `src/ui/CombatScreen.tsx` (zone-to-src map), `src/ui/CombatScreen.test.tsx`.
**Deps**: u-10a.
**Description**: Generate 3 zone-specific 2K combat backgrounds via fal-ai-media nano-banana-pro per §D1 design guidance. Commit the webp files + matching JSON schemas. Wire the zone-to-src map in CombatScreen. Add visual-regression Playwright scenario per zone.
**Acceptance**:
- 3 webp files committed under `public/illustrations/` — each ≤200KB, 2K (2048×1152 or comparable aspect), dimmed overall contrast to keep UI legible
- 3 JSON schemas committed under `src/illustration/examples/` with role=`combat-background`, full prompt text, zone palette notes
- CombatScreen renders the matching background when `state.currentZone` is set; correctly handles zone transitions (swap background when zone advances)
- 3 new Playwright scenarios under `tools/playtester/visual-combat-*.spec.ts` screenshot CombatScreen in each zone and assert against a committed baseline under `tools/playtester/__snapshots__/`
- First-run establishes baselines; subsequent runs assert ±2% pixel tolerance
- pnpm typecheck 0 errors, pnpm lint 0 warnings, pnpm test passes, pnpm playtest passes (baseline 6 + 3 new)

### u-10c — Altar ornament overlays (MEDIUM)
**Scope**: `public/illustrations/cathedral_altar_frame_*.webp` (2 rasters, new), `src/illustration/examples/cathedral_altar_frame_*.json` (2 schemas, new), `src/ui/BossAltarPane.tsx` (variant-to-src map), `src/ui/WildBossEncounterSlot.tsx`, `src/ui/RegionBossEncounterSlot.tsx`, `src/ui/BossAltarPane.test.tsx`.
**Deps**: u-10a.
**Description**: Generate 2 shared altar ornament rasters per §D2. Commit webp + JSON schemas. Wire `ornamentSrc` into BossAltarPane via a variant→src map (`wild` → wild frame, `region` → region frame). Update WildBossEncounterSlot + RegionBossEncounterSlot to pass their respective variant. Add visual-regression Playwright scenario for the altar row.
**Acceptance**:
- 2 webp files committed — each ≤80KB with alpha channel, portrait aspect ~2:3, matches altar pane composition
- 2 JSON schemas committed with role=`altar-frame`
- BossAltarPane's variant-to-src map resolves correctly for 'wild' and 'region'; 'destiny' remains unset here (u-10d wires that)
- WildBossEncounterSlot + RegionBossEncounterSlot render with ornament overlay visible above stained-glass, below boss portrait
- When boss is defeated (cleared state), ornament still renders (desaturated via CSS)
- 1 new Playwright scenario screenshots the altar row in Sylvani — asserts against baseline
- pnpm typecheck 0 errors, pnpm lint 0 warnings, pnpm test passes, pnpm playtest passes

### u-10d — DESTINY slot bespoke art (SMALL)
**Scope**: `public/illustrations/cathedral_altar_destiny_vurmox_001.webp` (1 raster, new), `src/illustration/examples/cathedral_altar_destiny_vurmox.json`, `src/ui/BossAltarPane.css` (destiny variant extension), `src/ui/VurmoxDestinySlot.tsx`, `src/ui/VurmoxDestinySlot.test.tsx`.
**Deps**: u-10a, u-10c.
**Description**: Generate the bespoke Vurmox DESTINY backdrop per §D3. Commit webp + JSON schema. Add `[data-variant="destiny"]` CSS block in BossAltarPane.css with the gold-flame mandala animation (8-10s rotation cycle, pure CSS). Wire VurmoxDestinySlot to pass the destiny ornament src. Add Playwright scenario.
**Acceptance**:
- 1 webp committed — ≤250KB with alpha, 1536×2304 portrait, bespoke Vurmox obsidian-gold composition
- 1 JSON schema committed with role=`destiny-altar`
- BossAltarPane.css includes a `[data-variant="destiny"]` rule block with the gold-flame mandala overlay (radial gradient + conic-gradient + keyframes spin, 8-10s cycle)
- VurmoxDestinySlot renders with the destiny backdrop raster AND the CSS mandala overlay
- 1 new Playwright scenario screenshots the DESTINY slot — asserts against baseline (use a debug seed where Sentinel + Silver Chimera are pre-defeated)
- pnpm typecheck 0 errors, pnpm lint 0 warnings, pnpm test passes, pnpm playtest passes

### u-10e — Combat UI chrome (MEDIUM)
**Scope**: `src/ui/CombatBossPanel.tsx` (+ colocated .css if exists), `src/ui/CombatBattlefield.tsx`, `src/ui/CombatHand.tsx`, `src/styles/app.css` (if chrome styles live there), component tests.
**Deps**: u-10a, u-10b.
**Description**: Add ornate CSS/SVG frames to the three combat panels per §D4. NO new raster assets. All color values via `--hc-*` custom properties. If shipping the full 3-panel set would bloat the diff past 600 lines, prioritize CombatBossPanel (highest visibility) and file the remaining two as follow-on beads.
**Acceptance**:
- CombatBossPanel has an ornate frame with brass-edge border + corner flourishes; HP bar has jeweled-socket styling
- CombatBattlefield has a stage-like border (at minimum — perspective illusion optional if it would bloat scope)
- CombatHand has a parchment/leather bottom-edge treatment
- All colors reference `--hc-*` tokens; no hardcoded hex values outside the established `--hc-*` family
- Corner flourishes implemented as inline SVG (data URIs in CSS are acceptable)
- If any panel is deferred, a bead is filed and the deferral is documented in plan-u-10e.md
- pnpm typecheck 0 errors, pnpm lint 0 warnings, pnpm test passes (baseline + any new component tests)

## Dependencies graph

```
u-10a (scaffolding) ──┬─► u-10b (combat backgrounds) ──► u-10e (combat UI chrome)
                      └─► u-10c (altar ornaments) ────► u-10d (DESTINY)
```

5 units across 3 layers. Parallelism: u-10b + u-10c run in parallel on Layer 1; u-10d + u-10e run in parallel on Layer 2.

## Out of scope (flagged for follow-on beads)

- Combat cinematics / transition animations on WIN/LOSS → new bead if designer wants.
- Boss-specific altar frames (per-boss rather than per-variant) → intentionally excluded per §D4 design decision.
- Zone map art upgrades (the pre-combat board itself) → separate art pass — this PRD focuses on boss-fight surfaces only.
- Audio / SFX for the altar tap + combat entry → entirely separate track.
- Particle effects for spell/attack cards in CombatHand → if desired, new bead.
- Mobile-specific viewport adjustments → out of scope; desktop-first.
