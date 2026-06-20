import { GENERIC_THEME } from './generic';

/**
 * Path to the optional runtime theme file. Households may drop a local
 * theme.json into public/ to override display strings. When the file is
 * absent or malformed, we fall back to the generic (IP-safe) theme.
 */
const THEME_URL = '/theme.json';

/**
 * Load the display theme at runtime.
 *
 * Attempts to fetch `/theme.json`. On any failure (network error, non-ok
 * response, invalid JSON, non-object payload), the generic theme is
 * returned. On success, the parsed theme is merged over the generic
 * theme so missing keys still resolve.
 */
export async function loadTheme(): Promise<Record<string, string>> {
  try {
    const response = await fetch(THEME_URL);
    if (!response.ok) {
      return { ...GENERIC_THEME };
    }

    const parsed: unknown = await response.json();
    if (!isStringRecord(parsed)) {
      return { ...GENERIC_THEME };
    }

    return { ...GENERIC_THEME, ...parsed };
  } catch {
    return { ...GENERIC_THEME };
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === 'string',
  );
}
