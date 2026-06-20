/**
 * Concrete SVG path data for the `hero_warrior_upright` silhouette.
 *
 * The silhouette template (`templates/heroes.ts`) names four base paths:
 *   - head-helm       — peaked helm with cheek guards, no facial detail
 *   - torso-plate     — trapezoidal cuirass + pauldrons
 *   - weapon-vertical — centered sword with jewel at crossguard
 *   - lower-robes-or-greaves — inverted trapezoid beneath the torso
 *
 * All paths are authored inside a 24x24 viewBox matching `renderContract.md`.
 * Coordinates are tuned by hand so that the figure reads as a noble knight
 * at 24px: head above torso, weapon vertical on the central axis, lower
 * silhouette spreading into a stable base.
 *
 * See `design/premises`: geometric Wind-Waker-vector primitives, not
 * photo-real anatomy.
 */

export interface HeroWarriorUprightPaths {
  /** Primary-fill paths (rendered under `<g id="fill-primary">`). */
  headHelm: string[];
  /** Primary-fill paths (rendered under `<g id="fill-primary">`). */
  torsoPlate: string[];
  /**
   * Secondary-fill paths (rendered under `<g id="fill-secondary">`).
   * The sword draws in the secondary tone so the weapon jewel + crossguard
   * pop against the primary-fill torso.
   */
  weaponVertical: string[];
  /** Primary-fill paths (rendered under `<g id="fill-primary">`). */
  lowerRobesOrGreaves: string[];
  /**
   * Single top-left wedge path for the highlight layer. The spec mandates
   * exactly one highlight family; this is it. Rendered under
   * `<g id="highlight">` with opacity ~0.85.
   */
  highlightWedge: string;
}

