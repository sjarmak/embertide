import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const reducedMotionRef = { value: false };
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionRef.value,
  };
});

import HeartGainFx from './HeartGainFx';

/**
 * embertide-4m5.4 — HeartGainFx component tests (A2 acceptance).
 *
 * Path B (separate FX component, sibling of HeartFeedback) chosen so the
 * gain-only sparkle/halo doesn't bloat HeartFeedback's signed-delta text
 * concern. These tests pin the prop contract, the `delta <= 0` no-render
 * guard, the completion callback, and the prefers-reduced-motion path.
 */

const installMatchMedia = (matches: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matches && query.toLowerCase().includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

describe('HeartGainFx (embertide-4m5.4)', () => {
  beforeEach(() => {
    installMatchMedia(false);
    reducedMotionRef.value = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    reducedMotionRef.value = false;
  });

  it('mounts with the player-scoped test id when delta > 0', () => {
    render(<HeartGainFx playerId="p0" delta={1} />);
    const el = screen.getByTestId('heart-gain-fx-p0');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-delta', '1');
  });

  it('renders nothing for delta === 0', () => {
    const { container } = render(<HeartGainFx playerId="p0" delta={0} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('heart-gain-fx-p0')).toBeNull();
  });

  it('renders nothing for negative deltas (loss is HeartFeedback territory)', () => {
    const { container } = render(<HeartGainFx playerId="p0" delta={-2} />);
    expect(container.firstChild).toBeNull();
  });

  it('scopes the test id to the given player id', () => {
    render(<HeartGainFx playerId="p1" delta={2} />);
    expect(screen.getByTestId('heart-gain-fx-p1')).toHaveAttribute('data-delta', '2');
    expect(screen.queryByTestId('heart-gain-fx-p0')).toBeNull();
  });

  it('fires onComplete after the full animation cycle (~400ms)', () => {
    const onComplete = vi.fn();
    render(<HeartGainFx playerId="p0" delta={1} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete when delta is non-positive', () => {
    const onComplete = vi.fn();
    render(<HeartGainFx playerId="p0" delta={0} onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders three sparkle particles inside the FX root', () => {
    const { container } = render(<HeartGainFx playerId="p0" delta={1} />);
    const root = container.querySelector('.heart-gain-fx');
    expect(root).not.toBeNull();
    const sparkles = root?.querySelectorAll('.heart-gain-fx-sparkle');
    expect(sparkles?.length).toBe(3);
  });

  it('renders a single halo overlay alongside the sparkles', () => {
    const { container } = render(<HeartGainFx playerId="p0" delta={1} />);
    expect(container.querySelectorAll('.heart-gain-fx-halo').length).toBe(1);
  });

  it('is aria-hidden so screen readers rely on the sockets row label', () => {
    render(<HeartGainFx playerId="p0" delta={1} />);
    expect(screen.getByTestId('heart-gain-fx-p0')).toHaveAttribute('aria-hidden', 'true');
  });

  describe('prefers-reduced-motion', () => {
    beforeEach(() => {
      reducedMotionRef.value = true;
    });

    it('renders nothing under reduced-motion (A4 — instant heart count-up)', () => {
      const { container } = render(<HeartGainFx playerId="p0" delta={1} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('heart-gain-fx-p0')).toBeNull();
    });

    it('still fires onComplete promptly under reduced-motion for symmetric consumer logic', () => {
      const onComplete = vi.fn();
      render(<HeartGainFx playerId="p0" delta={2} onComplete={onComplete} />);
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
