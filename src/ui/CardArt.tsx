import type { ReactElement } from 'react';

import { renderIllustration } from '../illustration';
import type { Card, CardRole } from '../types/card';
import type { IllustrationSpec } from '../illustration';
import { baseIdOf } from '../data/cards';
import { Hero, Sword, Shield, Monster, Boss, Chest, GreenShard } from '../icons';

import cathedralHeroWarriorJson from '../illustration/examples/cathedral_hero_warrior.json' with { type: 'json' };
import cathedralMonsterStalkerJson from '../illustration/examples/cathedral_monster_stalker.json' with { type: 'json' };
import cathedralBossBruteJson from '../illustration/examples/cathedral_boss_brute.json' with { type: 'json' };
import cathedralBossTyrantJson from '../illustration/examples/cathedral_boss_tyrant.json' with { type: 'json' };
import cathedralItemLegendarySwordJson from '../illustration/examples/cathedral_item_legendary_sword.json' with { type: 'json' };
import cathedralItemRelicJson from '../illustration/examples/cathedral_item_relic.json' with { type: 'json' };
import cathedralItemSeeingStoneJson from '../illustration/examples/cathedral_item_seeing_stone.json' with { type: 'json' };
// v2 chest taxonomy (u-2b → tq5): the final 3-tier system uses three
// rasters — sturdy (std), the existing "enchanted" raster repurposed as
// the Ornate Chest middle tier (mid), and vault (boss). The retired
// medium/big/enchanted/ancient sibling rasters stay in the tree for
// rollback / future raster regen; the `_` prefix signals "intentionally
// unused" to the linter's allow-pattern (`/^_/u`).
//
// tq5-art follow-up: bespoke "Ornate Chest" raster (decorated wooden +
// iron banding + gem inlay) replaces the repurposed enchanted JSON; this
// file's `chest-mid` mapping switches to the new raster at that time.
import _cathedralChestMediumJson from '../illustration/examples/cathedral_chest_medium.json' with { type: 'json' };
import _cathedralChestBigJson from '../illustration/examples/cathedral_chest_big.json' with { type: 'json' };
import _cathedralChestAncientJson from '../illustration/examples/cathedral_chest_ancient.json' with { type: 'json' };
import cathedralChestSturdyJson from '../illustration/examples/cathedral_chest_sturdy.json' with { type: 'json' };
import cathedralChestVaultJson from '../illustration/examples/cathedral_chest_vault.json' with { type: 'json' };
// kkm0 (2026-04-25): bespoke "Ornate Chest" raster ships in the chest-tier
// regen batch — gold-and-mahogany with single emerald gem inlay,
// visually midway between sturdy and vault. Replaces the
// cathedral_chest_enchanted.json placeholder.
import cathedralChestMidJson from '../illustration/examples/cathedral_chest_mid.json' with { type: 'json' };
import cathedralAlwaysAvailMysticJson from '../illustration/examples/cathedral_alwaysavail_mystic.json' with { type: 'json' };
import cathedralAlwaysAvailMilitiaGruntJson from '../illustration/examples/cathedral_alwaysavail_militia_grunt.json' with { type: 'json' };
import cathedralStarterGreenJson from '../illustration/examples/cathedral_starter_green.json' with { type: 'json' };
import cathedralStarterRedJson from '../illustration/examples/cathedral_starter_red.json' with { type: 'json' };
// j49z (2026-04-24): cathedral_starter_home.json is no longer wired into the
// role-level SPEC_BY_ROLE map (the `starter-home` role was retired); the
// raster file is retained on disk for rollback / history. Champion-specific
// portraits below (champion_courage / wisdom / power / sword) cover the
// Setup picker surface via SPEC_BY_BASE_ID + SPEC_BY_CHAMPION_ID.
import cathedralStarterChampionCourageJson from '../illustration/examples/cathedral_starter_champion_courage.json' with { type: 'json' };
import cathedralStarterChampionWisdomJson from '../illustration/examples/cathedral_starter_champion_wisdom.json' with { type: 'json' };
import cathedralStarterChampionPowerJson from '../illustration/examples/cathedral_starter_champion_power.json' with { type: 'json' };
import cathedralStarterChampionSwordJson from '../illustration/examples/cathedral_starter_champion_sword.json' with { type: 'json' };
// u-6c Gilded Cage bosses — bespoke rasters per bead embertide-{aph,6gv,a9t}.
import cathedralMonsterCagewrightVurmoxJson from '../illustration/examples/cathedral_monster_cagewright_vurmox.json' with { type: 'json' };
import cathedralMonsterSentinelJson from '../illustration/examples/cathedral_monster_sentinel.json' with { type: 'json' };
import cathedralMonsterChimeraJson from '../illustration/examples/cathedral_monster_chimera.json' with { type: 'json' };
import cathedralMonsterSilverChimeraJson from '../illustration/examples/cathedral_monster_silver_chimera.json' with { type: 'json' };
// embertide-044 (2026-04-24) — rare post-completion wild boss
// (Prism Chimera). Monster raster filename intentionally retained
// from the prior fix-rainbow-chimera ship — it already depicts the
// golden-chrome prismatic variant.
// embertide-ydc (2026-04-24) — bespoke sword raster for the heirloom
// drop replaces the miscast rainbow-prism placeholder.
import cathedralMonsterPrismChimeraJson from '../illustration/examples/cathedral_monster_prism_chimera.json' with { type: 'json' };
import cathedralItemRainbowAncientChimeraSwordJson from '../illustration/examples/cathedral_item_rainbow_ancient_chimera_sword.json' with { type: 'json' };
// u-6a Sylvanwood — 4 regulars + wild-boss craghorn + region-boss broodmaw.
// Bead ids: embertide-{d3v, elf, vjc, 3er, bbe, iy8}.
import cathedralMonsterThornScrubJson from '../illustration/examples/cathedral_monster_thorn_scrub.json' with { type: 'json' };
import cathedralMonsterSnapvineJson from '../illustration/examples/cathedral_monster_snapvine.json' with { type: 'json' };
import cathedralMonsterJelletJson from '../illustration/examples/cathedral_monster_jellet.json' with { type: 'json' };
import cathedralMonsterScrablingJson from '../illustration/examples/cathedral_monster_scrabling.json' with { type: 'json' };
import cathedralMonsterCraghornJson from '../illustration/examples/cathedral_monster_craghorn.json' with { type: 'json' };
import cathedralMonsterBroodmawJson from '../illustration/examples/cathedral_monster_broodmaw.json' with { type: 'json' };
// u-6b Emberpeak — 4 regulars + wild-boss boulderkin + region-boss ashen-tyrant.
// Bead ids: embertide-{284, izt, wg5, zkl, gv6, q7s}.
import cathedralMonsterSaurianJson from '../illustration/examples/cathedral_monster_saurian.json' with { type: 'json' };
import cathedralMonsterAshjawJson from '../illustration/examples/cathedral_monster_ashjaw.json' with { type: 'json' };
import cathedralMonsterSkittermiteJson from '../illustration/examples/cathedral_monster_skittermite.json' with { type: 'json' };
import cathedralMonsterRedSquidletJson from '../illustration/examples/cathedral_monster_red_squidlet.json' with { type: 'json' };
import cathedralMonsterBoulderkinJson from '../illustration/examples/cathedral_monster_boulderkin.json' with { type: 'json' };
import cathedralMonsterAshenTyrantJson from '../illustration/examples/cathedral_monster_ashen_tyrant.json' with { type: 'json' };
// u-6c Gilded Cage regulars — 5 cards.
// Bead ids: embertide-{1ui, h3o, 4sm, 39o, 25d}.
import cathedralMonsterWardeyeJson from '../illustration/examples/cathedral_monster_wardeye.json' with { type: 'json' };
import cathedralMonsterEmberskullJson from '../illustration/examples/cathedral_monster_emberskull.json' with { type: 'json' };
import cathedralMonsterGulpmawJson from '../illustration/examples/cathedral_monster_gulpmaw.json' with { type: 'json' };
import cathedralMonsterHexrobeJson from '../illustration/examples/cathedral_monster_hexrobe.json' with { type: 'json' };
import cathedralMonsterBoneKnightJson from '../illustration/examples/cathedral_monster_bone_knight.json' with { type: 'json' };
// fix-aurelia (2026-04-22): Princess Aurelia card (granted on crystal break).
import cathedralAureliaLightArrowJson from '../illustration/examples/cathedral_aurelia_light_arrow.json' with { type: 'json' };
// pr2 (2026-04-23): 7 bespoke Aurelia-canon hero portraits lifting the
// warrior placeholder off the named Aurelia-character hero cards.
import cathedralHeroLielJson from '../illustration/examples/cathedral_hero_liel.json' with { type: 'json' };
import cathedralHeroBrammelJson from '../illustration/examples/cathedral_hero_brammel.json' with { type: 'json' };
import cathedralHeroWrenJson from '../illustration/examples/cathedral_hero_wren.json' with { type: 'json' };
import cathedralHeroVeylinJson from '../illustration/examples/cathedral_hero_veylin.json' with { type: 'json' };
import cathedralHeroSaelJson from '../illustration/examples/cathedral_hero_sael.json' with { type: 'json' };
import cathedralHeroCollJson from '../illustration/examples/cathedral_hero_coll.json' with { type: 'json' };
import cathedralHeroNaerinJson from '../illustration/examples/cathedral_hero_naerin.json' with { type: 'json' };
// nvd (2026-04-24): Pell portrait for the `key-vendor` tile. Originally
// landed when key-vendor was a buyable always-available hero;
// embertide-1eby (same day) reframed it as a vendor service tile —
// the portrait still ships, the trade reducer (tradeWithKeyVendor) is
// the routing target. ALBW rental-merchant silhouette (purple bunny-hood
// + rental-wares satchel) keeps Pell visually distinct from Coll's
// BOTW wandering-merchant.
import cathedralHeroPellJson from '../illustration/examples/cathedral_hero_pell.json' with { type: 'json' };
// pr2 (2026-04-23): 5 bespoke monster + mini-boss rasters lifting the
// stalker/brute placeholders off grunt-orc, spear-orc, sea-cephalopod,
// mini-boss-reptile, mini-boss-slime.
import cathedralMonsterGruntOrcJson from '../illustration/examples/cathedral_monster_grunt_orc.json' with { type: 'json' };
import cathedralMonsterSpearOrcJson from '../illustration/examples/cathedral_monster_spear_orc.json' with { type: 'json' };
import cathedralMonsterSquidletJson from '../illustration/examples/cathedral_monster_squidlet.json' with { type: 'json' };
import cathedralMonsterMiniBossReptileJson from '../illustration/examples/cathedral_monster_mini_boss_reptile.json' with { type: 'json' };
import cathedralMonsterMiniBossSlimeJson from '../illustration/examples/cathedral_monster_mini_boss_slime.json' with { type: 'json' };
// pr2 (2026-04-23): 8 bespoke item rasters for v2.0 starters + wisp + heirlooms,
// lifting the 'relic' role placeholder.
import cathedralItemShortSwordJson from '../illustration/examples/cathedral_item_short_sword.json' with { type: 'json' };
import cathedralItemShortBowJson from '../illustration/examples/cathedral_item_short_bow.json' with { type: 'json' };
import cathedralItemTowerShieldJson from '../illustration/examples/cathedral_item_tower_shield.json' with { type: 'json' };
import cathedralItemCurvedThrowingBladeJson from '../illustration/examples/cathedral_item_curved_throwing_blade.json' with { type: 'json' };
import cathedralItemWispJson from '../illustration/examples/cathedral_item_wisp.json' with { type: 'json' };
import cathedralItemCraghornTuskJson from '../illustration/examples/cathedral_item_craghorn_tusk.json' with { type: 'json' };
import cathedralItemBoulderkinCoreJson from '../illustration/examples/cathedral_item_boulderkin_core.json' with { type: 'json' };
import cathedralItemSentinelEyeJson from '../illustration/examples/cathedral_item_sentinel_eye.json' with { type: 'json' };
// pr2 (2026-04-23): 8 bespoke item rasters for gm0.15 supply + gm0.16 consumables.
import cathedralItemGreatWispJson from '../illustration/examples/cathedral_item_great_wisp.json' with { type: 'json' };
import cathedralItemWispInBottleJson from '../illustration/examples/cathedral_item_wisp_in_bottle.json' with { type: 'json' };
import cathedralItemBowAndArrowJson from '../illustration/examples/cathedral_item_bow_and_arrow.json' with { type: 'json' };
import cathedralItemBoomerangJson from '../illustration/examples/cathedral_item_boomerang.json' with { type: 'json' };
import cathedralItemElysianShieldJson from '../illustration/examples/cathedral_item_elysian_shield.json' with { type: 'json' };
import cathedralItemCinderBloomJson from '../illustration/examples/cathedral_item_cinder_bloom.json' with { type: 'json' };
import cathedralItemAncientSwordJson from '../illustration/examples/cathedral_item_ancient_sword.json' with { type: 'json' };
import cathedralItemChimeraSwordJson from '../illustration/examples/cathedral_item_chimera_sword.json' with { type: 'json' };
// tib8: bespoke portraits for the three item-check opener supply cards.
import cathedralItemGrapplethornJson from '../illustration/examples/cathedral_item_grapplethorn.json' with { type: 'json' };
import cathedralItemGrapnelsJson from '../illustration/examples/cathedral_item_grapnels.json' with { type: 'json' };
import cathedralItemAegisPaneJson from '../illustration/examples/cathedral_item_aegis_pane.json' with { type: 'json' };
// bead embertide-063 (2026-04-23): ember-shard + vital-ember rasters.
// Surfaced as raster pips in HPStrip (below the main heart row) and as the
// bespoke reward icon in ChestReveal. `renderIllustration` honours
// `rasterImageUrl` and suppresses the vector fallbacks (see renderer.tsx
// §4b raster layer) so these two specs are raster-only by design.
import cathedralItemEmberShardJson from '../illustration/examples/cathedral_item_ember_shard.json' with { type: 'json' };
import cathedralItemVitalEmberJson from '../illustration/examples/cathedral_item_vital_ember.json' with { type: 'json' };
// gdd.1 / gdd.2 / gdd.3 (2026-04-25 FAL batch): v2.1 zone rosters.
//   Maren regulars + bosses
import cathedralMonsterMarenWarriorJson from '../illustration/examples/cathedral_monster_maren_warrior.json' with { type: 'json' };
import cathedralMonsterReefbladeJson from '../illustration/examples/cathedral_monster_reefblade.json' with { type: 'json' };
import cathedralMonsterFrostJelletJson from '../illustration/examples/cathedral_monster_frost_jellet.json' with { type: 'json' };
import cathedralMonsterFangfishJson from '../illustration/examples/cathedral_monster_fangfish.json' with { type: 'json' };
import cathedralMonsterMaelstromJson from '../illustration/examples/cathedral_monster_maelstrom.json' with { type: 'json' };
import cathedralMonsterTidewraithJson from '../illustration/examples/cathedral_monster_tidewraith.json' with { type: 'json' };
//   Hollow Shrine regulars + bosses
import cathedralMonsterWillowispJson from '../illustration/examples/cathedral_monster_willowisp.json' with { type: 'json' };
import cathedralMonsterGrasplingJson from '../illustration/examples/cathedral_monster_graspling.json' with { type: 'json' };
import cathedralMonsterBoneletJson from '../illustration/examples/cathedral_monster_bonelet.json' with { type: 'json' };
import cathedralMonsterDuskwingJson from '../illustration/examples/cathedral_monster_duskwing.json' with { type: 'json' };
import cathedralMonsterHollowEffigyJson from '../illustration/examples/cathedral_monster_hollow_effigy.json' with { type: 'json' };
import cathedralMonsterKnellJson from '../illustration/examples/cathedral_monster_knell.json' with { type: 'json' };
//   Dune Sanctum regulars + bosses
import cathedralMonsterDuneweedJson from '../illustration/examples/cathedral_monster_duneweed.json' with { type: 'json' };
import cathedralMonsterSandwyrmJson from '../illustration/examples/cathedral_monster_sandwyrm.json' with { type: 'json' };
import cathedralMonsterSunbleachedReaverJson from '../illustration/examples/cathedral_monster_sunbleached_reaver.json' with { type: 'json' };
import cathedralMonsterScuttlespineJson from '../illustration/examples/cathedral_monster_scuttlespine.json' with { type: 'json' };
import cathedralMonsterIronSentinelJson from '../illustration/examples/cathedral_monster_iron_sentinel.json' with { type: 'json' };
import cathedralMonsterHextwinsJson from '../illustration/examples/cathedral_monster_hextwins.json' with { type: 'json' };
// 2026-04-25 — original designer characters: zone-locked center-row heroes.
import cathedralHeroDuneRevenantJson from '../illustration/examples/cathedral_hero_dune_revenant.json' with { type: 'json' };
import cathedralHeroVelrathDukeOfVeilsJson from '../illustration/examples/cathedral_hero_velrath_duke_of_veils.json' with { type: 'json' };
// p24m (2026-05-02) — Trinity Aurogax (Aurogax), Tier-5
// colosseum capstone. Three heads × three eras (gloom + Umbra +
// Auren). Approved 2026-05-02 (commit 21956ed); regen-v2 raster from
// fal-ai/nano-banana-pro.
import cathedralMonsterAurogaxJson from '../illustration/examples/cathedral_monster_aurogax.json' with { type: 'json' };

