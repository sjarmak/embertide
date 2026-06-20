import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import VoidPane from './VoidPane';
import type { Card } from '../types/card';

const mkCard = (id: string): Card => ({
  id,
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain' },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
});

describe('VoidPane (embertide-g294)', () => {
  it('renders the void variant with "Void" label when empty', () => {
    render(<VoidPane cards={[]} />);
    const pane = screen.getByTestId('void-pane');
    expect(pane).toHaveAttribute('data-variant', 'void');
    expect(pane).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('void-pane-label')).toHaveTextContent('Void');
  });

  it('opens the full-pile viewer when the void pane is tapped', () => {
    const cards = [mkCard('first-banished'), mkCard('just-killed')];
    const onOpenPile = vi.fn();
    render(<VoidPane cards={cards} onOpenPile={onOpenPile} />);
    fireEvent.click(screen.getByTestId('void-pane-top'));
    expect(onOpenPile).toHaveBeenCalledTimes(1);
  });

  it('renders a count badge when the void holds more than one card', () => {
    const cards = [mkCard('a'), mkCard('b'), mkCard('c')];
    render(<VoidPane cards={cards} />);
    expect(screen.getByTestId('void-pane-count')).toHaveTextContent('×3');
  });
});
