import type { CardRole } from '../types/card';

/**
 * Generic, IP-safe display strings for each card role.
 *
 * This is the fallback skin used when no runtime theme.json is present.
 * All names here are generic fantasy terms and must not reference any
 * franchise-specific characters, settings, or items.
 */
export const GENERIC_THEME: Record<CardRole, string> = {
  hero: 'Champion',
  item: 'Relic',
  'legendary-sword': 'Ancient Blade',
  'revealer-item': 'Seeing Stone',
  monster: 'Beast',
  'mini-boss': 'Warlord',
  'final-boss': 'Dark Lord',
  'chest-std': 'Sturdy Chest',
  'chest-mid': 'Ornate Chest',
  'chest-boss': 'Grand Vault',
  'starter-green': 'Shard',
  'starter-red': 'Power',
};

/**
 * Generic, IP-safe display strings for each Champion id
 * (embertide-57p). Franchise flavor (Link, Aurelia, etc.) lives
 * exclusively in public/theme.example.json — never here.
 */
export const GENERIC_CHAMPION_THEME: Record<string, string> = {
  'champion-courage': 'Valor Warden',
  'champion-wisdom': 'Lore Warden',
  'champion-power': 'Might Warden',
  'champion-sword': 'Blade Warden',
};

/**
 * Per-baseId display name overrides. Used by CardTemplate to prefer a
 * bespoke card name over the generic role fallback — historically this
 * gave the four champion-starter cards (which all shared the now-retired
 * `starter-home` role) distinct names instead of a shared 'Homestead
 * Starter' fallback. j49z (2026-04-24) retired the role and its
 * KID_CARDS entries; the four entries below remain because the Setup
 * champion picker still surfaces the bespoke names against the
 * portraitCardId of each KidChampion.
 */
