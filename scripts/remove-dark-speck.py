#!/usr/bin/env python3
"""remove-dark-speck — surgical removal of isolated dark artifacts from
a raster illustration.

Motivation
----------
embertide-gt9a: the cathedral_monster_craghorn_001.webp raster carries
a small black dot on the Craghorn's eye that reads as a defect under the
nz8-a 256px enlargement. The dot is a small cluster of near-black
pixels (up to a few dozen pixels) surrounded by brighter eye coloring
— a local opaque-black artifact that a bounded connected-component
pass can clean without affecting the rest of the raster.

How it works
------------
1. Load the input RGBA webp.
2. Threshold on opaque + near-black pixels (luminance < --dark-threshold).
3. Label connected components of the dark mask (4-connectivity).
4. For each component smaller than --max-cluster-pixels:
   a. Expand its bounding box by --halo pixels.
   b. Compute the median RGB of the halo (pixels in the expanded box
      that are NOT part of the component and NOT themselves dark).
   c. If the halo median luminance is above --neighbor-threshold (i.e.
      surrounded by bright coloring, confirming artifact status),
      replace every pixel in the component with the halo-median RGB.
   d. Alpha is preserved.
5. Large dark components (shading, outlines) are skipped unchanged.

The thresholds are tuned conservatively: isolated dark blobs up to a
few hundred pixels sitting on a bright background are cleaned, but
large shadow regions or dark outlines where the halo is also dark stay
untouched.

Usage
-----
    python3 scripts/remove-dark-speck.py \
            public/illustrations/cathedral_monster_craghorn_001.webp \
            [--dark-threshold 40] [--neighbor-threshold 90] \
            [--max-cluster-pixels 400] [--halo 8] \
            [--bbox y0,x0,y1,x1]  # optional: confine cleanup to a box
            [--out OUT_PATH] [--quality 90] [--dry-run]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image
import numpy as np
from scipy import ndimage


def clean(
    src: Path,
    out: Path,
    dark_threshold: int,
    neighbor_threshold: int,
    max_cluster_pixels: int,
    halo: int,
    quality: int,
    bbox: tuple[int, int, int, int] | None,
    dry_run: bool,
) -> int:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]
    lum = (
        0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    ).astype(np.int16)

    dark_mask = (alpha > 128) & (lum < dark_threshold)
    if bbox is not None:
        y0, x0, y1, x1 = bbox
        box_mask = np.zeros_like(dark_mask)
        box_mask[y0:y1, x0:x1] = True
        dark_mask &= box_mask

    labeled, n_components = ndimage.label(dark_mask)
    if n_components == 0:
        print(f"{src}: no dark components; nothing to do")
        return 0

    sizes = ndimage.sum(dark_mask, labeled, range(1, n_components + 1))

    out_arr = arr.copy()
    touched_components = 0
    touched_pixels = 0
    for comp_id, size in enumerate(sizes, start=1):
        size_int = int(size)
        if size_int == 0 or size_int > max_cluster_pixels:
            continue
        comp_mask = labeled == comp_id
        ys, xs = np.where(comp_mask)
        if ys.size == 0:
            continue
        y_min, y_max = int(ys.min()), int(ys.max())
        x_min, x_max = int(xs.min()), int(xs.max())
        y0 = max(0, y_min - halo)
        y1 = min(h, y_max + halo + 1)
        x0 = max(0, x_min - halo)
        x1 = min(w, x_max + halo + 1)
        halo_rect_mask = np.zeros_like(dark_mask)
        halo_rect_mask[y0:y1, x0:x1] = True
        halo_mask = halo_rect_mask & ~comp_mask & ~dark_mask & (alpha > 128)
        if not halo_mask.any():
            continue
        halo_lum_med = float(np.median(lum[halo_mask]))
        if halo_lum_med < neighbor_threshold:
            # Surrounded by dark — legitimate shadow, skip.
            continue
        halo_rgb = arr[halo_mask][:, :3]
        median_rgb = np.median(halo_rgb, axis=0).astype(np.uint8)
        out_arr[comp_mask, 0] = median_rgb[0]
        out_arr[comp_mask, 1] = median_rgb[1]
        out_arr[comp_mask, 2] = median_rgb[2]
        touched_components += 1
        touched_pixels += size_int
        print(
            f"  component {comp_id}: size={size_int}, bbox=({y_min}-{y_max},{x_min}-{x_max}), "
            f"halo_median_lum={halo_lum_med:.1f}, replaced with RGB={median_rgb.tolist()}"
        )

    if touched_components == 0:
        print(f"{src}: {n_components} dark components found, none matched the artifact heuristic")
        return 0

    print(
        f"{src}: cleaned {touched_components} components totaling {touched_pixels} pixels"
    )
    if dry_run:
        print("(dry-run; no file written)")
        return touched_pixels
    Image.fromarray(out_arr, "RGBA").save(out, "WEBP", quality=quality)
    print(f"  -> wrote {out} (quality={quality})")
    return touched_pixels


def parse_bbox(raw: str | None) -> tuple[int, int, int, int] | None:
    if raw is None:
        return None
    parts = [int(p) for p in raw.split(",")]
    if len(parts) != 4:
        raise SystemExit("--bbox expects y0,x0,y1,x1")
    return (parts[0], parts[1], parts[2], parts[3])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("src", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--dark-threshold", type=int, default=40)
    parser.add_argument("--neighbor-threshold", type=int, default=90)
    parser.add_argument("--max-cluster-pixels", type=int, default=400)
    parser.add_argument("--halo", type=int, default=8)
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--bbox", type=str, default=None, help="y0,x0,y1,x1")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    out = args.out or args.src
    clean(
        args.src,
        out,
        args.dark_threshold,
        args.neighbor_threshold,
        args.max_cluster_pixels,
        args.halo,
        args.quality,
        parse_bbox(args.bbox),
        args.dry_run,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
