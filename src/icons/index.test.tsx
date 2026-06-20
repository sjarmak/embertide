import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import * as Icons from './index';

interface IconProps {
  size?: number;
  title?: string;
  tint?: string;
}

describe('icons vocabulary', () => {
  it('exports at most 13 icons (Kid Mode cap)', () => {
    // Original Kid Mode budget was 10. REQ-13 Phase 2d (gm0.4) added the
    // three Embertide-shard icons (cap raised to 13).
    expect(Object.keys(Icons).length).toBeLessThanOrEqual(13);
  });

  it('exports the expected icon names', () => {
    const expected = [
      'GreenShard',
      'RedShard',
      'Key',
      'Heart',
      'Sword',
      'Shield',
      'Hero',
      'Monster',
      'Chest',
      'Boss',
      // REQ-13 Phase 2d / gm0.4 Embertide-shard trio.
      'WisdomShard',
      'CourageShard',
      'PowerShard',
    ].sort();
    expect(Object.keys(Icons).sort()).toEqual(expected);
  });

  it.each(Object.entries(Icons))('renders %s as an <svg>', (_name, Component) => {
    const Icon = Component as ComponentType<IconProps>;
    const { container } = render(<Icon />);
    const root = container.firstChild as Element | null;
    expect(root).not.toBeNull();
    expect(root?.tagName.toLowerCase()).toBe('svg');
  });

  it.each(Object.entries(Icons))(
    '%s declares role="img" and is marked as a V-3 placeholder',
    (_name, Component) => {
      const Icon = Component as ComponentType<IconProps>;
      const { container } = render(<Icon />);
      const svg = container.firstChild as SVGSVGElement;
      expect(svg.getAttribute('role')).toBe('img');
      // V-3 substrate ships placeholders; final art lands in V-4.
      expect(svg.getAttribute('data-hc-placeholder')).toBe('true');
    },
  );

  it('defaults width and height to 24 when no props are passed', () => {
    const { container } = render(<Icons.Heart />);
    const svg = container.firstChild as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });

  it('honors explicit size prop on both width and height', () => {
    const { container } = render(<Icons.Sword size={48} />);
    const svg = container.firstChild as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
  });

  it('Hero icon accepts a tint override (champion-tinted variant)', () => {
    // icons.md §4: Hero is the only icon that re-tints by champion.
    // We accept a CSS color string for tint per the V-3 IconProps.
    const { container } = render(<Icons.Hero tint="#abcdef" />);
    const svg = container.firstChild as SVGSVGElement;
    // Ensure tint is consumed somewhere — render must succeed and the
    // tint string appears in the rendered SVG markup.
    expect(svg.outerHTML).toContain('#abcdef');
  });
});