export const GENERIC_BASE_ID_THEME: Record<string, string> = {
  'spirit-arrow': 'Spirit Arrow',
  'seer-rune': 'Seer Rune',
  warblade: 'Warblade',
  'ancient-keepsake': 'Ancient Keepsake',
  // Boss display names (amendment A5 thematic ids). These replace the
  // generic 'Warlord' fallback so bosses read as named encounters rather
  // than anonymous mini-bosses. Same IP-safety stance as the underlying
  // card ids (see src/data/cards.test.ts FORBIDDEN_SUBSTRINGS).
  craghorn: 'Craghorn',
  broodmaw: 'Broodmaw',
  'boulderkin': 'Boulderkin',
  'ashen-tyrant': 'Ashen Tyrant',
  sentinel: 'Sentinel',
  'silver-chimera': 'Silver Chimera',
  // gdd.1.1 (2026-04-25) — Maren region boss. Card id stays 'tidewraith' for
  // code stability (combat resolver still keyed `tidewraith-tentacle-grab`),
  // but the visual + display name was retoned to canonical TP Lakebed
  // boss TIDEWRAITH (eel-serpent + tentacles + single golden eye).
  tidewraith: 'Tidewraith',
  // embertide-044 (2026-04-24): rare post-completion wild boss
  // (Prism Chimera — SEPARATE variant from regular Silver
  // Chimera, not a rainbow-coated silver chimera) + its heirloom drop.
  // Dynamic-spawn encounter rolled at Silver Chimera's defeat.
  'prism-chimera': 'Prism Chimera',
  'rainbow-ancient-chimera-sword': 'Rainbow Ancient Chimera Sword',
  'cagewright-vurmox': 'Cagewright Vurmox',
  // p24m (2026-05-02) — Colosseum Tier-5 capstone. Three heads × three
  // eras (Demon-King gloom + Umbra ancient-tech + Auren sacred
  // machinery). Card data: src/data/cards/colosseum.ts; combat spec:
  // src/data/colosseum/tier5.ts.
  'trinity-aurogax': 'Trinity Aurogax',
  // embertide-4hr1.4 (2026-05-02) — Colosseum tier-1/tier-2 boss
  // display names. Tier-1 net-new entries (coilworm, bonereaver) and
  // tier-2 entries (chimera, blackguard, cinderwyrm, phantom-vurmox, palegrasp)
  // surface in the HUD's tier-progression preview and in the in-combat
  // boss readout once 4hr1.5 wires WIN-side handling. craghorn + boulderkin
  // already exist as zone wild-boss entries above and are reused.
  coilworm: 'Coilworm',
  bonereaver: 'Bonereaver',
  chimera: 'Chimera',
  blackguard: 'Blackguard',
  cinderwyrm: 'Cinderwyrm',
  'phantom-vurmox': 'Phantom Vurmox',
  'palegrasp': 'Palegrasp',
  // embertide-wacl (2026-05-08) — Colosseum tier-3 + tier-4 roster
  // display names. Surfaces in the HUD's tier-progression preview now;
  // the underlying card-data entries (parallel to `trinity-aurogax` in
  // src/data/cards/colosseum.ts) ship alongside the per-boss art batch
  // beads, so by-id lookups will resolve once those land.
  'skrall-king': 'Skrall King',
  voltwyrm: 'Voltwyrm',
  'vinemaw': 'Vinemaw',
  sandscourge: 'Sandscourge',
  idolarch: 'Idolarch',
  ossiarch: 'Ossiarch',
  'the-fettered': 'The Fettered',
  pyrax: 'Pyrax',
  oblivar: 'Oblivar',
  // Hero display names (embertide 2026-04-22 theme pass). Surface
  // franchise-appropriate character names on the card face so every
  // hero reads as a named Aurelia ally instead of a generic role label
  // ("Ranch Keeper" felt out of place next to named monsters like
  // Craghorn and Scrabling). Card ids themselves remain generic per the
  // IP-safety contract in src/data/cards.test.ts.
  'sage-keeper': 'Veylin',
  'water-warrior': 'Naerin',
  'scholar-princess': 'Sael',
  'wandering-merchant': 'Coll',
  'key-vendor': 'Pell',
  'ranch-keeper': 'Wren',
  'forest-sage': 'Liel',
  'mountain-king': 'Brammel',
  // 2026-04-25 — original designer characters added as zone-locked
  // center-row supply heroes (Dune Sanctum + Gilded Cage).
  'dune-revenant': 'Dune Revenant',
  'velrath-duke-of-veils': 'Velrath, Duke of Veils',
  // Generic / pre-zone monsters (embertide 2026-04-22 theme pass).
  // Before: grunt-orc, spear-orc, sea-cephalopod, wild-wolf, and the
  // two generic mini-bosses rendered with the role-level fallbacks
  // ("Beast" / "Warlord") and used the generic stalker art. Now each
  // gets a Aurelia-canon name that matches the raster it ships with.
  'grunt-orc': 'Brute',
  'spear-orc': 'Brute Spearman',
  squidlet: 'Squidlet',
  // Always-available row display names (2026-04-23 theme pass). Underlying
  // ids (mystic / militia-grunt / wild-wolf) are retained for save-game +
  // test stability; only the surface label changes.
  mystic: 'Oracle',
  'militia-grunt': 'Elysian Soldier',
  'wild-wolf': 'Scrabling',
  'mini-boss-reptile': 'Scalelord',
  // a39d (2026-04-25): renamed from 'Tidewraith' to clear the collision with
  // the v2.1 maren region boss (id 'tidewraith' now displays as 'Tidewraith').
  // 'Mothula' is a kid-friendly Aurelia mini-boss canon (LttP/OoT/MM) and
  // stays IP-safe: bespoke display only, baseId still 'mini-boss-slime'.
  'mini-boss-slime': 'Mothula',
  // Item display names (so combat-hand and main-board items read
  // clearly). embertide-uoz (2026-04-24): audit of the full items
  // roster — without a bespoke baseId entry, cardDisplayName falls
  // through to GENERIC_THEME[card.role]='Relic' and every item reads
  // as the literal string "Relic" on its card face.
  'short-sword': 'Sylvani Sword',
  'short-bow': 'Short Bow',
  'curved-throwing-blade': 'Curved Throwing Blade',
  'tower-shield': 'Tower Shield',
  // Wisp Bow: Link's canonical Songflute of Time bow, not a generic "Bow".
  // The raster is cathedral_item_bow_and_arrow — the display name lifts it
  // onto the LoZ-canon name.
  bow: 'Wisp Bow',
  boomerang: 'Boomerang',
  'elysian-shield': 'Elysian Shield',
  'cinder-bloom': 'Cinder Bloom',
  // embertide-akop: three item-check opener tools (supply items).
  grapplethorn: 'Grapplethorn',
  grapnels: 'Grapnels',
  'aegis-pane': 'Aegis Pane',
  'ancient-sword': 'Ancient Sword',
  'ancient-blade': 'Ancient Blade',
  wisp: 'Wisp',
  'great-wisp': 'Great Wisp',
  'wisp-in-bottle': 'Wisp in Bottle',
  // embertide-91p (b): banish-from-hand items. Catalog-only, not
  // in SUPPLY_PLAN; named here so card-face / modal renderers don't
  // fall through to the generic "Relic" role label.
  'blacksmith-forge': 'Blacksmith Forge',
  'ritual-relic': 'Ritual Relic',
  // embertide-4uyn — chest-pool item-passive variety expansion.
  // Six Ascension-style construct passives (start-of-turn) + four
  // StS-relic-style event-trigger passives (on-combat-enter,
  // on-monster-defeated). Drop-only items routed through the chest
  // 'item' reward via CHEST_ITEM_POOL_IDS.
  'forge-of-power': 'Forge of Power',
  'well-of-vitality': 'Well of Vitality',
  'merchants-charm': "Merchant's Charm",
  'scholars-tome': "Scholar's Tome",
  'sylvani-talisman': 'Sylvani Talisman',
  'iron-ward': 'Iron Ward',
  'bandits-cache': "Bandit's Cache",
  'bloodlust-pendant': 'Bloodlust Pendant',
  'valor-pendant': 'Valor Pendant',
  'surge-totem': 'Surge Totem',
  // REQ-32 (u-9b) heirloom items, surfaced by name in u-9e's
  // `heirloom-drop` tutorial bubble + main-board / combat-hand item
  // tiles.
  'craghorn-tusk': 'Craghorn Tusk',
  'boulderkin-core': 'Boulderkin Core',
  'sentinel-eye': 'Sentinel Eye',
  // v2.1 gm0.17 (embertide-0jf): `chimera-sword` is the sole Silver
  // Chimera wild-boss drop (retired `silver-chimera-mane`).
  'chimera-sword': 'Chimera Sword',
  // fix-aurelia (2026-04-22): Freed Princess (display: Princess Aurelia) —
  // granted on crystal break. Generic card id per IP-safety; this
  // mapping lives in the runtime theme layer so the surface reads as
  // "Princess Aurelia" in-game.
  'freed-princess': 'Princess Aurelia',
  // Regular zone enemies — same rationale (combat encounters on the
  // center row should read as named beasts, not just 'Beast').
  'thorn-scrub': 'Thorn Scrub',
  'snapvine': 'Snapvine',
  jellet: 'Jellet',
  scrabling: 'Scrabling',
  saurian: 'Saurian',
  ashjaw: 'Ashjaw',
  skittermite: 'Skittermite',
  'red-squidlet': 'Red Squidlet',
  wardeye: 'Wardeye',
  emberskull: 'Emberskull',
  'bone-knight': 'Bone Knight',
  'gulpmaw': 'Gulpmaw',
  hexrobe: 'Hexrobe',
  // ctgg (2026-04-25): v2.1 zone-locked regulars + region/wild bosses
  // were displaying as 'Beast' / 'Warlord' (role fallback). Each gets
  // its Aurelia-canon display name; baseIds stay unchanged.
  //   Tidehold
  'maren-warrior': 'Maren Warrior',
  reefblade: 'Reefblade',
  'frost-jellet': 'Frost jellet',
  fangfish: 'Fangfish',
  'maelstrom': 'Maelstrom',
  //   Hollow Shrine
  willowisp: 'Willowisp',
  graspling: 'Graspling',
  bonelet: 'Bonelet',
  'duskwing': 'Duskwing',
  'hollow-effigy': 'Hollow Effigy',
  'knell': 'Knell',
  //   Dune Sanctum
  duneweed: 'Duneweed',
  sandwyrm: 'Sandwyrm',
  // 'Desert Bonereaver' avoids the collision with the existing
  // 'bone-knight': 'Bone Knight' entry.
  'sunbleached-reaver': 'Desert Bonereaver',
  scuttlespine: 'Scuttlespine',
  'iron-sentinel': 'Iron Sentinel',
  hextwins: 'Hextwins',
};
