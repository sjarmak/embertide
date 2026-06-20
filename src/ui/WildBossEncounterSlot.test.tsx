import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WildBossEncounterSlot from './WildBossEncounterSlot';
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
    // gm0.9: default to the Rising phase (turn 3) so the slot is
    // interactive. Stirring-specific dormant coverage uses turn: 1.
    turn: 3,
    rng: createSeededRng(0),
    ...overrides,
  });
}

describe('WildBossEncounterSlot (u-9d)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('renders Craghorn name + tuned HP row in Sylvani with no defeated bosses (embertide-3dc)', () => {
    useGameStore.setState(makeState());
    render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('wild-boss-slot')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Craghorn');
    // Craghorn is tuned to 10 in BOSS_HP (not the 8 wild-boss tier
    // fallback). Before embertide-3dc the altar showed 8 while
    // combat opened at 10 — player confusion flagged by u-9c review.
    expect(screen.getByTestId('boss-altar-pane-hp').textContent).toBe('HP 10');
  });

  it('uses the wild variant', () => {
    render(<WildBossEncounterSlot />);
    const root = screen.getByTestId('wild-boss-slot');
    expect(root.getAttribute('data-variant')).toBe('wild');
  });

  it('tap dispatches engageWildBossSlot(currentZone, bossId) exactly once', () => {
    const engage = vi.fn();
    useGameStore.setState({ ...makeState(), engageWildBossSlot: engage });
    render(<WildBossEncounterSlot />);
    fireEvent.click(screen.getByTestId('wild-boss-slot'));
    expect(engage).toHaveBeenCalledTimes(1);
    expect(engage).toHaveBeenCalledWith('sylvani', 'craghorn');
  });

  it('renders a cleared placeholder (disabled + no handler) once Craghorn is in defeatedBossIds', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({ defeatedBossIds: ['craghorn'] }),
      engageWildBossSlot: engage,
    });
    render(<WildBossEncounterSlot />);
    const root = screen.getByTestId('wild-boss-slot');
    expect(root.getAttribute('data-disabled')).toBe('true');
    // embertide-3ub regression guard: cleared state must still use
    // `BossAltarCleared` — the dormant variant is session-arc-scoped
    // (Stirring only), not shared with the defeated state.
    expect(screen.getByTestId('boss-altar-pane-cleared')).toBeInTheDocument();
    expect(screen.queryByTestId('boss-altar-pane-dormant')).not.toBeInTheDocument();
    fireEvent.click(root);
    expect(engage).not.toHaveBeenCalled();
  });

  it('follows the zone FIFO queue: renders boulderkin in Emberpeak', () => {
    useGameStore.setState(makeState({ currentZone: 'emberpeak' as ZoneId }));
    render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Boulderkin');
  });

  it('aria-label advertises the engage action + boss name + HP', () => {
    render(<WildBossEncounterSlot />);
    const root = screen.getByTestId('wild-boss-slot');
    const label = root.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/craghorn/i);
    expect(label).toMatch(/hp 10/i);
    expect(label).toMatch(/engage/i);
  });
});

/**
 * gm0.9 — Stirring-phase dormant variant coverage.
 *
 * The wild-boss slot is session-arc-gated: in Stirring (turns 1-2) no
 * wild boss may spawn into the slot, so the pane renders a dormant
 * placeholder with a distinct testId. The dormant variant is NOT
 * clickable; the engage action is unreachable while in Stirring.
 */
describe('WildBossEncounterSlot dormant variant (gm0.9 REQ-19 Stirring)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState({ turn: 1 }));
  });

  it('renders the dormant placeholder at turn 1 (Stirring)', () => {
    render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('wild-boss-slot-dormant')).toBeInTheDocument();
    expect(screen.queryByTestId('wild-boss-slot')).not.toBeInTheDocument();
    // embertide-3ub — dormant state renders the distinct
    // `BossAltarDormant` variant, NOT `BossAltarCleared`. The two must
    // never collapse back together or the "why is it dormant?" design
    // complaint returns.
    expect(screen.getByTestId('boss-altar-pane-dormant')).toBeInTheDocument();
    expect(screen.queryByTestId('boss-altar-pane-cleared')).not.toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-dormant-label').textContent).toBe('Dormant');
  });

  it('renders the dormant placeholder at turn 2 (Stirring)', () => {
    useGameStore.setState(makeState({ turn: 2 }));
    render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('wild-boss-slot-dormant')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-dormant')).toBeInTheDocument();
  });

  it('dormant subline advertises the unlock turn (embertide-3ub)', () => {
    render(<WildBossEncounterSlot />);
    // Subline must reference the turn on which the slot becomes
    // engageable (RISING_PHASE_TURN = 3) so the player can plan.
    const subline = screen.getByTestId('boss-altar-pane-dormant-subline');
    expect(subline.textContent).toMatch(/turn\s*3/i);
  });

  it('dormant pane is disabled (data-disabled="true") + does not dispatch engage', () => {
    const engage = vi.fn();
    useGameStore.setState({ ...makeState({ turn: 1 }), engageWildBossSlot: engage });
    render(<WildBossEncounterSlot />);
    const root = screen.getByTestId('wild-boss-slot-dormant');
    expect(root.getAttribute('data-disabled')).toBe('true');
    fireEvent.click(root);
    expect(engage).not.toHaveBeenCalled();
  });

  it('aria-label mentions the Stirring phase so screen readers can explain the dormant state', () => {
    render(<WildBossEncounterSlot />);
    const label = screen.getByTestId('wild-boss-slot-dormant').getAttribute('aria-label') ?? '';
    expect(label.toLowerCase()).toMatch(/dormant/);
    expect(label).toMatch(/Stirring/);
  });

  it('flips from dormant → interactive at the turn 2 → 3 boundary', () => {
    useGameStore.setState(makeState({ turn: 2 }));
    const { unmount } = render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('wild-boss-slot-dormant')).toBeInTheDocument();
    unmount();

    useGameStore.setState(makeState({ turn: 3 }));
    render(<WildBossEncounterSlot />);
    expect(screen.getByTestId('wild-boss-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('wild-boss-slot-dormant')).not.toBeInTheDocument();
  });

  // embertide-rtf4 — visual parity with the new region phase-locked
  // variant. Both phase-gated states show an hourglass glyph so the
  // shared "wakes on a clock" cue reads consistently across both altars.
  it('renders the hourglass glyph (rtf4 visual parity)', () => {
    useGameStore.setState(makeState({ turn: 1 }));
    render(<WildBossEncounterSlot />);
    const glyph = screen.getByTestId('boss-altar-pane-phase-glyph');
    expect(glyph.textContent).toBe('\u{231B}');
  });
});
