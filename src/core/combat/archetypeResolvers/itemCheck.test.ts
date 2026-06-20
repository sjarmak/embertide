/**
 * Unit tests for the Item-Check archetype resolvers (embertide-swlb
 * + embertide-4hr1.1, subs of lhlo + 4hr1).
 *
 * Two pure resolvers live in `./itemCheck.ts`:
 *   1. `applyItemCheckArchetypeTick` (swlb) — close-window:
 *      exposed{revertsTo:guarded(until)} → guarded(until). Applied at
 *      end-of-boss-turn.
 *   2. `applyItemCheckOpenTrigger` (4hr1.1) — open-window: when a
 *      played card's `tags` overlap with the boss's
 *      `guarded.until`, flip guarded(until) → exposed{revertsTo:
 *      guarded(until)}. Applied at player-card-play time.
 */

import { describe, expect, it } from 'vitest';
import type { BossStateGuarded, CombatBoss } from '../../../types/combat';
import type { Card } from '../../../types/card';
import {
  applyItemCheckArchetypeTick,
  applyItemCheckOpenTrigger,
  ITEM_CHECK_EXPOSED_BONUS,
} from './itemCheck';

function makeItemCheckBoss(args: {
  stateTags: CombatBoss['stateTags'];
  archetype?: CombatBoss['archetype'];
}): CombatBoss {
  return {
    hp: 16,
    hpMax: 16,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'cinderwyrm',
    archetype: args.archetype ?? 'item-check',
    stateTags: args.stateTags,
  };
}

describe('applyItemCheckArchetypeTick — non-Item-Check no-op cases', () => {
  it('returns identical boss when archetype is undefined', () => {
    const legacy: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'broodmaw',
    };
    expect(applyItemCheckArchetypeTick(legacy)).toBe(legacy);
  });

  it('A4(d): returns identical boss when archetype is non-item-check (e.g. eye)', () => {
    const eye: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'exposed', bonus: 1 },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };
    expect(applyItemCheckArchetypeTick(eye)).toBe(eye);
  });

  it('returns identical boss when stateTags is missing', () => {
    const noTags = makeItemCheckBoss({ stateTags: undefined });
    expect(applyItemCheckArchetypeTick(noTags)).toBe(noTags);
  });
});

describe('applyItemCheckArchetypeTick — close-window state machine', () => {
  it('A4(a): guarded(item-tag-bomb) → no-op (boss is still guarded; open-path has not fired)', () => {
    const guarded = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    expect(applyItemCheckArchetypeTick(guarded)).toBe(guarded);
  });

  it('A4(b): exposed{revertsTo: guarded(item-tag-bomb)} → guarded(item-tag-bomb)', () => {
    const revertsTo: BossStateGuarded = { kind: 'guarded', until: 'item-tag-bomb' };
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'exposed', bonus: 1, revertsTo }],
    });
    const next = applyItemCheckArchetypeTick(boss);

    expect(next).not.toBe(boss);
    expect(next.stateTags).toEqual([{ kind: 'guarded', until: 'item-tag-bomb' }]);
  });

  it('A4(b) preserves the original `until` discriminant byte-for-byte across the round-trip', () => {
    const revertsTo: BossStateGuarded = { kind: 'guarded', until: 'item-tag-fire-arrow' };
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'exposed', revertsTo }],
    });
    const next = applyItemCheckArchetypeTick(boss);
    const tag = next.stateTags?.[0];
    if (tag?.kind !== 'guarded') throw new Error('expected guarded tag after close-window tick');
    expect(tag.until).toBe('item-tag-fire-arrow');
  });

  it('A4(c): exposed without revertsTo → no-op (defensive — degenerate spec, no preserved guard to restore)', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'exposed', bonus: 1 }],
    });
    expect(applyItemCheckArchetypeTick(boss)).toBe(boss);
  });

  it('returns a new boss object with a new stateTags array on transformation (immutability)', () => {
    const revertsTo: BossStateGuarded = { kind: 'guarded', until: 'item-tag-bomb' };
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'exposed', revertsTo }],
    });
    const next = applyItemCheckArchetypeTick(boss);
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
  });
});

describe('applyItemCheckArchetypeTick — coexistence with sibling tags', () => {
  it('preserves sibling tags untouched while flipping exposed → guarded', () => {
    const revertsTo: BossStateGuarded = { kind: 'guarded', until: 'item-tag-bomb' };
    const boss = makeItemCheckBoss({
      stateTags: [
        { kind: 'adaptive', penalty: 1 },
        { kind: 'exposed', bonus: 2, revertsTo },
        { kind: 'break', counter: 0 },
      ],
    });
    const next = applyItemCheckArchetypeTick(boss);

    expect(next.stateTags?.[0]).toEqual({ kind: 'adaptive', penalty: 1 });
    expect(next.stateTags?.[1]).toEqual({ kind: 'guarded', until: 'item-tag-bomb' });
    expect(next.stateTags?.[2]).toEqual({ kind: 'break', counter: 0 });
  });
});

// ---------------------------------------------------------------------------
// Open-window resolver (embertide-4hr1.1) — player-action flip.
// ---------------------------------------------------------------------------

