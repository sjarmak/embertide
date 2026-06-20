// tools/extract-tokens.test.ts
//
// Tests the path-bounds guard on `extractFromFile` (embertide-us1).
//
// Security context: `extractFromFile(path)` is an exported module API that
// calls `readFileSync` on its argument. Build-tool only today, but any caller
// (Vite plugin hook, script, plugin graph module id) that feeds a partially-
// controlled path into this function must not be able to read arbitrary files
// on the build host. The guard resolves the input against the project root
// and rejects anything that resolves outside it.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';
// @ts-expect-error — untyped sibling .mjs helper.
import { extractFromFile } from './extract-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');
const TOKENS_CSS_ABS = resolve(PROJECT_ROOT, 'src', 'styles', 'tokens.css');

describe('extractFromFile path-bounds guard (embertide-us1)', () => {
  it('reads a file at an absolute path inside the project root', () => {
    const result = extractFromFile(TOKENS_CSS_ABS);
    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('grouped');
    expect(result).toHaveProperty('count');
    expect(result.count).toBeGreaterThan(0);
    // Spot-check a stable, well-known token to catch a regression where
    // parseRawTokens silently matches the wrong capture group and returns
    // a populated-but-garbage map. `jewel-sapphire-500` is part of the
    // Elysian palette and has been stable since V-1.
    expect(result.raw).toHaveProperty('jewel-sapphire-500');
    expect(result.raw['jewel-sapphire-500']).toMatch(/^#[0-9a-f]{3,8}$/i);
  });

  it('rejects a relative path that traverses outside the project root', () => {
    // '../../etc/passwd' resolved from cwd will almost certainly land outside
    // the project root (cwd is the project root during test runs).
    expect(() => extractFromFile('../../etc/passwd')).toThrow(/escapes project root/);
  });

  it('rejects an absolute path outside the project root', () => {
    expect(() => extractFromFile('/etc/passwd')).toThrow(/escapes project root/);
  });

  it('rejects a traversal payload that climbs out and back via a sibling', () => {
    // Construct a path that resolves to PROJECT_ROOT/../<leaf> — outside root.
    const escaping = resolve(PROJECT_ROOT, '..', 'not-the-project', 'tokens.css');
    expect(() => extractFromFile(escaping)).toThrow(/escapes project root/);
  });
});