const SPEC_BY_ROLE: Partial<Record<CardRole, IllustrationSpec>> = {
  hero: cathedralHeroWarriorJson as IllustrationSpec,
  monster: cathedralMonsterStalkerJson as IllustrationSpec,
  'mini-boss': cathedralBossBruteJson as IllustrationSpec,
  'final-boss': cathedralBossTyrantJson as IllustrationSpec,
  'legendary-sword': cathedralItemLegendarySwordJson as IllustrationSpec,
  item: cathedralItemRelicJson as IllustrationSpec,
  'revealer-item': cathedralItemSeeingStoneJson as IllustrationSpec,
  // tq5 final 3-tier system: chest-std reads as a humble wooden sturdy
  // chest (Sturdy Chest, 1 key); chest-mid is the "Ornate Chest" middle
  // tier (2 keys) — currently reuses the vy9 "enchanted" raster as a
  // visual placeholder until tq5-art ships the bespoke decorated-wooden +
  // iron-banding + gem-inlay raster; chest-boss is the Grand Vault scene
  // (3 keys) with piles of gold and gems.
  'chest-std': cathedralChestSturdyJson as IllustrationSpec,
  'chest-mid': cathedralChestMidJson as IllustrationSpec,
  'chest-boss': cathedralChestVaultJson as IllustrationSpec,
  'starter-green': cathedralStarterGreenJson as IllustrationSpec,
  'starter-red': cathedralStarterRedJson as IllustrationSpec,
};

