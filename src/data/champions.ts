/**
 * Kid Mode Champions (simplified Dawn of Champions, §14).
 *
 * Each Champion is a persistent player-attached identity chosen at setup.
 * A Champion provides:
 *   (a) a portrait card id used by the Setup champion picker for art lookup
 *       (`portraitCardId` — see SPEC_BY_BASE_ID in src/ui/CardArt.tsx), and
 *   (b) a passive/triggered start-of-turn (or combat) power.
 *
 * History (j49z, 2026-04-24): the field was renamed from `starterCardId` to
 * `portraitCardId` after the `starter-home` role was retired. The four
 * referenced ids (spirit-arrow / seer-rune / warblade / ancient-keepsake)
 * no longer correspond to KID_CARDS entries — they are portrait-only keys
 * the picker uses to look up bespoke rasters (cathedral_starter_champion_*).
 *
 * IP-safety note: every id is a generic role-based kebab-case string and the
 * `displayName` is non-franchise. Aurelia flavor lives exclusively in
 * `public/theme.example.json` (the runtime skin reference file).
 */

export interface KidChampion {
  readonly id: string;
  /**
   * Generic kebab-case id used as the lookup key for the champion's bespoke
   * portrait raster in the Setup picker (SPEC_BY_BASE_ID, src/ui/CardArt.tsx).
   *
   * NOTE (j49z, 2026-04-24): this used to be `starterCardId` and pointed at
   * a `role: 'starter-home'` entry in KID_CARDS. Both the role and those
   * card entries were retired — the id remains as a portrait-only key so
   * the four bespoke rasters (cathedral_starter_champion_courage / wisdom /
   * power / sword) keep rendering distinct silhouettes in the picker.
   */
  readonly portraitCardId: string;
  /** Non-IP display name shown in Setup and TurnBanner. */
  readonly displayName: string;
  /** Short human-readable description of the champion's passive power. */
  readonly passiveDescription: string;
}

export const KID_CHAMPIONS: readonly KidChampion[] = [
  {
    id: 'champion-courage',
    portraitCardId: 'spirit-arrow',
    displayName: 'Valor Warden',
    passiveDescription: '+1 heart when you defeat a mini-boss or final-boss',
  },
  {
    id: 'champion-wisdom',
    portraitCardId: 'seer-rune',
    displayName: 'Lore Warden',
    passiveDescription: 'Draw 1 extra card at the start of your turn',
  },
  {
    id: 'champion-power',
    portraitCardId: 'warblade',
    displayName: 'Might Warden',
    passiveDescription: '+2 power at the start of your turn',
  },
  {
    id: 'champion-sword',
    portraitCardId: 'ancient-keepsake',
    displayName: 'Blade Warden',
    passiveDescription:
      '+1 green at the start of your turn, +1 bonus heart when defeating a region boss',
  },
];

/**
 * Look up a champion by id. Returns undefined when the id is not registered —
 * callers should throw their own domain-appropriate error.
 */
export function findChampion(id: string): KidChampion | undefined {
  return KID_CHAMPIONS.find((c) => c.id === id);
}
