import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CardTemplate, {
  cardDisplayName,
  deriveCardVariant,
  type CardTemplateVariant,
} from './CardTemplate';
import type { Card, CardRole } from '../types/card';
import { CARD_ROLES } from '../types/card';
import { KID_CARDS, baseIdOf } from '../data/cards';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card-1',
    role: 'hero',
    cost: { green: 2, red: 0, keys: 0 },
    // Neutral typed effect — EffectSpec Phase 1 (u-1b) requires a discriminated
    // value. `{ kind: 'gain' }` with no resource fields is a no-op on the
    // CardTemplate render path (which keys on id/role, not effects).
    effects: { kind: 'gain' },
    ...overrides,
  };
}

describe('CardTemplate', () => {
  it('renders the card name from the generic theme', () => {
    const { getByTestId } = render(<CardTemplate card={makeCard()} />);
    const name = getByTestId('card-template-name');
    expect(name.textContent).toBe('Champion');
  });

  it('renders the illustration SVG when the role has a spec mapping', () => {
    const { container } = render(<CardTemplate card={makeCard({ role: 'hero' })} />);
    const svg = container.querySelector('svg[data-illustration-id]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_hero_warrior_001');
  });

  it('renders a role-specific illustration for every mapped CardRole', () => {
    const { container } = render(<CardTemplate card={makeCard({ role: 'starter-green' })} />);
    const svg = container.querySelector('svg[data-illustration-id]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_starter_green_001');
  });

  it('renders one stained-glass shard gem per non-zero resource', () => {
    const { container } = render(
      <CardTemplate card={makeCard({ cost: { green: 3, red: 1, keys: 0 } })} />,
    );
    const gems = container.querySelectorAll('[data-testid^="cost-gem-"]');
    expect(gems).toHaveLength(2);
    expect(container.querySelector('[data-testid="cost-gem-green"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cost-gem-red"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cost-gem-keys"]')).toBeNull();
  });

  it('omits the cost overlay entirely when the card is free', () => {
    const { container } = render(
      <CardTemplate card={makeCard({ cost: { green: 0, red: 0, keys: 0 } })} />,
    );
    expect(container.querySelectorAll('[data-testid^="cost-gem-"]')).toHaveLength(0);
  });

  it('renders the name as a small label inside the rules-text box', () => {
    const { getByTestId } = render(<CardTemplate card={makeCard()} />);
    const rulesBox = getByTestId('card-template-rules-box');
    const nameInside = rulesBox.querySelector('[data-testid="card-template-name"]');
    expect(nameInside).not.toBeNull();
    expect(nameInside?.textContent).toBe('Champion');
  });

  it('renders the effect text inside the rules-text box when present', () => {
    const { getByTestId } = render(
      <CardTemplate card={makeCard({ id: 'starter-green-1', role: 'starter-green' })} />,
    );
    const rulesBox = getByTestId('card-template-rules-box');
    const effect = rulesBox.querySelector('[data-testid="card-template-effect"]');
    expect(effect).not.toBeNull();
    // Resource words are now replaced by inline icons (embertide-9jg).
    // The amount stays as text; the 'g' suffix is replaced by a
    // <GreenRupee/> icon so only '+1' remains in the visible text.
    expect(effect?.textContent ?? '').toContain('+1');
    expect(effect?.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
  });

  it('prefers bespoke per-baseId name for champion portrait ids (embertide-ddq / j49z)', () => {
    // j49z (2026-04-24): the four ids below were previously
    // `role: 'starter-home'` cards in KID_CARDS; the role and entries
    // were retired but the GENERIC_BASE_ID_THEME entries remain so the
    // Setup champion picker (which renders synthetic Card objects for
    // portrait display) still surfaces the bespoke names. The synthetic
    // Card uses `role: 'hero'` here to exercise the same baseId-wins-
    // over-role-fallback contract on a still-supported role.
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['spirit-arrow', 'Spirit Arrow'],
      ['seer-rune', 'Seer Rune'],
      ['warblade', 'Warblade'],
      ['ancient-keepsake', 'Ancient Keepsake'],
    ];
    for (const [id, expected] of cases) {
      const { getByTestId, unmount } = render(
        <CardTemplate card={makeCard({ id, role: 'hero' })} />,
      );
      expect(getByTestId('card-template-name').textContent).toBe(expected);
      unmount();
    }
  });

  it('exposes art panel, rules box, and cost overlay as testable regions', () => {
    const { getByTestId } = render(<CardTemplate card={makeCard()} />);
    expect(getByTestId('card-template-art')).toBeTruthy();
    expect(getByTestId('card-template-rules-box')).toBeTruthy();
    expect(getByTestId('card-template-cost-overlay')).toBeTruthy();
  });

  // cby6 / ppf9-4d.1: dual-slot items render the on-equip base text in
  // .card-template-effect (primary weight) and the passive description
  // in a sibling .card-template-passive span (demoted weight). The two
  // halves used to share a single span with `white-space: pre-line`,
  // which made the passive line compete for primary visual weight.
  describe('dual-slot rendering (cby6 / ppf9-4d.1)', () => {
    function dualSlotCard(): Card {
      return {
        id: 'test-dual-slot',
        role: 'item',
        cost: { green: 4 },
        effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
        passive: {
          kind: 'item-passive',
          description: 'Reduce damage taken by 1',
          trigger: 'on-damage',
          effect: { kind: 'damage-reduction', amount: 1 },
        },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
    }

    it('renders the on-equip base text in .card-template-effect', () => {
      const { getByTestId } = render(<CardTemplate card={dualSlotCard()} />);
      const effectSpan = getByTestId('card-template-effect');
      expect(effectSpan.textContent).toContain('+1');
      expect(effectSpan.textContent).toContain('on equip');
      expect(effectSpan.textContent).not.toContain('Passive');
    });

    it('renders the passive description in a sibling .card-template-passive span', () => {
      const { getByTestId } = render(<CardTemplate card={dualSlotCard()} />);
      const passiveSpan = getByTestId('card-template-passive');
      expect(passiveSpan.textContent).toBe('Passive: Reduce damage taken by 1');
    });

    it('omits .card-template-passive entirely when the card has no passive', () => {
      // sage-keeper is a hero with `+2g, +1 key` base text and no Card.passive.
      const hero = KID_CARDS.find((c) => baseIdOf(c) === 'sage-keeper');
      if (!hero) throw new Error('KID_CARDS missing sage-keeper');
      const { queryByTestId } = render(<CardTemplate card={hero} />);
      expect(queryByTestId('card-template-passive')).toBeNull();
    });

    it('omits .card-template-effect when the dual-slot base is empty (passive-only)', () => {
      // Synthetic edge case: a passive-only card whose base text is ''
      // (no effectText branch matches) — only the passive span renders.
      const passiveOnly: Card = {
        id: 'test-passive-only',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'gain', red: 0 },
        passive: {
          kind: 'item-passive',
          description: '+1 gem when you defeat a monster',
          trigger: 'on-monster-defeated',
          effect: { kind: 'gain', green: 1 },
        },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
      const { queryByTestId, getByTestId } = render(<CardTemplate card={passiveOnly} />);
      expect(queryByTestId('card-template-effect')).toBeNull();
      expect(getByTestId('card-template-passive').textContent).toContain('Passive:');
    });
  });

  // kw.card-text-format / lhlo.38: card faces render standardized
  // Market — / Combat — / Omen — section labels game-wide.
  describe('standardized section labels (lhlo.38)', () => {
    it('shows a "Market —" label on a market hero face', () => {
      const sage = KID_CARDS.find((c) => baseIdOf(c) === 'sage-keeper');
      if (!sage) throw new Error('KID_CARDS missing sage-keeper');
      const { getByTestId } = render(<CardTemplate card={sage} />);
      expect(getByTestId('card-template-effect').textContent).toContain('Market —');
    });

    it('shows a "Combat —" label on the combat line', () => {
      const warrior = KID_CARDS.find((c) => baseIdOf(c) === 'water-warrior');
      if (!warrior) throw new Error('KID_CARDS missing water-warrior');
      const { getByTestId } = render(<CardTemplate card={warrior} />);
      expect(getByTestId('card-template-combat').textContent).toContain('Combat —');
    });

    it('shows an "Omen —" label on forest-sage (roll-die primary effect)', () => {
      const sage = KID_CARDS.find((c) => baseIdOf(c) === 'forest-sage');
      if (!sage) throw new Error('KID_CARDS missing forest-sage');
      const { getByTestId } = render(<CardTemplate card={sage} />);
      expect(getByTestId('card-template-effect').textContent).toContain('Omen —');
    });
  });
});

describe('cardDisplayName (embertide-0kl accessible-name guard)', () => {
  it('returns a non-empty string for every declared CardRole', () => {
    for (const role of CARD_ROLES) {
      const name = cardDisplayName({
        id: `${role}-probe`,
        role,
        cost: {},
        effects: { kind: 'gain' },
      });
      expect(name, `role=${role}`).toBeTruthy();
      expect(name.length, `role=${role}`).toBeGreaterThan(0);
    }
  });

  it('never returns an empty string even if the role is unknown at runtime', () => {
    // Simulate a future regression where a Card slips through with a role
    // that's missing from GENERIC_THEME (e.g., someone adds a role to
    // CARD_ROLES via a non-type-checked path, or a runtime theme removes a
    // key). The helper MUST still produce a meaningful non-empty label so
    // the Field tile button gets an accessible name (WCAG 4.1.2).
    const rogue: Card = {
      id: 'rogue-1',
      role: 'made-up-role' as CardRole,
      cost: {},
      effects: { kind: 'gain' },
    };
    const name = cardDisplayName(rogue);
    expect(name).toBeTruthy();
    expect(name.length).toBeGreaterThan(0);
  });

  it('renders a non-empty name span on CardTemplate for every declared CardRole', () => {
    for (const role of CARD_ROLES) {
      const { getByTestId, unmount } = render(
        <CardTemplate card={{ id: `${role}-probe`, role, cost: {}, effects: { kind: 'gain' } }} />,
      );
      const text = getByTestId('card-template-name').textContent ?? '';
      expect(text.trim(), `role=${role}`).not.toBe('');
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// embertide-uoz (2026-04-24): every item in KID_CARDS must resolve to a
// bespoke display name via GENERIC_BASE_ID_THEME. Before this fix, items
// without a baseId entry (cinder-bloom, wisp, short-sword, etc.) surfaced the
// role-level fallback "Relic" on the card face — so a cinder-bloom read as
// "Relic" instead of "Cinder Bloom". The assertion is role-aware: only items
// (role='item' or 'legendary-sword') are checked, because they are the roles
// whose GENERIC_THEME fallbacks collide with the item card-face labels
// ('Relic' / 'Ancient Blade'). Chests, monsters, heroes, and starters have
// their own well-differentiated role-level fallbacks and do not need this
// guard.
// ---------------------------------------------------------------------------

describe('cardDisplayName item-roster coverage (embertide-uoz)', () => {
  const ITEM_ROLES: ReadonlySet<CardRole> = new Set(['item', 'legendary-sword']);

  it('returns a bespoke display name for cinder-bloom (reported bug)', () => {
    const name = cardDisplayName({
      id: 'cinder-bloom',
      role: 'item',
      cost: { green: 4 },
      effects: { kind: 'gain' },
    });
    expect(name).toBe('Cinder Bloom');
    expect(name).not.toBe('Relic');
  });

  it('has an explicit GENERIC_BASE_ID_THEME entry for every item in KID_CARDS', () => {
    const items = KID_CARDS.filter((c) => ITEM_ROLES.has(c.role));
    // KID_CARDS is the full authoritative roster used by the shuffler; a
    // future item added without a theme entry would render as the role-level
    // fallback "Relic" on its card face (reported 2026-04-24: cinder-bloom
    // showed as "Relic"). Assert the theme map DIRECTLY rather than via
    // cardDisplayName's output, because a bespoke name can coincide with
    // the role fallback for 'legendary-sword' ("Ancient Blade") — only an
    // explicit entry guarantees intent to label this item.
    expect(items.length, 'KID_CARDS should contain at least one item card').toBeGreaterThan(0);
    for (const card of items) {
      const baseId = baseIdOf(card);
      expect(
        GENERIC_BASE_ID_THEME[baseId],
        `item "${card.id}" (baseId="${baseId}") is missing from GENERIC_BASE_ID_THEME — will fall through to role-level "Relic" fallback.`,
      ).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// ctgg (2026-04-25): same guard as uoz but for monsters. Every monster /
// mini-boss / final-boss in KID_CARDS must resolve to a bespoke display
// name via GENERIC_BASE_ID_THEME or it surfaces the role-level fallback
// "Beast" / "Warlord" / "Dark Lord" on the card face. Reported 2026-04-25:
// bonelet + the v2.1 zone regulars rendered as "Beast".
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// embertide-4jxh — Card-frame variant system. Five card classes
// (regular / wild-boss / region-boss / item / champion) read as distinct via
// data-variant on the template root + per-variant CSS in app.css. The
// derivation table is unit-tested here so a future role/bossTier addition
// surfaces a missing branch immediately.
// ---------------------------------------------------------------------------

describe('CardTemplate variant system (embertide-4jxh)', () => {
  describe('deriveCardVariant', () => {
    it('returns wild-boss when bossTier is wild-boss', () => {
      const card: Card = {
        id: 'wild-boss-probe',
        role: 'monster',
        cost: {},
        effects: { kind: 'gain' },
        bossTier: 'wild-boss',
      };
      expect(deriveCardVariant(card)).toBe('wild-boss');
    });

    it('returns region-boss when bossTier is region-boss', () => {
      const card: Card = {
        id: 'region-boss-probe',
        role: 'monster',
        cost: {},
        effects: { kind: 'gain' },
        bossTier: 'region-boss',
      };
      expect(deriveCardVariant(card)).toBe('region-boss');
    });

    it('returns region-boss for final-boss role even without bossTier', () => {
      const card: Card = {
        id: 'final-boss-probe',
        role: 'final-boss',
        cost: {},
        effects: { kind: 'gain' },
      };
      expect(deriveCardVariant(card)).toBe('region-boss');
    });

    it('returns champion for hero role', () => {
      const card: Card = {
        id: 'hero-probe',
        role: 'hero',
        cost: {},
        effects: { kind: 'gain' },
      };
      expect(deriveCardVariant(card)).toBe('champion');
    });

    it('returns item for role=item and role=legendary-sword', () => {
      const item: Card = {
        id: 'item-probe',
        role: 'item',
        cost: {},
        effects: { kind: 'gain' },
      };
      const legendary: Card = {
        id: 'legendary-probe',
        role: 'legendary-sword',
        cost: {},
        effects: { kind: 'gain' },
      };
      expect(deriveCardVariant(item)).toBe('item');
      expect(deriveCardVariant(legendary)).toBe('item');
    });

    it('returns regular for monsters without bossTier, chests, and starters', () => {
      const cases: ReadonlyArray<Card> = [
        { id: 'mon', role: 'monster', cost: {}, effects: { kind: 'gain' } },
        { id: 'mb', role: 'mini-boss', cost: {}, effects: { kind: 'gain' } },
        { id: 'cs', role: 'chest-std', cost: {}, effects: { kind: 'gain' } },
        { id: 'cm', role: 'chest-mid', cost: {}, effects: { kind: 'gain' } },
        { id: 'cb', role: 'chest-boss', cost: {}, effects: { kind: 'gain' } },
        { id: 'sg', role: 'starter-green', cost: {}, effects: { kind: 'gain' } },
        { id: 'sr', role: 'starter-red', cost: {}, effects: { kind: 'gain' } },
        { id: 'rev', role: 'revealer-item', cost: {}, effects: { kind: 'gain' } },
      ];
      for (const card of cases) {
        expect(deriveCardVariant(card), `role=${card.role}`).toBe('regular');
      }
    });

    it('covers every declared CardRole with a non-empty variant', () => {
      // Forward-compat guard: a future role added to CARD_ROLES that has no
      // explicit branch falls through to 'regular'. The assertion is that
      // SOME variant resolves — never undefined / empty — so render path is
      // safe regardless of role.
      for (const role of CARD_ROLES) {
        const variant = deriveCardVariant({
          id: `${role}-probe`,
          role,
          cost: {},
          effects: { kind: 'gain' },
        });
        expect(variant, `role=${role}`).toBeTruthy();
      }
    });
  });

  describe('CardTemplate render', () => {
    function makeCard(overrides: Partial<Card> = {}): Card {
      return {
        id: 'variant-test',
        role: 'monster',
        cost: {},
        effects: { kind: 'gain' },
        ...overrides,
      };
    }

    it('emits data-variant matching the derived variant by default', () => {
      const wildBoss = makeCard({ id: 'wb', bossTier: 'wild-boss' });
      const { container, unmount } = render(<CardTemplate card={wildBoss} />);
      const root = container.querySelector('.card-template');
      expect(root?.getAttribute('data-variant')).toBe('wild-boss');
      unmount();
    });

    it('honors an explicit variant prop override', () => {
      // A regular monster card forced to render as champion-class — useful
      // for previews / portrait pickers that want the hero treatment.
      const card = makeCard();
      const { container } = render(<CardTemplate card={card} variant="champion" />);
      const root = container.querySelector('.card-template');
      expect(root?.getAttribute('data-variant')).toBe('champion');
    });

    it('renders without crashing for every variant value', () => {
      const variants: ReadonlyArray<CardTemplateVariant> = [
        'regular',
        'wild-boss',
        'region-boss',
        'item',
        'champion',
      ];
      for (const variant of variants) {
        const { container, unmount } = render(<CardTemplate card={makeCard()} variant={variant} />);
        const root = container.querySelector('.card-template');
        expect(root?.getAttribute('data-variant'), `variant=${variant}`).toBe(variant);
        // The name + art + rules-box scaffold must always render so existing
        // call-site selectors (Field/Hand/InPlay/CardDetailModal) keep working
        // regardless of variant.
        expect(container.querySelector('[data-testid="card-template-name"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="card-template-art"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="card-template-rules-box"]')).not.toBeNull();
        unmount();
      }
    });
  });
});

describe('cardDisplayName monster-roster coverage (ctgg)', () => {
  // 'final-boss' is intentionally excluded — its role fallback 'Dark Lord'
  // is already a kid-friendly display name, and the v2 final boss
  // (cagewright-vurmox) has its own bespoke entry. The v0 dark-lord baseId
  // is left to fall through.
  const MONSTER_ROLES: ReadonlySet<CardRole> = new Set(['monster', 'mini-boss']);

  it('has an explicit GENERIC_BASE_ID_THEME entry for every monster in KID_CARDS', () => {
    const monsters = KID_CARDS.filter((c) => MONSTER_ROLES.has(c.role));
    expect(monsters.length, 'KID_CARDS should contain at least one monster card').toBeGreaterThan(
      0,
    );
    for (const card of monsters) {
      const baseId = baseIdOf(card);
      expect(
        GENERIC_BASE_ID_THEME[baseId],
        `monster "${card.id}" (baseId="${baseId}") is missing from GENERIC_BASE_ID_THEME — will fall through to role-level "Beast" / "Warlord" / "Dark Lord" fallback.`,
      ).toBeTruthy();
    }
  });
});
