# Embertide

A Aurelia-themed single-player deck-builder (Slay-the-Spire / Ascension lineage) that runs entirely in the browser: React 19 + Zustand 5 + Vite, no backend. Package name is `realm-ascension`; "Embertide" is the working title. Target player includes a 6-year-old, so readability and accessibility are first-class constraints, not polish. Issue tracker: bd (beads) — run `bd prime` for the workflow.

Standing collaboration rules: `~/.claude/rules/common/agent-collaboration.md`.

## Orientation (fetch on demand, don't duplicate here)

Skills hold the live, detailed reference. Read the relevant one before touching that surface — they are kept current, this file is not:

- `embertide-codebase-map` — where state/rules/UI/art live, full build/test/playtest command list, oversized-file landmines. **Read first on any `src/` bead.**
- `embertide-designer` — Aurelia-canon + balance rulings (rosters, zone mechanics, boss patterns, tone). Durable rulings are saved as `bd memories embertide-designer-ruling-*`.
- `embertide-ui-reviewer` — Elysian Cathedral design system, `--hc-*` token contract, art-governance review.
- `embertide-playtester` — Playwright playtest scenarios for tuning questions (snowball, pacing, difficulty spikes).
- `docs/design/elysian-cathedral/` — visual design system. `docs/art-governance.md` — the 4-artifact rule. `docs/consolidated-rules-ref.md` — game rules reference.

## Don't (each line names the failure mode it prevents)

bd / worktrees:

- Don't run any `bd` command in a `.claude/worktrees/*` worktree before running `bash scripts/bd-worktree-redirect.sh` → bd defaults to per-project mode (the gitignored Dolt state isn't checked out) and can't reach the server. The helper is idempotent and a no-op in the main worktree. Smoke test: `bash scripts/bd-worktree-redirect.test.sh`.
- Don't write `HANDOFF.md` or any flat-file handoff → parallel agents race and overwrite each other's context. Use `bd remember "<insight>"`; read back with `bd memories <keyword>`. Session-handoff surfaces already exist: `bd ready`, `git log --oneline -10`, `bd memories`.
- Don't track work in TodoWrite / markdown TODO lists → use `bd` for all task tracking.

State & logic boundaries:

- Don't import from `src/store/` inside `src/core/` or `src/rules/` → those are pure resolvers; state flows in via params, out via return values. Breaking this couples the engine to the store and kills testability.
- Don't mutate state in place → Zustand actions return new objects (`set((s) => ({ ...s, ... }))`). Mutation causes stale-render and hidden-coupling bugs.
- Don't pile more into the flagged oversized files (`gameStore.ts`, `data/cards.ts`, `combatEngine.ts`, etc.) → they're past the 800-line ceiling with split beads in flight; add a new file alongside instead. Search beads for "refactor" before opening a redundant split.

Visual / canon:

- Don't write raw hex colors in CSS or inline styles → every color is a `--hc-*` custom property from `src/styles/tokens.css`; stylelint enforces it. `src/theme/tokens.ts` is generated — don't hand-edit it.
- Don't reintroduce tutorial popups → the designer cut them permanently (the `src/tutorial/` dir is legacy; treat as dead unless a bead explicitly revives it).
- Don't ship roster / mechanic / tone changes without checking `embertide-designer` rulings → tone bar is Aurelia canon as Nintendo shipped it (no separate kid-tone softening, user ruling 2026-05-02).

## Do (concrete point targets)

- Build/dev: `npm run dev` (port 5173), `npm run build` (runs `scripts/check-deploy.mjs` prebuild gate), `npm run typecheck`, `npm run lint`.
- Tests: `npm run test:ci` (full vitest run), `npm run test:balance` (sims), `npm run test:rules` (custom eslint-rule self-tests). Tests live next to source (`Foo.tsx` ↔ `Foo.test.tsx`).
- A11y / perf gates: `npm run a11y:contrast`, `npm run a11y:axe`, `npm run perf:motion`, `npm run perf:ambient`, `npm run lint:tokens`, `npm run verify:tokens`.
- Playtest: `pnpm playtest` (pass/fail) or `pnpm playtest:narrate` (reports → `docs/playtest-reports/`). Harness runs on port 6174 to avoid colliding with dev (5173) / preview (4173).
- Component review: `npm run ladle`.

## Layout

```
src/store/        gameStore.ts (single source of truth) + slices/ (one per concern)
src/core/         pure resolvers (combatEngine.ts) — no store imports
src/rules/        constants & lookup tables (zones.ts → ZONE_METADATA)
src/balance/      balance helpers + greedy-shard sims
src/data/         declarative card/creature tables (cards.ts)
src/ui/           flat component tree (no src/components/), paired *.test.tsx
src/styles/       tokens.css (--hc-* source of truth)
src/illustration/ vector art + ornament path generators
src/icons/ src/motion/ src/theme/   icons, framer-motion variants, generated tokens
tools/playtester/ Playwright playtest harness
tools/eslint-rules/  project-specific lints
scripts/          build gate, token verify, bd-worktree-redirect.sh
docs/             design system, art-governance, consolidated rules ref
```
