import { afterEach, describe, expect, it } from 'vitest';

import { applyHCFlag, currentHCFlag, resolveHCFlag } from './flag';

function fakeStorage(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
    },
  };
}

describe('resolveHCFlag (embertide-9vm)', () => {
  it("returns 'on' when ?hc=1 is present", () => {
    expect(resolveHCFlag({ search: '?hc=1', env: 'production' })).toBe('on');
  });

  it("returns 'off' when ?hc=0 is present", () => {
    expect(resolveHCFlag({ search: '?hc=0', env: 'development' })).toBe('off');
  });

  it('ignores non-strict query values per A-1 strict-equality spec', () => {
    // A-1: strict `=== '1'` / `=== '0'` string equality.
    expect(resolveHCFlag({ search: '?hc=true', env: 'production' })).toBe('off');
    expect(resolveHCFlag({ search: '?hc=yes', env: 'development' })).toBe('on');
    expect(resolveHCFlag({ search: '?hc=', env: 'production' })).toBe('off');
  });

  it('falls through to localStorage when query is absent', () => {
    const storage = fakeStorage({ hcCathedral: 'on' });
    expect(resolveHCFlag({ search: '', storage, env: 'production' })).toBe('on');
  });

  it("ignores non-'on'/'off' storage values and falls through to env default", () => {
    const storage = fakeStorage({ hcCathedral: 'yes' });
    expect(resolveHCFlag({ search: '', storage, env: 'development' })).toBe('on');
    expect(resolveHCFlag({ search: '', storage, env: 'production' })).toBe('off');
  });

  it("defaults 'on' in development when no explicit signal is present", () => {
    expect(resolveHCFlag({ search: '', env: 'development' })).toBe('on');
  });

  it("defaults 'off' in production when no explicit signal is present", () => {
    expect(resolveHCFlag({ search: '', env: 'production' })).toBe('off');
  });

  it('query wins over localStorage', () => {
    const storage = fakeStorage({ hcCathedral: 'off' });
    expect(resolveHCFlag({ search: '?hc=1', storage, env: 'production' })).toBe('on');
  });

  it('localStorage wins over env default', () => {
    const storage = fakeStorage({ hcCathedral: 'off' });
    expect(resolveHCFlag({ search: '', storage, env: 'development' })).toBe('off');
  });
});

describe('applyHCFlag / currentHCFlag (embertide-9vm)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-hc');
  });

  it("writes data-hc='on' to documentElement when flag resolves on", () => {
    applyHCFlag('on');
    expect(document.documentElement.getAttribute('data-hc')).toBe('on');
    expect(currentHCFlag()).toBe('on');
  });

  it("writes data-hc='off' to documentElement when flag resolves off", () => {
    applyHCFlag('off');
    expect(document.documentElement.getAttribute('data-hc')).toBe('off');
    expect(currentHCFlag()).toBe('off');
  });

  it('returns null from currentHCFlag when the attribute is absent', () => {
    expect(currentHCFlag()).toBeNull();
  });
});
