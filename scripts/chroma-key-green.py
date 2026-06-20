#!/usr/bin/env python3
"""
chroma-key-green — turn a solid #00FF00 (green-screen) background into
a real RGBA alpha channel. Feather-blends near-green edges so the
crystal's glow-halo survives as smooth semi-transparency rather than
a hard-clipped outline.

Usage:
  python3 scripts/chroma-key-green.py <input.png> [--out=<output.png>]
"""

import argparse
import sys
from pathlib import Path
from PIL import Image


def chroma_key(src: Image.Image) -> Image.Image:
    if src.mode != "RGBA":
        src = src.convert("RGBA")
    pixels = src.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            # Greenness metric: how much green dominates over red/blue.
            dominance = g - max(r, b)
            if dominance <= 0:
                continue
            # Aggressive key: any pixel where green dominates red+blue
            # by 20+ is either the key or key-adjacent spill — fade to
            # alpha and de-spill the green channel.
            if dominance > 120:
                # Solid key: fully transparent
                pixels[x, y] = (r, g, b, 0)
            elif dominance > 20:
                # Feather 20..120 -> alpha 255..0 (linear)
                alpha = max(0, min(255, int(255 - (dominance - 20) * 2.55)))
                # Hard de-spill: clamp green down so edges don't keep
                # a neon rim.
                new_g = min(g, max(r, b))
                pixels[x, y] = (r, new_g, b, alpha)
    return src


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    out = args.out or args.input
    im = Image.open(args.input)
    keyed = chroma_key(im)
    keyed.save(out, "PNG")
    bbox = keyed.getchannel("A").getbbox()
    print(f"wrote {out} mode={keyed.mode} alpha-bbox={bbox}")


if __name__ == "__main__":
    main()
