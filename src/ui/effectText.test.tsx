import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  combatSummaryTextFor,
  effectNodesFor,
  effectTextFor,
  tokenizeResourceText,
} from './effectText';
import {
  ALWAYS_AVAILABLE,
  KID_CARDS,
  TEST_PASSIVE_SAMPLE_CARD,
  TEST_SHARD_GRANT_SAMPLE_CARD,
} from '../data/cards';
import { STARTER_GREEN, STARTER_RED } from '../store/slices/deck';
import type { Card } from '../types/card';

function findCard(id: string): Card {
  const c =
    KID_CARDS.find((card) => card.id === id) ?? ALWAYS_AVAILABLE.find((card) => card.id === id);
  if (!c) throw new Error(`Missing test fixture card: ${id}`);
  return c;
}

describe('effectTextFor (shared effect-text module)', () => {
  it('returns "+1g" for starter-green', () => {
    expect(effectTextFor(STARTER_GREEN)).toBe('+1g');
  });

  it('returns "+1 power" for starter-red', () => {
    expect(effectTextFor(STARTER_RED)).toBe('+1 power');
  });

  it('returns "+2g, +1 key" for sage-keeper', () => {
    expect(effectTextFor(findCard('sage-keeper'))).toBe('+2g, +1 key');
  });

  it('returns "+2 power" for water-warrior', () => {
    expect(effectTextFor(findCard('water-warrior'))).toBe('+2 power');
  });

  it('returns "+2g" for scholar-princess (mvjx — phase differentiation)', () => {
    expect(effectTextFor(findCard('scholar-princess'))).toBe('+2g');
  });

  it('returns "+1g, +1 power" for wandering-merchant', () => {
    expect(effectTextFor(findCard('wandering-merchant'))).toBe('+1g, +1 power');
  });

  it('describes ranch-keeper main fire + live boss trigger (embertide-g6a + mvjx)', () => {
    // mvjx (2026-04-25): added flat +1g main-phase fire; boss heart
    // still fires through ranchKeeperHealBonus.
    const text = effectTextFor(findCard('ranch-keeper'));
    expect(text).toContain('+1g');
    expect(text).toContain('boss');
    expect(text).toContain('\u2665');
    expect(text.toLowerCase()).not.toContain('v0.2');
  });

  it('describes forest-sage as a d6 omen teaser (embertide-aqkj)', () => {
    // aqkj (2026-04-25): card-face text shortened from the full 6-face
    // outcome table to a teaser to keep card height aligned with other
    // heroes. RollCommitModal is the source-of-truth UI for face→effect.
    const text = effectTextFor(findCard('forest-sage'));
    expect(text).toBe('Roll d6 Omen');
  });

  it('describes mountain-king live trigger (embertide-g6a)', () => {
    const text = effectTextFor(findCard('mountain-king'));
    expect(text).toContain('per kill');
    expect(text.toLowerCase()).not.toContain('v0.2');
  });

  // embertide-s2ub (wun Track A authoring): short-sword / tower-shield
  // migrated from the legacy combat-bonus / damage-reduction rules-text
  // shim to the live equip-bonus dispatcher. The card-face text now
  // describes the on-equip main-phase fire instead of the old "Relic:"
  // prefix; the start-of-turn baseId-keyed trigger in
  // `applyItemTrigger` (src/store/slices/endgame.ts) is unchanged but
  // is no longer the on-card rules text.
  it('renders the equip-bonus on-equip text for short-sword (+1 power on equip)', () => {
    expect(effectTextFor(findCard('short-sword'))).toBe('+1 power on equip');
  });

  it('renders the equip-bonus on-equip text for tower-shield, plus its on-damage passive (ppf9.3.1 dual-slot)', () => {
    // tower-shield is the first dual-slot v2.0 market item: equip-bonus
    // gem+1 on-equip AND a Card.passive on-damage damage-reduction +1.
    // ppf9.4.4 render policy composes both halves with a `\n` separator
    // rendered via `white-space: pre-line` on `.card-template-effect`.
    expect(effectTextFor(findCard('tower-shield'))).toBe(
      '+1g on equip\nPassive: Reduce damage taken by 1',
    );
  });

  it('renders the equip-bonus on-equip text for elysian-shield, plus its on-damage passive (ppf9.4.2 dual-slot)', () => {
    // elysian-shield is the second dual-slot v2.1 market item: same
    // equip-bonus gem+1 on-equip + Card.passive on-damage shape as
    // tower-shield, just at green:4 with a combat-side absorb hp 4.
    // The render-policy invariant in cardPassives.test.ts guards against
    // the dual-slot text dropping the passive line; this assertion pins
    // the exact composed string for the live card.
    expect(effectTextFor(findCard('elysian-shield'))).toBe(
      '+1g on equip\nPassive: Reduce damage taken by 1',
    );
  });

  it('returns "+2g" for mystic', () => {
    expect(effectTextFor(findCard('mystic'))).toBe('+2g');
  });

  it('returns "+2 power" for militia-grunt', () => {
    expect(effectTextFor(findCard('militia-grunt'))).toBe('+2 power');
  });

  it('summarises the heart drop for monsters (embertide-d80)', () => {
    const monster = KID_CARDS.find((c) => c.role === 'monster');
    if (!monster) throw new Error('no monster fixture');
    // Every basic monster drops +1 heart on defeat; the card face must
    // describe the drop so the Beast card isn't blank.
    expect(effectTextFor(monster)).toBe('+1 \u2665');
  });

  it('summarises the heart drop for mini-bosses (embertide-d80)', () => {
    const miniBoss = KID_CARDS.find((c) => c.role === 'mini-boss');
    if (!miniBoss) throw new Error('no mini-boss fixture');
    expect(effectTextFor(miniBoss)).toBe('+2 \u2665');
  });

  it('summarises the final-boss heart drop without the v1 endgame suffix (v2 pivot)', () => {
    // v1 shipped the final-boss card with `triggers: 'endgame'`, which
    // rendered an "— Endgame" tag on the card face. v2's co-op pivot
    // removed the endgame machinery entirely (u-1a), so the data card no
    // longer carries that trigger and the label is the plain heart drop.
    // The effectText endgame-suffix branch is retained for authoring-level
    // use (covered by the separate constructed-card test below) but no
    // shipped card exercises it in v2.
    const finalBoss = KID_CARDS.find((c) => c.role === 'final-boss');
    if (!finalBoss) throw new Error('no final-boss fixture');
    expect(effectTextFor(finalBoss)).toBe('+2 \u2665');
  });

  it('resolves duplicates via baseId (water-warrior-2 -> water-warrior)', () => {
    const water = findCard('water-warrior');
    const duplicate = { ...water, id: 'water-warrior-2', baseId: 'water-warrior' };
    expect(effectTextFor(duplicate)).toBe('+2 power');
  });

  // embertide-bv5 — Card.effects is typed `unknown`. effectTextFor must
  // narrow via a type guard and return a safe empty string when effects is
  // The v1 defensive-narrowing suite (malformed `effects: null | undefined |
  // string | number | {}`) is retired. EffectSpec (u-1b) makes the authoring
  // path strict at compile time — the class of errors those tests defended
  // against is now a TypeScript error, not a runtime edge case. The one
  // surviving case (well-formed drop object) is re-expressed below as a
  // typed check so the heart-rendering path still has positive coverage.
  describe('monster drop rendering (typed via EffectSpec, u-1b)', () => {
    const monsterTemplate: Omit<Card, 'effects'> = {
      id: 'test-monster',
      role: 'monster',
      cost: {},
    };

    it('renders the HP-heal drop as "+N ♥" for a monster-drop effect', () => {
      const card: Card = {
        ...monsterTemplate,
        effects: { kind: 'monster-drop', hearts: 3 },
      };
      expect(effectTextFor(card)).toBe('+3 \u2665');
    });

    it('returns empty string when hearts is 0 (defensive: no-op drop)', () => {
      const card: Card = {
        ...monsterTemplate,
        effects: { kind: 'monster-drop', hearts: 0 },
      };
      expect(effectTextFor(card)).toBe('');
    });

    // r94e drop-variety: optional `gems` / `cardDraw` / `keys` fields
    // layer onto the heart token so the card face advertises the full
    // loot bundle. Order is `+N ♥, +Ng, +N key, Draw N` for stability.
    it('renders "+1 ♥, +1g" for a heart + gem drop (r94e generic regular)', () => {
      const card: Card = {
        ...monsterTemplate,
        effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
      };
      expect(effectTextFor(card)).toBe('+1 ♥, +1g');
    });

    it('renders "+2 ♥, +2g" for a mini-boss heart + gem drop (r94e)', () => {
      const card: Card = {
        ...monsterTemplate,
        role: 'mini-boss',
        effects: { kind: 'monster-drop', hearts: 2, gems: 2 },
      };
      expect(effectTextFor(card)).toBe('+2 ♥, +2g');
    });

    it('renders "+3 ♥, Draw 1" for a wild-boss heart + cardDraw drop (r94e)', () => {
      const card: Card = {
        ...monsterTemplate,
        role: 'mini-boss',
        effects: { kind: 'monster-drop', hearts: 3, cardDraw: 1 },
      };
      expect(effectTextFor(card)).toBe('+3 ♥, Draw 1');
    });

    it('renders "+2 ♥, +2g, +1 key, Draw 1" for the full loot bundle (r94e)', () => {
      const card: Card = {
        ...monsterTemplate,
        role: 'mini-boss',
        effects: { kind: 'monster-drop', hearts: 2, gems: 2, keys: 1, cardDraw: 1 },
      };
      expect(effectTextFor(card)).toBe('+2 ♥, +2g, +1 key, Draw 1');
    });

    it('renders "+1g" alone for a hearts=0 / gems=1 drop (variety alt-drop edge)', () => {
      const card: Card = {
        ...monsterTemplate,
        effects: { kind: 'monster-drop', hearts: 0, gems: 1 },
      };
      expect(effectTextFor(card)).toBe('+1g');
    });
  });

  // REQ-13 Phase 2c (gm0.3): `heal` EffectSpec discriminant renders a
  // generic "Heal +N ♥" / "Heal teammate +N ♥" / "Heal active +N ♥"
  // summary on the card face for any non-wisp card. The wisp keeps
  // its bespoke "Revive teammate to full HP" string because the heal
  // amount is computed at dispatch (target.hpMax) rather than authored.
  describe('heal rendering (REQ-13 Phase 2c)', () => {
    const itemTemplate: Omit<Card, 'effects'> = {
      id: 'test-heal-item',
      role: 'item',
      cost: { green: 0 },
      itemKind: 'item-active',
      cooldownTurns: 0,
      lastUsedTurn: null,
    };

    it("renders 'Heal +N ♥' for a self-target heal", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'heal', amount: 2, target: 'self' },
      };
      expect(effectTextFor(card)).toBe('Heal +2 ♥');
    });

    it("renders 'Heal teammate +N ♥' for a team-target heal", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'heal', amount: 3, target: 'team' },
      };
      expect(effectTextFor(card)).toBe('Heal teammate +3 ♥');
    });

    it("renders 'Heal active +N ♥' for an active-target heal", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'heal', amount: 1, target: 'active' },
      };
      expect(effectTextFor(card)).toBe('Heal active +1 ♥');
    });

    it("the migrated wisp card retains the bespoke 'Revive teammate to full HP' string", () => {
      // The wisp's EffectSpec is now `heal` (gm0.3 migration), but
      // because the heal amount is computed at dispatch (target.hpMax),
      // the card-face text uses the bespoke baseId branch instead of
      // the generic "Heal teammate +0 ♥" line that would otherwise
      // fall out of the sentinel-amount author shape.
      const wisp = findCard('wisp');
      expect(wisp.effects.kind).toBe('heal');
      expect(effectTextFor(wisp)).toBe('Revive teammate to full HP');
    });

    it('great-wisp renders the same revive string as plain wisp (ppf9.2)', () => {
      // Post-ppf9.2 great-wisp migrated from `{kind:'gain'}` placeholder
      // to `{kind:'heal', target:'team', amount:0}` — the same sentinel
      // shape as plain wisp. Card-face text is the bespoke revive
      // string; the in-combat differentiation (combat-heal amount:5 vs
      // plain wisp's 3) surfaces on the combat-summary line.
      const greatWisp = findCard('great-wisp');
      expect(greatWisp.effects.kind).toBe('heal');
      expect(effectTextFor(greatWisp)).toBe('Revive teammate to full HP');
    });

    it("wisp-in-bottle renders the bespoke 'refills 1×' revive string (ppf9.2)", () => {
      // wisp-in-bottle is the reusable-once-per-combat wisp variant.
      // Same `{kind:'heal', target:'team', amount:0}` sentinel as the
      // other fairies; the card-face string adds the "refills 1×"
      // qualifier so buyers/holders see the reusability without
      // having to know the bottle re-equip rule.
      const bottle = findCard('wisp-in-bottle');
      expect(bottle.effects.kind).toBe('heal');
      expect(effectTextFor(bottle)).toBe('Revive teammate to full HP, refills 1×');
    });
  });

  // REQ-13 Phase 2b: `item-passive` EffectSpec discriminant renders as
  // "Passive: <description>" on the card face. Keyed on `effects.kind`
  // (not baseId) because every passive authors its own description.
  describe('item-passive rendering (REQ-13 Phase 2b)', () => {
    it("prefixes the author description with 'Passive: ' for the sample card", () => {
      expect(effectTextFor(TEST_PASSIVE_SAMPLE_CARD)).toBe(
        'Passive: +1 green at the start of your turn',
      );
    });

    it('works for an inline-authored passive on any item-role card', () => {
      const card: Card = {
        id: 'ad-hoc-passive',
        role: 'item',
        cost: { green: 0 },
        effects: {
          kind: 'item-passive',
          description: '+1 power on combat enter',
          trigger: 'on-combat-enter',
          effect: { kind: 'combat-bonus', red: 1 },
        },
        itemKind: 'item-passive',
      };
      expect(effectTextFor(card)).toBe('Passive: +1 power on combat enter');
    });
  });

  // ppf9.4.4 render policy: dual-slot items carry BOTH a non-passive
  // `Card.effects` (e.g. equip-bonus on-equip) AND a `Card.passive`
  // ItemPassiveEffect. The card-face surface composes both halves on
  // separate lines (`<base>\n<passive>`); CSS `white-space: pre-line`
  // on `.card-template-effect` renders the newline as a real line break.
  // The cardPassives.test.ts:167 invariant ('every passive-bearing card
  // surfaces "Passive" in effectTextFor output') is now satisfied for
  // dual-slot cards via this composition.
  describe('dual-slot rendering (ppf9.4.4)', () => {
    it('appends Passive line below equip-bonus base for a dual-slot item', () => {
      const card: Card = {
        id: 'test-dual-slot-shield',
        role: 'item',
        cost: { green: 4 },
        effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
        passive: {
          kind: 'item-passive',
          description: 'Reduce damage taken by 1',
          trigger: 'on-damage',
          effect: { kind: 'damage-reduction', amount: 1 },
        },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
      expect(effectTextFor(card)).toBe('+1g on equip\nPassive: Reduce damage taken by 1');
    });

    it('renders passive-only when the dual-slot card has no base text', () => {
      // Synthetic edge case: an item-role card with `effects.kind === 'gain'`
      // (no effectText branch matches; baseId default returns '') plus a
      // Card.passive. The wrapper still surfaces the passive cleanly.
      const card: Card = {
        id: 'test-passive-only-via-second-slot',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'gain', red: 0 },
        passive: {
          kind: 'item-passive',
          description: '+1 gem when you defeat a monster',
          trigger: 'on-monster-defeated',
          effect: { kind: 'gain', green: 1 },
        },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
      expect(effectTextFor(card)).toBe('Passive: +1 gem when you defeat a monster');
    });

    it('non-passive equip-bonus card with no Card.passive renders unchanged', () => {
      // Regression guard: legacy single-slot equip-bonus items must NOT
      // grow a 'Passive: ...' suffix. Confirms the wrapper short-circuits
      // when getPassives() returns an empty array.
      const card: Card = {
        id: 'test-equip-only',
        role: 'item',
        cost: { green: 2 },
        effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
      expect(effectTextFor(card)).toBe('+1 power on equip');
    });
  });

  // embertide-4t2d (wun Track A): `equip-bonus` EffectSpec
  // discriminant renders the resource grant + trigger so the rules-
  // text mirrors the actual main-phase fire that lands when the item
  // is equipped. Tokenizer downstream substitutes "+N power" with the
  // sword icon, "+Ng" with the green-shard icon, etc.
  describe('equip-bonus rendering (embertide-4t2d / wun Track A)', () => {
    const itemTemplate: Omit<Card, 'effects'> = {
      id: 'test-equip-bonus-item',
      role: 'item',
      cost: { green: 4 },
      itemKind: 'item-active',
      cooldownTurns: 0,
      lastUsedTurn: null,
    };

    it("renders '+1 power on equip' for a power-resource on-equip bonus", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
      };
      expect(effectTextFor(card)).toBe('+1 power on equip');
    });

    it("renders '+1g on equip' for a gem-resource on-equip bonus", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
      };
      expect(effectTextFor(card)).toBe('+1g on equip');
    });

    it("renders 'Draw 1 on equip' for a card-draw resource bonus", () => {
      const card: Card = {
        ...itemTemplate,
        effects: { kind: 'equip-bonus', resource: 'card-draw', amount: 1, trigger: 'on-equip' },
      };
      expect(effectTextFor(card)).toBe('Draw 1 on equip');
    });

    it('renders the migrated bow card with the canonical "+1 power on equip" text', () => {
      const bow = findCard('bow');
      expect(bow.effects.kind).toBe('equip-bonus');
      expect(effectTextFor(bow)).toBe('+1 power on equip');
    });

    it('tokenizes the migrated bow card with a sword icon (no literal "power" word)', () => {
      const bow = findCard('bow');
      const { container } = render(<div>{effectNodesFor(bow)}</div>);
      expect(container.querySelector('svg[aria-label="sword"]')).not.toBeNull();
      expect(container.textContent ?? '').toContain('+1');
      expect(container.textContent ?? '').toContain('on equip');
      expect(container.textContent ?? '').not.toContain('power');
    });
  });

  // REQ-13 Phase 2d (gm0.4): `shard-grant` EffectSpec discriminant.
  // Renders a comma-separated list of capitalized "<Shard> shard"
  // tokens which the downstream tokenizer substitutes with the
  // per-shard icon. The combat-resolve `shardGrants` payload flow
  // (region-boss defeats) is unaffected — this is the parallel
  // declarative path for OTHER shard sources.
  describe('shard-grant rendering (REQ-13 Phase 2d / gm0.4)', () => {
    it('renders the wisdom-shard sample card as "Wisdom shard"', () => {
      expect(effectTextFor(TEST_SHARD_GRANT_SAMPLE_CARD)).toBe('Wisdom shard');
    });

    it('renders an inline-authored courage-shard card as "Courage shard"', () => {
      const card: Card = {
        id: 'ad-hoc-courage',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['courage'] },
        itemKind: 'item-active',
      };
      expect(effectTextFor(card)).toBe('Courage shard');
    });

    it('renders an inline-authored power-shard card as "Power shard"', () => {
      const card: Card = {
        id: 'ad-hoc-power',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['power'] },
        itemKind: 'item-active',
      };
      expect(effectTextFor(card)).toBe('Power shard');
    });

    it('renders a multi-shard grant as a comma-separated list', () => {
      const card: Card = {
        id: 'ad-hoc-multi-shard',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['power', 'courage'] },
        itemKind: 'item-active',
      };
      expect(effectTextFor(card)).toBe('Power shard, Courage shard');
    });

    it('returns empty string for an empty shards array (defensive)', () => {
      const card: Card = {
        id: 'ad-hoc-empty-shard',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: [] },
        itemKind: 'item-active',
      };
      expect(effectTextFor(card)).toBe('');
    });
  });
});