/**
 * Per-card overrides keyed on baseId. The role-level map gives every card of
 * a given role the same art, but a few specific cards (the always-available
 * mystic / militia-grunt / wild-wolf) deserve their own portrait so the
 * always-available row reads as visually distinct from the rotating market.
 */
const SPEC_BY_BASE_ID: Record<string, IllustrationSpec> = {
  mystic: cathedralAlwaysAvailMysticJson as IllustrationSpec,
  'militia-grunt': cathedralAlwaysAvailMilitiaGruntJson as IllustrationSpec,
  // 2026-04-23: always-available enemy rethemed to Scrabling. Reuses the
  // center-deck scrabling raster until a distinct always-avail-scrabling
  // variant ships (see embertide future-art bead). The standalone
  // cathedral_alwaysavail_wild_wolf raster is retained on disk for
  // rollback / history but no longer rendered.
  'wild-wolf': cathedralMonsterScrablingJson as IllustrationSpec,
  // Champion portrait baseIds (embertide-kln + -fpm; retained as
  // portrait-only after j49z 2026-04-24 retired the `starter-home` role
  // and removed the underlying KID_CARDS entries — the ids now serve as
  // KidChampion.portraitCardId lookup keys for the Setup picker, not as
  // playable cards). illustrationForCard never resolves these baseIds
  // anymore because no Card carries them; illustrationForChampion below
  // is the active read path.
  'spirit-arrow': cathedralStarterChampionCourageJson as IllustrationSpec,
  'seer-rune': cathedralStarterChampionWisdomJson as IllustrationSpec,
  warblade: cathedralStarterChampionPowerJson as IllustrationSpec,
  'ancient-keepsake': cathedralStarterChampionSwordJson as IllustrationSpec,
  // u-6c Gilded Cage bosses — each gets a bespoke stained-glass portrait
  // so the three boss-tier cards read as distinct silhouettes rather than
  // sharing the generic boss/monster fallback. Beads:
  //   sentinel         → embertide-6gv (wild-boss, teal + laser)
  //   silver-chimera     → embertide-a9t (wild-boss, silver centaur charge)
  //   cagewright-vurmox → embertide-aph (region-boss / final fight)
  sentinel: cathedralMonsterSentinelJson as IllustrationSpec,
  // embertide-pish (2026-05-05) — tier-2 colosseum 'baseline chimera'
  // sits one knob below silver-chimera per the stat-ordering invariant.
  // Solid earth-red coat + bronze longsword + leather armor + poised
  // guard stance distinguish it from silver-chimera's zebra/chrome/charge.
  chimera: cathedralMonsterChimeraJson as IllustrationSpec,
  'silver-chimera': cathedralMonsterSilverChimeraJson as IllustrationSpec,
  // embertide-044 (2026-04-24): rare post-completion wild boss
  // (Prism Chimera) + its heirloom drop (Rainbow Ancient Chimera
  // Sword). Bespoke portraits so both read as distinct from the
  // regular silver-chimera / generic item art.
  'prism-chimera': cathedralMonsterPrismChimeraJson as IllustrationSpec,
  'rainbow-ancient-chimera-sword': cathedralItemRainbowAncientChimeraSwordJson as IllustrationSpec,
  'cagewright-vurmox': cathedralMonsterCagewrightVurmoxJson as IllustrationSpec,
  // u-6a Sylvanwood roster.
  'thorn-scrub': cathedralMonsterThornScrubJson as IllustrationSpec,
  snapvine: cathedralMonsterSnapvineJson as IllustrationSpec,
  jellet: cathedralMonsterJelletJson as IllustrationSpec,
  scrabling: cathedralMonsterScrablingJson as IllustrationSpec,
  craghorn: cathedralMonsterCraghornJson as IllustrationSpec,
  broodmaw: cathedralMonsterBroodmawJson as IllustrationSpec,
  // u-6b Emberpeak roster.
  saurian: cathedralMonsterSaurianJson as IllustrationSpec,
  ashjaw: cathedralMonsterAshjawJson as IllustrationSpec,
  skittermite: cathedralMonsterSkittermiteJson as IllustrationSpec,
  'red-squidlet': cathedralMonsterRedSquidletJson as IllustrationSpec,
  boulderkin: cathedralMonsterBoulderkinJson as IllustrationSpec,
  'ashen-tyrant': cathedralMonsterAshenTyrantJson as IllustrationSpec,
  // u-6c Gilded Cage regulars.
  wardeye: cathedralMonsterWardeyeJson as IllustrationSpec,
  emberskull: cathedralMonsterEmberskullJson as IllustrationSpec,
  gulpmaw: cathedralMonsterGulpmawJson as IllustrationSpec,
  hexrobe: cathedralMonsterHexrobeJson as IllustrationSpec,
  'bone-knight': cathedralMonsterBoneKnightJson as IllustrationSpec,
  // fix-aurelia (2026-04-22): freed-princess card face — her light arrow.
  // Id generic per IP-safety; display name 'Princess Aurelia' lives in
  // src/theme/generic.ts / runtime theme.
  'freed-princess': cathedralAureliaLightArrowJson as IllustrationSpec,
  // pr2 (2026-04-23): 7 Aurelia-canon named heroes — lift the warrior
  // placeholder off the cards whose in-theme display names reference
  // actual Aurelia characters (Liel, Brammel, Wren, Veylin, Sael, Coll,
  // Naerin).
  'forest-sage': cathedralHeroLielJson as IllustrationSpec,
  'mountain-king': cathedralHeroBrammelJson as IllustrationSpec,
  'ranch-keeper': cathedralHeroWrenJson as IllustrationSpec,
  'sage-keeper': cathedralHeroVeylinJson as IllustrationSpec,
  'scholar-princess': cathedralHeroSaelJson as IllustrationSpec,
  'wandering-merchant': cathedralHeroCollJson as IllustrationSpec,
  // nvd (2026-04-24): Pell on key-vendor — ALBW rental merchant.
  // 1eby reframed key-vendor as a vendor service tile (not a buyable
  // hero); the portrait wiring stays the same.
  'key-vendor': cathedralHeroPellJson as IllustrationSpec,
  'water-warrior': cathedralHeroNaerinJson as IllustrationSpec,
  // pr2 (2026-04-23): 5 bespoke monster + mini-boss portraits — lift the
  // stalker/brute role generics off the canonical Aurelia enemies whose
  // display names (Brute / Brute Spearman / Maelstrom / Scalelord /
  // Tidewraith) otherwise render with a shared silhouette.
  'grunt-orc': cathedralMonsterGruntOrcJson as IllustrationSpec,
  'spear-orc': cathedralMonsterSpearOrcJson as IllustrationSpec,
  squidlet: cathedralMonsterSquidletJson as IllustrationSpec,
  'mini-boss-reptile': cathedralMonsterMiniBossReptileJson as IllustrationSpec,
  'mini-boss-slime': cathedralMonsterMiniBossSlimeJson as IllustrationSpec,
  // pr2 (2026-04-23): v2.0 starter items + pickup wisp + 3 wild-boss
  // heirlooms — lift the 'relic' placeholder off the original cards so
  // starters read as distinct weapons and heirlooms carry their source
  // boss's visual signature.
  'short-sword': cathedralItemShortSwordJson as IllustrationSpec,
  'short-bow': cathedralItemShortBowJson as IllustrationSpec,
  'tower-shield': cathedralItemTowerShieldJson as IllustrationSpec,
  'curved-throwing-blade': cathedralItemCurvedThrowingBladeJson as IllustrationSpec,
  wisp: cathedralItemWispJson as IllustrationSpec,
  'craghorn-tusk': cathedralItemCraghornTuskJson as IllustrationSpec,
  'boulderkin-core': cathedralItemBoulderkinCoreJson as IllustrationSpec,
  'sentinel-eye': cathedralItemSentinelEyeJson as IllustrationSpec,
  // pr2 (2026-04-23): 8 bespoke item portraits — lift the 'relic' generic
  // off the gm0.15 supply items + gm0.16 wisp / ancient / chimera drops so
  // the market + heirloom rows read as distinct cards.
  'great-wisp': cathedralItemGreatWispJson as IllustrationSpec,
  'wisp-in-bottle': cathedralItemWispInBottleJson as IllustrationSpec,
  bow: cathedralItemBowAndArrowJson as IllustrationSpec,
  boomerang: cathedralItemBoomerangJson as IllustrationSpec,
  'elysian-shield': cathedralItemElysianShieldJson as IllustrationSpec,
  'cinder-bloom': cathedralItemCinderBloomJson as IllustrationSpec,
  'ancient-sword': cathedralItemAncientSwordJson as IllustrationSpec,
  'chimera-sword': cathedralItemChimeraSwordJson as IllustrationSpec,
  // tib8: item-check opener supply cards (authored by akop) — lift the generic
  // 'relic' fallback off grapplethorn / grapnels / aegis-pane with bespoke
  // portraits, same pr2 raster pattern. aegis-pane stays distinct from the
  // navy absorb 'elysian-shield' (reflective mirror face + reflected beam).
  grapplethorn: cathedralItemGrapplethornJson as IllustrationSpec,
  grapnels: cathedralItemGrapnelsJson as IllustrationSpec,
  'aegis-pane': cathedralItemAegisPaneJson as IllustrationSpec,
  // bead embertide-063 (2026-04-23): ember-shard + vital-ember
  // bespoke rasters surfaced in HPStrip pip row + ChestReveal reward
  // icon. The card ids themselves are pending in cards.ts but the specs
  // are keyed here so HPStrip/ChestReveal can share the same
  // illustration lookup the rest of the UI uses.
  'ember-shard': cathedralItemEmberShardJson as IllustrationSpec,
  'vital-ember': cathedralItemVitalEmberJson as IllustrationSpec,
  // gdd.1 / gdd.2 / gdd.3 (FAL batch landed 2026-04-25): bespoke
  // portraits for the v2.1 zone rosters. Each lifts the [v2-art-pending]
  // tag off the corresponding Card in src/data/cards.ts.
  //   Tidehold
  'maren-warrior': cathedralMonsterMarenWarriorJson as IllustrationSpec,
  reefblade: cathedralMonsterReefbladeJson as IllustrationSpec,
  'frost-jellet': cathedralMonsterFrostJelletJson as IllustrationSpec,
  fangfish: cathedralMonsterFangfishJson as IllustrationSpec,
  maelstrom: cathedralMonsterMaelstromJson as IllustrationSpec,
  tidewraith: cathedralMonsterTidewraithJson as IllustrationSpec,
  //   Hollow Shrine
  willowisp: cathedralMonsterWillowispJson as IllustrationSpec,
  graspling: cathedralMonsterGrasplingJson as IllustrationSpec,
  bonelet: cathedralMonsterBoneletJson as IllustrationSpec,
  duskwing: cathedralMonsterDuskwingJson as IllustrationSpec,
  'hollow-effigy': cathedralMonsterHollowEffigyJson as IllustrationSpec,
  knell: cathedralMonsterKnellJson as IllustrationSpec,
  //   Dune Sanctum
  duneweed: cathedralMonsterDuneweedJson as IllustrationSpec,
  sandwyrm: cathedralMonsterSandwyrmJson as IllustrationSpec,
  'sunbleached-reaver': cathedralMonsterSunbleachedReaverJson as IllustrationSpec,
  scuttlespine: cathedralMonsterScuttlespineJson as IllustrationSpec,
  'iron-sentinel': cathedralMonsterIronSentinelJson as IllustrationSpec,
  hextwins: cathedralMonsterHextwinsJson as IllustrationSpec,
  // 2026-04-25 — zone-locked center-row hero portraits.
  'dune-revenant': cathedralHeroDuneRevenantJson as IllustrationSpec,
  'velrath-duke-of-veils': cathedralHeroVelrathDukeOfVeilsJson as IllustrationSpec,
  // p24m (2026-05-02) — Colosseum Tier-5 capstone. Card lives in
  // src/data/cards/colosseum.ts; combat spec lives in
  // src/data/colosseum/tier5.ts.
  'trinity-aurogax': cathedralMonsterAurogaxJson as IllustrationSpec,
};

