/**
 * baseIds whose `heal` EffectSpec carries the `amount: 0` revive sentinel
 * (ppf9.2). The dispatcher (`playFairyOn`) substitutes `target.hpMax` at
 * use time; the generic "Heal teammate +N ♥" rendering would print "+0",
 * which is misleading. Each baseId in this set has a bespoke branch in
 * the per-baseId switch in `effectTextBase.ts`.
 */
export const WISP_BASE_IDS: ReadonlySet<string> = new Set([
  'wisp',
  'great-wisp',
  'wisp-in-bottle',
]);
