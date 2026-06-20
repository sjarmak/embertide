import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlwaysAvailableRow from './AlwaysAvailableRow';

describe('AlwaysAvailableRow', () => {
  it('renders three tiles — mystic, militia-grunt, wild-wolf', () => {
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    expect(screen.getByTestId('always-available-row')).toBeInTheDocument();
    expect(screen.getByTestId('always-available-mystic')).toBeInTheDocument();
    expect(screen.getByTestId('always-available-militia-grunt')).toBeInTheDocument();
    expect(screen.getByTestId('always-available-wild-wolf')).toBeInTheDocument();
  });

  it('disables the mystic buy button when green is insufficient (need 3g)', () => {
    render(
      <AlwaysAvailableRow
        green={2}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    const mystic = screen.getByTestId('always-available-mystic') as HTMLButtonElement;
    expect(mystic.disabled).toBe(true);
  });

  it('disables the militia-grunt buy button when green is insufficient (need 2g)', () => {
    render(
      <AlwaysAvailableRow
        green={1}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    const militia = screen.getByTestId('always-available-militia-grunt') as HTMLButtonElement;
    expect(militia.disabled).toBe(true);
  });

  it('disables the wild-wolf fight button when red is insufficient (need 2 power)', () => {
    render(
      <AlwaysAvailableRow
        green={10}
        red={1}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    const wolf = screen.getByTestId('always-available-wild-wolf') as HTMLButtonElement;
    expect(wolf.disabled).toBe(true);
  });

  it('enables buy and fight buttons when the player can afford them', () => {
    render(
      <AlwaysAvailableRow
        green={5}
        red={5}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    expect((screen.getByTestId('always-available-mystic') as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(
      (screen.getByTestId('always-available-militia-grunt') as HTMLButtonElement).disabled,
    ).toBe(false);
    expect((screen.getByTestId('always-available-wild-wolf') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('dispatches onBuy with the correct baseId on hero click', () => {
    const onBuy = vi.fn();
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={onBuy}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    fireEvent.click(screen.getByTestId('always-available-mystic'));
    expect(onBuy).toHaveBeenCalledWith('mystic');
    fireEvent.click(screen.getByTestId('always-available-militia-grunt'));
    expect(onBuy).toHaveBeenCalledWith('militia-grunt');
  });

  it('dispatches onFight with the correct baseId on monster click', () => {
    const onFight = vi.fn();
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={() => {}}
        onFight={onFight}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    fireEvent.click(screen.getByTestId('always-available-wild-wolf'));
    expect(onFight).toHaveBeenCalledWith('wild-wolf');
  });

  it('renders the Pell vendor tile (embertide-1eby) and dispatches onTrade on click', () => {
    const onTrade = vi.fn();
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={onTrade}
        usedKeyVendorThisTurn={false}
      />,
    );
    const pell = screen.getByTestId('always-available-key-vendor');
    expect(pell).toBeInTheDocument();
    expect(pell.getAttribute('data-role')).toBe('vendor');
    fireEvent.click(pell);
    expect(onTrade).toHaveBeenCalledWith('key-vendor');
  });

  it('disables the Pell vendor tile when green < 4', () => {
    render(
      <AlwaysAvailableRow
        green={3}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    const pell = screen.getByTestId('always-available-key-vendor') as HTMLButtonElement;
    expect(pell.disabled).toBe(true);
  });

  it('disables the Pell vendor tile when the active player has already traded this turn (kqgp / 5y13 knob 2)', () => {
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={true}
      />,
    );
    const pell = screen.getByTestId('always-available-key-vendor') as HTMLButtonElement;
    expect(pell.disabled).toBe(true);
  });

  it('shows the effect text for each tile inside the card template rules box', () => {
    render(
      <AlwaysAvailableRow
        green={10}
        red={10}
        onBuy={() => {}}
        onFight={() => {}}
        onTrade={() => {}}
        usedKeyVendorThisTurn={false}
      />,
    );
    // Resource words (g, power, heart) are now rendered as inline icons
    // inside the effect-text node tree (embertide-9jg). Visible text
    // retains only the amount; the icon carries the resource meaning.
    const effectOf = (testId: string): Element =>
      screen.getByTestId(testId).querySelector('[data-testid="card-template-effect"]') as Element;

    const mystic = effectOf('always-available-mystic');
    expect(mystic.textContent ?? '').toContain('+2');
    expect(mystic.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();

    const militia = effectOf('always-available-militia-grunt');
    expect(militia.textContent ?? '').toContain('+2');
    expect(militia.querySelector('svg[aria-label="sword"]')).not.toBeNull();

    // z9xq (2026-04-25): wild-wolf no longer drops a heart on defeat —
    // kills now contribute to the ember-shard meter via
    // GRUNT_HEART_METER_IDS. effectTextFor collapses hearts=0 with no
    // extras, so the rules-box effect element may not render at all.
    // Either it's absent OR it's present without a heart icon / +1.
    const wolfTile = screen.getByTestId('always-available-wild-wolf');
    const wolfEffect = wolfTile.querySelector('[data-testid="card-template-effect"]');
    if (wolfEffect !== null) {
      expect(wolfEffect.querySelector('svg[aria-label="heart"]')).toBeNull();
      expect(wolfEffect.textContent ?? '').not.toContain('+1');
    }

    // embertide-1eby: Pell (vendor) advertises the +1 key grant
    // in the rules box so the trade isn't visually identical to a
    // mute Card placeholder.
    const pell = effectOf('always-available-key-vendor');
    expect(pell.textContent ?? '').toContain('+1');
    expect(pell.querySelector('svg[aria-label="key"]')).not.toBeNull();
  });
});
