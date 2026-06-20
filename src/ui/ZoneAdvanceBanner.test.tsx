import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ZoneAdvanceBanner from './ZoneAdvanceBanner';

describe('ZoneAdvanceBanner (u-5a)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the fromZone and toZone display names', () => {
    render(
      <ZoneAdvanceBanner fromZone="sylvani" toZone="emberpeak" onDismiss={() => undefined} />,
    );
    expect(screen.getByTestId('zone-advance-banner')).toBeInTheDocument();
    expect(screen.getByTestId('zone-advance-banner-from').textContent).toBe('Sylvanwood');
    expect(screen.getByTestId('zone-advance-banner-to').textContent).toBe('Emberpeak');
  });

  it('exposes an accessible aria-label describing the transition', () => {
    render(
      <ZoneAdvanceBanner
        fromZone="emberpeak"
        toZone="gilded-cage"
        onDismiss={() => undefined}
      />,
    );
    const banner = screen.getByTestId('zone-advance-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-label')).toBe(
      'Emberpeak cleared — Gilded Cage awaits',
    );
  });

  it('calls onDismiss after the default 2.2s duration (read-time floor >= 2.0s, embertide-4m5.3)', () => {
    const onDismiss = vi.fn();
    render(<ZoneAdvanceBanner fromZone="sylvani" toZone="emberpeak" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    // Should not fire before the 2.0s read-time floor.
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(201);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('honors a custom durationMs prop', () => {
    const onDismiss = vi.fn();
    render(
      <ZoneAdvanceBanner
        fromZone="sylvani"
        toZone="emberpeak"
        onDismiss={onDismiss}
        durationMs={500}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clears its timer on unmount so onDismiss never fires after teardown', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <ZoneAdvanceBanner fromZone="sylvani" toZone="emberpeak" onDismiss={onDismiss} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
