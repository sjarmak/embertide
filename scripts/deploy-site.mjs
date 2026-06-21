// Deploy the Embertide build into the sjarmak.ai site repo.
//
// Prod is the Astro site at projects/website (Render, auto-deploys on push
// to main). Embertide ships there as a COMMITTED build copy under
// public/games/embertide/ — there is no auto-rebuild, so this script is the
// step that regenerates that copy. It does NOT push; review + commit + push
// the website repo yourself (that's what triggers the Render deploy).
//
// Steps:
//   1. `npm run build:web`  -> dist/ with base /games/embertide/
//   2. rsync -a --delete dist/ -> <site>/public/games/embertide/
//      (--delete drops stale files, e.g. the previous craghorn_001.webp)
//
// Override the target with SITE_GAMES_DIR if the website checkout lives
// somewhere other than the sibling ../website.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target =
  process.env.SITE_GAMES_DIR ?? resolve(repoRoot, '..', 'website/public/games/embertide');

// The site repo must already be checked out — refuse rather than rsync into a
// freshly-created stray directory (silent-resource-creation guard).
const siteRepo = resolve(target, '..', '..', '..'); // .../website
if (!existsSync(siteRepo) || !existsSync(resolve(siteRepo, '.git'))) {
  console.error(
    `deploy-site: site repo not found at ${siteRepo}\n` +
      `Set SITE_GAMES_DIR to the games/embertide path inside your website checkout.`,
  );
  process.exit(1);
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', env: process.env });

console.log('› Building Embertide (base /games/embertide/)…');
run('npm', ['run', 'build:web']);

console.log(`› Syncing dist/ → ${target} (removing stale files)…`);
run('rsync', ['-a', '--delete', `${resolve(repoRoot, 'dist')}/`, `${target}/`]);

console.log(
  `\n✓ Deployed build into ${target}\n` +
    `  Next: in the website repo, review the diff, then commit + push to deploy:\n` +
    `    git -C ${siteRepo} add public/games/embertide && git -C ${siteRepo} commit -m "games/embertide: update build" && git -C ${siteRepo} push`,
);
