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

  // round2 (player layout pass): the expanded top row dropped the cramped,
  // clipped rules-text plate (player report: "rules text cut off in an ugly
  // way"). Each tile now renders a NAME + IMAGE face only; the full rules
  // live one tap away in the shared CardDetailModal (see the zoom tests
  // below). The old "effect text in the card-template rules box" assertion
  // is retired with the rules box it targeted.
  it('renders a name+image face (no clipped rules-text plate) in expanded mode', () => {
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
    const mystic = screen.getByTestId('always-available-mystic');
    // Name + art face present...
    expect(mystic.querySelector('.always-available-face-name')?.textContent).toBe('Oracle');
    expect(mystic.querySelector('[data-testid="always-available-face-art"]')).not.toBeNull();
    // ...and the old clipped rules-text plate is gone.
    expect(mystic.querySelector('[data-testid="card-template-rules-box"]')).toBeNull();
    expect(mystic.querySelector('[data-testid="card-template-effect"]')).toBeNull();
  });

  describe('click-to-expand (onZoomCard wired)', () => {
    it('opens the zoom modal instead of dispatching directly, and stays clickable when unaffordable', () => {
      const onBuy = vi.fn();
      const onZoomCard = vi.fn();
      render(
        <AlwaysAvailableRow
          green={0}
          red={0}
          onBuy={onBuy}
          onFight={() => {}}
          onTrade={() => {}}
          usedKeyVendorThisTurn={false}
          onZoomCard={onZoomCard}
        />,
      );
      const mystic = screen.getByTestId('always-available-mystic') as HTMLButtonElement;
      // Clickable even though the player cannot afford it (the affordability
      // gate moves to the modal's action button) so the player can read the
      // rules before they can pay.
      expect(mystic.disabled).toBe(false);
      expect(mystic.getAttribute('data-affordable')).toBe('false');
      fireEvent.click(mystic);
      // The tap opens the modal; it does NOT buy directly.
      expect(onBuy).not.toHaveBeenCalled();
      expect(onZoomCard).toHaveBeenCalledTimes(1);
      const ctx = onZoomCard.mock.calls[0][0];
      expect(ctx.card.id).toBe('mystic');
      expect(ctx.actionLabel).toBe('Buy');
      expect(ctx.disabled).toBe(true);
      // The ctx action performs the buy when the modal confirms.
      ctx.action();
      expect(onBuy).toHaveBeenCalledWith('mystic');
    });

    it('routes the monster tile to a Fight action via the zoom ctx', () => {
      const onFight = vi.fn();
      const onZoomCard = vi.fn();
      render(
        <AlwaysAvailableRow
          green={10}
          red={10}
          onBuy={() => {}}
          onFight={onFight}
          onTrade={() => {}}
          usedKeyVendorThisTurn={false}
          onZoomCard={onZoomCard}
        />,
      );
      fireEvent.click(screen.getByTestId('always-available-wild-wolf'));
      const ctx = onZoomCard.mock.calls[0][0];
      expect(ctx.actionLabel).toBe('Fight');
      ctx.action();
      expect(onFight).toHaveBeenCalledWith('wild-wolf');
    });
  });
});
