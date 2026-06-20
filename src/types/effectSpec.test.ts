/**
 * Unit tests for `isMonsterDropEffect` type guard (embertide-5pj).
 *
 * Mirrors the negative-path coverage in `src/ui/effectText.test.tsx`
 * (embertide-bv5): the guard must reject primitives, arrays,
 * `null`, and wrong-shape objects and must only accept a well-formed
 * `{ kind: 'monster-drop', hearts: number, keys?: number }`.
 */

import { describe, it, expect } from 'vitest';
import { isMonsterDropEffect } from './effectSpec';
import type {
  DieFace,
  EffectSpec,
  EquipBonusEffect,
  HealEffect,
  InnerEffectSpec,
  ItemPassiveEffect,
  RollDieEffect,
  RollDieOutcomeEffect,
} from './effectSpec';

describe('isMonsterDropEffect', () => {
  it('returns false for primitives', () => {
    expect(isMonsterDropEffect(undefined)).toBe(false);
    expect(isMonsterDropEffect(null)).toBe(false);
    expect(isMonsterDropEffect('monster-drop')).toBe(false);
    expect(isMonsterDropEffect(42)).toBe(false);
    expect(isMonsterDropEffect(true)).toBe(false);
  });

  it('returns false for arrays (typeof "object" but not a record)', () => {
    expect(isMonsterDropEffect([])).toBe(false);
    expect(isMonsterDropEffect([{ kind: 'monster-drop', hearts: 1 }])).toBe(false);
  });

  it('returns false for objects missing the kind discriminant', () => {
    expect(isMonsterDropEffect({})).toBe(false);
    expect(isMonsterDropEffect({ hearts: 2 })).toBe(false);
  });

  it('returns false when kind is present but wrong (other EffectSpec variants)', () => {
    expect(isMonsterDropEffect({ kind: 'gain', green: 1 })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'draw', amount: 2 })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'chest-draw', tier: 'std' })).toBe(false);
  });

  it('returns false when hearts is missing or non-numeric', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop' })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: '3' })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: null })).toBe(false);
  });

  it('returns false when keys is present but non-numeric', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, keys: '1' })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, keys: true })).toBe(false);
  });

  it('returns true for a well-formed drop (hearts only)', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 3 })).toBe(true);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 0 })).toBe(true);
  });

  it('returns true for a well-formed drop with optional keys', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, keys: 1 })).toBe(true);
    // keys: undefined is explicitly allowed (the field is optional).
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, keys: undefined })).toBe(true);
  });

  // r94e drop-variety: optional `gems` / `cardDraw` numerics layer onto
  // the drop shape. The guard MUST accept well-formed values, undefined
  // (field omitted), and reject non-numeric values — same contract as
  // the existing `keys` field.
  it('returns true for well-formed drops with optional gems / cardDraw (r94e)', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, gems: 1 })).toBe(true);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 2, cardDraw: 1 })).toBe(true);
    expect(
      isMonsterDropEffect({ kind: 'monster-drop', hearts: 2, gems: 2, cardDraw: 1, keys: 1 }),
    ).toBe(true);
    // Explicit-undefined optional fields stay legal.
    expect(
      isMonsterDropEffect({
        kind: 'monster-drop',
        hearts: 1,
        gems: undefined,
        cardDraw: undefined,
      }),
    ).toBe(true);
  });

  it('returns false when gems / cardDraw are present but non-numeric (r94e)', () => {
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, gems: '1' })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, cardDraw: true })).toBe(false);
    expect(isMonsterDropEffect({ kind: 'monster-drop', hearts: 1, gems: null })).toBe(false);
  });

  it('narrows the type at the use site (compile-time guard coverage)', () => {
    const value: unknown = { kind: 'monster-drop', hearts: 2, keys: 1 };
    if (isMonsterDropEffect(value)) {
      // Inside the branch the value is `MonsterDropEffect` — numeric
      // `hearts` and optional numeric `keys` are directly readable.
      const hearts: number = value.hearts;
      const keys: number | undefined = value.keys;
      expect(hearts).toBe(2);
      expect(keys).toBe(1);
    } else {
      throw new Error('expected narrow to succeed');
    }
  });

  it('narrowed drop exposes optional gems / cardDraw fields (r94e)', () => {
    const value: unknown = { kind: 'monster-drop', hearts: 2, gems: 1, cardDraw: 1 };
    if (!isMonsterDropEffect(value)) throw new Error('expected narrow to succeed');
    const gems: number | undefined = value.gems;
    const cardDraw: number | undefined = value.cardDraw;
    expect(gems).toBe(1);
    expect(cardDraw).toBe(1);
    // EffectSpec union membership is preserved for the extended shape —
    // a downstream switch over EffectSpec stays exhaustive.
    const spec: EffectSpec = value;
    expect(spec.kind).toBe('monster-drop');
  });
});

