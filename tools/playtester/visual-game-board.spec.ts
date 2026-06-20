/**
 * Visual verification of the in-game board (embertide-7lal +
 * t78j-rework + downstream play-area redesign beads). Captures the
 * GameBoard at 1280×800 with a deterministic mid-turn state so the
 * cathedral title strip + Field + InPlay + Hand + ItemsRow +
 * PlayerTrays all read together.
 *
 * Spec inlines a setup-bypass pattern: clicks Start with default
 * 2-player Human-vs-Human + first two champions to reach the
 * GameBoard quickly, then captures.
 */

import { test } from '@playwright/test';
import { bootApp } from './harness';

async function dismissTutorials(page: import('@playwright/test').Page): Promise<void> {
  // Tutorials enqueue and surface one at a time — each dismiss can cause
  // the next bubble to mount. Loop on the testid selector until the
  // overlay is empty for two consecutive checks.
  let consecutiveEmpty = 0;
  for (let i = 0; i < 20 && consecutiveEmpty < 2; i++) {
    const dismiss = page.getByTestId('tutorial-dismiss').first();
    const visible = await dismiss.isVisible().catch(() => false);
    if (visible) {
      await dismiss.click({ force: true }).catch(() => undefined);
      consecutiveEmpty = 0;
      await page.waitForTimeout(220);
    } else {
      consecutiveEmpty += 1;
      await page.waitForTimeout(120);
    }
  }
}

async function captureBoard(
  page: import('@playwright/test').Page,
  screenshotPath: string,
): Promise<void> {
  await bootApp(page);
  // bootApp lands on Setup; click Start to enter the GameBoard.
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: screenshotPath, fullPage: false });
}

test('7lal: cathedral title strip + game board', async ({ page }) => {
  await captureBoard(page, '.screenshots/7lal-cathedral-title-strip.png');
});

test('t78j: cathedral title strip rework — cream parchment + trefoil cornices', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/t78j-cathedral-title-strip-rework.png');
});

test('uwg5: always-row + chest-row collapsed into top chip strip (default expanded)', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/uwg5-always-row-strip-expanded.png');
});

test('sv77: Field band primary focal area — 368px tall, 160×220 tiles, sapphire stained-glass chrome', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/sv77-field-primary-focal-area.png');
});

test('bbr8: Hand band hugs player tray (parchment plate, immediately above trays)', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/bbr8-hand-hugs-tray.png');
});

test('bbr8 debug: full-page board capture so band overflow vs viewport is visible', async ({
  page,
}) => {
  await bootApp(page);
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: '.screenshots/bbr8-debug-fullpage.png', fullPage: true });
});

test('fsyd: drop-zone gap + items bag chip (collapsed + expanded popover)', async ({ page }) => {
  await captureBoard(page, '.screenshots/fsyd-drop-zone-and-items-bag-collapsed.png');
});

test('7cew: Embertide medallion in cathedral title strip center slot', async ({ page }) => {
  await captureBoard(page, '.screenshots/7cew-embertide-medallion-title-strip.png');
});

test('v7u4: PrincessCrystal disc adjacent to Embertide medallion in title strip', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/v7u4-crystal-medallion-title-strip.png');
});

test('ymek: full play-area board after sv77+bbr8+fsyd+7cew+v7u4 (cream chrome, compact trays, all visible)', async ({
  page,
}) => {
  await captureBoard(page, '.screenshots/ymek-final-board-fits-1280x800.png');
});

test('fsyd expanded: items bag chip popover open above tray band', async ({ page }) => {
  await bootApp(page);
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.getByTestId('items-bag-chip').click();
  await page.waitForTimeout(220);
  await page.screenshot({ path: '.screenshots/fsyd-items-bag-popover-open.png', fullPage: false });
});

test('bbr8 adjacency: Hand band + Trays band element-clipped (proves Hand sits immediately above trays)', async ({
  page,
}) => {
  await bootApp(page);
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.waitForTimeout(200);
  // Element-screenshot the .board-main column so we capture Hand + Trays
  // bands even though they land below the 800px viewport at this point in
  // the play-area redesign sequence (fsyd + 7cew + v7u4 reclaim budget).
  const boardMain = page.locator('.board-main');
  await boardMain.screenshot({ path: '.screenshots/bbr8-hand-tray-adjacency.png' });
});

test('0j5u: title-strip asset-free framing (cream + double-rule gold lines)', async ({ page }) => {
  await bootApp(page);
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.waitForTimeout(200);
  // Element-tight strip clip — judges the framing at the relevant
  // scale without play-area chrome eating the frame.
  const strip = page.getByTestId('cathedral-title-strip');
  await strip.screenshot({ path: '.screenshots/0j5u-title-strip-asset-free.png' });
});

test('uwg5: always-row top-band tight clip (collapsed default vs expanded after chevron)', async ({
  page,
}) => {
  await bootApp(page);
  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  // Default state is now collapsed (revised 2026-04-26 per user "all
  // game content viewable on screen, not cut off"). Capture the
  // 44px chip strip first.
  await page.screenshot({
    path: '.screenshots/uwg5-top-band-collapsed.png',
    clip: { x: 0, y: 0, width: 1280, height: 280 },
  });
  await page.getByTestId('always-row-strip-chevron').click();
  await page.waitForTimeout(280);
  const stripExpanded = await page.getByTestId('always-row-strip').getAttribute('data-expanded');
  if (stripExpanded !== 'true') {
    throw new Error(`expected data-expanded='true' after expand, got '${stripExpanded}'`);
  }
  await page.screenshot({
    path: '.screenshots/uwg5-top-band-expanded.png',
    clip: { x: 0, y: 0, width: 1280, height: 280 },
  });
});
