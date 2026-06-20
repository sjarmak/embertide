// tools/snap-mobile.mjs
//
// Mobile screenshot tool. Defaults to WebKit (Safari engine) so the
// rendered output is closer to actual iOS Safari — catches
// WebKit-specific font metrics, `100dvh` behavior, and CSS
// implementation differences that headless Chromium hides. Falls back
// to Chromium if WebKit isn't installed (run `sudo npx playwright
// install-deps webkit` once on first use).
//
// Usage:
//   node tools/snap-mobile.mjs                      # iphone-15 setup, webkit
//   node tools/snap-mobile.mjs iphone-15 ingame
//   node tools/snap-mobile.mjs iphone-15 setup chromium    # force chromium
//   node tools/snap-mobile.mjs iphone-15 zoom              # tap a hand card
//   node tools/snap-mobile.mjs iphone-se ingame
//
// Output paths printed to stdout.

import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';

const VIEWPORTS = {
  'iphone-15': { width: 852, height: 393 },
  'iphone-15-pro-max': { width: 932, height: 430 },
  'iphone-se': { width: 667, height: 375 },
  'iphone-12-mini': { width: 812, height: 375 },
  'pixel-7': { width: 915, height: 412 },
};

const device = process.argv[2] ?? 'iphone-15';
const mode = process.argv[3] ?? 'setup';
const engineArg = process.argv[4] ?? 'webkit';
const url = process.argv[5] ?? 'http://localhost:5174/';

const viewport = VIEWPORTS[device];
if (!viewport) {
  console.error(`Unknown device "${device}". Choices: ${Object.keys(VIEWPORTS).join(', ')}`);
  process.exit(1);
}

await mkdir('.screenshots', { recursive: true });

async function pickEngine(preferred) {
  if (preferred === 'chromium') return { name: 'chromium', engine: chromium };
  // Try WebKit first; fall back to Chromium with a warning if it fails
  // (typically because system deps weren't installed). The fallback
  // keeps the snap usable in environments where WebKit can't run.
  try {
    const browser = await webkit.launch();
    await browser.close();
    return { name: 'webkit', engine: webkit };
  } catch (err) {
    console.warn(
      `[snap-mobile] WebKit unavailable (${err.message.split('\n')[0]}); falling back to Chromium. ` +
        'Run `sudo npx playwright install-deps webkit` to enable Safari-engine snaps.',
    );
    return { name: 'chromium', engine: chromium };
  }
}

const { name: engineName, engine } = await pickEngine(engineArg);

const browser = await engine.launch();
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

if (mode === 'ingame' || mode === 'in-game' || mode === 'zoom') {
  const startBtn = page.locator('button', { hasText: /^start$/i }).first();
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click({ force: true });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 25; i++) {
      const buttons = await page.locator('button').all();
      let clicked = false;
      for (const b of buttons) {
        const txt = (await b.textContent().catch(() => ''))?.trim().toLowerCase() ?? '';
        if (['got it', 'next', 'continue', 'skip', 'ok'].includes(txt)) {
          await b.click({ force: true }).catch(() => {});
          clicked = true;
          await page.waitForTimeout(250);
          break;
        }
      }
      if (!clicked) break;
    }
    await page.waitForTimeout(300);
  }
}

if (mode === 'zoom') {
  const firstHandCard = page.locator('[data-testid^="hand-card-"]').first();
  if (await firstHandCard.isVisible().catch(() => false)) {
    await firstHandCard.click({ force: true });
    await page.waitForTimeout(400);
  }
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const path = `.screenshots/snap-${engineName}-${device}-${mode}-${ts}.png`;
await page.screenshot({ path });
const fullPath = path.replace(/\.png$/, '-full.png');
await page.screenshot({ path: fullPath, fullPage: true });

await browser.close();

console.log(`engine: ${engineName}`);
console.log(path);
console.log(fullPath);
