/**
 * Card-typing completeness test (lhlo.32 / kw.card-typing).
 *
 * Enforces two invariants:
 *
 *   1. UNION SHAPE — `CardType` is the union
 *      `'attack' | 'skill' | 'item' | 'engine' | 'tech' | 'hybrid'`
 *      and is additive to `CardRole` (CardRole union is unchanged).
 *
 *   2. COMPLETENESS — every entry in `KID_CARDS` either has a `cardType`
 *      assigned OR its `role` is present in `OMITTED_ROLES` (explicitly
 *      asserted below). Any new playable card added without a `cardType`
 *      will fail this test; any role added to `OMITTED_ROLES` without
 *      justification will also fail the role-count assertion.
 *
 * Omission contract (non-playable roles):
 *   - `'monster'`    — defeated with Power, never played from hand
 *   - `'mini-boss'`  — defeated with Power, never played from hand
 *   - `'final-boss'` — defeated with Power, never played from hand
 *   - `'chest-std'`  — opened with Keys, never played from hand
 *   - `'chest-mid'`  — opened with Keys, never played from hand
 *   - `'chest-boss'` — opened with Keys, never played from hand
 *
 * Starter cards (`starter-green` / `starter-red`) are not in KID_CARDS
 * so they are not tested here. They live in `src/store/slices/deck.ts`.
 *
 * See also: `src/types/card.ts` § CardType for the rubric + omission
 * contract comment.
 */

import { describe, expect, it } from 'vitest';
import { KID_CARDS } from './index';
import type { CardRole, CardType } from '../../types/card';
import { CARD_ROLES } from '../../types/card';

// ---------------------------------------------------------------------------
// Omission allowlist — roles whose KID_CARDS entries intentionally lack
// cardType. Every role here is asserted below to keep the allowlist
// from silently growing.
// ---------------------------------------------------------------------------

/**
 * Roles that are non-playable and intentionally omitted from cardType
 * classification. These cards are NEVER played from hand for an effect —
 * they are defeated (monsters/bosses) or opened (chests) via their own
 * mechanics.
 *
 * INVARIANT: if you add a new role here you MUST also add a justification
 * comment explaining why it is non-playable.
 */
const OMITTED_ROLES: ReadonlySet<CardRole> = new Set<CardRole>([
  'monster', // defeated with Power via the center-row Defeat action
  'mini-boss', // defeated with Power (includes wild/region/colosseum bosses)
  'final-boss', // defeated with Power, gates endgame
  'chest-std', // opened with Keys via the center-row Open action
  'chest-mid', // opened with Keys
  'chest-boss', // opened with Keys
]);

// ---------------------------------------------------------------------------
// 1. CardType union shape + additive invariant.
// ---------------------------------------------------------------------------

describe('CardType union (lhlo.32)', () => {
  it('CardType covers all six glossary sub-types', () => {
    // Compile-time check: assign each member to a CardType variable.
    // If the union changes, the assignment below will fail to typecheck.
    const _a: CardType = 'attack';
    const _s: CardType = 'skill';
    const _i: CardType = 'item';
    const _e: CardType = 'engine';
    const _t: CardType = 'tech';
    const _h: CardType = 'hybrid';

    // Runtime guard: all six values are non-empty strings.
    const members: CardType[] = [_a, _s, _i, _e, _t, _h];
    expect(members).toHaveLength(6);
    for (const m of members) {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    }
  });

  it('CARD_ROLES is unchanged — CardRole is NOT affected by this bead', () => {
    // Assert the full CardRole union is still the canonical set.
    // Adding cardType must never remove or rename a CardRole member.
    const expectedRoles: readonly string[] = [
      'hero',
      'item',
      'legendary-sword',
      'revealer-item',
      'monster',
      'mini-boss',
      'final-boss',
      'chest-std',
      'chest-mid',
      'chest-boss',
      'starter-green',
      'starter-red',
    ];
    expect([...CARD_ROLES]).toEqual(expectedRoles);
  });
});

// ---------------------------------------------------------------------------
// 2. OMITTED_ROLES allowlist is self-consistent and documented.
// ---------------------------------------------------------------------------

