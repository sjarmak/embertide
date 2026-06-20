import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BossAltarPane, { __resetOrnamentWarnings } from './BossAltarPane';
import {
  BossAltarCleared,
  BossAltarDormant,
  BossAltarLocked,
  BossAltarPhaseLocked,
  ZONE_BOSS_DOOR_SRC,
} from './BossAltarVariants';
import { BossStamp, bossSlotHpFor } from './BossStamp';
import type { ZoneId } from '../store/types';
import { KID_CARDS } from '../data/cards';

describe('BossAltarPane (u-9d)', () => {
  it('renders the header text and data-variant attribute', () => {
    render(
      <BossAltarPane header="WILD BOSS" variant="wild" onClick={() => undefined}>
        hello
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.getAttribute('data-variant')).toBe('wild');
    expect(screen.getByTestId('boss-altar-pane-header').textContent).toBe('WILD BOSS');
  });

  it('renders as a button when enabled and fires onClick exactly once', () => {
    const onClick = vi.fn();
    render(
      <BossAltarPane header="REGION BOSS" variant="region" onClick={onClick}>
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.tagName).toBe('BUTTON');
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a role=group div when disabled and no click fires through', () => {
    const onClick = vi.fn();
    render(
      <BossAltarPane header="WILD BOSS" variant="wild" disabled onClick={onClick}>
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('data-disabled')).toBe('true');
    expect(root.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as a div when no onClick is provided (cleared placeholder)', () => {
    render(
      <BossAltarPane header="WILD BOSS" variant="wild">
        cleared
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.tagName).toBe('DIV');
  });

  it('applies data-variant="destiny" for the Vurmox variant', () => {
    render(
      <BossAltarPane header="DESTINY" variant="destiny" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.getAttribute('data-variant')).toBe('destiny');
  });

  it('applies a custom testId when provided', () => {
    render(
      <BossAltarPane
        header="WILD BOSS"
        variant="wild"
        testId="wild-boss-slot"
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    expect(screen.getByTestId('wild-boss-slot')).toBeInTheDocument();
  });

  it('uses the ariaLabel prop over the header for a11y label', () => {
    render(
      <BossAltarPane
        header="WILD BOSS"
        variant="wild"
        ariaLabel="Engage wild encounter — Craghorn, HP 8"
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.getAttribute('aria-label')).toBe('Engage wild encounter — Craghorn, HP 8');
  });
});

describe('BossStamp (u-9d) — shared boss interior', () => {
  it('renders the boss display name + the tuned BOSS_HP readout (embertide-3dc)', () => {
    // embertide-3dc (rev-2 2026-04-22): slot now reads through
    // `bossHpFor` first so altar label matches actual combat HP.
    // Craghorn is tuned to 10 in BOSS_HP (bossAttackPatterns.ts) — the
    // altar MUST show 10, not the tier default 8.
    const craghorn = KID_CARDS.find((c) => c.id === 'craghorn');
    if (!craghorn) throw new Error('craghorn missing from KID_CARDS');
    render(<BossStamp card={craghorn} />);
    expect(screen.getByTestId('boss-altar-pane-name').textContent).toBe('Craghorn');
    expect(screen.getByTestId('boss-altar-pane-hp').textContent).toBe('HP 10');
  });

  it('renders the region-boss HP readout at the tuned BOSS_HP value (Broodmaw → 18)', () => {
    const broodmaw = KID_CARDS.find((c) => c.id === 'broodmaw');
    if (!broodmaw) throw new Error('broodmaw missing from KID_CARDS');
    render(<BossStamp card={broodmaw} />);
    // Broodmaw is tuned to 18 in BOSS_HP (not the 12 region-boss tier
    // fallback). Before rev-2, the altar lied about this — it
    // showed "HP 12" but combat opened at 18.
    expect(screen.getByTestId('boss-altar-pane-hp').textContent).toBe('HP 18');
  });
});

describe('bossSlotHpFor (embertide-3dc rev-2) — altar reflects tuned combat HP', () => {
  it('tuned bosses show their BOSS_HP value (not the tier default)', () => {
    // Per embertide-3dc: the altar label must match the HP the
    // player will actually face in combat. Before rev-2 the slot
    // showed the tier default (wild 8 / region 12) and Craghorn's
    // altar lied about its real 10-HP combat. Now both paths go
    // through bossHpFor → tierCombatHpFor.
    const craghorn = KID_CARDS.find((c) => c.id === 'craghorn');
    const vurmox = KID_CARDS.find((c) => c.id === 'cagewright-vurmox');
    if (!craghorn || !vurmox) throw new Error('boss cards missing');
    expect(bossSlotHpFor(craghorn)).toBe(10); // tuned: BOSS_HP.craghorn
    expect(bossSlotHpFor(vurmox)).toBe(20); // tuned: BOSS_HP['cagewright-vurmox']
  });
});

describe('BossAltarPane ornamentSrc (u-10a, REQ-33 §D2)', () => {
  beforeEach(() => {
    __resetOrnamentWarnings();
  });

  it('renders an <img> with the provided src when ornamentSrc is set', () => {
    render(
      <BossAltarPane
        header="WILD BOSS"
        variant="wild"
        ornamentSrc="/illustrations/cathedral_altar_frame_wild_001.webp"
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_altar_frame_wild_001.webp');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('still allows callers to opt out of the default ornament by passing ornamentSrc="" is NOT supported — but omitting a mapped variant suppresses <img> via a synthetic mapping', () => {
    // u-10d: every variant (wild / region / destiny) now has a default
    // ornament mapped in ORNAMENT_SRC_BY_VARIANT. The "no <img>" branch
    // is still reachable via the load-failure path (exercised
    // separately below) and via a synthetic src that 404s — we no
    // longer have a variant whose *default* is `undefined`, so the
    // u-9d regression guarantee is preserved via the onError
    // hide-after-failure path instead of "no <img> ever mounted".
    render(
      <BossAltarPane header="DESTINY" variant="destiny" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    // Pane itself still renders intact. An <img> is emitted for
    // destiny, targeting the bespoke Vurmox raster.
    expect(screen.getByTestId('boss-altar-pane')).toBeInTheDocument();
    const img = screen.getByTestId('boss-altar-pane-ornament') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_altar_destiny_vurmox_001.webp');
  });

  it('renders the ornament inside the disabled (role=group) branch too', () => {
    render(
      <BossAltarPane
        header="WILD BOSS"
        variant="wild"
        disabled
        ornamentSrc="/illustrations/cathedral_altar_frame_wild_001.webp"
      >
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.tagName).toBe('DIV');
    expect(screen.getByTestId('boss-altar-pane-ornament')).toBeInTheDocument();
  });

  it('auto-resolves the wild ornament from variant="wild" when ornamentSrc is omitted', () => {
    // u-10c: variant→ornament map. Callers that didn't opt into the u-10a
    // explicit prop still get the shared wild frame applied automatically.
    render(
      <BossAltarPane header="WILD BOSS" variant="wild" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament');
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_altar_frame_wild_001.webp');
  });

  it('auto-resolves the region ornament from variant="region" when ornamentSrc is omitted', () => {
    render(
      <BossAltarPane header="REGION BOSS" variant="region" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament');
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_altar_frame_region_001.webp');
  });

  it('auto-resolves the destiny ornament from variant="destiny" (u-10d)', () => {
    // u-10d wired the bespoke Vurmox raster into ORNAMENT_SRC_BY_VARIANT.
    // Destiny slots now render WITH the destiny ornament by default.
    render(
      <BossAltarPane header="DESTINY" variant="destiny" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament');
    expect(img.getAttribute('src')).toBe('/illustrations/cathedral_altar_destiny_vurmox_001.webp');
  });

  it('emits the mandala overlay div for variant="destiny" only (u-10d)', () => {
    // The destiny variant adds a dedicated `.boss-altar-pane-mandala`
    // div between the ornament and the children. Wild and region
    // variants must NOT emit it — they keep the pre-u-10d render.
    const { rerender } = render(
      <BossAltarPane header="WILD BOSS" variant="wild" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    expect(screen.queryByTestId('boss-altar-pane-mandala')).toBeNull();

    rerender(
      <BossAltarPane header="REGION BOSS" variant="region" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    expect(screen.queryByTestId('boss-altar-pane-mandala')).toBeNull();

    rerender(
      <BossAltarPane header="DESTINY" variant="destiny" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    expect(screen.getByTestId('boss-altar-pane-mandala')).toBeInTheDocument();
  });

  it('caller-supplied ornamentSrc overrides the variant default', () => {
    // Back-compat: u-10a consumers that passed an explicit src still win.
    const override = '/illustrations/custom-override.webp';
    render(
      <BossAltarPane
        header="WILD BOSS"
        variant="wild"
        ornamentSrc={override}
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament');
    expect(img.getAttribute('src')).toBe(override);
  });

  it('keeps rendering the ornament in the cleared/disabled state (CSS handles desaturation)', () => {
    // u-10c acceptance #8: defeated-boss cleared slots keep the ornament
    // in the DOM; a [data-disabled="true"] CSS rule fades it to
    // grayscale + 0.6 opacity. The React tree stays identical.
    render(
      <BossAltarPane header="WILD BOSS" variant="wild" disabled>
        <span>cleared</span>
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.getAttribute('data-disabled')).toBe('true');
    // Ornament is still in the DOM — the visual treatment is pure CSS.
    expect(screen.getByTestId('boss-altar-pane-ornament')).toBeInTheDocument();
  });

  it('onError hides the <img>, keeps pane intact, and warns once per src', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const src = '/illustrations/missing-raster.webp';

    const first = render(
      <BossAltarPane header="WILD BOSS" variant="wild" ornamentSrc={src} onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    const img = screen.getByTestId('boss-altar-pane-ornament');
    fireEvent.error(img);

    // Img removed from DOM after error.
    expect(screen.queryByTestId('boss-altar-pane-ornament')).toBeNull();
    // Pane still intact.
    expect(screen.getByTestId('boss-altar-pane')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-header')).toBeInTheDocument();

    // Warned exactly once for this src.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(src);

    // A FRESH mount of the same src must NOT produce a second warning —
    // module-level Set dedupes across mounts. (Unmount + mount ensures the
    // child's `ornamentFailed` useState resets, exercising the dedupe
    // rather than the per-mount latch.)
    first.unmount();
    render(
      <BossAltarPane header="REGION" variant="region" ornamentSrc={src} onClick={() => undefined}>
        y
      </BossAltarPane>,
    );
    const imgAgain = screen.getByTestId('boss-altar-pane-ornament');
    fireEvent.error(imgAgain);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});

describe('BossAltarPane backdropZoneId (embertide-4e21)', () => {
  it('renders the zone-backdrop layer with the zone raster when backdropZoneId is set', () => {
    render(
      <BossAltarPane
        header="MINI BOSS"
        variant="wild"
        backdropZoneId="sylvani"
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    const backdrop = screen.getByTestId('boss-altar-pane-backdrop');
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    const img = backdrop.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/illustrations/cathedral_zone_sylvani_001.webp');
    // The decorative backdrop must not be announced or focusable.
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });

  it('flags the root with data-backdrop="true" so the jewel fill is neutralized in CSS', () => {
    render(
      <BossAltarPane
        header="REGION BOSS"
        variant="region"
        backdropZoneId="maren"
        onClick={() => undefined}
      >
        x
      </BossAltarPane>,
    );
    expect(screen.getByTestId('boss-altar-pane').getAttribute('data-backdrop')).toBe('true');
  });

  it('omits the backdrop layer (byte-identical pre-4e21 render) when backdropZoneId is absent', () => {
    render(
      <BossAltarPane header="MINI BOSS" variant="wild" onClick={() => undefined}>
        x
      </BossAltarPane>,
    );
    expect(screen.queryByTestId('boss-altar-pane-backdrop')).toBeNull();
    // data-backdrop is not emitted at all (not "false") so existing
    // attribute-equality snapshots/queries stay unaffected.
    expect(screen.getByTestId('boss-altar-pane').hasAttribute('data-backdrop')).toBe(false);
  });

  it('renders the backdrop in the disabled (role=group) branch too', () => {
    render(
      <BossAltarPane header="MINI BOSS" variant="wild" disabled backdropZoneId="sylvani">
        x
      </BossAltarPane>,
    );
    const root = screen.getByTestId('boss-altar-pane');
    expect(root.tagName).toBe('DIV');
    expect(screen.getByTestId('boss-altar-pane-backdrop')).toBeInTheDocument();
  });
});

describe('BossAltarCleared (wnj regression)', () => {
  // Non-regression: the cleared variant stays text-only so the
  // defeated-boss path keeps rendering the shared "cleared" placeholder.
  // wnj introduces `BossAltarLocked` as a sibling — the cleared path is
  // intentionally untouched so the parallel `BossAltarDormant` work on
  // bead 3ub can compose alongside without conflict.
  it('renders the label text inside the cleared placeholder', () => {
    render(<BossAltarCleared label="Cleared" />);
    const cleared = screen.getByTestId('boss-altar-pane-cleared');
    expect(cleared.textContent).toBe('Cleared');
    // No raster or lock glyph leaks into the cleared state.
    expect(screen.queryByTestId('boss-altar-pane-locked-raster')).toBeNull();
    expect(screen.queryByTestId('boss-altar-pane-locked-glyph')).toBeNull();
  });
});

describe('BossAltarLocked (wnj) — zone-specific boss-door slot', () => {
  it('exports a boss-door raster path for every v2.0 zone', () => {
    // Catches regressions if a ZoneId ships without a raster entry — the
    // shape is `Record<ZoneId, string | null>` so every key must at
    // minimum resolve to `null` (the graceful fallback path). This
    // asserts no zone is silently omitted.
    const zones: readonly ZoneId[] = ['sylvani', 'emberpeak', 'gilded-cage'];
    for (const zone of zones) {
      expect(zone in ZONE_BOSS_DOOR_SRC).toBe(true);
    }
  });

  it('renders the sylvani boss-door raster for the sylvani zone', () => {
    render(<BossAltarLocked zoneId="sylvani" />);
    const raster = screen.getByTestId('boss-altar-pane-locked-raster');
    expect(raster.getAttribute('src')).toBe('/illustrations/cathedral_sylvani_boss_door_001.png');
    expect(screen.getByTestId('boss-altar-pane-locked').getAttribute('data-zone')).toBe('sylvani');
  });

  it('renders the emberpeak boss-door raster for the emberpeak zone', () => {
    render(<BossAltarLocked zoneId="emberpeak" />);
    const raster = screen.getByTestId('boss-altar-pane-locked-raster');
    expect(raster.getAttribute('src')).toBe(
      '/illustrations/cathedral_emberpeak_boss_door_001.png',
    );
  });

  it('renders the gilded-cage boss-door raster for the gilded-cage zone', () => {
    render(<BossAltarLocked zoneId="gilded-cage" />);
    const raster = screen.getByTestId('boss-altar-pane-locked-raster');
    expect(raster.getAttribute('src')).toBe(
      '/illustrations/cathedral_gilded_cage_boss_door_001.png',
    );
  });

  it('wraps the door raster in a region-variant pane marked data-locked="true"', () => {
    render(<BossAltarLocked zoneId="sylvani" />);
    const pane = screen.getByTestId('region-boss-slot');
    expect(pane.tagName).toBe('DIV');
    expect(pane.getAttribute('data-variant')).toBe('region');
    expect(pane.getAttribute('data-locked')).toBe('true');
    expect(pane.getAttribute('data-disabled')).toBe('true');
  });

  it('marks the raster decorative (aria-hidden, empty alt) so the pane label carries semantics', () => {
    render(<BossAltarLocked zoneId="sylvani" />);
    const raster = screen.getByTestId('boss-altar-pane-locked-raster');
    expect(raster.getAttribute('aria-hidden')).toBe('true');
    expect(raster.getAttribute('alt')).toBe('');
  });

  it('shows an amber lock glyph over the door and a SEALED legend beneath', () => {
    render(<BossAltarLocked zoneId="sylvani" />);
    const glyph = screen.getByTestId('boss-altar-pane-locked-glyph');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.textContent).toBe('\u{1F512}');
    expect(screen.getByTestId('boss-altar-pane-locked-label').textContent).toBe('SEALED');
  });

  it('uses a default aria-label that names the missing requirement', () => {
    render(<BossAltarLocked zoneId="sylvani" />);
    const pane = screen.getByTestId('region-boss-slot');
    expect(pane.getAttribute('aria-label')).toBe("Locked — requires the region's mini-boss key");
  });

  it('surfaces a caller-supplied requirementLabel via aria-label', () => {
    render(<BossAltarLocked zoneId="sylvani" requirementLabel="Craghorn's Boss Key" />);
    const pane = screen.getByTestId('region-boss-slot');
    expect(pane.getAttribute('aria-label')).toBe("Locked — requires Craghorn's Boss Key");
  });

  it('falls back gracefully when the zone has no boss-door raster (no <img>, no throw)', () => {
    // Simulate a v2.1 zone that ships before its door raster is final.
    // The runtime shape of ZONE_BOSS_DOOR_SRC is a plain object; the
    // `Readonly` guard is TS-only. Mutate + restore around the case so
    // sibling tests see the canonical mapping.
    const mutable = ZONE_BOSS_DOOR_SRC as Record<ZoneId, string | null>;
    const original = mutable.sylvani;
    mutable.sylvani = null;
    try {
      render(<BossAltarLocked zoneId="sylvani" />);
      // No raster <img> in the DOM — the fallback path is image-free.
      expect(screen.queryByTestId('boss-altar-pane-locked-raster')).toBeNull();
      // The glyph + SEALED label still render so the row layout stays
      // stable and the "gate is closed" signal is preserved.
      expect(screen.getByTestId('boss-altar-pane-locked-glyph')).toBeInTheDocument();
      expect(screen.getByTestId('boss-altar-pane-locked-label').textContent).toBe('SEALED');
    } finally {
      mutable.sylvani = original;
    }
  });

  it('accepts a custom testId override for parent consumers', () => {
    render(<BossAltarLocked zoneId="sylvani" testId="custom-locked-slot" />);
    expect(screen.getByTestId('custom-locked-slot')).toBeInTheDocument();
  });
});

/**
 * embertide-rtf4 — Phase-locked altar variant.
 *
 * The boss-altar slots are gated by the session-arc phase before any
 * boss-key gating: the wild slot phase-locks in Stirring (turns 1-2),
 * the region slot phase-locks in Stirring + Rising (turns 1-5). Before
 * rtf4 the region slot rendered a fully-engageable BossStamp during
 * those turns — a click silently no-op'd because the dispatcher threw
 * "phase gate closed". The phase-locked variant surfaces the gate
 * visually with an hourglass glyph + an "Available turn N" subline so
 * the player can see when the slot will wake.
 *
 * The phase-locked aesthetic is intentionally distinct from the
 * wild-boss-sealed (padlock + boss-door) state — phase gates expire on
 * a clock; key gates expire on player action.
 */
describe('BossAltarPhaseLocked (embertide-rtf4) — phase-gated altar variant', () => {
  it('renders inside a region-variant pane with data-disabled="true"', () => {
    render(<BossAltarPhaseLocked header="REGION BOSS" variant="region" unlockTurn={6} />);
    const pane = screen.getByTestId('boss-altar-pane');
    expect(pane.tagName).toBe('DIV');
    expect(pane.getAttribute('data-variant')).toBe('region');
    expect(pane.getAttribute('data-disabled')).toBe('true');
    // Phase-lock is NOT a key-lock — `data-locked` stays false so the
    // wild-boss-sealed CSS hooks (and any analytics) don't double-fire.
    expect(pane.getAttribute('data-locked')).toBe('false');
  });

  it('renders an hourglass glyph (NOT a padlock) to distinguish from BossAltarLocked', () => {
    render(<BossAltarPhaseLocked header="REGION BOSS" variant="region" unlockTurn={6} />);
    const glyph = screen.getByTestId('boss-altar-pane-phase-glyph');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    // Hourglass codepoint U+231B — explicitly NOT the padlock used by
    // the wild-boss-sealed state. The two cues must read differently.
    expect(glyph.textContent).toBe('\u{231B}');
    // No padlock anywhere in the phase-locked render.
    expect(screen.queryByTestId('boss-altar-pane-locked-glyph')).toBeNull();
  });

  it('shows an "Available turn N" subline that names the unlock turn', () => {
    render(<BossAltarPhaseLocked header="REGION BOSS" variant="region" unlockTurn={6} />);
    const subline = screen.getByTestId('boss-altar-pane-phase-subline');
    expect(subline.textContent).toMatch(/turn\s*6/i);
    expect(subline.textContent?.toLowerCase()).toMatch(/available/);
  });

  it('renders the region-variant pane header (REGION BOSS)', () => {
    render(<BossAltarPhaseLocked header="REGION BOSS" variant="region" unlockTurn={6} />);
    expect(screen.getByTestId('boss-altar-pane-header').textContent).toBe('REGION BOSS');
  });

  it('also supports the wild variant (header WILD BOSS, unlock turn 3)', () => {
    render(<BossAltarPhaseLocked header="WILD BOSS" variant="wild" unlockTurn={3} />);
    const pane = screen.getByTestId('boss-altar-pane');
    expect(pane.getAttribute('data-variant')).toBe('wild');
    expect(screen.getByTestId('boss-altar-pane-header').textContent).toBe('WILD BOSS');
    const subline = screen.getByTestId('boss-altar-pane-phase-subline');
    expect(subline.textContent).toMatch(/turn\s*3/i);
  });

  it('aria-label explains the gate to assistive tech', () => {
    render(<BossAltarPhaseLocked header="REGION BOSS" variant="region" unlockTurn={6} />);
    const pane = screen.getByTestId('boss-altar-pane');
    const label = (pane.getAttribute('aria-label') ?? '').toLowerCase();
    // Must mention BOTH the gate state (phase / locked / available) and
    // the unlock turn so screen readers convey the same story sighted
    // players see in the subline.
    expect(label).toMatch(/(phase|locked|available)/);
    expect(label).toMatch(/turn\s*6/);
  });

  it('accepts a custom testId override and propagates to the pane', () => {
    render(
      <BossAltarPhaseLocked
        header="REGION BOSS"
        variant="region"
        unlockTurn={6}
        testId="region-boss-slot-phase-locked"
      />,
    );
    expect(screen.getByTestId('region-boss-slot-phase-locked')).toBeInTheDocument();
  });
});

describe('BossAltarDormant (rtf4 visual parity) — wild-slot Stirring placeholder', () => {
  // rtf4 polish: the wild-slot dormant variant adopts the same hourglass
  // glyph as the new region phase-locked variant so the two phase-gate
  // cues read consistently across both altars. The pre-rtf4 testIds
  // (`boss-altar-pane-dormant`, `boss-altar-pane-dormant-label`,
  // `boss-altar-pane-dormant-subline`) are preserved for back-compat.
  it('renders the hourglass glyph to mirror the region phase-locked cue', () => {
    render(<BossAltarDormant label="Dormant" unlockTurn={3} />);
    const glyph = screen.getByTestId('boss-altar-pane-phase-glyph');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.textContent).toBe('\u{231B}');
  });

  it('keeps the original `boss-altar-pane-dormant` testId for back-compat', () => {
    render(<BossAltarDormant label="Dormant" unlockTurn={3} />);
    expect(screen.getByTestId('boss-altar-pane-dormant')).toBeInTheDocument();
    expect(screen.getByTestId('boss-altar-pane-dormant-label').textContent).toBe('Dormant');
    expect(screen.getByTestId('boss-altar-pane-dormant-subline').textContent).toMatch(/turn\s*3/i);
  });
});
