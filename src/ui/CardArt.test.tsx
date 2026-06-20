import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  bossPortraitForBaseId,
  illustrationFor,
  illustrationForBaseId,
  illustrationForCard,
  illustrationForChampion,
} from './CardArt';
import { ALWAYS_AVAILABLE, KID_CARDS, VENDORS } from '../data/cards';
import { KID_CHAMPIONS } from '../data/champions';
import { TIER_1_ROSTER } from '../data/colosseum/tier1';
import { TIER_2_ROSTER } from '../data/colosseum/tier2';
import { TIER_3_ROSTER } from '../data/colosseum/tier3';
import { TIER_4_ROSTER } from '../data/colosseum/tier4';
import { TIER_5_ROSTER } from '../data/colosseum/tier5';

describe('illustrationFor', () => {
  it('returns a rendered SVG for the hero role', () => {
    const node = illustrationFor('hero', 28);
    expect(node).not.toBeNull();
    const { container } = render(node!);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('28');
    expect(svg?.getAttribute('height')).toBe('28');
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_hero_warrior_001');
  });

  it('renders the raster <image> when the hero spec carries a rasterImageUrl', () => {
    const node = illustrationFor('hero', 28);
    const { container } = render(node!);
    const image = container.querySelector('g#raster image');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('href')).toBe('/illustrations/cathedral_hero_warrior_001.webp');
  });

  it('returns an illustration for the surviving starter roles (j49z 2026-04-24: starter-home retired)', () => {
    expect(illustrationFor('starter-green', 28)).not.toBeNull();
    expect(illustrationFor('starter-red', 28)).not.toBeNull();
  });

  /**
   * Regression guard for the v2.1 crystal-break black-screen P0: when the
   * princess is freed, both players are granted a `freed-princess` item,
   * which is rendered via CardTemplate → illustrationForCard. An earlier
   * shipment of `cathedral_aurelia_light_arrow.json` referenced a silhouette
   * id (`princess_aurelia_archer`) that did not exist in HERO_TEMPLATES,
   * causing `renderIllustration` to throw during the freed-princess item
   * cell render — which unmounted the React tree and produced a black
   * screen the instant the crystal broke. This test fails fast with a
   * clear stack if the silhouetteId ever drifts again.
   */
  it('renders the freed-princess card art without throwing (crystal-break regression)', () => {
    const card = KID_CARDS.find((c) => c.id === 'freed-princess');
    if (!card) throw new Error('no freed-princess fixture');
    const node = illustrationForCard(card, 28);
    expect(node).not.toBeNull();
    const { container } = render(node!);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-illustration-id')).toBe('cathedral_aurelia_light_arrow_001');
    const image = container.querySelector('g#raster image');
    expect(image?.getAttribute('href')).toBe('/illustrations/cathedral_aurelia_light_arrow_001.webp');
  });

  /**
   * embertide-4r2 (2026-04-24): drift-alarm for the 6 named-Aurelia
   * heroes. Each job-title market-hero baseId must resolve to its
   * canonical character portrait so the card face reads as the named
   * hero rather than a warrior-fallback silhouette. Mirrors the
   * sage-keeper→Veylin precedent already wired for the always-available
   * row. A 7th pairing (sage-keeper→Veylin) is included for parity since
   * it's the precedent that established this pattern.
   */
  it('renders each named-Aurelia market hero with its bespoke raster (embertide-4r2)', () => {
    const expected: Record<string, string> = {
      'sage-keeper': '/illustrations/cathedral_hero_veylin_001.webp',
      'forest-sage': '/illustrations/cathedral_hero_liel_001.webp',
      'mountain-king': '/illustrations/cathedral_hero_brammel_001.webp',
      'ranch-keeper': '/illustrations/cathedral_hero_wren_001.webp',
      'scholar-princess': '/illustrations/cathedral_hero_sael_001.webp',
      'water-warrior': '/illustrations/cathedral_hero_naerin_001.webp',
      'wandering-merchant': '/illustrations/cathedral_hero_coll_001.webp',
      'key-vendor': '/illustrations/cathedral_hero_pell_001.webp',
    };
    for (const [baseId, href] of Object.entries(expected)) {
      // Most entries are KID_CARDS market heroes. `key-vendor` (Pell)
      // lives in `VENDORS` after embertide-1eby reframed him from
      // a buyable hero to a vendor service — but the portrait still
      // ships, and the drift-alarm covers all three lanes with one map.
      const card =
        KID_CARDS.find((c) => c.id === baseId) ??
        ALWAYS_AVAILABLE.find((c) => c.id === baseId) ??
        VENDORS.find((c) => c.id === baseId);
      if (!card) throw new Error(`No card fixture for ${baseId}`);
      const node = illustrationForCard(card, 28);
      expect(node, `card "${baseId}" should resolve an illustration`).not.toBeNull();
      const { container, unmount } = render(node!);
      const image = container.querySelector('g#raster image');
      expect(
        image?.getAttribute('href'),
        `card "${baseId}" should resolve to ${href}, got ${image?.getAttribute('href')}`,
      ).toBe(href);
      unmount();
    }
  });

  /**
   * Broader drift-alarm: every card in KID_CARDS must produce a renderable
   * illustration (or null for roles without a registered spec), never
   * throw. An `illustrationForCard` throw bubbles up through CardTemplate
   * into whatever tray renders the card (items row, in-play, hand), which
   * during the v2.1 crystal-break regression unmounted the entire page.
   * Tests don't need to assert a specific raster per card — just that
   * the render pipeline is total and non-throwing end-to-end.
   */
  it('illustrationForCard does not throw for any card in KID_CARDS (total contract)', () => {
    for (const card of KID_CARDS) {
      const attempt = () => illustrationForCard(card, 28);
      expect(
        attempt,
        `illustrationForCard threw for card "${card.id}" — check the spec's silhouetteId against HERO_TEMPLATES/MONSTER_TEMPLATES.`,
      ).not.toThrow();
      const node = attempt();
      if (node !== null) {
        // If a spec was resolved, it must render without throwing too.
        expect(() => render(node)).not.toThrow();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// embertide-sl9 — Setup screen needs a champion-keyed helper so it can
// render the bespoke portraits without doing a KID_CARDS round-trip through
// the full Card type. The helper must resolve every registered champion id.
// ---------------------------------------------------------------------------

describe('illustrationForChampion', () => {
  it('returns the bespoke raster for every registered champion id', () => {
    const expected: Record<string, { href: string; id: string }> = {
      'champion-courage': {
        href: '/illustrations/cathedral_starter_champion_courage_001.webp',
        id: 'cathedral_starter_champion_courage_001',
      },
      'champion-wisdom': {
        href: '/illustrations/cathedral_starter_champion_wisdom_001.webp',
        id: 'cathedral_starter_champion_wisdom_001',
      },
      'champion-power': {
        href: '/illustrations/cathedral_starter_champion_power_001.webp',
        id: 'cathedral_starter_champion_power_001',
      },
      'champion-sword': {
        href: '/illustrations/cathedral_starter_champion_sword_001.webp',
        id: 'cathedral_starter_champion_sword_001',
      },
    };
    // Every registered champion must have an entry in the expected map —
    // otherwise a future champion added to KID_CHAMPIONS could silently
    // pass through undefined comparisons.
    for (const champion of KID_CHAMPIONS) {
      if (!expected[champion.id]) {
        throw new Error(`No expected raster mapping for champion ${champion.id}`);
      }
    }
    for (const champion of KID_CHAMPIONS) {
      const node = illustrationForChampion(champion.id, 48);
      expect(node, `champion ${champion.id} should resolve an illustration`).not.toBeNull();
      const { container } = render(node!);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('data-illustration-id')).toBe(expected[champion.id].id);
      const image = container.querySelector('g#raster image');
      expect(image?.getAttribute('href')).toBe(expected[champion.id].href);
    }
  });

  it('returns null for an unregistered champion id (callers decide the fallback)', () => {
    expect(illustrationForChampion('champion-unknown', 48)).toBeNull();
  });

  it('covers every registered champion (guards against KID_CHAMPIONS drift)', () => {
    // The per-champion assertions above prove the 4 current champions resolve,
    // but this explicit loop is the drift alarm — if a future champion is
    // added to KID_CHAMPIONS without registering a spec, this test fails here
    // with a clear champion-id message rather than silently rendering an
    // empty art cell in Setup.tsx (embertide-sl9 review finding).
    for (const champion of KID_CHAMPIONS) {
      expect(
        illustrationForChampion(champion.id, 48),
        `No illustration registered for champion "${champion.id}". Add its spec to SPEC_BY_CHAMPION_ID in src/ui/CardArt.tsx.`,
      ).not.toBeNull();
    }
  });
});

describe('illustrationForBaseId — colosseum-tier boss portraits', () => {
  /**
   * Regression pin (embertide-pish): every shipped colosseum-tier boss
   * MUST have a `SPEC_BY_BASE_ID` entry so CombatBossStage's
   * `illustrationForBaseId(boss.sourceCardId, ...)` resolves to a real
   * portrait instead of falling through to the label-only fallback.
   *
   * bcq8 surfaced the original gap: COLOSSEUM_CHIMERA_T2.sourceCardId='chimera'
   * had no mapping, so tier-2 colosseum-slot fights rendered with an empty
   * portrait socket. pish landed the chimera art; this test guards against
   * future drift (deleted import, renamed key, etc.).
   *
   * When TierId widens to include 3/4 (embertide-3z4v) and tier-4 art
   * is regenerated (embertide-mvvw), extend this list.
   */
  it.each(['craghorn', 'chimera', 'trinity-aurogax', 'bonereaver'] as const)(
    "resolves to a non-null portrait for shipped colosseum boss '%s'",
    (baseId) => {
      expect(
        illustrationForBaseId(baseId, 256),
        `No illustration registered for colosseum boss baseId "${baseId}". Add its spec to SPEC_BY_BASE_ID in src/ui/CardArt.tsx.`,
      ).not.toBeNull();
    },
  );
});

describe('bossPortraitForBaseId — never renders a blank boss stage', () => {
  /**
   * CombatBossStage keys the portrait off `boss.sourceCardId` alone, and
   * many colosseum bosses ship before their bespoke raster does (player
   * report: "Colosseum says Bonereaver but no art for that monster"). The
   * fallback chain (baseId spec → generic mini-boss portrait → boss icon)
   * must ALWAYS return a renderable element so a fight never opens with an
   * empty portrait socket — even for an entirely unknown id.
   */
  const COLOSSEUM_SOURCE_IDS = [
    ...TIER_1_ROSTER,
    ...TIER_2_ROSTER,
    ...TIER_3_ROSTER,
    ...TIER_4_ROSTER,
    ...TIER_5_ROSTER,
  ].map((boss) => boss.sourceCardId);

  it.each([...new Set(COLOSSEUM_SOURCE_IDS)])(
    "returns a renderable portrait for colosseum boss sourceCardId '%s'",
    (sourceCardId) => {
      const node = bossPortraitForBaseId(sourceCardId, 256);
      const { container } = render(node);
      expect(container.querySelector('svg')).not.toBeNull();
    },
  );

  it('falls back to a generic portrait for a completely unknown id', () => {
    const node = bossPortraitForBaseId('not-a-real-boss-id', 256);
    const { container } = render(node);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
