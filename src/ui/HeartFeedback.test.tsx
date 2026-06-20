import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeartFeedback from './HeartFeedback';

describe('HeartFeedback (embertide-9c7 + rev-2 2026-04-22)', () => {
  it('mounts with the correct test id and delta text for a positive gain', () => {
    render(<HeartFeedback playerId="p0" delta={1} />);
    const el = screen.getByTestId('heart-feedback-p0');
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('+1');
    expect(el).toHaveAttribute('data-direction', 'gain');
  });

  it('renders "-N" with loss styling for a negative delta', () => {
    render(<HeartFeedback playerId="p0" delta={-2} />);
    const el = screen.getByTestId('heart-feedback-p0');
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('-2');
    expect(el).toHaveAttribute('data-direction', 'loss');
    expect(el.className).toContain('heart-feedback-loss');
  });

  it('renders nothing when delta is zero', () => {
    const { container } = render(<HeartFeedback playerId="p0" delta={0} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('heart-feedback-p0')).toBeNull();
  });

  it('scopes the test id to the given player id so multiple trays stay distinct', () => {
    render(<HeartFeedback playerId="p1" delta={2} />);
    expect(screen.getByTestId('heart-feedback-p1')).toHaveTextContent('+2');
    expect(screen.queryByTestId('heart-feedback-p0')).toBeNull();
  });
});
