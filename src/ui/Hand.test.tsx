import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hand from './Hand';
import { KID_CARDS } from '../data/cards';
import { STARTER_GREEN } from '../store/slices/deck';

const SAGE = KID_CARDS.find((c) => c.id === 'sage-keeper')!;
const WATER = KID_CARDS.find((c) => c.id === 'water-warrior')!;
const SCHOLAR = KID_CARDS.find((c) => c.id === 'scholar-princess')!;
const MERCHANT = KID_CARDS.find((c) => c.id === 'wandering-merchant')!;
const RANCH = KID_CARDS.find((c) => c.id === 'ranch-keeper')!;
const FOREST_SAGE = KID_CARDS.find((c) => c.id === 'forest-sage')!;
const MOUNTAIN_KING = KID_CARDS.find((c) => c.id === 'mountain-king')!;
const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;
const MONSTER = KID_CARDS.find((c) => c.role === 'monster')!;

describe('Hand effect text (embertide-7c1)', () => {
  it('renders "+2g, +1 key" for sage-keeper', () => {
    render(<Hand cards={[SAGE]} onPlay={() => {}} />);
    const el = screen.getByTestId(`effect-text-${SAGE.id}`);
    expect(el).toHaveTextContent('+2g, +1 key');
  });

  it('renders "+2 power" for water-warrior', () => {
    render(<Hand cards={[WATER]} onPlay={() => {}} />);
    const el = screen.getByTestId(`effect-text-${WATER.id}`);
    expect(el).toHaveTextContent('+2 power');
  });

  it('renders "+2g" for scholar-princess (mvjx — phase differentiation)', () => {
    render(<Hand cards={[SCHOLAR]} onPlay={() => {}} />);
    expect(screen.getByTestId(`effect-text-${SCHOLAR.id}`)).toHaveTextContent('+2g');
  });

  it('renders "+1g, +1 power" for wandering-merchant', () => {
    render(<Hand cards={[MERCHANT]} onPlay={() => {}} />);
    expect(screen.getByTestId(`effect-text-${MERCHANT.id}`)).toHaveTextContent('+1g, +1 power');
  });

  it('renders main +1g + live on-boss trigger for ranch-keeper (embertide-g6a + mvjx)', () => {
    // mvjx (2026-04-25): added flat +1g main-phase fire on top of the
    // existing boss-conditional +1\u2665 heal.
    render(<Hand cards={[RANCH]} onPlay={() => {}} />);
    const el = screen.getByTestId(`effect-text-${RANCH.id}`);
    expect(el.textContent?.toLowerCase()).not.toContain('v0.2');
    expect(el).toHaveTextContent('+1g');
    expect(el).toHaveTextContent('boss');
    expect(el).toHaveTextContent('\u2665');
  });

  it('renders the d6 omen teaser for forest-sage (embertide-aqkj)', () => {
    // aqkj (2026-04-25): card-face text shortened from the full table
    // to a teaser. RollCommitModal renders the full per-face outcomes
    // when the player taps the card.
    render(<Hand cards={[FOREST_SAGE]} onPlay={() => {}} />);
    const el = screen.getByTestId(`effect-text-${FOREST_SAGE.id}`);
    expect(el.textContent?.toLowerCase()).toContain('roll d6');
    expect(el.textContent?.toLowerCase()).not.toContain('peek');
    expect(el.textContent?.toLowerCase()).not.toContain('reroll');
  });

  it('renders the live per-kill trigger for mountain-king (embertide-g6a)', () => {
    render(<Hand cards={[MOUNTAIN_KING]} onPlay={() => {}} />);
    const el = screen.getByTestId(`effect-text-${MOUNTAIN_KING.id}`);
    expect(el.textContent?.toLowerCase()).not.toContain('v0.2');
    expect(el).toHaveTextContent('per kill');
  });

  it('renders "+1g" for starter-green', () => {
    render(<Hand cards={[STARTER_GREEN]} onPlay={() => {}} />);
    expect(screen.getByTestId(`effect-text-${STARTER_GREEN.id}`)).toHaveTextContent('+1g');
  });

  it('renders the equip-bonus on-equip hint for short-sword item (embertide-s2ub)', () => {
    render(<Hand cards={[SHORT_SWORD]} onPlay={() => {}} />);
    expect(screen.getByTestId(`effect-text-${SHORT_SWORD.id}`)).toHaveTextContent(/on equip/i);
  });

  it('renders the monster drop summary on the card face (embertide-d80)', () => {
    const { container } = render(<Hand cards={[MONSTER]} onPlay={() => {}} />);
    expect(container).toBeTruthy();
    expect(screen.getByTestId(`effect-text-${MONSTER.id}`)).toHaveTextContent('+1 \u2665');
  });

  it('uses baseId for duplicates (water-warrior-2 resolves to water-warrior text)', () => {
    const duplicate = {
      ...WATER,
      id: 'water-warrior-2',
      baseId: 'water-warrior',
    };
    render(<Hand cards={[duplicate]} onPlay={() => {}} />);
    expect(screen.getByTestId(`effect-text-${duplicate.id}`)).toHaveTextContent('+2 power');
  });
});
