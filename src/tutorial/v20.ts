/**
 * v2.0 co-op tutorial content module (u-4, REQ-24 abbreviated,
 * amendment A9).
 *
 * Declares the six v2.0 tutorial bubbles in a pure data-first form so
 * the UI surface (`src/ui/Tutorial.tsx`) can stay a thin renderer. The
 * module also carries:
 *
 *   - progressive-disclosure gating: bubbles 1-3 ship in game 1
 *     ("co-op survival"), 4-5 in game 2 ("shards + zones"), 6 in game 3
 *     ("Vurmox / Climax"). Derived from REQ-24 premortem edit that forbids
 *     the dump-everything-at-once baseline.
 *
 *   - per-bubble dwell-time instrumentation: `createDwellTracker()`
 *     returns a small object with `markShown(bubbleId)` /
 *     `markDismissed(bubbleId)` and a `medianDwellMs()` helper. Kid-UX
 *     gate preserved per amendment A11 (median dwell < 3s triggers a
 *     re-design; the gate is asserted in tests via a scripted fixture
 *     rather than live kid data).
 *
 * Trigger-based wiring (bubble 2 on first-downed, bubble 3 on first
 * wisp-acquired, bubble 5 on first region-boss-defeat, bubble 6 on
 * Climax phase entry) is defined as a `trigger` field on each bubble.
 * Tutorial.tsx falls back to a deterministic turn-based schedule when
 * the real trigger has not fired — the turn numbers live alongside the
 * trigger so the UI can pick whichever fires first.
 */

/**
 * Bubble identifiers. Stable across v2.0 sessions; persisted in the
 * tutorial store so already-seen bubbles don't re-fire on later games.
 *
 *  - 'hp-downed':            HP + downed state visualization
 *  - 'revive-prompt':        first-downed teammate-revive prompt
 *  - 'wisp-on-downed':      first wisp acquired → revive-to-full prompt
 *  - 'shared-shards':        3-shard shared-pool explanation
 *  - 'zone-advance':         zone-advance banner context (first region-boss)
 *  - 'vurmox-climax':         Vurmox / Climax-phase context
 *  - 'combat-entry':         mounted when combat begins (v2.1 combat layer)
 *  - 'combat-card-played':   fires after a card is played in combat
 *  - 'combat-boss-turn':     surfaces on SECOND+ combat only (progressive
 *                            disclosure — boss-turn telegraph)
 *  - 'combat-win':           fires on COMBAT_RESOLVE_WIN
 *  - 'combat-loss':          fires on COMBAT_RESOLVE_LOSS when the team
 *                            outcome is not yet 'loss'
 */
export type TutorialBubbleId =
  | 'hp-downed'
  | 'revive-prompt'
  | 'wisp-on-downed'
  | 'shared-shards'
  | 'zone-advance'
  | 'vurmox-climax'
  | 'combat-entry'
  | 'combat-card-played'
  | 'combat-boss-turn'
  | 'combat-win'
  | 'combat-loss'
  // REQ-32 (u-9e) — Wild / Region Boss Encounter Slot bubbles. Event-
  // triggered main-board overlays; each fires AT MOST ONCE per run.
  | 'wild-boss-slot-revealed'
  | 'region-boss-slot-revealed'
  | 'heirloom-drop'
  | 'destiny-slot-revealed';

/**
 * Which of the first three games the bubble surfaces in. Progressive
 * disclosure is REQ-24's v2.0 anchor (preserved through premortem L9).
 */
export type TutorialGameNumber = 1 | 2 | 3;

/**
 * Event trigger that should surface the bubble when observed. UI layer
 * can observe the trigger and mark the bubble active; if the trigger
 * hasn't fired, the fallback-turn schedule below still makes the bubble
 * available so games without the exact event still see the content.
 */
export type TutorialTrigger =
  | 'game-start'
  | 'first-downed'
  | 'first-wisp-acquired'
  | 'embertide-strip-mounted'
  | 'first-region-boss-defeated'
  | 'climax-phase-entered'
  | 'combat-entry'
  | 'combat-card-played'
  | 'combat-boss-turn'
  | 'combat-win'
  | 'combat-loss'
  // REQ-32 (u-9e) — slot reveal + heirloom drop triggers.
  | 'wild-boss-slot-revealed'
  | 'region-boss-slot-revealed'
  | 'heirloom-drop'
  | 'destiny-slot-revealed';

