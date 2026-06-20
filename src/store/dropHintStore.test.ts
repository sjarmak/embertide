import { describe, it, expect, beforeEach } from 'vitest';
import { createDropHintStore, DROP_HINT_STORAGE_KEY } from './dropHintStore';

describe('dropHintStore (arq3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates seen=false when localStorage is empty', () => {
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(false);
  });

  it('hydrates seen=true when localStorage has "1"', () => {
    localStorage.setItem(DROP_HINT_STORAGE_KEY, '1');
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(true);
  });

  it('hydrates seen=true when localStorage has "true" (legacy/robustness)', () => {
    localStorage.setItem(DROP_HINT_STORAGE_KEY, 'true');
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(true);
  });

  it('hydrates seen=false when localStorage has any other value', () => {
    localStorage.setItem(DROP_HINT_STORAGE_KEY, '0');
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(false);
  });

  it('markSeen() flips state to true and persists "1" to localStorage', () => {
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(false);
    store.getState().markSeen();
    expect(store.getState().seen).toBe(true);
    expect(localStorage.getItem(DROP_HINT_STORAGE_KEY)).toBe('1');
  });

  it('reset() flips state to false and removes the localStorage entry', () => {
    localStorage.setItem(DROP_HINT_STORAGE_KEY, '1');
    const store = createDropHintStore();
    expect(store.getState().seen).toBe(true);
    store.getState().reset();
    expect(store.getState().seen).toBe(false);
    expect(localStorage.getItem(DROP_HINT_STORAGE_KEY)).toBeNull();
  });
});
