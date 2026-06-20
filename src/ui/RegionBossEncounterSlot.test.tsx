import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RegionBossEncounterSlot from './RegionBossEncounterSlot';
import { useGameStore } from '../store/gameStore';
import { createSeededRng } from '../rules/chestPool';
import type { KidGameState, KidPlayer } from '../store/types';
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
    ...overrides,
  });
}

describe('RegionBossEncounterSlot (u-9d + gm0.12)', () => {
  // gm0.12 — a zone's region slot is sealed until the zone's wild-boss
  // key has dropped. Tests that exercise the unlocked slot pre-populate
  // bossKeys.sylvani = ['craghorn']; the SEALED-state coverage lives in the
  // locked-door tests at the bottom of the describe.
  const UNLOCKED_SYLVANI = {
    sylvani: ['craghorn'],
    'emberpeak': [],
    maren: [],
    'hollow-shrine': [],
    'dune-sanctum': [],
    'gilded-cage': [],
  } as const;

  beforeEach(() => {
    // rtf4: bump default turn to Boss (6) so the phase gate is open and
    // these legacy gm0.12 tests exercise the wild-boss-key gate they're
    // intended to. Pre-rtf4 the slot was rendered as engageable on turn
    // 1 once bossKeys were populated; rtf4 adds an outer phase gate that
    // would otherwise pre-empt every assertion in this describe.
    useGameStore.setState(makeState({ bossKeys: UNLOCKED_SYLVANI, turn: 6 }));
  });

  it('renders Broodmaw name + tuned HP row in Sylvani (embertide-3dc)', () => {
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Broodmaw');
    // Broodmaw is tuned to 18 in BOSS_HP (not the 12 region-boss tier
    // fallback). Before embertide-3dc the altar showed 12 while
    // combat opened at 18 — a legibility bug the rev-2 route through
    // `bossHpFor` fixes.
    expect(screen.getByTestId('boss-altar-pane-hp').textContent).toBe('HP 18');
  });

  it('uses the region variant', () => {
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot').getAttribute('data-variant')).toBe('region');
  });

  it('tap dispatches engageRegionBossSlot(currentZone, bossId) exactly once', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({ bossKeys: UNLOCKED_SYLVANI, turn: 6 }),
      engageRegionBossSlot: engage,
    });
    render(<RegionBossEncounterSlot />);
    fireEvent.click(screen.getByTestId('region-boss-slot'));
    expect(engage).toHaveBeenCalledTimes(1);
    expect(engage).toHaveBeenCalledWith('sylvani', 'broodmaw');
  });

  it('renders a cleared placeholder once the region boss is in defeatedBossIds', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({ defeatedBossIds: ['broodmaw'], bossKeys: UNLOCKED_SYLVANI, turn: 6 }),
      engageRegionBossSlot: engage,
    });
    render(<RegionBossEncounterSlot />);
    const root = screen.getByTestId('region-boss-slot');
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('boss-altar-pane-cleared')).toBeInTheDocument();
    fireEvent.click(root);
    expect(engage).not.toHaveBeenCalled();
  });

  it('is SEALED (data-locked="true") on turn 6 with zero wild-boss keys (gm0.12 REVERSE-Q8)', () => {
    // rtf4: phase gate is checked BEFORE the key gate. The SEALED
    // (padlock + boss-door) render only surfaces post-phase-gate, so
    // bump turn into Boss (6) to reach the wild-boss-key gate. On turn
    // 1 with zero keys the phase-locked variant renders instead — the
    // `RegionBossEncounterSlot phase gate` describe below covers that
    // case.
    useGameStore.setState(
      makeState({
        defeatedBossIds: [],
        turn: 6,
        bossKeys: {
          sylvani: [],
          'emberpeak': [],
          maren: [],
          'hollow-shrine': [],
          'dune-sanctum': [],
          'gilded-cage': [],
        },
      }),
    );
    render(<RegionBossEncounterSlot />);
    const root = screen.getByTestId('region-boss-slot');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(root.getAttribute('data-locked')).toBe('true');
    // wnj: the `BossAltarLocked` sibling renders the zone-specific
    // boss-door raster with a SEALED legend rather than the boss
    // stamp — confirms the locked render path. qzl's BossDoor wrapper
    // was absorbed into `BossAltarLocked` so callers no longer thread
    // the raster through manually.
    const locked = screen.getByTestId('boss-altar-pane-locked');
    expect(locked.getAttribute('data-zone')).toBe('sylvani');
    const raster = screen.getByTestId('boss-altar-pane-locked-raster');
    expect(raster.getAttribute('src')).toBe('/illustrations/cathedral_sylvani_boss_door_001.png');
    expect(screen.getByTestId('boss-altar-pane-locked-label').textContent).toBe('SEALED');
  });

  it('tapping the SEALED slot does NOT dispatch engage (locked pane is inert)', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({
        turn: 6,
        bossKeys: {
          sylvani: [],
          'emberpeak': [],
          maren: [],
          'hollow-shrine': [],
          'dune-sanctum': [],
          'gilded-cage': [],
        },
      }),
      engageRegionBossSlot: engage,
    });
    render(<RegionBossEncounterSlot />);
    fireEvent.click(screen.getByTestId('region-boss-slot'));
    expect(engage).not.toHaveBeenCalled();
  });

  it('unlocks (data-locked="false") once the zone key has dropped into bossKeys', () => {
    // rtf4: the wild-boss seal is the inner gate — but the outer phase
    // gate (sessionPhase >= Boss, turn >= 6) must ALSO be open for the
    // slot to render as engageable. Bump turn into Boss so the phase
    // gate clears and `bossKeys` becomes the deciding signal.
    useGameStore.setState(makeState({ bossKeys: UNLOCKED_SYLVANI, turn: 6 }));
    render(<RegionBossEncounterSlot />);
    const root = screen.getByTestId('region-boss-slot');
    expect(root.tagName).toBe('BUTTON');
    expect(root.getAttribute('data-disabled')).toBe('false');
    expect(root.getAttribute('data-locked')).toBe('false');
  });
});

