import { create, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * LocalStorage key used to persist the "player has dropped a card onto the
 * play zone at least once" flag (embertide-arq3). Stored as the string
 * `'1'` for truthy; absent or any other value is falsy. A legacy `'true'`
 * value is also accepted for robustness.
 */
export const DROP_HINT_STORAGE_KEY = 'rasc.dropHintSeen';

export interface DropHintState {
  readonly seen: boolean;
  markSeen(): void;
  reset(): void;
}

function readInitialSeen(): boolean {
  try {
    const v = globalThis.localStorage?.getItem(DROP_HINT_STORAGE_KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    globalThis.localStorage?.setItem(DROP_HINT_STORAGE_KEY, '1');
  } catch {
    // jsdom/localStorage should never throw, but don't let storage failures
    // break the UI state transition.
  }
}

function clearSeen(): void {
  try {
    globalThis.localStorage?.removeItem(DROP_HINT_STORAGE_KEY);
  } catch {
    // see writeSeen
  }
}

/**
 * Factory that creates a fresh Zustand store bound to `localStorage`.
 * Exported primarily for testability — tests can prime `localStorage` and
 * then call this factory to observe hydration behavior.
 */
export function createDropHintStore(): UseBoundStore<StoreApi<DropHintState>> {
  return create<DropHintState>((set) => ({
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
 * Default singleton drop-hint store, hydrated from `localStorage` at module
 * load time. The `seen` flag flips to `true` the first time the player drops
 * a card onto the play zone (InPlay drop-zone-empty) and persists across
 * sessions so the "Drag a card here to play it" copy never re-appears.
 */
export const useDropHintStore = createDropHintStore();
