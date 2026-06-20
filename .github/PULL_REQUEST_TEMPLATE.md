<!--
  Embertide PR template.

  Delete any section that's genuinely not applicable, but do not delete the
  Art surfaces section if your PR introduces or modifies a visual surface —
  leaving it unchecked is how PR reviewers catch pipeline drift.
-->

## Summary

<!-- 1–3 sentences. What changed and why. Link the REQ or bead. -->

## Changes

<!-- Short bulleted list of the notable code or content changes. -->

-

## Art surfaces

<!--
  Required for any PR that introduces or modifies a visual surface. See
  docs/art-governance.md for the full contract. For each box, check it if the
  artifact is finalized; leave unchecked and use <ArtPendingFrame /> +
  link the follow-up bead if the artifact is still pending.
-->

- [ ] **Vector paths** — frame/ornament path data declared (or N/A)
- [ ] **Raster prompts** — finalized `src/illustration/examples/*.json` (or `[v2-art-pending]`)
- [ ] **Icon glyphs** — `src/icons/*.tsx` glyph finalized (or N/A)
- [ ] **`--hc-*` color tokens** — any new token is in `src/styles/tokens.css` and passes `npm run verify:tokens` (or N/A)

Follow-up beads for any `[v2-art-pending]` surfaces:

<!-- e.g. - bd-123: finalize raster for Wild-Boss Hill-Brute -->

## Test plan

- [ ] `npm run test:ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] Additional (E2E, balance simulation, etc.):

## Risk / rollback

<!-- What's the blast radius if this ships wrong, and how do we roll back? -->
