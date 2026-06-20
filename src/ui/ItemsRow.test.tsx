import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItemsRow from './ItemsRow';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';

const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;
const TOWER_SHIELD = KID_CARDS.find((c) => c.id === 'tower-shield')!;
const ANCIENT_BLADE = KID_CARDS.find((c) => c.id === 'ancient-blade')!;
const WISP = KID_CARDS.find((c) => c.id === 'wisp')!;

describe('ItemsRow', () => {
  // ---------------------------------------------------------------------------
  // Migrated from ConstructsRow.test.tsx — empty state + basic render.
  // ---------------------------------------------------------------------------

  it('renders an empty container with an empty hint when no items', () => {
    render(<ItemsRow cards={[]} />);
    const row = screen.getByTestId('items-row');
    expect(row).toBeInTheDocument();
    expect(screen.getByTestId('items-row-empty')).toBeInTheDocument();
    const tiles = row.querySelectorAll('[data-testid^="item-"]');
    // Only the empty-state element matches; no per-card tiles.
    expect(
      Array.from(tiles).filter((t) => t.getAttribute('data-testid') !== 'items-row-empty'),
    ).toHaveLength(0);
  });

  it('renders one tile per item with the start-of-turn trigger text', () => {
    render(<ItemsRow cards={[SHORT_SWORD, TOWER_SHIELD, ANCIENT_BLADE]} />);
    expect(screen.getByTestId(`item-${SHORT_SWORD.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-${TOWER_SHIELD.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`item-${ANCIENT_BLADE.id}`)).toBeInTheDocument();

    expect(screen.getByTestId(`item-effect-${SHORT_SWORD.id}`)).toHaveTextContent('+1 power/turn');
    expect(screen.getByTestId(`item-effect-${TOWER_SHIELD.id}`)).toHaveTextContent('+1g/turn');
    expect(screen.getByTestId(`item-effect-${ANCIENT_BLADE.id}`)).toHaveTextContent(
      '+2 power/turn',
    );
  });

  it('resolves trigger text via baseId for duplicate-suffix copies', () => {
    // Duplicate supply copies carry a `baseId` that points back at the
    // canonical template id (see data/cards.ts mintAlwaysAvailable). This
    // fixture mirrors that shape so baseIdOf resolves 'short-sword-9' →
    // 'short-sword' and the hidden effect span shows the Relic's trigger.
    const dup = {
      ...SHORT_SWORD,
      id: 'short-sword-9',
      baseId: 'short-sword',
    } as Card & { readonly baseId: string };
    render(<ItemsRow cards={[dup]} />);
    expect(screen.getByTestId(`item-effect-${dup.id}`)).toHaveTextContent('+1 power/turn');
  });

  // ---------------------------------------------------------------------------
  // New u-2d coverage (DAG acceptance: unbounded items, cooldown readout, wisp flow).
  // ---------------------------------------------------------------------------

  it('(a) unbounded items — ItemsRow renders one tile per item with no upper cap (nmmc)', () => {
    const many: readonly Card[] = [
      SHORT_SWORD,
      TOWER_SHIELD,
      ANCIENT_BLADE,
      { ...SHORT_SWORD, id: 'short-sword-2', baseId: 'short-sword' } as Card,
      { ...TOWER_SHIELD, id: 'tower-shield-2', baseId: 'tower-shield' } as Card,
    ];
    render(<ItemsRow cards={many} />);
    const row = screen.getByTestId('items-row');
    const tiles = row.querySelectorAll(
      '[data-testid^="item-"]:not([data-testid="items-row-empty"])',
    );
    const tileRoots = Array.from(tiles).filter((t) => t.className.includes('item-tile'));
    expect(tileRoots).toHaveLength(5);
  });

  it('(b) item-active cooldown readout — "Ready" when cooldownTurns=0', () => {
    render(<ItemsRow cards={[SHORT_SWORD]} />);
    const cooldown = screen.getByTestId(`item-cooldown-${SHORT_SWORD.id}`);
    expect(cooldown).toHaveTextContent('Ready');
  });

  it('(b) item-active cooldown readout — shows turns-remaining when > 0', () => {
    const cooling: Card = {
      ...SHORT_SWORD,
      id: 'short-sword-cooling',
      cooldownTurns: 2,
    };
    render(<ItemsRow cards={[cooling]} />);
    const cooldown = screen.getByTestId(`item-cooldown-${cooling.id}`);
    expect(cooldown).toHaveTextContent('2');
  });

  it('(c) wisp-on-downed-teammate flow — tap invokes onPlayFairy with teammate id', () => {
    const onPlayFairy = vi.fn();
    render(<ItemsRow cards={[WISP]} downedTeammateId="p1" onPlayFairy={onPlayFairy} />);
    const tapButton = screen.getByTestId(`item-wisp-tap-${WISP.id}`);
    expect(tapButton).not.toBeDisabled();
    tapButton.click();
    expect(onPlayFairy).toHaveBeenCalledTimes(1);
    expect(onPlayFairy).toHaveBeenCalledWith('p1');
  });

  it('(d) wisp outside downed-teammate context — tap is a no-op (onPlayFairy never called)', () => {
    const onPlayFairy = vi.fn();
    render(<ItemsRow cards={[WISP]} downedTeammateId={null} onPlayFairy={onPlayFairy} />);
    const tapButton = screen.getByTestId(`item-wisp-tap-${WISP.id}`);
    // Button must still render (so the card is visible), but be disabled
    // + calling the click handler must NOT invoke onPlayFairy.
    expect(tapButton).toBeDisabled();
    tapButton.click();
    expect(onPlayFairy).not.toHaveBeenCalled();
  });

  it('wisp without onPlayFairy prop renders without throwing (read-only items row)', () => {
    // Older call sites (legacy tests, stories) pass no callback. The component
    // must degrade gracefully — render the wisp card, no button wired.
    render(<ItemsRow cards={[WISP]} />);
    expect(screen.getByTestId(`item-${WISP.id}`)).toBeInTheDocument();
  });

  it('non-wisp items do NOT render a tap-to-use button', () => {
    render(<ItemsRow cards={[SHORT_SWORD]} />);
    // short-sword is a passive-trigger Relic — no tap affordance.
    expect(screen.queryByTestId(`item-wisp-tap-${SHORT_SWORD.id}`)).toBeNull();
  });
});
