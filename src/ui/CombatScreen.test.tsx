import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import CombatScreen, { __resetBackgroundWarnings } from './CombatScreen';
import CombatBossStage from './CombatBossStage';
import CombatBattlefield from './CombatBattlefield';
import CombatHand from './CombatHand';
import GameBoard from './GameBoard';
import { useGameStore } from '../store/gameStore';
import { createSeededRng } from '../rules/chestPool';
import type { KidGameState, KidPlayer } from '../store/types';
import type { BattlefieldCard, CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import type { Card } from '../types/card';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

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

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 8,
    hpMax: 10,
    sourceCardId: 'craghorn',
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: null,
    },
    ...overrides,
  };
}

function makeEntryContext(overrides: Partial<CombatEntryContext> = {}): CombatEntryContext {
  return {
    bossCardId: 'craghorn',
    combatEntryTurn: 3,
    attackerPlayerIds: ['p0'],
    engagementSource: 'fightMonster',
    entrySource: 'field',
    ...overrides,
  };
}

function makeCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    role: 'hero',
    cost: {},
    effects: { kind: 'gain', green: 0 },
    ...overrides,
  };
}

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    boss: makeBoss(),
    combatDeck: [],
    combatHand: [],
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext: makeEntryContext(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CombatBossStage
// ---------------------------------------------------------------------------

describe('CombatBossStage', () => {
  it('renders the hp/hpMax numeric readout', () => {
    render(<CombatBossStage boss={makeBoss({ hp: 6, hpMax: 10 })} activeActor="players" />);
    expect(screen.getByTestId('combat-boss-hp-readout')).toHaveTextContent('6 / 10');
  });

  it('renders the hp bar with the correct fill percentage', () => {
    render(<CombatBossStage boss={makeBoss({ hp: 4, hpMax: 10 })} activeActor="players" />);
    const fill = screen.getByTestId('combat-boss-hp-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('40%');
  });

  it('clamps the hp bar fill to 0% when hp is negative', () => {
    render(<CombatBossStage boss={makeBoss({ hp: -1, hpMax: 10 })} activeActor="players" />);
    const fill = screen.getByTestId('combat-boss-hp-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('renders the attack telegraph banner when activeActor is boss', () => {
    render(
      <CombatBossStage
        boss={makeBoss({
          attackPattern: { damagePerTurn: 3, targeting: 'player-hp', onDefeatEffect: null },
        })}
        activeActor="boss"
      />,
    );
    const banner = screen.getByTestId('combat-boss-telegraph');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('3');
  });

  it('does NOT render the attack telegraph banner during the players sub-turn', () => {
    render(<CombatBossStage boss={makeBoss()} activeActor="players" />);
    expect(screen.queryByTestId('combat-boss-telegraph')).toBeNull();
  });

  // embertide-9lj6: telegraph banner surfaces the boss-specific
  // attack name (when supplied) instead of the generic "Boss" lead.
  it('telegraph banner uses the per-boss attack name when supplied', () => {
    render(
      <CombatBossStage
        boss={makeBoss({
          attackPattern: { damagePerTurn: 2, targeting: 'player-hp', onDefeatEffect: null },
        })}
        activeActor="boss"
        attackName="Rock Throw"
      />,
    );
    const banner = screen.getByTestId('combat-boss-telegraph');
    expect(banner).toHaveTextContent(/Rock Throw\s+winds up for\s+2/);
  });

  it('telegraph banner falls back to "Boss winds up for N" when no attackName is supplied', () => {
    render(
      <CombatBossStage
        boss={makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        })}
        activeActor="boss"
      />,
    );
    const banner = screen.getByTestId('combat-boss-telegraph');
    expect(banner).toHaveTextContent(/Boss\s+winds up for\s+4/);
  });

  it('exposes a progressbar with aria-valuenow and aria-valuemax', () => {
    render(<CombatBossStage boss={makeBoss({ hp: 6, hpMax: 10 })} activeActor="players" />);
    const bar = screen.getByTestId('combat-boss-hp-bar');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('6');
    expect(bar.getAttribute('aria-valuemax')).toBe('10');
  });

  // u-10e (REQ-33 §D4) — ornate stained-glass arch frame + jeweled HP sockets.
  // nz8-f3z: testid renamed combat-boss-panel → combat-boss-stage; the legacy
  // `combat-boss-panel` CSS class is retained as a co-class so the existing
  // damage-pulse animation selector continues to match until nz8-d retires
  // the legacy hook.
  it('renders the stained-glass stage chrome class + data attribute', () => {
    render(<CombatBossStage boss={makeBoss()} activeActor="players" />);
    const stage = screen.getByTestId('combat-boss-stage');
    expect(stage.classList.contains('combat-boss-stage')).toBe(true);
    expect(stage.classList.contains('combat-boss-panel')).toBe(true);
    expect(stage.getAttribute('data-ornate-frame')).toBe('true');
  });

  it('renders four jeweled HP sockets inside the HP bar', () => {
    render(<CombatBossStage boss={makeBoss()} activeActor="players" />);
    const sockets = screen.getAllByTestId(/^combat-boss-hp-socket-\d+$/);
    expect(sockets).toHaveLength(4);
    sockets.forEach((socket, i) => {
      expect(socket.classList.contains('combat-boss-hp-socket')).toBe(true);
      expect(socket.getAttribute('data-hp-socket-index')).toBe(String(i));
    });
  });

  // embertide-797 — bespoke stained-glass boss portrait alongside
  // the name + HP bar. Portrait is driven by CardArt's SPEC_BY_BASE_ID,
  // with a generic-portrait fallback for ids that ship before their
  // bespoke raster (bossPortraitForBaseId) so the stage never renders an
  // empty socket.
  it('renders a boss portrait for a registered sourceCardId (craghorn)', () => {
    render(<CombatBossStage boss={makeBoss({ sourceCardId: 'craghorn' })} activeActor="players" />);
    const portrait = screen.getByTestId('combat-boss-portrait');
    expect(portrait).toBeInTheDocument();
    // Portrait wrapper is aria-hidden so it doesn't duplicate the
    // boss name for screen readers (hp aria-label already covers it).
    expect(portrait.getAttribute('aria-hidden')).toBe('true');
    // Illustration renders as a child element (SVG-based raster).
    expect(portrait.childElementCount).toBeGreaterThan(0);
  });

  it('renders a generic fallback portrait for an unregistered sourceCardId', () => {
    // Regression: several colosseum bosses ship before their bespoke
    // raster (player report: "Colosseum says Bonereaver but no art").
    // bossPortraitForBaseId falls back to a generic mini-boss portrait so
    // the stage always shows a boss, never an empty socket.
    render(
      <CombatBossStage
        boss={makeBoss({ sourceCardId: 'not-a-real-boss-id' })}
        activeActor="players"
      />,
    );
    const portrait = screen.getByTestId('combat-boss-portrait');
    expect(portrait).toBeInTheDocument();
    expect(portrait.childElementCount).toBeGreaterThan(0);
    // Stage still renders the rest of its content cleanly.
    expect(screen.getByTestId('combat-boss-stage')).toBeInTheDocument();
    expect(screen.getByTestId('combat-boss-hp-bar')).toBeInTheDocument();
  });

  // embertide-jw6 — boss-label fallback. Known bosses come from
  // GENERIC_BASE_ID_THEME (canonical name). Unknown bosses must NOT
  // surface the literal string "Boss" — fall through to nameForBaseId
  // so future bosses that haven't been added to the theme map still
  // read as a humanized id instead of an ugly placeholder.
  it('renders the GENERIC_BASE_ID_THEME name for a known boss id', () => {
    render(<CombatBossStage boss={makeBoss({ sourceCardId: 'craghorn' })} activeActor="players" />);
    expect(screen.getByTestId('combat-boss-label')).toHaveTextContent('Craghorn');
  });

  it('falls back to the humanized id (not the literal "Boss") for an unknown boss id', () => {
    render(
      <CombatBossStage
        boss={makeBoss({ sourceCardId: 'future-wild-boss' })}
        activeActor="players"
      />,
    );
    const label = screen.getByTestId('combat-boss-label');
    expect(label).toHaveTextContent('Future Wild Boss');
    expect(label.textContent).not.toBe('Boss');
  });

  // ---------------------------------------------------------------------------
  // Boss intent indicator (embertide-d5wm) — Slay-the-Spire-style
  // damage preview anchored above the portrait so the player can plan
  // before committing cards.
  // ---------------------------------------------------------------------------

  describe('boss intent indicator (embertide-d5wm)', () => {
    it('renders the upcoming boss-turn damage on the players sub-turn', () => {
      render(
        <CombatBossStage
          boss={makeBoss({
            attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
          })}
          activeActor="players"
        />,
      );
      const indicator = screen.getByTestId('boss-intent-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.getAttribute('data-intent-kind')).toBe('attack');
      expect(screen.getByTestId('boss-intent-damage')).toHaveTextContent('4');
    });

    it('still renders the damage preview during the boss sub-turn', () => {
      // Turn 1 readability: the intent is visible on combat enter regardless
      // of which actor is "active" so the player always knows what is coming.
      render(<CombatBossStage boss={makeBoss({ hp: 8, hpMax: 10 })} activeActor="boss" />);
      expect(screen.getByTestId('boss-intent-indicator')).toBeInTheDocument();
    });

    it('updates the damage preview when the attack pattern changes between rounds', () => {
      const { rerender } = render(
        <CombatBossStage
          boss={makeBoss({
            hp: 8,
            hpMax: 10,
            attackPattern: { damagePerTurn: 3, targeting: 'player-hp', onDefeatEffect: null },
          })}
          activeActor="players"
        />,
      );
      expect(screen.getByTestId('boss-intent-damage')).toHaveTextContent('3');
      rerender(
        <CombatBossStage
          boss={makeBoss({
            hp: 8,
            hpMax: 10,
            attackPattern: { damagePerTurn: 5, targeting: 'player-hp', onDefeatEffect: null },
          })}
          activeActor="players"
        />,
      );
      expect(screen.getByTestId('boss-intent-damage')).toHaveTextContent('5');
    });

    it('flips to the AOE badge once boss hp drops below the desperation threshold', () => {
      // DESPERATION_HP_PCT = 0.25 → 2/10 hp triggers desperation override.
      render(
        <CombatBossStage
          boss={makeBoss({
            hp: 2,
            hpMax: 10,
            attackPattern: {
              damagePerTurn: 3,
              targeting: 'battlefield-then-player',
              onDefeatEffect: null,
            },
          })}
          activeActor="players"
        />,
      );
      const indicator = screen.getByTestId('boss-intent-indicator');
      expect(indicator.getAttribute('data-intent-aoe')).toBe('true');
      expect(screen.getByTestId('boss-intent-aoe-badge')).toBeInTheDocument();
    });

    it('shows the AOE badge for natively-aoe attack patterns at full hp', () => {
      render(
        <CombatBossStage
          boss={makeBoss({
            hp: 10,
            hpMax: 10,
            attackPattern: { damagePerTurn: 2, targeting: 'aoe', onDefeatEffect: null },
          })}
          activeActor="players"
        />,
      );
      expect(screen.getByTestId('boss-intent-aoe-badge')).toBeInTheDocument();
    });

    it('does NOT show the AOE badge for non-aoe patterns above the desperation threshold', () => {
      render(
        <CombatBossStage
          boss={makeBoss({
            hp: 8,
            hpMax: 10,
            attackPattern: {
              damagePerTurn: 3,
              targeting: 'battlefield-then-player',
              onDefeatEffect: null,
            },
          })}
          activeActor="players"
        />,
      );
      expect(screen.queryByTestId('boss-intent-aoe-badge')).toBeNull();
    });

    it('renders the stunned variant when bossStunTurns > 0 (no damage preview)', () => {
      render(
        <CombatBossStage
          boss={makeBoss({ hp: 8, hpMax: 10 })}
          activeActor="players"
          bossStunTurns={1}
        />,
      );
      const indicator = screen.getByTestId('boss-intent-indicator');
      expect(indicator.getAttribute('data-intent-kind')).toBe('stun');
      expect(screen.queryByTestId('boss-intent-damage')).toBeNull();
    });

    it('hides the intent indicator entirely once the boss is defeated (hp <= 0)', () => {
      render(<CombatBossStage boss={makeBoss({ hp: 0, hpMax: 10 })} activeActor="players" />);
      expect(screen.queryByTestId('boss-intent-indicator')).toBeNull();
    });

    it('exposes a polite live region for screen readers', () => {
      render(
        <CombatBossStage
          boss={makeBoss({
            attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
          })}
          activeActor="players"
        />,
      );
      const indicator = screen.getByTestId('boss-intent-indicator');
      expect(indicator.getAttribute('role')).toBe('status');
      expect(indicator.getAttribute('aria-live')).toBe('polite');
      expect(indicator.getAttribute('aria-label')).toContain('4');
    });
  });
});

// ---------------------------------------------------------------------------
// CombatBattlefield
// ---------------------------------------------------------------------------

describe('CombatBattlefield', () => {
  const card: BattlefieldCard = {
    cardId: 'water-warrior',
    hp: 2,
    hpMax: 3,
    combatEffectId: 'combat-effect-water',
  };

  it('renders an empty-state message when no cards are on the battlefield', () => {
    render(<CombatBattlefield battlefield={[]} />);
    expect(screen.getByTestId('combat-battlefield-empty')).toBeInTheDocument();
  });

  it('renders each battlefield card with an hp/hpMax readout', () => {
    render(<CombatBattlefield battlefield={[card]} />);
    expect(screen.getByTestId('combat-battlefield-card-water-warrior')).toBeInTheDocument();
    expect(screen.getByTestId('combat-battlefield-card-water-warrior-hp')).toHaveTextContent(
      '2 / 3',
    );
  });

  it('renders multiple cards in order', () => {
    const other: BattlefieldCard = {
      cardId: 'mystic',
      hp: 1,
      hpMax: 2,
      combatEffectId: 'combat-effect-mystic',
    };
    render(<CombatBattlefield battlefield={[card, other]} />);
    expect(screen.getByTestId('combat-battlefield-card-water-warrior')).toBeInTheDocument();
    expect(screen.getByTestId('combat-battlefield-card-mystic')).toBeInTheDocument();
  });

  // u-10e (REQ-33 §D4) — stage-like marble-tile border chrome.
  it('renders the ornate stage-border chrome class + data attribute when populated', () => {
    render(<CombatBattlefield battlefield={[card]} />);
    const row = screen.getByTestId('combat-battlefield');
    expect(row.classList.contains('combat-battlefield')).toBe(true);
    expect(row.getAttribute('data-ornate-frame')).toBe('true');
  });

  it('renders the ornate stage-border chrome on the empty-state row too', () => {
    render(<CombatBattlefield battlefield={[]} />);
    const row = screen.getByTestId('combat-battlefield');
    expect(row.classList.contains('combat-battlefield')).toBe(true);
    expect(row.getAttribute('data-ornate-frame')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// CombatHand
// ---------------------------------------------------------------------------

describe('CombatHand', () => {
  const heroA = makeCard('hero-a');
  const heroB = makeCard('hero-b');

  it('renders a tap-target button per card', () => {
    render(<CombatHand cards={[heroA, heroB]} onPlayCard={() => undefined} />);
    expect(screen.getByTestId('combat-hand-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('combat-hand-slot-1')).toBeInTheDocument();
    expect(screen.getByTestId('combat-hand-slot-0').getAttribute('data-card-id')).toBe('hero-a');
  });

  it('exposes data-touch-target on each card button', () => {
    render(<CombatHand cards={[heroA]} onPlayCard={() => undefined} />);
    const btn = screen.getByTestId('combat-hand-slot-0');
    expect(btn.getAttribute('data-touch-target')).toBe('true');
  });

  it('invokes onPlayCard with the card id when tapped', () => {
    const spy = vi.fn();
    render(<CombatHand cards={[heroA]} onPlayCard={spy} />);
    fireEvent.click(screen.getByTestId('combat-hand-slot-0'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('hero-a');
  });

  it('renders an empty-state message when the hand is empty', () => {
    render(<CombatHand cards={[]} onPlayCard={() => undefined} />);
    expect(screen.getByTestId('combat-hand-empty')).toBeInTheDocument();
  });

  // u-10e (REQ-33 §D4) — parchment/leather bottom-edge chrome.
  it('renders the ornate parchment-edge chrome class + data attribute', () => {
    render(<CombatHand cards={[heroA]} onPlayCard={() => undefined} />);
    const hand = screen.getByTestId('combat-hand');
    expect(hand.classList.contains('combat-hand')).toBe(true);
    expect(hand.getAttribute('data-ornate-frame')).toBe('true');
  });

  // embertide-yf1 — surfaces the card's CombatEffect override
  // ("Combat: shield 3", "Combat: draw 2", etc.) on the in-combat
  // card face so drawn cards aren't distinguishable only by name.
  // Mirrors the 'Combat: …' line on market card faces (CardTemplate).
  // nz8-3d5: combat line is rendered by CardTemplate via
  // `card-template-combat` testid inside the slot button (previously a
  // bespoke `combat-hand-slot-${idx}-combat` span).
  it('renders a combat-summary line for cards with a distinct CombatEffect', () => {
    const scholar = makeCard('scholar-princess');
    const waterWarrior = makeCard('water-warrior');
    render(<CombatHand cards={[scholar, waterWarrior]} onPlayCard={() => undefined} />);
    const slot0 = screen.getByTestId('combat-hand-slot-0');
    const slot1 = screen.getByTestId('combat-hand-slot-1');
    expect(within(slot0).getByTestId('card-template-combat')).toHaveTextContent('Combat — Draw 2');
    expect(within(slot1).getByTestId('card-template-combat')).toHaveTextContent(
      'Combat — Attack 3',
    );
  });

  it('omits the combat-summary line for cards with no distinct CombatEffect', () => {
    // 'hero-a' is a synthetic id — combatSummaryTextFor returns '' for
    // unknown baseIds with no cost.red (falls back to the damage-1 filler
    // which the helper intentionally skips). CardTemplate skips the
    // combat span entirely when the summary is empty.
    render(<CombatHand cards={[heroA]} onPlayCard={() => undefined} />);
    const slot = screen.getByTestId('combat-hand-slot-0');
    expect(within(slot).queryByTestId('card-template-combat')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CombatScreen
// ---------------------------------------------------------------------------

describe('CombatScreen', () => {
  beforeEach(() => {
    useGameStore.setState(makeState({ activeCombat: null }));
  });

  it('returns null when state.activeCombat is null', () => {
    const { container } = render(<CombatScreen />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the combat surface when state.activeCombat is non-null', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState() }));
    render(<CombatScreen />);
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
    expect(screen.getByTestId('combat-boss-stage')).toBeInTheDocument();
    expect(screen.getByTestId('combat-battlefield')).toBeInTheDocument();
    expect(screen.getByTestId('combat-hand')).toBeInTheDocument();
    // nz8 rev-2: CombatLog retired as UI clutter.
    expect(screen.queryByTestId('combat-log')).toBeNull();
  });

  it('mounts the ArtPendingFrame background with the u-8f-art follow-up bead', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState() }));
    render(<CombatScreen />);
    const ribbon = screen.getByTestId('art-pending-frame-combat-bg-ribbon');
    expect(ribbon.textContent).toContain('u-8f-art');
  });

  it('forwards boss hp/hpMax into the boss panel readout', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ boss: makeBoss({ hp: 7, hpMax: 10 }) }),
      }),
    );
    render(<CombatScreen />);
    expect(screen.getByTestId('combat-boss-hp-readout')).toHaveTextContent('7 / 10');
  });

  it('shows the boss telegraph when activeActor is boss', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ activeActor: 'boss' }) }));
    render(<CombatScreen />);
    expect(screen.getByTestId('combat-boss-telegraph')).toBeInTheDocument();
  });

  // embertide-d5wm — boss intent indicator wires through CombatScreen,
  // including the bossStunTurns flow from CombatState.
  it('forwards the upcoming boss-turn damage into the boss-intent indicator', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({
          boss: makeBoss({
            attackPattern: { damagePerTurn: 5, targeting: 'player-hp', onDefeatEffect: null },
          }),
        }),
      }),
    );
    render(<CombatScreen />);
    expect(screen.getByTestId('boss-intent-damage')).toHaveTextContent('5');
  });

  it('renders the stun variant of the boss-intent when CombatState.bossStunTurns > 0', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ bossStunTurns: 1 }),
      }),
    );
    render(<CombatScreen />);
    const indicator = screen.getByTestId('boss-intent-indicator');
    expect(indicator.getAttribute('data-intent-kind')).toBe('stun');
  });

  // embertide-d5wm — explicit End Turn button is the player→boss
  // handoff path. Auto-resolve was rejected for regression risk; the
  // button stays the keyboard-accessible single source of truth.
  it('renders the End Turn button on the players sub-turn', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ activeActor: 'players' }) }));
    render(<CombatScreen />);
    const btn = screen.getByTestId('combat-pass-turn');
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toContain('End Turn');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('flips the End Turn button to data-must-pass when the player has 0 cards left', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ combatHand: [], activeActor: 'players' }),
      }),
    );
    render(<CombatScreen />);
    const btn = screen.getByTestId('combat-pass-turn');
    expect(btn.getAttribute('data-must-pass')).toBe('true');
  });

  it('dispatches PLAYER_PASS via the End Turn button for the boss handoff', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ activeActor: 'players' }) }));
    const spy = vi.fn();
    render(<CombatScreen dispatchCombatAction={spy} />);
    fireEvent.click(screen.getByTestId('combat-pass-turn'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ type: 'PLAYER_PASS' });
  });

  it('renders the combat hand cards from the store slice', () => {
    const card = makeCard('mystic');
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ combatHand: [card] }) }));
    render(<CombatScreen />);
    expect(screen.getByTestId('combat-hand-slot-0')).toBeInTheDocument();
  });

  it('dispatches PLAYER_PLAY_CARD with the card id via the provided callback', () => {
    const card = makeCard('mystic');
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ combatHand: [card] }) }));
    const spy = vi.fn();
    render(<CombatScreen dispatchCombatAction={spy} />);
    fireEvent.click(screen.getByTestId('combat-hand-slot-0'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ type: 'PLAYER_PLAY_CARD', cardId: 'mystic' });
  });

  it('does NOT crash when no dispatcher prop is provided and the store has none wired', () => {
    const card = makeCard('mystic');
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ combatHand: [card] }) }));
    render(<CombatScreen />);
    // Safe no-op click; if this throws, the test fails.
    fireEvent.click(screen.getByTestId('combat-hand-slot-0'));
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
  });

  it('renders each battlefield card forwarded from the store slice', () => {
    const card: BattlefieldCard = {
      cardId: 'water-warrior',
      hp: 2,
      hpMax: 3,
      combatEffectId: 'combat-effect-water',
    };
    useGameStore.setState(makeState({ activeCombat: makeCombatState({ battlefield: [card] }) }));
    render(<CombatScreen />);
    expect(screen.getByTestId('combat-battlefield-card-water-warrior')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CombatScreen — bespoke vital-ember raster HP row (embertide-9o9)
// ---------------------------------------------------------------------------

describe('CombatScreen HP row heart rasters (embertide-9o9)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState({ activeCombat: null }));
  });

  it('renders one heart raster per hpMax slot for each player', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', hp: 3, hpMax: 5 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    // 5 slots = 5 hearts regardless of current hp.
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByTestId(`combat-player-hp-heart-p0-${i}`)).toBeInTheDocument();
    }
    // No 6th slot (hpMax bound is respected).
    expect(screen.queryByTestId('combat-player-hp-heart-p0-5')).toBeNull();
  });

  it('marks hearts as filled for indices below hp and empty otherwise', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', hp: 2, hpMax: 4 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    // Slots 0, 1 → filled (i < hp).
    expect(screen.getByTestId('combat-player-hp-heart-p0-0').getAttribute('data-filled')).toBe(
      'true',
    );
    expect(screen.getByTestId('combat-player-hp-heart-p0-1').getAttribute('data-filled')).toBe(
      'true',
    );
    // Slots 2, 3 → empty.
    expect(screen.getByTestId('combat-player-hp-heart-p0-2').getAttribute('data-filled')).toBe(
      'false',
    );
    expect(screen.getByTestId('combat-player-hp-heart-p0-3').getAttribute('data-filled')).toBe(
      'false',
    );
  });

  it('distinguishes filled vs empty hearts via HeartSocket glyph state', () => {
    // nz8-d designer feedback 2026-04-24: combat HP row now shares the
    // HeartSocket pip glyph with the main-board HPStrip. Filled vs empty
    // is communicated by the ruby gradient on the inner SVG (keyed on
    // data-filled), not by wrapper opacity.
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', hp: 1, hpMax: 3 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    const filled = screen.getByTestId('combat-player-hp-heart-p0-0');
    const empty = screen.getByTestId('combat-player-hp-heart-p0-1');
    const filledSvg = filled.querySelector('svg[data-filled]');
    const emptySvg = empty.querySelector('svg[data-filled]');
    expect(filledSvg?.getAttribute('data-filled')).toBe('true');
    expect(emptySvg?.getAttribute('data-filled')).toBe('false');
  });

  it('exposes accessible label with hp of hpMax on the heart row', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', hp: 4, hpMax: 5 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    const hearts = screen.getByTestId('combat-player-hp-hearts-p0');
    expect(hearts.getAttribute('aria-label')).toBe('hp 4 of 5');
    expect(hearts.getAttribute('role')).toBe('img');
  });

  it('preserves the player name label alongside the heart row', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha', hp: 2, hpMax: 3 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    const playerRow = screen.getByTestId('combat-player-hp-p0');
    expect(playerRow).toHaveTextContent('Alpha');
    expect(screen.getByTestId('combat-player-hp-readout-p0')).toHaveTextContent('2 / 3');
  });

  it('does NOT render the legacy heart emoji (♥) anywhere in the HP row', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', hp: 3, hpMax: 5 })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    const row = screen.getByTestId('combat-player-hp-row');
    expect(row.textContent ?? '').not.toContain('♥');
  });

  it('renders heart rasters for every player (multi-player HP row)', () => {
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({ id: 'p0', hp: 2, hpMax: 3 }),
          makePlayer({ id: 'p1', hp: 3, hpMax: 3 }),
        ],
        activeCombat: makeCombatState(),
      }),
    );
    render(<CombatScreen />);
    // Each player renders their own heart row.
    expect(screen.getByTestId('combat-player-hp-hearts-p0')).toBeInTheDocument();
    expect(screen.getByTestId('combat-player-hp-hearts-p1')).toBeInTheDocument();
    // p1 has all slots filled.
    expect(screen.getByTestId('combat-player-hp-heart-p1-0').getAttribute('data-filled')).toBe(
      'true',
    );
    expect(screen.getByTestId('combat-player-hp-heart-p1-2').getAttribute('data-filled')).toBe(
      'true',
    );
  });
});

