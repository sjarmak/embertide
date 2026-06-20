import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import PileViewerModal from './PileViewerModal';
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

describe('PileViewerModal', () => {
  it('renders EVERY card in the pile, not just the top one', () => {
    const cards = [mkCard('a'), mkCard('b'), mkCard('c')];
    render(<PileViewerModal label="Discard" cards={cards} onClose={vi.fn()} />);
    const grid = screen.getByTestId('pile-viewer-grid');
    // One CardTemplate (→ one name node) per card in the pile.
    expect(within(grid).getAllByTestId('card-template-name')).toHaveLength(3);
    expect(within(grid).getAllByRole('listitem')).toHaveLength(3);
  });

  it('titles the dialog with the label and pluralised count', () => {
    render(<PileViewerModal label="Void" cards={[mkCard('a'), mkCard('b')]} onClose={vi.fn()} />);
    expect(screen.getByTestId('pile-viewer-modal')).toHaveTextContent('Void (2 cards)');
  });

  it('uses the singular noun for a one-card pile', () => {
    render(<PileViewerModal label="Discard" cards={[mkCard('only')]} onClose={vi.fn()} />);
    expect(screen.getByTestId('pile-viewer-modal')).toHaveTextContent('Discard (1 card)');
  });

  it('shows an empty hint when the pile holds no cards', () => {
    render(<PileViewerModal label="Void" cards={[]} onClose={vi.fn()} />);
    expect(screen.getByTestId('pile-viewer-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('pile-viewer-grid')).not.toBeInTheDocument();
  });

  it('calls onClose from the Close button', () => {
    const onClose = vi.fn();
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pile-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop tap but not on panel tap', () => {
    const onClose = vi.fn();
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pile-viewer-modal'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('pile-viewer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // k64i — art-forward + tap-to-expand.

  it('renders each pile card as a tap-to-expand button', () => {
    const cards = [mkCard('a'), mkCard('b')];
    render(<PileViewerModal label="Discard" cards={cards} onClose={vi.fn()} />);
    const tiles = screen.getAllByTestId('pile-viewer-card');
    expect(tiles).toHaveLength(2);
    tiles.forEach((tile) => {
      expect(tile.tagName).toBe('BUTTON');
      expect(tile).toHaveAccessibleName(/^Expand /);
    });
  });

  it('expands a card to full detail (read-only) on tap', () => {
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={vi.fn()} />);
    expect(screen.queryByTestId('card-detail-backdrop')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pile-viewer-card'));
    expect(screen.getByTestId('card-detail-backdrop')).toBeInTheDocument();
    // Read-only: a pile card has no action to take, so no action button —
    // only Close.
    expect(screen.queryByTestId('card-detail-action')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-detail-cancel')).toBeInTheDocument();
  });

  it('closes the detail view back to the grid without closing the pile', () => {
    const onClose = vi.fn();
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pile-viewer-card'));
    fireEvent.click(screen.getByTestId('card-detail-cancel'));
    expect(screen.queryByTestId('card-detail-backdrop')).not.toBeInTheDocument();
    // The pile viewer is still open and its onClose was never called.
    expect(screen.getByTestId('pile-viewer-grid')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes the expanded card first, leaving the pile open', () => {
    const onClose = vi.fn();
    render(<PileViewerModal label="Discard" cards={[mkCard('a')]} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pile-viewer-card'));
    fireEvent.keyDown(window, { key: 'Escape' });
    // CardDetailModal owns ESC while open; the pile must not collapse.
    expect(screen.queryByTestId('card-detail-backdrop')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // A second ESC now closes the pile itself.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