/**
 * REQ-13 Phase 2b: `item-passive` union member coverage.
 *
 * These tests assert the SCHEMA contract — authoring-time shape and the
 * type-level recursion guard. The runtime reducer hooks that fire the
 * nested `effect` payload on `trigger` ship in a follow-up unit.
 */
describe("EffectSpec 'item-passive' (REQ-13 Phase 2b)", () => {
  it('accepts a minimally valid item-passive shape with all triggers (start-of-turn / on-combat-enter / on-damage / on-monster-defeated)', () => {
    const triggers: ItemPassiveEffect['trigger'][] = [
      'start-of-turn',
      'on-combat-enter',
      'on-damage',
      'on-monster-defeated',
    ];
    for (const trigger of triggers) {
      const spec: ItemPassiveEffect = {
        kind: 'item-passive',
        description: 'test',
        trigger,
        effect: { kind: 'gain', green: 1 },
      };
      expect(spec.trigger).toBe(trigger);
      expect(spec.effect.kind).toBe('gain');
    }
  });

  it('is assignable to EffectSpec (union membership)', () => {
    const passive: ItemPassiveEffect = {
      kind: 'item-passive',
      description: '+1 power at the start of your turn',
      trigger: 'start-of-turn',
      effect: { kind: 'on-play-power', red: 1 },
    };
    // Structural upcast — fails to compile if the union doesn't include
    // ItemPassiveEffect.
    const spec: EffectSpec = passive;
    expect(spec.kind).toBe('item-passive');
  });

  it("exhaustiveness: an explicit 'item-passive' switch branch compiles; omission fails type-check", () => {
    // Runtime proof that the branch is reachable. The compile-time proof
    // lives in src/ui/effectText.tsx's `_exhaustivenessGate` — adding a
    // new EffectSpec kind without an `item-passive` case would break the
    // `never` narrowing in that file's default branch.
    function describeKind(spec: EffectSpec): string {
      switch (spec.kind) {
        case 'gain':
        case 'shard':
        case 'draw':
        case 'combat-bonus':
        case 'damage-reduction':
        case 'monster-drop':
        case 'heal':
        case 'chest-draw':
        case 'on-play-power':
        case 'on-play-green-and-draw':
        case 'on-play-green-and-power':
        case 'banish-from-hand':
        case 'banish-from-discard':
          return spec.kind;
        case 'item-passive':
          return `item-passive:${spec.trigger}`;
        case 'roll-die':
          return `roll-die:${Object.keys(spec.outcomes).length}`;
        case 'shard-grant':
          return `shard-grant:${spec.shards.join('+')}`;
        case 'equip-bonus':
          return `equip-bonus:${spec.resource}:${spec.amount}:${spec.trigger}`;
        default: {
          const _exhaustive: never = spec;
          return _exhaustive;
        }
      }
    }
    const passive: ItemPassiveEffect = {
      kind: 'item-passive',
      description: 'irrelevant',
      trigger: 'on-damage',
      effect: { kind: 'damage-reduction', amount: 1 },
    };
    expect(describeKind(passive)).toBe('item-passive:on-damage');
  });

  it("InnerEffectSpec forbids nested 'item-passive' at the type level", () => {
    // A value typed as InnerEffectSpec can hold any non-passive member.
    const inner: InnerEffectSpec = { kind: 'gain', green: 1 };
    expect(inner.kind).toBe('gain');

    // Compile-time regression fence. If the recursion constraint on
    // ItemPassiveEffect.effect were dropped (e.g. someone changed the
    // field type to `EffectSpec`), the @ts-expect-error below would
    // become a stale directive and fail the typecheck gate.
    const nestedPassive: ItemPassiveEffect = {
      kind: 'item-passive',
      description: 'nested',
      trigger: 'start-of-turn',
      effect: { kind: 'gain', green: 1 },
    };
    // @ts-expect-error — item-passive is deliberately excluded from
    //   InnerEffectSpec so passives cannot wrap passives.
    const rejected: InnerEffectSpec = nestedPassive;
    // Silence the unused-variable lint — `rejected` exists only to make
    // the expect-error directive one line above it active.
    void rejected;
  });
});

