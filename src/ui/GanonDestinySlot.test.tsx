import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GanonDestinySlot from './GanonDestinySlot';
import { useGameStore } from '../store/gameStore';
import { createSeededRng } from '../rules/chestPool';
import type { KidGameState, KidPlayer, ZoneId } from '../store/types';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player 1',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer()],
    rng: createSeededRng(0),
    currentZone: 'gilded-cage' as ZoneId,
    zoneHistory: ['sylvani', 'emberpeak'],
    defeatedBossIds: ['sentinel', 'silver-chimera'],
    bossKeys: {
      sylvani: ['craghorn'],
      'emberpeak': ['boulderkin'],
      maren: ['maelstrom'],
      'hollow-shrine': ['hollow-effigy'],
      'dune-sanctum': ['iron-sentinel'],
      'gilded-cage': ['sentinel', 'silver-chimera'],
    },
    ...overrides,
  });
}

describe('GanonDestinySlot (u-9d)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('renders the DESTINY header with the destiny variant', () => {
    render(<GanonDestinySlot />);
    expect(screen.getByTestId('vurmox-destiny-slot')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-header').textContent).toBe('DESTINY');
    expect(screen.getByTestId('vurmox-destiny-slot').getAttribute('data-variant')).toBe('destiny');
  });

  it('renders Cagewright Vurmox name + tuned HP readout (embertide-3dc)', () => {
    render(<GanonDestinySlot />);
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Cagewright Vurmox');
    // Vurmox is tuned to 20 in BOSS_HP (BOSS_HP['cagewright-vurmox']).
    // Before embertide-3dc the altar showed 12 (region-boss tier
    // default); combat opened at 20. Now altar label matches combat.
    expect(screen.getByTestId('boss-altar-pane-hp').textContent).toBe('HP 20');
  });

  it('tap dispatches engageRegionBossSlot("gilded-cage", "cagewright-vurmox")', () => {
    const engage = vi.fn();
    useGameStore.setState({ ...makeState(), engageRegionBossSlot: engage });
    render(<GanonDestinySlot />);
    fireEvent.click(screen.getByTestId('vurmox-destiny-slot'));
    expect(engage).toHaveBeenCalledTimes(1);
    expect(engage).toHaveBeenCalledWith('gilded-cage', 'cagewright-vurmox');
  });

  it('renders destiny ornament <img> AND the CSS mandala overlay (u-10d)', () => {
    render(<GanonDestinySlot />);
    const ornament = screen.getByTestId('boss-altar-pane-ornament') as HTMLImageElement;
    expect(ornament.getAttribute('src')).toMatch(/cathedral_altar_destiny_vurmox_001\.webp$/);
    expect(screen.getByTestId('boss-altar-pane-mandala')).toBeInTheDocument();
  });

  it('renders a cleared placeholder once Vurmox is defeated', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({
        defeatedBossIds: ['sentinel', 'silver-chimera', 'cagewright-vurmox'],
      }),
      engageRegionBossSlot: engage,
    });
    render(<GanonDestinySlot />);
    const root = screen.getByTestId('vurmox-destiny-slot');
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('boss-altar-pane-cleared')).toBeInTheDocument();
    fireEvent.click(root);
    expect(engage).not.toHaveBeenCalled();
  });
});
