/**
 * Unit tests for the Eye-archetype end-of-boss-turn tick
 * (embertide-3986, sub of lhlo). Pure-function coverage of the
 * cycle-counter + guarded↔exposed flip state machine. Integration
 * with the boss-turn reducer is covered separately by
 * `combatEngine.eyeArchetypeResolver.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { CombatBoss } from '../../../types/combat';
import { applyEyeArchetypeTick, EYE_EXPOSED_BONUS } from './eye';

function makeEyeBoss(args: {
  threshold: number;
  counter: number;
  guardedUntil?: string;
  trigger?: string;
}): CombatBoss {
  return {
    hp: 12,
    hpMax: 12,
    attackPattern: {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'craghorn',
    archetype: 'eye',
    stateTags: [
      { kind: 'guarded', until: args.guardedUntil ?? 'cycle-trigger' },
      {
        kind: 'cycle',
        counter: args.counter,
        threshold: args.threshold,
        trigger: args.trigger ?? 'flip-to-exposed',
      },
    ],
  };
}

function makeExposedBoss(args: {
  threshold: number;
  counter: number;
  bonus?: number;
  trigger?: string;
}): CombatBoss {
  return {
    hp: 12,
    hpMax: 12,
    attackPattern: {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'craghorn',
    archetype: 'eye',
    stateTags: [
      { kind: 'exposed', bonus: args.bonus ?? EYE_EXPOSED_BONUS },
      {
        kind: 'cycle',
        counter: args.counter,
        threshold: args.threshold,
        trigger: args.trigger ?? 'flip-to-exposed',
      },
    ],
  };
}

describe('applyEyeArchetypeTick — non-Eye no-op cases', () => {
  it('returns identical boss when archetype is undefined (legacy fixture)', () => {
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
    expect(applyEyeArchetypeTick(legacy)).toBe(legacy);
  });

  it('returns identical boss when archetype is non-eye (e.g. layered)', () => {
    const layered: CombatBoss = {
      hp: 20,
      hpMax: 20,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'boulderkin',
      archetype: 'layered',
      stateTags: [
        {
          kind: 'layered',
          layers: [
            { id: 'shell', name: 'Ore Shell', hp: 8, hpMax: 8, defeated: false },
            { id: 'core', name: 'Crystal Core', hp: 12, hpMax: 12, defeated: false },
          ],
        },
      ],
    };
    expect(applyEyeArchetypeTick(layered)).toBe(layered);
  });

  it('returns identical boss when stateTags is missing', () => {
    const noTags: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
    };
    expect(applyEyeArchetypeTick(noTags)).toBe(noTags);
  });

  it('returns identical boss when no cycle tag is present', () => {
    const noCycle: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [{ kind: 'guarded', until: 'cycle-trigger' }],
    };
    expect(applyEyeArchetypeTick(noCycle)).toBe(noCycle);
  });
});

describe('applyEyeArchetypeTick — guarded → cycle tick (below threshold)', () => {
  it('increments cycle.counter when (counter + 1) < threshold', () => {
    const boss = makeEyeBoss({ threshold: 3, counter: 0 });
    const next = applyEyeArchetypeTick(boss);

    expect(next.stateTags).toEqual([
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 1, threshold: 3, trigger: 'flip-to-exposed' },
    ]);
  });

  it('preserves the original guarded.until flavor while ticking', () => {
    const boss = makeEyeBoss({ threshold: 3, counter: 0, guardedUntil: 'tail-exposed-cycle' });
    const next = applyEyeArchetypeTick(boss);

    const guarded = next.stateTags?.[0];
    if (guarded?.kind !== 'guarded') throw new Error('expected guarded tag');
    expect(guarded.until).toBe('tail-exposed-cycle');
  });

  it('returns a new boss object (immutable update)', () => {
    const boss = makeEyeBoss({ threshold: 3, counter: 0 });
    const next = applyEyeArchetypeTick(boss);
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
  });
});

describe('applyEyeArchetypeTick — guarded → exposed flip (threshold trip)', () => {
  it('flips guarded → exposed{bonus: EYE_EXPOSED_BONUS} and resets cycle.counter to 0 when (counter + 1) >= threshold', () => {
    const boss = makeEyeBoss({ threshold: 2, counter: 1 });
    const next = applyEyeArchetypeTick(boss);

    expect(next.stateTags).toEqual([
      { kind: 'exposed', bonus: EYE_EXPOSED_BONUS },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ]);
  });

  it('flips immediately when threshold is 1 (Coilworm cadence)', () => {
    const boss = makeEyeBoss({ threshold: 1, counter: 0 });
    const next = applyEyeArchetypeTick(boss);

    expect(next.stateTags).toEqual([
      { kind: 'exposed', bonus: EYE_EXPOSED_BONUS },
      { kind: 'cycle', counter: 0, threshold: 1, trigger: 'flip-to-exposed' },
    ]);
  });
});

describe('applyEyeArchetypeTick — exposed → guarded revert (window closes)', () => {
  it('flips exposed → guarded{until: cycle-trigger} on the next tick', () => {
    const boss = makeExposedBoss({ threshold: 2, counter: 0 });
    const next = applyEyeArchetypeTick(boss);

    expect(next.stateTags).toEqual([
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
    ]);
  });

  it('keeps the cycle counter at 0 across the revert (window-close + cycle-restart in one tick)', () => {
    const boss = makeExposedBoss({ threshold: 3, counter: 0 });
    const next = applyEyeArchetypeTick(boss);

    const cycle = next.stateTags?.[1];
    if (cycle?.kind !== 'cycle') throw new Error('expected cycle tag');
    expect(cycle.counter).toBe(0);
  });
});

describe('applyEyeArchetypeTick — full round-trip cadences', () => {
  it('Craghorn cadence (threshold=2): tick → tick → flip → revert → tick → tick → flip', () => {
    let boss = makeEyeBoss({ threshold: 2, counter: 0 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('guarded');
    expect(boss.stateTags?.[1]).toMatchObject({ counter: 1 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('exposed');
    expect(boss.stateTags?.[1]).toMatchObject({ counter: 0 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('guarded');
    expect(boss.stateTags?.[1]).toMatchObject({ counter: 0 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('guarded');
    expect(boss.stateTags?.[1]).toMatchObject({ counter: 1 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('exposed');
    expect(boss.stateTags?.[1]).toMatchObject({ counter: 0 });
  });

  it('Coilworm cadence (threshold=1): tick → flip → revert → tick → flip', () => {
    let boss = makeEyeBoss({ threshold: 1, counter: 0 });

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('exposed');

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('guarded');

    boss = applyEyeArchetypeTick(boss);
    expect(boss.stateTags?.[0].kind).toBe('exposed');
  });
});
