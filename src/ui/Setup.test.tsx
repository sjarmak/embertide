import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Setup from './Setup';
import { KID_CHAMPIONS } from '../data/champions';

const TOUCH_MIN = 44;

function parsePx(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const match = /^(\d+(?:\.\d+)?)/.exec(String(value));
  return match ? Number(match[1]) : 0;
}

function assertMeetsTouchTarget(btn: HTMLElement) {
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

/**
 * Activate the given seat via the player-pill strip. Pills carry
 * [data-seat="N"] (post-embertide-ajb draft picker). Click is a no-op
 * if the seat is already active.
 */
function selectSeat(seat: number) {
  const pill = document.querySelector(`[data-seat="${seat}"]`) as HTMLElement | null;
  if (!pill) throw new Error(`player pill data-seat="${seat}" not found`);
  fireEvent.click(pill);
}

/**
 * Find the champion tile in the shared row. After embertide-ajb there
 * is exactly one tile per champion (not one per seat × champion).
 */
function championTile(championId: string): HTMLElement {
  const tile = document.querySelector(`button[data-champion-id="${championId}"]`);
  if (!tile) throw new Error(`no tile for champion=${championId}`);
  return tile as HTMLElement;
}

/**
 * Helper: simulate "player `seat` picks `championId`". Activates the seat
 * pill first so the shared-row click routes to that seat, then clicks
 * the champion tile.
 */
function pickForSeat(seat: number, championId: string) {
  selectSeat(seat);
  fireEvent.click(championTile(championId));
}

describe('Setup', () => {
  it('renders exactly 4 shared champion-picker buttons regardless of player count (embertide-ajb)', () => {
    render(<Setup onStart={vi.fn()} />);
    // One shared row of 4 tiles, whether playerCount is 2 or 4.
    const tiles = document.querySelectorAll('button[data-champion-id]');
    expect(tiles).toHaveLength(4);
    const ids = Array.from(tiles).map((t) => t.getAttribute('data-champion-id'));
    expect(ids).toEqual(KID_CHAMPIONS.map((c) => c.id));
  });

  it('renders one player pill per seat (data-seat attribute survives)', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    const pills = document.querySelectorAll('[data-seat]');
    expect(pills).toHaveLength(4);
    for (let seat = 0; seat < 4; seat += 1) {
      const pill = document.querySelector(`[data-seat="${seat}"]`) as HTMLElement | null;
      expect(pill, `seat ${seat} pill`).not.toBeNull();
      expect(pill!.textContent ?? '').toContain(`Player ${seat + 1}`);
    }
  });

  it('renders a player-count control accepting values 1, 2, 3, 4', () => {
    render(<Setup onStart={vi.fn()} />);
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument();
    }
  });

  // embertide-oovz (2026-04-26) + post-ship simplification:
  // per-seat toggle is a slide switch with a single 'Bot' label
  // adjacent to the track. State reads from the switch's
  // aria-checked attribute (true = Bot, false = Human) — the helper
  // returns the canonical 'Human' / 'Bot' label so existing call
  // sites continue to assert against word-state without coupling to
  // the visual representation.
  function activeSegment(testid: string): string {
    const wrapper = screen.getByTestId(testid);
    const sw = wrapper.querySelector<HTMLElement>('[role="switch"]');
    return sw?.getAttribute('aria-checked') === 'true' ? 'Bot' : 'Human';
  }

  function clickSegment(testid: string, label: 'Human' | 'Bot'): void {
    const wrapper = screen.getByTestId(testid);
    if (activeSegment(testid) === label) return; // already in target state
    const sw = wrapper.querySelector<HTMLElement>('[role="switch"]');
    if (!sw) throw new Error(`switch not found in ${testid}`);
    fireEvent.click(sw);
  }

  it('renders a per-seat human/bot toggle for every seat (d8vc / 14a)', () => {
    render(<Setup onStart={vi.fn()} />);
    expect(activeSegment('setup-player-bot-toggle-0')).toBe('Human');
    expect(activeSegment('setup-player-bot-toggle-1')).toBe('Human');
    expect(screen.queryByTestId('setup-player-bot-toggle-2')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    for (const seat of [0, 1, 2, 3]) {
      expect(activeSegment(`setup-player-bot-toggle-${seat}`)).toBe('Human');
    }
  });

  it('toggling a seat flips its bot state independently (d8vc / 14a)', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));

    clickSegment('setup-player-bot-toggle-2', 'Bot');
    expect(activeSegment('setup-player-bot-toggle-0')).toBe('Human');
    expect(activeSegment('setup-player-bot-toggle-2')).toBe('Bot');
  });

  it('invokes onStart with a well-formed GameConfig including botSeats array (d8vc)', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    clickSegment('setup-player-bot-toggle-0', 'Bot');
    pickForSeat(0, KID_CHAMPIONS[1].id);

    fireEvent.click(screen.getByTestId('start-button'));

    expect(onStart).toHaveBeenCalledTimes(1);
    const config = onStart.mock.calls[0][0];
    expect(config.players).toBe(1);
    expect(config.botSeats).toEqual([true]);
    expect(Array.isArray(config.championIds)).toBe(true);
    expect(config.championIds).toEqual([KID_CHAMPIONS[1].id]);
  });

  it('every clickable button has minWidth AND minHeight >= 44px', () => {
    render(<Setup onStart={vi.fn()} />);

    const defaultButtons = screen.getAllByRole('button');
    expect(defaultButtons.length).toBeGreaterThan(0);
    for (const btn of defaultButtons) {
      assertMeetsTouchTarget(btn);
    }

    fireEvent.click(screen.getByRole('button', { name: '1' }));

    // d8vc (2026-04-25): per-seat bot toggle replaces the legacy
    // solo-vs-bot pill. Confirm the seat-0 toggle is mounted at
    // playerCount=1 and that all buttons (incl. it) hit 44px.
    const buttonsAfter = screen.getAllByRole('button');
    expect(screen.getByTestId('setup-player-bot-toggle-0')).toBeInTheDocument();
    for (const btn of buttonsAfter) {
      assertMeetsTouchTarget(btn);
    }
  });

  it('every champion button renders its bespoke illustration as an <svg>', () => {
    const { container } = render(<Setup onStart={vi.fn()} />);
    const championButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-champion-id]'),
    );
    // Single shared row — 4 unique tiles regardless of playerCount.
    expect(championButtons).toHaveLength(4);
    for (const btn of championButtons) {
      // embertide-jrw: tiles also render decorative corner medallion
      // SVGs, so scope the illustration lookup to the art panel.
      const svg = btn.querySelector('.setup-champion-art > svg');
      expect(
        svg,
        `champion ${btn.dataset.championId} should render an illustration svg`,
      ).not.toBeNull();
      expect(svg?.getAttribute('data-illustration-id')).toMatch(/^cathedral_starter_champion_/);
    }
  });

  it("shows each champion's displayName inside its tile and exposes the full passiveDescription via aria-label (embertide-6y2)", () => {
    render(<Setup onStart={vi.fn()} />);
    for (const champion of KID_CHAMPIONS) {
      const tile = championTile(champion.id);
      // displayName is rendered as visible text.
      expect(tile.textContent ?? '').toContain(champion.displayName);
      // passiveDescription is now tokenized into inline icons for sighted
      // players (resource words replaced with <GreenRupee/>/<Sword/>/
      // <Key/>/<Heart/>). The plain-text form lives in aria-label so screen
      // readers still hear the full spelled-out passive.
      const ariaLabel = tile.getAttribute('aria-label') ?? '';
      expect(ariaLabel).toContain(champion.displayName);
      expect(ariaLabel).toContain(champion.passiveDescription);
    }
  });

  it('renders the champion passive as inline resource icons — resource words ("heart"/"power"/"green") are replaced by matching <svg> icons (embertide-6y2)', () => {
    render(<Setup onStart={vi.fn()} />);
    // Courage: "+1 heart ..." → heart icon, no literal "heart" word in DOM.
    const courage = championTile('champion-courage');
    const courageVisible = courage.querySelector('.setup-champion-plate');
    expect(courageVisible?.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(courageVisible?.textContent ?? '').not.toContain('heart');
    // Power: "+2 power ..." → sword icon, no literal "power" word.
    const powerTile = championTile('champion-power');
    const powerVisible = powerTile.querySelector('.setup-champion-plate');
    expect(powerVisible?.querySelector('svg[aria-label="sword"]')).not.toBeNull();
    expect(powerVisible?.textContent ?? '').not.toContain('power');
    // Sword: "+1 green ..., +1 bonus heart ..." → both icons present,
    // "bonus" qualifier preserved as text.
    const swordTile = championTile('champion-sword');
    const swordVisible = swordTile.querySelector('.setup-champion-plate');
    expect(swordVisible?.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
    expect(swordVisible?.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(swordVisible?.textContent ?? '').toContain('bonus');
    expect(swordVisible?.textContent ?? '').not.toContain('green');
    // Wisdom: "Draw 1 extra card ..." → no resource token, no icons.
    const wisdomTile = championTile('champion-wisdom');
    const wisdomVisible = wisdomTile.querySelector('.setup-champion-plate');
    expect(
      wisdomVisible?.querySelector(
        'svg[aria-label="heart"], svg[aria-label="sword"], svg[aria-label="green-shard"], svg[aria-label="key"]',
      ),
    ).toBeNull();
    expect(wisdomVisible?.textContent ?? '').toContain('Draw 1 extra card');
  });

  it("uses aria-pressed to indicate the active seat's current champion pick", () => {
    render(<Setup onStart={vi.fn()} />);
    // Default playerCount=2, activeSeat=0, seat 0 defaults to KID_CHAMPIONS[0].
    selectSeat(0);
    const first = championTile(KID_CHAMPIONS[0].id);
    const second = championTile(KID_CHAMPIONS[1].id);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(second.getAttribute('aria-pressed')).toBe('false');

    // Click second champion: now seat 0 is KID_CHAMPIONS[1], activeSeat
    // auto-advances to seat 1. aria-pressed reflects seat 1's pick
    // (seat 1 defaults to KID_CHAMPIONS[1]).
    fireEvent.click(second);
    expect(
      screen
        .getByTestId('setup-root')
        .querySelector('[data-seat="1"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true');

    // Rewind to seat 0: its pick is now KID_CHAMPIONS[1], so second
    // should be aria-pressed, first should not.
    selectSeat(0);
    expect(championTile(KID_CHAMPIONS[0].id).getAttribute('aria-pressed')).toBe('false');
    expect(championTile(KID_CHAMPIONS[1].id).getAttribute('aria-pressed')).toBe('true');

    for (const champion of KID_CHAMPIONS) {
      const btn = championTile(champion.id);
      expect(Array.from(btn.classList)).not.toContain('selected');
      expect(Array.from(btn.classList)).not.toContain('is-selected');
      expect(Array.from(btn.classList)).not.toContain('champion-selected');
    }
  });

  it('gem-style player-count buttons expose the digit as their accessible name only', () => {
    render(<Setup onStart={vi.fn()} />);
    for (const n of [1, 2, 3, 4]) {
      const btn = screen.getByRole('button', { name: String(n) });
      expect((btn.textContent ?? '').trim()).toBe(String(n));
      expect(btn.getAttribute('data-variant')).toBe('gem');
    }
  });

  it('per-seat bot toggle is a slide switch with a single Bot label (oovz + post-ship simplification)', () => {
    // embertide-oovz + post-ship feedback (2026-04-26): the 14a
    // radiogroup-with-radios shape was retired for a slide toggle.
    // Post-ship feedback simplified further to a SINGLE 'Bot' label
    // adjacent to the track — the toggle position alone (knob left +
    // muted shadow track for human, knob right + gold-glow track for
    // bot) carries the binary state, so the redundant 'Human' label
    // is gone. This test pins the new shape.
    render(<Setup onStart={vi.fn()} />);

    const wrapper = screen.getByTestId('setup-player-bot-toggle-0');
    const sw = wrapper.querySelector<HTMLElement>('[role="switch"]');
    expect(sw, 'switch button is mounted').not.toBeNull();
    expect(sw!.getAttribute('aria-checked')).toBe('false'); // default Human
    expect(sw!.getAttribute('data-state')).toBe('human');

    const labels = Array.from(wrapper.querySelectorAll<HTMLElement>('.setup-bot-toggle-label'));
    expect(labels.map((l) => (l.textContent ?? '').trim())).toEqual(['Bot']);
    // Inactive label state at default (human seat).
    expect(labels[0].getAttribute('data-active')).toBe('false');

    fireEvent.click(sw!);
    const swAfter = wrapper.querySelector<HTMLElement>('[role="switch"]');
    expect(swAfter!.getAttribute('aria-checked')).toBe('true'); // now Bot
    expect(swAfter!.getAttribute('data-state')).toBe('bot');
    const labelsAfter = Array.from(
      wrapper.querySelectorAll<HTMLElement>('.setup-bot-toggle-label'),
    );
    expect(labelsAfter[0].getAttribute('data-active')).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // embertide-edv — Per-seat champion picking (players 2-4).
  // ---------------------------------------------------------------------------

  it('renders 4 player pills when playerCount is 4', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    const pills = document.querySelectorAll('[data-seat]');
    expect(pills).toHaveLength(4);
    // Champion row still has exactly 4 tiles (shared, not per-seat).
    const tiles = document.querySelectorAll('button[data-champion-id]');
    expect(tiles).toHaveLength(4);
  });

  it('defaults each seat to the next un-picked champion in KID_CHAMPIONS order (4 seats, all distinct)', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByTestId('start-button'));

    const config = onStart.mock.calls[0][0];
    expect(config.players).toBe(4);
    expect(config.championIds).toEqual(KID_CHAMPIONS.map((c) => c.id));
    expect(new Set(config.championIds).size).toBe(4);
  });

  it('records each seat pick independently via the player pill strip', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    const picks = [
      KID_CHAMPIONS[3].id, // seat 0
      KID_CHAMPIONS[2].id, // seat 1
      KID_CHAMPIONS[1].id, // seat 2
      KID_CHAMPIONS[0].id, // seat 3
    ];
    for (let seat = 0; seat < 4; seat += 1) {
      pickForSeat(seat, picks[seat]);
    }

    // Verify each pill's pick preview reflects the right champion.
    for (let seat = 0; seat < 4; seat += 1) {
      const expectedName = KID_CHAMPIONS.find((c) => c.id === picks[seat])?.displayName ?? '';
      const pill = document.querySelector(`[data-seat="${seat}"]`) as HTMLElement;
      expect(pill.textContent ?? '').toContain(expectedName);
    }

    fireEvent.click(screen.getByTestId('start-button'));
    const config = onStart.mock.calls[0][0];
    expect(config.championIds).toEqual(picks);
  });

  it('dropping player count preserves earlier seat picks', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    pickForSeat(0, KID_CHAMPIONS[2].id);
    pickForSeat(1, KID_CHAMPIONS[3].id);

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByTestId('start-button'));

    const config = onStart.mock.calls[0][0];
    expect(config.players).toBe(2);
    expect(config.championIds).toEqual([KID_CHAMPIONS[2].id, KID_CHAMPIONS[3].id]);
  });

  it('growing player count fills new seats with the next un-picked champion', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    pickForSeat(1, KID_CHAMPIONS[2].id);

    fireEvent.click(screen.getByRole('button', { name: '4' }));

    fireEvent.click(screen.getByTestId('start-button'));
    const config = onStart.mock.calls[0][0];
    expect(config.championIds).toEqual([
      KID_CHAMPIONS[0].id,
      KID_CHAMPIONS[2].id,
      KID_CHAMPIONS[1].id,
      KID_CHAMPIONS[3].id,
    ]);
  });

  it('allows duplicate champion picks only when the player explicitly clicks', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    // Defaults: [champs[0], champs[1], champs[2], champs[3]]
    // Seat 1 picks champs[0] — duplicate opt-in.
    pickForSeat(1, KID_CHAMPIONS[0].id);

    fireEvent.click(screen.getByTestId('start-button'));
    const config = onStart.mock.calls[0][0];
    expect(config.championIds).toEqual([
      KID_CHAMPIONS[0].id,
      KID_CHAMPIONS[0].id,
      KID_CHAMPIONS[2].id,
      KID_CHAMPIONS[3].id,
    ]);
  });

  it('config.championIds length always equals players', () => {
    const onStart = vi.fn();
    render(<Setup onStart={onStart} />);
    for (const n of [1, 2, 3, 4]) {
      onStart.mockClear();
      fireEvent.click(screen.getByRole('button', { name: String(n) }));
      fireEvent.click(screen.getByTestId('start-button'));
      const config = onStart.mock.calls[0][0];
      expect(config.players).toBe(n);
      expect(config.championIds).toHaveLength(n);
    }
  });

  it('each player pill exposes its seat index (1-based) as a visible label', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    for (const seat of [0, 1, 2]) {
      const pill = document.querySelector(`[data-seat="${seat}"]`) as HTMLElement;
      expect(pill, `seat=${seat}`).not.toBeNull();
      expect(pill.textContent ?? '').toContain(`Player ${seat + 1}`);
    }
  });

  // ---------------------------------------------------------------------------
  // embertide-ajb — Draft-style picker semantics.
  // ---------------------------------------------------------------------------

  it('auto-advances activeSeat after a pick and wraps at the last seat', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));

    const isActive = (seat: number) =>
      document.querySelector(`[data-seat="${seat}"]`)?.getAttribute('aria-checked') === 'true';

    // Start: activeSeat=0.
    expect(isActive(0)).toBe(true);
    // Pick for seat 0 → advance to seat 1.
    fireEvent.click(championTile(KID_CHAMPIONS[1].id));
    expect(isActive(1)).toBe(true);
    // Pick for seat 1 → advance to seat 2.
    fireEvent.click(championTile(KID_CHAMPIONS[2].id));
    expect(isActive(2)).toBe(true);
    // Pick for seat 2 → wrap to seat 0.
    fireEvent.click(championTile(KID_CHAMPIONS[3].id));
    expect(isActive(0)).toBe(true);
  });

  it('tiles render a badge for every seat that picked that champion (duplicates stack)', () => {
    render(<Setup onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    // Two seats pick champs[0]; verify tile's data-picked-seats reflects both.
    pickForSeat(0, KID_CHAMPIONS[0].id);
    pickForSeat(1, KID_CHAMPIONS[0].id);

    const tile = championTile(KID_CHAMPIONS[0].id);
    expect(tile.getAttribute('data-picked-seats')).toBe('0,1');
    // And the decorative badge container is rendered + aria-hidden.
    const badges = tile.querySelector('[aria-hidden="true"].setup-champion-badges');
    expect(badges).not.toBeNull();
    expect(badges!.querySelectorAll('[data-seat-badge]').length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // embertide-jrw — Elysian Cathedral restyle of the champion picker tile.
  // Class-presence + structural assertions for the five visual deliverables.
  // ---------------------------------------------------------------------------

  describe('Elysian Cathedral restyle (embertide-jrw)', () => {
    it('every tile carries its champion id on data-champion-id (drives per-champion stained-glass fill in CSS)', () => {
      render(<Setup onStart={vi.fn()} />);
      const ids = Array.from(
        document.querySelectorAll<HTMLElement>('button[data-champion-id]'),
      ).map((tile) => tile.getAttribute('data-champion-id'));
      expect(ids).toEqual([
        'champion-courage',
        'champion-wisdom',
        'champion-power',
        'champion-sword',
      ]);
    });

    it('every tile renders 4 decorative corner medallions (one per corner)', () => {
      render(<Setup onStart={vi.fn()} />);
      for (const champion of KID_CHAMPIONS) {
        const tile = championTile(champion.id);
        const medallionsRoot = tile.querySelector('.setup-champion-medallions');
        expect(medallionsRoot, `medallions root for ${champion.id}`).not.toBeNull();
        expect(medallionsRoot?.getAttribute('aria-hidden')).toBe('true');
        const corners = Array.from(
          medallionsRoot!.querySelectorAll<HTMLElement>('.setup-champion-medallion'),
        ).map((m) => m.getAttribute('data-corner'));
        expect(corners.sort()).toEqual(['bl', 'br', 'tl', 'tr']);
        // Each corner contains a medallion <svg>.
        expect(medallionsRoot!.querySelectorAll('svg.setup-champion-medallion-svg')).toHaveLength(
          4,
        );
      }
    });

    it('renders a stained-glass shimmer overlay span inside the art panel of every tile', () => {
      render(<Setup onStart={vi.fn()} />);
      for (const champion of KID_CHAMPIONS) {
        const tile = championTile(champion.id);
        const shimmer = tile.querySelector('.setup-champion-art .setup-champion-shimmer');
        expect(shimmer, `shimmer for ${champion.id}`).not.toBeNull();
        expect(shimmer?.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('seat-badge chips are rendered as decorative SVG (CostGem-style), no visible numeric text', () => {
      render(<Setup onStart={vi.fn()} />);
      // Default playerCount=2, so seats 0/1 each take a default champion.
      const tile = championTile(KID_CHAMPIONS[0].id);
      const badges = tile.querySelector('.setup-champion-badges');
      expect(badges).not.toBeNull();
      const chips = Array.from(badges!.querySelectorAll<HTMLElement>('[data-seat-badge]'));
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        // embertide-jrw deliverable 4: chip swap from text-pill →
        // CostGem-style svg chip, no number visible.
        const svg = chip.querySelector('svg.setup-champion-badge-svg');
        expect(svg, `chip svg for seat ${chip.getAttribute('data-seat-badge')}`).not.toBeNull();
        // No "P1"/"P2"/"P3"/"P4" text in the chip after the restyle.
        expect((chip.textContent ?? '').trim()).toBe('');
      }
    });

    it('selected tile carries data-selected="true" so the gold pulse + shimmer styles apply', () => {
      render(<Setup onStart={vi.fn()} />);
      // Default seat 0 selects KID_CHAMPIONS[0].
      const selectedTile = championTile(KID_CHAMPIONS[0].id);
      expect(selectedTile.getAttribute('data-selected')).toBe('true');
      expect(selectedTile.getAttribute('aria-pressed')).toBe('true');
      // The other three tiles should be data-selected="false" relative to seat 0.
      for (const champion of KID_CHAMPIONS.slice(2)) {
        const tile = championTile(champion.id);
        expect(tile.getAttribute('data-selected')).toBe('false');
        expect(tile.getAttribute('aria-pressed')).toBe('false');
      }
    });

    it('passive copy is wrapped in .setup-champion-passive (drives 2-line clamp + parchment-on-shadow type)', () => {
      render(<Setup onStart={vi.fn()} />);
      for (const champion of KID_CHAMPIONS) {
        const tile = championTile(champion.id);
        const passive = tile.querySelector('.setup-champion-passive');
        expect(passive, `passive node for ${champion.id}`).not.toBeNull();
        // The plate is the parent — name + passive both live inside it.
        const plate = tile.querySelector('.setup-champion-plate');
        expect(plate?.contains(passive)).toBe(true);
        // The display name still renders via .setup-champion-name (now 18px
        // Cinzel uppercase per the restyle spec — verified by class presence
        // here; visual weight is checked at the CSS level).
        const nameNode = plate?.querySelector('.setup-champion-name');
        expect(nameNode?.textContent ?? '').toContain(champion.displayName);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // embertide-5qql — Cathedral background + larger champion tiles.
  // Class-presence assertions only; visual sizing is verified at the CSS
  // level. The tile-large modifier is the contract that drives the ~1.5×
  // bumped width / art height; the cathedral root class drives the layered
  // stained-glass background that replaces the prior flat sapphire fill.
  // ---------------------------------------------------------------------------

  describe('Setup screen polish (embertide-5qql)', () => {
    it('setup root carries the .setup-root-cathedral class so the layered stained-glass background applies', () => {
      render(<Setup onStart={vi.fn()} />);
      const root = screen.getByTestId('setup-root');
      expect(root.classList.contains('setup-root')).toBe(true);
      expect(root.classList.contains('setup-root-cathedral')).toBe(true);
    });

    it('setup root applies the cathedral background-image class (vwao raster carries the visual)', () => {
      // vwao (2026-04-25): the legacy decorative SVG arch overlay was
      // retired when the generated stained-glass landing raster shipped.
      // The .setup-root-cathedral class now layers the raster as a
      // CSS background-image; assert the class is present rather than
      // probing for the retired DOM node.
      render(<Setup onStart={vi.fn()} />);
      const root = screen.getByTestId('setup-root');
      expect(root.classList.contains('setup-root-cathedral')).toBe(true);
      expect(root.querySelector('.setup-cathedral-arches')).toBeNull();
    });

    // zd3z (2026-04-25): the -large modifier was retired when the
    // rainbow-opal Embertide window landed — the ~1.5× tile pushed the
    // champion row up over the rose window. Default jrw size now leaves
    // the full window visible above the picker. The base tile class is
    // still asserted so the cathedral chrome is verified.
    it('every champion tile carries the .setup-champion-tile base class', () => {
      render(<Setup onStart={vi.fn()} />);
      for (const champion of KID_CHAMPIONS) {
        const tile = championTile(champion.id);
        expect(
          tile.classList.contains('setup-champion-tile'),
          `base tile class missing for ${champion.id}`,
        ).toBe(true);
        // -large modifier intentionally absent post-zd3z.
        expect(tile.classList.contains('setup-champion-tile-large')).toBe(false);
      }
    });
  });
});
