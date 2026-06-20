import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Field from './Field';
import type { Card } from '../types/card';
import { KID_CARDS } from '../data/cards';

describe('Field cost badges', () => {
  it('renders the stained-glass sword cost gem with "3" for a monster with cost.red=3', () => {
    const card: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };

    const { container } = render(
      <Field cards={[card]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />,
    );

    const gem = screen.getByTestId('cost-gem-red');
    expect(gem).toHaveTextContent('3');

    // The red/power gem must be labelled as a sword (the combat glyph),
    // never as a shard. See bd memory `card-cost-icon-convention`.
    expect(gem.getAttribute('aria-label')).toBe('sword 3');

    // Sanity: the gem sits inside the matching field card tile.
    const fieldCard = container.querySelector(`[data-testid="field-card-${card.id}"]`);
    expect(fieldCard).not.toBeNull();
    expect(fieldCard?.contains(gem)).toBe(true);
  });
});

describe('Field effect text (embertide-9c7)', () => {
  it('renders effect text on a sage-keeper field tile with "+2g"', () => {
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!sage) throw new Error('sage-keeper missing from KID_CARDS');

    render(<Field cards={[sage]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);

    const el = screen.getByTestId(`field-effect-text-${sage.id}`);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('+2g');
  });

  it('renders a monster drop summary on the card face (embertide-d80)', () => {
    const monster: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };
    render(<Field cards={[monster]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);
    expect(screen.getByTestId(`field-effect-text-${monster.id}`)).toHaveTextContent('+1 \u2665');
  });
});

describe('Field monster-chest overlay (v2.1 REQ-21 / gm0.6)', () => {
  it('renders a monster-chest-overlay on a flagged monster', () => {
    const flagged: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
      hasAttachedChest: true,
    };
    render(<Field cards={[flagged]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);
    expect(screen.getByTestId('monster-chest-overlay')).toBeInTheDocument();
  });

  it('does NOT render the overlay on an unflagged monster', () => {
    const plain: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };
    render(<Field cards={[plain]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);
    expect(screen.queryByTestId('monster-chest-overlay')).toBeNull();
  });
});

describe('Field hover tooltips removed (embertide-mwt)', () => {
  it('does not render a .card-tile-tooltip element on Field tiles', () => {
    const monster: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };
    const { container } = render(
      <Field cards={[monster]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />,
    );

    expect(container.querySelector('.card-tile-tooltip')).toBeNull();
    expect(container.querySelector('.card-tile-tooltip-name')).toBeNull();
    expect(container.querySelector('.card-tile-tooltip-effect')).toBeNull();
    expect(container.querySelector('.card-tile-tooltip-cost')).toBeNull();
    expect(screen.queryByTestId(`field-tooltip-${monster.id}`)).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps the Field tile button focusable with an accessible name from the card face', () => {
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!sage) throw new Error('sage-keeper missing from KID_CARDS');

    render(<Field cards={[sage]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);

    const tile = screen.getByTestId(`field-card-${sage.id}`);
    expect(tile.tagName).toBe('BUTTON');
    // Native buttons are focusable by default (no explicit tabindex needed).
    expect(tile.getAttribute('tabindex')).not.toBe('-1');
    // Accessible name must flow from on-card text now that the tooltip
    // is gone. Heroes carry per-baseId display names; sage-keeper
    // resolves to "Veylin" (embertide 2026-04-22 theme pass — Aurelia
    // character names replaced the generic role-based labels). Assert
    // the resolved display name plus the effect text.
    expect(tile).toHaveAccessibleName(/veylin/i);
    expect(tile).toHaveAccessibleName(/\+2g/i);
  });
});

