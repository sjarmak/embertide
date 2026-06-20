import { afterEach, describe, expect, it, vi } from 'vitest';

import { allowBackdropBlurStrong, allowDisplacement, allowMixBlendShimmer } from './capability';

/**
 * embertide-cup (PRD V-1b) — unit coverage for the capability gates.
 *
 * Each test installs a `matchMedia` stub that answers a specific query with
 * `matches: true` (all other queries return `false`). `navigator.hardwareConcurrency`
 * is swapped via `Object.defineProperty` so we can simulate low-core devices
 * without polluting adjacent tests — a restore step runs in `afterEach`.
 */

interface MediaQueryListLike {
  readonly matches: boolean;
  readonly media: string;
  addEventListener: () => void;
  removeEventListener: () => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
  onchange: null;
}

type MatchMediaStub = (query: string) => MediaQueryListLike;

function installMatchMedia(stub: MatchMediaStub): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: stub,
  });
}

function installHardwareConcurrency(cores: number | undefined): void {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    get: () => cores,
  });
}

/**
 * embertide-ozl — precise navigator.userAgent restore.
 *
 * We snapshot jsdom's *prototype* descriptor for `userAgent` once, at module
 * load, before any test has a chance to override it. Each `installUserAgent`
 * call installs a configurable own-property accessor on `navigator` (which
 * shadows the prototype getter). `restoreUserAgent` tears that own property
 * down and re-installs the original descriptor on `Navigator.prototype`,
 * leaving the environment byte-identical to the pre-install state instead
 * of a synthetic accessor masquerading as the native one.
 *
 * If jsdom ever stops exposing `userAgent` as a prototype descriptor
 * (`originalNavigatorProtoUaDescriptor` undefined), restore degrades to an
 * own-prop delete — which is the closest faithful reset available.
 */
const originalNavigatorProtoUaDescriptor = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'userAgent',
);

// Track whether any test actually installed a userAgent override this run.
// `restoreUserAgent` unconditionally re-installing the prototype descriptor
// on every afterEach couples all teardown to jsdom's internal prototype
// shape — benign today (descriptor is identical) but divergent from the
// install-with-default idiom used by the sibling helpers. Flipping to a
// flag-guarded restore means tests that never install leave the prototype
// alone entirely.
let userAgentWasInstalled = false;

function installUserAgent(ua: string | undefined): void {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  });
  userAgentWasInstalled = true;
}

function restoreUserAgent(): void {
  if (!userAgentWasInstalled) return;
  // Remove any own-property override so the prototype descriptor is visible.
  if (Object.prototype.hasOwnProperty.call(navigator, 'userAgent')) {
    delete (navigator as unknown as { userAgent?: string }).userAgent;
  }
  // Re-install the captured native descriptor on the prototype, in case a
  // prior test replaced it there directly (defensive — current tests don't,
  // but the guarantee of this helper is "leave Navigator.prototype alone").
  if (originalNavigatorProtoUaDescriptor !== undefined) {
    Object.defineProperty(Navigator.prototype, 'userAgent', originalNavigatorProtoUaDescriptor);
  }
  userAgentWasInstalled = false;
}

function mediaQueryList(media: string, matches: boolean): MediaQueryListLike {
  return {
    matches,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  };
}

function matchOnly(matchingQuery: string): MatchMediaStub {
  return (query: string) => mediaQueryList(query, query === matchingQuery);
}

afterEach(() => {
  vi.restoreAllMocks();
  // Restore defaults — jsdom's own getters.
  installMatchMedia((query) => mediaQueryList(query, false));
  installHardwareConcurrency(8);
  restoreUserAgent();
});

describe('allowDisplacement', () => {
  it('returns true on a capable desktop (fine pointer, 8 cores, no reduced motion)', () => {
    installMatchMedia((query) => mediaQueryList(query, false));
    installHardwareConcurrency(8);
    expect(allowDisplacement()).toBe(true);
  });

  it('returns false when the pointer is coarse (mobile / touch)', () => {
    installMatchMedia(matchOnly('(pointer: coarse)'));
    installHardwareConcurrency(8);
    expect(allowDisplacement()).toBe(false);
  });

  it('returns false on low-core hardware (≤ 4)', () => {
    installMatchMedia((query) => mediaQueryList(query, false));
    installHardwareConcurrency(4);
    expect(allowDisplacement()).toBe(false);
  });

  it('returns false when the user prefers reduced motion', () => {
    installMatchMedia(matchOnly('(prefers-reduced-motion: reduce)'));
    installHardwareConcurrency(8);
    expect(allowDisplacement()).toBe(false);
  });
});

