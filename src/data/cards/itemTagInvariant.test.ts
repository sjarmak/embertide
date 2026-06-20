/**
 * Item-tag substrate invariant tests (embertide-lhlo.20,
 * kw.item-check-card-tags).
 *
 * Guards two properties:
 *
 * 1. COVERAGE INVARIANT — every `guarded.until` item-tag string referenced
 *    by a boss spec (colosseum tier2/3, zone bossSpecs) has at least one
 *    production card in KID_CARDS carrying that exact tag, OR is documented
 *    below as a known missing-opener gap (no card authored yet).
 *
 * 2. OPEN-TRIGGER INTEGRATION — each opener card carrying an `item-tag-*`
 *    flips its boss's `guarded(item-tag-*)` state to
 *    `exposed{revertsTo: guarded(item-tag-*)}` via
 *    `applyItemCheckOpenTrigger` (wiring check that the tag actually works
 *    end-to-end, not just that the data field is set). Covered: cinder-bloom
 *    (Cinderwyrm / Ashen Tyrant / Kalle Demos), and the three openers authored
 *    by embertide-akop — grapplethorn (Tidewraith), grapnels (Voltwyrm T3),
 *    aegis-pane (Sentinel).
 *
 * Missing-opener gaps: NONE remain. embertide-akop authored the three
 * opener cards that close the gaps left open by lhlo.20:
 *   - 'item-tag-grapplethorn'      → grapplethorn card (breaks Tidewraith, zone).
 *   - 'item-tag-grapnels'     → grapnels card (breaks Voltwyrm T3).
 *   - 'item-tag-aegis-pane' → aegis-pane card (breaks Sentinel, zone).
 * elysian-shield is a distinct item and deliberately carries NO item-tag.
 */

import { describe, expect, it } from 'vitest';
import type { CombatBoss } from '../../types/combat';
import { KID_CARDS } from './index';
import { applyItemCheckOpenTrigger } from '../../core/combat/archetypeResolvers/itemCheck';
import { ITEM_CHECK_EXPOSED_BONUS } from '../../core/combat/archetypeResolvers/itemCheck';
import { COLOSSEUM_CINDERWYRM_T2 } from '../colosseum/tier2';
import { COLOSSEUM_VOLTWYRM_T3, COLOSSEUM_KALLE_DEMOS_T3 } from '../colosseum/tier3';
import { ZONE_BOSS_SPECS } from '../zones/bossSpecs';

// ---------------------------------------------------------------------------
// Collect all guarded.until item-tag strings from every boss spec source.
// ---------------------------------------------------------------------------

function collectItemTags(boss: CombatBoss): readonly string[] {
  return (boss.stateTags ?? []).flatMap((t) => {
    if (t.kind !== 'guarded') return [];
    if (!t.until) return [];
    if (!t.until.startsWith('item-tag-')) return [];
    return [t.until];
  });
}

/**
 * All item-tag values referenced by guarded.until in colosseum specs.
 * Keyed by a human-readable label for test output.
 */
const COLOSSEUM_ITEM_TAG_SOURCES: ReadonlyArray<{
  label: string;
  boss: CombatBoss;
}> = [
  { label: 'COLOSSEUM_CINDERWYRM_T2', boss: COLOSSEUM_CINDERWYRM_T2 },
  { label: 'COLOSSEUM_VOLTWYRM_T3', boss: COLOSSEUM_VOLTWYRM_T3 },
  { label: 'COLOSSEUM_KALLE_DEMOS_T3', boss: COLOSSEUM_KALLE_DEMOS_T3 },
];

/**
 * All item-tag values referenced by guarded.until in zone boss specs.
 * Keyed by boss card id.
 */
const ZONE_ITEM_TAG_PAIRS: ReadonlyArray<{ id: string; until: string }> = Object.entries(
  ZONE_BOSS_SPECS,
).flatMap(([id, spec]) =>
  (spec.stateTags ?? []).flatMap((t) => {
    if (t.kind !== 'guarded') return [];
    if (!t.until) return [];
    if (!t.until.startsWith('item-tag-')) return [];
    return [{ id, until: t.until }];
  }),
);

/**
 * Union of every item-tag value referenced in either source.
 * Used for the coverage-invariant loop.
 */
