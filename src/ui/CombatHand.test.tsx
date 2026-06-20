import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import CombatHand from './CombatHand';
import { KID_CARDS, type SupplyCard } from '../data/cards';
import { STARTER_GREEN, STARTER_RED } from '../store/slices/deck';
import type { Card } from '../types/card';

const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;

describe('CombatHand art wiring (embertide-j5x + 3d5)', () => {
  it('renders an empty-hand placeholder when there are no cards', () => {
    render(<CombatHand cards={[]} onPlayCard={() => {}} />);
    expect(screen.getByTestId('combat-hand-empty')).toBeInTheDocument();
  });

  it('fires onPlayCard with the tapped card id', () => {
    const onPlayCard = vi.fn();
    render(<CombatHand cards={[SHORT_SWORD]} onPlayCard={onPlayCard} />);
    screen.getByTestId('combat-hand-slot-0').click();
    expect(onPlayCard).toHaveBeenCalledTimes(1);
    expect(onPlayCard).toHaveBeenCalledWith(SHORT_SWORD.id);
  });

  it('renders the short-sword bespoke raster illustration in its slot', () => {
    render(<CombatHand cards={[SHORT_SWORD]} onPlayCard={() => {}} />);
    // nz8-3d5: the tile now renders via CardTemplate. The bespoke raster
    // lives inside the card's `card-template-art` wrapper (rendered by
    // CardTemplate via cardArtForCard). Query inside the slot button so
    // this test stays robust against future repositioning of the art
    // wrapper within the template.
    const slot = screen.getByTestId('combat-hand-slot-0');
    const svg = slot.querySelector('svg[data-illustration-id]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_item_short_sword_001');
    const rasterImage = slot.querySelector('g#raster image');
    expect(rasterImage?.getAttribute('href')).toBe(
      '/illustrations/cathedral_item_short_sword_001.webp',
    );
  });

  it('resolves the bespoke raster via baseId for duplicate cards (not card.id)', () => {
    // Duplicate supply copies carry a generated `id` + original `baseId`.
    // cardArtForCard must key on baseIdOf(card), NOT card.id, otherwise
    // every duplicate renders a blank/fallback tile instead of the
    // correct portrait.
    const duplicate: SupplyCard = {
      ...SHORT_SWORD,
      id: 'short-sword-copy-2',
      baseId: 'short-sword',
    };
    render(<CombatHand cards={[duplicate]} onPlayCard={() => {}} />);
    const slot = screen.getByTestId('combat-hand-slot-0');
    const svg = slot.querySelector('svg[data-illustration-id]');
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_item_short_sword_001');
  });

  it('renders a role-level illustration for starter-green (no bespoke baseId override)', () => {
    render(<CombatHand cards={[STARTER_GREEN]} onPlayCard={() => {}} />);
    const slot = screen.getByTestId('combat-hand-slot-0');
    const svg = slot.querySelector('svg[data-illustration-id]');
    expect(svg).not.toBeNull();
    // starter-green has no per-baseId spec; the role-level spec should
    // fill in so the slot is never blank.
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_starter_green_001');
  });

  it('never renders a blank tile: every slot contains an SVG glyph (icon or raster)', () => {
    // Mix: bespoke-raster card, role-spec-only card, duplicate — all must
    // produce a visible SVG inside the slot so the hand always
    // communicates card identity at a glance.
    const cards: readonly Card[] = [SHORT_SWORD, STARTER_GREEN, STARTER_RED];
    render(<CombatHand cards={cards} onPlayCard={() => {}} />);
    for (let i = 0; i < cards.length; i += 1) {
      const slot = screen.getByTestId(`combat-hand-slot-${i}`);
      const svg = slot.querySelector('svg');
      expect(
        svg,
        `slot ${i} must render an SVG glyph (raster illustration or icon fallback)`,
      ).not.toBeNull();
    }
  });

  it('surfaces the card display name via the shared CardTemplate', () => {
    // nz8-3d5: the old `combat-hand-slot-${idx}-name` testid is retired.
    // CardTemplate owns the name span (`card-template-name`), which the
    // tile now renders. Assert the tile's inner name is non-empty so a
    // regression that leaves a card nameless fails loudly.
    render(<CombatHand cards={[SHORT_SWORD]} onPlayCard={() => {}} />);
    const slot = screen.getByTestId('combat-hand-slot-0');
    const nameEl = within(slot).getByTestId('card-template-name');
    expect(nameEl.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    // Sylvani Sword has a bespoke GENERIC_BASE_ID_THEME entry; the tile
    // must reflect the bespoke label, not the generic "Relic" fallback.
    expect(nameEl.textContent?.trim()).toBe('Sylvani Sword');
  });

  it('preserves the 44x44 tap-target contract on each slot', () => {
    render(<CombatHand cards={[SHORT_SWORD]} onPlayCard={() => {}} />);
    const button = screen.getByTestId('combat-hand-slot-0');
    expect(button.getAttribute('data-touch-target')).toBe('true');
    // data-card-id / data-role are load-bearing for Playwright selectors.
    expect(button.getAttribute('data-card-id')).toBe(SHORT_SWORD.id);
    expect(button.getAttribute('data-role')).toBe(SHORT_SWORD.role);
    // `.tap-target` class applies the 44x44 min size from app.css; the
    // class presence is the structural contract guard.
    expect(button.classList.contains('tap-target')).toBe(true);
  });
});
