#!/usr/bin/env node
// regen-art.mjs — batch-regenerate every card raster from its (redesigned,
// original) brief via scripts/fal-generate.mjs. Resumable and credit-safe:
// completed briefs are recorded in a manifest and skipped on re-run, so an
// interrupted batch never re-bills finished images.
//
//   FAL_API_KEY=... node scripts/regen-art.mjs            # regenerate all
//   node scripts/regen-art.mjs --only=hero,monster        # filter by key infix
//   node scripts/regen-art.mjs --concurrency=4
//   node scripts/regen-art.mjs --redo                     # ignore manifest
//
// Manifest: scripts/.regen-done.txt (one brief basename per line).
import { readdir, readFile, writeFile, appendFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, env, stdout } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PROMPTS = join(ROOT, 'docs', 'prompts');
const MANIFEST = join(HERE, '.regen-done.txt');

const arg = (name, def) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const CONCURRENCY = Number(arg('concurrency', '3'));
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const REDO = argv.includes('--redo');

async function readManifest() {
  if (REDO) return new Set();
  try {
    return new Set((await readFile(MANIFEST, 'utf8')).split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

async function main() {
  const done = await readManifest();
  const all = (await readdir(PROMPTS)).filter((f) => f.endsWith('.md'));
  // Only briefs that actually declare a Raster: line are generatable.
  const briefs = [];
  for (const f of all) {
    if (ONLY.length && !ONLY.some((k) => f.includes(k))) continue;
    if (done.has(f)) continue;
    const md = await readFile(join(PROMPTS, f), 'utf8');
    if (/\*\*Raster:\*\*/.test(md)) briefs.push(f);
  }

  stdout.write(`regen: ${briefs.length} briefs to generate (${done.size} already done)`);
  stdout.write(ONLY.length ? `  [filter: ${ONLY.join(',')}]\n` : '\n');
  if (!briefs.length) return;

  const failures = [];
  let completed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < briefs.length) {
      const f = briefs[cursor++];
      const ok = await one(f);
      completed++;
      const tag = ok ? '✓' : '✗';
      stdout.write(`  [${completed}/${briefs.length}] ${tag} ${f}\n`);
      if (ok) await appendFile(MANIFEST, f + '\n');
      else failures.push(f);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  stdout.write(`\nDone. ${completed - failures.length} ok, ${failures.length} failed.\n`);
  if (failures.length) {
    stdout.write('Failed (re-run to retry — manifest skips the successes):\n');
    for (const f of failures) stdout.write(`  ${f}\n`);
  }
}

function one(f) {
  return new Promise((res) => {
    const child = spawn('node', [join(HERE, 'fal-generate.mjs'), join(PROMPTS, f), '--force'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      if (code !== 0 && err.trim()) stdout.write(`      ${err.trim().split('\n').pop()}\n`);
      res(code === 0);
    });
  });
}

main().catch((e) => {
  stdout.write(`FATAL ${e.message}\n`);
  process.exit(1);
});
