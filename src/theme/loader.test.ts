import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTheme } from './loader';
import { GENERIC_THEME } from './generic';
import { CARD_ROLES } from '../types/card';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('loadTheme', () => {
  it('returns the generic theme when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const theme = await loadTheme();
    expect(theme).toEqual(GENERIC_THEME);
  });

  it('returns the generic theme when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(null, { ok: false, status: 404 })),
    );

    const theme = await loadTheme();
    expect(theme).toEqual(GENERIC_THEME);
  });

  it('returns the parsed theme merged over generic when fetch succeeds', async () => {
    // The override payload below intentionally uses IP-flavored strings to
    // prove the loader accepts arbitrary display text from the runtime file.
    // These strings MUST NOT appear in src/types/ or src/theme/generic.ts.
    const override = {
      'final-boss': 'Vurmox',
      'legendary-sword': 'Emberblade',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(override)));

    const theme = await loadTheme();
    expect(theme['final-boss']).toBe('Vurmox');
    expect(theme['legendary-sword']).toBe('Emberblade');
    // Unspecified roles fall through to the generic theme.
    expect(theme['hero']).toBe(GENERIC_THEME.hero);
  });

  it('falls back to generic theme when response body is not an object of strings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(['not', 'an', 'object'])));

    const theme = await loadTheme();
    expect(theme).toEqual(GENERIC_THEME);
  });
});

describe('GENERIC_THEME coverage', () => {
  it('has a non-empty string entry for every CardRole', () => {
    for (const role of CARD_ROLES) {
      const value = GENERIC_THEME[role];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
