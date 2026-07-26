# Embertide

A family deckbuilding card game for the browser, published as **Realm Ascension** and playable at [sjarmak.ai/games/embertide](https://sjarmak.ai/games/embertide/).

Embertide is a 2-4 player (plus solo-vs-bot) deckbuilder in the tradition of Ascension: draw five, play your hand, buy from a shared face-up market, first to the victory condition wins. It is built for hotseat play on a single device with an iPad-first touch UX, and it ships two rule sets from one codebase:

- **Kid Mode** (default): a structural subset a six-year-old can play unassisted after a two-minute teach. Target session: 15 minutes.
- **Family Mode** (toggle): the full card pool and victory math. Target session: 20 minutes.

The signature moment in both modes is opening a treasure chest with a hard-earned key.

## Why it exists

The game was designed for a specific player: a six-year-old who finds standard deckbuilder card text, abstract currencies, and victory-point math impenetrable. The design ran through a diverge, converge, premortem pipeline before any code; the resulting PRD ([prd_embertide.md](prd_embertide.md)) and risk analysis ([premortem_embertide.md](premortem_embertide.md)) live in the repo, including the four Critical/High risks the premortem surfaced and the mitigations that shaped v0.1 (Kid Mode as the default subset rather than a UI reveal, six specific balance number fixes, a vertical-slice-first build order).

## Stack

TypeScript, React 19, Zustand, Framer Motion, Vite 6. Vitest for unit tests, Playwright for end-to-end and accessibility tests, Ladle for component stories.

## Getting started

Requires Node 20 (the CI baseline).

```bash
npm ci
npm run dev        # Vite dev server
```

Other everyday commands:

```bash
npm run test           # Vitest in watch mode
npm run test:coverage  # one-shot run with coverage (ratchet thresholds in vite.config.ts)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, zero warnings allowed
npm run ladle          # component story browser
npm run build          # production build (runs scripts/check-deploy.mjs first)
```

## Quality gates

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every push and PR: typecheck, unit tests with a coverage ratchet, ESLint (including tests for the custom rules in `tools/eslint-rules/`), Prettier, a design-token mirror check (`verify:tokens` plus Stylelint token enforcement), the production build, a no-placeholders sweep of `dist/`, and an accessibility harness. The APCA contrast matrix (`a11y:contrast`) and axe-core smoke test (`a11y:axe`) are blocking; the chest-reveal and ambient-board FPS checks (`perf:motion`, `perf:ambient`) are warn-only.

## Automated playtester

`tools/playtester/` holds a Playwright-driven agent that actually plays the game: it boots its own dev server on port 6174, runs scenarios such as "greedy policy reaches a combat terminal state within 30 rounds" and "pacifist policy loses gracefully with no hangs", and fails on dispatch or UI regressions before a human playtest.

```bash
npm run playtest            # fast pass/fail gate
npm run playtest:narrate    # same run, plus markdown reports with screenshots
```

See [docs/playtester-guide.md](docs/playtester-guide.md) for scenario details and report format.

## Deployment

The live game is served by the [website](https://github.com/sjarmak/website) repo (Astro, deployed on Render) as a committed build copy under `public/games/embertide/`. This repo regenerates that copy:

```bash
npm run deploy:site
```

That runs `build:web` (a Vite build with base `/games/embertide/`) and rsyncs `dist/` into a sibling `../website` checkout (override the target with `SITE_GAMES_DIR`). The script refuses to run if the website checkout is missing, and it never pushes; reviewing and committing the website repo is the manual step that triggers the deploy.

## Repository layout

```
src/            game code: core rules, store, ui, balance, motion, theme
tests/e2e/      Playwright a11y and perf specs
tools/          playtester agent, custom ESLint rules, token extraction
scripts/        deploy, verification gates, and the card-art pipeline
docs/           playtester guide, art governance, design notes
architecture/   LikeC4 model (model.c4, views.c4, deployment.c4)
```

The card art is generated locally: `scripts/` includes ComfyUI workflows, fal.ai generation, and chroma-key cleanup tooling for producing and post-processing illustrations.

The architecture model renders via the `likec4-pages.yml` workflow.

## Status

v0.1.0. The game is playable at [sjarmak.ai/games/embertide](https://sjarmak.ai/games/embertide/), with Kid Mode as the shipping default. Per the PRD, extraction of the rules engine into a pure-TypeScript package is deferred to v0.2.

## Related

- [website](https://github.com/sjarmak/website): the Astro site that hosts the deployed build.
