import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { useTutorialStore } from './store/tutorialStore';
import { useGameStore } from './store/gameStore';
import { createSeededRng } from './rules/chestPool';
import { KID_CHAMPIONS } from './data/champions';
import { initialPrincessCrystalState } from './store/slices/crystal';

describe('App', () => {
  beforeEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {
      // jsdom's storage shouldn't throw, but swallow to stay test-safe.
    }
    useTutorialStore.getState().reset();
    useGameStore.setState({
      mode: 'kid',
      players: [],
      currentPlayerIndex: 0,
      turn: 1,
      seed: 0,
      rng: createSeededRng(0),
      field: [],
      supply: [],
      chestRow: [],
      chestSupply: [],
      defeated: [],
      voided: [],
      sharedTriforce: { wisdom: false, courage: false, power: false },
      outcome: null,
      lastChestReward: null,
      lastChestRewardCard: null,
      princessCrystal: initialPrincessCrystalState(),
      currentZone: 'sylvani',
      zoneHistory: [],
      defeatedBossIds: [],
      bossKeys: {
        sylvani: [],
        'emberpeak': [],
        maren: [],
        'hollow-shrine': [],
        'dune-sanctum': [],
        'gilded-cage': [],
      },
    });
  });

  it('renders Setup first and mounts GameBoard after Start', () => {
    render(<App />);

    // Setup screen is visible initially.
    expect(screen.getByTestId('setup-root')).toBeInTheDocument();
    expect(screen.queryByTestId('game-board')).toBeNull();

    // Pick the first champion (embertide-57p).
    const firstChampion = document.querySelector(
      `[data-champion-id="${KID_CHAMPIONS[0].id}"]`,
    ) as HTMLElement;
    expect(firstChampion).not.toBeNull();
    fireEvent.click(firstChampion);

    fireEvent.click(screen.getByTestId('start-button'));

    // GameBoard is now mounted.
    expect(screen.getByTestId('game-board')).toBeInTheDocument();
  });
});