/**
 * REQ-13 Phase 2a + REQ-10 (gm0.7): `roll-die` union member coverage.
 *
 * These tests lock in the SCHEMA contract — the fail-forward-floor type
 * invariant (every face 1..6 has a non-zero inner effect), the exclusion
 * of self-nesting, and union membership. Reducer wiring that actually
 * dispatches the picked face's effect ships in gm0.10 / gm0.11.
 */
describe("EffectSpec 'roll-die' (REQ-13 Phase 2a + REQ-10)", () => {
  /**
   * Canonical well-formed roll-die shape used across multiple assertions.
   * Each face has a non-zero resource effect, covering the d6 range with
   * modest rewards so nothing is balance-sensitive.
   */
  const sampleRollDie: RollDieEffect = {
    kind: 'roll-die',
    outcomes: {
      1: { kind: 'gain', green: 1 },
      2: { kind: 'gain', green: 1 },
      3: { kind: 'gain', red: 1 },
      4: { kind: 'gain', red: 1 },
      5: { kind: 'draw', amount: 1 },
      6: { kind: 'gain', keys: 1 },
    },
  };

  it('accepts a minimally valid roll-die shape with all six faces', () => {
    expect(sampleRollDie.kind).toBe('roll-die');
    for (const face of [1, 2, 3, 4, 5, 6] as const) {
      expect(sampleRollDie.outcomes[face]).toBeDefined();
      expect(sampleRollDie.outcomes[face].kind).toBeDefined();
    }
  });

  it('is assignable to EffectSpec (union membership)', () => {
    const spec: EffectSpec = sampleRollDie;
    expect(spec.kind).toBe('roll-die');
  });

  it('fail-forward-floor: every face 1..6 is present (type-level coverage)', () => {
    // The outcomes field is `Readonly<Record<DieFace, RollDieOutcomeEffect>>`
    // which is a TOTAL map — a partial table fails tsc. The runtime
    // assertion here mirrors that guarantee for anyone reading the tests
    // without the type in view.
    const faces = Object.keys(sampleRollDie.outcomes).map((s) => Number(s));
    expect(faces.sort()).toEqual([1, 2, 3, 4, 5, 6]);

    // Compile-time fence — a partial outcomes map fails tsc. The error
    // lands on the const declaration line, so the directive must sit
    // immediately above it.
    // @ts-expect-error — face 6 is missing from the outcomes table.
    const missingFace: RollDieEffect['outcomes'] = {
      1: { kind: 'gain', green: 1 },
      2: { kind: 'gain', green: 1 },
      3: { kind: 'gain', red: 1 },
      4: { kind: 'gain', red: 1 },
      5: { kind: 'draw', amount: 1 },
    };
    void missingFace;

    // Compile-time fence — an empty {} is not a valid RollDieOutcomeEffect
    // (EffectSpec members all require a `kind` discriminant).
    const emptyEffect: RollDieEffect['outcomes'] = {
      // @ts-expect-error — {} is not assignable to RollDieOutcomeEffect.
      1: {},
      2: { kind: 'gain', green: 1 },
      3: { kind: 'gain', red: 1 },
      4: { kind: 'gain', red: 1 },
      5: { kind: 'draw', amount: 1 },
      6: { kind: 'gain', keys: 1 },
    };
    void emptyEffect;
  });

  it('DieFace is the closed tuple 1|2|3|4|5|6 (no 0, no 7, no string keys)', () => {
    // Runtime check — DieFace keys are integers in [1, 6]. Type-level
    // regression fences below prove invalid faces fail tsc.
    const valid: DieFace[] = [1, 2, 3, 4, 5, 6];
    expect(valid).toHaveLength(6);

    // @ts-expect-error — 0 is not a DieFace.
    const zero: DieFace = 0;
    void zero;

    // @ts-expect-error — 7 is not a DieFace.
    const seven: DieFace = 7;
    void seven;
  });

  it("RollDieOutcomeEffect forbids nested 'roll-die' at the type level", () => {
    // A value typed as RollDieOutcomeEffect can hold any non-dice,
    // non-passive member.
    const inner: RollDieOutcomeEffect = { kind: 'gain', green: 1 };
    expect(inner.kind).toBe('gain');

    // Compile-time regression fence: cascading dice are forbidden. If
    // RollDieEffect.outcomes were widened to accept nested dice (e.g.
    // by changing the payload type to InnerEffectSpec), the directive
    // below would become a stale `@ts-expect-error` and break the
    // typecheck gate.
    const nestedRoll: RollDieEffect = sampleRollDie;
    // @ts-expect-error — roll-die is deliberately excluded from
    //   RollDieOutcomeEffect so dice cannot cascade.
    const rejected: RollDieOutcomeEffect = nestedRoll;
    void rejected;
  });

  it("RollDieOutcomeEffect forbids 'item-passive' at the type level", () => {
    // An item-passive is an always-on trigger shape; dispatching one
    // from a transient dice face is a shape mismatch (the passive has
    // no place to live after the dice resolve). Locked out at the
    // type level.
    const passive: ItemPassiveEffect = {
      kind: 'item-passive',
      description: 'irrelevant',
      trigger: 'start-of-turn',
      effect: { kind: 'gain', green: 1 },
    };
    // @ts-expect-error — item-passive is deliberately excluded from
    //   RollDieOutcomeEffect so dice faces cannot carry passives.
    const rejected: RollDieOutcomeEffect = passive;
    void rejected;
  });

  it('exhaustiveness: roll-die is reachable via the canonical switch', () => {
    // Mirrors the item-passive coverage above — the compile-time proof
    // lives in src/ui/effectText.tsx's `_exhaustivenessGate`. Adding a
    // new EffectSpec kind without a roll-die case would break the
    // `never` narrowing there.
    function describeKind(spec: EffectSpec): string {
      switch (spec.kind) {
        case 'gain':
        case 'shard':
        case 'draw':
        case 'combat-bonus':
        case 'damage-reduction':
        case 'monster-drop':
        case 'heal':
        case 'chest-draw':
        case 'on-play-power':
        case 'on-play-green-and-draw':
        case 'on-play-green-and-power':
        case 'banish-from-hand':
        case 'banish-from-discard':
          return spec.kind;
        case 'item-passive':
          return `item-passive:${spec.trigger}`;
        case 'roll-die':
          return `roll-die:${Object.keys(spec.outcomes).length}`;
        case 'shard-grant':
          return `shard-grant:${spec.shards.join('+')}`;
        case 'equip-bonus':
          return `equip-bonus:${spec.resource}:${spec.amount}:${spec.trigger}`;
        default: {
          const _exhaustive: never = spec;
          return _exhaustive;
        }
      }
    }
    expect(describeKind(sampleRollDie)).toBe('roll-die:6');
  });
});

