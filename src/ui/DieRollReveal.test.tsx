import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import DieRollReveal, { ROLL_BACKDROP_STYLE } from './DieRollReveal';

/**
 * DieRollReveal tests (embertide-ynn4 die-roll-animation pass).
 *
 * Animation phases drive most of the contract:
 *   - 0..900ms      tumble (skip disabled before 500ms)
 *   - 900..1100ms   settle
 *   - 1100..1400ms  reveal (outcome label visible)
 *   - 1400ms+       dismissable (tap-to-continue)
 *
 * Tests use `vi.useFakeTimers` to advance the React state machine
 * deterministically. Each `vi.advanceTimersByTime` is wrapped in `act`
 * so the rendered phase data attribute updates before assertions.
 */

describe('DieRollReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('renders the die with the resolved face after settle', () => {
    const onDismiss = vi.fn();
    render(<DieRollReveal face={4} onDismiss={onDismiss} title="Test Roll" />);
    advance(1100); // tumble + settle
    const die = screen.getByTestId('die-roll-reveal-die');
    expect(die.getAttribute('data-settled')).toBe('true');
    expect(die.getAttribute('data-face')).toBe('4');
  });

  it('renders the title when supplied', () => {
    render(<DieRollReveal face={1} onDismiss={vi.fn()} title="Forest Sage Omen" />);
    expect(screen.getByTestId('die-roll-reveal-title')).toHaveTextContent('Forest Sage Omen');
  });

  it('hides the outcome label until the reveal phase', () => {
    render(<DieRollReveal face={2} onDismiss={vi.fn()} outcomeLabel="+1 gem" />);
    advance(900); // end of tumble; phase=settle
    expect(screen.queryByTestId('die-roll-reveal-outcome')).toBeNull();
    advance(300); // 1200ms — phase=reveal
    expect(screen.getByTestId('die-roll-reveal-outcome')).toHaveTextContent('+1 gem');
  });

  it('dismiss button is disabled until skip-window opens (500ms)', () => {
    render(<DieRollReveal face={3} onDismiss={vi.fn()} />);
    const button = screen.getByTestId('die-roll-reveal-dismiss');
    expect(button).toBeDisabled();
    advance(500);
    expect(button).not.toBeDisabled();
  });

  it('tap-to-skip in the tumble phase fires onDismiss after the 500ms threshold', () => {
    const onDismiss = vi.fn();
    render(<DieRollReveal face={5} onDismiss={onDismiss} />);
    advance(550); // skip available
    fireEvent.click(screen.getByTestId('die-roll-reveal-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('tap before the 500ms threshold is ignored', () => {
    const onDismiss = vi.fn();
    render(<DieRollReveal face={6} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('die-roll-reveal-backdrop'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('auto-advances to the dismissable phase by 1.4s', () => {
    render(<DieRollReveal face={1} onDismiss={vi.fn()} />);
    advance(1400);
    const backdrop = screen.getByTestId('die-roll-reveal-backdrop');
    expect(backdrop.getAttribute('data-phase')).toBe('dismissable');
    expect(screen.getByTestId('die-roll-reveal-dismiss')).toHaveTextContent(/continue/i);
  });

  it('only fires onDismiss once on repeated taps', () => {
    const onDismiss = vi.fn();
    render(<DieRollReveal face={4} onDismiss={onDismiss} />);
    advance(1500);
    const button = screen.getByTestId('die-roll-reveal-dismiss');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clicking the panel does NOT close the reveal (only the backdrop / dismiss button does)', () => {
    const onDismiss = vi.fn();
    render(<DieRollReveal face={2} onDismiss={onDismiss} />);
    advance(1500);
    fireEvent.click(screen.getByTestId('die-roll-reveal-panel'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  // embertide-6846: lock the cream-toned veil to prevent regression
  // to the legacy pure-black scrim. Asserts on the exported constant
  // directly (not jsdom's inline-style round-trip, which is implementation-
  // dependent on the CSS shorthand serializer).
  it('backdrop uses the cathedral cream-toned veil (not pure-black) — embertide-6846', () => {
    expect(ROLL_BACKDROP_STYLE.background).toBe('rgba(20, 14, 4, 0.42)');
  });

  /**
   * Stained-glass d20 variant (embertide-x4r2). The dieType prop
   * swaps the pip-grid renderer for the pentagonal SVG; the rest of
   * the phase machine is unchanged.
   */
  describe('dieType="d20" (region-boss loot drop)', () => {
    it('mounts the d20 SVG instead of the pip grid', () => {
      render(
        <DieRollReveal face={14} dieType="d20" onDismiss={vi.fn()} title="Dungeon Boss Reward" />,
      );
      const die = screen.getByTestId('die-roll-reveal-die');
      expect(die.getAttribute('data-die-type')).toBe('d20');
      // The d20 SVG renders with class .die-roll-reveal-d20; pip grid
      // is absent.
      expect(die.querySelector('.die-roll-reveal-d20')).not.toBeNull();
      expect(die.querySelector('.die-roll-reveal-pips')).toBeNull();
    });

    it('renders the resolved face numeral (1..20) inside the SVG after settle', () => {
      render(<DieRollReveal face={17} dieType="d20" onDismiss={vi.fn()} />);
      advance(1100); // tumble + settle
      const die = screen.getByTestId('die-roll-reveal-die');
      expect(die.getAttribute('data-settled')).toBe('true');
      expect(die.getAttribute('data-face')).toBe('17');
      // The numeral is rendered as <text> inside the SVG.
      const svg = die.querySelector('.die-roll-reveal-d20');
      expect(svg).not.toBeNull();
      expect(svg!.textContent).toContain('17');
    });

    it('accepts and renders the maximum d20 face (20)', () => {
      render(<DieRollReveal face={20} dieType="d20" onDismiss={vi.fn()} />);
      advance(1100);
      const svg = screen.getByTestId('die-roll-reveal-die').querySelector('.die-roll-reveal-d20');
      expect(svg!.textContent).toContain('20');
    });

    it('outcome label still slides in after the reveal phase (parity with d6 path)', () => {
      render(
        <DieRollReveal
          face={19}
          dieType="d20"
          onDismiss={vi.fn()}
          outcomeLabel="Legendary drop!"
        />,
      );
      advance(900);
      expect(screen.queryByTestId('die-roll-reveal-outcome')).toBeNull();
      advance(300);
      expect(screen.getByTestId('die-roll-reveal-outcome')).toHaveTextContent('Legendary drop!');
    });
  });
});
