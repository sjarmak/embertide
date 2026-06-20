import { useState } from 'react';
import type { JSX } from 'react';
import { KID_CHAMPIONS, type KidChampion } from '../data/champions';
import { illustrationForChampion } from './CardArt';
import { tokenizeResourceText } from './effectText';
import type { GameConfig } from './GameConfig';

/**
 * Setup screen (MH-7 / embertide-57p).
 *
 * Players choose how many are playing (1–4), whether a solo player faces a
 * bot, and pick one Champion per seat from the four Kid Mode Champions
 * (Courage / Wisdom / Power / Sword). Champions replace the legacy Home
 * Regions.
 *
 * Draft-style picker (embertide-ajb): ONE shared row of 4 full-portrait
 * champion tiles. A player-pill strip above the row shows each seat, with
 * a live preview of that seat's current pick. Clicking a pill activates
 * that seat; clicking a champion assigns it to the active seat and auto-
 * advances to the next unfilled seat. Tiles carry per-seat badges showing
 * which players have claimed them (duplicates are allowed). Replaces the
 * earlier per-seat repeated-row layout (embertide-edv) that didn't
 * scale visually past 2 players.
 *
 * Per-seat isolation, champion defaults, and the GameConfig contract are
 * unchanged — only the presentation layer is reshaped.
 */

type PlayerCount = 1 | 2 | 3 | 4;

const PLAYER_COUNTS: readonly PlayerCount[] = [1, 2, 3, 4];

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

/**
 * embertide-5qql polish: champion-tile portrait scaled ~1.5× from the
 * jrw baseline (140) to land at a kid-friendly tap-target while still
 * leaving room for 4 tiles + gaps + padding inside the 1280×800 viewport
 * budget. See `.setup-champion-tile` width math in src/styles/app.css.
 *
 * zd3z (2026-04-25): reduced from 210 → 168 alongside dropping the
 * `-large` tile class so the champion row sits comfortably below the
 * regenerated rose-window background without occluding the Embertide.
 *
 * embertide-bkf2 (2026-04-26): bumped to 220 to fill the new 256×320
 * grid tile so the kid sees a properly large champion portrait once the
 * left rail moves the seat strip out of the centerline.
 */
const CHAMPION_ART_SIZE = 220;

interface SetupProps {
  onStart: (config: GameConfig) => void;
}

function buildDefaultPicks(existing: readonly string[], players: PlayerCount): string[] {
  const next: string[] = [];
  for (let seat = 0; seat < players; seat += 1) {
    if (seat < existing.length) {
      next.push(existing[seat]);
      continue;
    }
    const claimed = new Set(next);
    const firstUnpicked = KID_CHAMPIONS.find((c) => !claimed.has(c.id));
    next.push(firstUnpicked?.id ?? KID_CHAMPIONS[seat % KID_CHAMPIONS.length].id);
  }
  return next;
}

/**
 * d8vc (2026-04-25): rebuild the botSeats array when player count
 * changes. Preserves any existing per-seat bot picks for seats that
 * still exist; new seats default to human (false).
 */
function buildDefaultBotSeats(existing: readonly boolean[], players: PlayerCount): boolean[] {
  const next: boolean[] = [];
  for (let seat = 0; seat < players; seat += 1) {
    next.push(seat < existing.length ? existing[seat] : false);
  }
  return next;
}

function championName(id: string): string {
  return KID_CHAMPIONS.find((c) => c.id === id)?.displayName ?? '—';
}

