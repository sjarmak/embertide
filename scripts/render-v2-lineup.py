#!/usr/bin/env python3
"""Render the 6-char validation lineup against the freshly-trained v2 LoRA.

Lineup mixes v1 drift cases + controls:
  1. monster_craghorn         — worst v1 failure (painterly, dropped from v2 training)
  2. monster_silver_chimera  — drifted bright in v1 (kept in v2 training)
  3. starter_champion_courage — painterly face (dropped from v2 training)
  4. starter_champion_sword   — painterly face (dropped from v2 training)
  5. starter_champion_power   — control (kept in v2 training)
  6. aurelia_freed              — target exemplar (kept in v2 training)

Writes: public/illustrations/v2-lineup/<slug>.png
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from _comfyui_client import generate_flux_lora_t2i  # noqa: E402

REPO_ROOT = HERE.parent
OUT_DIR = REPO_ROOT / "public" / "illustrations" / "v2-lineup"
LORA_NAME = "aurelia-cathedral.safetensors"

V2_STYLE_PREFIX = "simple flat stained-glass illustration, zsCathedralStyle, "
V2_STYLE_SUFFIX_TPL = (
    "{palette}, deep jewel-tone colors (NOT bright saturated rainbow colors, "
    "NOT pastel, NOT cheerful), bold thick black lead cames dividing flat "
    "colored glass panes, clean graphic shapes with no painterly gradients "
    "and no photorealistic shading, gothic cathedral window composition"
)


def build_prompt(subject: str, palette: str) -> str:
    return f"{V2_STYLE_PREFIX}{subject}, {V2_STYLE_SUFFIX_TPL.format(palette=palette)}"


LINEUP: list[tuple[str, str, int]] = [
    (
        "monster_craghorn",
        build_prompt(
            subject=(
                "a craghorn cyclops bog-ogre, massive humanoid with a single large "
                "luminous amber eye on the forehead, small pointed ears, round "
                "pot-belly, dark mossy green skin, pink nose, sharp lower "
                "canines, loincloth"
            ),
            palette="palette of dark mossy forest green, deep amber eye, and ochre loincloth",
        ),
        1001,
    ),
    (
        "monster_silver_chimera",
        build_prompt(
            subject=(
                "a silver chimera boss, noble centaur-like beast with a lion-bull "
                "head, two long curved horns, white and silver zebra-striped "
                "centaur body, armored plate on chest, wielding a great sword, "
                "rearing on hind legs"
            ),
            palette="palette of cool steel blue, ivory white, and dark slate",
        ),
        1002,
    ),
    (
        "starter_champion_courage",
        build_prompt(
            subject=(
                "a young elysian warrior champion of Courage, Songflute of Time Link "
                "aesthetic, green tunic and cap, blond hair, determined face, "
                "holding a sword and shield ready for battle, pointed elf ears"
            ),
            palette="palette of deep forest green, warm gold, and navy blue",
        ),
        1003,
    ),
    (
        "starter_champion_sword",
        build_prompt(
            subject=(
                "a legendary sword-bearing champion, elysian knight in silver and "
                "blue armor, wielding the Emberblade aloft, determined heroic "
                "face, pointed elf ears"
            ),
            palette="palette of steel silver, sapphire blue, and warm gold",
        ),
        1004,
    ),
    (
        "starter_champion_power",
        build_prompt(
            subject=(
                "a elysian champion of Power, muscular warrior in heavier gold and "
                "crimson armor, fierce expression, wielding a greatsword, strong "
                "stance"
            ),
            palette="palette of crimson red, ember orange, and deep gold",
        ),
        1005,
    ),
    (
        "aurelia_freed",
        build_prompt(
            subject=(
                "Princess Aurelia, Songflute of Time adult aesthetic, long blonde "
                "hair, flowing white and gold royal gown with Elysian crest, "
                "golden halo sunburst behind her, hands clasped gracefully, "
                "pink crystal shards swirling around her feet, serene benevolent "
                "expression, pointed elf ears"
            ),
            palette="palette of rose pink, cream white, and warm gold",
        ),
        1006,
    ),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, prompt, seed in LINEUP:
        out_path = OUT_DIR / f"{slug}.png"
        print(f"→ {slug}  (seed={seed})")
        png = generate_flux_lora_t2i(
            prompt=prompt,
            lora_name=LORA_NAME,
            strength=1.0,
            width=1024,
            height=1536,
            steps=24,
            guidance=3.5,
            seed=seed,
        )
        out_path.write_bytes(png)
        print(f"   wrote {out_path.relative_to(REPO_ROOT)}  ({len(png) // 1024} KB)")
    print()
    print(f"lineup written to {OUT_DIR}")


if __name__ == "__main__":
    main()
