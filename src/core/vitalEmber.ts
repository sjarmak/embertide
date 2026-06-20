/**
 * Vital-ember semantics (embertide 2026-04-22 playtest fix).
 *
 * Before this module: monster-drop / chest / boss-win heart rewards
 * called a `Math.min(hp + n, hpMax)` helper — at full HP the drops
 * were silently wasted. Playtest feedback: "enemies say they give
 * hearts but my HP never goes up". Players didn't realise rewards
 * were capped at a baseline 5-HP pool.
 *
 * After this module: every heart reward heals first and, once the
 * player is already at `hpMax`, grows both `hp` and `hpMax` by 1 per
 * remaining heart until `HP_CAP` is reached. This is the Aurelia
 * "vital ember" metaphor — kills visibly matter, the HP pool
 * grows over a run, and the balance-sim's "late-campaign ~12 HP"
 * assumption lines up with actual runtime behaviour.
 *
 * Scope: applied to all reward-heal paths (fightMonster /
 * defeatAlwaysAvailableMonster / COMBAT_RESOLVE_WIN / chest-reward).
 * NOT applied to wisp revive (which restores to `hpMax` without
 * growing the pool) or any future damage-time interaction.
 */
import type { KidPlayer } from '../store/types';

/**
 * Hard ceiling on `hpMax` growth. Set to `Infinity` on 2026-04-23 —
 * the previous hard cap (10, then 20) made runtime HP hard to tune and
 * debug during playtesting: rewards would silently stop mattering once
 * the cap was reached, obscuring whether drops were firing at all. The
 * Vurmox endgame tuning assumed a cap that's no longer enforced; once we
 * settle the ember-shard / vital-ember item cards the cap may come
 * back, but it'll be driven by item count rather than a constant.
 * Shared across monster drops, chest rewards, and combat-win drops.
 */
export const HP_CAP = Number.POSITIVE_INFINITY;

/**
 * Apply `amount` heart rewards to `player`. Each heart first heals
 * 1 HP up to `hpMax`; past `hpMax`, each additional heart grows
 * `hp` AND `hpMax` by 1 until `HP_CAP` is reached. Zero / negative
 * `amount` is a no-op. Pure: returns a new KidPlayer; input is
 * untouched.
 *
 * Downed players are healed the same way. If healing lifts them out
 * of 0 HP, `downed` flips to false — mirrors the pre-existing
 * `applyHeartsHeal` branch.
 */
export function applyHeartReward(player: KidPlayer, amount: number): KidPlayer {
  if (amount <= 0) return player;
  let hp = player.hp;
  let hpMax = player.hpMax;
  let remaining = amount;
  while (remaining > 0) {
    if (hp < hpMax) {
      hp += 1;
    } else if (hpMax < HP_CAP) {
      hp += 1;
      hpMax += 1;
    } else {
      break;
    }
    remaining -= 1;
  }
  if (hp === player.hp && hpMax === player.hpMax) return player;
  const shouldWake = player.downed && hp > 0;
  return shouldWake ? { ...player, hp, hpMax, downed: false } : { ...player, hp, hpMax };
}