/**
 * embertide-rtf4 — Phase-gate visualization for the region slot.
 *
 * Pre-rtf4 the region slot rendered as fully engageable during the
 * Stirring + Rising phases (turns 1-5) — clicking it threw "phase gate
 * closed" inside `engageRegionBossSlot` and the silent failure was
 * indistinguishable from a missed input. rtf4 surfaces the gate
 * visually with `BossAltarPhaseLocked`, and the phase gate is checked
 * BEFORE the wild-boss-key gate so a fresh-run turn-1 slot reads as
 * "wakes at turn 6", not "padlocked SEALED".
 */
describe('RegionBossEncounterSlot phase gate (embertide-rtf4)', () => {
  const UNLOCKED_SYLVANI = {
    sylvani: ['craghorn'],
    'emberpeak': [],
    maren: [],
    'hollow-shrine': [],
    'dune-sanctum': [],
    'gilded-cage': [],
  } as const;

  it('renders the phase-locked variant on turn 1 (Stirring) — keys irrelevant', () => {
    // Stirring + zero keys. Pre-rtf4: rendered as SEALED with the
    // boss-door raster + padlock. Post-rtf4: phase gate trumps key gate
    // because the slot can't engage even with a key — phase says no.
    useGameStore.setState(makeState({ turn: 1 }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot-phase-locked')).toBeInTheDocument();
    // No padlock + no boss-door raster — those belong to the SEALED state.
    expect(screen.queryByTestId('boss-altar-pane-locked-glyph')).toBeNull();
    expect(screen.queryByTestId('boss-altar-pane-locked-raster')).toBeNull();
    // Hourglass glyph IS present.
    expect(screen.getByTestId('boss-altar-pane-phase-glyph').textContent).toBe('\u{231B}');
  });

  it('renders phase-locked on turn 1 even when bossKeys are populated', () => {
    // Phase gate checked BEFORE key gate. A turn-1 player with a
    // pre-populated key (impossible in normal play but worth guarding)
    // still sees the phase-locked variant — the slot is not engageable.
    useGameStore.setState(makeState({ turn: 1, bossKeys: UNLOCKED_SYLVANI }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot-phase-locked')).toBeInTheDocument();
  });

  it('renders phase-locked on turn 4 (Rising) — wild slot is engageable, region is not', () => {
    useGameStore.setState(makeState({ turn: 4 }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot-phase-locked')).toBeInTheDocument();
  });

  it('renders phase-locked on turn 5 (last Rising turn) — boundary check', () => {
    useGameStore.setState(makeState({ turn: 5 }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('region-boss-slot-phase-locked')).toBeInTheDocument();
  });

  it('switches to SEALED at turn 6 (Boss phase) when bossKeys are still empty', () => {
    // Boss phase opens — the phase gate clears, and the slot falls back
    // to the wild-boss-sealed (padlock + boss-door) state because the
    // wild-boss key has not yet dropped.
    useGameStore.setState(makeState({ turn: 6 }));
    render(<RegionBossEncounterSlot />);
    expect(screen.queryByTestId('region-boss-slot-phase-locked')).toBeNull();
    expect(screen.getByTestId('boss-altar-pane-locked-glyph')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-locked-label').textContent).toBe('SEALED');
  });

  it('renders engageable BossStamp at turn 6 with bossKeys populated', () => {
    useGameStore.setState(makeState({ turn: 6, bossKeys: UNLOCKED_SYLVANI }));
    render(<RegionBossEncounterSlot />);
    const root = screen.getByTestId('region-boss-slot');
    expect(root.tagName).toBe('BUTTON');
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Broodmaw');
  });

  it('phase-locked subline names the Boss-phase unlock turn (turn 6)', () => {
    useGameStore.setState(makeState({ turn: 1 }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('boss-altar-pane-phase-subline').textContent).toMatch(/turn\s*6/i);
  });

  it('tapping the phase-locked slot does NOT dispatch engageRegionBossSlot', () => {
    const engage = vi.fn();
    useGameStore.setState({
      ...makeState({ turn: 1 }),
      engageRegionBossSlot: engage,
    });
    render(<RegionBossEncounterSlot />);
    fireEvent.click(screen.getByTestId('region-boss-slot-phase-locked'));
    expect(engage).not.toHaveBeenCalled();
  });

  it('region-boss-slot-revealed tutorial does NOT fire while phase-locked', () => {
    // The tutorial bubble should fire at the moment the slot becomes
    // INTERACTIVE — firing while phase-locked tells the player about an
    // action they cannot yet take. Mirrors the same guard the wild-slot
    // already enforces for `wild-boss-slot-revealed`.
    const fireTutorial = vi.fn();
    useGameStore.setState({
      ...makeState({ turn: 1 }),
      fireTutorialBubbleOnce: fireTutorial,
    });
    render(<RegionBossEncounterSlot />);
    expect(fireTutorial).not.toHaveBeenCalled();
  });

  it('renders cleared placeholder at turn 1 if the region boss is already defeated', () => {
    // Cleared trumps phase-lock — a defeated boss can't un-defeat itself
    // by the phase regressing (which it can't anyway, but defensive).
    useGameStore.setState(makeState({ turn: 1, defeatedBossIds: ['broodmaw'] }));
    render(<RegionBossEncounterSlot />);
    expect(screen.getByTestId('boss-altar-pane-cleared')).toBeInTheDocument();
    expect(screen.queryByTestId('region-boss-slot-phase-locked')).toBeNull();
  });
});
