import type { Card } from '../../types/card';
import { baseIdOf } from '../../data/cards';
import { WISP_BASE_IDS } from './baseIds';

/**
 * Short, human-readable effect summary for each hero (and select starters /
 * items) shown on the card face. Triggered / deferred effects are annotated
 * explicitly (v0.2 label) so players understand those hero plays don't yet
 * produce a visible engine effect.
 *
 * Returns empty string when no effect summary is available — the UI then
 * omits the badge entirely so the tile stays uncluttered.
 *
 * Shared by Hand.tsx and Field.tsx (embertide-9c7).
 *
 * Passive-bearing cards (legacy 4uyn `Card.effects.kind === 'item-passive'`
 * + dual-slot `Card.passive` per ppf9.4 schema lock-in) compose their
 * passive description through `effectTextFor`'s outer wrapper, which
 * appends `Passive: <description>` lines via `getPassives`. This inner
 * helper computes the non-passive base text only.
 */
export function effectTextBaseFor(card: Card): string {
  // Starters are keyed by role, not id, because they have multiple copies
  // that share a single template object (STARTER_GREEN / STARTER_RED).
  if (card.role === 'starter-green') return '+1g';
  if (card.role === 'starter-red') return '+1 power';

  // Monster / boss cards — describe the HP-heal drop paid on defeat so the
  // beast card face isn't blank (embertide-d80). The effect is keyed on
  // role because every copy of the same monster shares the same drop rule.
  // The `hearts` field survives as the v1 schema name for HP-heal amount
  // (EffectSpec Phase 1 / u-1b — a v2.1 rename may reconcile naming).
  if (card.role === 'monster' || card.role === 'mini-boss' || card.role === 'final-boss') {
    if (card.effects.kind !== 'monster-drop') return '';
    const drop = card.effects;
    // r94e drop-variety extension: the optional `gems` / `cardDraw` /
    // `keys` fields layer alongside the heart token so a generic
    // regular's "1 heart OR 1 gem" alt drop and a wild boss's bonus
    // card-draw both render on the card face. An empty drop (hearts=0
    // with no extras) collapses to '' so the badge stays uncluttered.
    const parts: string[] = [];
    if (drop.hearts > 0) parts.push(`+${drop.hearts} \u2665`);
    if (drop.gems !== undefined && drop.gems > 0) parts.push(`+${drop.gems}g`);
    if (drop.keys !== undefined && drop.keys > 0) parts.push(`+${drop.keys} key`);
    if (drop.cardDraw !== undefined && drop.cardDraw > 0) {
      parts.push(`Draw ${drop.cardDraw}`);
    }
    return parts.join(', ');
  }

  // Heal cards (REQ-13 Phase 2c, gm0.3). Keyed on `effects.kind` so any
  // future card carrying a `heal` EffectSpec gets a uniform card-face
  // summary without a per-baseId branch. The wisp full-revive case
  // (amount === target.hpMax at dispatch) is special-cased via the
  // baseId branch below — `effectTextFor` runs before reading hpMax,
  // so the early return for non-wisp heals keeps the generic surface
  // narrow. Target-specific phrasing:
  //   - 'self'   → "Heal +N ♥"
  //   - 'team'   → "Heal teammate +N ♥"
  //   - 'active' → "Heal active +N ♥"
  // Wisp retains its bespoke "Revive teammate to full HP" string
  // because the heal amount is computed at dispatch (target.hpMax)
  // rather than authored. The bespoke string fires from the baseId
  // branch further down and short-circuits this generic path.
  // The three wisp variants (wisp / great-wisp / wisp-in-bottle) all
  // carry `{ kind: 'heal', target: 'team', amount: 0 }` post-ppf9.2 — the
  // amount is a sentinel (dispatcher substitutes hpMax at use time), so
  // the generic "Heal teammate +0 ♥" string would be misleading. They each
  // have a bespoke baseId branch below ("Revive teammate to full HP" and
  // a reusable-bottle variant).
  if (card.effects.kind === 'heal' && !WISP_BASE_IDS.has(baseIdOf(card))) {
    const amount = card.effects.amount;
    const target = card.effects.target;
    const targetWord = target === 'self' ? '' : target === 'team' ? ' teammate' : ' active';
    return `Heal${targetWord} +${amount} ♥`;
  }

  // Item-passive description rendering moved to the outer `effectTextFor`
  // wrapper (ppf9.4.4): a single passive-suffix branch using `getPassives()`
  // covers BOTH legacy 4uyn `Card.effects.kind === 'item-passive'` cards and
  // new dual-slot items (Card.effects = non-passive, Card.passive set). The
  // base helper here only owns non-passive shapes.

  // Roll-die cards (REQ-13 Phase 2a / gm0.7, gm0.10). The `outcomes`
  // map is a total record keyed by `DieFace` (1..6) — the
  // fail-forward-floor invariant guarantees every face has a non-zero
  // inner effect. v2.1's pick UI (gm0.10 forest-sage / gm0.11 tutorial)
  // renders three fanned d6 cards sourced from `pickOneOfThreeD6` and
  // dispatches the picked face's inner effect. The card-face text
  // hints at the dice mechanic.
  //
  // Forest-sage (gm0.10) and the test-only roll-die anchor have
  // bespoke per-baseId card-face strings — defer to the baseId switch
  // below so the omen table can be enumerated on the card face. The
  // generic 'Roll d6: 1 of 6 outcomes' fallback below the baseId
  // switch covers any future roll-die card whose author hasn't wired
  // a custom string yet.
  if (card.effects.kind === 'roll-die' && baseIdOf(card) !== 'forest-sage') {
    return 'Roll d6: 1 of 6 outcomes';
  }

  // Banish cards (embertide-91p, commit b). Generic per-kind text
  // — `banish-from-hand` surfaces the CardSelectionModal at on-play
  // resolution; `banish-from-discard` is the symmetric framework
  // discriminant for discard-side banishing (no v2.x card declares
  // it yet but the renderer is wired here so future cards stay
  // tokenizer-friendly without a follow-up edit).
  if (card.effects.kind === 'banish-from-hand') {
    const amount = card.effects.amount;
    return `Banish ${amount} from hand`;
  }
  if (card.effects.kind === 'banish-from-discard') {
    const amount = card.effects.amount;
    return `Banish ${amount} from discard`;
  }

  // Equip-bonus cards (embertide-4t2d / wun Track A). Renders the
  // declared resource grant + trigger so the rules-text reflects the
  // actual main-phase fire that lands when the item is equipped.
  // Tokenizer downstream substitutes "+N <unit>" with the inline icon
  // (gem→green-shard, power→sword, card-draw→draw-text). 'shield' has
  // no resource glyph — render the literal "+N shield <trigger>" so
  // the text stays informative until the runtime damage-reduction
  // dispatcher lands in a follow-up bead.
  if (card.effects.kind === 'equip-bonus') {
    const { resource, amount } = card.effects;
    if (resource === 'gem') return `+${amount}g on equip`;
    if (resource === 'power') return `+${amount} power on equip`;
    if (resource === 'card-draw') return `Draw ${amount} on equip`;
    return `+${amount} shield on equip`;
  }

  // Shard-grant cards (REQ-13 Phase 2d / gm0.4). Renders the granted
  // shards as a comma-separated list of `"<Capitalized> shard"` tokens
  // so the downstream tokenizer can substitute the per-shard icon. The
  // grant fires through a parallel declarative path (the existing
  // COMBAT_RESOLVE_WIN `shardGrants` payload still drives region-boss
  // defeats); reducer hooks that act on the EffectSpec discriminant
  // ship in follow-up units. Empty `shards` array renders as ''
  // (defensive — schema discourages but a careful author might want
  // an explicit empty grant during balance experiments).
  if (card.effects.kind === 'shard-grant') {
    if (card.effects.shards.length === 0) return '';
    return card.effects.shards
      .map((shard) => `${shard.charAt(0).toUpperCase()}${shard.slice(1)} shard`)
      .join(', ');
  }

  const base = baseIdOf(card);
  switch (base) {
    // Heroes — immediate
    case 'sage-keeper':
      return '+2g, +1 key';
    case 'water-warrior':
      return '+2 power';
    case 'scholar-princess':
      return '+2g';
    case 'wandering-merchant':
      return '+1g, +1 power';
    // Heroes — live triggers (embertide-g6a). Each fires automatically
    // while the hero is in inPlay this turn: ranch-keeper grants +1 heart
    // on any mini/final boss defeat, mountain-king grants +1 power per
    // monster defeated this turn. forest-sage (gm0.10, 2026-04-24) is now
    // a d6 omen roll on play (REQ-6).
    case 'ranch-keeper':
      return '+1g, +1\u2665 on boss';
    case 'forest-sage':
      // aqkj (2026-04-25): card-face text shortened from the full 6-face
      // outcome table to a teaser. The full table inflated the card
      // height to ~2x other heroes. RollCommitModal (mounted from
      // playCard's pendingForestSageRoll branch) is the source-of-truth
      // UI for face → effect; FOREST_SAGE_OMEN_TABLE in gameStore.ts
      // owns the per-face dispatch.
      // 'Omen' capitalized to match the canonical keyword-glossary spelling
      // (docs/design/keyword-glossary.md §DICE / OMEN) so the section layer
      // bolds it on first occurrence (kw.card-text-format / lhlo.38).
      return 'Roll d6 Omen';
    case 'mountain-king':
      return '+1 power per kill';
    // Items (item-active): rules-text for the v2.0 + gm0.15 supply
    // items + ancient-blade legendary is rendered by the equip-bonus
    // branch above (embertide-s2ub completed wun Track A by
    // migrating every item to the live equip-bonus EffectSpec). The
    // start-of-turn baseId-keyed Relic trigger in
    // `applyItemTrigger` (src/store/slices/endgame.ts) still fires
    // every turn but is intentionally NOT surfaced on the card face —
    // the on-equip bonus is the felt main-phase event.
    // Always Available heroes.
    case 'mystic':
      return '+2g';
    case 'militia-grunt':
      return '+2 power';
    // Vendor service (embertide-1eby) — pays 4g, grants +1 key on
    // the spot. The cost gem already shows the 4g payment; the rules
    // box advertises the grant.
    case 'key-vendor':
      return '+1 key';
    // Wisp (u-1d, amendment A6): plays on a downed teammate and restores
    // them to hpMax. Consumed on use; no-op outside downed-teammate context.
    case 'wisp':
      return 'Revive teammate to full HP';
    // Great Wisp (v2.1 gm0.16): same revive contract as plain wisp (both
    // dispatch through `playWispOn`, both consume on revive); rendered
    // identically on the card face. The differentiator is in-combat: a
    // stronger heal (combat-heal amount:5 vs plain wisp's 3) — surfaced
    // by the combat-summary line below the rules-text. ppf9.2 (2026-04-29).
    case 'great-wisp':
      return 'Revive teammate to full HP';
    // Wisp in Bottle (v2.1 gm0.16): plain wisp revive plus a one-time
    // refill — the bottle re-equips into the owner's items zone after
    // revive so it can fuel ONE more revive in the same combat
    // (per-player `usedWispInBottleIds` blocks further refills).
    // ppf9.2 (2026-04-29).
    case 'wisp-in-bottle':
      return 'Revive teammate to full HP, refills 1×';
    // u-9b heirlooms (REQ-32): wild-boss drops. Main-board on-play is a
    // neutral no-op; the combat surface carries the real effect so the
    // card-face text reflects the combat mechanic.
    case 'craghorn-tusk':
      return 'Combat: 4 dmg + stun 1';
    case 'boulderkin-core':
      return 'Combat: shield 4';
    case 'sentinel-eye':
      return 'Combat: 6 dmg';
    // embertide-044 (2026-04-24): rare post-completion heirloom —
    // highest-single-hit attack in the game (damage 8). Drops from
    // the Prism Chimera encounter which spawns only after
    // Silver Chimera is defeated (one-shot linear-ramp roll; see
    // `computePrismChimeraSpawnChance` in src/rules/zones.ts).
    case 'rainbow-ancient-chimera-sword':
      return 'Combat: 8 dmg';
    // fix-aurelia (2026-04-22): Freed Princess's Light Arrow — 5 damage
    // to the boss on play. Granted to both players when the crystal is
    // struck; see src/store/slices/crystal.ts strikePrincessCrystal.
    case 'freed-princess':
      return 'Combat: Light Arrow 5 dmg';
    // Wild Wolf (embertide-1uh): +1 heart is awarded only on the
    // first kill per turn — subsequent kills still cost red but grant no
    // heart. Card text reflects the cap so the player understands the
    // farm is limited without having to read the rulebook.
    case 'wild-wolf':
      return '+1\u2665 first kill';
    default:
      return '';
  }
}
