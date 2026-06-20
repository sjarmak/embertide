# Art Throughput Governance (REQ-30)

> Process discipline that bounds v2 visual consistency against the realities of our
> art pipeline. This document is required reading for any REQ that introduces a new
> visual surface, and is cited by the PR checklist in `.github/PULL_REQUEST_TEMPLATE.md`.

## Why this exists

Embertide v2 expands the visual surface area (HP shards, Embertide strips,
champion slots, wild-boss cells, region-boss cells, per-zone enemy rosters,
item cells, new chest frames). In an agent-era build the bottleneck isn't
calendar-time throughput — it's *designer-review bandwidth*: the human designer
reviews and signs off on what ships, and each review pass is the real budget.
If we ship surfaces whose art isn't yet reviewable, the game either looks
inconsistent or blocks on review. We solve that with an **explicit artifact
declaration per surface and a placeholder contract.**

## The four artifact categories

Every new visual surface that ships must declare, in its PR description, what
exists now in each of these four categories. The declaration is a 4-box
checklist (see `.github/PULL_REQUEST_TEMPLATE.md`).

1. **Vector paths** — the frame, ornament, and background scaffolding rendered
   by `src/illustration/ornament.ts` and its siblings. Path `d=""` strings,
   geometry, layer order.
2. **Raster prompts** — the interior cell image. Lives under
   `src/illustration/examples/*.json`. If raster isn't finalized yet, declare
   it as `[v2-art-pending]` (see below).
3. **Icon glyphs** — small UI icons rendered by `src/icons/*.tsx`. Always
   vector; shares the `--hc-*` palette.
4. **`--hc-*` color tokens** — any new color, if introduced, must land in
   `src/styles/tokens.css` first and pass `npm run verify:tokens`.

A surface is allowed to ship with only 1–3 of the 4 finalized, provided the
missing categories use the `[v2-art-pending]` placeholder contract below.
**A surface is not allowed to ship with any category silently unfinished.**

## First-pass posture: attempt production quality eagerly

**The default for any new visual surface is to attempt production-quality art
on the first implementation pass.** Agents generate finalized vector + raster
candidates eagerly so the designer has something concrete to review in the
shortest possible iteration cycle. A concrete-but-imperfect raster is more
reviewable than a ribbon-wrapped placeholder.

Use `<ArtPendingFrame>` (see below) only when the first-pass output isn't
review-quality yet — not as the default state.

## The `[v2-art-pending]` contract (fallback only)

When a surface's first-pass art doesn't reach reviewable quality (e.g., the
raster prompt produced an inconsistent result that can't be patched in one more
pass), the surface renders through `<ArtPendingFrame />` (from
`src/ui/ArtPendingFrame.tsx`). That component overlays a pinned ribbon with
the text `[v2-art-pending]`, so anyone viewing the build can see at a glance
which surfaces are still awaiting HC-grade art. The placeholder:

- Is visually unmistakable (high-contrast ribbon, not subtle).
- Does not block gameplay — it's purely a visual marker.
- Is removed when the art artifact is finalized.

Any PR that ships a surface with `<ArtPendingFrame />` must reference
the **follow-up bead** that tracks finalization of that surface.

## Drift detection (agent-era, no time-based freeze)

This is an agent-driven build — calendar-time throughput limits do not apply.
See PRD §A11 for the full reinterpretation. The governance here is **structural,
not temporal**: drift is detected by unpaired surfaces, not by weeks elapsed.

### The unpaired-surface rule

Every visual surface that ships must be in one of two states:

1. **Finalized** — all four artifact categories declared present and committed.
2. **Paired-pending** — wrapped in `<ArtPendingFrame followUpBeadId="..." />`
   AND accompanied by a follow-up bead (via `bd create`) whose single scope is
   to finalize this surface's missing artifact(s).

**There is no third option.** A surface that is neither finalized nor
paired-pending is a drift bug — the PR reviewer must request changes.

### Iteration accountability

Instead of a weekly audit, drift is caught per **designer-review iteration**:

- When the designer reviews a unit, any `[v2-art-pending]` surface on that unit
  must have its follow-up bead visible and estimated. If the bead is missing or
  stale (no update across 3 review iterations), the surface is re-raised for
  finalization or re-scope.
- Backlogs of paired-pending surfaces do not "freeze" further work — they just
  accumulate as technical debt surfaced in the bead list. The designer
  (collaborating with agents) decides when to prioritize finalization batches.

### What counts as a finalized cell

Unchanged from the original framing:

- A new finalized raster (`src/illustration/examples/*.json`) for a card or
  narrative surface.
- A new finalized ornament frame (`src/illustration/ornament.ts`).
- A new finalized icon glyph (`src/icons/*.tsx`).

A tweak to an existing finalized cell (polish, contrast, palette drift fix) is
maintenance — it's tracked via its own bead, not as net-new content.

## PR reviewer responsibilities

Before approving a PR that introduces a visual surface:

- Verify the PR description has the 4-artifact checklist filled out.
- Verify any missing category uses `[v2-art-pending]` and links a follow-up
  bead.
- Verify no new colors were introduced outside `src/styles/tokens.css`.
- Run `npm run verify:tokens` locally or in CI.

If any of the above is missing, request changes. No exceptions — the
placeholder contract is the only mechanism that keeps the art pipeline from
silently falling behind.
