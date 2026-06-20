import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import PlayerTray from './PlayerTray';
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

function renderTray(o: RenderOverrides = {}) {
  const player = makePlayer(o.player);
  return render(
    <PlayerTray
      player={player}
      isActive={o.isActive ?? true}
      isTeammateView={o.isTeammateView}
      onRevive={o.onRevive}
      phase={o.phase ?? 'Main'}
      activePlayerRevivedThisIncident={o.activePlayerRevivedThisIncident ?? false}
    />,
  );
}

describe('PlayerTray', () => {
  it('renders the combat resource counter with a Sword icon (not a RedShard diamond)', () => {
    renderTray({ player: { id: 'p0', red: 5 } });

    const counter = screen.getByTestId('tray-red-p0');
    expect(counter).toHaveTextContent('5');

    const counterRoot = counter.parentElement;
    expect(counterRoot).not.toBeNull();
    const swordSvg = counterRoot?.querySelector('svg[aria-label="sword"]');
    expect(swordSvg).not.toBeNull();
    const redShardSvg = counterRoot?.querySelector('svg[aria-label="red-shard"]');
    expect(redShardSvg).toBeNull();
  });

  it('mounts an HPStrip keyed to the player id', () => {
    renderTray({ player: { id: 'p0' } });
    expect(screen.getByTestId('hp-strip-p0')).toBeInTheDocument();
  });

  it('retires the legacy tray-hearts testid (u-2a contract) — replaced by hp-strip', () => {
    renderTray({ player: { id: 'p0', hp: 3 } });
    expect(screen.queryByTestId('tray-hearts-p0')).toBeNull();
    // The HPStrip surface is the replacement.
    expect(screen.getByTestId('hp-strip-p0')).toBeInTheDocument();
  });

  it('forwards downed state to HPStrip (ribbon appears on the HPStrip, not the tray frame)', () => {
    renderTray({ player: { id: 'p0', hp: 0, downed: true } });
    expect(screen.getByTestId('hp-strip-p0-downed-ribbon')).toBeInTheDocument();
  });

  it('does NOT render a Revive button when isTeammateView is not set (self-view)', () => {
    renderTray({ player: { hp: 0, downed: true } });
    expect(screen.queryByTestId('hp-strip-p0-revive-button')).toBeNull();
  });

  it('renders a Revive button when isTeammateView=true + downed + budget available + Main phase', () => {
    const onRevive = vi.fn();
    renderTray({
      player: { id: 'p0', hp: 0, downed: true },
      isTeammateView: true,
      onRevive,
      phase: 'Main',
      activePlayerRevivedThisIncident: false,
    });
    const btn = screen.getByTestId('hp-strip-p0-revive-button');
    expect(btn).not.toBeDisabled();
    btn.click();
    expect(onRevive).toHaveBeenCalledTimes(1);
  });

  it('surfaces HPStrip HP-gain feedback when HP rises (embertide-9c7 preserved under HPStrip)', () => {
    const { rerender } = render(
      <PlayerTray
        player={makePlayer({ id: 'p0', hp: 2 })}
        isActive
        phase="Main"
        activePlayerRevivedThisIncident={false}
      />,
    );
    expect(screen.queryByTestId('heart-feedback-p0')).toBeNull();
    act(() => {
      rerender(
        <PlayerTray
          player={makePlayer({ id: 'p0', hp: 3 })}
          isActive
          phase="Main"
          activePlayerRevivedThisIncident={false}
        />,
      );
    });
    const feedback = screen.getByTestId('heart-feedback-p0');
    expect(feedback).toBeInTheDocument();
    expect(feedback).toHaveTextContent('+1');
  });

  it('does not mount HP-gain feedback when HP stays the same', () => {
    const { rerender } = render(
      <PlayerTray
        player={makePlayer({ id: 'p0', hp: 2 })}
        isActive
        phase="Main"
        activePlayerRevivedThisIncident={false}
      />,
    );
    act(() => {
      rerender(
        <PlayerTray
          player={makePlayer({ id: 'p0', hp: 2 })}
          isActive
          phase="Main"
          activePlayerRevivedThisIncident={false}
        />,
      );
    });
    expect(screen.queryByTestId('heart-feedback-p0')).toBeNull();
  });

  it('mounts HP-loss feedback ("-N" in ruby) when HP decreases (rev-2 2026-04-22)', () => {
    // Rev-2 2026-04-22: HeartFeedback gained a loss variant so boss
    // damage visibly registers on the HPStrip. Before, HP decreases
    // only pulsed the socket count with no floating indicator.
    const { rerender } = render(
      <PlayerTray
        player={makePlayer({ id: 'p0', hp: 3 })}
        isActive
        phase="Main"
        activePlayerRevivedThisIncident={false}
      />,
    );
    act(() => {
      rerender(
        <PlayerTray
          player={makePlayer({ id: 'p0', hp: 2 })}
          isActive
          phase="Main"
          activePlayerRevivedThisIncident={false}
        />,
      );
    });
    const el = screen.getByTestId('heart-feedback-p0');
    expect(el).toHaveTextContent('-1');
    expect(el).toHaveAttribute('data-direction', 'loss');
  });
});