/**
 * Pick the aspect-fit for a card-face illustration.
 *
 * Always `meet` (letterbox) — for BOTH rasters and vector specs.
 *
 * dfx1: the prior raster→`slice` (cover) cropped the subject whenever the
 * art panel was non-square (the common case now that the art panel is the
 * dominant element). Item rasters frame the subject edge-to-edge — the
 * legendary swords run blade-tip to hilt across the full 24×24 cell — so
 * `slice` clipped the tip and pommel (player report "item art is cut off").
 * `meet` fits the whole subject; the art panel's transparent background
 * shows the variant bg through any letterbox margin (see `.card-template-art`
 * note in app.css), so there is no parchment-band amateurism to avoid.
 */
function cardFaceFit(_spec: IllustrationSpec): 'meet' | 'slice' {
  return 'meet';
}

/**
 * Returns the rendered illustration SVG for a card role when a spec exists,
 * or `null` so callers can fall back to their existing icon. Role-only path
 * (no per-card override) — used by helpers and unit tests.
 */
export function illustrationFor(role: CardRole, size: number): ReactElement | null {
  const spec = SPEC_BY_ROLE[role];
  if (!spec) return null;
  return renderIllustration(spec, { size, fit: cardFaceFit(spec) });
}

/**
 * Returns the rendered illustration SVG for a specific card, preferring a
 * per-card baseId override (e.g. mystic) over the role-default.
 *
 * `fit` defaults to the spec-derived fit (`meet` — letterbox, see
 * {@link cardFaceFit}). Callers whose art panel is non-square and who want
 * the art to fill the frame edge-to-edge pass `'slice'` (cover) — e.g. the
 * always-available top-row hero faces, whose portrait panel otherwise
 * letterboxed the square raster with parchment bands top + bottom.
 */
