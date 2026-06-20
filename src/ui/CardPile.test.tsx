import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import CardPile from './CardPile';
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

describe('CardPile', () => {
  it('renders the empty-state frame and label when cards is empty', () => {
    render(<CardPile variant="discard" label="Discard" cards={[]} testId="discard-pile" />);
    const pile = screen.getByTestId('discard-pile');
    expect(pile).toBeInTheDocument();
    expect(pile).toHaveAttribute('data-empty', 'true');
    expect(pile).toHaveAttribute('data-variant', 'discard');
    expect(screen.getByTestId('discard-pile-label')).toHaveTextContent('Discard');
    expect(screen.queryByTestId('discard-pile-top')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discard-pile-count')).not.toBeInTheDocument();
  });

  it('renders the top (last) card face-up when populated', () => {
    const cards = [mkCard('first'), mkCard('second'), mkCard('top')];
    render(<CardPile variant="discard" label="Discard" cards={cards} testId="discard-pile" />);
    const pile = screen.getByTestId('discard-pile');
    expect(pile).toHaveAttribute('data-count', '3');
    expect(pile).not.toHaveAttribute('data-empty');
    const top = screen.getByTestId('discard-pile-top');
    expect(top).toBeInTheDocument();
  });

  it('omits the count badge when only one card is in the pile (no "×1")', () => {
    render(
      <CardPile variant="discard" label="Discard" cards={[mkCard('only')]} testId="discard-pile" />,
    );
    expect(screen.queryByTestId('discard-pile-count')).not.toBeInTheDocument();
  });

  it('shows the count badge as ×N when the pile holds 2+ cards', () => {
    render(
      <CardPile
        variant="discard"
        label="Discard"
        cards={[mkCard('a'), mkCard('b'), mkCard('c'), mkCard('d')]}
        testId="discard-pile"
      />,
    );
    expect(screen.getByTestId('discard-pile-count')).toHaveTextContent('×4');
  });

  it('calls onOpenPile on tile tap (opens the full-pile viewer)', () => {
    const onOpenPile = vi.fn();
    const cards = [mkCard('alpha'), mkCard('beta')];
    render(
      <CardPile
        variant="discard"
        label="Discard"
        cards={cards}
        testId="discard-pile"
        onOpenPile={onOpenPile}
      />,
    );
    fireEvent.click(screen.getByTestId('discard-pile-top'));
    expect(onOpenPile).toHaveBeenCalledTimes(1);
  });

  it('gives the tap target an accessible "view all" name when interactive', () => {
    render(
      <CardPile
        variant="discard"
        label="Discard"
        cards={[mkCard('a'), mkCard('b')]}
        testId="discard-pile"
        onOpenPile={vi.fn()}
      />,
    );
    const tile = screen.getByTestId('discard-pile-top');
    expect(tile.tagName).toBe('BUTTON');
    expect(tile).toHaveAccessibleName(/view all cards/i);
  });

  it('renders a non-interactive top tile when onOpenPile is omitted', () => {
    render(
      <CardPile variant="discard" label="Discard" cards={[mkCard('only')]} testId="discard-pile" />,
    );
    const top = screen.getByTestId('discard-pile-top');
    // non-interactive: no <button>, just a div
    expect(top.tagName).toBe('DIV');
  });

  it('paints the void variant chrome when variant=void', () => {
    render(<CardPile variant="void" label="Void" cards={[mkCard('voided')]} testId="void-pane" />);
    const pile = screen.getByTestId('void-pane');
    expect(pile).toHaveAttribute('data-variant', 'void');
    expect(pile.className).toContain('card-pile-void');
  });
});
