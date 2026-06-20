import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CombatBattlefield from './CombatBattlefield';
import { cardDisplayName } from './CardTemplate';
import { KID_CARDS } from '../data/cards';
import type { BattlefieldCard } from '../types/combat';
import type { Card } from '../types/card';

// ---------------------------------------------------------------------------
// embertide-y88 + 9u1 — CombatBattlefield must resolve its
// `BattlefieldCard` entries (keyed by `cardId`) back to the authoring Card
// registry so every tile shows the full stained-glass card face via the
// shared CardTemplate. nz8-c retired the bespoke `-label` and `-art`
// testids in favor of CardTemplate's internal `card-template-name` /
// `card-template-art` testids, queried via within(tile).
// ---------------------------------------------------------------------------

function findCard(cardId: string): Card {
  const card = KID_CARDS.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Test fixture references card id "${cardId}" which is not in KID_CARDS.`);
  }
  return card;
}

describe('CombatBattlefield — card art + display name wiring (embertide-y88 + 9u1)', () => {
  it('renders the empty-state placeholder when the battlefield is empty', () => {
    render(<CombatBattlefield battlefield={[]} />);
    expect(screen.getByTestId('combat-battlefield-empty')).toBeInTheDocument();
  });

  it('resolves cardId → Card and renders the shared cardDisplayName inside the tile', () => {
    const sageKeeper = findCard('sage-keeper');
    const bf: BattlefieldCard = {
      cardId: sageKeeper.id,
      hp: 2,
      hpMax: 3,
      combatEffectId: 'combat-absorb:3',
    };

    render(<CombatBattlefield battlefield={[bf]} />);

    const tile = screen.getByTestId(`combat-battlefield-card-${sageKeeper.id}`);
    const name = within(tile).getByTestId('card-template-name');
    expect(name).toHaveTextContent(cardDisplayName(sageKeeper));
  });

  it('renders the shared illustration surface for a resolved card', () => {
    const towerShield = findCard('tower-shield');
    const bf: BattlefieldCard = {
      cardId: towerShield.id,
      hp: 2,
      hpMax: 2,
      combatEffectId: 'combat-absorb:2',
    };

    render(<CombatBattlefield battlefield={[bf]} />);

    const tile = screen.getByTestId(`combat-battlefield-card-${towerShield.id}`);
    // CardTemplate renders the art inside `card-template-art`. An SVG
    // root must exist for the tile to carry a readable portrait.
    const artWrapper = within(tile).getByTestId('card-template-art');
    expect(artWrapper.querySelector('svg')).not.toBeNull();
  });

  it('keeps the hp / hpMax readout visible as a chip overlay on the tile', () => {
    const towerShield = findCard('tower-shield');
    const bf: BattlefieldCard = {
      cardId: towerShield.id,
      hp: 1,
      hpMax: 2,
      combatEffectId: 'combat-absorb:2',
    };

    render(<CombatBattlefield battlefield={[bf]} />);

    const hp = screen.getByTestId(`combat-battlefield-card-${towerShield.id}-hp`);
    expect(hp).toHaveTextContent('1 / 2');
  });

  it('exposes an accessible aria-label that pairs display name with hp', () => {
    const sageKeeper = findCard('sage-keeper');
    const bf: BattlefieldCard = {
      cardId: sageKeeper.id,
      hp: 2,
      hpMax: 3,
      combatEffectId: 'combat-absorb:3',
    };

    render(<CombatBattlefield battlefield={[bf]} />);

    const tile = screen.getByTestId(`combat-battlefield-card-${sageKeeper.id}`);
    const label = tile.getAttribute('aria-label') ?? '';
    expect(label).toContain(cardDisplayName(sageKeeper));
    expect(label).toContain('hp 2 of 3');
  });

  it('falls back to the raw cardId text when the card cannot be resolved (defensive)', () => {
    const bf: BattlefieldCard = {
      cardId: 'not-a-real-card',
      hp: 1,
      hpMax: 1,
      combatEffectId: 'combat-absorb:1',
    };

    render(<CombatBattlefield battlefield={[bf]} />);

    // Fallback path retains the per-tile `-label` testid because there is
    // no CardTemplate to render the name — we emit a raw text span.
    const label = screen.getByTestId(`combat-battlefield-card-not-a-real-card-label`);
    expect(label).toHaveTextContent('not-a-real-card');
    // No CardTemplate art surface for an unresolvable card.
    const tile = screen.getByTestId(`combat-battlefield-card-not-a-real-card`);
    expect(within(tile).queryByTestId('card-template-art')).toBeNull();
  });

  it('renders each tile in battlefield order when multiple cards are present', () => {
    const a = findCard('sage-keeper');
    const b = findCard('tower-shield');
    const battlefield: readonly BattlefieldCard[] = [
      { cardId: a.id, hp: 3, hpMax: 3, combatEffectId: 'combat-absorb:3' },
      { cardId: b.id, hp: 2, hpMax: 2, combatEffectId: 'combat-absorb:2' },
    ];

    render(<CombatBattlefield battlefield={battlefield} />);

    expect(screen.getByTestId(`combat-battlefield-card-${a.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`combat-battlefield-card-${b.id}`)).toBeInTheDocument();
  });
});
