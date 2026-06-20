/**
 * One-off screenshot capture for embertide-arq3.
 *
 * Boots the play board at 1280×800 and screenshots the InPlay drop-zone
 * empty state in BOTH variants:
 *  1. first-run — painterly stained-glass cream + "Drag a card here to play
 *     it" hint copy
 *  2. post-first-run — simple cream background, no copy (dashed amber border
 *     alone signals the affordance)
 *
 * The first-run variant is captured by clearing localStorage before navigating;
 * the post-first-run variant is captured by priming `rasc.dropHintSeen=1` in
 * localStorage before the second navigation.
 *
 * NOT run in CI — used ad-hoc during the polish pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('arq3 — drop-zone first-run painterly + post-first-run simple cream', async ({ page }) => {
  // ---- 1. First-run variant ----------------------------------------------
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('rasc.dropHintSeen'));
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  const inPlay = page.getByTestId('in-play');
  await expect(inPlay).toBeVisible();
  const dropZoneFirstRun = page.getByTestId('drop-zone-empty');
  await expect(dropZoneFirstRun).toBeVisible();
  await expect(dropZoneFirstRun).toHaveAttribute('data-first-run', 'true');
  await expect(page.getByText('Drag a card here to play it')).toBeVisible();

  await dropZoneFirstRun.screenshot({ path: '.screenshots/arq3-first-run.png' });
  await page.screenshot({ path: '.screenshots/arq3-first-run-fullboard-1280x800.png' });

  // ---- 2. Post-first-run empty variant -----------------------------------
  await page.evaluate(() => localStorage.setItem('rasc.dropHintSeen', '1'));
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  const inPlayAfter = page.getByTestId('in-play');
  await expect(inPlayAfter).toBeVisible();
  const dropZoneAfter = page.getByTestId('drop-zone-empty');
  await expect(dropZoneAfter).toBeVisible();
  await expect(dropZoneAfter).toHaveAttribute('data-first-run', 'false');
  await expect(page.getByText('Drag a card here to play it')).toHaveCount(0);

  await dropZoneAfter.screenshot({ path: '.screenshots/arq3-after-first-drag.png' });
  await page.screenshot({ path: '.screenshots/arq3-after-first-drag-fullboard-1280x800.png' });

  // ---- 3. Drag-over highlight (manually toggle .in-play-drag-over) -------
  await page.evaluate(() => {
    document.querySelector('.in-play')?.classList.add('in-play-drag-over');
  });
  await inPlayAfter.screenshot({ path: '.screenshots/arq3-drag-over.png' });
  await page.evaluate(() => {
    document.querySelector('.in-play')?.classList.remove('in-play-drag-over');
  });

  // ---- 4. Populated in-play (push the active player's first hand card) ---
  await page.evaluate(() => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('arq3: __gameStore not exposed by debug seed');
    const state = store.getState() as {
      players: { hand: unknown[]; inPlay: unknown[] }[];
      currentPlayerIndex: number;
    };
    const idx = state.currentPlayerIndex;
    const moved = state.players[idx].hand[0];
    if (!moved) return;
    const players = state.players.map((p, i) =>
      i === idx ? { ...p, inPlay: [moved], hand: p.hand.slice(1) } : p,
    );
    store.setState({ ...state, players });
  });
  await expect(page.getByTestId('drop-zone-empty')).toHaveCount(0);
  await inPlayAfter.screenshot({ path: '.screenshots/arq3-populated.png' });
  await page.screenshot({ path: '.screenshots/arq3-populated-fullboard-1280x800.png' });

  // ---- 5. Trays-row close-up (verify items chip lives in counters row) --
  const traysRow = page.locator('.trays-row');
  await traysRow.screenshot({ path: '.screenshots/arq3-trays-row.png' });
});