export interface TutorialBubble {
  readonly id: TutorialBubbleId;
  readonly game: TutorialGameNumber;
  readonly title: string;
  readonly body: string;
  readonly trigger: TutorialTrigger;
  /**
   * Deterministic fallback turn for UI layers that haven't wired the
   * trigger yet. Per-bubble — matches the progressive-disclosure arc
   * (early bubbles surface early). Turn-1 fallbacks surface at game
   * start; later fallbacks line up with the earliest plausible turn the
   * event would fire.
   */
  readonly fallbackTurn: number;
}

/**
 * The six v2.0 tutorial bubbles. Order here is authoritative — the
 * test suite asserts the exact set of ids and the game-gating per the
 * REQ-24 premortem arc.
 */
export const V20_TUTORIAL_BUBBLES: readonly TutorialBubble[] = [
  // Game 1 — co-op survival.
  {
    id: 'hp-downed',
    game: 1,
    title: 'Hearts & Downed',
    body: 'Your hearts show your HP. If they hit zero, you go DOWNED — still in the game, but waiting for help.',
    trigger: 'game-start',
    fallbackTurn: 1,
  },
  {
    id: 'revive-prompt',
    game: 1,
    title: 'Help your teammate!',
    body: 'When your teammate is downed, tap REVIVE on their row to bring them back to 1 HP. Only one revive per downed incident — spend it wisely.',
    trigger: 'first-downed',
    fallbackTurn: 3,
  },
  {
    id: 'wisp-on-downed',
    game: 1,
    title: 'Fairies bring full rescue',
    body: 'A wisp in your Items row revives a downed teammate to FULL hearts. Fairies drop from wild-boss kills and chests — save them for emergencies.',
    trigger: 'first-wisp-acquired',
    fallbackTurn: 5,
  },
  // Game 2 — shards + zones.
  {
    id: 'shared-shards',
    game: 2,
    title: 'Three shards, one goal',
    body: 'Win together by collecting all three Embertide shards. Wisdom (free the Princess), Courage (explore the full map), Power (defeat the Demon King).',
    trigger: 'embertide-strip-mounted',
    fallbackTurn: 1,
  },
  {
    id: 'zone-advance',
    game: 2,
    title: 'The map opens up',
    body: "Defeat a zone's region boss to advance to the next zone. Clearing all three zones unlocks the Courage shard.",
    trigger: 'first-region-boss-defeated',
    fallbackTurn: 4,
  },
  // Game 3 — Vurmox / Climax.
  {
    id: 'vurmox-climax',
    game: 3,
    title: 'The Demon King arrives',
    body: 'At turn 9, the Climax phase begins. The Demon King pins to the Gilded Cage — defeat him together to win the Power shard.',
    trigger: 'climax-phase-entered',
    fallbackTurn: 9,
  },
  // v2.1 combat layer (u-8g, PRD §B8). These five bubbles are event-
  // triggered in-combat — the `fallbackTurn` of 999 is a sentinel that
  // keeps the existing turn-based Tutorial.tsx from ever firing them on
  // the main-board schedule. Combat bubbles surface exclusively via the
  // CombatScreen's event-trigger wiring (see `pickCombatBubble`).
  //
  // Templating (embertide-07h): three bubbles carry `{bossName}` /
  // `{damage}` / `{hearts}` placeholders that the store substitutes at
  // fire time via `renderBubbleTemplate`, using the active boss card
  // and attack pattern. The two remaining bubbles (card-played, loss)
  // stay generic — their fire-point callers don't carry the runtime
  // data (damage-dealt / downed-player) that would make a template
  // land, and adding plumbing for them was out of scope for 07h.
  {
    id: 'combat-entry',
    game: 1,
    title: 'Boss fight!',
    body: 'You engaged {bossName}! Play cards from your combat deck to fight.',
    trigger: 'combat-entry',
    fallbackTurn: 999,
  },
  {
    id: 'combat-card-played',
    game: 1,
    title: 'Nice hit!',
    body: 'Nice! You dealt damage to the boss.',
    trigger: 'combat-card-played',
    fallbackTurn: 999,
  },
  {
    id: 'combat-boss-turn',
    game: 1,
    title: 'The boss strikes back',
    body: '{bossName} attacks for {damage}! Your heroes up front absorb damage first, then the rest spills to your hearts.',
    trigger: 'combat-boss-turn',
    fallbackTurn: 999,
  },
  {
    id: 'combat-win',
    game: 1,
    title: 'Boss down!',
    body: '{bossName} is defeated! You earned {hearts} hearts for your team.',
    trigger: 'combat-win',
    fallbackTurn: 999,
  },
  {
    id: 'combat-loss',
    game: 1,
    title: 'You went down',
    body: 'You went down. Heroes can still revive you.',
    trigger: 'combat-loss',
    fallbackTurn: 999,
  },
  // REQ-32 (u-9e) — main-board slot tutorials. Event-triggered overlays
  // that fire at most once per run. The heirloom-drop body is a template
  // — the store renders `{itemName}` via `tutorialBubbleBodyOverride` at
  // fire time so the displayed string carries the actual heirloom name.
  {
    id: 'wild-boss-slot-revealed',
    game: 1,
    title: 'Mini boss!',
    body: "This is the zone's mini boss. Fighting it is optional, but defeating it drops powerful heirloom items that help you against the region boss.",
    trigger: 'wild-boss-slot-revealed',
    fallbackTurn: 999,
  },
  {
    id: 'region-boss-slot-revealed',
    game: 1,
    title: 'Region boss!',
    body: "The region boss guards the path to the next zone. You can fight it any time — but it's hard. Build up your deck first.",
    trigger: 'region-boss-slot-revealed',
    fallbackTurn: 999,
  },
  {
    id: 'heirloom-drop',
    game: 1,
    title: 'Heirloom acquired',
    body: "You got the {itemName}! It's now in your hero's deck — it'll show up in future combats.",
    trigger: 'heirloom-drop',
    fallbackTurn: 999,
  },
  {
    id: 'destiny-slot-revealed',
    game: 1,
    title: 'Destiny awaits',
    body: "This is your final fight. When you're ready, tap to face the Demon King.",
    trigger: 'destiny-slot-revealed',
    fallbackTurn: 999,
  },
];

