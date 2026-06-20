#!/usr/bin/env node
// scripts/verify-no-placeholders.mjs
//
// PRD R-19 / embertide-z40.3: placeholder icons that ship with
// `data-hc-placeholder="true"` MUST never be present in a production `dist/`
// build. Source files may contain the attribute (placeholders exist until
// V-3 lands real icons), but the build output must strip or replace them.
//
// This script scans text files under dist/ for the literal marker and fails
// if any occurrence is found. Intended to run AFTER `npm run build`.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST = resolve(__dirname, '..', 'dist');
const MARKER = 'data-hc-placeholder';

// Only scan text-ish extensions. Binaries (.woff2, .png, .ico, maps) are skipped.
const TEXT_EXTS = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.svg',
  '.json',
  '.txt',
  '.xml',
  '.webmanifest',
  '.map',
]);

function fail(msg) {
  console.error(`[verify:no-placeholders] FAIL: ${msg}`);
  process.exit(1);
}

function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else if (st.isFile()) {
      files.push(full);
    }
  }
  return files;
}

if (!existsSync(DIST)) {
  fail(`dist/ not found at ${DIST}. Run \`npm run build\` first.`);
}

const matches = [];
for (const file of walk(DIST)) {
  if (!TEXT_EXTS.has(extname(file).toLowerCase())) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes(MARKER)) {
    matches.push(file);
  }
}

if (matches.length > 0) {
  fail(
    `Found ${MARKER} in ${matches.length} built file(s):\n` +
      matches.map((f) => `  - ${f}`).join('\n') +
      `\nPlaceholder icons must not ship. See PRD R-19 / embertide-z40.3.`,
  );
}

console.log('[verify:no-placeholders] OK — no placeholder icons in dist/');
