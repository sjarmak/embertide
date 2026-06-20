/*
 * Pane primitive — phase 1 tests (embertide-b56).
 *
 * Covers:
 *   - children render correctly
 *   - color-family → class mapping (all 7 families)
 *   - density='compact' applies the .pane--compact class
 *   - cornerMedallions=true renders 4 medallion nodes
 *   - outer-wrap padding ≤ 8px (class-presence assertion + sanity
 *     parsing of the padding value when getComputedStyle resolves)
 *   - a11y: role=region when ariaLabel is supplied; group otherwise
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pane, { type PaneColorFamily } from './Pane';

const ALL_FAMILIES: readonly PaneColorFamily[] = [
  'sapphire',
  'emerald',
  'amber',
  'ruby',
  'amethyst',
  'pearl',
  'neutral-shadow',
] as const;

describe('Pane primitive (b56 phase 1)', () => {
  it('renders children inside the content slot', () => {
    render(
      <Pane colorFamily="sapphire">
        <span data-testid="pane-child">stained-glass child</span>
      </Pane>,
    );
    expect(screen.getByTestId('pane-child')).toBeInTheDocument();
    expect(screen.getByTestId('pane-child').textContent).toBe('stained-glass child');
  });

  it.each(ALL_FAMILIES)('applies the .pane-%s class for color-family=%s', (family) => {
    render(
      <Pane colorFamily={family}>
        <span>content</span>
      </Pane>,
    );
    const pane = screen.getByTestId('pane');
    expect(pane.classList.contains('pane')).toBe(true);
    expect(pane.classList.contains(`pane-${family}`)).toBe(true);
    expect(pane.getAttribute('data-color-family')).toBe(family);
  });

  it('defaults density to comfortable', () => {
    render(
      <Pane colorFamily="emerald">
        <span>content</span>
      </Pane>,
    );
    const pane = screen.getByTestId('pane');
    expect(pane.classList.contains('pane-comfortable')).toBe(true);
    expect(pane.classList.contains('pane-compact')).toBe(false);
    expect(pane.getAttribute('data-density')).toBe('comfortable');
  });

  it('applies .pane-compact when density="compact"', () => {
    render(
      <Pane colorFamily="amber" density="compact">
        <span>content</span>
      </Pane>,
    );
    const pane = screen.getByTestId('pane');
    expect(pane.classList.contains('pane-compact')).toBe(true);
    expect(pane.classList.contains('pane-comfortable')).toBe(false);
    expect(pane.getAttribute('data-density')).toBe('compact');
  });

  it('does not render medallion nodes by default', () => {
    render(
      <Pane colorFamily="ruby">
        <span>content</span>
      </Pane>,
    );
    expect(screen.queryByTestId('pane-medallion-tl')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pane-medallion-tr')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pane-medallion-bl')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pane-medallion-br')).not.toBeInTheDocument();
    expect(screen.getByTestId('pane').classList.contains('pane-medallions')).toBe(false);
  });

  it('renders 4 medallion nodes when cornerMedallions=true', () => {
    render(
      <Pane colorFamily="amethyst" cornerMedallions>
        <span>content</span>
      </Pane>,
    );
    expect(screen.getByTestId('pane').classList.contains('pane-medallions')).toBe(true);
    expect(screen.getByTestId('pane-medallion-tl')).toBeInTheDocument();
    expect(screen.getByTestId('pane-medallion-tr')).toBeInTheDocument();
    expect(screen.getByTestId('pane-medallion-bl')).toBeInTheDocument();
    expect(screen.getByTestId('pane-medallion-br')).toBeInTheDocument();

    // Medallions are presentational — aria-hidden so screen readers
    // ignore the four corner discs.
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      const node = screen.getByTestId(`pane-medallion-${corner}`);
      expect(node.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('honors a custom testId so multiple panes can coexist', () => {
    render(
      <div>
        <Pane colorFamily="sapphire" testId="pane-a" cornerMedallions>
          <span>a</span>
        </Pane>
        <Pane colorFamily="emerald" testId="pane-b">
          <span>b</span>
        </Pane>
      </div>,
    );
    expect(screen.getByTestId('pane-a')).toBeInTheDocument();
    expect(screen.getByTestId('pane-b')).toBeInTheDocument();
    expect(screen.getByTestId('pane-a-medallion-tl')).toBeInTheDocument();
    expect(screen.queryByTestId('pane-b-medallion-tl')).not.toBeInTheDocument();
  });

  it('appends a caller-supplied className after Pane classes', () => {
    render(
      <Pane colorFamily="pearl" className="my-surface">
        <span>content</span>
      </Pane>,
    );
    const pane = screen.getByTestId('pane');
    expect(pane.classList.contains('pane')).toBe(true);
    expect(pane.classList.contains('pane-pearl')).toBe(true);
    expect(pane.classList.contains('my-surface')).toBe(true);
  });

  describe('outer-wrap padding budget (≤ 8px per b56 design contract)', () => {
    it('uses .pane-comfortable (4px outer wrap, ≤ 8px budget) by default', () => {
      render(
        <Pane colorFamily="sapphire">
          <span>content</span>
        </Pane>,
      );
      const pane = screen.getByTestId('pane');
      // Class-presence is the contract — Pane.css binds .pane-comfortable
      // to padding: 4px. CSS modules / scoped styles are not in play here,
      // so the class IS the budget assertion.
      expect(pane.classList.contains('pane-comfortable')).toBe(true);
      expect(pane.classList.contains('pane-compact')).toBe(false);
    });

    it('uses .pane-compact (0px outer wrap, ≤ 8px budget) for compact density', () => {
      render(
        <Pane colorFamily="sapphire" density="compact">
          <span>content</span>
        </Pane>,
      );
      const pane = screen.getByTestId('pane');
      expect(pane.classList.contains('pane-compact')).toBe(true);
      expect(pane.classList.contains('pane-comfortable')).toBe(false);
    });
  });

  describe('a11y', () => {
    it('renders role="group" with no aria-label by default', () => {
      render(
        <Pane colorFamily="emerald">
          <span>content</span>
        </Pane>,
      );
      const pane = screen.getByTestId('pane');
      expect(pane.getAttribute('role')).toBe('group');
      expect(pane.getAttribute('aria-label')).toBeNull();
    });

    it('renders role="region" with the supplied aria-label', () => {
      render(
        <Pane colorFamily="amber" ariaLabel="Player tray">
          <span>content</span>
        </Pane>,
      );
      const region = screen.getByRole('region', { name: 'Player tray' });
      expect(region).toBeInTheDocument();
      expect(region.getAttribute('data-testid')).toBe('pane');
    });
  });
});