export function illustrationForCard(
  card: Card,
  size: number,
  fit?: 'meet' | 'slice',
): ReactElement | null {
  const spec = SPEC_BY_BASE_ID[baseIdOf(card)] ?? SPEC_BY_ROLE[card.role];
  if (!spec) return null;
  return renderIllustration(spec, { size, fit: fit ?? cardFaceFit(spec) });
}

/**
 * Always returns a renderable art element for the given role, preferring the
 * generated stained-glass illustration and falling back to the legacy icon
 * set for roles that have not yet been authored.
 */
export function cardArtFor(role: CardRole, size: number): ReactElement {
  const illustration = illustrationFor(role, size);
  if (illustration) return illustration;
  return iconFor(role, size);
}

/**
 * Card-aware variant: prefers per-card baseId override before role fallback.
 *
 * `fit` is forwarded to {@link illustrationForCard} — pass `'slice'` for a
 * non-square panel that should fill edge-to-edge. The icon fallback is
 * fit-agnostic (it draws to the requested square `size`).
 */
export function cardArtForCard(card: Card, size: number, fit?: 'meet' | 'slice'): ReactElement {
  const illustration = illustrationForCard(card, size, fit);
  if (illustration) return illustration;
  return iconFor(card.role, size);
}

/**
 * Champion-id → bespoke raster illustration (embertide-sl9).
 *
 * The Setup screen needs a champion portrait without synthesising a Card just
 * to round-trip through `illustrationForCard`. Returns null when the champion
 * id is not registered so callers decide the fallback (icon, placeholder, etc).
 */