describe('effectNodesFor (inline icon rendering, embertide-9jg)', () => {
  it('renders starter-green as "+1" followed by a green-shard icon (no letter g)', () => {
    const { container } = render(<div>{effectNodesFor(STARTER_GREEN)}</div>);
    expect(container.textContent ?? '').toContain('+1');
    // The bare letter 'g' used in the plain-text form must not appear in
    // the visible node tree — icons replace it.
    expect(container.textContent ?? '').not.toMatch(/\+1g/);
    const greenIcon = container.querySelector('svg[aria-label="green-shard"]');
    expect(greenIcon).not.toBeNull();
  });

  it('renders starter-red as "+1" followed by a sword icon (not the word "power")', () => {
    const { container } = render(<div>{effectNodesFor(STARTER_RED)}</div>);
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').not.toContain('power');
    const swordIcon = container.querySelector('svg[aria-label="sword"]');
    expect(swordIcon).not.toBeNull();
  });

  it('renders sage-keeper with both a green-shard and a key icon', () => {
    const sage = findCard('sage-keeper');
    const { container } = render(<div>{effectNodesFor(sage)}</div>);
    expect(container.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
    expect(container.querySelector('svg[aria-label="key"]')).not.toBeNull();
    // Amounts still shown as text.
    expect(container.textContent ?? '').toContain('+2');
    expect(container.textContent ?? '').toContain('+1');
    // Comma separator from the source string is preserved.
    expect(container.textContent ?? '').toContain(',');
  });

  it('renders water-warrior "+2 power" with a single sword icon and no "power" word', () => {
    const water = findCard('water-warrior');
    const { container } = render(<div>{effectNodesFor(water)}</div>);
    expect(container.querySelectorAll('svg[aria-label="sword"]')).toHaveLength(1);
    expect(container.textContent ?? '').toContain('+2');
    expect(container.textContent ?? '').not.toContain('power');
  });

  it('renders "+2g" for scholar-princess with a green-shard icon (mvjx — phase differentiation)', () => {
    // mvjx (2026-04-25): scholar-princess's main fire migrated from
    // Draw 2 (duplicate of combat-draw 2) to +2g. The inline-icon
    // tokenizer renders the trailing "g" as a green-shard SVG.
    const scholar = findCard('scholar-princess');
    const { container } = render(<div>{effectNodesFor(scholar)}</div>);
    expect(container.textContent ?? '').toContain('+2');
    expect(container.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
    expect(container.querySelector('svg[aria-label="sword"]')).toBeNull();
    expect(container.querySelector('svg[aria-label="key"]')).toBeNull();
    expect(container.querySelector('svg[aria-label="heart"]')).toBeNull();
  });

  it('renders ranch-keeper heart token as a heart icon (not the ♥ glyph)', () => {
    const ranch = findCard('ranch-keeper');
    const { container } = render(<div>{effectNodesFor(ranch)}</div>);
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(container.textContent ?? '').not.toContain('\u2665');
    // Surrounding "on boss" text is preserved.
    expect(container.textContent ?? '').toContain('on boss');
  });

  // embertide-s2ub: short-sword now declares an `equip-bonus`
  // EffectSpec; the card-face renders the on-equip fire ("+1 power on
  // equip") with the sword icon swapped in for the literal "power"
  // word by the inline-icon tokenizer.
  it('renders short-sword equip-bonus text with the sword icon (no literal "power" word)', () => {
    const card = findCard('short-sword');
    const { container } = render(<div>{effectNodesFor(card)}</div>);
    expect(container.querySelector('svg[aria-label="sword"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').toContain('on equip');
    expect(container.textContent ?? '').not.toContain('power');
  });

  it('renders monster heart drop as "+1" followed by a heart icon', () => {
    const monster = KID_CARDS.find((c) => c.role === 'monster');
    if (!monster) throw new Error('no monster fixture');
    const { container } = render(<div>{effectNodesFor(monster)}</div>);
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').not.toContain('\u2665');
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
  });

  it('renders the final-boss heart drop without the v1 endgame suffix', () => {
    // v2 pivot: the final-boss card no longer carries `triggers: 'endgame'`
    // so the inline rendering matches any other heart drop.
    const finalBoss = KID_CARDS.find((c) => c.role === 'final-boss');
    if (!finalBoss) throw new Error('no final-boss fixture');
    const { container } = render(<div>{effectNodesFor(finalBoss)}</div>);
    expect(container.textContent ?? '').not.toContain('Endgame');
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
  });

  it('renders inline icons at the 12x12 size used in card rules-text boxes', () => {
    const { container } = render(<div>{effectNodesFor(STARTER_GREEN)}</div>);
    const icon = container.querySelector('svg[aria-label="green-shard"]') as SVGSVGElement | null;
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('width')).toBe('12');
    expect(icon?.getAttribute('height')).toBe('12');
  });

  it('returns null for cards with no rendered effect summary', () => {
    // Hero with a well-formed gain effect whose baseId has no entry in the
    // effectTextFor switch — effectTextFor returns the empty string, and
    // effectNodesFor returns null so callers can skip the badge.
    const blank: Card = {
      id: 'unknown-hero',
      role: 'hero',
      cost: {},
      effects: { kind: 'gain' },
    };
    expect(effectNodesFor(blank)).toBeNull();
  });

  // REQ-13 Phase 2d (gm0.4): three shard-grant cards each render as
  // "<Shard> <icon>" with the per-shard icon substituted by the
  // tokenizer. The shard label STAYS visible next to the icon so the
  // grant reads as "Wisdom <icon>" (vs "+1 <icon>" which would be a
  // numeric resource grant — shards are flag flips, not counters).
  describe('shard-grant icon rendering (REQ-13 Phase 2d / gm0.4)', () => {
    it('renders the wisdom sample card with a wisdom-shard icon and the "Wisdom" label', () => {
      const { container } = render(<div>{effectNodesFor(TEST_SHARD_GRANT_SAMPLE_CARD)}</div>);
      expect(container.querySelector('svg[aria-label="wisdom-shard"]')).not.toBeNull();
      expect(container.textContent ?? '').toContain('Wisdom');
      // Inline icon size matches the effect-text 12px convention.
      const icon = container.querySelector('svg[aria-label="wisdom-shard"]');
      expect(icon?.getAttribute('width')).toBe('12');
      expect(icon?.getAttribute('height')).toBe('12');
    });

    it('renders an inline courage-shard card with a courage-shard icon and the "Courage" label', () => {
      const card: Card = {
        id: 'ad-hoc-courage-render',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['courage'] },
        itemKind: 'item-active',
      };
      const { container } = render(<div>{effectNodesFor(card)}</div>);
      expect(container.querySelector('svg[aria-label="courage-shard"]')).not.toBeNull();
      expect(container.textContent ?? '').toContain('Courage');
    });

    it('renders an inline power-shard card with a power-shard icon and the "Power" label', () => {
      const card: Card = {
        id: 'ad-hoc-power-render',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['power'] },
        itemKind: 'item-active',
      };
      const { container } = render(<div>{effectNodesFor(card)}</div>);
      expect(container.querySelector('svg[aria-label="power-shard"]')).not.toBeNull();
      expect(container.textContent ?? '').toContain('Power');
    });

    it('renders a multi-shard grant with one icon per granted shard', () => {
      const card: Card = {
        id: 'ad-hoc-multi-shard-render',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'shard-grant', shards: ['power', 'courage', 'wisdom'] },
        itemKind: 'item-active',
      };
      const { container } = render(<div>{effectNodesFor(card)}</div>);
      expect(container.querySelector('svg[aria-label="wisdom-shard"]')).not.toBeNull();
      expect(container.querySelector('svg[aria-label="courage-shard"]')).not.toBeNull();
      expect(container.querySelector('svg[aria-label="power-shard"]')).not.toBeNull();
      // Comma separator from the source string is preserved.
      expect(container.textContent ?? '').toContain(',');
    });
  });
});

