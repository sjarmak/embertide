import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItemCell from './ItemCell';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';

const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;
const WISP = KID_CARDS.find((c) => c.id === 'wisp')!;

describe('ItemCell', () => {
  it('renders a card tile with the data-role attribute', () => {
    render(<ItemCell card={SHORT_SWORD} />);
    const tile = screen.getByTestId(`item-${SHORT_SWORD.id}`);
    expect(tile).toBeInTheDocument();
    expect(tile.getAttribute('data-role')).toBe('item');
  });

  it('renders the "Ready" cooldown readout when cooldownTurns=0', () => {
    render(<ItemCell card={SHORT_SWORD} />);
    expect(screen.getByTestId(`item-cooldown-${SHORT_SWORD.id}`)).toHaveTextContent('Ready');
  });

  it('renders the turns-remaining readout when cooldownTurns > 0', () => {
    const cooling: Card = { ...SHORT_SWORD, id: 'short-sword-hot', cooldownTurns: 3 };
    render(<ItemCell card={cooling} />);
    const readout = screen.getByTestId(`item-cooldown-${cooling.id}`);
    expect(readout).toHaveTextContent('3');
  });

  it('wraps the wisp in the [v2-art-pending] frame', () => {
    render(<ItemCell card={WISP} />);
    // ArtPendingFrame stamps `art-pending-frame*` testids; the default suffix
    // is the bare testid, but wisp passes a suffix to disambiguate.
    expect(screen.getByTestId('art-pending-frame-wisp-item-cell')).toBeInTheDocument();
  });

  it('non-wisp items do NOT render the [v2-art-pending] frame', () => {
    render(<ItemCell card={SHORT_SWORD} />);
    expect(screen.queryByTestId('art-pending-frame-wisp-item-cell')).toBeNull();
  });

  it('wisp with downed teammate id renders an ENABLED tap button; click calls onPlayFairy', () => {
    const onPlayFairy = vi.fn();
    render(<ItemCell card={WISP} downedTeammateId="p1" onPlayFairy={onPlayFairy} />);
    const tap = screen.getByTestId(`item-wisp-tap-${WISP.id}`);
    expect(tap).not.toBeDisabled();
    tap.click();
    expect(onPlayFairy).toHaveBeenCalledWith('p1');
  });

  it('wisp without a downed teammate id renders a DISABLED tap button (no consumption)', () => {
    const onPlayFairy = vi.fn();
    render(<ItemCell card={WISP} downedTeammateId={null} onPlayFairy={onPlayFairy} />);
    const tap = screen.getByTestId(`item-wisp-tap-${WISP.id}`);
    expect(tap).toBeDisabled();
    tap.click();
    expect(onPlayFairy).not.toHaveBeenCalled();
  });

  it('wisp with no onPlayFairy prop still renders the card (read-only)', () => {
    render(<ItemCell card={WISP} />);
    expect(screen.getByTestId(`item-${WISP.id}`)).toBeInTheDocument();
    // Tap button should not be rendered without a handler — the cell is
    // effectively a display tile.
    expect(screen.queryByTestId(`item-wisp-tap-${WISP.id}`)).toBeNull();
  });
});