function makeCard(args: { id?: string; tags?: readonly string[] } = {}): Card {
  return {
    id: args.id ?? 'cinder-bloom',
    role: 'item',
    cost: { green: 3 },
    effects: { kind: 'gain', red: 1 },
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
  };
}

describe('applyItemCheckOpenTrigger — non-Item-Check no-op cases', () => {
  it('returns identical boss when archetype is undefined', () => {
    const legacy: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'broodmaw',
    };
    const card = makeCard({ tags: ['item-tag-bomb'] });
    expect(applyItemCheckOpenTrigger(legacy, card)).toBe(legacy);
  });

  it('returns identical boss when archetype is non-item-check (e.g. eye)', () => {
    const eye: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };
    const card = makeCard({ tags: ['cycle-trigger'] });
    expect(applyItemCheckOpenTrigger(eye, card)).toBe(eye);
  });

  it('returns identical boss when stateTags is missing', () => {
    const noTags = makeItemCheckBoss({ stateTags: undefined });
    const card = makeCard({ tags: ['item-tag-bomb'] });
    expect(applyItemCheckOpenTrigger(noTags, card)).toBe(noTags);
  });
});

describe('applyItemCheckOpenTrigger — open-window state machine', () => {
  it('Cinderwyrm ruling: guarded(item-tag-bomb) + card.tags=[item-tag-bomb] → exposed{revertsTo: guarded(item-tag-bomb)}', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard({ id: 'cinder-bloom', tags: ['item-tag-bomb'] });
    const next = applyItemCheckOpenTrigger(boss, card);

    expect(next).not.toBe(boss);
    expect(next.stateTags).toEqual([
      {
        kind: 'exposed',
        bonus: ITEM_CHECK_EXPOSED_BONUS,
        revertsTo: { kind: 'guarded', until: 'item-tag-bomb' },
      },
    ]);
  });

  it('preserves the original `until` discriminant byte-for-byte in revertsTo (so close-window can restore it)', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-fire-arrow' }],
    });
    const card = makeCard({ tags: ['item-tag-fire-arrow'] });
    const next = applyItemCheckOpenTrigger(boss, card);
    const tag = next.stateTags?.[0];
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag after open-window flip');
    expect(tag.revertsTo).toEqual({ kind: 'guarded', until: 'item-tag-fire-arrow' });
  });

  it('no-op when card has no tags field at all', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard();
    expect(applyItemCheckOpenTrigger(boss, card)).toBe(boss);
  });

  it('no-op when card.tags is empty', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard({ tags: [] });
    expect(applyItemCheckOpenTrigger(boss, card)).toBe(boss);
  });

  it('no-op when card.tags has no overlap with guarded.until', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard({ tags: ['item-tag-fire-arrow', 'item-tag-arrow'] });
    expect(applyItemCheckOpenTrigger(boss, card)).toBe(boss);
  });

  it('no-op when guarded tag has no `until` discriminant (degenerate spec)', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded' }],
    });
    const card = makeCard({ tags: ['item-tag-bomb'] });
    expect(applyItemCheckOpenTrigger(boss, card)).toBe(boss);
  });

  it('no-op when boss has no guarded tag (already exposed or break-only)', () => {
    const exposedBoss = makeItemCheckBoss({
      stateTags: [
        {
          kind: 'exposed',
          bonus: 1,
          revertsTo: { kind: 'guarded', until: 'item-tag-bomb' },
        },
      ],
    });
    const card = makeCard({ tags: ['item-tag-bomb'] });
    expect(applyItemCheckOpenTrigger(exposedBoss, card)).toBe(exposedBoss);
  });

  it('returns a new boss object with a new stateTags array on transformation (immutability)', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard({ tags: ['item-tag-bomb'] });
    const next = applyItemCheckOpenTrigger(boss, card);
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
  });

  it('flips on multi-tag card when at least one tag overlaps', () => {
    const boss = makeItemCheckBoss({
      stateTags: [{ kind: 'guarded', until: 'item-tag-bomb' }],
    });
    const card = makeCard({ tags: ['item-tag-arrow', 'item-tag-bomb', 'item-tag-other'] });
    const next = applyItemCheckOpenTrigger(boss, card);
    const tag = next.stateTags?.[0];
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag');
    expect(tag.revertsTo?.until).toBe('item-tag-bomb');
  });
});

describe('applyItemCheckOpenTrigger — coexistence with sibling tags', () => {
  it('preserves sibling tags untouched while flipping guarded → exposed', () => {
    const boss = makeItemCheckBoss({
      stateTags: [
        { kind: 'adaptive', penalty: 1 },
        { kind: 'guarded', until: 'item-tag-bomb' },
        { kind: 'break', counter: 0 },
      ],
    });
    const card = makeCard({ tags: ['item-tag-bomb'] });
    const next = applyItemCheckOpenTrigger(boss, card);

    expect(next.stateTags?.[0]).toEqual({ kind: 'adaptive', penalty: 1 });
    expect(next.stateTags?.[1]).toEqual({
      kind: 'exposed',
      bonus: ITEM_CHECK_EXPOSED_BONUS,
      revertsTo: { kind: 'guarded', until: 'item-tag-bomb' },
    });
    expect(next.stateTags?.[2]).toEqual({ kind: 'break', counter: 0 });
  });
});
