import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import ChestReveal from './ChestReveal';
import { KID_CARDS } from '../data/cards';
import { DUR } from '../motion/durations';
import type { Card } from '../types/card';

const cardById = (id: string): Card => {
  const card = KID_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`Test fixture: missing KID_CARDS entry for "${id}"`);
  return card;
};

describe('ChestReveal', () => {
  it('renders the chest-reveal test id', () => {
    render(<ChestReveal reward="heart" onComplete={vi.fn()} />);
    expect(screen.getByTestId('chest-reveal')).toBeInTheDocument();
  });

  it('renders a reward label for known rewards', () => {
    render(<ChestReveal reward="heart" onComplete={vi.fn()} />);
    expect(screen.getByText('+1 Heart')).toBeInTheDocument();
  });

  it('renders an icon (svg) for the reward', () => {
    const { container } = render(<ChestReveal reward="hero" onComplete={vi.fn()} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts an onComplete handler without error', () => {
    const onComplete = vi.fn();
    expect(() => render(<ChestReveal reward="item" onComplete={onComplete} />)).not.toThrow();
    // Prop is wired but may fire asynchronously under real motion; we only
    // assert here that the component accepts the callback.
    expect(typeof onComplete).toBe('function');
  });

  // ---- bead embertide-063 bespoke ember-shard / vital-ember art --
  it('renders the bespoke ember-shard raster for the ember-shard reward', () => {
    const { container } = render(<ChestReveal reward="ember-shard" onComplete={vi.fn()} />);
    const svg = container.querySelector(
      'svg[data-illustration-id="cathedral_item_ember_shard_001"]',
    );
    expect(svg).not.toBeNull();
    const image = svg?.querySelector('image');
    expect(image?.getAttribute('href')).toBe('/illustrations/cathedral_item_ember_shard_001.webp');
    expect(screen.getByText('Ember Shard')).toBeInTheDocument();
  });

  it('renders the bespoke vital-ember raster for the vital-ember reward', () => {
    const { container } = render(<ChestReveal reward="vital-ember" onComplete={vi.fn()} />);
    const svg = container.querySelector(
      'svg[data-illustration-id="cathedral_item_vital_ember_001"]',
    );
    expect(svg).not.toBeNull();
    const image = svg?.querySelector('image');
    expect(image?.getAttribute('href')).toBe(
      '/illustrations/cathedral_item_vital_ember_001.webp',
    );
    expect(screen.getByText('Vital Ember')).toBeInTheDocument();
  });

  it('does NOT use the bespoke ember-shard raster for the plain heart reward', () => {
    const { container } = render(<ChestReveal reward="heart" onComplete={vi.fn()} />);
    const svg = container.querySelector(
      'svg[data-illustration-id="cathedral_item_ember_shard_001"]',
    );
    expect(svg).toBeNull();
  });

  // ---- bead embertide-ymgc — render the rolled card art for card rewards ----
  it('renders the rolled hero card via CardTemplate (NOT a generic Hero icon) when a card is provided', () => {
    const heroCard = cardById('sage-keeper');
    const { queryByTestId } = render(
      <ChestReveal reward="hero" card={heroCard} onComplete={vi.fn()} />,
    );
    // CardTemplate's art well is keyed by data-testid; presence implies the
    // rolled card's illustration mounted (NOT the generic RewardIcon path).
    expect(queryByTestId('card-template-art')).not.toBeNull();
    // The icon-only RewardIcon shell is replaced by the CardTemplate path
    // — no chest-reveal-icon test-id when a card is threaded in.
    expect(queryByTestId('chest-reveal-icon')).toBeNull();
  });

  it('renders the rolled item card via CardTemplate when a card is provided', () => {
    const itemCard = cardById('boomerang');
    const { queryByTestId } = render(
      <ChestReveal reward="item" card={itemCard} onComplete={vi.fn()} />,
    );
    expect(queryByTestId('card-template-art')).not.toBeNull();
  });

  it('renders the rolled premium-item card via CardTemplate when a card is provided', () => {
    const legendary = cardById('ancient-blade');
    const { queryByTestId } = render(
      <ChestReveal reward="premium-item" card={legendary} onComplete={vi.fn()} />,
    );
    expect(queryByTestId('card-template-art')).not.toBeNull();
  });

  it('renders the rolled wisp card via CardTemplate when a card is provided', () => {
    const wisp = cardById('wisp');
    const { queryByTestId } = render(
      <ChestReveal reward="wisp" card={wisp} onComplete={vi.fn()} />,
    );
    expect(queryByTestId('card-template-art')).not.toBeNull();
  });

  // bead embertide-1xw7: label below the card face must read 'Wisp'
  // (category), not the lowercase 'wisp' reward token. Scoped to
  // .chest-reveal-label so the card's own 'Wisp' name can't false-positive.
  it("renders the 'Wisp' category label below the wisp CardTemplate", () => {
    const wisp = cardById('wisp');
    const { container } = render(<ChestReveal reward="wisp" card={wisp} onComplete={vi.fn()} />);
    const labelEl = container.querySelector('.chest-reveal-label');
    expect(labelEl?.textContent).toBe('Wisp');
  });

  // bead embertide-epwk: pickWispVariant (slices/chests.ts) resolves
  // 50% of wisp chest rewards to the 'wisp-in-bottle' variant. The
  // sibling 'wisp' tests above exercise only the plain template; this
  // test covers the bottle variant through ChestReveal so future
  // regressions in cardDisplayName / CardTemplate for wisp-in-bottle
  // surface at the popup layer. Card-face name is scoped via the
  // 'card-template-name' test-id (CardTemplate.tsx) and the category
  // label via .chest-reveal-label so neither assertion can false-positive
  // on the other.
  it("renders the 'Wisp in Bottle' card-face name and 'Wisp' label for the wisp-in-bottle variant", () => {
    const bottle = cardById('wisp-in-bottle');
    const { container, getByTestId } = render(
      <ChestReveal reward="wisp" card={bottle} onComplete={vi.fn()} />,
    );
    expect(getByTestId('card-template-name').textContent).toBe('Wisp in Bottle');
    const labelEl = container.querySelector('.chest-reveal-label');
    expect(labelEl?.textContent).toBe('Wisp');
  });

  // bead embertide-0ku5: 'Treasure' is the CATEGORY label that must
  // cover BOTH premium-item rolls (ancient-blade and great-wisp). Scoped
  // to .chest-reveal-label so the card-face name cannot false-positive.
  it.each(['ancient-blade', 'great-wisp'])(
    "renders the 'Treasure' category label below the premium-item %s CardTemplate",
    (cardId) => {
      const { container } = render(
        <ChestReveal reward="premium-item" card={cardById(cardId)} onComplete={vi.fn()} />,
      );
      const labelEl = container.querySelector('.chest-reveal-label');
      expect(labelEl?.textContent).toBe('Treasure');
    },
  );

  it('falls back to the generic icon path when no card is provided for a card reward', () => {
    // Defensive — heart-only flow should not break if a caller forgets to
    // thread the card. The icon path (and label) still mounts.
    const { queryByTestId } = render(<ChestReveal reward="hero" onComplete={vi.fn()} />);
    expect(queryByTestId('chest-reveal-icon')).not.toBeNull();
    // CardTemplate art well must NOT mount in this fallback.
    expect(queryByTestId('card-template-art')).toBeNull();
  });

  // ---- bead embertide-4m5.2 (4m5.d.1) — completion-callback contract --
  //
  // The reveal panel auto-dismisses after a hold of `DUR.reveal +
  // DUR.dramatic` (520ms reveal animation + 880ms dramatic read-beat ≈
  // 1400ms total). These tests pin the contract:
  //   1. onComplete fires exactly once after the hold elapses.
  //   2. onComplete does NOT fire before the hold elapses.
  //   3. unmount BEFORE the timer fires cancels the callback (no leak).
  //
  // Fake timers are used so the test runs in well under a second. Each
  // test resets to real timers in `finally` so a failure mid-test does
  // not leak fake-timer state into the next describe block.
  describe('completion-callback timer contract', () => {
    const HOLD_MS = DUR.reveal + DUR.dramatic;

    it('fires onComplete exactly once after the hold duration', () => {
      vi.useFakeTimers();
      try {
        const onComplete = vi.fn();
        render(<ChestReveal reward="heart" onComplete={onComplete} />);
        expect(onComplete).not.toHaveBeenCalled();
        act(() => {
          vi.advanceTimersByTime(HOLD_MS);
        });
        expect(onComplete).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does NOT fire onComplete before the hold elapses', () => {
      vi.useFakeTimers();
      try {
        const onComplete = vi.fn();
        render(<ChestReveal reward="heart" onComplete={onComplete} />);
        // 1 ms shy of the hold — the timer must still be pending.
        act(() => {
          vi.advanceTimersByTime(HOLD_MS - 1);
        });
        expect(onComplete).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels the pending onComplete callback when the panel unmounts early', () => {
      vi.useFakeTimers();
      try {
        const onComplete = vi.fn();
        const { unmount } = render(<ChestReveal reward="heart" onComplete={onComplete} />);
        unmount();
        // Push the clock past the hold — the cleared timeout must NOT
        // fire onComplete after unmount (otherwise we'd leak a callback
        // into a torn-down React tree).
        act(() => {
          vi.advanceTimersByTime(HOLD_MS + 100);
        });
        expect(onComplete).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