export function getHeroWarriorPaths(): HeroWarriorUprightPaths {
  return {
    // Head-helm anchor: (12, 6). A proper knightly conical helm:
    //   - Domed/peaked crown rising to a finial.
    //   - Forward-tilted brow ridge (visor band).
    //   - Cheek guards flaring slightly outward.
    //   - Dark eye-slit implied by negative space between the brow band
    //     and the cheek guards (forbidden features rule = no facial detail).
    headHelm: [
      // Main helm body — a compact, narrower knight's helm sitting in the
      // upper third of the canvas. Domed crown from y=3.4 to y=8.0, then
      // cheek guards flaring slightly from y=8.0 to y=9.4 (gorget line).
      // Width at cheek line ≈4.6 (narrower than the breastplate), so
      // shoulders read as wider than head — proper heroic silhouette.
      'M 9.4 9.4 Q 9.0 8.4 9.0 6.6 Q 9.0 4.4 12.0 3.4 Q 15.0 4.4 15.0 6.6 Q 15.0 8.4 14.6 9.4 L 14.2 9.6 L 9.8 9.6 Z',
      // Brow ridge / visor slit — narrow horizontal slit at eye level
      // (y=7.0–7.15). Reads as the eye slit through the helm without
      // committing to a heavy mask band.
      'M 9.6 7.0 L 14.4 7.0 L 14.4 7.15 L 9.6 7.15 Z',
      // Left cheek guard accent — small cup at the jawline.
      'M 9.0 8.2 L 8.8 9.4 L 9.6 9.6 L 9.8 8.2 Z',
      // Right cheek guard (mirror).
      'M 15.0 8.2 L 15.2 9.4 L 14.4 9.6 L 14.2 8.2 Z',
    ],

    // Torso-plate anchor: (12, 12). Now with proper rounded pauldrons that
    // read as armor caps, a tapered cuirass, and a fauld (waist plate) at
    // the bottom. The single mass becomes three readable cells: pauldron-L,
    // pauldron-R, central breastplate.
    torsoPlate: [
      // Pauldrons — flatter rounded shoulder caps (a smooth dome rather
      // than a tall arch). They start at the gorget line (y=10.4) and
      // arc gently up to y=10.0 before sweeping out and down to y=12.6.
      // The flatter dome reads as armor, not as eyebrows/horns.
      'M 6.8 12.6 L 6.8 11.0 Q 7.4 10.0 9.4 10.0 L 9.8 10.6 L 9.8 12.6 Z',
      'M 17.2 12.6 L 17.2 11.0 Q 16.6 10.0 14.6 10.0 L 14.2 10.6 L 14.2 12.6 Z',
      // Central breastplate — narrower than pauldrons, anatomically
      // tapered to waist (y=14.6) and flaring into a fauld skirt
      // (y=14.6 → 16.4).
      'M 9.8 10.0 L 14.2 10.0 L 14.4 13.4 Q 14.2 13.9 13.8 14.4 L 14.4 16.4 L 9.6 16.4 L 10.2 14.4 Q 9.8 13.9 9.6 13.4 Z',
      // Belt cinch line at the waist — separates breastplate cell from
      // fauld cell.
      'M 9.8 14.4 L 14.2 14.4',
      // Pauldron rivets — small round dots at the shoulder edge (one per
      // pauldron). Reads as armor without facial detail.
      'M 8.0 11.0 Q 8.0 10.6 8.4 10.6 Q 8.8 10.6 8.8 11.0 Q 8.8 11.4 8.4 11.4 Q 8.0 11.4 8.0 11.0 Z',
      'M 15.2 11.0 Q 15.2 10.6 15.6 10.6 Q 16.0 10.6 16.0 11.0 Q 16.0 11.4 15.6 11.4 Q 15.2 11.4 15.2 11.0 Z',
    ],

    // Weapon-vertical anchor: (12, 14) — crossguard midpoint. Centered on
    // the main axis. The sword now has wider blade taper, a clearly
    // separated crossguard with flared wing-tips, a wrapped grip, and a
    // proper round pommel jewel. IP-safe per icons.md §3.5: guard-to-blade
    // ratio wider than 1:3, no upward wings, round pommel gem.
    weaponVertical: [
      // Composition note: the warrior is holding the sword UPRIGHT in
      // front of his torso, blade pointing UP. Tip at y=10.0 (just below
      // the helm gorget at y=9.6 so the helm is unobstructed), down to
      // crossguard at y=15.0 (belt line), grip + pommel below.
      // Blade — long taper from base width 1.6 to a sharp tip. Length
      // ≈5 viewBox units — clearly readable as a sword blade.
      'M 11.2 15.0 L 12.8 15.0 L 12.6 11.6 L 12.0 10.0 L 11.4 11.6 Z',
      // Fuller — thin diamond cell down blade center, runs from y=10.8
      // (near tip) to y=14.6 (just above guard).
      'M 12.0 10.8 L 12.18 12.7 L 12.0 14.6 L 11.82 12.7 Z',
      // Crossguard — clean hexagonal bar with DOWNWARD-angled wing tips
      // (IP-safe per icons.md §3.5: wings angle DOWN, not up). Width 7.0
      // vs blade base 1.6 → ~1:4.4 ratio, well outside Emberblade.
      // The bar is a single elongated hexagon — no awkward shoulder
      // notches between the bar and the blade base.
      'M 8.5 14.8 L 15.5 14.8 L 16.0 15.4 L 15.0 16.4 L 9.0 16.4 L 8.0 15.4 Z',
      // Crossguard center jewel — oval gem set into the guard.
      'M 12.0 14.8 Q 12.8 14.8 12.8 15.5 Q 12.8 16.2 12.0 16.2 Q 11.2 16.2 11.2 15.5 Q 11.2 14.8 12.0 14.8 Z',
      // Grip — narrow wrapped column from guard down to pommel.
      'M 11.55 16.4 L 12.45 16.4 L 12.4 18.0 L 11.6 18.0 Z',
      // Pommel — round gem cap below the grip.
      'M 11.0 18.7 Q 11.0 17.8 12.0 17.8 Q 13.0 17.8 13.0 18.7 Q 13.0 19.6 12.0 19.6 Q 11.0 19.6 11.0 18.7 Z',
    ],

    // Lower-robes-or-greaves anchor: region below the torso. Two clearly
    // separated greave columns (left + right) with a small gap rather than
    // a single line cutting the robe. Each greave tapers to a planted boot.
    lowerRobesOrGreaves: [
      // Two greave columns with a gap at the center where the pommel
      // (y≈17.4–19.4) falls in front of them. Each greave tapers to a
      // boot at y=22.
      // Left greave (y 16.4 → 22). Inner edge at x=10.4.
      'M 9.0 16.4 L 10.8 16.4 L 10.6 18.0 L 10.6 21.4 L 9.6 22.0 L 8.6 21.4 L 8.8 19.0 Z',
      // Right greave (mirror).
      'M 13.2 16.4 L 15.0 16.4 L 15.2 19.0 L 15.4 21.4 L 14.4 22.0 L 13.4 21.4 L 13.4 18.0 Z',
      // Knee-cop accents — small horizontal bands marking the knee plates.
      'M 8.7 19.4 L 10.7 19.4',
      'M 13.3 19.4 L 15.3 19.4',
    ],

    // Single highlight wedge (top-left on the cuirass). Comma-shaped sliver
    // riding the upper-left edge of the breastplate where light from
    // 10 o'clock would catch the polished armor.
    highlightWedge: 'M 9.6 10.2 Q 10.4 10.0 10.8 10.6 L 10.4 13.2 Q 10.0 12.8 9.7 12.0 Z',
  };
}
