#!/usr/bin/env node
// magenta-key-to-alpha.mjs — convert a uniform #FF00FF magenta chroma-key
// background to a proper alpha channel on one or more PNG files.
//
// Counterpart to chroma-key-to-alpha.mjs (green). Use this when the
// rendered SUBJECT is green (e.g. the green shard starter card),
// because green chroma-key would erode the subject. Magenta has G=0
// in the backdrop, so the magentaness metric (max(R,B) - G) is
// orthogonal to any natural green/forest tones in the subject.
//
// Usage:
//   node scripts/magenta-key-to-alpha.mjs <png> [<png> ...]
//   node scripts/magenta-key-to-alpha.mjs --in-place <png> ...   (default)
//   node scripts/magenta-key-to-alpha.mjs --suffix=_alpha <png>  (write *_alpha.png)
//   node scripts/magenta-key-to-alpha.mjs --dry-run <png>        (report only)
//
// Algorithm mirrors chroma-key-to-alpha.mjs:
//   For each pixel, magentaness = min(R, B) - G (high for pure magenta,
//   ~0 or negative for natural greens / parchment / wood). Pixels with
//   magentaness above HIGH are fully transparent; pixels in (LOW, HIGH)
//   get a linear alpha falloff for clean anti-aliased edges. Kept
//   pixels run through a magenta-spill decontamination pass that pulls
//   the red AND blue channels down to G when both exceed it (any
//   residual high-RB-low-G is by definition spill from the backdrop).

import { readFile, writeFile } from 'node:fs/promises';
import { argv, exit, stdout, stderr } from 'node:process';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { PNG } from 'pngjs';

const HIGH = 120;
const LOW = 50;
const FALLOFF = HIGH - LOW;

function processBuffer(pngBuffer) {
  const decoded = PNG.sync.read(pngBuffer);
  const { data, width, height } = decoded;
  let cleared = 0;
  let edge = 0;
  let kept = 0;
  let decontaminated = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magentaness = Math.min(r, b) - g;
    let alpha = data[i + 3];
    if (magentaness >= HIGH) {
      alpha = 0;
      cleared++;
    } else if (magentaness > LOW) {
      alpha = Math.round(alpha * (1 - (magentaness - LOW) / FALLOFF));
      edge++;
    } else {
      kept++;
    }
    if (alpha > 0) {
      if (r > g && b > g) {
        data[i] = g;
        data[i + 2] = g;
        decontaminated++;
      }
    }
    data[i + 3] = alpha;
  }
  decoded.colorType = 6;
  return {
    buffer: PNG.sync.write(decoded),
    stats: { width, height, cleared, edge, kept, decontaminated },
  };
}

function parseArgs(argv) {
  const args = { dryRun: false, suffix: null, files: [] };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--in-place') args.suffix = null;
    else if (a.startsWith('--suffix=')) args.suffix = a.slice('--suffix='.length);
    else if (a.startsWith('-')) {
      stderr.write(`unknown flag: ${a}\n`);
      exit(2);
    } else args.files.push(a);
  }
  return args;
}

function suffixedPath(p, suffix) {
  const ext = extname(p);
  const stem = basename(p, ext);
  return join(dirname(p), `${stem}${suffix}${ext}`);
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.files.length === 0) {
    stderr.write('usage: magenta-key-to-alpha.mjs [--dry-run] [--suffix=_alpha] <png>...\n');
    exit(2);
  }
  let failures = 0;
  for (const file of args.files) {
    const abs = resolve(file);
    try {
      const buf = await readFile(abs);
      const { buffer, stats } = processBuffer(buf);
      const total = stats.width * stats.height;
      const pct = (n) => ((n / total) * 100).toFixed(1);
      stdout.write(
        `${basename(abs)}  ${stats.width}x${stats.height}  ` +
          `cleared=${pct(stats.cleared)}%  edge=${pct(stats.edge)}%  ` +
          `kept=${pct(stats.kept)}%  decontam=${stats.decontaminated}px\n`,
      );
      if (args.dryRun) continue;
      const out = args.suffix ? suffixedPath(abs, args.suffix) : abs;
      await writeFile(out, buffer);
      stdout.write(`  → ${out} (${buffer.length} bytes)\n`);
    } catch (err) {
      failures++;
      stderr.write(`FAIL ${abs}: ${err.message}\n`);
    }
  }
  if (failures > 0) exit(1);
}

main().catch((err) => {
  stderr.write(`FAIL ${err.message ?? err}\n`);
  exit(1);
});
