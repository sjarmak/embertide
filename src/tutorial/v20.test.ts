/**
 * u-4-tutorial-v20-coop test suite (REQ-24 abbreviated, amendment A9/A11).
 *
 * Acceptance coverage:
 *  (a) All 6 tutorial bubbles are declared with stable ids.
 *  (b) Progressive-disclosure ordering — bubbles 1-3 in game 1, 4-5 in
 *      game 2, 6 in game 3. Each bubble appears in exactly one game.
 *  (c) Dwell-time instrumentation writes to the expected target and a
 *      scripted fixture clears the ≥3s median gate (amendment A11).
 *
 * Scope: pure-logic tests against the v20 tutorial module. No React /
 * UI rendering here — Tutorial.tsx's own component test covers rendering.
 */

import { describe, it, expect } from 'vitest';
import {
  COMBAT_TUTORIAL_BUBBLE_IDS,
  EVENT_TRIGGERED_BUBBLE_IDS,
  SLOT_TUTORIAL_BUBBLE_IDS,
  V20_TUTORIAL_BUBBLES,
  MIN_MEDIAN_DWELL_MS,
  createDwellTracker,
  getBubbleById,
  getBubblesForGame,
  pickCombatBubble,
  renderBubbleTemplate,
  type TutorialBubbleId,
  type TutorialGameNumber,
} from './v20';

// ---------------------------------------------------------------------------
// (a) 6 bubbles declared with stable ids.
// ---------------------------------------------------------------------------

