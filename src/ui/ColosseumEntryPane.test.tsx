import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ColosseumEntryPane from './ColosseumEntryPane';
import type { ColosseumProgression, TierId } from '../core/colosseum';

/**
 * Tests for the colosseum HUD entry (embertide-4hr1.4).
 *
 * Acceptance coverage:
 *  - A1: Entry visible only when `unlocked === true`.
 *  - A2: Click invokes the supplied `onEnter` handler exactly once.
 *  - A3: Tier-progression preview renders only unlocked tiers (future
 *        tiers omitted — embertide-vrqs), with an entry-tier
 *        fallback before the first colosseum entry.
 */

function progressionWith(tiers: readonly TierId[]): ColosseumProgression {
  return { unlockedTiers: tiers };
}

describe('ColosseumEntryPane (embertide-4hr1.4)', () => {
  it('A1: renders nothing when unlocked === false', () => {
    const { container } = render(
      <ColosseumEntryPane
        unlocked={false}
        progression={progressionWith([])}
        onEnter={() => undefined}
      />,
    );
    expect(container.querySelector('[data-testid="colosseum-entry-pane"]')).toBeNull();
  });

  it('A1: renders the entry surface when unlocked === true', () => {
    render(
      <ColosseumEntryPane unlocked progression={progressionWith([])} onEnter={() => undefined} />,
    );
    expect(screen.getByTestId('colosseum-entry-pane')).toBeInTheDocument();
  });

  it('A2: clicking the entry invokes onEnter exactly once', () => {
    const onEnter = vi.fn();
    render(<ColosseumEntryPane unlocked progression={progressionWith([])} onEnter={onEnter} />);
    const root = screen.getByTestId('colosseum-entry-pane');
    expect(root.tagName).toBe('BUTTON');
    fireEvent.click(root);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  describe('A3: tier-progression preview', () => {
    it('renders only the unlocked tier and omits future tiers when only tier 1 is unlocked', () => {
      render(
        <ColosseumEntryPane
          unlocked
          progression={progressionWith([1])}
          onEnter={() => undefined}
        />,
      );
      const tier1 = screen.getByTestId('colosseum-tier-row-1');
      expect(tier1).toBeInTheDocument();
      expect(tier1.getAttribute('data-unlocked')).toBe('true');

      // Tier-1 roster preview includes Craghorn.
      expect(tier1.textContent).toContain('Craghorn');

      // Future tiers are NOT rendered — they unlock automatically and
      // rendering the full ladder overflowed the rail (embertide-vrqs).
      expect(screen.queryByTestId('colosseum-tier-row-2')).toBeNull();
      expect(screen.queryByTestId('colosseum-tier-row-5')).toBeNull();
    });

    it('renders tier-1 + tier-2 (and nothing beyond) when both are unlocked', () => {
      render(
        <ColosseumEntryPane
          unlocked
          progression={progressionWith([1, 2])}
          onEnter={() => undefined}
        />,
      );
      expect(screen.getByTestId('colosseum-tier-row-1').getAttribute('data-unlocked')).toBe('true');
      expect(screen.getByTestId('colosseum-tier-row-2').getAttribute('data-unlocked')).toBe('true');
      // Still-locked tiers are omitted.
      expect(screen.queryByTestId('colosseum-tier-row-3')).toBeNull();
      expect(screen.queryByTestId('colosseum-tier-row-5')).toBeNull();

      // Tier-2 roster preview includes a known canonical entry.
      const tier2 = screen.getByTestId('colosseum-tier-row-2');
      expect(tier2.textContent).toContain('Phantom Vurmox');
    });

    it('renders the unlocked tiers when a later tier is unlocked (capstone)', () => {
      render(
        <ColosseumEntryPane
          unlocked
          progression={progressionWith([1, 2, 5])}
          onEnter={() => undefined}
        />,
      );
      const tier5 = screen.getByTestId('colosseum-tier-row-5');
      expect(tier5.getAttribute('data-unlocked')).toBe('true');
      // Tier 5 capstone roster: Trinity Aurogax.
      expect(tier5.textContent).toContain('Trinity Aurogax');
      // Tiers never unlocked (3, 4) are omitted.
      expect(screen.queryByTestId('colosseum-tier-row-3')).toBeNull();
      expect(screen.queryByTestId('colosseum-tier-row-4')).toBeNull();
    });

    it('falls back to the entry tier (Tier I, up next) when no tiers are unlocked yet', () => {
      render(
        <ColosseumEntryPane unlocked progression={progressionWith([])} onEnter={() => undefined} />,
      );
      // Before the first colosseum entry the progression is empty; show
      // Tier I as an "up next" preview rather than a blank pane. It is
      // flagged locked since the player hasn't unlocked it yet.
      const tier1 = screen.getByTestId('colosseum-tier-row-1');
      expect(tier1).toBeInTheDocument();
      expect(tier1.getAttribute('data-unlocked')).toBe('false');
      expect(tier1.textContent).toContain('Craghorn');
      // No other tiers render.
      expect(screen.queryByTestId('colosseum-tier-row-2')).toBeNull();
    });
  });
});
