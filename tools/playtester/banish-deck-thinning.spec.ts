/**
 * Scenario: Banish-from-hand deck-thinning probe (embertide-xgez — 91p (c)).
 *
 * Tuning question: do banish items meaningfully thin the deck and
 * does the choice surface (CardSelectionModal) feel like real "choice
 * anxiety" or rubber-stamp banish-the-starter?
 *
 * Both shipped cards (blacksmith-forge, ritual-relic) are drop-only +
 * cost: { green: 0 } — players don't naturally encounter them in
 * normal market play. This spec injects forge into p0.hand via
 * __gameStore, plays it, asserts the banish modal opens, picks the
 * first starter offered, and snapshots the deck composition before
 * vs after. Single-card probe; multi-round full-game simulation is
 * gated on a market/drop wiring change (out of xgez scope).
 */

import { expect, test, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

interface DeckRead {
  readonly hand: string[];
  readonly deck: string[];
  readonly discard: string[];
  readonly banished: string[];
  readonly inPlay: string[];
  readonly green: number;
  readonly pendingBanishChoice: unknown;
}

async function readDeck(page: Page): Promise<DeckRead | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          players: {
            hand: { id: string }[];
            deck: { id: string }[];
            discard: { id: string }[];
            banished: { id: string }[];
            inPlay: { id: string }[];
            green: number;
          }[];
          pendingBanishChoice: unknown;
        };
      };
    };
    const s = w.__gameStore?.getState();
    if (!s) return null;
    const p = s.players[0];
    return {
      hand: p.hand.map((c) => c.id),
      deck: p.deck.map((c) => c.id),
      discard: p.discard.map((c) => c.id),
      banished: p.banished.map((c) => c.id),
      inPlay: p.inPlay.map((c) => c.id),
      green: p.green,
      pendingBanishChoice: s.pendingBanishChoice,
    };
  });
}

async function injectForgeInHand(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { players: { hand: unknown[] }[] };
        setState(s: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return false;
    const s = store.getState() as {
      players: { id: string; hand: unknown[] }[];
    };
    const forge = {
      id: 'blacksmith-forge',
      role: 'item',
      cost: { green: 0 },
      effects: { kind: 'banish-from-hand', amount: 1 },
      passive: {
        kind: 'item-passive',
        description: '+1 gem at the start of your turn',
        trigger: 'start-of-turn',
        effect: { kind: 'gain', green: 1 },
      },
      itemKind: 'item-active',
      cooldownTurns: 0,
      lastUsedTurn: null,
    };
    const players = s.players.map((p, idx) => (idx === 0 ? { ...p, hand: [...p.hand, forge] } : p));
    store.setState({ ...s, players });
    return true;
  });
}

test('banish-deck-thinning — forge play opens modal, banish lands in voided', async ({ page }) => {
  test.setTimeout(60_000);
  const report = createReporter('banish-deck-thinning');

  // Boot via debug seed that exposes __gameStore (wild-boss-slot does so).
  // We don't need the wild boss — we only need the main board + p0.hand
  // surface mounted with __gameStore reachable.
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const ok = await injectForgeInHand(page);
  expect(ok).toBe(true);
  report.step('injected blacksmith-forge into p0.hand via __gameStore');

  const before = await readDeck(page);
  if (!before) throw new Error('readDeck: __gameStore unreachable');
  report.step(
    `pre-play deck shape: hand=[${before.hand.join(',')}], deck.size=${before.deck.length}, discard.size=${before.discard.length}, banished.size=${before.banished.length}, green=${before.green}`,
  );
  await report.screenshot(page, '01-forge-injected');

  // Play forge by calling playCard via __gameStore directly (DOM
  // hand-tile path is brittle when hand size changes mid-test).
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { playCard?: (id: string) => void };
      };
    };
    w.__gameStore?.getState().playCard?.('blacksmith-forge');
  });
  await page.waitForTimeout(120);

  const afterPlay = await readDeck(page);
  if (!afterPlay) throw new Error('readDeck post-play returned null');
  report.step(
    `post-play: forge in inPlay=[${afterPlay.inPlay.join(',')}], pendingBanishChoice=${JSON.stringify(afterPlay.pendingBanishChoice).slice(0, 120)}`,
  );
  expect(afterPlay.pendingBanishChoice).not.toBeNull();
  await report.screenshot(page, '02-modal-open');

  // Banish the first starter in hand (deck-thinning intent — banish a
  // starter-coin so the deck cycles faster).
  const targetId = afterPlay.hand[0];
  await page.evaluate((id: string) => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { banishFromHand?: (id: string) => void };
      };
    };
    w.__gameStore?.getState().banishFromHand?.(id);
  }, targetId);
  await page.waitForTimeout(120);

  const afterBanish = await readDeck(page);
  if (!afterBanish) throw new Error('readDeck post-banish returned null');
  report.step(
    `post-banish: banished=[${afterBanish.banished.join(',')}], hand=[${afterBanish.hand.join(',')}], pendingBanishChoice=${afterBanish.pendingBanishChoice}`,
  );
  await report.screenshot(page, '03-post-banish');

  expect(afterBanish.banished).toContain(targetId);
  expect(afterBanish.pendingBanishChoice).toBeNull();

  await report.finalize(
    `Banish probe (forge): banished **${targetId}** to voided; modal cleared. ` +
      `Deck shape: hand ${before.hand.length}→${afterBanish.hand.length}, ` +
      `banished ${before.banished.length}→${afterBanish.banished.length}, ` +
      `inPlay ${before.inPlay.length}→${afterBanish.inPlay.length}. ` +
      `Mechanic confirmed shipped + landing. Cost-tuning analysis in xgez bd notes ` +
      `(forge + relic both at green:0 — designer call needed on whether drop-only gate is sufficient).`,
  );
});