const ALL_REFERENCED_ITEM_TAGS: ReadonlySet<string> = new Set([
  ...COLOSSEUM_ITEM_TAG_SOURCES.flatMap(({ boss }) => collectItemTags(boss)),
  ...ZONE_ITEM_TAG_PAIRS.map(({ until }) => until),
]);

/**
 * Tags that have NO production card yet — these are documented gaps.
 * Each entry records the reason so the test narrates the gap precisely
 * rather than failing silently.
 *
 * Invariant: if you add a card carrying one of these tags, REMOVE it
 * from this set — the no-stale-entry test will catch the leftover.
 *
 * Empty as of embertide-akop: every referenced item-tag now has a
 * production opener card (grapplethorn / grapnels / aegis-pane closed the
 * last three gaps). Re-populate this map only if a future boss spec
 * introduces an item-tag with no authored opener yet.
 */
const KNOWN_MISSING_OPENER_TAGS: ReadonlyMap<string, string> = new Map([]);

// ---------------------------------------------------------------------------
// Helper: find all production cards carrying a given tag.
// ---------------------------------------------------------------------------

function cardsWithTag(tag: string): readonly (typeof KID_CARDS)[number][] {
  return KID_CARDS.filter((c) => c.tags?.includes(tag));
}

// ---------------------------------------------------------------------------
// Coverage invariant.
// ---------------------------------------------------------------------------

