/**
 * Unit tests for the Sequence-archetype end-of-boss-turn tick
 * (embertide-j0ik, sub of lhlo + 4hr1). Pure-function coverage of
 * the currentIndex modular advance. Per-step attack-pattern dispatch
 * (the bossAttackResolver that reads currentIndex and fires per-step
 * damage/effect) is a separate bead per consumer; this resolver only
 * owns the pointer-advance bookkeeping.
 */

import { describe, expect, it } from 'vitest';
import type { CombatBoss } from '../../../types/combat';
import { applySequenceArchetypeTick } from './sequence';

function makeSequenceBoss(args: { steps: readonly string[]; currentIndex: number }): CombatBoss {
  return {
    hp: 22,
    hpMax: 22,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'battlefield-then-player',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'phantom-vurmox',
    archetype: 'sequence',
    stateTags: [
      {
        kind: 'sequence',
        steps: args.steps,
        currentIndex: args.currentIndex,
      },
    ],
  };
}

describe('applySequenceArchetypeTick — non-Sequence no-op cases', () => {
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
    expect(applySequenceArchetypeTick(legacy)).toBe(legacy);
  });

  it('returns identical boss when archetype is non-sequence (e.g. eye)', () => {
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
    expect(applySequenceArchetypeTick(eye)).toBe(eye);
  });

  it('returns identical boss when stateTags is missing', () => {
    const noTags: CombatBoss = {
      hp: 22,
      hpMax: 22,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'phantom-vurmox',
      archetype: 'sequence',
    };
    expect(applySequenceArchetypeTick(noTags)).toBe(noTags);
  });

  it('returns identical boss when no sequence tag is present', () => {
    const noSeq: CombatBoss = {
      hp: 22,
      hpMax: 22,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'phantom-vurmox',
      archetype: 'sequence',
      stateTags: [{ kind: 'adaptive', penalty: 1 }],
    };
    expect(applySequenceArchetypeTick(noSeq)).toBe(noSeq);
  });

  it('returns identical boss when steps is empty (defensive — degenerate spec)', () => {
    const empty = makeSequenceBoss({ steps: [], currentIndex: 0 });
    expect(applySequenceArchetypeTick(empty)).toBe(empty);
  });

  it('returns identical boss when steps has only 1 step (degenerate — no rotation possible)', () => {
    const singleStep = makeSequenceBoss({ steps: ['only-step'], currentIndex: 0 });
    expect(applySequenceArchetypeTick(singleStep)).toBe(singleStep);
  });
});

describe('applySequenceArchetypeTick — currentIndex advance', () => {
  it('advances currentIndex by 1 within bounds', () => {
    const boss = makeSequenceBoss({
      steps: ['ball-volley-charge', 'ball-volley-fire'],
      currentIndex: 0,
    });
    const next = applySequenceArchetypeTick(boss);

    expect(next.stateTags).toEqual([
      {
        kind: 'sequence',
        steps: ['ball-volley-charge', 'ball-volley-fire'],
        currentIndex: 1,
      },
    ]);
  });

  it('wraps modulo steps.length back to 0 from the last step', () => {
    const boss = makeSequenceBoss({
      steps: ['gloom-head', 'umbra-head', 'auren-head'],
      currentIndex: 2,
    });
    const next = applySequenceArchetypeTick(boss);

    const seq = next.stateTags?.[0];
    if (seq?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(seq.currentIndex).toBe(0);
  });

  it('preserves the steps array reference unchanged across ticks', () => {
    const steps = ['gloom-head', 'umbra-head', 'auren-head'] as const;
    const boss = makeSequenceBoss({ steps, currentIndex: 0 });
    const next = applySequenceArchetypeTick(boss);

    const seq = next.stateTags?.[0];
    if (seq?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(seq.steps).toBe(steps);
  });

  it('returns a new boss object (immutable update)', () => {
    const boss = makeSequenceBoss({
      steps: ['a', 'b'],
      currentIndex: 0,
    });
    const next = applySequenceArchetypeTick(boss);
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
  });
});

describe('applySequenceArchetypeTick — full rotations', () => {
  it('Phantom Vurmox cadence (2 steps): 0 → 1 → 0 → 1', () => {
    let boss = makeSequenceBoss({
      steps: ['ball-volley-charge', 'ball-volley-fire'],
      currentIndex: 0,
    });

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(1);

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(0);

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(1);
  });

  it('Trinity Aurogax cadence (3 steps): 0 → 1 → 2 → 0 → 1', () => {
    let boss = makeSequenceBoss({
      steps: ['gloom-head', 'umbra-head', 'auren-head'],
      currentIndex: 0,
    });

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(1);

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(2);

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(0);

    boss = applySequenceArchetypeTick(boss);
    expect((boss.stateTags?.[0] as { currentIndex: number }).currentIndex).toBe(1);
  });
});

describe('applySequenceArchetypeTick — coexistence with other tags', () => {
  it('preserves sibling stateTags untouched (e.g. adaptive on a future Adaptive-Sequence capstone)', () => {
    const boss: CombatBoss = {
      hp: 22,
      hpMax: 22,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'phantom-vurmox',
      archetype: 'sequence',
      stateTags: [
        { kind: 'adaptive', penalty: 1 },
        {
          kind: 'sequence',
          steps: ['a', 'b'],
          currentIndex: 0,
        },
      ],
    };
    const next = applySequenceArchetypeTick(boss);

    expect(next.stateTags?.[0]).toEqual({ kind: 'adaptive', penalty: 1 });
    expect(next.stateTags?.[1]).toEqual({
      kind: 'sequence',
      steps: ['a', 'b'],
      currentIndex: 1,
    });
  });
});
