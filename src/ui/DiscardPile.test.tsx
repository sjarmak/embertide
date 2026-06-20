import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import DiscardPile from './DiscardPile';
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

describe('DiscardPile', () => {
  it('renders the discard variant with "Discard" label when empty', () => {
    render(<DiscardPile cards={[]} />);
    const pile = screen.getByTestId('discard-pile');
    expect(pile).toHaveAttribute('data-variant', 'discard');
    expect(pile).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('discard-pile-label')).toHaveTextContent('Discard');
  });

  it('opens the full-pile viewer when the pile is tapped', () => {
    const cards = [mkCard('older'), mkCard('newer')];
    const onOpenPile = vi.fn();
    render(<DiscardPile cards={cards} onOpenPile={onOpenPile} />);
    fireEvent.click(screen.getByTestId('discard-pile-top'));
    expect(onOpenPile).toHaveBeenCalledTimes(1);
  });
});
