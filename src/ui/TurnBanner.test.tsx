import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TurnBanner from './TurnBanner';

describe('TurnBanner', () => {
  it('renders "Player 1 — Turn 1" when no champion is supplied', () => {
    render(<TurnBanner currentPlayerIndex={0} turn={1} />);
    const banner = screen.getByTestId('turn-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Player 1');
    expect(banner).toHaveTextContent('Turn 1');
  });

  it('reflects the supplied turn number and 1-indexed player number', () => {
    render(<TurnBanner currentPlayerIndex={2} turn={7} />);
    const banner = screen.getByTestId('turn-banner');
    expect(banner).toHaveTextContent('Player 3');
    expect(banner).toHaveTextContent('Turn 7');
  });

  it('includes the champion display name when a known championId is supplied (embertide-57p)', () => {
    render(<TurnBanner currentPlayerIndex={1} turn={4} championId="champion-sword" />);
    const banner = screen.getByTestId('turn-banner');
    expect(banner).toHaveTextContent('Player 2');
    expect(banner).toHaveTextContent('Blade Warden');
    expect(banner).toHaveTextContent('Turn 4');
  });

  it('falls back to the raw id when the championId is unknown', () => {
    render(<TurnBanner currentPlayerIndex={0} turn={2} championId="unknown-id" />);
    const banner = screen.getByTestId('turn-banner');
    expect(banner).toHaveTextContent('unknown-id');
    expect(banner).toHaveTextContent('Turn 2');
  });
});
