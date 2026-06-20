/**
 * Generic monsters / mini-bosses / final-boss not bound to any zone.
 *
 * Zone-affiliated rosters (sylvani / emberpeak / maren / shadow /
 * spirit / gilded-cage) live under `./zones/`.
 */

import type { Card } from '../../types/card';
import type { FinalBossCard } from './types';

export const monsters: readonly Card[] = [
  {
    id: 'grunt-orc',
    role: 'monster',
    cost: { red: 3 },
    effects: { kind: 'monster-drop', hearts: 1 },
  },
  {
    id: 'spear-orc',
    role: 'monster',
    cost: { red: 4 },
    effects: { kind: 'monster-drop', hearts: 1 },
  },
  {
    id: 'squidlet',
    role: 'monster',
    cost: { red: 3 },
    effects: { kind: 'monster-drop', hearts: 1 },
  },
];

export const miniBosses: readonly Card[] = [
  {
    id: 'mini-boss-reptile',
    role: 'mini-boss',
    cost: { red: 7, keys: 1 },
    effects: { kind: 'monster-drop', hearts: 2 },
  },
  {
    // r94e drop-variety: mini-boss tier — +2 hearts + +2 gems. The bigger
    // gem payout differentiates the mini-boss kill from a tougher
    // regular without inflating heart drops past the vital-ember
    // tier. mini-boss-reptile keeps the legacy hearts-only drop so the
    // existing mini-boss `+2 ♥` card-face test (effectText.test.tsx)
    // doesn't regress on the first-by-role lookup.
    id: 'mini-boss-slime',
    role: 'mini-boss',
    cost: { red: 8, keys: 1 },
    effects: { kind: 'monster-drop', hearts: 2, gems: 2 },
  },
];

export const finalBoss: FinalBossCard = {
  id: 'dark-lord',
  role: 'final-boss',
  cost: { red: 10, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 2 },
  metadata: { spawnTurn: 8 },
};