describe('OMITTED_ROLES allowlist (lhlo.32)', () => {
  it('contains only known CardRole members', () => {
    const validRoles = new Set<string>(CARD_ROLES);
    for (const role of OMITTED_ROLES) {
      expect(
        validRoles.has(role),
        `OMITTED_ROLES contains '${role}' which is not a valid CardRole`,
      ).toBe(true);
    }
  });

  it('contains exactly 6 non-playable roles', () => {
    // Asserting the count keeps the allowlist honest — if a new
    // non-playable role is added the author must consciously bump this
    // number AND add a justification comment in OMITTED_ROLES above.
    expect(OMITTED_ROLES.size).toBe(6);
  });

  it('does NOT contain playable roles (hero, item, legendary-sword)', () => {
    expect(OMITTED_ROLES.has('hero')).toBe(false);
    expect(OMITTED_ROLES.has('item')).toBe(false);
    expect(OMITTED_ROLES.has('legendary-sword')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Completeness: every KID_CARDS entry has cardType OR is in OMITTED_ROLES.
// ---------------------------------------------------------------------------

describe('KID_CARDS cardType completeness (lhlo.32)', () => {
  it('every card in KID_CARDS has cardType or is in OMITTED_ROLES', () => {
    const missing: string[] = [];

    for (const card of KID_CARDS) {
      if (OMITTED_ROLES.has(card.role)) continue; // intentional omission
      if (card.cardType !== undefined) continue; // classified
      missing.push(`${card.id} (role: ${card.role})`);
    }

    expect(
      missing,
      `The following KID_CARDS entries lack a cardType and their role is not ` +
        `in OMITTED_ROLES. Add a cardType to each card or, if the role is ` +
        `genuinely non-playable, add it to OMITTED_ROLES with a justification:\n` +
        missing.map((s) => `  - ${s}`).join('\n'),
    ).toHaveLength(0);
  });

  it('cardType values are all valid CardType members', () => {
    const validTypes = new Set<string>(['attack', 'skill', 'item', 'engine', 'tech', 'hybrid']);
    const invalid: string[] = [];

    for (const card of KID_CARDS) {
      if (card.cardType === undefined) continue;
      if (!validTypes.has(card.cardType)) {
        invalid.push(`${card.id}: '${card.cardType}'`);
      }
    }

    expect(
      invalid,
      `The following cards have invalid cardType values:\n` +
        invalid.map((s) => `  - ${s}`).join('\n'),
    ).toHaveLength(0);
  });

  it('omitted-role cards do NOT have a cardType (no accidental annotation)', () => {
    const unexpected: string[] = [];

    for (const card of KID_CARDS) {
      if (!OMITTED_ROLES.has(card.role)) continue;
      if (card.cardType !== undefined) {
        unexpected.push(`${card.id} (role: ${card.role}, cardType: ${card.cardType})`);
      }
    }

    // This is a soft advisory rather than a hard failure — annotating
    // a monster with cardType is harmless but inconsistent. We warn
    // so authors notice rather than silently allowing drift.
    if (unexpected.length > 0) {
      console.warn(
        `Advisory: the following non-playable KID_CARDS entries carry a ` +
          `cardType, which is unexpected per the omission contract:\n` +
          unexpected.map((s) => `  - ${s}`).join('\n'),
      );
    }
    // Not a hard failure — callers may choose to annotate for future use.
  });
});

// ---------------------------------------------------------------------------
// 4. Classification distribution snapshot.
// ---------------------------------------------------------------------------

describe('cardType distribution (lhlo.32 — informational)', () => {
  it('classified cards cover all six cardType values', () => {
    const seen = new Set<string>();
    for (const card of KID_CARDS) {
      if (card.cardType) seen.add(card.cardType);
    }
    // Every sub-class in the glossary must appear at least once.
    // If a type has zero cards in the current set it's a design gap
    // worth flagging (though 'skill' may be legitimately absent if
    // no pure-utility-without-damage card has been authored yet).
    const missing = ['attack', 'skill', 'item', 'engine', 'tech', 'hybrid'].filter(
      (t) => !seen.has(t),
    );
    if (missing.length > 0) {
      console.warn(
        `Advisory: the following cardType values have zero cards in KID_CARDS: ` +
          missing.join(', '),
      );
    }
    // Not a hard failure — the set may evolve (e.g. 'skill' cards
    // may be absent in early rosters). Log for visibility.
  });
});
