# Architecture diagram (LikeC4)

Architecture-as-code model of `embertide`, rendered with
[LikeC4](https://likec4.dev). The model is the source of truth across
[`spec.c4`](spec.c4) (element kinds, tags, deployment node kinds),
[`model.c4`](model.c4) (the system), and [`views.c4`](views.c4) (structure,
walkthrough, and delivery-state views), with the deployment model in
[`deployment.c4`](deployment.c4). The narrative companions are the repo-root
[`prd_embertide.md`](../prd_embertide.md), [`premortem_embertide.md`](../premortem_embertide.md),
and the conventions in [`AGENTS.md`](../AGENTS.md).

Ember Tide is a backend-free, single-screen cooperative deck-builder: React 19 +
Zustand + Vite compiled to a static bundle, state in memory only, no accounts and
no tracking. Two-to-four players (or one player vs the bot) share one board, buy
from a common market, and fight the bosses guarding each zone — win or lose
together. The design target is unusual and drives the architecture: the game has
to be legible and playable by a six-year-old, so contrast, 44px tap targets, and
non-clipping rules text are correctness properties enforced by automated gates,
not polish.

The model captures the clean spine the codebase is built on: declarative
**content** data (`src/data`) → a pure-TS **rules engine** (`src/core` +
`src/rules`, combat and economy as functions over explicit state, no store
imports) → a Zustand **store** kept at the edges (`src/store`) → a React **board**
that only renders and dispatches (`src/ui`). Off to the side sit the
stained-glass **art** pipeline (a deterministic SVG composer plus reproducible
fal.ai raster panels), the **quality gates** (balance simulations + accessibility
+ Playwright e2e), and the Vite **build** with its local-only deploy guard.

Every element `link`s to its source (`src/…`, `scripts/…`) so any box in the
explorer is one click from the code.

## Delivery state is tagged, not guessed

Every element carries a tag so experimental / planned work renders distinctly
from what is shipped and playable in the v0.1 Kid Mode build (legend in
`spec.c4`):

| Tag | Meaning | Render |
|---|---|---|
| `#built` | shipped in v0.1, exercised on every run | solid |
| `#evolving` | shipped, but the contract / surface is still moving | solid amber |
| `#planned` | designed (PRD / premortem), not yet implemented | **dashed, dimmed** |
| `#research` | dev-time / opt-in tooling (art generation), not in the runtime path | **dashed, indigo** |

The shipped spine — content, the pure engine, the store, the React board, the
balance + accessibility gates, and the Vite build — is `#built`. `#evolving`
items: the art pipeline surface, the tutorial store/bubbles, and the e2e
harness. `#research`: the fal.ai raster-generation scripts, which run only at
dev time. `#planned`: local save/resume (IndexedDB, PRD item SH-5).

## Views

**Structure** — the static map:

| View | Scope |
|---|---|
| `index` | system landscape — Ember Tide in context of the players, fal.ai, GitHub, and the website that serves it |
| `embertideSystem` | the system decomposed into containers (content → engine → store → UI, plus art, gates, and build) |
| `engineContainer` | the pure resolver — combat turn reducer, player + boss phases, and the economy/world rules |
| `storeContainer` | the Zustand store — root reducer, domain slices, and the tutorial store |
| `uiContainer` | the React board — shell + setup, combat overlay, field/hand/chests, card rendering, tutorial |
| `artContainer` | the stained-glass pipeline — SVG composer + templates, renderer, and dev-time fal.ai raster generation |
| `gatesContainer` | the quality gates — balance simulation, contrast/token gate, and Playwright e2e |
| `deployment` | where each piece runs — the browser tab, the local build machine, GitHub Actions/Pages, fal.ai, the website edge |

**Walkthrough flows** (dynamic / numbered-step views):

| View | Flow |
|---|---|
| `playFlow` | a tap → dispatch → pure engine resolve → new state → re-render |
| `artFlow` | a committed fal.ai prompt → offline raster panel → composer-SVG-or-raster at render |
| `gateFlow` | balance + accessibility gates → vite build (local-only guard) → served at `/games/embertide/` |

**Delivery-state lens:**

| View | Scope |
|---|---|
| `movingParts` | the `#evolving` / `#research` / `#planned` surfaces, with the shipped spine dimmed |

### Running the walkthrough

For a review, present in this order: `index` → `embertideSystem` (orient on
structure) → the three walkthrough flows (play → art → gates, what actually
happens) → `deployment` (where it runs) → `movingParts` (what's moving / opt-in /
planned). In `npx likec4 start`, the dynamic views animate step-by-step.

## Viewing & regenerating

```bash
# Interactive, hot-reloading explorer (recommended)
npx likec4 start architecture

# Re-export the static PNGs (needs a one-time browser download:
#   npx playwright install chromium-headless-shell)
npx likec4 export png architecture -o architecture/exports

# Validate the model (strict — the source of truth for correctness)
npx likec4 validate architecture
```

The published site (figures + interactive explorer + a landing page matched to
the sjarmak.ai design system) is built by
[`.github/workflows/likec4-pages.yml`](../.github/workflows/likec4-pages.yml) on
any push that touches `architecture/**`, and served at
<https://sjarmak.github.io/embertide/>.
