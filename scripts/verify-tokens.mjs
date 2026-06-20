#!/usr/bin/env node
// scripts/verify-tokens.mjs
//
// Drift check: the committed src/theme/tokens.ts MUST equal the file the token
// extractor would emit from src/styles/tokens.css. Exits 1 if they disagree,
// 0 if they match. Wired into CI.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRawTokens, groupTokens, renderTokensModule } from '../tools/extract-tokens.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'src', 'styles', 'tokens.css');
const TARGET = resolve(ROOT, 'src', 'theme', 'tokens.ts');

function fail(msg) {
  console.error(`[verify:tokens] FAIL: ${msg}`);
  process.exit(1);
}

try {
  const css = readFileSync(SOURCE, 'utf8');
  const expected = renderTokensModule(groupTokens(parseRawTokens(css)));
  const actual = readFileSync(TARGET, 'utf8');

  if (expected === actual) {
    const count = Object.keys(parseRawTokens(css)).length;
    console.log(`[verify:tokens] OK — ${count} tokens in sync`);
    process.exit(0);
  }

  // Produce a concise diff-by-line summary.
  const expLines = expected.split('\n');
  const actLines = actual.split('\n');
  const max = Math.max(expLines.length, actLines.length);
  const diffs = [];
  for (let i = 0; i < max && diffs.length < 10; i++) {
    if (expLines[i] !== actLines[i]) {
      diffs.push(`  line ${i + 1}:`);
      diffs.push(`    expected: ${JSON.stringify(expLines[i])}`);
      diffs.push(`    actual:   ${JSON.stringify(actLines[i])}`);
    }
  }
  fail(
    `src/theme/tokens.ts is out of sync with src/styles/tokens.css.\n` +
      `Run \`npm run dev\` to regenerate (first ${diffs.length / 3} differences):\n` +
      diffs.join('\n'),
  );
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
