import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArtPendingFrame from './ArtPendingFrame';

describe('ArtPendingFrame', () => {
  it('renders a ribbon with the [v2-art-pending] text', () => {
    render(<ArtPendingFrame />);
    const ribbon = screen.getByTestId('art-pending-frame-ribbon');
    expect(ribbon).toBeInTheDocument();
    expect(ribbon.textContent).toContain('[v2-art-pending]');
  });

  it('renders child content inside the frame', () => {
    render(
      <ArtPendingFrame>
        <span data-testid="child-fallback">fallback</span>
      </ArtPendingFrame>,
    );
    expect(screen.getByTestId('child-fallback')).toBeInTheDocument();
    // Ribbon still rendered alongside children.
    expect(screen.getByTestId('art-pending-frame-ribbon').textContent).toContain(
      '[v2-art-pending]',
    );
  });

  it('appends the follow-up bead id to the ribbon when provided', () => {
    render(<ArtPendingFrame followUpBeadId="bd-42" />);
    const ribbon = screen.getByTestId('art-pending-frame-ribbon');
    expect(ribbon.textContent).toContain('[v2-art-pending]');
    expect(ribbon.textContent).toContain('bd-42');
  });

  it('suffixes the test id so multiple frames can coexist on one surface', () => {
    render(
      <div>
        <ArtPendingFrame testIdSuffix="hero" />
        <ArtPendingFrame testIdSuffix="boss" />
      </div>,
    );
    expect(screen.getByTestId('art-pending-frame-hero')).toBeInTheDocument();
    expect(screen.getByTestId('art-pending-frame-boss')).toBeInTheDocument();
    expect(screen.getByTestId('art-pending-frame-hero-ribbon').textContent).toContain(
      '[v2-art-pending]',
    );
    expect(screen.getByTestId('art-pending-frame-boss-ribbon').textContent).toContain(
      '[v2-art-pending]',
    );
  });

  it('sets role=status and aria-label on the ribbon for screen readers', () => {
    render(<ArtPendingFrame followUpBeadId="bd-9" />);
    const ribbon = screen.getByTestId('art-pending-frame-ribbon');
    expect(ribbon.getAttribute('role')).toBe('status');
    expect(ribbon.getAttribute('aria-label')).toContain('[v2-art-pending]');
    expect(ribbon.getAttribute('aria-label')).toContain('bd-9');
  });
});
