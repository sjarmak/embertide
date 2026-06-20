#!/usr/bin/env python3
"""clean-monster-chroma-key — remove leaked checkerboard-transparency
pixels from cathedral_monster_*.webp rasters.

Background
----------
The upstream generator (nano-banana-pro) sometimes returns an opaque
RGB image with a checkerboard pattern standing in for "transparent"
background — two alternating near-gray shades (typically luminance
~232 and ~255 at very low saturation). An earlier chroma-key pass
cleaned most rasters, but ``silver_chimera`` (the worst offender) plus
a handful of others still show residue.

This script applies a conservative low-saturation + high-luminance
mask (u-10c/u-10d precedent) and sets alpha=0 on any matching pixels
that are ALSO connected to the image border (flood-fill BFS). That
protects any legitimate light-gray/white details on the subject's
body — those won't touch the border unless the subject itself is
pure white.

Usage
-----
    python3 scripts/clean-monster-chroma-key.py \
            [--tol-sat 20] [--tol-lum 200] \
            [--flood] [--quality 85] \
            [FILES...]

With no FILES the script scans ``public/illustrations/`` for every
``cathedral_monster_*.webp`` and only rewrites files whose checker-
mask covers >1% of opaque pixels (the noise floor seen on clean
rasters is well under 0.3%).
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent
ILLUSTRATIONS_DIR = REPO_ROOT / "public" / "illustrations"
# Target ≤200KB when feasible; otherwise never exceed the original size.
TARGET_FILE_BYTES = 200 * 1024
DEFAULT_TARGETS = sorted(ILLUSTRATIONS_DIR.glob("cathedral_monster_*.webp"))


def checker_mask(
    arr: np.ndarray,
    tol_sat: int,
    tol_lum: int,
) -> np.ndarray:
    """Return a boolean mask of pixels matching the checker signature:
    low saturation AND high luminance AND currently opaque."""
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    a = arr[..., 3]
    max_ch = np.maximum(np.maximum(r, g), b)
    min_ch = np.minimum(np.minimum(r, g), b)
    saturation = max_ch - min_ch
    luminance = max_ch
    return (saturation < tol_sat) & (luminance >= tol_lum) & (a > 0)


def connected_to_border(mask: np.ndarray) -> np.ndarray:
    """Return a boolean mask of pixels in `mask` that are 4-connected
    to the image border. Prevents eating into interior light highlights
    on the subject's body."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    q: deque[tuple[int, int]] = deque()

    # Seed with every border pixel that matches the mask.
    for x in range(w):
        if mask[0, x]:
            q.append((0, x))
            out[0, x] = True
        if mask[h - 1, x]:
            q.append((h - 1, x))
            out[h - 1, x] = True
    for y in range(h):
        if mask[y, 0] and not out[y, 0]:
            q.append((y, 0))
            out[y, 0] = True
        if mask[y, w - 1] and not out[y, w - 1]:
            q.append((y, w - 1))
            out[y, w - 1] = True

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def clean_file(
    path: Path,
    tol_sat: int,
    tol_lum: int,
    flood: bool,
    quality: int,
    force: bool,
) -> tuple[str, float, float] | None:
    """Return (filename, before_pct, after_pct) when a file is rewritten,
    else None when skipped (already clean)."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    total = arr.shape[0] * arr.shape[1]
    opaque_before = int((arr[..., 3] > 0).sum())
    before_transparent_pct = (arr[..., 3] == 0).sum() / total * 100

    raw = checker_mask(arr, tol_sat, tol_lum)
    raw_pct = raw.sum() / max(1, opaque_before) * 100

    # Skip rasters whose checker footprint is below the noise floor
    # unless --force is set (craghorn / broodmaw are in the designer's call-out
    # even at sub-threshold % so we accept them by name).
    if not force and raw_pct < 1.0:
        return None

    target_mask = connected_to_border(raw) if flood else raw
    arr[target_mask, 3] = 0

    original_bytes = path.stat().st_size
    out = Image.fromarray(arr)
    out.save(path, "WEBP", quality=quality, method=6, exact=False)

    # Quality fallback: aim for ≤200KB, but never exceed the original
    # pre-cleanup file size. Stop reducing quality once we're below
    # either threshold — avoids destroying detail when the source
    # already shipped well over 200KB.
    q = quality
    size_cap = min(TARGET_FILE_BYTES, original_bytes)
    while path.stat().st_size > size_cap and q > 75:
        q -= 5
        out.save(path, "WEBP", quality=q, method=6, exact=False)

    verify = np.array(Image.open(path).convert("RGBA"))
    after_transparent_pct = (verify[..., 3] == 0).sum() / total * 100

    cleared = int(target_mask.sum())
    print(
        f"  {path.name}: cleared {cleared}px "
        f"({raw_pct:.2f}% of opaque) — "
        f"transparent {before_transparent_pct:.2f}% -> {after_transparent_pct:.2f}% "
        f"({path.stat().st_size/1024:.1f}KB @ q={q})"
    )
    return (path.name, before_transparent_pct, after_transparent_pct)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--tol-sat", type=int, default=20)
    parser.add_argument("--tol-lum", type=int, default=200)
    parser.add_argument(
        "--flood",
        action="store_true",
        help="only clear checker pixels connected to the image border",
    )
    parser.add_argument("--quality", type=int, default=85)
    parser.add_argument(
        "--force",
        action="store_true",
        help="rewrite even when checker footprint is below the noise floor",
    )
    args = parser.parse_args()

    targets = args.files if args.files else DEFAULT_TARGETS
    if not targets:
        print("No monster rasters found.", file=sys.stderr)
        return 1

    print(
        f"Scanning {len(targets)} raster(s) "
        f"(tol_sat<{args.tol_sat}, tol_lum>={args.tol_lum}"
        f"{', border-connected only' if args.flood else ''})"
    )

    changed: list[tuple[str, float, float]] = []
    for path in targets:
        result = clean_file(
            path,
            tol_sat=args.tol_sat,
            tol_lum=args.tol_lum,
            flood=args.flood,
            quality=args.quality,
            force=args.force,
        )
        if result is not None:
            changed.append(result)

    if not changed:
        print("No files needed cleanup.")
        return 0

    print(f"\nCleaned {len(changed)} file(s):")
    for name, before, after in changed:
        print(f"  {name}: transparent {before:.2f}% -> {after:.2f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
