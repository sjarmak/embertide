import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChampionSlot from './ChampionSlot';
import type { KidPlayer } from '../store/types';
import { makeKidPlayer } from '../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player 1',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

describe('ChampionSlot', () => {
  it('renders the slot with a visible name plate + tooltip passive effect (designer 2026-04-24)', () => {
    render(<ChampionSlot player={makePlayer({ championSlot: 'champion-courage' })} />);
    const slot = screen.getByTestId('champion-slot-p0');
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveAttribute('data-champion-slot', 'champion-courage');

    // Designer feedback 2026-04-24: the tile now mirrors the Setup
    // champion pick tile — the champion display name renders as a
    // visible plate below the portrait. The passive-ability effect
    // stays in the hover tooltip (`title`) + a11y label to avoid
    // cluttering the small tray cell.
    const nameEl = screen.getByTestId('champion-slot-p0-name');
    expect(nameEl).toHaveTextContent('Valor Warden');

    const title = slot.getAttribute('title') ?? '';
    expect(title).toContain('Valor Warden');
    expect(title).toMatch(/mini-boss|final-boss|heart/i);
    // Designer polish 2026-04-22 Round 2 (Issue 2): the tooltip must not
    // leak the generic SVG aria-label ("hero ... illustration") — the
    // portrait SVG is `pointer-events: none` in CSS so the browser resolves
    // the tooltip from the wrapper's `title`, which we assert on directly.
    expect(title.toLowerCase()).not.toContain('hero illustration');
    expect(title.toLowerCase()).not.toContain('illustration');
    const ariaLabel = slot.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Valor Warden');
    expect(ariaLabel).toMatch(/mini-boss|final-boss|heart/i);
  });

  it.each([
    ['champion-courage', 'Valor Warden'],
    ['champion-wisdom', 'Lore Warden'],
    ['champion-power', 'Might Warden'],
    ['champion-sword', 'Blade Warden'],
  ] as const)(
    'renders %s with the correct display name in both plate + tooltip',
    (championSlot, expectedName) => {
      render(<ChampionSlot player={makePlayer({ championSlot })} />);
      const slot = screen.getByTestId('champion-slot-p0');
      expect(slot).toHaveAttribute('data-champion-slot', championSlot);
      expect(screen.getByTestId('champion-slot-p0-name')).toHaveTextContent(expectedName);
      expect(slot.getAttribute('title') ?? '').toContain(expectedName);
      expect(slot.getAttribute('aria-label') ?? '').toContain(expectedName);
    },
  );

  it('includes current HP in the tooltip for the player-status readout', () => {
    render(<ChampionSlot player={makePlayer({ hp: 3, hpMax: 5 })} />);
    const slot = screen.getByTestId('champion-slot-p0');
    expect(slot.getAttribute('title') ?? '').toContain('HP 3/5');
  });

  it('marks the emblem active when the viewing player is the active one', () => {
    render(<ChampionSlot player={makePlayer()} isActive />);
    const slot = screen.getByTestId('champion-slot-p0');
    expect(slot).toHaveAttribute('data-active', 'true');
  });

  it('mounts a pulse element keyed on championPassivePulse (base case: pulse=0)', () => {
    render(<ChampionSlot player={makePlayer({ championPassivePulse: 0 })} />);
    const pulse = screen.getByTestId('champion-slot-p0-pulse');
    expect(pulse).toBeInTheDocument();
  });

  it('remounts the pulse node when championPassivePulse changes (passive-fire surface)', () => {
    const { rerender } = render(<ChampionSlot player={makePlayer({ championPassivePulse: 0 })} />);
    const initialPulse = screen.getByTestId('champion-slot-p0-pulse');
    rerender(<ChampionSlot player={makePlayer({ championPassivePulse: 1 })} />);
    const nextPulse = screen.getByTestId('champion-slot-p0-pulse');
    // The node is remounted — different DOM element instance — which is how
    // framer-motion is forced to replay its mount animation. This is the
    // testable observable for "pulses on passive fire"; the CSS animation
    // itself is not asserted because JSDOM does not execute style timelines.
    expect(nextPulse).not.toBe(initialPulse);
  });

  it('falls back to [v2-art-pending] frame when championSlot is null', () => {
    render(<ChampionSlot player={makePlayer({ championSlot: null })} />);
    const slot = screen.getByTestId('champion-slot-p0');
    expect(slot).toBeInTheDocument();
    // ArtPendingFrame renders the v2-art-pending ribbon text.
    expect(slot.textContent).toMatch(/v2-art-pending/i);
  });
});
