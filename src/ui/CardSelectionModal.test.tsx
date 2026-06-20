import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardSelectionModal from './CardSelectionModal';
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

describe('CardSelectionModal', () => {
  it('renders one tap-target per card', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(
      <CardSelectionModal
        cards={[mkCard('a'), mkCard('b'), mkCard('c')]}
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('card-selection-card-a')).toBeInTheDocument();
    expect(screen.getByTestId('card-selection-card-b')).toBeInTheDocument();
    expect(screen.getByTestId('card-selection-card-c')).toBeInTheDocument();
  });

  it('fires onSelect with the tapped cardId', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(
      <CardSelectionModal
        cards={[mkCard('a'), mkCard('b')]}
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('card-selection-card-b'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires onCancel when ESC is pressed', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<CardSelectionModal cards={[mkCard('a')]} onSelect={onSelect} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fires onCancel when the dedicated Cancel button is tapped', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<CardSelectionModal cards={[mkCard('a')]} onSelect={onSelect} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('card-selection-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a custom title when provided', () => {
    render(
      <CardSelectionModal
        cards={[mkCard('a')]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        title="Pick your sacrifice"
      />,
    );
    expect(screen.getByText('Pick your sacrifice')).toBeInTheDocument();
  });

  it('renders an empty-state hint when cards is an empty array', () => {
    render(<CardSelectionModal cards={[]} onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('card-selection-empty')).toBeInTheDocument();
  });
});
