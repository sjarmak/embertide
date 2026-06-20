import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('applyDebugSeed — production guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __gameStore?: unknown }).__gameStore;
  });

  it('returns false and never exposes __gameStore when import.meta.env.DEV is false', async () => {
    vi.stubEnv('DEV', false);
    const { applyDebugSeed } = await import('./playtestSeeds');
    const { useGameStore } = await import('../store/gameStore');

    const before = useGameStore.getState();
    const result = applyDebugSeed('craghorn');

    expect(result).toBe(false);
    expect((globalThis as { __gameStore?: unknown }).__gameStore).toBeUndefined();
    // Store state must not be mutated by the seed application.
    expect(useGameStore.getState()).toBe(before);
  });

  it('still applies the seed and exposes __gameStore in dev mode', async () => {
    vi.stubEnv('DEV', true);
    const { applyDebugSeed } = await import('./playtestSeeds');
    const { useGameStore } = await import('../store/gameStore');

    const before = useGameStore.getState();
    const result = applyDebugSeed('hp-downed');

    expect(result).toBe(true);
    expect((globalThis as { __gameStore?: unknown }).__gameStore).toBe(useGameStore);
    // initGame ran — guards against a regression where the seed returns
    // true and exposes __gameStore but silently skips the state mutation.
    expect(useGameStore.getState()).not.toBe(before);
  });

  it('does not expose __gameStore for the zone-dune-sanctum seed in prod', async () => {
    // Regression pin: zone-dune-sanctum has a second internal call to
    // exposeGameStoreForPlaytest beyond the applyDebugSeed entry call.
    // Both must stay guarded in prod.
    vi.stubEnv('DEV', false);
    const { applyDebugSeed } = await import('./playtestSeeds');

    const result = applyDebugSeed('zone-dune-sanctum');

    expect(result).toBe(false);
    expect((globalThis as { __gameStore?: unknown }).__gameStore).toBeUndefined();
  });
});

describe('resolveDebugSeed — colosseum-tier seed parsing (embertide-bcq8)', () => {
  it.each([
    ['colosseum-tier1', 'colosseum-tier1'],
    ['colosseum-tier2', 'colosseum-tier2'],
    ['colosseum-tier4', 'colosseum-tier4'],
    ['colosseum-tier5', 'colosseum-tier5'],
  ] as const)('parses ?debug=%s into %s', async (raw, expected) => {
    const { resolveDebugSeed } = await import('./playtestSeeds');
    expect(resolveDebugSeed(`?debug=${raw}`)).toBe(expected);
  });

  it('returns null for tier-3 (visual-spec follow-up not yet filed)', async () => {
    const { resolveDebugSeed } = await import('./playtestSeeds');
    expect(resolveDebugSeed('?debug=colosseum-tier3')).toBeNull();
  });
});

describe('applyDebugSeed — colosseum-tier seeds (embertide-bcq8)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __gameStore?: unknown }).__gameStore;
  });

  it.each([
    ['colosseum-tier1', 'craghorn', 1],
    ['colosseum-tier2', 'chimera', 2],
    ['colosseum-tier4', 'ossiarch', 4],
    ['colosseum-tier5', 'trinity-aurogax', 5],
  ] as const)(
    'dispatches a colosseum-slot combat against the canonical tier-%i boss when %s is applied',
    async (seed, expectedBossId, expectedTier) => {
      vi.stubEnv('DEV', true);
      const { applyDebugSeed } = await import('./playtestSeeds');
      const { useGameStore } = await import('../store/gameStore');

      const result = applyDebugSeed(seed);
      expect(result).toBe(true);

      const state = useGameStore.getState();
      expect(state.activeCombat).not.toBeNull();
      expect(state.activeCombat?.boss.sourceCardId).toBe(expectedBossId);
      // The kind/entrySource invariant in combatBootstrap.ts:455-470 requires
      // `entry.kind === 'boss' ⇔ entrySource === 'colosseum-slot'`.
      expect(state.activeCombat?.entryContext.entrySource).toBe('colosseum-slot');
      // Defensive coherence (architect MEDIUM #2): unlock the target tier
      // so HUD/preview reads remain consistent with the seeded combat.
      expect(state.colosseumProgression.unlockedTiers).toContain(expectedTier);
    },
  );
});
