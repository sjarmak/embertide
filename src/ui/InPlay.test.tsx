import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InPlay from './InPlay';
import { KID_CARDS } from '../data/cards';
import { STARTER_GREEN } from '../store/slices/deck';
import { useDropHintStore } from '../store/dropHintStore';

const SAGE = KID_CARDS.find((c) => c.id === 'sage-keeper')!;
const WATER = KID_CARDS.find((c) => c.id === 'water-warrior')!;

describe('InPlay', () => {
  beforeEach(() => {
    // Reset the persisted "first drop seen" flag so each test starts as a
    // first-run player. Tests that need the post-first-run state call
    // markSeen() explicitly.
    useDropHintStore.getState().reset();
  });

  it('renders an empty container with a drop-zone target when no cards have been played', () => {
    render(<InPlay cards={[]} />);
    const zone = screen.getByTestId('in-play');
    expect(zone).toBeInTheDocument();
    // No per-card tiles; the fsyd drop-zone target is shown instead.
    expect(zone.querySelectorAll('[data-testid^="in-play-card-"]')).toHaveLength(0);
    expect(screen.getByTestId('drop-zone-empty')).toBeInTheDocument();
  });

  it('renders N tiles for N cards played this turn', () => {
    render(<InPlay cards={[SAGE, WATER, STARTER_GREEN]} />);
    const zone = screen.getByTestId('in-play');
    const tiles = zone.querySelectorAll('[data-testid^="in-play-card-"]');
    expect(tiles).toHaveLength(3);
    expect(screen.getByTestId(`in-play-card-${SAGE.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`in-play-card-${WATER.id}`)).toBeInTheDocument();
    // No drop-zone target when tiles are rendered (the in-play tiles
    // occupy the same surface — fsyd §7).
    expect(screen.queryByTestId('drop-zone-empty')).toBeNull();
  });

  it('tiles are not buttons (inPlay is read-only)', () => {
    const { container } = render(<InPlay cards={[SAGE]} />);
    // Not clickable — no <button> elements inside the zone.
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });

  it('first-run empty state shows the "Drag a card here to play it" hint + painterly chrome (arq3)', () => {
    render(<InPlay cards={[]} />);
    const dropZone = screen.getByTestId('drop-zone-empty');
    expect(dropZone).toHaveAttribute('data-first-run', 'true');
    expect(dropZone.classList.contains('drop-zone-first-run')).toBe(true);
    expect(screen.getByText('Drag a card here to play it')).toBeInTheDocument();
  });

  it('post-first-run empty state drops the hint copy + painterly class (arq3)', () => {
    useDropHintStore.getState().markSeen();
    render(<InPlay cards={[]} />);
    const dropZone = screen.getByTestId('drop-zone-empty');
    expect(dropZone).toHaveAttribute('data-first-run', 'false');
    expect(dropZone.classList.contains('drop-zone-first-run')).toBe(false);
    expect(screen.queryByText('Drag a card here to play it')).toBeNull();
  });
});
