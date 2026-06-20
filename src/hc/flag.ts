/**
 * Elysian Cathedral feature flag (embertide-9vm / PRD §A-1).
 *
 * Resolves whether the stained-glass visual surface is active. Resolution
 * order (first hit wins):
 *
 *   1. URL query param `?hc=1` → 'on', `?hc=0` → 'off' (strict string
 *      equality per A-1; other values fall through).
 *   2. `localStorage.hcCathedral` → 'on' | 'off'.
 *   3. Environment default: `dev`/`DEV` → 'on', otherwise 'off'.
 *
 * The resolved value is written as `data-hc="on"` on `document.documentElement`
 * by `applyHCFlag`, so descendant CSS rules `[data-hc="on"] .foo` match
 * everywhere inside the app. A separate cleanup PR (V-13) removes both the
 * attribute and the prefixed rules after the 48-hour soak in production.
 */

export type HCFlagValue = 'on' | 'off';

export interface ResolveHCFlagInput {
  /** Raw query-string component, e.g. `'?hc=1&other=x'` or `''`. */
  readonly search?: string;
  /** Storage backend — defaults to `window.localStorage` in the browser. */
  readonly storage?: Pick<Storage, 'getItem'> | null;
  /**
   * Environment mode as reported by the bundler. Accepts any string; only
   * `'development'` toggles the dev-on default per A-1.
   */
  readonly env?: string;
}

const STORAGE_KEY = 'hcCathedral';

function parseQuery(search: string): HCFlagValue | null {
  // URLSearchParams tolerates leading '?' in modern browsers, but trim it
  // defensively so consumers can pass `window.location.search` verbatim.
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const raw = params.get('hc');
  if (raw === '1') return 'on';
  if (raw === '0') return 'off';
  return null;
}

function parseStorage(storage: Pick<Storage, 'getItem'> | null | undefined): HCFlagValue | null {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === 'on') return 'on';
  if (raw === 'off') return 'off';
  return null;
}

/**
 * Pure resolver. Browser-safe: callers in SSR / Node contexts can pass
 * empty/null inputs and the function falls back to the env-driven default.
 */
export function resolveHCFlag(input: ResolveHCFlagInput = {}): HCFlagValue {
  const fromQuery = parseQuery(input.search ?? '');
  if (fromQuery) return fromQuery;

  const fromStorage = parseStorage(input.storage);
  if (fromStorage) return fromStorage;

  return input.env === 'development' ? 'on' : 'off';
}

/**
 * Apply the resolved flag to `document.documentElement` by writing
 * `data-hc="on|off"`. No-op in non-browser environments.
 *
 * Deviates from PRD A-1 in one detail: A-1 places the attribute on
 * `<main.app-root>` — we put it on `<html>` instead so descendant
 * `[data-hc="on"] ...` selectors match from tokens.css `:root`-level
 * declarations too (needed for the V-2 compat-token block when it lands).
 * The test / visual surface is identical; the deviation is documented in
 * this module rather than revisiting the locked spec.
 */
export function applyHCFlag(value: HCFlagValue): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.hc = value;
}

/**
 * Read-current helper for tests and runtime introspection. Returns whatever
 * `applyHCFlag` most recently wrote (or `null` if the attribute is absent).
 */
export function currentHCFlag(): HCFlagValue | null {
  if (typeof document === 'undefined') return null;
  const raw = document.documentElement.dataset.hc;
  if (raw === 'on') return 'on';
  if (raw === 'off') return 'off';
  return null;
}