// ---------------------------------------------------------------------------
// CombatScreen — per-zone background raster resolution (u-10a, REQ-33 §D1/§D6)
// ---------------------------------------------------------------------------

describe('CombatScreen background raster resolution (u-10a)', () => {
  beforeEach(() => {
    __resetBackgroundWarnings();
    useGameStore.setState(makeState({ activeCombat: null }));
  });

  it('resolves the sylvani WILD raster when currentZone is sylvani (field entry)', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    // pr2 (2026-04-23): field + wild-boss-slot entry resolves to the
    // wild/outer arena; only region-boss-slot pulls the region BG.
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_combat_bg_sylvani_wild_001.webp');
    expect(img.getAttribute('data-zone')).toBe('sylvani');
  });

  it('resolves the emberpeak WILD raster when currentZone is emberpeak (field entry)', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState(),
        currentZone: 'emberpeak',
      }),
    );
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(
      '/illustrations/cathedral_combat_bg_emberpeak_wild_001.webp',
    );
    expect(img.getAttribute('data-zone')).toBe('emberpeak');
  });

  it('resolves the gilded-cage WILD raster when currentZone is gilded-cage (field entry)', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState(),
        currentZone: 'gilded-cage',
      }),
    );
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(
      '/illustrations/cathedral_combat_bg_gilded_cage_wild_001.webp',
    );
    expect(img.getAttribute('data-zone')).toBe('gilded-cage');
  });

  it('resolves the REGION raster only when combat entrySource is region-boss-slot (pr2)', () => {
    const regionCombat = makeCombatState({
      entryContext: {
        bossCardId: 'broodmaw',
        combatEntryTurn: 1,
        attackerPlayerIds: ['p0'],
        engagementSource: 'fightMonster',
        entrySource: 'region-boss-slot',
      },
    });
    useGameStore.setState(makeState({ activeCombat: regionCombat, currentZone: 'sylvani' }));
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_combat_bg_sylvani_001.webp');
  });

  it('swaps the background raster when currentZone advances mid-session (u-10b)', () => {
    // Initial: sylvani wild combat raster (field entry default).
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    const { rerender } = render(<CombatScreen />);
    const initial = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(initial.getAttribute('src')).toBe(
      '/illustrations/cathedral_combat_bg_sylvani_wild_001.webp',
    );
    expect(initial.getAttribute('data-zone')).toBe('sylvani');

    // Simulate region-boss defeat triggering advanceZone — currentZone
    // flips to emberpeak while the CombatScreen is still mounted.
    act(() => {
      useGameStore.setState({
        ...useGameStore.getState(),
        currentZone: 'emberpeak',
      });
    });
    rerender(<CombatScreen />);

    const swapped = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(swapped.getAttribute('src')).toBe(
      '/illustrations/cathedral_combat_bg_emberpeak_wild_001.webp',
    );
    expect(swapped.getAttribute('data-zone')).toBe('emberpeak');
  });

  it('unmounts the ArtPendingFrame ribbon once the raster loads (embertide-y5x)', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    render(<CombatScreen />);

    // Before load: ribbon is present so the wrapper has a visible
    // placeholder while the raster is pending.
    expect(screen.getByTestId('art-pending-frame-combat-bg')).toBeInTheDocument();

    const img = screen.getByTestId('combat-bg-image');
    // Simulate the browser finishing the raster fetch.
    fireEvent.load(img);

    // After load: the amber [v2-art-pending] ribbon is unmounted so it
    // doesn't persist on top of the finalized background art.
    expect(screen.queryByTestId('art-pending-frame-combat-bg')).toBeNull();
    expect(screen.queryByTestId('art-pending-frame-combat-bg-ribbon')).toBeNull();
    // Raster itself stays mounted.
    expect(screen.getByTestId('combat-bg-image')).toBeInTheDocument();
    // data-bg-loaded attr on the root reflects loaded state.
    expect(screen.getByTestId('combat-screen').getAttribute('data-bg-loaded')).toBe('true');
  });

  it('remounts the ArtPendingFrame ribbon when the raster src changes mid-session (zone swap)', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    const { rerender } = render(<CombatScreen />);

    // Load the initial sylvani raster — ribbon disappears.
    const initialImg = screen.getByTestId('combat-bg-image');
    fireEvent.load(initialImg);
    expect(screen.queryByTestId('art-pending-frame-combat-bg')).toBeNull();

    // Zone advance to emberpeak — the effective raster src swaps.
    act(() => {
      useGameStore.setState({
        ...useGameStore.getState(),
        currentZone: 'emberpeak',
      });
    });
    rerender(<CombatScreen />);

    // Ribbon should surface again while the NEW raster is pending.
    expect(screen.getByTestId('art-pending-frame-combat-bg')).toBeInTheDocument();
    expect(screen.getByTestId('combat-screen').getAttribute('data-bg-loaded')).toBe('false');
  });

  it('falls back to ArtPendingFrame when the raster errors (no layout shift)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    render(<CombatScreen />);

    const slot = screen.getByTestId('combat-bg-slot');
    const img = screen.getByTestId('combat-bg-image');
    // ArtPendingFrame is mounted as the always-present fallback peer.
    expect(screen.getByTestId('art-pending-frame-combat-bg')).toBeInTheDocument();

    fireEvent.error(img);

    // After the error: img is removed (hidden), fallback stays mounted.
    expect(screen.queryByTestId('combat-bg-image')).toBeNull();
    expect(screen.getByTestId('art-pending-frame-combat-bg')).toBeInTheDocument();
    // Wrapper slot still present (no layout shift).
    expect(slot).toBeInTheDocument();

    // Warn fires once for this src.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      '/illustrations/cathedral_combat_bg_sylvani_wild_001.webp',
    );

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CombatScreen — per-tier colosseum backdrop resolution (embertide-y3no)
// ---------------------------------------------------------------------------