/**
 * REQ-13 Phase 2c (gm0.3): `heal` union member coverage.
 *
 * Locks the SCHEMA contract for the explicit HP-heal discriminant —
 * the three target modes ('self' | 'team' | 'active'), union
 * membership, and exhaustiveness through the canonical switch. Heal
 * intent is now first-class instead of folded into `monster-drop`'s
 * `hearts` field, so non-defeat heal sources (wisp revive, future
 * item-active consumes, REQ-22 Seer's Omen) can express themselves
 * directly.
 */
describe("EffectSpec 'heal' (REQ-13 Phase 2c)", () => {
  it('accepts a minimally valid heal shape with all three target modes', () => {
    const targets: HealEffect['target'][] = ['self', 'team', 'active'];
    for (const target of targets) {
      const spec: HealEffect = { kind: 'heal', amount: 2, target };
      expect(spec.target).toBe(target);
      expect(spec.amount).toBe(2);
      expect(spec.kind).toBe('heal');
    }
  });

  it('is assignable to EffectSpec (union membership)', () => {
    const heal: HealEffect = { kind: 'heal', amount: 3, target: 'self' };
    // Structural upcast — fails to compile if the union doesn't
    // include HealEffect.
    const spec: EffectSpec = heal;
    expect(spec.kind).toBe('heal');
  });

  it('is assignable to InnerEffectSpec (so item-passives can heal)', () => {
    // A future passive item that heals at start-of-turn must be
    // type-legal authoring. Compile-time membership proof.
    const inner: InnerEffectSpec = { kind: 'heal', amount: 1, target: 'self' };
    expect(inner.kind).toBe('heal');
  });

  it("exhaustiveness: an explicit 'heal' switch branch compiles; omission fails type-check", () => {
    function describeKind(spec: EffectSpec): string {
      switch (spec.kind) {
        case 'gain':
        case 'shard':
        case 'draw':
        case 'combat-bonus':
        case 'damage-reduction':
        case 'monster-drop':
        case 'chest-draw':
        case 'on-play-power':
        case 'on-play-green-and-draw':
        case 'on-play-green-and-power':
        case 'banish-from-hand':
        case 'banish-from-discard':
        case 'shard-grant':
          return spec.kind;
        case 'heal':
          return `heal:${spec.target}:${spec.amount}`;
        case 'item-passive':
          return `item-passive:${spec.trigger}`;
        case 'roll-die':
          return `roll-die:${Object.keys(spec.outcomes).length}`;
        case 'equip-bonus':
          return `equip-bonus:${spec.resource}:${spec.amount}:${spec.trigger}`;
        default: {
          const _exhaustive: never = spec;
          return _exhaustive;
        }
      }
    }
    expect(describeKind({ kind: 'heal', amount: 2, target: 'team' })).toBe('heal:team:2');
    expect(describeKind({ kind: 'heal', amount: 5, target: 'self' })).toBe('heal:self:5');
    expect(describeKind({ kind: 'heal', amount: 1, target: 'active' })).toBe('heal:active:1');
  });
});