describe('allowMixBlendShimmer', () => {
  // embertide-8if — iOS Safari has a known composition bug where
  // `mix-blend-mode: screen` over a filtered background renders as dark
  // squares. The gate returns false on iOS Safari majors known to be
  // affected (< 17) and true everywhere else, including Chrome/Firefox
  // on iOS (which use their own branded UA strings).

  it('returns true on desktop Chrome (non-iOS, no affected bug)', () => {
    installUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on desktop Safari on macOS', () => {
    installUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on desktop Firefox', () => {
    installUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns false on iOS Safari 15 (iPhone — affected version)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(false);
  });

  it('returns false on iOS Safari 16 (iPad — affected version)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(false);
  });

  it('returns true on iOS Safari 17 (first known-good major)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on iOS Safari 18 (newer major)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on Chrome for iOS (CriOS — not WebKit Safari composition path)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on Firefox for iOS (FxiOS)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true on Edge for iOS (EdgiOS)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 EdgiOS/120.0.2210.91 Mobile/15E148 Safari/605.1.15',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true when userAgent is empty (permissive fallback)', () => {
    installUserAgent('');
    expect(allowMixBlendShimmer()).toBe(true);
  });

  it('returns true when iOS UA is missing a Version/ token (malformed — permissive fallback)', () => {
    installUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });

  // Known gap — err permissive (embertide-tj9). iPadOS 13+ "Request
  // Desktop Site" reports a Mac desktop UA with no iPhone/iPad/iPod
  // marker, so the /iPad|iPhone|iPod/ guard in iOSSafariMajor() cannot
  // see it. Affected iPadOS <17 in desktop mode therefore get shimmer
  // enabled despite the mix-blend bug. See capability.ts comment
  // "iPadOS 13+ desktop masquerade is intentionally not detected".
  //
  // This test locks the current permissive behavior so a future
  // maintainer who tightens the guard must deliberately update this
  // test — preventing a silent "tightening" that ships without
  // reviewing the design decision.
  it('returns true on iPadOS 13+ in desktop mode (documented gap — err permissive)', () => {
    // Real iPadOS 13+ "Request Desktop Site" UA — indistinguishable
    // from macOS Safari at the UA-string level.
    installUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15',
    );
    expect(allowMixBlendShimmer()).toBe(true);
  });
});

describe('allowBackdropBlurStrong', () => {
  it('returns true on a capable desktop', () => {
    installMatchMedia((query) => mediaQueryList(query, false));
    installHardwareConcurrency(8);
    expect(allowBackdropBlurStrong()).toBe(true);
  });

  it('returns false on low-core hardware (≤ 4)', () => {
    installMatchMedia((query) => mediaQueryList(query, false));
    installHardwareConcurrency(4);
    expect(allowBackdropBlurStrong()).toBe(false);
  });

  it('returns false when the user prefers reduced motion', () => {
    installMatchMedia(matchOnly('(prefers-reduced-motion: reduce)'));
    installHardwareConcurrency(8);
    expect(allowBackdropBlurStrong()).toBe(false);
  });

  it('stays enabled on coarse-pointer high-core hardware (touch-screen laptop)', () => {
    // Heavy backdrop blur is only gated on core-count and reduced-motion —
    // not on pointer type — because a Surface-class device can afford it.
    installMatchMedia(matchOnly('(pointer: coarse)'));
    installHardwareConcurrency(8);
    expect(allowBackdropBlurStrong()).toBe(true);
  });
});

describe('installUserAgent lifecycle (embertide-ozl)', () => {
  // These tests exist to pin the contract of the test-level helpers
  // `installUserAgent` / `restoreUserAgent`: after restore, the descriptor
  // shape surfaced to `navigator.userAgent` must match the baseline we
  // captured before any test ran — i.e. jsdom's native accessor on
  // `Navigator.prototype`, not a synthetic getter we installed ourselves.

  it('returns the installed fake UA while an override is active', () => {
    installUserAgent('Mozilla/5.0 (Test-Harness; lifecycle-1)');
    expect(navigator.userAgent).toBe('Mozilla/5.0 (Test-Harness; lifecycle-1)');
  });

  it('restores the exact pre-install userAgent value', () => {
    const pristine = navigator.userAgent;
    installUserAgent('Mozilla/5.0 (Test-Harness; lifecycle-2)');
    expect(navigator.userAgent).toBe('Mozilla/5.0 (Test-Harness; lifecycle-2)');
    restoreUserAgent();
    expect(navigator.userAgent).toBe(pristine);
  });

  it('leaves navigator with no own userAgent property after restore', () => {
    installUserAgent('Mozilla/5.0 (Test-Harness; lifecycle-3)');
    expect(Object.prototype.hasOwnProperty.call(navigator, 'userAgent')).toBe(true);
    restoreUserAgent();
    expect(Object.prototype.hasOwnProperty.call(navigator, 'userAgent')).toBe(false);
  });

  it('restores the exact native Navigator.prototype descriptor (no synthetic accessor remains)', () => {
    if (originalNavigatorProtoUaDescriptor === undefined) {
      // jsdom build without a prototype-level descriptor — nothing to check.
      // The own-prop delete in `restoreUserAgent` is the strongest faithful
      // reset available in that environment.
      return;
    }
    installUserAgent('Mozilla/5.0 (Test-Harness; lifecycle-4)');
    restoreUserAgent();
    const current = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    // `Object.getOwnPropertyDescriptor` returns a fresh wrapper on each
    // call, so reference equality on the descriptor object is wrong —
    // what we actually care about is that the *accessor function* on the
    // prototype is still jsdom's native one (not a synthetic getter we
    // installed), plus that the flag shape is identical.
    expect(current).toBeDefined();
    expect(current?.get).toBe(originalNavigatorProtoUaDescriptor.get);
    expect(current?.set).toBe(originalNavigatorProtoUaDescriptor.set);
    expect(current?.configurable).toBe(originalNavigatorProtoUaDescriptor.configurable);
    expect(current?.enumerable).toBe(originalNavigatorProtoUaDescriptor.enumerable);
  });

  it('stays correct across two install/restore cycles', () => {
    const pristine = navigator.userAgent;

    installUserAgent('Mozilla/5.0 (Test-Harness; cycle-1)');
    expect(navigator.userAgent).toBe('Mozilla/5.0 (Test-Harness; cycle-1)');
    restoreUserAgent();
    expect(navigator.userAgent).toBe(pristine);

    installUserAgent('Mozilla/5.0 (Test-Harness; cycle-2)');
    expect(navigator.userAgent).toBe('Mozilla/5.0 (Test-Harness; cycle-2)');
    restoreUserAgent();
    expect(navigator.userAgent).toBe(pristine);
  });
});
