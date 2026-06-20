import { useEffect, useState, type JSX } from 'react';
// Load tokens first so the palette --hc-* custom properties resolve
// before any component CSS reads them (embertide-9vm / PRD V-1).
import './styles/tokens.css';
import './styles/app.css';
import Setup from './ui/Setup';
import GameBoard from './ui/GameBoard';
import Tutorial from './ui/Tutorial';
import type { GameConfig } from './ui/GameConfig';
import { ElysianDefs } from './icons/defs';
import { MotionRoot } from './motion/MotionRoot';
import { useGameStore } from './store/gameStore';
import { useTutorialStore } from './store/tutorialStore';
import { applyDebugSeed, resolveDebugSeed } from './debug/playtestSeeds';

/**
 * Top-level Kid Mode app shell.
 *
 * Renders <Setup /> until the first configuration is committed, then flips
 * into <GameBoard /> with the first-game tutorial overlay wired to the
 * persisted tutorial store.
 */
export default function App(): JSX.Element {
  const [setupDone, setSetupDone] = useState<boolean>(false);
  const turn = useGameStore((s) => s.turn);
  const seen = useTutorialStore((s) => s.seen);
  const markSeen = useTutorialStore((s) => s.markSeen);

  // Dev-only `?debug=<seed>` hook. Runs once on mount; if a seed matches
  // it initializes the store into a curated playtest state and skips
  // Setup. No-op for normal `/` loads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Prod guard (embertide-b3vn). Vite DCEs this branch in
    // production builds; combined with the function-level guard inside
    // playtestSeeds, the debug module's exports are unreachable and
    // Rollup eliminates them from the bundle. In dev the hook is intact.
    if (!import.meta.env.DEV) return;
    const seed = resolveDebugSeed(window.location.search);
    if (seed === null) return;
    const applied = applyDebugSeed(seed);
    if (applied) setSetupDone(true);
  }, []);

  const handleStart = (config: GameConfig) => {
    // Setup now emits one championId per seat (embertide-edv), so
    // App.tsx hands the list through unchanged. gameStore.initGame
    // enforces championIds.length === players.
    //
    // Fresh per-playthrough seed: without this, every new game reuses
    // the factory-time INITIAL_SEED=0 and produces the same deck /
    // market / chest shuffles — one symptom was a deterministic
    // chestRow of 3 Grand Vaults (no Sturdy Chest) for 3 of the 4
    // champions. Date.now() is good enough; we don't need
    // cryptographic randomness.
    useGameStore.getState().initGame({
      players: config.players,
      championIds: config.championIds,
      seed: Date.now(),
    });
    setSetupDone(true);
  };

  return (
    <MotionRoot>
      <main data-testid="app-root" className="app-root">
        <ElysianDefs />
        {!setupDone ? (
          <Setup onStart={handleStart} />
        ) : (
          <>
            <GameBoard />
            <Tutorial turn={turn} seen={seen} onSeen={markSeen} />
          </>
        )}
      </main>
    </MotionRoot>
  );
}
