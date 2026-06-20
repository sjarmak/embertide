import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmbertideStrip from './EmbertideStrip';
import type { SharedEmbertide } from '../store/types';

function shards(partial: Partial<SharedEmbertide> = {}): SharedEmbertide {
  return { wisdom: false, courage: false, power: false, ...partial };
}

describe('EmbertideStrip', () => {
  it('renders three shards (wisdom, courage, power) even when all flags are false', () => {
    render(<EmbertideStrip shards={shards()} />);
    expect(screen.getByTestId('embertide-strip')).toBeInTheDocument();
    expect(screen.getByTestId('embertide-shard-wisdom')).toBeInTheDocument();
    expect(screen.getByTestId('embertide-shard-courage')).toBeInTheDocument();
    expect(screen.getByTestId('embertide-shard-power')).toBeInTheDocument();
  });

  it('all three shards render unfilled with correct aria when no shard is earned', () => {
    render(<EmbertideStrip shards={shards()} />);
    for (const id of ['wisdom', 'courage', 'power'] as const) {
      const el = screen.getByTestId(`embertide-shard-${id}`);
      expect(el.getAttribute('data-filled')).toBe('false');
      expect(el.getAttribute('aria-label')).toMatch(/not earned/i);
    }
  });

  it('only wisdom filled → wisdom filled, others empty', () => {
    render(<EmbertideStrip shards={shards({ wisdom: true })} />);
    const wisdom = screen.getByTestId('embertide-shard-wisdom');
    expect(wisdom.getAttribute('data-filled')).toBe('true');
    expect(wisdom.getAttribute('aria-label')).toMatch(/Wisdom shard \(earned\)/i);

    expect(screen.getByTestId('embertide-shard-courage').getAttribute('data-filled')).toBe('false');
    expect(screen.getByTestId('embertide-shard-power').getAttribute('data-filled')).toBe('false');
  });

  it('only courage filled → courage filled, others empty', () => {
    render(<EmbertideStrip shards={shards({ courage: true })} />);
    expect(screen.getByTestId('embertide-shard-wisdom').getAttribute('data-filled')).toBe('false');
    const courage = screen.getByTestId('embertide-shard-courage');
    expect(courage.getAttribute('data-filled')).toBe('true');
    expect(courage.getAttribute('aria-label')).toMatch(/Courage shard \(earned\)/i);
    expect(screen.getByTestId('embertide-shard-power').getAttribute('data-filled')).toBe('false');
  });

  it('only power filled → power filled, others empty', () => {
    render(<EmbertideStrip shards={shards({ power: true })} />);
    expect(screen.getByTestId('embertide-shard-wisdom').getAttribute('data-filled')).toBe('false');
    expect(screen.getByTestId('embertide-shard-courage').getAttribute('data-filled')).toBe('false');
    const power = screen.getByTestId('embertide-shard-power');
    expect(power.getAttribute('data-filled')).toBe('true');
    expect(power.getAttribute('aria-label')).toMatch(/Power shard \(earned\)/i);
  });

  it('two filled (wisdom + power) → courage remains empty', () => {
    render(<EmbertideStrip shards={shards({ wisdom: true, power: true })} />);
    expect(screen.getByTestId('embertide-shard-wisdom').getAttribute('data-filled')).toBe('true');
    expect(screen.getByTestId('embertide-shard-courage').getAttribute('data-filled')).toBe('false');
    expect(screen.getByTestId('embertide-shard-power').getAttribute('data-filled')).toBe('true');
  });

  it('all three filled (victory state) → every shard data-filled=true', () => {
    render(<EmbertideStrip shards={shards({ wisdom: true, courage: true, power: true })} />);
    for (const id of ['wisdom', 'courage', 'power'] as const) {
      const el = screen.getByTestId(`embertide-shard-${id}`);
      expect(el.getAttribute('data-filled')).toBe('true');
      expect(el.getAttribute('aria-label')).toMatch(/earned/i);
    }
  });

  // Designer spec 2026-04-22 rev-3: empty slots render as recessed
  // cathedral-niche hollows (no glow filter — the dark concavity is
  // visually inert) while filled slots receive a soft gold glow via
  // SVG `feGaussianBlur` so they read as lit stained glass. These
  // assertions pin the state-dependent glow so future refactors can't
  // regress the "empty sockets are visually inert" requirement.
  it('empty shards do not have the gold-glow filter applied', () => {
    render(<EmbertideStrip shards={shards()} />);
    for (const id of ['wisdom', 'courage', 'power'] as const) {
      const el = screen.getByTestId(`embertide-shard-${id}`);
      expect(el.getAttribute('data-glow-filter')).toBe('none');
      // SVG `filter` attribute should also be absent (not just 'none').
      expect(el.getAttribute('filter')).toBeNull();
    }
  });

  it('filled shards have the gold-glow filter applied', () => {
    render(<EmbertideStrip shards={shards({ wisdom: true, courage: true, power: true })} />);
    for (const id of ['wisdom', 'courage', 'power'] as const) {
      const el = screen.getByTestId(`embertide-shard-${id}`);
      const glowMarker = el.getAttribute('data-glow-filter');
      expect(glowMarker).not.toBe('none');
      expect(glowMarker).toMatch(/^url\(#hc-embertide-glow-/);
      expect(el.getAttribute('filter')).toBe(glowMarker);
    }
  });
});
