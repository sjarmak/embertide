import { create, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * LocalStorage key used to persist the "tutorial has been seen" flag.
 * Stored as the string `'1'` for truthy; absent or any other value is falsy.
 * A legacy `'true'` value is also accepted for robustness.
 */
export const TUTORIAL_STORAGE_KEY = 'rasc.tutorialSeen';

export interface TutorialState {
  readonly seen: boolean;
  markSeen(): void;
  reset(): void;
}

function readInitialSeen(): boolean {
  try {
    const v = globalThis.localStorage?.getItem(TUTORIAL_STORAGE_KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    globalThis.localStorage?.setItem(TUTORIAL_STORAGE_KEY, '1');
  } catch {
    // jsdom/localStorage should never throw, but don't let storage failures
    // break the UI state transition.
  }
}

function clearSeen(): void {
  try {
    globalThis.localStorage?.removeItem(TUTORIAL_STORAGE_KEY);
  } catch {
    // see writeSeen
  }
}

/**
 * Factory that creates a fresh Zustand store bound to `localStorage`.
 * Exported primarily for testability — tests can prime `localStorage` and
 * then call this factory to observe hydration behavior.
 */
export function createTutorialStore(): UseBoundStore<StoreApi<TutorialState>> {
  return create<TutorialState>((set) => ({
    seen: readInitialSeen(),
    markSeen() {
      writeSeen();
      set({ seen: true });
    },
    reset() {
      clearSeen();
      set({ seen: false });
    },
  }));
}

/**
 * Default singleton tutorial store, hydrated from `localStorage` at module
 * load time. Use this via the standard Zustand hook pattern:
 *
 *   const seen = useTutorialStore((s) => s.seen);
 *   const markSeen = useTutorialStore((s) => s.markSeen);
 */
export const useTutorialStore = createTutorialStore();
