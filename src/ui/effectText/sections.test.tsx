import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Card } from '../../types/card';
import { KID_CARDS, baseIdOf } from '../../data/cards';
import { combatKeywordText } from './effectFor';
import { cardFaceSections } from './sections';

function findCard(baseId: string): Card {
  const card = KID_CARDS.find((c) => baseIdOf(c) === baseId);
  if (!card) throw new Error(`KID_CARDS missing ${baseId}`);
  return card;
}

/** Render a section's nodes into a detached container for DOM assertions. */
function renderNodes(card: Card, label: string): HTMLElement {
  const section = cardFaceSections(card).find((s) => s.label === label);
  if (!section) throw new Error(`no ${label} section for ${card.id}`);
  const { container } = render(<div data-testid="probe">{section.nodes}</div>);
  return container.querySelector('[data-testid="probe"]') as HTMLElement;
}

describe('cardFaceSections (kw.card-text-format / lhlo.38)', () => {
  it('labels a market hero face with a Market section', () => {
    // sage-keeper: '+2g, +1 key' main-board effect.
    const sections = cardFaceSections(findCard('sage-keeper'));
    const market = sections.find((s) => s.label === 'Market');
    expect(market).toBeDefined();
    expect(market?.text).toBe('+2g, +1 key');
  });

  it('labels the combat line with a Combat section in glossary spelling', () => {
    const sections = cardFaceSections(findCard('water-warrior'));
    const combat = sections.find((s) => s.label === 'Combat');
    expect(combat).toBeDefined();
    expect(combat?.text).toBe('Attack 3');
  });

  it('labels forest-sage with an Omen section (roll-die primary effect)', () => {
    const sections = cardFaceSections(findCard('forest-sage'));
    const omen = sections.find((s) => s.label === 'Omen');
    expect(omen).toBeDefined();
    expect(omen?.text).toBe('Roll d6 Omen');
    // ...and still surfaces its combat line.
    expect(sections.find((s) => s.label === 'Combat')?.text).toBe('Multiattack 2 (2 each)');
  });

  it('renders combat-primary heirlooms as a single data-driven Combat section', () => {
    // craghorn-tusk has no market action; its base text is the combat line.
    // It must read in glossary spelling, not the legacy "Combat: 4 dmg + stun 1".
    const sections = cardFaceSections(findCard('craghorn-tusk'));
    expect(sections).toHaveLength(1);
    expect(sections[0]?.label).toBe('Combat');
    expect(sections[0]?.text).toBe('Attack 4 + Stun 1');
  });

  it('bolds each glossary keyword on first occurrence within a section', () => {
    // mountain-king combat line "Attack 2 + Stun 1" carries two distinct
    // keywords — both bold on first (only) occurrence.
    const probe = renderNodes(findCard('mountain-king'), 'Combat');
    const bolded = Array.from(probe.querySelectorAll('strong')).map((el) => el.textContent);
    expect(bolded).toContain('Attack');
    expect(bolded).toContain('Stun');
  });

  it('bolds a keyword only on its FIRST occurrence across the whole card face', () => {
    // Synthetic hero whose Market section ("Heal teammate +2 ♥") and Combat
    // section ("Heal 3") both contain "Heal": the Market occurrence bolds,
    // the Combat occurrence stays plain (shared seen-set across sections).
    const synthetic: Card = {
      id: 'heal-twice-probe',
      role: 'hero',
      cost: { green: 2 },
      effects: { kind: 'heal', target: 'team', amount: 2 },
      combatEffect: { kind: 'combat-heal', amount: 3 },
    };
    const sections = cardFaceSections(synthetic);
    expect(sections.find((s) => s.label === 'Market')?.text).toBe('Heal teammate +2 ♥');
    expect(sections.find((s) => s.label === 'Combat')?.text).toBe('Heal 3');

    const { container } = render(
      <div>
        {sections.map((s) => (
          <span key={s.label} data-testid={`sec-${s.label}`}>
            {s.nodes}
          </span>
        ))}
      </div>,
    );
    const market = container.querySelector('[data-testid="sec-Market"]') as HTMLElement;
    const combat = container.querySelector('[data-testid="sec-Combat"]') as HTMLElement;
    expect(Array.from(market.querySelectorAll('strong')).map((e) => e.textContent)).toContain(
      'Heal',
    );
    expect(Array.from(combat.querySelectorAll('strong')).map((e) => e.textContent)).not.toContain(
      'Heal',
    );
  });
});

describe('combatKeywordText (kw.card-text-format glossary spelling)', () => {
  it('maps every CombatEffect kind to its canonical keyword phrasing', () => {
    expect(combatKeywordText({ kind: 'combat-attack', damage: 4 })).toBe('Attack 4');
    expect(combatKeywordText({ kind: 'combat-absorb', hp: 3 })).toBe('Block 3');
    expect(combatKeywordText({ kind: 'combat-heal', amount: 5 })).toBe('Heal 5');
    expect(combatKeywordText({ kind: 'combat-draw', count: 2 })).toBe('Draw 2');
    expect(combatKeywordText({ kind: 'combat-multishot', damage: 2, shots: 3 })).toBe(
      'Multiattack 3 (2 each)',
    );
    expect(combatKeywordText({ kind: 'combat-attack-stun', damage: 4, stunTurns: 1 })).toBe(
      'Attack 4 + Stun 1',
    );
    expect(combatKeywordText({ kind: 'combat-weaken', amount: 2 })).toBe('Weaken 2');
    expect(combatKeywordText({ kind: 'combat-vulnerable', amount: 3 })).toBe('Vulnerable 3');
  });
});