/**
 * Ids of the combat-specific bubbles (u-8g). Exposed as a stable
 * constant so test suites + UI glue can assert membership without
 * re-deriving from V20_TUTORIAL_BUBBLES.
 */
export const COMBAT_TUTORIAL_BUBBLE_IDS: readonly TutorialBubbleId[] = [
  'combat-entry',
  'combat-card-played',
  'combat-boss-turn',
  'combat-win',
  'combat-loss',
];

/**
 * Ids of the REQ-32 (u-9e) main-board slot tutorials. Event-triggered
 * overlays — they fire AT MOST ONCE per run via `fireTutorialBubbleOnce`
 * in the game store and must be excluded from the turn-scheduled set
 * surfaced by `getBubblesForGame`.
 */
export const SLOT_TUTORIAL_BUBBLE_IDS: readonly TutorialBubbleId[] = [
  'wild-boss-slot-revealed',
  'region-boss-slot-revealed',
  'heirloom-drop',
  'destiny-slot-revealed',
];

/**
 * Union of every event-triggered bubble id. Used by `getBubblesForGame`
 * to exclude both combat + slot bubbles from the turn-based schedule.
 */
export const EVENT_TRIGGERED_BUBBLE_IDS: readonly TutorialBubbleId[] = [
  ...COMBAT_TUTORIAL_BUBBLE_IDS,
  ...SLOT_TUTORIAL_BUBBLE_IDS,
];

/**
 * Resolve which combat bubble id (if any) should surface in response to
 * a combat-layer trigger, given the total number of combats the player
 * has already entered this game (including the current one — bumped at
 * COMBAT_ENTER dispatch in `gameStore.dispatchCombat`).
 *
 * Progressive-disclosure rules (PRD §B8):
 *  - First combat (combatsEntered === 1): surfaces `combat-entry` +
 *    `combat-card-played` + `combat-win` / `combat-loss` only.
 *    `combat-boss-turn` is SUPPRESSED.
 *  - Second+ combat (combatsEntered >= 2): all five bubbles surface.
 *
 * Returns `null` when the trigger should be suppressed.
 */
export function pickCombatBubble(
  trigger: TutorialTrigger,
  combatsEntered: number,
): TutorialBubbleId | null {
  switch (trigger) {
    case 'combat-entry':
      return 'combat-entry';
    case 'combat-card-played':
      return 'combat-card-played';
    case 'combat-boss-turn':
      return combatsEntered >= 2 ? 'combat-boss-turn' : null;
    case 'combat-win':
      return 'combat-win';
    case 'combat-loss':
      return 'combat-loss';
    default:
      // Non-combat triggers have no combat-bubble answer.
      return null;
  }
}

/**
 * Return the TURN-SCHEDULED bubbles for a given game number. Combat
 * bubbles (u-8g) are declared on game=1 but are event-triggered only —
 * they are excluded here so the turn-based `Tutorial.tsx` schedule
 * stays unchanged. Each non-combat bubble appears in exactly one game
 * (progressive-disclosure invariant).
 *
 *  - Game 1 → ['hp-downed', 'revive-prompt', 'wisp-on-downed']
 *  - Game 2 → ['shared-shards', 'zone-advance']
 *  - Game 3 → ['vurmox-climax']
 *
 * Input is clamped via the type system (TutorialGameNumber = 1|2|3).
 */
