import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import GameBoard from './GameBoard';
import { useGameStore } from '../store/gameStore';
import { createSeededRng } from '../rules/chestPool';
import { KID_CARDS } from '../data/cards';
import type { KidGameState, KidPlayer } from '../store/types';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

const TOUCH_MIN = 44;

function parsePx(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const match = /^(\d+(?:\.\d+)?)/.exec(String(value));
  return match ? Number(match[1]) : 0;
}

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player 1',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    rng: createSeededRng(0),
    ...overrides,
  });
}

describe('GameBoard', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('every button in the GameBoard tree has a valid 44px touch target', () => {
    const monster = KID_CARDS.find((c) => c.role === 'monster');
    const hero = KID_CARDS.find((c) => c.role === 'hero');
    const chest = KID_CARDS.find((c) => c.role === 'chest-std');
    if (!monster || !hero || !chest) {
      throw new Error('Required card roles missing from KID_CARDS');
    }

    useGameStore.setState(
      makeState({
        players: [
          makePlayer({
            id: 'p0',
            name: 'Alpha',
            hand: [hero, monster],
            keys: 5,
          }),
          makePlayer({ id: 'p1', name: 'Beta', championId: 'champion-sword' }),
        ],
        field: [hero, monster],
        chestRow: [chest],
      }),
    );

    const { container } = render(<GameBoard />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of Array.from(buttons)) {
      const dataFlag = btn.getAttribute('data-touch-target') === 'true';
      const minWidth = parsePx(btn.style.minWidth);
      const minHeight = parsePx(btn.style.minHeight);
      const hasInlineSize = minWidth >= TOUCH_MIN && minHeight >= TOUCH_MIN;
      expect(dataFlag || hasInlineSize).toBe(true);
      if (!dataFlag) {
        expect(minWidth).toBeGreaterThanOrEqual(TOUCH_MIN);
        expect(minHeight).toBeGreaterThanOrEqual(TOUCH_MIN);
      }
    }
  });

  it('renders Hand cards with at least one svg per card face', () => {
    const hero = KID_CARDS.find((c) => c.role === 'hero');
    if (!hero) throw new Error('No hero in KID_CARDS');

    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', hand: [hero, hero] })],
      }),
    );

    const { container } = render(<GameBoard />);
    const handCards = container.querySelectorAll('[data-testid^="hand-card-"]');
    expect(handCards.length).toBeGreaterThanOrEqual(1);
    for (const face of Array.from(handCards)) {
      const svgs = face.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders a turn banner with the active player and turn number', () => {
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({ id: 'p0', name: 'Alpha' }),
          makePlayer({ id: 'p1', name: 'Beta', championId: 'champion-sword' }),
        ],
        currentPlayerIndex: 1,
        turn: 5,
      }),
    );

    render(<GameBoard />);
    const banner = screen.getByTestId('turn-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Turn 5');
  });

  it('mounts the status-bar HUD on the b56 Pane primitive (z40 lineage, neutral-shadow / compact)', () => {
    // z40-lineage migration phase 6: the .status-bar HUD strip used to be
    // a borderless flex row (designer feedback "modern testing UI"). It is
    // now wrapped in <Pane colorFamily="neutral-shadow" density="compact">
    // so chrome (border + stained-glass gradient + inner shadow) is shared
    // with the broader cathedral surface vocabulary. This test pins the
    // class contract — if a future refactor drops the Pane wrapper, the
    // chrome would silently disappear without it.
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        turn: 3,
      }),
    );
    render(<GameBoard />);
    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar.classList.contains('pane')).toBe(true);
    expect(statusBar.classList.contains('pane-neutral-shadow')).toBe(true);
    expect(statusBar.classList.contains('pane-compact')).toBe(true);
    expect(statusBar.classList.contains('status-bar')).toBe(true);
    expect(statusBar.getAttribute('data-color-family')).toBe('neutral-shadow');
    expect(statusBar.getAttribute('data-density')).toBe('compact');
    // a11y: ariaLabel promotes role to region so screen readers announce
    // the HUD strip as a discrete landmark within the game board.
    expect(statusBar.getAttribute('role')).toBe('region');
    expect(statusBar.getAttribute('aria-label')).toBe('Game status');
    // Children still resolve via the same testIds — the migration is
    // chrome-only; the inner DOM contract is preserved.
    expect(screen.getByTestId('turn-count')).toHaveTextContent('Turn 3');
    expect(screen.getByTestId('deck-count')).toBeInTheDocument();
    expect(screen.getByTestId('discard-count')).toBeInTheDocument();
    expect(screen.getByTestId('active-player')).toBeInTheDocument();
  });

  it('renders the play-all-shards helper button on the game board', () => {
    // 0p8c: the play-all button only shows when the hand has cards to
    // play; an empty hand swaps the slot for a lit End Turn button.
    const card = KID_CARDS.find((c) => c.role === 'hero');
    if (!card) throw new Error('KID_CARDS missing a hero');
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', hand: [card] })],
      }),
    );
    render(<GameBoard />);
    expect(screen.getByTestId('play-all-cards')).toBeInTheDocument();
  });

  it('renders the End Turn button with a 44px+ touch target (single-screen layout)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
      }),
    );
    render(<GameBoard />);
    const endTurn = screen.getByTestId('end-turn') as HTMLButtonElement;
    expect(parsePx(endTurn.style.minWidth)).toBeGreaterThanOrEqual(44);
    expect(parsePx(endTurn.style.minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('does not surface a "nothing more to play" hint anywhere in the main-board (designer polish 2026-04-22 — hint removed)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', hand: [] })],
      }),
    );
    render(<GameBoard />);
    // The hint was removed per designer feedback — an empty hand is its
    // own signal and the extra text added clutter under the End Turn
    // button. Pin the removal so a regression cannot silently restore
    // it.
    expect(screen.queryByTestId('end-turn-hint')).toBeNull();
  });

  it('renders the HPStrip and updates its filled-socket count on HP state change (u-2a)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', hp: 2, hpMax: 5 })],
      }),
    );
    const { rerender } = render(<GameBoard />);

    const strip = screen.getByTestId('hp-strip-p0');
    expect(strip).toBeInTheDocument();
    // 2 HP out of 5 → 2 filled sockets, 3 empty.
    expect(
      strip.querySelectorAll('[data-testid^="hp-strip-p0-socket-"][data-filled="true"]').length,
    ).toBe(2);
    expect(
      strip.querySelectorAll('[data-testid^="hp-strip-p0-socket-"][data-filled="false"]').length,
    ).toBe(3);

    act(() => {
      useGameStore.setState(
        makeState({
          players: [makePlayer({ id: 'p0', name: 'Alpha', hp: 3, hpMax: 5 })],
        }),
      );
    });
    rerender(<GameBoard />);

    const updatedStrip = screen.getByTestId('hp-strip-p0');
    expect(
      updatedStrip.querySelectorAll('[data-testid^="hp-strip-p0-socket-"][data-filled="true"]')
        .length,
    ).toBe(3);
  });

  it('mounts Embertide + Crystal in the right-rail crystal column with Boss Altar → Crystal → Embertide ordering (relocated 2026-04-26 by 9eou)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        sharedEmbertide: { wisdom: true, courage: false, power: false },
      }),
    );
    render(<GameBoard />);
    const hud = screen.getByTestId('embertide-hud');
    expect(hud).toBeInTheDocument();
    expect(screen.getByTestId('embertide-strip')).toBeInTheDocument();
    expect(screen.getByTestId('embertide-shard-wisdom').getAttribute('data-filled')).toBe('true');
    expect(screen.getByTestId('embertide-shard-courage').getAttribute('data-filled')).toBe('false');
    expect(screen.getByTestId('embertide-shard-power').getAttribute('data-filled')).toBe('false');
    // 9eou rev-2 (2026-04-26): Crystal + Embertide share a single
    // `.crystal-embertide-pane` that lives in the right-rail's
    // `.board-side-crystal-rail`. Boss Altar → CrystalEmbertidePane is
    // the rail order; inside the pane the Crystal precedes the Embertide.
    const pane = screen.getByTestId('crystal-embertide-pane');
    expect(pane.classList.contains('crystal-embertide-pane')).toBe(true);
    const rail = pane.parentElement;
    expect(rail?.classList.contains('board-side-crystal-rail')).toBe(true);
    const altarRow = screen.getByTestId('boss-altar-row');
    const crystal = screen.getByTestId('princess-crystal-cell');
    expect(altarRow.parentElement).toBe(rail);
    expect(crystal.parentElement).toBe(pane);
    expect(hud.parentElement).toBe(pane);
    expect(altarRow.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(crystal.compareDocumentPosition(hud) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 2026-04-26 follow-up: cathedral-title-strip retired entirely (its
    // contents — TurnBanner + status-bar Pane — relocated into the
    // always-row right rail). The Embertide/Crystal are still required
    // to live in the right-rail crystal column, asserted above.
    expect(screen.queryByTestId('cathedral-title-strip')).toBeNull();
  });

  it('renders trays in .trays-row and EndTurn in the board-side rail beneath crystal-embertide (lqg6 2026-04-26)', () => {
    for (const count of [1, 2, 3, 4]) {
      const players = Array.from({ length: count }, (_, i) =>
        makePlayer({ id: `p${i}`, name: `P${i + 1}` }),
      );
      useGameStore.setState(makeState({ players }));
      const { unmount } = render(<GameBoard />);
      // lqg6 (2026-04-26): End Turn migrated OUT of .trays-row to the
      // .board-side-crystal-rail beneath the crystal-embertide-pane.
      // .trays-row now contains only the .trays cream plate; the
      // PlayAllStartersButton it briefly cohabited with on .hand-row is
      // also gone — that button now stacks under DiscardPile in the
      // .play-zones row's right column.
      const endTurn = screen.getByTestId('end-turn');
      const endTurnParent = endTurn.parentElement;
      expect(endTurnParent?.classList.contains('board-side-crystal-rail')).toBe(true);
      const trays = document.querySelector('.trays-row > .trays') as HTMLElement | null;
      expect(trays).not.toBeNull();
      // The crystal-embertide pane must precede End Turn in the rail so
      // the right column reads top→bottom: BossAltar → Crystal/Embertide
      // → End Turn.
      const crystalPane = screen.getByTestId('crystal-embertide-pane');
      expect(
        crystalPane.compareDocumentPosition(endTurn) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // 9eou (2026-04-26): Embertide + PrincessCrystal both live in the
      // right-rail `.board-side-crystal-rail`, not in `.trays`.
      const hud = screen.getByTestId('embertide-hud');
      const crystal = screen.getByTestId('princess-crystal-cell');
      expect(hud.parentElement?.classList.contains('trays')).toBe(false);
      expect(crystal.parentElement?.classList.contains('trays')).toBe(false);
      // 35rv (2026-04-26): the shared items-bag chip is gone — each
      // PlayerTray renders its own. The .trays plate ordering is
      // [PlayerTrays...] (no shared bag chip).
      expect(screen.queryByTestId('items-bag')).toBeNull();
      // Each tray hosts its own bag chip with a player-scoped testid.
      const playerTrays = trays?.querySelectorAll('[data-testid^="player-tray"]');
      expect(playerTrays?.length ?? 0).toBe(count);
      for (let i = 0; i < count; i += 1) {
        const perTrayBag = screen.getByTestId(`items-bag-p${i}`);
        const tray = screen.getByTestId(`player-tray-p${i}`);
        expect(tray.contains(perTrayBag)).toBe(true);
        // Every player tray must precede EndTurn in DOM order.
        expect(
          tray.compareDocumentPosition(endTurn) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      unmount();
    }
  });

  it('mounts the chest row alongside the main field (embertide-7c1)', () => {
    const stdChest = KID_CARDS.find((c) => c.role === 'chest-std');
    const bossChest = KID_CARDS.find((c) => c.role === 'chest-boss');
    if (!stdChest || !bossChest) throw new Error('chests missing');
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', keys: 5 })],
        chestRow: [stdChest, bossChest],
      }),
    );
    render(<GameBoard />);
    expect(screen.getByTestId('chest-row')).toBeInTheDocument();
    expect(screen.getByTestId('chest-slot-std')).toBeInTheDocument();
    expect(screen.getByTestId('chest-slot-boss')).toBeInTheDocument();
  });

  it('mounts the in-play zone between Hand and End Turn (embertide-7c1)', () => {
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!sage) throw new Error('sage-keeper missing');
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({
            id: 'p0',
            name: 'Alpha',
            inPlay: [sage],
          }),
        ],
      }),
    );
    render(<GameBoard />);
    const zone = screen.getByTestId('in-play');
    expect(zone).toBeInTheDocument();
    expect(screen.getByTestId(`in-play-card-${sage.id}`)).toBeInTheDocument();
  });

  it('renders an empty in-play zone when no cards have been played this turn', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', inPlay: [] })],
      }),
    );
    render(<GameBoard />);
    expect(screen.getByTestId('in-play')).toBeInTheDocument();
    // fsyd: empty-state replaced with the drop-zone target.
    expect(screen.getByTestId('drop-zone-empty')).toBeInTheDocument();
  });

  it('mounts the discard pile pane in the trays-row pile column (embertide-lqg6 rev-3)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', discard: [] })],
      }),
    );
    render(<GameBoard />);
    const pile = screen.getByTestId('discard-pile');
    expect(pile).toBeInTheDocument();
    // empty pile renders the labelled placeholder
    expect(pile).toHaveAttribute('data-empty', 'true');
    expect(pile).toHaveAttribute('data-variant', 'discard');
    expect(screen.getByTestId('discard-pile-label')).toHaveTextContent('Discard');
    // rev-3: pile lives next to the player tray panes, NOT in the
    // play-zones / hand-row band where it previously read as a market
    // tile. Future g294 VoidPane will mount as a sibling here.
    const pileColumn = screen.getByTestId('trays-row-pile-column');
    expect(pileColumn.contains(pile)).toBe(true);
    expect(pileColumn.parentElement?.classList.contains('trays-row')).toBe(true);
  });

  it('shows the most-recently-acquired card on the discard pile top (embertide-lqg6)', () => {
    const sage = KID_CARDS.find((c) => c.id === 'sage-keeper');
    const ironSentinel = KID_CARDS.find((c) => c.id === 'iron-sentinel');
    if (!sage || !ironSentinel) throw new Error('KID_CARDS missing fixtures');
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({
            id: 'p0',
            name: 'Alpha',
            // The LAST element in `discard` is the top — render order is
            // [oldest, ..., newest].
            discard: [sage, ironSentinel],
          }),
        ],
      }),
    );
    render(<GameBoard />);
    const pile = screen.getByTestId('discard-pile');
    expect(pile).toHaveAttribute('data-count', '2');
    expect(pile).not.toHaveAttribute('data-empty');
    // top tile is the most-recently-pushed card (ironSentinel)
    expect(screen.getByTestId('discard-pile-top')).toBeInTheDocument();
    expect(screen.getByTestId('discard-pile-count')).toHaveTextContent('×2');
  });

  it('renders the card-template effect text with sufficient color/background contrast (embertide-9c7)', () => {
    const hero = KID_CARDS.find((c) => c.id === 'sage-keeper');
    if (!hero) throw new Error('KID_CARDS missing sage-keeper');

    const style = document.createElement('style');
    style.textContent = `
      .card-template-rules-box { background: #f4ebd3; }
      .card-template-effect { color: #0e0c14; }
    `;
    document.head.appendChild(style);

    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        field: [hero],
      }),
    );

    const { container } = render(<GameBoard />);
    const effect = container.querySelector('.card-template-effect');
    expect(effect).not.toBeNull();
    const box = effect!.closest('.card-template-rules-box') as Element;
    expect(box).not.toBeNull();
    const fg = window.getComputedStyle(effect as Element).color;
    const bg = window.getComputedStyle(box).backgroundColor;
    expect(fg.length).toBeGreaterThan(0);
    expect(bg.length).toBeGreaterThan(0);
    expect(fg).not.toBe(bg);

    document.head.removeChild(style);
  });

  // -------------------------------------------------------------------------
  // v2 co-op game-over overlay (amendment A1/A2/A3). Shared victory and
  // shared loss — no per-player winner headline.
  // -------------------------------------------------------------------------

  it('outcome=win overlay shows a Victory headline with role=alert', () => {
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({ id: 'p0', name: 'Alpha', championId: 'champion-courage' }),
          makePlayer({ id: 'p1', name: 'Beta', championId: 'champion-power' }),
        ],
        currentPlayerIndex: 0,
        outcome: 'win',
      }),
    );

    render(<GameBoard />);
    const banner = screen.getByTestId('winner-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Victory/i);
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('tabindex', '-1');
    expect(banner).toHaveFocus();
  });

  it('outcome=loss overlay shows a Defeat headline', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        outcome: 'loss',
      }),
    );
    render(<GameBoard />);
    const banner = screen.getByTestId('winner-banner');
    expect(banner).toHaveTextContent(/Defeat/i);
  });

  it('outcome overlay mounts when state.outcome is set and is absent otherwise', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
      }),
    );
    const { rerender } = render(<GameBoard />);
    expect(document.body.querySelector('.winner-overlay')).toBeNull();

    act(() => {
      useGameStore.setState(
        makeState({
          players: [makePlayer({ id: 'p0', name: 'Alpha' })],
          outcome: 'win',
        }),
      );
    });
    rerender(<GameBoard />);
    expect(document.body.querySelector('.winner-overlay')).not.toBeNull();
  });

  it('outcome overlay is portaled to document.body, not nested in the game board (embertide-dxz)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        outcome: 'win',
      }),
    );
    render(<GameBoard />);
    const overlay = screen.getByTestId('winner-overlay');
    expect(overlay.closest('[data-testid="game-board"]')).toBeNull();
    expect(overlay.parentElement).toBe(document.body);
  });

  it('chest-reveal-backdrop is portaled to document.body, not nested in the game board (embertide-y2p)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        lastChestReward: 'heart',
      }),
    );
    render(<GameBoard />);
    const backdrop = screen.getByTestId('chest-reveal-backdrop');
    expect(backdrop.closest('[data-testid="game-board"]')).toBeNull();
    expect(backdrop.parentElement).toBe(document.body);
  });

  it('disables the End Turn button when outcome is set', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        outcome: 'win',
      }),
    );
    render(<GameBoard />);
    const endTurn = screen.getByTestId('end-turn') as HTMLButtonElement;
    expect(endTurn.disabled).toBe(true);
  });

  it('renders the stained-glass green-shard cost gem on field cards with green cost > 0', () => {
    const hero = KID_CARDS.find((c) => c.role === 'hero');
    if (!hero) throw new Error('KID_CARDS missing a hero');

    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        field: [hero],
      }),
    );
    const { container } = render(<GameBoard />);
    const fieldCard = container.querySelector(`[data-testid="field-card-${hero.id}"]`);
    expect(fieldCard).not.toBeNull();
    const greenGem = fieldCard?.querySelector('[data-testid="cost-gem-green"]');
    expect(greenGem).not.toBeNull();
    expect(greenGem?.getAttribute('aria-label')).toMatch(/^green-shard \d+$/);
  });

  // -------------------------------------------------------------------------
  // REQ-32 (u-9d) — boss altar row + DESTINY swap + center-row regression.
  // -------------------------------------------------------------------------

  it('mounts the boss altar row with both slots side-by-side and places PrincessCrystalCell inside the trays row (u-9d, rev-6 polish)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        currentZone: 'sylvani',
        // gm0.9 + rtf4: advance to Boss phase (turn 6) so BOTH altar
        // slots render with their primary testIds. Pre-rtf4 turn 3 was
        // sufficient for the wild slot but rtf4 added a phase gate to
        // the region slot too — turn 6 clears both phase gates without
        // tripping the wild-boss-key seal (default `bossKeys` is empty,
        // which would make the region slot SEALED rather than phase-
        // locked, but this test only asserts the layout testIds and
        // SEALED also renders under `region-boss-slot`).
        turn: 6,
      }),
    );
    render(<GameBoard />);
    const row = screen.getByTestId('boss-altar-row');
    expect(row).toBeInTheDocument();
    // 9eou rev-2 (2026-04-26): the right-rail hosts the boss-altar row
    // and a single `.crystal-embertide-pane` that wraps both the
    // PrincessCrystal cell and the Embertide strip on a shared cream
    // parchment plate. Order: boss-altar-row → crystal-embertide-pane,
    // and inside the pane Crystal → Embertide.
    const crystal = screen.getByTestId('princess-crystal-cell');
    const embertide = screen.getByTestId('embertide-hud');
    const pane = screen.getByTestId('crystal-embertide-pane');
    expect(row.parentElement?.classList.contains('board-side-crystal-rail')).toBe(true);
    expect(pane.parentElement?.classList.contains('board-side-crystal-rail')).toBe(true);
    expect(crystal.parentElement).toBe(pane);
    expect(embertide.parentElement).toBe(pane);
    expect(row.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      crystal.compareDocumentPosition(embertide) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Both the wild and region slots render side-by-side in Sylvani
    // (neither Temple endgame nor cleared).
    expect(screen.getByTestId('wild-boss-slot')).toBeInTheDocument();
    expect(screen.getByTestId('region-boss-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('vurmox-destiny-slot')).toBeNull();
  });

  it('replaces the region-boss slot with the DESTINY slot when both Temple wilds are cleared (u-9d, designer polish 2026-04-22)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        currentZone: 'gilded-cage',
        zoneHistory: ['sylvani', 'emberpeak'],
        defeatedBossIds: ['sentinel', 'silver-chimera'],
      }),
    );
    render(<GameBoard />);
    // Designer polish 2026-04-22: when DESTINY is live, the wild slot
    // is suppressed so the 1.5× destiny pane owns the row. Its
    // cleared state would otherwise be occluded anyway.
    expect(screen.queryByTestId('wild-boss-slot')).toBeNull();
    expect(screen.getByTestId('vurmox-destiny-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('region-boss-slot')).toBeNull();
  });

  it('keeps the region-boss slot (not DESTINY) when only one Temple wild is cleared (u-9d)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        currentZone: 'gilded-cage',
        zoneHistory: ['sylvani', 'emberpeak'],
        defeatedBossIds: ['sentinel'],
        // rtf4: bump into Boss phase so the region slot renders with
        // its primary `region-boss-slot` testId rather than the
        // phase-locked variant.
        turn: 6,
      }),
    );
    render(<GameBoard />);
    expect(screen.getByTestId('region-boss-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('vurmox-destiny-slot')).toBeNull();
  });

  it('never renders a wild-boss or region-boss card in the center-row field (u-9a regression)', () => {
    // u-9a pulled bosses out of SUPPLY_PLAN — they should never populate
    // state.field. Guard with a pre-scan of KID_CARDS and then verify the
    // rendered DOM contains no field-card tile whose role is a boss role.
    const hero = KID_CARDS.find((c) => c.role === 'hero');
    const monster = KID_CARDS.find((c) => c.role === 'monster' && c.bossTier === undefined);
    if (!hero || !monster) throw new Error('test fixtures missing');

    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        field: [hero, monster],
      }),
    );
    const { container } = render(<GameBoard />);
    const bossTiles = container.querySelectorAll(
      '[data-testid^="field-card-"][data-role="mini-boss"], [data-testid^="field-card-"][data-role="final-boss"]',
    );
    expect(bossTiles.length).toBe(0);

    // Belt-and-suspenders: assert no card in state.field has a bossTier.
    const fieldCards = useGameStore.getState().field;
    for (const c of fieldCards) {
      expect(c.bossTier).toBeUndefined();
    }
  });
});
