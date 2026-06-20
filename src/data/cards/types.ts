/**
 * Local effect/metadata shapes used inside the cards data set.
 * Kept module-local because Card.effects is typed `unknown` in
 * src/types/card.ts — these shapes never escape the data layer.
 */

import type { Card } from '../../types/card';

export type ChestReward = { readonly reward: string; readonly weight: number };
export type ChestPool = { readonly weights: readonly ChestReward[] };

export type ChestCard = Card & { readonly pool: ChestPool };
export type FinalBossCard = Card & { readonly metadata: { readonly spawnTurn: number } };
export type LegendaryItemCard = Card & {
  readonly metadata: { readonly spawnTurn: number };
};

/**
 * A supply card. A card with `baseId` is a duplicate whose original
 * role-based id is stored in `baseId`; the first (base) copy of each
 * template has no `baseId` and its `id` IS the base id.
 */
export type SupplyCard = Card & { readonly baseId?: string };

export interface TemplateEntry {
  readonly template: Card;
  readonly copies: number;
}
