# Playtester Guide

> Status: v1.0 — starter scenarios shipping, narrative-report mode live. Tracking bead: `embertide-ov9`.

## What it is

A Playwright-driven headless agent that exercises the running app end-to-end and catches obvious UI/dispatch regressions before a human playtest. Think "does combat work at all?" gate, not "does combat feel right for the 6yo" (that's still on you).

## How to run

The playtester spawns its own dedicated dev server on `:6174` — you don't need to start `pnpm dev` first. Override the target with `PLAYWRIGHT_BASE_URL=<url>` (skips the auto-spawn).

```bash
pnpm playtest                    # fast pass/fail — CI-style gate
pnpm playtest:narrate            # same run, also emits markdown reports
pnpm playtest --headed           # watch it play in a real browser window
pnpm playtest --debug            # step through with Playwright inspector
pnpm playtest craghorn-winnable     # run one scenario by name
```

## Narrative reports

`pnpm playtest:narrate` sets `PLAYTEST_NARRATE=1`, which flips the `createReporter()` no-op into a real markdown emitter. Each scenario that opts in writes one file:

- `docs/playtest-reports/<YYYY-MM-DD>-<scenario>.md` — summary + step-by-step trace + embedded screenshots
- `docs/playtest-reports/<YYYY-MM-DD>-<scenario>/*.png` — captured inflection points (combat-start, combat-end, etc.)

Reports are gitignored — read them locally before a human playtest, regenerate freely.

The designer reads the **Summary** section first (what happened in plain language) and only drops into the Trace or Screenshots when something looks off.

## Scenarios

Located in `tools/playtester/*.spec.ts`:

**Combat flows**
- **`craghorn-winnable.spec.ts`** — boots `?debug=craghorn`, plays greedy "first card + Pass Turn" loop, asserts combat reaches a terminal state within 30 rounds.
- **`craghorn-loss-graceful.spec.ts`** — pacifist policy (Pass Turn only) against craghorn; asserts LOSS terminates cleanly with no hangs.
- **`regular-monster-flow.spec.ts`** — Setup → main board without debug seed; asserts regulars still instant-resolve (no CombatScreen mount). Currently a structural guard; extend to an actual fight once setup-flow testids stabilize.
- **`region-only.spec.ts`** — region boss reachable without prior wild-boss defeat.
- **`wild-heirloom-wins-region.spec.ts`** / **`wild-then-region.spec.ts`** — full wild → region progression with heirloom carry-over.

**State-matrix guards** (embertide-68a)
- **`hp-downed.spec.ts`** — HPStrip surfaces the downed ribbon + teammate-revive button when hp=0 / downed=true.
- **`embertide-filled.spec.ts`** — all three shared shards render as filled when `sharedEmbertide` is fully granted.
- **`princess-crystal-freed.spec.ts`** — PrincessCrystalCell transitions into the post-freed terminal state (Aurelia-freed element, no Strike button).
- **`zone-themes.spec.ts`** — ZoneCell renders the Emberpeak and Gilded Cage rasters + theme hints.

**Visual regression**
- **`visual-*.spec.ts`** — pixel-diff baselines for altar row, combat backgrounds, destiny slot. These fail on unexpected visual churn.

## Adding a scenario

Minimal template (narrate-aware):

```ts
import { expect, test } from '@playwright/test';
import { bootApp, clickFirstCard, combatEnded, dismissTutorials, passTurn, snapshot } from './harness';
import { createReporter } from './narrative';

test('my-scenario — describe the flow', async ({ page }) => {
  await bootApp(page, { debug: 'some-seed' });  // or omit debug for normal Setup
  await dismissTutorials(page);

  const report = createReporter('my-scenario');   // no-op unless PLAYTEST_NARRATE=1
  await report.screenshot(page, '01-start');

  // ... drive the UI via harness helpers, logging as you go ...
  report.step('played first card');
  report.snap(await snapshot(page));

  await report.screenshot(page, '02-end');
  await report.finalize('Plain-language summary the designer reads first.');

  expect(await combatEnded(page)).toBe(true);
});
```

Keep scenarios thin (<50 lines). Push logic into `harness.ts` so UI churn only updates one file.

## Harness helpers

See `tools/playtester/harness.ts`:

- `bootApp(page, { debug })` — navigates to the dev server with optional `?debug=<seed>` param
- `dismissTutorials(page)` — clears any open tutorial backdrop (main + combat)
- `snapshot(page)` — returns `{ boss, handSize, handIds, plays, p0Hp, p1Hp, log, ended }`
- `formatSnapshot(s)` — one-line string for traces/reports
- `clickFirstCard(page)` / `clickSlot(page, idx)` — play cards
- `passTurn(page)` — clicks Pass Turn, triggering boss resolution + draw
- `combatEnded(page)` — `true` when CombatScreen has unmounted
- `readBossHp` / `readPlayerHp` / `readHandCardIds` / `readPlaysCounter` / `readCombatLog` — targeted readouts

Player-tray HP returns `null` during combat because `CombatScreen` replaces the main board. Use `snapshot.ended` to branch.

## Reporter API

See `tools/playtester/narrative.ts`:

- `createReporter(scenarioName)` — returns a real `Reporter` if `PLAYTEST_NARRATE=1`, otherwise a no-op. Safe to call unconditionally.
- `report.step(text)` — markdown bullet in the trace
- `report.snap(snapshot, label?)` — appends formatted state line; `label` bolds the prefix
- `report.screenshot(page, label)` — PNG saved + embedded in the report
- `report.finalize(summary)` — writes the markdown file; call last

## Debug seeds

See `src/debug/playtestSeeds.ts`. Every seed spawns a 2-player Courage+Power game from `initGame` and then flips a single state surface.

**Combat seeds**
- `?debug=craghorn` — drops into Craghorn combat
- `?debug=wild-boss-slot` — main board with wild + region altar slots populated (p0 carries heirlooms)
- `?debug=emberpeak-combat` — zone = Emberpeak, in Ashen Tyrant combat
- `?debug=temple-combat` — zone = Gilded Cage, in Vurmox combat
- `?debug=vurmox-destiny` — zone = Gilded Cage, Temple wilds cleared, VurmoxDestinySlot mounted

**State-matrix seeds** (embertide-68a)
- `?debug=hp-downed` — p0 hp=0/downed=true, currentPlayerIndex=1 (so p0's strip shows teammate-view revive button)
- `?debug=embertide-filled` — sharedEmbertide all three shards set
- `?debug=princess-crystal-freed` — PrincessCrystal { charges: 0, freed: true }
- `?debug=zone-emberpeak` / `?debug=zone-temple` — force currentZone without advancing via defeats

## When to run it

- **Locally, before a human playtest**: `pnpm playtest:narrate`, skim the reports, then pick up the controller.
- **After wiring a new UI feature or reducer action**: `pnpm playtest` as a regression check — faster than a full browser session, catches silent no-ops that unit tests miss.
- **Not in CI** (yet): scenarios take ~35s end-to-end and depend on a spawned dev server. Promote to CI once the suite is stable and a preview-server step is wired.
