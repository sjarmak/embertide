/**
 * Unit tests for the illustration renderer.
 *
 * The first validation pass covers ONLY the warrior + vertical-cathedral +
 * cathedral-arch combination (the canonical
 * `examples/cathedral_hero_warrior.json`). These tests lock down the
 * `renderContract.md` invariants so future silhouette/segmentation/ornament
 * additions cannot drift away from them.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderIllustration } from './renderer';
import { validateIllustrationSpec } from './composer';
import type { IllustrationSpec } from './schema';

import cathedralWarriorJson from './examples/cathedral_hero_warrior.json' with { type: 'json' };

const cathedralWarrior = cathedralWarriorJson as IllustrationSpec;

const ALLOWED_COLOR_PATTERN = /^(?:var\(--hc-[a-z0-9-]+\)|none)$/;

describe('validateIllustrationSpec', () => {
  it('returns no errors for the canonical cathedral_hero_warrior spec', () => {
    const errors = validateIllustrationSpec(cathedralWarrior);
    expect(errors).toEqual([]);
  });

  it('rejects specs with an out-of-range cellBudget', () => {
    const invalid: IllustrationSpec = { ...cathedralWarrior, cellBudget: 2 };
    const errors = validateIllustrationSpec(invalid);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('renderIllustration — raster cell', () => {
  it('omits the raster group when spec has no rasterImageUrl', () => {
    const vectorOnly: IllustrationSpec = { ...cathedralWarrior, rasterImageUrl: undefined };
    const { container } = render(renderIllustration(vectorOnly));
    expect(container.querySelector('g#raster')).toBeNull();
  });

  it('renders <g id="raster"> with a single <image> when rasterImageUrl is set', () => {
    const rasterSpec: IllustrationSpec = {
      ...cathedralWarrior,
      rasterImageUrl: '/assets/illustrations/cathedral_hero_warrior_001.webp',
    };
    const { container } = render(renderIllustration(rasterSpec));
    const rasterGroup = container.querySelector('g#raster');
    expect(rasterGroup).not.toBeNull();
    const images = rasterGroup!.querySelectorAll('image');
    expect(images).toHaveLength(1);
    const image = images[0];
    expect(image.getAttribute('href')).toBe(
      '/assets/illustrations/cathedral_hero_warrior_001.webp',
    );
    expect(image.getAttribute('x')).toBe('0');
    expect(image.getAttribute('y')).toBe('0');
    expect(image.getAttribute('width')).toBe('24');
    expect(image.getAttribute('height')).toBe('24');
    expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('places raster between fill-secondary and highlight in layer order', () => {
    const rasterSpec: IllustrationSpec = {
      ...cathedralWarrior,
      rasterImageUrl: '/assets/illustrations/cathedral_hero_warrior_001.webp',
    };
    const { container } = render(renderIllustration(rasterSpec));
    const svg = container.querySelector('svg');
    const groupIds = Array.from(svg!.children)
      .filter((node): node is SVGGElement => node.tagName.toLowerCase() === 'g')
      .map((g) => g.id);
    expect(groupIds).toEqual([
      'leading',
      'fill-primary',
      'fill-secondary',
      'raster',
      'highlight',
      'ornament',
    ]);
  });
});

describe('renderIllustration — cathedral_hero_warrior', () => {
  it('renders an svg with viewBox "0 0 24 24"', () => {
    const element = renderIllustration(cathedralWarrior);
    const { container } = render(element);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('defaults to size 120 and respects the size option', () => {
    const defaultElement = renderIllustration(cathedralWarrior);
    const { container: defaultContainer } = render(defaultElement);
    const defaultSvg = defaultContainer.querySelector('svg');
    expect(defaultSvg?.getAttribute('width')).toBe('120');
    expect(defaultSvg?.getAttribute('height')).toBe('120');

    const sizedElement = renderIllustration(cathedralWarrior, { size: 240 });
    const { container: sizedContainer } = render(sizedElement);
    const sizedSvg = sizedContainer.querySelector('svg');
    expect(sizedSvg?.getAttribute('width')).toBe('240');
    expect(sizedSvg?.getAttribute('height')).toBe('240');
  });

  it('emits exactly one <g id="highlight"> containing exactly one <path>', () => {
    const { container } = render(renderIllustration(cathedralWarrior));
    const highlights = container.querySelectorAll('g#highlight');
    expect(highlights).toHaveLength(1);
    const highlightPaths = highlights[0].querySelectorAll('path');
    expect(highlightPaths).toHaveLength(1);
  });

  it('honours the layer order: leading → fill-primary → fill-secondary → (shade?) → (raster?) → highlight → ornament', () => {
    const vectorOnly: IllustrationSpec = { ...cathedralWarrior, rasterImageUrl: undefined };
    const { container } = render(renderIllustration(vectorOnly));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const directGroupChildren = Array.from(svg!.children).filter(
      (node): node is SVGGElement => node.tagName.toLowerCase() === 'g',
    );
    const groupIds = directGroupChildren.map((g) => g.id);
    // Hero specs have no shade layer; raster layer omitted when no rasterImageUrl:
    expect(groupIds).toEqual([
      'leading',
      'fill-primary',
      'fill-secondary',
      'highlight',
      'ornament',
    ]);
  });

  it('uses only `var(--hc-*)` or `none` for every fill and stroke attribute', () => {
    const { container } = render(renderIllustration(cathedralWarrior));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const everyNode = svg!.querySelectorAll('*');
    for (const node of everyNode) {
      for (const attr of ['fill', 'stroke']) {
        const value = node.getAttribute(attr);
        if (value === null) continue;
        expect(
          ALLOWED_COLOR_PATTERN.test(value),
          `Expected ${attr}="${value}" on <${node.nodeName.toLowerCase()}> to match ${ALLOWED_COLOR_PATTERN}`,
        ).toBe(true);
      }
    }
  });

  it('sets a descriptive non-empty aria-label', () => {
    const { container } = render(renderIllustration(cathedralWarrior));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const label = svg!.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label!.length).toBeGreaterThan(0);
    expect(label).toMatch(/illustration/i);
    expect(label).toMatch(/warrior/i);
  });
});

describe('renderIllustration — theme swap', () => {
  it('swaps primary fill from emerald (cathedral) to sapphire (arcane) without touching silhouette paths', () => {
    const cathedralElement = renderIllustration(cathedralWarrior);
    const { container: cathedralContainer } = render(cathedralElement);
    const cathedralPrimary = cathedralContainer.querySelector('g#fill-primary');
    expect(cathedralPrimary?.getAttribute('fill')).toBe('var(--hc-jewel-emerald-500)');

    const arcaneSpec: IllustrationSpec = { ...cathedralWarrior, theme: 'arcane' };
    const arcaneElement = renderIllustration(arcaneSpec);
    const { container: arcaneContainer } = render(arcaneElement);
    const arcanePrimary = arcaneContainer.querySelector('g#fill-primary');
    expect(arcanePrimary?.getAttribute('fill')).toBe('var(--hc-jewel-sapphire-500)');

    // Secondary tone should swap too (emerald-300 → sapphire-300).
    const cathedralSecondary = cathedralContainer.querySelector('g#fill-secondary');
    expect(cathedralSecondary?.getAttribute('fill')).toBe('var(--hc-jewel-emerald-300)');
    const arcaneSecondary = arcaneContainer.querySelector('g#fill-secondary');
    expect(arcaneSecondary?.getAttribute('fill')).toBe('var(--hc-jewel-sapphire-300)');

    // Silhouette path data must be identical — theme only changes colors.
    const cathedralPaths = Array.from(cathedralPrimary!.querySelectorAll('path')).map((p) =>
      p.getAttribute('d'),
    );
    const arcanePaths = Array.from(arcanePrimary!.querySelectorAll('path')).map((p) =>
      p.getAttribute('d'),
    );
    expect(arcanePaths).toEqual(cathedralPaths);
  });
});

describe('renderIllustration — error handling', () => {
  it('throws when the spec fails validation', () => {
    const invalid: IllustrationSpec = { ...cathedralWarrior, cellBudget: 1 };
    expect(() => renderIllustration(invalid)).toThrow(/invalid IllustrationSpec/);
  });

  it('throws a clear error for silhouettes with no concrete path data yet (vector-only specs)', () => {
    const sentinelSpec: IllustrationSpec = {
      ...cathedralWarrior,
      subtype: 'sentinel',
      silhouetteId: 'hero_sentinel_shield',
      rasterImageUrl: undefined,
    };
    expect(() => renderIllustration(sentinelSpec)).toThrow(
      /path data not yet implemented for silhouette: hero_sentinel_shield/,
    );
  });

  it('throws a clear error for segmentations with no concrete path data yet (vector-only specs)', () => {
    const shieldSpec: IllustrationSpec = {
      ...cathedralWarrior,
      segmentationId: 'shield_facets',
      rasterImageUrl: undefined,
    };
    expect(() => renderIllustration(shieldSpec)).toThrow(
      /path data not yet implemented for segmentation: shield_facets/,
    );
  });

  it('throws a clear error for ornaments with no concrete path data yet (vector-only specs)', () => {
    const ringSpec: IllustrationSpec = {
      ...cathedralWarrior,
      ornamentId: 'arcane_ring',
      rasterImageUrl: undefined,
    };
    expect(() => renderIllustration(ringSpec)).toThrow(
      /path data not yet implemented for ornament: arcane_ring/,
    );
  });

  it('does NOT throw on missing path data when the spec is raster-only (rasterImageUrl set)', () => {
    const monsterSpec: IllustrationSpec = {
      ...cathedralWarrior,
      archetype: 'monster',
      subtype: 'stalker',
      paletteRole: 'monster',
      silhouetteId: 'monster_stalker_cloaked',
      segmentationId: 'broken_spires',
      ornamentId: 'thorned_vines',
      rasterImageUrl: '/illustrations/test_raster.webp',
    };
    expect(() => renderIllustration(monsterSpec)).not.toThrow();
  });
});