describe('CombatScreen colosseum backdrop resolution (y3no)', () => {
  beforeEach(() => {
    __resetBackgroundWarnings();
    useGameStore.setState(makeState({ activeCombat: null }));
  });

  it('resolves the tier-1 colosseum raster for a colosseum-slot fight against a tier-1 boss (craghorn)', () => {
    const colosseumCombat = makeCombatState({
      boss: makeBoss({ sourceCardId: 'craghorn' }),
      entryContext: makeEntryContext({
        bossCardId: 'craghorn',
        entrySource: 'colosseum-slot',
      }),
    });
    // currentZone is intentionally any zone — colosseum backdrop must
    // override the per-zone map entirely.
    useGameStore.setState(makeState({ activeCombat: colosseumCombat, currentZone: 'sylvani' }));
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_colosseum_bg_tier1_001.webp');
    expect(img.getAttribute('data-colosseum-tier')).toBe('1');
  });

  it('resolves the tier-2 colosseum raster for a colosseum-slot fight against a tier-2 boss (chimera)', () => {
    const colosseumCombat = makeCombatState({
      boss: makeBoss({ sourceCardId: 'chimera' }),
      entryContext: makeEntryContext({
        bossCardId: 'chimera',
        entrySource: 'colosseum-slot',
      }),
    });
    useGameStore.setState(
      makeState({ activeCombat: colosseumCombat, currentZone: 'emberpeak' }),
    );
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_colosseum_bg_tier2_001.webp');
    expect(img.getAttribute('data-colosseum-tier')).toBe('2');
  });

  it('resolves the tier-5 colosseum raster for a colosseum-slot fight against the capstone (trinity-aurogax)', () => {
    const colosseumCombat = makeCombatState({
      boss: makeBoss({ sourceCardId: 'trinity-aurogax' }),
      entryContext: makeEntryContext({
        bossCardId: 'trinity-aurogax',
        entrySource: 'colosseum-slot',
      }),
    });
    useGameStore.setState(
      makeState({ activeCombat: colosseumCombat, currentZone: 'gilded-cage' }),
    );
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_colosseum_bg_tier5_001.webp');
    expect(img.getAttribute('data-colosseum-tier')).toBe('5');
  });

  it('does NOT set data-colosseum-tier on non-colosseum (zone) combats', () => {
    useGameStore.setState(makeState({ activeCombat: makeCombatState(), currentZone: 'sylvani' }));
    render(<CombatScreen />);
    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('data-colosseum-tier')).toBeNull();
    // Zone backdrop is still in effect (regression guard).
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_combat_bg_sylvani_wild_001.webp');
  });

  // Defensive escape: colosseum-slot fight whose boss isn't in any tier
  // roster (shouldn't happen with valid game state — slotRouter only
  // populates the boss from a tier roster — but guards a hot-fix /
  // save-file forward-compat regression). The fallback uses the zone
  // backdrop and a single-fire console.warn surfaces the bad id.
  it('falls back to the zone raster + warns when colosseum-slot boss is not in any tier roster', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const colosseumCombat = makeCombatState({
      boss: makeBoss({ sourceCardId: 'not-a-colosseum-boss' }),
      entryContext: makeEntryContext({
        bossCardId: 'not-a-colosseum-boss',
        entrySource: 'colosseum-slot',
      }),
    });
    useGameStore.setState(makeState({ activeCombat: colosseumCombat, currentZone: 'sylvani' }));
    render(<CombatScreen />);

    const img = screen.getByTestId('combat-bg-image') as HTMLImageElement;
    expect(img.getAttribute('data-colosseum-tier')).toBeNull();
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_combat_bg_sylvani_wild_001.webp');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('not-a-colosseum-boss');

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// GameBoard mount gate
// ---------------------------------------------------------------------------

describe('GameBoard combat mount gate (u-8f AC #2, #10)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('does NOT mount CombatScreen when state.activeCombat is null', () => {
    useGameStore.setState(makeState({ players: [makePlayer({ id: 'p0', name: 'Alpha' })] }));
    render(<GameBoard />);
    expect(screen.queryByTestId('combat-screen')).toBeNull();
    // Main board still present.
    expect(screen.getByTestId('game-board')).toBeInTheDocument();
    expect(screen.getByTestId('turn-banner')).toBeInTheDocument();
  });

  it('mounts CombatScreen when state.activeCombat is non-null', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<GameBoard />);
    expect(screen.getByTestId('game-board')).toBeInTheDocument();
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
  });

  it('hides main-board surfaces (turn-banner, hand) while combat is active', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0', name: 'Alpha' })],
        activeCombat: makeCombatState(),
      }),
    );
    render(<GameBoard />);
    // Main-board turn banner is suppressed in combat mode (the combat
    // screen replaces the board visually per AC #1 / design guidance).
    expect(screen.queryByTestId('turn-banner')).toBeNull();
    expect(screen.queryByTestId('hand')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CombatScreen — v2.1 combat-layer tutorial wiring (u-8g, PRD §B8)
// ---------------------------------------------------------------------------

describe('CombatScreen tutorial wiring (u-8g)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState({ activeCombat: null }));
  });

  it('fires combat-card-played when combatHand size decreases across a render', () => {
    const a = makeCard('hero-a');
    const b = makeCard('hero-b');
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ combatHand: [a, b] }),
        combatsEntered: 1,
      }),
    );
    const { rerender } = render(<CombatScreen />);
    // Simulate a play: hand shrinks from 2 → 1.
    act(() => {
      useGameStore.setState(
        makeState({
          activeCombat: makeCombatState({ combatHand: [a] }),
          combatsEntered: 1,
        }),
      );
    });
    rerender(<CombatScreen />);
    expect(useGameStore.getState().combatTutorialBubble).toBe('combat-card-played');
  });

  it('does NOT fire combat-boss-turn on activeActor flip during FIRST combat (combatsEntered=1)', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ activeActor: 'players' }),
        combatsEntered: 1,
      }),
    );
    const { rerender } = render(<CombatScreen />);
    act(() => {
      useGameStore.setState(
        makeState({
          activeCombat: makeCombatState({ activeActor: 'boss' }),
          combatsEntered: 1,
        }),
      );
    });
    rerender(<CombatScreen />);
    // Progressive disclosure: boss-turn bubble suppressed on first combat.
    expect(useGameStore.getState().combatTutorialBubble).toBeNull();
  });

  it('fires combat-boss-turn on activeActor flip during SECOND combat (combatsEntered=2)', () => {
    useGameStore.setState(
      makeState({
        activeCombat: makeCombatState({ activeActor: 'players' }),
        combatsEntered: 2,
      }),
    );
    const { rerender } = render(<CombatScreen />);
    act(() => {
      useGameStore.setState(
        makeState({
          activeCombat: makeCombatState({ activeActor: 'boss' }),
          combatsEntered: 2,
        }),
      );
    });
    rerender(<CombatScreen />);
    expect(useGameStore.getState().combatTutorialBubble).toBe('combat-boss-turn');
  });
});

