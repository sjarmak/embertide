#!/usr/bin/env node
/**
 * scripts/snapshot-illustration.mjs
 *
 * Visual snapshot loop for the Elysian Cathedral illustration renderer.
 *
 * Pipeline:
 *   1. Build Ladle's static site to `build/` (skippable via --no-build).
 *   2. Spin up a tiny static file server for `build/` on a free port.
 *   3. Launch headless Chromium via Playwright.
 *   4. For each (theme x background x scale) combination, navigate to the
 *      warrior story, set the theme via the in-story toggle button, and
 *      screenshot the matching background tile.
 *   5. Tear down browser + server.
 *
 * Each screenshot lands in --out (default `screenshots/illustration/`)
 * named: `<story>__<theme>__<bg>__<scale>.png`.
 *
 * Designed for rapid iteration loops — Claude Code's Read tool can open the
 * PNGs directly to compare runs.
 *
 * CLI args (all optional):
 *   --story    warrior              (story key under "Illustration")
 *   --themes   cathedral,arcane     (comma-separated)
 *   --bgs      parchment,shadow     (comma-separated)
 *   --scales   120,240              (comma-separated; informational only —
 *                                    the story renders at fixed 240 internally,
 *                                    but the screenshot crop captures both
 *                                    via CSS scale wrapper)
 *   --out      screenshots/illustration/
 *   --no-build (skip `ladle build` if `build/` already exists)
 */

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// Locate paths relative to repo root.
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..');
const BUILD_DIR = join(REPO_ROOT, 'build');

// ---------------------------------------------------------------------------
// Argv parsing — keep tiny, no extra deps.
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    story: 'warrior',
    themes: ['cathedral', 'arcane'],
    bgs: ['parchment', 'shadow'],
    scales: [120, 240],
    out: 'screenshots/illustration/',
    build: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--story':
        out.story = next;
        i++;
        break;
      case '--themes':
        out.themes = next
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
        break;
      case '--bgs':
        out.bgs = next
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
        break;
      case '--scales':
        out.scales = next
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n));
        i++;
        break;
      case '--out':
        out.out = next;
        i++;
        break;
      case '--no-build':
        out.build = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (flag.startsWith('--')) {
          console.warn(`[snapshot] unknown flag: ${flag}`);
        }
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/snapshot-illustration.mjs [flags]

Flags:
  --story <key>           Story key under "Illustration" (default: warrior)
  --themes <a,b,...>      Themes to capture (default: cathedral,arcane)
  --bgs <a,b,...>         Background tiles (default: parchment,shadow)
  --scales <n,n,...>      Render scales (default: 120,240)
  --out <dir>             Output directory (default: screenshots/illustration/)
  --no-build              Skip ladle build (use existing build/)
`);
}

// ---------------------------------------------------------------------------
// Run a child process and wait for exit.
// ---------------------------------------------------------------------------

function runProcess(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: REPO_ROOT,
      ...opts,
    });
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', rejectP);
  });
}

// ---------------------------------------------------------------------------
// Tiny static server for `build/`. Resolves paths safely; no traversal.
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function startStaticServer(rootDir) {
  return new Promise((resolveP, rejectP) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        // Reject any traversal attempts.
        if (urlPath.includes('..')) {
          res.writeHead(400);
          res.end('bad request');
          return;
        }
        let filePath = join(rootDir, urlPath);
        let st;
        try {
          st = statSync(filePath);
        } catch {
          // SPA fallback: Ladle uses /?story=... routing; serve index.html.
          filePath = join(rootDir, 'index.html');
          try {
            st = statSync(filePath);
          } catch {
            res.writeHead(404);
            res.end('not found');
            return;
          }
        }
        if (st.isDirectory()) {
          filePath = join(filePath, 'index.html');
          try {
            st = statSync(filePath);
          } catch {
            res.writeHead(404);
            res.end('not found');
            return;
          }
        }
        const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': st.size });
        res.end(readFileSync(filePath));
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolveP({ server, port: addr.port });
      } else {
        rejectP(new Error('failed to bind static server'));
      }
    });
    server.on('error', rejectP);
  });
}

function stopStaticServer(server) {
  return new Promise((resolveP) => {
    server.close(() => resolveP());
  });
}

// ---------------------------------------------------------------------------
// Ladle story id resolution.
//
// Ladle's URL convention: /?story=<kebab-cased-title>--<kebab-cased-export>
// Our story file titled "Illustration / cathedral_hero_warrior_001" with
// export `Warrior` resolves to:
//   illustration-cathedral-hero-warrior-001--warrior
// ---------------------------------------------------------------------------

const STORY_IDS = {
  // map from CLI alias -> Ladle story id
  // Ladle's id is composed from levels + the human-readable storyName.
  warrior: 'illustration--cathedral-hero-warrior-001--warrior-parchment-shadow',
};

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  const storyId = STORY_IDS[args.story];
  if (!storyId) {
    console.error(`[snapshot] unknown --story "${args.story}"`);
    console.error(`Known stories: ${Object.keys(STORY_IDS).join(', ')}`);
    process.exit(2);
  }

  const outDir = resolve(REPO_ROOT, args.out);
  mkdirSync(outDir, { recursive: true });

  // 1. ladle build → build/
  if (args.build || !existsSync(BUILD_DIR)) {
    console.log('[snapshot] building Ladle static site → build/ ...');
    await runProcess('npx', ['ladle', 'build']);
  } else {
    console.log('[snapshot] reusing existing build/ (--no-build)');
  }

  // 2. static server for build/
  const { server, port } = await startStaticServer(BUILD_DIR);
  console.log(`[snapshot] static server on http://127.0.0.1:${port}`);

  // 3. browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  let captures = 0;
  try {
    for (const theme of args.themes) {
      for (const bg of args.bgs) {
        for (const scale of args.scales) {
          // Visit the story page.
          const url = `http://127.0.0.1:${port}/?story=${encodeURIComponent(storyId)}&mode=preview`;
          await page.goto(url, { waitUntil: 'networkidle' });

          // Click the theme toggle if not already in the desired theme.
          const themeButton = page.getByTestId(`theme-toggle-${theme}`);
          await themeButton.waitFor({ state: 'visible', timeout: 10_000 });
          await themeButton.click();

          // Inject a wrapper to control SVG render size on the captured tile.
          // The story renders at a fixed internal size; we use CSS to resize
          // so the captured PNG matches the requested scale exactly.
          await page.evaluate(
            ({ theme, bg, scale }) => {
              // `document` resolves inside the browser context here.
              // eslint-disable-next-line no-undef
              const tile = document.querySelector(`[data-testid="tile-${theme}-${bg}"]`);
              if (!tile) return;
              const svg = tile.querySelector('svg');
              if (!svg) return;
              svg.setAttribute('width', String(scale));
              svg.setAttribute('height', String(scale));
            },
            { theme, bg, scale },
          );

          // Allow layout to settle.
          await page.waitForTimeout(100);

          const tile = page.getByTestId(`tile-${theme}-${bg}`);
          const filename = `${args.story}__${theme}__${bg}__${scale}.png`;
          const target = join(outDir, filename);
          await tile.screenshot({ path: target });
          console.log(`[snapshot] wrote ${target}`);
          captures++;
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
    await stopStaticServer(server);
  }

  console.log(`[snapshot] done — ${captures} screenshot(s) → ${outDir}`);
}

main().catch((err) => {
  console.error('[snapshot] FAIL:', err);
  process.exit(1);
});