const SPEC_BY_CHAMPION_ID: Record<string, IllustrationSpec> = {
  'champion-courage': cathedralStarterChampionCourageJson as IllustrationSpec,
  'champion-wisdom': cathedralStarterChampionWisdomJson as IllustrationSpec,
  'champion-power': cathedralStarterChampionPowerJson as IllustrationSpec,
  'champion-sword': cathedralStarterChampionSwordJson as IllustrationSpec,
};

export function illustrationForChampion(championId: string, size: number): ReactElement | null {
  const spec = SPEC_BY_CHAMPION_ID[championId];
  if (!spec) return null;
  return renderIllustration(spec, { size, fit: 'meet' });
}

/**
 * Card-baseId → bespoke raster illustration (bead embertide-063).
 *
 * Non-card callers (HPStrip pip row, ChestReveal reward icon) need the
 * bespoke raster for a known baseId without synthesising a Card just to
 * thread it through `illustrationForCard`. Returns null when the id is
 * not registered in `SPEC_BY_BASE_ID` so callers decide the fallback
 * (icon, placeholder, etc).
 */
export function illustrationForBaseId(baseId: string, size: number): ReactElement | null {
  const spec = SPEC_BY_BASE_ID[baseId];
  if (!spec) return null;
  return renderIllustration(spec, { size, fit: 'meet' });
}

function iconFor(role: CardRole, size: number): ReactElement {
  switch (role) {
    case 'hero':
      return <Hero size={size} />;
    case 'item':
    case 'revealer-item':
      return <Shield size={size} />;
    case 'legendary-sword':
      return <Sword size={size} />;
    case 'monster':
    case 'mini-boss':
      return <Monster size={size} />;
    case 'final-boss':
      return <Boss size={size} />;
    case 'chest-std':
    case 'chest-mid':
    case 'chest-boss':
      return <Chest size={size} />;
    case 'starter-green':
      return <GreenShard size={size} />;
    case 'starter-red':
      return <Sword size={size} />;
    default:
      return <Shield size={size} />;
  }
}