// ---------------------------------------------------------------------------
// Store-side combat tutorial bubble wiring (u-8g)
// ---------------------------------------------------------------------------

describe('dispatchCombat tutorial bubble firing (u-8g)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('COMBAT_ENTER bumps combatsEntered and fires combat-entry', () => {
    const initial = useGameStore.getState().combatsEntered;
    useGameStore.getState().dispatchCombat({
      type: 'COMBAT_ENTER',
      context: makeEntryContext(),
      boss: makeBoss(),
      combatDeck: [],
    });
    const afterFirst = useGameStore.getState();
    expect(afterFirst.combatsEntered).toBe(initial + 1);
    expect(afterFirst.combatTutorialBubble).toBe('combat-entry');
  });

  it('combatsEntered persists across combats (u-8g AC #6)', () => {
    useGameStore.setState(
      makeState({ players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })] }),
    );
    const store = useGameStore.getState();
    store.dispatchCombat({
      type: 'COMBAT_ENTER',
      context: makeEntryContext(),
      boss: makeBoss(),
      combatDeck: [],
    });
    expect(useGameStore.getState().combatsEntered).toBe(1);
    // Clear combat so the second dispatch is a fresh entry.
    useGameStore.setState({ ...useGameStore.getState(), activeCombat: null });
    useGameStore.getState().dispatchCombat({
      type: 'COMBAT_ENTER',
      context: makeEntryContext(),
      boss: makeBoss(),
      combatDeck: [],
    });
    expect(useGameStore.getState().combatsEntered).toBe(2);
  });

  it('COMBAT_RESOLVE_WIN fires combat-win (u-8g AC #4)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
        activeCombat: makeCombatState(),
        combatsEntered: 1,
      }),
    );
    useGameStore.getState().dispatchCombat({
      type: 'COMBAT_RESOLVE_WIN',
      heartsToAttackers: {},
      wispDropTarget: null,
      shardGrants: [],
      zoneAdvance: false,
      bossKey: null,
    });
    expect(useGameStore.getState().combatTutorialBubble).toBe('combat-win');
  });

  it('COMBAT_RESOLVE_LOSS fires combat-loss when outcome !== "loss" (u-8g AC #5)', () => {
    useGameStore.setState(
      makeState({
        players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
        activeCombat: makeCombatState(),
        combatsEntered: 1,
        outcome: null,
      }),
    );
    useGameStore.getState().dispatchCombat({ type: 'COMBAT_RESOLVE_LOSS' });
    const s = useGameStore.getState();
    // The combat-loss bubble is only suppressed when the team outcome
    // flipped to 'loss' during this dispatch. With non-downed players,
    // the outcome stays null and the bubble surfaces.
    expect(s.outcome).toBeNull();
    expect(s.combatTutorialBubble).toBe('combat-loss');
  });

  it('COMBAT_RESOLVE_LOSS does NOT fire combat-loss when the team outcome flipped to loss (u-8g AC #5)', () => {
    // Both players already downed + both already revived + no wisp
    // → checkCoopLoss flips outcome to 'loss' at resolve time.
    useGameStore.setState(
      makeState({
        players: [
          makePlayer({ id: 'p0', hp: 0, downed: true, revivedThisIncident: true }),
          makePlayer({ id: 'p1', hp: 0, downed: true, revivedThisIncident: true }),
        ],
        activeCombat: makeCombatState(),
        combatsEntered: 1,
        outcome: null,
      }),
    );
    useGameStore.getState().dispatchCombat({ type: 'COMBAT_RESOLVE_LOSS' });
    const s = useGameStore.getState();
    expect(s.outcome).toBe('loss');
    expect(s.combatTutorialBubble).toBeNull();
  });

  it('clearCombatTutorialBubble dismisses the overlay back to null', () => {
    useGameStore.setState(
      makeState({
        activeCombat: null,
        combatTutorialBubble: 'combat-win',
      }),
    );
    useGameStore.getState().clearCombatTutorialBubble();
    expect(useGameStore.getState().combatTutorialBubble).toBeNull();
  });

  it('clearCombatTutorialBubble is idempotent when already null', () => {
    useGameStore.setState(makeState({ combatTutorialBubble: null }));
    useGameStore.getState().clearCombatTutorialBubble();
    expect(useGameStore.getState().combatTutorialBubble).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CombatTutorialBubble overlay (u-8g)
// ---------------------------------------------------------------------------

describe('CombatTutorialBubble overlay (u-8g)', () => {
  beforeEach(() => {
    useGameStore.setState(makeState());
  });

  it('renders the overlay when store.combatTutorialBubble is non-null', async () => {
    const CombatTutorialBubble = (await import('./CombatTutorialBubble')).default;
    useGameStore.setState(makeState({ combatTutorialBubble: 'combat-entry' }));
    render(<CombatTutorialBubble />);
    const overlay = screen.getByTestId('combat-tutorial-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.getAttribute('data-bubble-id')).toBe('combat-entry');
  });

  it('returns null when store.combatTutorialBubble is null', async () => {
    const CombatTutorialBubble = (await import('./CombatTutorialBubble')).default;
    useGameStore.setState(makeState({ combatTutorialBubble: null }));
    const { container } = render(<CombatTutorialBubble />);
    expect(container.firstChild).toBeNull();
  });

  it('dismiss button clears the overlay via clearCombatTutorialBubble', async () => {
    const CombatTutorialBubble = (await import('./CombatTutorialBubble')).default;
    useGameStore.setState(makeState({ combatTutorialBubble: 'combat-win' }));
    render(<CombatTutorialBubble />);
    fireEvent.click(screen.getByTestId('combat-tutorial-dismiss'));
    expect(useGameStore.getState().combatTutorialBubble).toBeNull();
  });
});