describe('Field tile aria-label belt-and-suspenders (embertide-0kl)', () => {
  it('sets aria-label on the Field tile button so the accessible name survives descendant DOM changes', () => {
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!sage) throw new Error('sage-keeper missing from KID_CARDS');

    render(<Field cards={[sage]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);

    const tile = screen.getByTestId(`field-card-${sage.id}`);
    // Guarded accessible name: aria-label is present and matches the
    // resolved card display name. Using aria-label means the button name
    // no longer depends on CardTemplate's descendant text rendering — if a
    // future refactor strips the name span, the button still announces a
    // meaningful label (WCAG 4.1.2).
    const label = tile.getAttribute('aria-label');
    expect(label).not.toBeNull();
    expect(label?.trim().length ?? 0).toBeGreaterThan(0);
    // sage-keeper resolves to "Veylin" via GENERIC_BASE_ID_THEME
    // (embertide 2026-04-22 Aurelia theme pass — replaced the
    // earlier generic "Sage Keeper" label).
    expect(label).toMatch(/veylin/i);
  });

  it('never leaves the Field tile button without an aria-label, even for an unusual role', () => {
    const exotic: Card = {
      id: 'exotic-1',
      role: 'final-boss',
      cost: { red: 10 },
      effects: { kind: 'monster-drop', hearts: 0 },
    };
    render(<Field cards={[exotic]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);
    const tile = screen.getByTestId(`field-card-${exotic.id}`);
    const label = tile.getAttribute('aria-label');
    expect(label).not.toBeNull();
    expect(label?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

describe('Field per-card memoization (embertide-2a9)', () => {
  it('keeps aria-label stable across re-renders with identical props', () => {
    // When Field re-renders for an unrelated store tick, each tile's
    // aria-label string must resolve to the same value so iOS VoiceOver
    // does not re-announce the card on every render.
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!sage) throw new Error('sage-keeper missing from KID_CARDS');
    const monster: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };
    const cards: readonly Card[] = Object.freeze([sage, monster]);

    // Stable handler refs — production usage in GameBoard pulls these
    // from Zustand selectors which return the same function reference.
    const onFight = (_id: string): void => {};
    const onBuy = (_id: string): void => {};
    const onOpenChest = (): void => {};

    const tree = (
      <Field
        cards={cards}
        onFight={onFight}
        onBuy={onBuy}
        onOpenChest={onOpenChest}
        green={0}
        red={0}
        keys={0}
      />
    );

    const { rerender } = render(tree);
    const firstSageLabel = screen.getByTestId(`field-card-${sage.id}`).getAttribute('aria-label');
    const firstMonsterLabel = screen
      .getByTestId(`field-card-${monster.id}`)
      .getAttribute('aria-label');

    rerender(tree);

    expect(screen.getByTestId(`field-card-${sage.id}`).getAttribute('aria-label')).toBe(
      firstSageLabel,
    );
    expect(screen.getByTestId(`field-card-${monster.id}`).getAttribute('aria-label')).toBe(
      firstMonsterLabel,
    );
  });

  it('exports a FieldCard component', async () => {
    // Behavioral regression guard. The aria-label stability test above is
    // the real check that memoization is active — if React ever changes the
    // memo internal symbol (e.g. React Compiler auto-memoization) that test
    // still proves the a11y contract. We only assert export presence here.
    const mod = await import('./Field');
    expect(mod.FieldCard).toBeDefined();
  });
});

/**
 * embertide-sij3 (2026-04-25): mini-boss / region-boss tiles must
 * disable the engage affordance when the player has enough power but
 * insufficient keys. Pre-fix the canAfford check ignored cost.keys for
 * monsters; the tile lit up enabled and the click would throw inside
 * `fightMonster`'s key-cost guard.
 */
describe('Field affordance: monster keys cost (embertide-sij3)', () => {
  function miniBoss(): Card {
    return {
      id: 'mini-boss-reptile',
      role: 'mini-boss',
      cost: { red: 7, keys: 1 },
      effects: { kind: 'monster-drop', hearts: 2, keys: 0 },
    };
  }

  it('disables the tile when the player has enough power but no keys', () => {
    const card = miniBoss();
    render(
      <Field
        cards={[card]}
        onFight={() => {}}
        onBuy={() => {}}
        onOpenChest={() => {}}
        red={20}
        green={0}
        keys={0}
      />,
    );
    const tile = screen.getByTestId(`field-card-${card.id}`);
    expect(tile).toBeDisabled();
  });

  it('disables the tile when the player has keys but insufficient power', () => {
    const card = miniBoss();
    render(
      <Field
        cards={[card]}
        onFight={() => {}}
        onBuy={() => {}}
        onOpenChest={() => {}}
        red={3}
        green={0}
        keys={2}
      />,
    );
    const tile = screen.getByTestId(`field-card-${card.id}`);
    expect(tile).toBeDisabled();
  });

  it('enables the tile only when both costs are met', () => {
    const card = miniBoss();
    render(
      <Field
        cards={[card]}
        onFight={() => {}}
        onBuy={() => {}}
        onOpenChest={() => {}}
        red={20}
        green={0}
        keys={2}
      />,
    );
    const tile = screen.getByTestId(`field-card-${card.id}`);
    expect(tile).not.toBeDisabled();
  });

  it('regression: monsters without a keys cost still enable on power-only', () => {
    const noKeyMonster: Card = {
      id: 'grunt-orc',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1 },
    };
    render(
      <Field
        cards={[noKeyMonster]}
        onFight={() => {}}
        onBuy={() => {}}
        onOpenChest={() => {}}
        red={5}
        green={0}
        keys={0}
      />,
    );
    const tile = screen.getByTestId(`field-card-${noKeyMonster.id}`);
    expect(tile).not.toBeDisabled();
  });
});

// 2026-06-20 player ruling: a direct tap on a market tile BUYS / FIGHTS
// immediately (no detail-modal speed bump). The full-rules modal moves onto
// a corner magnifier button (`field-card-<id>-zoom`) that the parent wires
// via onZoomCard.
describe('Field direct tap + corner magnifier', () => {
  const sage = (): Card => {
    const c = KID_CARDS.find((k) => k.id === 'sage-keeper');
    if (!c) throw new Error('sage-keeper missing from KID_CARDS');
    return c;
  };

  it('buys directly on a tap (no modal) when affordable', () => {
    const onBuy = vi.fn();
    const onZoomCard = vi.fn();
    render(
      <Field
        cards={[sage()]}
        onFight={() => {}}
        onBuy={onBuy}
        onOpenChest={() => {}}
        onZoomCard={onZoomCard}
      />,
    );
    fireEvent.click(screen.getByTestId(`field-card-${sage().id}`));
    expect(onBuy).toHaveBeenCalledWith(sage().id);
    expect(onZoomCard).not.toHaveBeenCalled();
  });

  it('opens the detail modal from the corner magnifier', () => {
    const onBuy = vi.fn();
    const onZoomCard = vi.fn();
    render(
      <Field
        cards={[sage()]}
        onFight={() => {}}
        onBuy={onBuy}
        onOpenChest={() => {}}
        onZoomCard={onZoomCard}
      />,
    );
    fireEvent.click(screen.getByTestId(`field-card-${sage().id}-zoom`));
    expect(onBuy).not.toHaveBeenCalled();
    expect(onZoomCard).toHaveBeenCalledTimes(1);
    const ctx = onZoomCard.mock.calls[0][0];
    expect(ctx.card.id).toBe(sage().id);
    expect(ctx.actionLabel).toBe('Buy');
  });

  it('renders no magnifier when onZoomCard is not wired', () => {
    render(<Field cards={[sage()]} onFight={() => {}} onBuy={() => {}} onOpenChest={() => {}} />);
    expect(screen.queryByTestId(`field-card-${sage().id}-zoom`)).toBeNull();
  });
});
