#!/usr/bin/env python3
"""Curate Aurelia-Cathedral v1 dataset into v2 with tightened captions.

v1 LoRA drift symptoms:
  * too painterly / photorealistic
  * too bright / saturated
  * rainbow fills
  * Craghorn + prism-chimera dragged the model toward gradient blobs

v2 curation: drop painterly/bright/rainbow rasters; rewrite every caption
with a strong simple-flat-stained-glass directive plus explicit anti-patterns
("NOT bright saturated", "no painterly gradients", ...).

Reads: ~/tools/ai-toolkit/datasets/aurelia-cathedral/
Writes: ~/tools/ai-toolkit/datasets/aurelia-cathedral-v2/
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

SRC = Path.home() / "tools" / "ai-toolkit" / "datasets" / "aurelia-cathedral"
DST = Path.home() / "tools" / "ai-toolkit" / "datasets" / "aurelia-cathedral-v2"

# Rasters to DROP — do not include in v2 training set.
# Reasons documented inline.
DROP = {
    "cathedral_combat_bg_sylvani_001":        "painterly forest landscape, not stained-glass aesthetic",
    "cathedral_combat_bg_emberpeak_001":"painterly interior landscape, muddy palette",
    "cathedral_combat_bg_gilded_cage_001":"painterly interior landscape, not stained-glass aesthetic",
    "cathedral_monster_prism_chimera_001": "rainbow-saturated — exactly the anti-pattern",
    "cathedral_monster_craghorn_001":           "painterly gradients, bright yellow rays, gradient skin",
    "cathedral_item_rainbow_prism_001":      "pure rainbow wheel — saturated anti-pattern",
    "cathedral_starter_champion_courage_001":"painterly realistic face, bright cheerful palette",
    "cathedral_starter_champion_sword_001":  "painterly realistic face, saturated red rays",
}

# Stylistic tail appended to every caption in v1 — we're replacing it.
OLD_TAIL_PATTERN = re.compile(
    r",?\s*zsCathedralStyle.*?bold character outlines\s*$",
    re.IGNORECASE | re.DOTALL,
)

# Per-category palette hints — steers FLUX toward the right deep-jewel slice
# for each subject class. Keyed by filename substring after "cathedral_".
PALETTE_BY_CATEGORY = {
    "altar_destiny_vurmox":    "palette of deep plum purple, black, and dull gold",
    "altar_frame_region":     "palette of deep crimson, black iron, and aged gold",
    "altar_frame_wild":       "palette of mossy forest green, weathered stone grey, and soft gold",
    "alwaysavail_militia":    "palette of deep teal, burgundy, and muted gold",
    "alwaysavail_mystic":     "palette of emerald green, sapphire blue, and ruby red jewel tones",
    "alwaysavail_wild_wolf":  "palette of amber orange, burnt sienna, and dark forest green",
    "boss_brute":             "palette of deep violet, ruby red, and storm-grey",
    "boss_tyrant":            "palette of ember red, oxblood, and antique gold",
    "chest_big":              "palette of royal blue, crimson, and polished gold",
    "chest_medium":           "palette of sapphire blue, emerald green, and warm gold",
    "chest_small":            "palette of dusty blue, maroon, and weathered wood-brown",
    "hero_warrior":           "palette of deep forest green, navy blue, crimson cape, and warm gold",
    "item_legendary_sword":   "palette of emerald green, sapphire blue, violet, and gold",
    "item_relic":             "palette of emerald green, ruby red, royal blue, and gold",
    "item_seeing_stone":      "palette of amethyst purple, forest green, and silver",
    "monster_wardeye":         "palette of amber, oxblood red, and dark bronze",
    "monster_scrabling":       "palette of forest green, warm ochre, and dark brown",
    "monster_bubble":         "palette of electric violet, indigo, and bone-white",
    "monster_jellet":         "palette of jade green and moss green jewel tones",
    "monster_snapvine":      "palette of forest green and crimson red",
    "monster_thorn_scrub":     "palette of woodsy brown, mossy green, and ochre",
    "monster_cagewright_vurmox":"palette of oxblood red, ember orange, jet black, and dark gold",
    "monster_ashjaw":        "palette of oxblood red, ember orange, and charcoal black",
    "monster_broodmaw":          "palette of emerald green, ruby red, and dark gold",
    "monster_sentinel":       "palette of deep teal, aged bronze, and cyan accents",
    "monster_ashen_tyrant":   "palette of oxblood red, charcoal grey, and ember gold",
    "monster_like_like":      "palette of burnt sienna, ochre, and deep ruby",
    "monster_saurian":       "palette of oxblood red, charcoal, and ember orange",
    "monster_red_squidlet":    "palette of oxblood red, ember orange, and dark bronze",
    "monster_silver_chimera":   "palette of cool steel blue, ivory white, and dark slate",
    "monster_bone_knight": "palette of bone white, antique gold, and deep umber",
    "monster_stalker":        "palette of deep amethyst purple, teal blue, forest green, and ochre",
    "monster_boulderkin":    "palette of oxblood red, charcoal grey, and ember orange",
    "monster_skittermite":        "palette of oxblood red, ember orange, and gold",
    "monster_hexrobe":       "palette of amethyst purple, amber gold, and ivory",
    "starter_champion_power": "palette of crimson red, ember orange, and deep gold",
    "starter_champion_wisdom":"palette of royal blue, silver, and ivory",
    "aurelia_freed":            "palette of rose pink, cream white, and warm gold",
    "aurelia_light_arrow":      "palette of ivory white, warm gold, and midnight black",
    "zone_emberpeak":    "palette of oxblood red, ember orange, and charcoal",
    "zone_sylvani":            "palette of forest green, emerald, and warm amber",
    "zone_gilded_cage":    "palette of sapphire blue, ivory, and warm gold",
}


STYLE_PREFIX = (
    "simple flat stained-glass illustration, zsCathedralStyle, "
)

STYLE_SUFFIX_TEMPLATE = (
    "{palette}, deep jewel-tone colors (NOT bright saturated rainbow colors, "
    "NOT pastel, NOT cheerful), bold thick black lead cames dividing flat "
    "colored glass panes, clean graphic shapes with no painterly gradients "
    "and no photorealistic shading, gothic cathedral window composition"
)


def category_key(stem: str) -> str:
    """Match filename stem to PALETTE_BY_CATEGORY key."""
    # stem like "cathedral_monster_craghorn_001" -> "monster_craghorn"
    m = re.match(r"cathedral_(.+?)_\d+$", stem)
    if not m:
        return ""
    core = m.group(1)
    # Try exact match, then progressively shorter prefixes.
    if core in PALETTE_BY_CATEGORY:
        return core
    parts = core.split("_")
    for i in range(len(parts), 0, -1):
        candidate = "_".join(parts[:i])
        if candidate in PALETTE_BY_CATEGORY:
            return candidate
    return ""


def strip_old_tail(caption: str) -> str:
    """Remove the v1 boilerplate style tail, keep the subject description."""
    # The v1 tail always starts at ", zsCathedralStyle, ..." and runs to "bold character outlines".
    stripped = OLD_TAIL_PATTERN.sub("", caption).strip().rstrip(",")
    return stripped


def rewrite_caption(original: str, stem: str) -> str:
    subject = strip_old_tail(original)
    key = category_key(stem)
    palette = PALETTE_BY_CATEGORY.get(key, "palette of deep jewel-tone colors")
    suffix = STYLE_SUFFIX_TEMPLATE.format(palette=palette)
    return f"{STYLE_PREFIX}{subject}, {suffix}"


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"source dataset not found: {SRC}")
    DST.mkdir(parents=True, exist_ok=True)

    kept = 0
    dropped = 0
    for txt_path in sorted(SRC.glob("*.txt")):
        stem = txt_path.stem
        if stem in DROP:
            print(f"  DROP  {stem}  ({DROP[stem]})")
            dropped += 1
            continue
        webp_path = SRC / f"{stem}.webp"
        if not webp_path.exists():
            print(f"  SKIP  {stem}  (missing .webp)")
            continue

        original = txt_path.read_text(encoding="utf-8").strip()
        rewritten = rewrite_caption(original, stem)

        shutil.copy2(webp_path, DST / webp_path.name)
        (DST / txt_path.name).write_text(rewritten + "\n", encoding="utf-8")
        kept += 1
        key = category_key(stem) or "(no-palette-match)"
        print(f"  keep  {stem}  [{key}]")

    print()
    print(f"curated: {kept} kept, {dropped} dropped")
    print(f"dataset: {DST}")


if __name__ == "__main__":
    main()
