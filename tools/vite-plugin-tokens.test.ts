// tools/vite-plugin-tokens.test.ts
//
// Unit tests for the token extractor. The Vite plugin layer is a thin wrapper
// around these pure functions (file IO + dev-server watcher), so exercising the
// extractor covers the correctness-critical surface.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — untyped sibling .mjs helper.
import { parseRawTokens, groupTokens, renderTokensModule } from './extract-tokens.mjs';

const SAMPLE_CSS = `
@layer tokens, base;

@layer tokens {
  :root {
    --hc-jewel-sapphire-500: #2e4ba0;
    --hc-jewel-sapphire-700: #1a2e6e;
    --hc-lead-iron-700: #1a1620;
    --hc-parchment-100: #f4ebd3;
    --hc-shadow-800: #0b1228;
    --hc-glow-amber: rgba(232, 189, 89, 0.55);
    --hc-champion-courage-fill: var(--hc-jewel-emerald-500);
    --hc-champion-courage-lead: var(--hc-lead-iron-700);
    --hc-champion-courage-glow: var(--hc-glow-emerald);
    --hc-resource-heart-gem: var(--hc-jewel-ruby-300);
    --hc-resource-heart-lead: var(--hc-lead-gold-500);
    --hc-tier-small-glass: var(--hc-parchment-500);
    --hc-tier-small-lead: var(--hc-lead-iron-700);
    --hc-tier-small-cap: var(--hc-jewel-amber-300);
    --hc-bg-app: var(--hc-shadow-800);
    --hc-text-primary: #f6f2e6;
  }
}
`;

describe('parseRawTokens', () => {
  it('extracts every --hc-* declaration', () => {
    const raw = parseRawTokens(SAMPLE_CSS);
    expect(Object.keys(raw).length).toBe(16);
    expect(raw['jewel-sapphire-500']).toBe('#2e4ba0');
    expect(raw['glow-amber']).toBe('rgba(232, 189, 89, 0.55)');
    expect(raw['champion-courage-fill']).toBe('var(--hc-jewel-emerald-500)');
  });

  it('ignores non-hc custom properties', () => {
    const raw = parseRawTokens(':root { --other: red; --hc-x-1: #fff; }');
    expect(Object.keys(raw)).toEqual(['x-1']);
  });

  it('throws on duplicate keys', () => {
    expect(() => parseRawTokens(':root { --hc-foo: #111; --hc-foo: #222; }')).toThrow(
      /Duplicate token/,
    );
  });
});

describe('groupTokens', () => {
  it('nests tokens under the expected namespaces', () => {
    const grouped = groupTokens(parseRawTokens(SAMPLE_CSS));
    expect(grouped.jewel.sapphire[500]).toBe('#2e4ba0');
    expect(grouped.lead.iron[700]).toBe('#1a1620');
    expect(grouped.parchment[100]).toBe('#f4ebd3');
    expect(grouped.shadow[800]).toBe('#0b1228');
    expect(grouped.glow.amber).toBe('rgba(232, 189, 89, 0.55)');
    expect(grouped.champion.courage.fill).toBe('var(--hc-jewel-emerald-500)');
    expect(grouped.resource.heart.gem).toBe('var(--hc-jewel-ruby-300)');
    expect(grouped.tier.small.cap).toBe('var(--hc-jewel-amber-300)');
    // Semantic-bucket entries always store `var(--hc-${key})` self-references
    // so consumers resolve values through the CSS custom-property cascade at
    // runtime — not the possibly-drifting literal from tokens.css.
    expect(grouped.semantic['bg-app']).toBe('var(--hc-bg-app)');
    expect(grouped.semantic['text-primary']).toBe('var(--hc-text-primary)');
  });

  it('rejects unknown jewel families', () => {
    expect(() => groupTokens({ 'jewel-unknown-500': '#fff' } as Record<string, string>)).toThrow(
      /Unknown jewel family/,
    );
  });
});

describe('renderTokensModule', () => {
  it('emits a TypeScript module with `as const`', () => {
    const grouped = groupTokens(parseRawTokens(SAMPLE_CSS));
    const out = renderTokensModule(grouped);
    expect(out).toContain('export const HC_TOKENS = {');
    expect(out).toContain('as const;');
    expect(out).toContain('export type HCTokens = typeof HC_TOKENS;');
    expect(out).toContain('sapphire:');
    expect(out).toContain("500: '#2e4ba0'");
  });
});

describe('lead-gold-700 alpha-35 variant (embertide-ao4)', () => {
  it('defines --hc-lead-gold-700-alpha-35 in tokens.css with RGB matching --hc-lead-gold-700 (#8b6a2a)', () => {
    const tokensCss = readFileSync(resolve(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
    const raw = parseRawTokens(tokensCss);
    expect(raw).toHaveProperty('lead-gold-700');
    expect(raw['lead-gold-700']).toBe('#8b6a2a');
    expect(raw).toHaveProperty('lead-gold-700-alpha-35');
    // RGB of #8b6a2a = (139, 106, 42); alpha 0.35.
    expect(raw['lead-gold-700-alpha-35']).toBe('rgba(139, 106, 42, 0.35)');
  });

  it('groups the alpha-35 variant under semantic as a var(--hc-*) reference (embertide-25x)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolve } = require('node:path') as typeof import('node:path');
    const tokensCss = readFileSync(resolve(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
    const grouped = groupTokens(parseRawTokens(tokensCss));
    // The alpha-35 variant does not fit the lead-{family}-{step} pattern, so
    // it lands in `semantic`. Semantic-bucket entries always store a
    // var(--hc-*) self-reference — NEVER a resolved literal — so the TS
    // mirror cannot drift from the CSS source if the rgba() is rebalanced.
    expect(grouped.semantic['lead-gold-700-alpha-35']).toBe('var(--hc-lead-gold-700-alpha-35)');
  });
});