describe('tokenizeResourceText (natural-language resource tokens, embertide-6y2)', () => {
  it('renders "+1 heart when you defeat a mini-boss" with a heart icon in place of the word', () => {
    const { container } = render(
      <div>{tokenizeResourceText('+1 heart when you defeat a mini-boss or final-boss')}</div>,
    );
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').not.toContain('+1 heart');
    expect(container.textContent ?? '').toContain('when you defeat a mini-boss or final-boss');
  });

  it('renders "+2 power at the start of your turn" with a sword icon', () => {
    const { container } = render(
      <div>{tokenizeResourceText('+2 power at the start of your turn')}</div>,
    );
    expect(container.querySelector('svg[aria-label="sword"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('+2');
    expect(container.textContent ?? '').not.toContain('power');
    expect(container.textContent ?? '').toContain('at the start of your turn');
  });

  it('renders "+1 green at the start of your turn" with a green-shard icon', () => {
    const { container } = render(
      <div>{tokenizeResourceText('+1 green at the start of your turn')}</div>,
    );
    expect(container.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').not.toContain('green');
  });

  it('renders "+1 bonus heart when defeating the final boss" preserving the word "bonus"', () => {
    const { container } = render(
      <div>{tokenizeResourceText('+1 bonus heart when defeating the final boss')}</div>,
    );
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('+1');
    expect(container.textContent ?? '').toContain('bonus');
    // The word "heart" (but not "bonus") is replaced by the icon.
    expect(container.textContent ?? '').not.toContain('heart');
  });

  it('renders the full blade-warden passive ("+1 green ..., +1 bonus heart ...") with two icons', () => {
    const text = '+1 green at the start of your turn, +1 bonus heart when defeating the final boss';
    const { container } = render(<div>{tokenizeResourceText(text)}</div>);
    expect(container.querySelectorAll('svg[aria-label="green-shard"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg[aria-label="heart"]')).toHaveLength(1);
    expect(container.textContent ?? '').toContain(',');
    expect(container.textContent ?? '').toContain('bonus');
  });

  it('renders "Draw 1 extra card" unchanged (no resource token present)', () => {
    const { container } = render(
      <div>{tokenizeResourceText('Draw 1 extra card at the start of your turn')}</div>,
    );
    expect(container.textContent ?? '').toBe('Draw 1 extra card at the start of your turn');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(tokenizeResourceText('')).toBeNull();
  });

  it('still handles the card-format token "+1g" (no space, bare g)', () => {
    const { container } = render(<div>{tokenizeResourceText('+1g')}</div>);
    expect(container.querySelector('svg[aria-label="green-shard"]')).not.toBeNull();
    expect(container.textContent ?? '').not.toContain('g');
  });

  it('still handles the card-format heart glyph "+1♥"', () => {
    const { container } = render(<div>{tokenizeResourceText('+1\u2665')}</div>);
    expect(container.querySelector('svg[aria-label="heart"]')).not.toBeNull();
    expect(container.textContent ?? '').not.toContain('\u2665');
  });
});

describe('combatSummaryTextFor (embertide-2gp card-face combat line, kw.card-text-format glossary spelling)', () => {
  // lhlo.38: combatSummaryTextFor now returns LABEL-LESS keyword-glossary
  // spelling (Attack/Block/Heal/Draw/Multiattack/Stun); the "Combat — "
  // section label is added by cardFaceSections / CardTemplate.
  it('returns "Block 3" for sage-keeper (combat-absorb)', () => {
    expect(combatSummaryTextFor(findCard('sage-keeper'))).toBe('Block 3');
  });

  it('returns "Attack 3" for water-warrior (combat-attack)', () => {
    expect(combatSummaryTextFor(findCard('water-warrior'))).toBe('Attack 3');
  });

  it('returns "Draw 2" for scholar-princess (combat-draw)', () => {
    expect(combatSummaryTextFor(findCard('scholar-princess'))).toBe('Draw 2');
  });

  it('returns "Heal 3" for ranch-keeper (combat-heal)', () => {
    expect(combatSummaryTextFor(findCard('ranch-keeper'))).toBe('Heal 3');
  });

  it('returns "Multiattack 2 (2 each)" for forest-sage (combat-multishot)', () => {
    expect(combatSummaryTextFor(findCard('forest-sage'))).toBe('Multiattack 2 (2 each)');
  });

  it('returns "Attack 2 + Stun 1" for mountain-king (combat-attack-stun)', () => {
    expect(combatSummaryTextFor(findCard('mountain-king'))).toBe('Attack 2 + Stun 1');
  });

  it('returns "Attack 5" for ancient-blade (legendary item)', () => {
    expect(combatSummaryTextFor(findCard('ancient-blade'))).toBe('Attack 5');
  });

  it('returns "Multiattack 3 (1 each)" for short-bow (combat-multishot 1x3)', () => {
    expect(combatSummaryTextFor(findCard('short-bow'))).toBe('Multiattack 3 (1 each)');
  });

  it('returns "Block 2" for mystic (always-available combat-absorb)', () => {
    expect(combatSummaryTextFor(findCard('mystic'))).toBe('Block 2');
  });

  it('returns empty string for heirlooms (main effect already shows "Combat:")', () => {
    // craghorn-tusk, boulderkin-core, sentinel-eye, chimera-sword,
    // rainbow-prism all display their combat effect as the primary
    // rules text because they have no main-board on-play action. Adding
    // a second "Combat:" line would duplicate the info. (v2.1 gm0.17
    // retired silver-chimera-mane.)
    expect(combatSummaryTextFor(findCard('craghorn-tusk'))).toBe('');
    expect(combatSummaryTextFor(findCard('sentinel-eye'))).toBe('');
  });

  it('returns empty string for cards that never enter combat (monsters, chests)', () => {
    const monster = KID_CARDS.find((c) => c.role === 'monster');
    if (!monster) throw new Error('no monster fixture');
    expect(combatSummaryTextFor(monster)).toBe('');

    const chest = KID_CARDS.find((c) => c.role === 'chest-std');
    if (!chest) throw new Error('no chest fixture');
    expect(combatSummaryTextFor(chest)).toBe('');
  });

  it('returns empty string for non-overridden heroes (damage=1 filler default)', () => {
    // A hero card whose id has no EXPLICIT_OVERRIDE entry and no cost.red
    // resolves to combat-attack damage=1, which isn't worth a card-face line.
    const unknownHero: Card = {
      id: 'unknown-hero-no-override',
      role: 'hero',
      cost: { green: 2 },
      effects: { kind: 'gain' },
    };
    expect(combatSummaryTextFor(unknownHero)).toBe('');
  });

  it('resolves duplicate supply copies via baseId (sage-keeper-2 -> Block 3)', () => {
    const sage = findCard('sage-keeper');
    const duplicate = { ...sage, id: 'sage-keeper-2', baseId: 'sage-keeper' } as Card;
    expect(combatSummaryTextFor(duplicate)).toBe('Block 3');
  });

  it('returns "Draw 1" for starter-green-shard (rev-2 combat effect)', () => {
    // Designer playtest rev-2 2026-04-22 re-included gem-generator
    // starters with distinct combat effects. The card-face combat line
    // reflects that so players see what pulls the trigger mid-combat.
    expect(combatSummaryTextFor(STARTER_GREEN)).toBe('Draw 1');
  });

  it('returns "Attack 2" for starter-red-shard (combat-attack 2)', () => {
    expect(combatSummaryTextFor(STARTER_RED)).toBe('Attack 2');
  });
});