describe('v2.0 tutorial bubbles — all declared (a)', () => {
  it('declares exactly 15 bubbles (6 v2.0 + 5 v2.1 combat u-8g + 4 REQ-32 slot u-9e)', () => {
    expect(V20_TUTORIAL_BUBBLES).toHaveLength(15);
  });

  it('exposes all stable bubble ids in declaration order', () => {
    const expected: readonly TutorialBubbleId[] = [
      'hp-downed',
      'revive-prompt',
      'wisp-on-downed',
      'shared-shards',
      'zone-advance',
      'vurmox-climax',
      'combat-entry',
      'combat-card-played',
      'combat-boss-turn',
      'combat-win',
      'combat-loss',
      'wild-boss-slot-revealed',
      'region-boss-slot-revealed',
      'heirloom-drop',
      'destiny-slot-revealed',
    ];
    expect(V20_TUTORIAL_BUBBLES.map((b) => b.id)).toEqual(expected);
  });

  it('bubble ids are unique (no accidental duplicates)', () => {
    const ids = V20_TUTORIAL_BUBBLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every bubble has a non-empty title + body', () => {
    for (const bubble of V20_TUTORIAL_BUBBLES) {
      expect(bubble.title.length).toBeGreaterThan(0);
      expect(bubble.body.length).toBeGreaterThan(0);
    }
  });

  it('every bubble declares a trigger + a deterministic fallback turn', () => {
    for (const bubble of V20_TUTORIAL_BUBBLES) {
      expect(typeof bubble.trigger).toBe('string');
      expect(typeof bubble.fallbackTurn).toBe('number');
      expect(bubble.fallbackTurn).toBeGreaterThanOrEqual(1);
    }
  });

  it('getBubbleById resolves every declared id and returns undefined for unknown', () => {
    for (const bubble of V20_TUTORIAL_BUBBLES) {
      expect(getBubbleById(bubble.id)?.id).toBe(bubble.id);
    }
    // Unknown id: type-assert to prove the nullable return contract.
    expect(getBubbleById('not-a-real-id' as unknown as TutorialBubbleId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (b) Progressive-disclosure ordering.
// ---------------------------------------------------------------------------

describe('progressive disclosure — bubble-to-game gating (b)', () => {
  it('game 1 covers exactly [hp-downed, revive-prompt, wisp-on-downed]', () => {
    const ids = getBubblesForGame(1).map((b) => b.id);
    expect(ids).toEqual(['hp-downed', 'revive-prompt', 'wisp-on-downed']);
  });

  it('game 2 covers exactly [shared-shards, zone-advance]', () => {
    const ids = getBubblesForGame(2).map((b) => b.id);
    expect(ids).toEqual(['shared-shards', 'zone-advance']);
  });

  it('game 3 covers exactly [vurmox-climax]', () => {
    const ids = getBubblesForGame(3).map((b) => b.id);
    expect(ids).toEqual(['vurmox-climax']);
  });

  it('every turn-scheduled bubble appears in exactly one game — union = 6, intersections = empty', () => {
    // getBubblesForGame filters out event-triggered combat bubbles
    // (u-8g) + REQ-32 slot bubbles (u-9e); the progressive-disclosure
    // invariant holds for the 6 non-event bubbles.
    const games: readonly TutorialGameNumber[] = [1, 2, 3];
    const allBubblesByGame = games.map((g) => getBubblesForGame(g));
    const unionSize = allBubblesByGame.reduce((sum, bubbles) => sum + bubbles.length, 0);
    const turnScheduledCount = V20_TUTORIAL_BUBBLES.length - EVENT_TRIGGERED_BUBBLE_IDS.length;
    expect(unionSize).toBe(turnScheduledCount);
    // Pairwise-disjoint check.
    for (let i = 0; i < games.length; i += 1) {
      for (let j = i + 1; j < games.length; j += 1) {
        const a = new Set(allBubblesByGame[i].map((b) => b.id));
        const b = new Set(allBubblesByGame[j].map((b) => b.id));
        for (const id of a) {
          expect(b.has(id)).toBe(false);
        }
      }
    }
  });

  it('game-1 bubbles cover the co-op-survival arc (hp / revive / wisp)', () => {
    const bodies = getBubblesForGame(1)
      .map((b) => `${b.title} ${b.body}`.toLowerCase())
      .join(' ');
    expect(bodies).toMatch(/hp|heart/);
    expect(bodies).toMatch(/revive|help/);
    expect(bodies).toMatch(/wisp|fairies/);
  });

  it('game-2 bubbles introduce the shared Embertide + zone spine', () => {
    const bodies = getBubblesForGame(2)
      .map((b) => `${b.title} ${b.body}`.toLowerCase())
      .join(' ');
    expect(bodies).toMatch(/embertide|shard/);
    expect(bodies).toMatch(/zone|map/);
  });

  it('game-3 bubble introduces Vurmox + the Climax phase', () => {
    const body = getBubblesForGame(3)[0].body.toLowerCase();
    expect(body).toMatch(/climax|demon king|vurmox/);
  });
});

// ---------------------------------------------------------------------------
// (c) Dwell-time instrumentation + amendment-A11 median-dwell gate.
// ---------------------------------------------------------------------------

describe('dwell-time instrumentation (c)', () => {
  it('tracker starts empty and reports null median with no entries', () => {
    const tracker = createDwellTracker();
    expect(tracker.entries()).toEqual([]);
    expect(tracker.medianDwellMs()).toBeNull();
  });

  it('markShown appends an open entry with null dismissedAt + null dwellMs', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 1000);
    const entries = tracker.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].bubbleId).toBe('hp-downed');
    expect(entries[0].shownAt).toBe(1000);
    expect(entries[0].dismissedAt).toBeNull();
    expect(entries[0].dwellMs).toBeNull();
  });

  it('markDismissed closes the open entry with dismissedAt + dwellMs set', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 1000);
    tracker.markDismissed('hp-downed', 4500);
    const entries = tracker.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].dismissedAt).toBe(4500);
    expect(entries[0].dwellMs).toBe(3500);
  });

  it('markDismissed on an unknown bubble id is a no-op (does not throw)', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 100);
    expect(() => tracker.markDismissed('vurmox-climax', 200)).not.toThrow();
    // Original open entry is still open.
    expect(tracker.entries()[0].dismissedAt).toBeNull();
  });

  it('medianDwellMs computes the median across closed entries only (odd count)', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 0);
    tracker.markDismissed('hp-downed', 3000);
    tracker.markShown('revive-prompt', 100);
    tracker.markDismissed('revive-prompt', 5100);
    tracker.markShown('wisp-on-downed', 200);
    tracker.markDismissed('wisp-on-downed', 4200);
    // Dwells: 3000, 5000, 4000 → sorted 3000, 4000, 5000 → median 4000.
    expect(tracker.medianDwellMs()).toBe(4000);
  });

  it('medianDwellMs computes the median across closed entries only (even count)', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 0);
    tracker.markDismissed('hp-downed', 3000);
    tracker.markShown('revive-prompt', 0);
    tracker.markDismissed('revive-prompt', 5000);
    // Dwells: 3000, 5000 → median (3000+5000)/2 = 4000.
    expect(tracker.medianDwellMs()).toBe(4000);
  });

  it('reset clears the log so medianDwellMs returns null again', () => {
    const tracker = createDwellTracker();
    tracker.markShown('hp-downed', 0);
    tracker.markDismissed('hp-downed', 3500);
    tracker.reset();
    expect(tracker.entries()).toEqual([]);
    expect(tracker.medianDwellMs()).toBeNull();
  });

  it('scripted fixture playthrough across all 6 bubbles clears the ≥3s median gate (amendment A11)', () => {
    // Simulate a kid-scripted playthrough where each bubble dwells
    // between 3s and 8s — varies to exercise the sort logic in the
    // median computation.
    const tracker = createDwellTracker();
    const dwells: readonly [TutorialBubbleId, number][] = [
      ['hp-downed', 4200],
      ['revive-prompt', 3500],
      ['wisp-on-downed', 5800],
      ['shared-shards', 3100],
      ['zone-advance', 6400],
      ['vurmox-climax', 7900],
    ];
    let now = 0;
    for (const [id, dwellMs] of dwells) {
      tracker.markShown(id, now);
      now += dwellMs;
      tracker.markDismissed(id, now);
      // Pause between bubbles — doesn't affect dwell (shown→dismissed),
      // just keeps shownAt values monotonic.
      now += 1000;
    }
    const median = tracker.medianDwellMs();
    expect(median).not.toBeNull();
    expect(median!).toBeGreaterThanOrEqual(MIN_MEDIAN_DWELL_MS);
  });

  it('MIN_MEDIAN_DWELL_MS is the documented 3000ms kid-UX gate', () => {
    expect(MIN_MEDIAN_DWELL_MS).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// (d) v2.1 combat-layer tutorial bubbles (u-8g, PRD §B8).
// ---------------------------------------------------------------------------

describe('combat tutorial bubbles — declarations (u-8g, d)', () => {
  it('exposes the 5 combat bubble ids in a stable order', () => {
    expect(COMBAT_TUTORIAL_BUBBLE_IDS).toEqual([
      'combat-entry',
      'combat-card-played',
      'combat-boss-turn',
      'combat-win',
      'combat-loss',
    ]);
  });

  it('every combat bubble is resolvable via getBubbleById and has non-empty title + body', () => {
    for (const id of COMBAT_TUTORIAL_BUBBLE_IDS) {
      const bubble = getBubbleById(id);
      expect(bubble).toBeDefined();
      expect(bubble!.id).toBe(id);
      expect(bubble!.title.length).toBeGreaterThan(0);
      expect(bubble!.body.length).toBeGreaterThan(0);
    }
  });

  it('combat-entry body mentions engaging a boss and combat-deck play', () => {
    const body = getBubbleById('combat-entry')!.body.toLowerCase();
    expect(body).toMatch(/engage|boss|fight/);
    expect(body).toMatch(/card|deck|play/);
  });

  it('combat-card-played body mentions dealing damage', () => {
    const body = getBubbleById('combat-card-played')!.body.toLowerCase();
    expect(body).toMatch(/damage|hit|dealt/);
  });

  it('combat-boss-turn body mentions boss attack + absorption / heart spill', () => {
    const body = getBubbleById('combat-boss-turn')!.body.toLowerCase();
    expect(body).toMatch(/attack|strike/);
    expect(body).toMatch(/absorb|hero|heart/);
  });

  it('combat-win body mentions boss down + hearts reward', () => {
    const body = getBubbleById('combat-win')!.body.toLowerCase();
    expect(body).toMatch(/boss|down|defeat/);
    expect(body).toMatch(/heart/);
  });

  it('combat-loss body mentions going down + revive possibility', () => {
    const body = getBubbleById('combat-loss')!.body.toLowerCase();
    expect(body).toMatch(/down|fell/);
    expect(body).toMatch(/revive|help/);
  });
});

describe('combat tutorial bubbles — pickCombatBubble progressive disclosure (u-8g)', () => {
  it('first combat (combatsEntered=1): returns combat-entry for the entry trigger', () => {
    expect(pickCombatBubble('combat-entry', 1)).toBe('combat-entry');
  });

  it('first combat (combatsEntered=1): returns combat-card-played for the card-played trigger', () => {
    expect(pickCombatBubble('combat-card-played', 1)).toBe('combat-card-played');
  });

  it('first combat (combatsEntered=1): SUPPRESSES combat-boss-turn (progressive disclosure)', () => {
    expect(pickCombatBubble('combat-boss-turn', 1)).toBeNull();
  });

  it('first combat (combatsEntered=1): returns combat-win / combat-loss on resolve triggers', () => {
    expect(pickCombatBubble('combat-win', 1)).toBe('combat-win');
    expect(pickCombatBubble('combat-loss', 1)).toBe('combat-loss');
  });

  it('second combat (combatsEntered=2): includes combat-boss-turn', () => {
    expect(pickCombatBubble('combat-boss-turn', 2)).toBe('combat-boss-turn');
  });

  it('third+ combat (combatsEntered=5): still returns combat-boss-turn (not re-suppressed)', () => {
    expect(pickCombatBubble('combat-boss-turn', 5)).toBe('combat-boss-turn');
  });

  it('non-combat trigger returns null (not a combat bubble answer)', () => {
    expect(pickCombatBubble('game-start', 2)).toBeNull();
    expect(pickCombatBubble('first-downed', 2)).toBeNull();
    expect(pickCombatBubble('climax-phase-entered', 2)).toBeNull();
  });

  it('boundary: combatsEntered=0 never happens in practice but still suppresses boss-turn', () => {
    // COMBAT_ENTER bumps the counter BEFORE any trigger fires, so in
    // real usage combatsEntered >= 1 on every call. Guard defensively
    // anyway so future wiring changes can't silently shift the gate.
    expect(pickCombatBubble('combat-boss-turn', 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Runtime template substitution (embertide-07h).
// ---------------------------------------------------------------------------

describe('renderBubbleTemplate (embertide-07h)', () => {
  it('substitutes known {key} tokens from the vars map', () => {
    expect(renderBubbleTemplate('You engaged {bossName}!', { bossName: 'Broodmaw' })).toBe(
      'You engaged Broodmaw!',
    );
  });

  it('coerces numeric values to strings so callers can pass numbers directly', () => {
    expect(
      renderBubbleTemplate('{bossName} attacks for {damage}!', {
        bossName: 'Craghorn',
        damage: 3,
      }),
    ).toBe('Craghorn attacks for 3!');
  });

  it('leaves unknown tokens verbatim so missing vars are visible, not silently blank', () => {
    expect(renderBubbleTemplate('Got {itemName} from {bossName}', { itemName: 'Craghorn Tusk' })).toBe(
      'Got Craghorn Tusk from {bossName}',
    );
  });

  it('returns the body unchanged when there are no tokens', () => {
    const body = 'Nice hit!';
    expect(renderBubbleTemplate(body, { unused: 'x' })).toBe(body);
  });

  it('replaces multiple occurrences of the same token', () => {
    expect(
      renderBubbleTemplate('{bossName} down! {bossName} is defeated.', {
        bossName: 'Ashen Tyrant',
      }),
    ).toBe('Ashen Tyrant down! Ashen Tyrant is defeated.');
  });
});

describe('combat bubble bodies — templating placeholders (07h)', () => {
  it('combat-entry body carries {bossName}', () => {
    expect(getBubbleById('combat-entry')!.body).toContain('{bossName}');
  });

  it('combat-boss-turn body carries {bossName} + {damage}', () => {
    const body = getBubbleById('combat-boss-turn')!.body;
    expect(body).toContain('{bossName}');
    expect(body).toContain('{damage}');
  });

  it('combat-win body carries {bossName} + {hearts}', () => {
    const body = getBubbleById('combat-win')!.body;
    expect(body).toContain('{bossName}');
    expect(body).toContain('{hearts}');
  });

  it('combat-card-played + combat-loss stay static (no placeholders)', () => {
    // Documented scope limit: these two fire-points don't carry the
    // runtime data (damage-dealt / downed-player) that would make a
    // template land — keep them static so future plumbing work has a
    // test that will fail loud when placeholders are introduced.
    expect(getBubbleById('combat-card-played')!.body).not.toMatch(/\{\w+\}/);
    expect(getBubbleById('combat-loss')!.body).not.toMatch(/\{\w+\}/);
  });
});

// ---------------------------------------------------------------------------
// (e) REQ-32 (u-9e) — Wild / Region boss slot + heirloom + destiny bubbles.
// ---------------------------------------------------------------------------

describe('slot tutorial bubbles — declarations (u-9e, e)', () => {
  it('exposes the 4 slot bubble ids in declaration order', () => {
    expect(SLOT_TUTORIAL_BUBBLE_IDS).toEqual([
      'wild-boss-slot-revealed',
      'region-boss-slot-revealed',
      'heirloom-drop',
      'destiny-slot-revealed',
    ]);
  });

  it('EVENT_TRIGGERED_BUBBLE_IDS unions combat + slot bubble ids', () => {
    expect(EVENT_TRIGGERED_BUBBLE_IDS).toEqual([
      ...COMBAT_TUTORIAL_BUBBLE_IDS,
      ...SLOT_TUTORIAL_BUBBLE_IDS,
    ]);
  });

  it('every slot bubble is resolvable via getBubbleById and has non-empty title + body', () => {
    for (const id of SLOT_TUTORIAL_BUBBLE_IDS) {
      const bubble = getBubbleById(id);
      expect(bubble).toBeDefined();
      expect(bubble!.id).toBe(id);
      expect(bubble!.title.length).toBeGreaterThan(0);
      expect(bubble!.body.length).toBeGreaterThan(0);
    }
  });

  it('wild-boss-slot-revealed body mentions optional + heirloom', () => {
    const body = getBubbleById('wild-boss-slot-revealed')!.body.toLowerCase();
    expect(body).toMatch(/optional/);
    expect(body).toMatch(/heirloom/);
  });

  it('region-boss-slot-revealed body mentions path + hard', () => {
    const body = getBubbleById('region-boss-slot-revealed')!.body.toLowerCase();
    expect(body).toMatch(/path|guard/);
    expect(body).toMatch(/hard|deck/);
  });

  it('heirloom-drop body carries the {itemName} placeholder for runtime templating', () => {
    const body = getBubbleById('heirloom-drop')!.body;
    expect(body).toMatch(/\{itemName\}/);
    expect(body.toLowerCase()).toMatch(/hero's deck|your hero/);
  });

  it('destiny-slot-revealed body mentions final fight + Demon King', () => {
    const body = getBubbleById('destiny-slot-revealed')!.body.toLowerCase();
    expect(body).toMatch(/final fight/);
    expect(body).toMatch(/demon king/);
  });

  it('slot bubbles are excluded from every turn-scheduled game set', () => {
    const games: readonly TutorialGameNumber[] = [1, 2, 3];
    for (const g of games) {
      const ids = getBubblesForGame(g).map((b) => b.id);
      for (const slotId of SLOT_TUTORIAL_BUBBLE_IDS) {
        expect(ids).not.toContain(slotId);
      }
    }
  });

  it('every slot bubble carries fallbackTurn=999 (event-triggered sentinel)', () => {
    for (const id of SLOT_TUTORIAL_BUBBLE_IDS) {
      expect(getBubbleById(id)!.fallbackTurn).toBe(999);
    }
  });
});
