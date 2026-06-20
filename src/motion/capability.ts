/**
 * Device-capability gates for expensive visual effects.
 *
 * Spec: PRD A-9 — Elysian Cathedral motion/visual treatments must
 * gracefully degrade on low-power hardware (mobile coarse pointer, low
 * core counts) and on user reduced-motion preferences.
 *
 * Each helper is **SSR-safe**: when `window` is undefined (Node, Vitest
 * default jsdom-less context, build-time evaluation) it returns a sensible
 * default that errs on the side of *enabling* effects in dev/test so we
 * still see them in stories — production gating happens at runtime in the
 * browser where `window` is real.
 *
 * Usage example:
 * ```tsx
 * import { allowDisplacement } from '../motion/capability';
 *
 * const filter = allowDisplacement() ? 'url(#hc-glass-refract)' : 'none';
 * ```
 *
 * The helpers are intentionally synchronous and side-effect free. Call
 * them at render-time, or memoize the result inside a component if it
 * matters for re-renders.
 */

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

function matchesPointerCoarse(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function matchesReducedMotion(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function lowCoreCount(threshold: number): boolean {
  if (!isBrowser()) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores !== 'number' || Number.isNaN(cores)) {
    // Older browsers without hardwareConcurrency — treat as capable.
    return false;
  }
  return cores <= threshold;
}

/**
 * SVG `feDisplacementMap` (the `#hc-glass-refract` filter) is the most
 * expensive primitive in the Cathedral toolkit. Disable on:
 *   - Coarse-pointer devices (proxy for mobile / touch where the per-frame
 *     fragment cost is too high on integrated GPUs).
 *   - Hardware concurrency ≤ 4 (low-tier laptops, older Chromebooks).
 *   - User preference for reduced motion.
 */
export function allowDisplacement(): boolean {
  if (matchesPointerCoarse()) return false;
  if (lowCoreCount(4)) return false;
  if (matchesReducedMotion()) return false;
  return true;
}

/**
 * Detect iOS Safari majors affected by the `mix-blend-mode` + `filter`
 * miscomposition bug (WebKit filter + blend-mode composition class of
 * issues; see webkit.org/b/ tracker). Returns the parsed iOS Safari
 * major version when the UA matches real iOS Safari proper, or
 * `undefined` for every other browser/shape (Chrome iOS / Firefox iOS /
 * Edge iOS, desktop browsers, missing or malformed UA).
 *
 * Conservative extraction rules:
 *   1. UA must contain `iPad`, `iPhone`, or `iPod` (iPadOS 13+ desktop
 *      masquerade is intentionally not detected — we err permissive
 *      there; see embertide-8if notes).
 *   2. UA must NOT contain `CriOS`, `FxiOS`, or `EdgiOS` (those wrap
 *      WebKit but take a different compositor path).
 *   3. UA must contain a `Version/<major>[.<minor>]` token — that is the
 *      Safari branding version on iOS (WebKit build number is a
 *      different token and not what we want).
 */
function iOSSafariMajor(): number | undefined {
  if (!isBrowser()) return undefined;
  const ua = navigator.userAgent;
  if (typeof ua !== 'string' || ua.length === 0) return undefined;
  if (!/iPad|iPhone|iPod/.test(ua)) return undefined;
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return undefined;
  const match = /Version\/(\d+)(?:\.\d+)?/.exec(ua);
  if (!match) return undefined;
  const major = Number.parseInt(match[1], 10);
  if (!Number.isFinite(major)) return undefined;
  return major;
}

/**
 * Card hover shimmer overlays use
 * `mix-blend-mode: screen`. iOS Safari majors prior to 17 miscomposite
 * this primitive over filtered backgrounds, rendering dark squares
 * instead of a screen blend. Apple's WebKit landed compositor fixes in
 * the iOS 17 line; we use `< 17` as a conservative threshold because
 * failing to enable a decorative shimmer on a capable device is
 * preferable to broken composition on an affected one.
 *
 * For Chrome / Firefox / Edge on iOS (`CriOS` / `FxiOS` / `EdgiOS`),
 * and for every non-iOS browser, the gate returns `true` — those
 * browsers either don't take the affected WebKit compositor path or
 * aren't affected.
 *
 * embertide-8if (originally tracked as PRD V-1) — implements the
 * UA-sniff called out in the prior T-5 permissive stub.
 */
export function allowMixBlendShimmer(): boolean {
  if (!isBrowser()) return true;
  const major = iOSSafariMajor();
  if (major === undefined) return true;
  return major >= 17;
}

/**
 * Heavy `backdrop-filter: blur(…)` (modal scrims, winner-overlay darken)
 * costs full-screen GPU work each frame. Disable on:
 *   - Hardware concurrency ≤ 4.
 *   - User preference for reduced motion (the blur is decorative).
 */
export function allowBackdropBlurStrong(): boolean {
  if (lowCoreCount(4)) return false;
  if (matchesReducedMotion()) return false;
  return true;
}
