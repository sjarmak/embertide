import type { Card } from '../../types/card';
import { KID_CARDS, FREED_PRINCESS_ID } from '../../data/cards';
import type { KidGameState, KidPlayer, PrincessCrystalState } from '../types';

/**
 * Princess-in-Crystal initial charge count (REQ-8 + embertide-vj52).
 * vj52: bumped 5 → 8 alongside the tier-differentiated decrement (regular
 * → 1, wild-boss → 2, region-boss → 3) so the Wisdom-piece path lands in
 * the 50-75% session-progress band (post-first-wild-boss, pre-final-region-
 * boss). Initial=8 + tiered decrement is PROVISIONAL pending designer
 * sign-off on the numbers; the schema landed here permits cheap re-tuning.
 */
export const PRINCESS_CRYSTAL_INITIAL_CHARGES = 8;

/**
 * Per-tier crystal damage on a monster defeat (embertide-vj52).
 *   - region-boss → 3   (zone-clear gatekeeper; biggest contribution)
 *   - wild-boss   → 2   (in-zone mini-boss; meaningful step)
 *   - default     → 1   (regulars + always-available; per-kill drip)
 *
 * Mirrors the monster-drop hearts pattern (small drip per regular,
 * stronger pulses on bosses) so the Crystal pacing tracks the existing
 * heart-economy curves. Provisional numbers — designer sign-off pending
 * per the vj52 acceptance gate.
 */
export function crystalDamageFor(monster: Card): number {
  if (monster.bossTier === 'region-boss') return 3;
  if (monster.bossTier === 'wild-boss') return 2;
  return 1;
}

/**
 * Initial Princess Crystal state for a fresh game. Seeded into both
 * `EMPTY_STATE` and `initGame` so the crystal is always present from
 * turn 1 regardless of the active map-zone (amendment A5 — orthogonal).
 */
export function initialPrincessCrystalState(): PrincessCrystalState {
  return { charges: PRINCESS_CRYSTAL_INITIAL_CHARGES, freed: false };
}

/**
 * Decrement `state.princessCrystal.charges` by `crystalDamageFor(monster)`
 * (floored at 0) on a monster defeat. No-op once the Princess is freed —
 * the charge counter stops ticking the moment the Wisdom shard has been
 * claimed (no point in tracking "negative" kills past the unlock). Pure —
 * returns a new state.
 *
 * Call-site contract: invoked as the LAST step in both kill paths
 * (`fightMonster` and `defeatAlwaysAvailableMonster`) plus the boss-combat
 * resolution (`COMBAT_RESOLVE_WIN` in gameStore.ts) so the decrement rides
 * alongside every successful defeat in a single state update.
 */
export function decrementCrystalCharges(state: KidGameState, monster: Card): KidGameState {
  const { princessCrystal } = state;
  if (princessCrystal.freed) return state;
  if (princessCrystal.charges <= 0) return state;
  const damage = crystalDamageFor(monster);
  return {
    ...state,
    princessCrystal: {
      ...princessCrystal,
      charges: Math.max(0, princessCrystal.charges - damage),
    },
  };
}

/**
 * Monotonic counter for minting unique Freed Princess card ids on
 * crystal break. Mirrors the `heirloomMintCounter` pattern in
 * `src/store/slices/combat.ts` — keeps each minted copy's id unique so
 * both players' grants don't collide in `buildCombatDeck`. Not part of
 * game state; session-scoped only.
 */
let freedPrincessMintCounter = 0;

/**
 * Mint a fresh Freed Princess Card copy from the KID_CARDS template.
 * `baseId` is load-bearing: `combatEffectFor` in combatEffects.ts keys
 * the effect lookup on `baseIdOf(card.id)`, and `buildCombatDeck`'s
 * item-active eligibility reads role + itemKind which are copied from
 * the template by spread.
 */
function mintFreshFreedPrincess(): Card {
  const template = KID_CARDS.find((c) => c.id === FREED_PRINCESS_ID);
  if (!template) {
    throw new Error(
      `No Freed Princess template "${FREED_PRINCESS_ID}" in KID_CARDS — cannot mint crystal-break grant`,
    );
  }
  freedPrincessMintCounter += 1;
  const minted: Card & { readonly baseId: string } = {
    ...template,
    id: `${FREED_PRINCESS_ID}-${freedPrincessMintCounter}`,
    baseId: FREED_PRINCESS_ID,
  };
  return minted;
}

/**
 * Strike action on the Crystal (REQ-8, amendment A2 + fix-aurelia 2026-04-22
 * + embertide-ajx1 hero re-role 2026-04-26).
 * When charges have been fully whittled to 0 and the Princess has not
 * yet been freed, the Strike:
 *   (a) flips `princessCrystal.freed` to true
 *   (b) flips `sharedEmbertide.wisdom` to true (shared pool — NOT
 *       granted to the striking player specifically)
 *   (c) flips `wisdomsLight` to true on BOTH players (shared passive)
 *   (d) grants a fresh Freed Princess hero card to BOTH players'
 *       `discard` piles (Ascension-canonical "card joins your deck,
 *       cycles in next shuffle"). Pre-ajx1 the princess was an item
 *       and landed in `items`; the user-ratified ajx1 re-role makes
 *       her a hero card so she enters the deck rotation. Her in-combat
 *       Light Arrow (combat-attack dmg=5) still fires through the
 *       baseId='freed-princess' branch in combatEffects.ts, so the
 *       celebratory "she joins the party" feel persists across the
 *       role flip.
 *
 * When charges > 0 OR the Princess is already freed, returns state
 * unchanged. UI-level guards disable the Strike action in those cases;
 * this is the defensive backstop so the pure helper is safe to call from
 * anywhere without throwing.
 */
export function strikePrincessCrystal(state: KidGameState): KidGameState {
  const { princessCrystal } = state;
  if (princessCrystal.freed) return state;
  if (princessCrystal.charges > 0) return state;

  const players: KidPlayer[] = state.players.map((p) => {
    // Mint a distinct Freed Princess copy per player so ids don't
    // collide across the two discard arrays. Story-driven grant — both
    // players see the princess enter their deck on the strike, ready
    // for the next reshuffle to put her in their drawing rotation.
    const princessCard = mintFreshFreedPrincess();
    return {
      ...p,
      wisdomsLight: true,
      discard: [...p.discard, princessCard],
    };
  });

  return {
    ...state,
    players,
    princessCrystal: { charges: 0, freed: true },
    sharedEmbertide: { ...state.sharedEmbertide, wisdom: true },
  };
}