export function getBubblesForGame(gameNumber: TutorialGameNumber): readonly TutorialBubble[] {
  return V20_TUTORIAL_BUBBLES.filter(
    (b) => b.game === gameNumber && !EVENT_TRIGGERED_BUBBLE_IDS.includes(b.id),
  );
}

/**
 * Look up a bubble by id. Returns undefined for unknown ids — callers
 * that know the set statically should prefer destructuring by id over
 * this helper.
 */
export function getBubbleById(id: TutorialBubbleId): TutorialBubble | undefined {
  return V20_TUTORIAL_BUBBLES.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Dwell-time instrumentation (REQ-24 kid-UX gate, amendment A9/A11).
// ---------------------------------------------------------------------------

export interface DwellEntry {
  readonly bubbleId: TutorialBubbleId;
  readonly shownAt: number;
  readonly dismissedAt: number | null;
  /** dwell duration in ms; null while the bubble is still shown. */
  readonly dwellMs: number | null;
}

export interface DwellTracker {
  markShown(bubbleId: TutorialBubbleId, now?: number): void;
  markDismissed(bubbleId: TutorialBubbleId, now?: number): void;
  entries(): readonly DwellEntry[];
  medianDwellMs(): number | null;
  reset(): void;
}

/**
 * Create a fresh dwell tracker. Internally stores entries in the order
 * they were shown; `markShown` with a repeat id starts a fresh entry
 * (dismiss count tracks every view, not every unique bubble).
 *
 * Time source: pass `now` explicitly in tests so the tracker is fully
 * deterministic. The default `Date.now()` reader is used when `now` is
 * omitted in production.
 */
export function createDwellTracker(): DwellTracker {
  const log: DwellEntry[] = [];

  const timeOr = (now: number | undefined): number => (typeof now === 'number' ? now : Date.now());

  return {
    markShown(bubbleId, now) {
      log.push({
        bubbleId,
        shownAt: timeOr(now),
        dismissedAt: null,
        dwellMs: null,
      });
    },
    markDismissed(bubbleId, now) {
      const t = timeOr(now);
      // Walk backwards to find the most recent still-open entry for this
      // bubble — `markShown` for the same id may fire more than once
      // across games, but we only close the latest open view.
      for (let i = log.length - 1; i >= 0; i -= 1) {
        const e = log[i];
        if (e.bubbleId === bubbleId && e.dismissedAt === null) {
          log[i] = {
            ...e,
            dismissedAt: t,
            dwellMs: t - e.shownAt,
          };
          return;
        }
      }
    },
    entries() {
      return log.slice();
    },
    medianDwellMs() {
      const closed = log
        .filter((e): e is DwellEntry & { dwellMs: number } => e.dwellMs !== null)
        .map((e) => e.dwellMs)
        .slice()
        .sort((a, b) => a - b);
      if (closed.length === 0) return null;
      const mid = Math.floor(closed.length / 2);
      if (closed.length % 2 === 1) return closed[mid];
      return (closed[mid - 1] + closed[mid]) / 2;
    },
    reset() {
      log.length = 0;
    },
  };
}

/**
 * Kid-UX gate threshold (amendment A11, preserved per REQ-24). Median
 * per-bubble dwell time below this value triggers a tutorial re-design
 * review. Not enforced at runtime — the test suite asserts a scripted
 * fixture clears this bar so a regression during copy tweaks can't
 * silently ship a too-fast tutorial.
 */
export const MIN_MEDIAN_DWELL_MS = 3000;

// ---------------------------------------------------------------------------
// Runtime template substitution (embertide-07h).
// ---------------------------------------------------------------------------

/**
 * Substitute `{key}` tokens in a bubble body with values from `vars`.
 * Unknown tokens are left verbatim so an authoring typo or a missing
 * runtime var is visible to playtesters rather than silently dropping
 * context. Values are coerced to strings via String() so callers can
 * pass numbers directly (e.g. `{damage}` → 3).
 *
 * Accepts the raw string form used by TutorialBubble.body — keeps the
 * helper free of any TutorialBubble type coupling so the same function
 * can render the heirloom-drop body (which also uses `{itemName}`).
 *
 * English-only by design — kid mode ships in a single locale per §B8.
 */
export function renderBubbleTemplate(
  body: string,
  vars: Readonly<Record<string, string | number>>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
