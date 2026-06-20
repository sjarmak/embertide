import { describe, it, expect, beforeEach } from 'vitest';
import { createTutorialStore, TUTORIAL_STORAGE_KEY, useTutorialStore } from './tutorialStore';

describe('tutorialStore (MH-8)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates seen=false when localStorage is empty', () => {
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(false);
  });

  it('hydrates seen=true when localStorage has "1"', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(true);
  });

  it('hydrates seen=true when localStorage has "true" (legacy/robustness)', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(true);
  });

  it('hydrates seen=false for an unrelated value', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '0');
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(false);
  });

  it('markSeen() flips state to true and persists "1" to localStorage', () => {
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(false);
    store.getState().markSeen();
    expect(store.getState().seen).toBe(true);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('1');
  });

  it('reset() flips state to false and removes the localStorage entry', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    const store = createTutorialStore();
    expect(store.getState().seen).toBe(true);
    store.getState().reset();
    expect(store.getState().seen).toBe(false);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeNull();
  });

  it('exports a default singleton `useTutorialStore`', () => {
    expect(typeof useTutorialStore).toBe('function');
    const state = useTutorialStore.getState();
    expect(typeof state.markSeen).toBe('function');
    expect(typeof state.reset).toBe('function');
    expect(typeof state.seen).toBe('boolean');
  });
});
