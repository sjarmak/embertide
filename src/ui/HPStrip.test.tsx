import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HPStrip from './HPStrip';
import type { KidPlayer, Phase } from '../store/types';
import { makeKidPlayer } from '../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player 1',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

interface RenderOverrides {
  readonly player?: Partial<KidPlayer>;
  readonly isActive?: boolean;
  readonly isTeammateView?: boolean;
  readonly onRevive?: () => void;
  readonly phase?: Phase;
  readonly activePlayerRevivedThisIncident?: boolean;
}

function renderStrip(o: RenderOverrides = {}) {
  const player = makePlayer(o.player);
  return render(
    <HPStrip
      player={player}
      isActive={o.isActive ?? false}
      isTeammateView={o.isTeammateView}
      onRevive={o.onRevive}
      phase={o.phase ?? 'Main'}
      activePlayerRevivedThisIncident={o.activePlayerRevivedThisIncident ?? false}
    />,
  );
}

function countSockets(playerId: string, filled: boolean): number {
  const nodes = document.querySelectorAll(
    `[data-testid^="hp-strip-${playerId}-socket-"][data-filled="${filled}"]`,
  );
  return nodes.length;
}

describe('HPStrip', () => {
  it('renders hpMax=5 / hp=5 as 5 filled sockets and 0 empty', () => {
    renderStrip({ player: { hp: 5, hpMax: 5 } });
    expect(countSockets('p0', true)).toBe(5);
    expect(countSockets('p0', false)).toBe(0);
  });

  it('renders hpMax=5 / hp=3 as 3 filled, 2 empty', () => {
    renderStrip({ player: { hp: 3, hpMax: 5 } });
    expect(countSockets('p0', true)).toBe(3);
    expect(countSockets('p0', false)).toBe(2);
  });

  it('renders hpMax=5 / hp=0 as 0 filled, 5 empty', () => {
    renderStrip({ player: { hp: 0, hpMax: 5 } });
    expect(countSockets('p0', true)).toBe(0);
    expect(countSockets('p0', false)).toBe(5);
  });

  it('respects hpMax != 5 (does not hardcode 5 sockets)', () => {
    renderStrip({ player: { hp: 6, hpMax: 8 } });
    expect(countSockets('p0', true)).toBe(6);
    expect(countSockets('p0', false)).toBe(2);
    // And 8 total sockets are in the DOM.
    const all = document.querySelectorAll('[data-testid^="hp-strip-p0-socket-"]');
    expect(all.length).toBe(8);
  });

  it('when downed=true every socket carries data-downed="true" AND the downed ribbon is visible', () => {
    renderStrip({ player: { hp: 0, hpMax: 5, downed: true } });
    const sockets = document.querySelectorAll('[data-testid^="hp-strip-p0-socket-"]');
    expect(sockets.length).toBe(5);
    for (const s of Array.from(sockets)) {
      expect(s.getAttribute('data-downed')).toBe('true');
    }
    expect(screen.getByTestId('hp-strip-p0-downed-ribbon')).toBeInTheDocument();
  });

  it('when downed=false the downed ribbon is not rendered', () => {
    renderStrip({ player: { hp: 3, hpMax: 5, downed: false } });
    expect(screen.queryByTestId('hp-strip-p0-downed-ribbon')).toBeNull();
  });

  it('revive button is present AND enabled when teammate-view + downed + budget available + Main phase', () => {
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: true,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
      onRevive: () => {},
    });
    const btn = screen.getByTestId('hp-strip-p0-revive-button');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('revive button is present but DISABLED when the active player has already revived this incident', () => {
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: true,
      phase: 'Main',
      activePlayerRevivedThisIncident: true,
      onRevive: () => {},
    });
    const btn = screen.getByTestId('hp-strip-p0-revive-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-label')).toMatch(/already used this incident/i);
  });

  it('revive button is present but DISABLED outside Main phase', () => {
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: true,
      phase: 'Upkeep',
      activePlayerRevivedThisIncident: false,
      onRevive: () => {},
    });
    const btn = screen.getByTestId('hp-strip-p0-revive-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-label')).toMatch(/main phase/i);
  });

  it('revive button is NOT rendered when onRevive callback is not wired (reviewer finding 1)', () => {
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: true,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
      // onRevive intentionally omitted
    });
    expect(screen.queryByTestId('hp-strip-p0-revive-button')).toBeNull();
  });

  it('does NOT render the revive button when teammate is NOT downed', () => {
    renderStrip({
      player: { hp: 3, hpMax: 5, downed: false },
      isTeammateView: true,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
    });
    expect(screen.queryByTestId('hp-strip-p0-revive-button')).toBeNull();
  });

  it('does NOT render the revive button on the self view even when downed (cannot revive yourself)', () => {
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: false,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
    });
    expect(screen.queryByTestId('hp-strip-p0-revive-button')).toBeNull();
  });

  it('invokes onRevive exactly once when the revive button is clicked', () => {
    const onRevive = vi.fn();
    renderStrip({
      player: { hp: 0, hpMax: 5, downed: true },
      isTeammateView: true,
      onRevive,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
    });
    const btn = screen.getByTestId('hp-strip-p0-revive-button');
    btn.click();
    expect(onRevive).toHaveBeenCalledTimes(1);
  });

  // ---- v2.1 gm0.17 ember-shard meter + 4-segment pending heart --------
  it('renders the ember-shard stack when heartPieces === 1 (1 filled wedge)', () => {
    renderStrip({ player: { heartPieces: 1 } });
    expect(screen.getByTestId('hp-strip-p0-ember-shard-stack')).toBeInTheDocument();
    expect(screen.getByTestId('hp-strip-p0-ember-shard-pending').getAttribute('data-pieces')).toBe(
      '1',
    );
    expect(screen.getByTestId('hp-strip-p0-ember-shard-wedge-0')).toBeInTheDocument();
    // Only the first wedge is filled.
    expect(screen.queryByTestId('hp-strip-p0-ember-shard-wedge-1')).toBeNull();
  });

  it('renders 3 filled wedges when heartPieces === 3 (pending heart is 3/4 filled)', () => {
    renderStrip({ player: { heartPieces: 3 } });
    expect(screen.getByTestId('hp-strip-p0-ember-shard-pending').getAttribute('data-pieces')).toBe(
      '3',
    );
    expect(screen.getByTestId('hp-strip-p0-ember-shard-wedge-0')).toBeInTheDocument();
    expect(screen.getByTestId('hp-strip-p0-ember-shard-wedge-1')).toBeInTheDocument();
    expect(screen.getByTestId('hp-strip-p0-ember-shard-wedge-2')).toBeInTheDocument();
    // Wedge 3 (top-right) stays empty until auto-promotion.
    expect(screen.queryByTestId('hp-strip-p0-ember-shard-wedge-3')).toBeNull();
  });

  it('renders a 3-segment meter; filled pips match emberShardMeter', () => {
    renderStrip({ player: { emberShardMeter: 2, heartPieces: 0 } });
    const meter = screen.getByTestId('hp-strip-p0-ember-shard-meter');
    expect(meter.getAttribute('data-meter')).toBe('2');
    expect(screen.getByTestId('hp-strip-p0-meter-pip-0').getAttribute('data-filled')).toBe('true');
    expect(screen.getByTestId('hp-strip-p0-meter-pip-1').getAttribute('data-filled')).toBe('true');
    expect(screen.getByTestId('hp-strip-p0-meter-pip-2').getAttribute('data-filled')).toBe('false');
  });

  it('shows the stack when meter > 0 even with 0 pieces (progress toward next piece)', () => {
    renderStrip({ player: { emberShardMeter: 1, heartPieces: 0 } });
    expect(screen.getByTestId('hp-strip-p0-ember-shard-stack')).toBeInTheDocument();
    expect(screen.getByTestId('hp-strip-p0-ember-shard-pending').getAttribute('data-pieces')).toBe(
      '0',
    );
    expect(screen.queryByTestId('hp-strip-p0-ember-shard-wedge-0')).toBeNull();
  });

  it('renders the stack even at fresh-game 0/0 so the empty structure signals the progression goal', () => {
    renderStrip({ player: { heartPieces: 0, emberShardMeter: 0 } });
    expect(screen.getByTestId('hp-strip-p0-ember-shard-stack')).toBeInTheDocument();
    // All meter pips and wedges render as empty (data-filled='false').
    for (let i = 0; i < 3; i += 1) {
      expect(screen.getByTestId(`hp-strip-p0-meter-pip-${i}`).getAttribute('data-filled')).toBe(
        'false',
      );
    }
  });

  it('hides the stack at the transient heartPieces === 4 (auto-promotes, should never rest)', () => {
    renderStrip({ player: { heartPieces: 4 } });
    expect(screen.queryByTestId('hp-strip-p0-ember-shard-stack')).toBeNull();
  });

  // ---- v2.1 gm0.17 container-lands pulse ---------------------------------
  it('adds container-pulse class to the newly-grown socket when hpMax increments', () => {
    const { rerender } = renderStrip({ player: { hp: 5, hpMax: 5 } });
    // hpMax grows 5 → 6 (container drop landed).
    rerender(
      <HPStrip
        player={makePlayer({ hp: 6, hpMax: 6 })}
        isActive={false}
        phase="Main"
        activePlayerRevivedThisIncident={false}
      />,
    );
    // The newest socket (index 5) carries the pulse class + attribute.
    const newestWrap = screen.getByTestId('hp-strip-p0-hpslot-5');
    expect(newestWrap.getAttribute('data-container-pulse')).toBe('true');
    expect(newestWrap.className).toContain('hp-socket-container-pulse');
    // Older sockets do NOT carry the pulse.
    expect(
      screen.getByTestId('hp-strip-p0-hpslot-0').getAttribute('data-container-pulse'),
    ).toBeNull();
  });

  it('does NOT add the container-pulse class on initial render (no growth event)', () => {
    renderStrip({ player: { hp: 5, hpMax: 5 } });
    for (let i = 0; i < 5; i += 1) {
      const wrap = screen.getByTestId(`hp-strip-p0-hpslot-${i}`);
      expect(wrap.getAttribute('data-container-pulse')).toBeNull();
    }
  });
});