describe('item-tag coverage invariant (lhlo.20)', () => {
  it('ALL_REFERENCED_ITEM_TAGS contains the four expected item-tag strings', () => {
    expect(ALL_REFERENCED_ITEM_TAGS.has('item-tag-bomb')).toBe(true);
    expect(ALL_REFERENCED_ITEM_TAGS.has('item-tag-grapplethorn')).toBe(true);
    expect(ALL_REFERENCED_ITEM_TAGS.has('item-tag-grapnels')).toBe(true);
    expect(ALL_REFERENCED_ITEM_TAGS.has('item-tag-aegis-pane')).toBe(true);
  });

  it.each([...ALL_REFERENCED_ITEM_TAGS])(
    '%s — has >=1 production card OR is a documented missing-opener gap',
    (tag) => {
      const openers = cardsWithTag(tag);
      if (openers.length > 0) {
        // Tag is covered — assert the cards actually carry it.
        for (const card of openers) {
          expect(card.tags).toContain(tag);
        }
        return;
      }
      // Tag has no card yet — must be in the known-gap registry.
      const gapReason = KNOWN_MISSING_OPENER_TAGS.get(tag);
      expect(
        gapReason,
        `item-tag '${tag}' has no production card AND is not in KNOWN_MISSING_OPENER_TAGS. ` +
          `Either add a card carrying this tag, or register it as a gap.`,
      ).toBeDefined();
    },
  );

  it('KNOWN_MISSING_OPENER_TAGS has no stale entries (every gap tag is still unresolved)', () => {
    for (const [tag, reason] of KNOWN_MISSING_OPENER_TAGS) {
      const openers = cardsWithTag(tag);
      expect(
        openers.length,
        `Gap registry entry '${tag}' is stale — a card now carries this tag. ` +
          `Remove it from KNOWN_MISSING_OPENER_TAGS. Gap reason was: ${reason}`,
      ).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// cinder-bloom specific assertions.
// ---------------------------------------------------------------------------

describe('cinder-bloom card — item-tag-bomb substrate (lhlo.20)', () => {
  const cinderBloom = KID_CARDS.find((c) => c.id === 'cinder-bloom');

  it('cinder-bloom exists in KID_CARDS', () => {
    expect(cinderBloom).toBeDefined();
  });

  it('cinder-bloom carries tags: ["item-tag-bomb"]', () => {
    expect(cinderBloom?.tags).toEqual(['item-tag-bomb']);
  });

  it('cinder-bloom is the sole production card with item-tag-bomb', () => {
    const bombers = cardsWithTag('item-tag-bomb');
    expect(bombers.map((c) => c.id)).toEqual(['cinder-bloom']);
  });

  // Open-trigger integration — assert that playing cinder-bloom against
  // Cinderwyrm flips guarded → exposed.
  it('playing cinder-bloom against COLOSSEUM_CINDERWYRM_T2 flips guarded(item-tag-bomb) → exposed{revertsTo}', () => {
    if (!cinderBloom) throw new Error('cinder-bloom not found in KID_CARDS');

    const next = applyItemCheckOpenTrigger(COLOSSEUM_CINDERWYRM_T2, cinderBloom);

    expect(next).not.toBe(COLOSSEUM_CINDERWYRM_T2);
    const tag = next.stateTags?.[0];
    expect(tag?.kind).toBe('exposed');
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag');
    expect(tag.bonus).toBe(ITEM_CHECK_EXPOSED_BONUS);
    expect(tag.revertsTo).toEqual({ kind: 'guarded', until: 'item-tag-bomb' });
  });

  // Kalle Demos T3 shares the same item-tag-bomb discriminant.
  it('playing cinder-bloom against COLOSSEUM_KALLE_DEMOS_T3 also flips guarded(item-tag-bomb) → exposed{revertsTo}', () => {
    if (!cinderBloom) throw new Error('cinder-bloom not found in KID_CARDS');

    const next = applyItemCheckOpenTrigger(COLOSSEUM_KALLE_DEMOS_T3, cinderBloom);

    expect(next).not.toBe(COLOSSEUM_KALLE_DEMOS_T3);
    const tag = next.stateTags?.[0];
    expect(tag?.kind).toBe('exposed');
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag');
    expect(tag.bonus).toBe(ITEM_CHECK_EXPOSED_BONUS);
    expect(tag.revertsTo).toEqual({ kind: 'guarded', until: 'item-tag-bomb' });
  });

  // Zone boss: Ashen Tyrant uses the same bomb-tag discriminant.
  it('playing cinder-bloom against Ashen Tyrant (ZONE_BOSS_SPECS) flips guarded(item-tag-bomb) → exposed{revertsTo}', () => {
    if (!cinderBloom) throw new Error('cinder-bloom not found in KID_CARDS');

    const kingDodoSpec = ZONE_BOSS_SPECS['ashen-tyrant'];
    // Construct a minimal CombatBoss matching the ashen-tyrant spec shape.
    const kingDodongoBoss: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'ashen-tyrant',
      archetype: kingDodoSpec.archetype,
      stateTags: kingDodoSpec.stateTags,
    };

    const next = applyItemCheckOpenTrigger(kingDodongoBoss, cinderBloom);

    expect(next).not.toBe(kingDodongoBoss);
    const tag = next.stateTags?.[0];
    expect(tag?.kind).toBe('exposed');
    if (tag?.kind !== 'exposed') throw new Error('expected exposed tag');
    expect(tag.bonus).toBe(ITEM_CHECK_EXPOSED_BONUS);
    expect(tag.revertsTo).toEqual({ kind: 'guarded', until: 'item-tag-bomb' });
  });

  // Voltwyrm T3 uses item-tag-grapnels — cinder-bloom must NOT break it.
  it('playing cinder-bloom against COLOSSEUM_VOLTWYRM_T3 is a no-op (wrong item-tag)', () => {
    if (!cinderBloom) throw new Error('cinder-bloom not found in KID_CARDS');

    const result = applyItemCheckOpenTrigger(COLOSSEUM_VOLTWYRM_T3, cinderBloom);
    expect(result).toBe(COLOSSEUM_VOLTWYRM_T3);
  });
});

// ---------------------------------------------------------------------------
// embertide-akop opener cards — open-trigger integration.
//
// Each opener carries exactly one item-tag and flips its target boss's
// guarded(item-tag-*) → exposed{revertsTo}. Cross-checks confirm an opener
// does NOT break a boss guarded by a different item-tag (wrong-tag no-op).
// ---------------------------------------------------------------------------

/** Build a minimal CombatBoss from a ZONE_BOSS_SPECS entry (id-keyed). */
function zoneBoss(id: string): CombatBoss {
  const spec = ZONE_BOSS_SPECS[id];
  if (!spec) throw new Error(`ZONE_BOSS_SPECS has no entry for '${id}'`);
  return {
    hp: 20,
    hpMax: 20,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: id,
    archetype: spec.archetype,
    stateTags: spec.stateTags,
  };
}

/** Locate an opener card by id, asserting it exists in KID_CARDS. */
function opener(id: string) {
  const card = KID_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`opener card '${id}' not found in KID_CARDS`);
  return card;
}

describe('akop opener cards — item-tag substrate + open-trigger integration', () => {
  const OPENERS: ReadonlyArray<{
    cardId: string;
    tag: string;
    boss: () => CombatBoss;
    bossLabel: string;
  }> = [
    {
      cardId: 'grapplethorn',
      tag: 'item-tag-grapplethorn',
      boss: () => zoneBoss('tidewraith'),
      bossLabel: 'Tidewraith (ZONE_BOSS_SPECS)',
    },
    {
      cardId: 'grapnels',
      tag: 'item-tag-grapnels',
      boss: () => COLOSSEUM_VOLTWYRM_T3,
      bossLabel: 'COLOSSEUM_VOLTWYRM_T3',
    },
    {
      cardId: 'aegis-pane',
      tag: 'item-tag-aegis-pane',
      boss: () => zoneBoss('sentinel'),
      bossLabel: 'Sentinel (ZONE_BOSS_SPECS)',
    },
  ];

  it.each(OPENERS)(
    '$cardId carries exactly [$tag] and is its sole production card',
    ({ cardId, tag }) => {
      const card = opener(cardId);
      expect(card.tags).toEqual([tag]);
      expect(cardsWithTag(tag).map((c) => c.id)).toEqual([cardId]);
    },
  );

  it.each(OPENERS)(
    'playing $cardId against $bossLabel flips guarded($tag) → exposed{revertsTo}',
    ({ cardId, tag, boss }) => {
      const target = boss();
      const next = applyItemCheckOpenTrigger(target, opener(cardId));

      expect(next).not.toBe(target);
      const stateTag = next.stateTags?.[0];
      expect(stateTag?.kind).toBe('exposed');
      if (stateTag?.kind !== 'exposed') throw new Error('expected exposed tag');
      expect(stateTag.bonus).toBe(ITEM_CHECK_EXPOSED_BONUS);
      expect(stateTag.revertsTo).toEqual({ kind: 'guarded', until: tag });
    },
  );

  it('each opener is a no-op against a boss guarded by a different item-tag', () => {
    // grapplethorn must NOT break Voltwyrm (grapnels-guarded).
    expect(applyItemCheckOpenTrigger(COLOSSEUM_VOLTWYRM_T3, opener('grapplethorn'))).toBe(
      COLOSSEUM_VOLTWYRM_T3,
    );
    // grapnels must NOT break Tidewraith (grapplethorn-guarded).
    const tidewraith = zoneBoss('tidewraith');
    expect(applyItemCheckOpenTrigger(tidewraith, opener('grapnels'))).toBe(tidewraith);
    // aegis-pane must NOT break Voltwyrm (grapnels-guarded).
    expect(applyItemCheckOpenTrigger(COLOSSEUM_VOLTWYRM_T3, opener('aegis-pane'))).toBe(
      COLOSSEUM_VOLTWYRM_T3,
    );
  });

  it('elysian-shield carries NO item-tag (distinct from aegis-pane)', () => {
    const hylianShield = KID_CARDS.find((c) => c.id === 'elysian-shield');
    expect(hylianShield).toBeDefined();
    const itemTags = (hylianShield?.tags ?? []).filter((t) => t.startsWith('item-tag-'));
    expect(itemTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Colosseum item-check bosses — structural check that every colosseum
// item-check boss has item-tag-* in its guarded.until.
// ---------------------------------------------------------------------------

describe('colosseum item-check bosses — all use item-tag-* discriminants (lhlo.20)', () => {
  it.each(COLOSSEUM_ITEM_TAG_SOURCES.filter(({ boss }) => boss.archetype === 'item-check'))(
    '$label guarded.until starts with item-tag-',
    ({ label, boss }) => {
      const tags = collectItemTags(boss);
      expect(
        tags.length,
        `${label} is item-check but has no item-tag-* guarded.until`,
      ).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, `${label} guarded.until`).toMatch(/^item-tag-/);
      }
    },
  );
});