export default function Setup({ onStart }: SetupProps) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [championIds, setChampionIds] = useState<readonly string[]>(() => buildDefaultPicks([], 2));
  // d8vc (2026-04-25): per-seat human/bot picker replaces the legacy
  // solo-vs-bot pill. Length tracks playerCount and defaults to all
  // human (false × playerCount).
  const [botSeats, setBotSeats] = useState<readonly boolean[]>(() => buildDefaultBotSeats([], 2));
  const [activeSeat, setActiveSeat] = useState<number>(0);

  const handleStart = () => {
    onStart({
      players: playerCount,
      botSeats: [...botSeats],
      championIds: [...championIds],
    });
  };

  const handlePlayerCount = (n: PlayerCount) => {
    setPlayerCount(n);
    setChampionIds((prev) => buildDefaultPicks(prev, n));
    setBotSeats((prev) => buildDefaultBotSeats(prev, n));
    setActiveSeat((s) => (s >= n ? 0 : s));
  };

  const toggleBotForSeat = (seat: number) => {
    setBotSeats((prev) => {
      const next = prev.slice();
      next[seat] = !next[seat];
      return next;
    });
  };

  const pickForActiveSeat = (id: string) => {
    setChampionIds((prev) => {
      if (prev[activeSeat] === id) return prev;
      const next = prev.slice();
      next[activeSeat] = id;
      return next;
    });
    setActiveSeat((s) => (playerCount > 1 ? (s + 1) % playerCount : s));
  };

  return (
    <div data-testid="setup-root" className="setup-root setup-root-cathedral">
      {/*
        embertide-bkf2 (2026-04-26): cathedral title-strip chrome
        applied as an overlay at the top of the existing v6
        `cathedral_setup_landing_001.webp` background. The painterly
        rose-window stays unchanged; the strip layers on top for visual
        cohesion with the in-game cathedral title-strip (embertide
        memos: setup-redesign.md §What's ratified item 3).
      */}
      <header className="setup-title-strip" aria-label="setup-title">
        Choose Your Champions
      </header>
      <div className="setup-body">
        <aside className="setup-rail" aria-label="setup-controls">
          <section aria-label="player-count" className="setup-section">
            <h2 className="setup-section-title">Players</h2>
            <div className="setup-count-row">
              {PLAYER_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="setup-count-button"
                  data-variant="gem"
                  aria-pressed={playerCount === n}
                  data-touch-target="true"
                  style={TOUCH_TARGET_STYLE}
                  onClick={() => handlePlayerCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          <section aria-label="seats" className="setup-section">
            <h2 className="setup-section-title">Seats</h2>

            <div
              className="setup-player-strip"
              role="radiogroup"
              aria-label="active-player-seat"
              data-has-selection="true"
            >
              {Array.from({ length: playerCount }, (_, seat) => {
                const isBot = botSeats[seat] ?? false;
                return (
                  <div key={seat} className="setup-player-pill-group">
                    <button
                      type="button"
                      className="setup-player-pill"
                      data-seat={seat}
                      data-seat-active={activeSeat === seat}
                      role="radio"
                      aria-checked={activeSeat === seat}
                      data-touch-target="true"
                      style={TOUCH_TARGET_STYLE}
                      onClick={() => setActiveSeat(seat)}
                    >
                      <span className="setup-player-pill-label">{`Player ${seat + 1}`}</span>
                      <span className="setup-player-pill-pick">
                        {championName(championIds[seat])}
                      </span>
                    </button>
                    {/* embertide-oovz (2026-04-26) + post-ship
                        feedback: the dual Human/Bot label pattern read
                        as redundant — the switch position alone carries
                        the binary state. Single 'Bot' label now sits
                        INSIDE the track (left side), revealed when the
                        knob slides right into the ON position. Switch
                        button still carries role='switch' + aria-checked
                        for a11y; aria-label disambiguates per seat. */}
                    <div
                      className="setup-bot-toggle"
                      data-testid={`setup-player-bot-toggle-${seat}`}
                    >
                      <button
                        type="button"
                        className="setup-bot-toggle-track"
                        role="switch"
                        aria-checked={isBot}
                        aria-label={`Player ${seat + 1} controller`}
                        data-state={isBot ? 'bot' : 'human'}
                        data-touch-target="true"
                        onClick={() => toggleBotForSeat(seat)}
                      >
                        <span className="setup-bot-toggle-label" data-active={isBot}>
                          Bot
                        </span>
                        <span className="setup-bot-toggle-knob" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="setup-main" aria-label="champions">
          <h2 className="setup-section-title setup-section-title-main">Champion</h2>
          <div className="setup-champion-row" data-has-selection="true">
            {KID_CHAMPIONS.map((champion) => {
              const pickedSeats = championIds
                .map((id, seat) => (id === champion.id ? seat : -1))
                .filter((s) => s >= 0);
              return (
                <SetupChampionTile
                  key={champion.id}
                  champion={champion}
                  selected={championIds[activeSeat] === champion.id}
                  pickedSeats={pickedSeats}
                  onPick={pickForActiveSeat}
                />
              );
            })}
          </div>
        </main>
      </div>

      <button
        type="button"
        className="setup-start-button"
        data-testid="start-button"
        data-touch-target="true"
        style={TOUCH_TARGET_STYLE}
        onClick={handleStart}
      >
        Start
      </button>
    </div>
  );
}

interface SetupChampionTileProps {
  readonly champion: KidChampion;
  readonly selected: boolean;
  readonly pickedSeats: readonly number[];
  readonly onPick: (id: string) => void;
}

/**
 * Corner medallion — small Embertide-style emblem placed at each tile corner.
 * Decorative only; aria-hidden on the parent container. Uses --hc-lead-gold-*
 * tokens so the medallion reads as the same gold leading as the tile stroke.
 */
function CornerMedallion(): JSX.Element {
  return (
    <svg
      className="setup-champion-medallion-svg"
      viewBox="0 0 12 12"
      width={12}
      height={12}
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="6,1 11,10 1,10"
        fill="var(--hc-lead-gold-500, #b89142)"
        stroke="var(--hc-lead-gold-900, #5a3f10)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <polygon
        points="6,1 8.5,5.5 3.5,5.5"
        fill="var(--hc-jewel-amber-100, #f6e7bc)"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Seat-badge chip — small CostGem-style stained-glass chip (24px) layered at
 * the tile corner to indicate which seats picked this champion. The seat
 * number is encoded as a `<title>` (assistive-tech) and the `data-seat-badge`
 * attribute (test selector); no visible glyph text (brief: "no number").
 */
function SetupSeatBadgeChip({ seat }: { readonly seat: number }): JSX.Element {
  return (
    <svg
      className="setup-champion-badge-svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`setup-badge-fill-${seat}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hc-jewel-amber-100, #f6e7bc)" />
          <stop offset="60%" stopColor="var(--hc-lead-gold-500, #b89142)" />
          <stop offset="100%" stopColor="var(--hc-lead-gold-700, #8b6a2a)" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={`url(#setup-badge-fill-${seat})`}
        stroke="var(--hc-lead-gold-900, #5a3f10)"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="12"
        r="5"
        fill="var(--hc-parchment-50, #fbf6e9)"
        stroke="var(--hc-lead-gold-700, #8b6a2a)"
        strokeWidth="1"
      />
      <circle cx="9.4" cy="9.4" r="1.6" fill="var(--hc-jewel-amber-100, #f6e7bc)" opacity="0.7" />
    </svg>
  );
}

function SetupChampionTile({ champion, selected, pickedSeats, onPick }: SetupChampionTileProps) {
  const illustration = illustrationForChampion(champion.id, CHAMPION_ART_SIZE);
  // embertide-w95e follow-up (2026-04-26): "claimed" = any seat
  // currently has this champion picked. Claimed tiles render lit
  // (full color + jewel saturation); unclaimed tiles desaturate to
  // the in-game "unavailable card" treatment so the kid sees at a
  // glance which champions are taken across all seats — not just the
  // active picker's seat. The active seat's claim still gets the
  // gold-pulse shimmer via aria-pressed='true' on top of being lit.
  const claimed = pickedSeats.length > 0;
  return (
    <button
      type="button"
      className="setup-champion-tile"
      data-champion-id={champion.id}
      data-touch-target="true"
      data-picked-seats={pickedSeats.join(',')}
      data-selected={selected ? 'true' : 'false'}
      data-claimed={claimed ? 'true' : 'false'}
      aria-pressed={selected}
      aria-label={`${champion.displayName}. ${champion.passiveDescription}`}
      style={TOUCH_TARGET_STYLE}
      onClick={() => onPick(champion.id)}
    >
      <span className="setup-champion-medallions" aria-hidden="true">
        <span className="setup-champion-medallion" data-corner="tl">
          <CornerMedallion />
        </span>
        <span className="setup-champion-medallion" data-corner="tr">
          <CornerMedallion />
        </span>
        <span className="setup-champion-medallion" data-corner="bl">
          <CornerMedallion />
        </span>
        <span className="setup-champion-medallion" data-corner="br">
          <CornerMedallion />
        </span>
      </span>
      <span className="setup-champion-art">
        {illustration}
        <span className="setup-champion-shimmer" aria-hidden="true" />
      </span>
      <span className="setup-champion-plate" aria-hidden="true">
        <span className="setup-champion-name">{champion.displayName}</span>
        <span className="setup-champion-passive">
          {tokenizeResourceText(champion.passiveDescription)}
        </span>
      </span>
      {pickedSeats.length > 0 && (
        <span className="setup-champion-badges" aria-hidden="true">
          {pickedSeats.map((seat) => (
            <span key={seat} className="setup-champion-badge" data-seat-badge={seat}>
              <SetupSeatBadgeChip seat={seat} />
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