/**
 * embertide-4t2d (wun Track A): `equip-bonus` union member coverage.
 *
 * Locks the SCHEMA contract for the new equip-bonus discriminant — the
 * four resource modes, the two trigger modes, union membership, and
 * exclusion from `RollDieOutcomeEffect` (an equip-bonus has no coherent
 * meaning when fired from a transient dice face).
 */
describe("EffectSpec 'equip-bonus' (embertide-4t2d)", () => {
  it('accepts a minimally valid equip-bonus shape with every resource', () => {
    const resources: EquipBonusEffect['resource'][] = ['gem', 'power', 'shield', 'card-draw'];
    for (const resource of resources) {
      const spec: EquipBonusEffect = {
        kind: 'equip-bonus',
        resource,
        amount: 1,
        trigger: 'on-equip',
      };
      expect(spec.resource).toBe(resource);
      expect(spec.amount).toBe(1);
      expect(spec.kind).toBe('equip-bonus');
    }
  });

  it("accepts the single 'on-equip' trigger", () => {
    const spec: EquipBonusEffect = {
      kind: 'equip-bonus',
      resource: 'power',
      amount: 1,
      trigger: 'on-equip',
    };
    expect(spec.trigger).toBe('on-equip');
  });

  it('is assignable to EffectSpec (union membership)', () => {
    const bonus: EquipBonusEffect = {
      kind: 'equip-bonus',
      resource: 'power',
      amount: 1,
      trigger: 'on-equip',
    };
    const spec: EffectSpec = bonus;
    expect(spec.kind).toBe('equip-bonus');
  });

  it('is assignable to InnerEffectSpec (item-passive payloads may carry equip-bonus shapes)', () => {
    const inner: InnerEffectSpec = {
      kind: 'equip-bonus',
      resource: 'gem',
      amount: 1,
      trigger: 'on-equip',
    };
    expect(inner.kind).toBe('equip-bonus');
  });

  it('is NOT assignable to RollDieOutcomeEffect (dice faces cannot carry equip-bonus)', () => {
    const bonus: EquipBonusEffect = {
      kind: 'equip-bonus',
      resource: 'gem',
      amount: 1,
      trigger: 'on-equip',
    };
    // @ts-expect-error — equip-bonus is deliberately excluded from
    //   RollDieOutcomeEffect so dice faces cannot grant equip bonuses.
    const rejected: RollDieOutcomeEffect = bonus;
    void rejected;
  });
});
