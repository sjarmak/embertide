#!/usr/bin/env python3
"""u10c-altar-alpha — derive an alpha channel from a nano-banana-pro
"transparent PNG" output that actually came back as RGB with a uniform
near-white fill standing in for transparent regions.

Algorithm:
  1. Flood-fill alpha=0 from every pixel on the border that is within
     tolerance of the corner color (usually near-white).
  2. Additionally, clear alpha on any interior pixel connected via the
     same tolerance region — a single BFS over the image graph handles
     both the border and any enclosed white wells (e.g. the arch
     interior that's only reachable through the arch opening).
  3. Re-encode as webp with alpha via PIL.

The output is NOT meant to match the model's intended silhouette pixel-
perfect — it's a best-effort cutout from an opaque fill. A follow-on
bead should re-generate with true alpha support (e.g. SDXL + rembg).

Usage:
  python3 scripts/u10c-altar-alpha.py <input.png> --out=<output.webp>
       [--tol=22] [--quality=75] [--max-width=640]
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path
from typing import Tuple

from PIL import Image


def color_distance(a: Tuple[int, int, int], b: Tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def flood_alpha(
    img: Image.Image,
    tol: float,
    seed_override: Tuple[int, int, int] | None = None,
) -> Image.Image:
    """BFS from border + interior seed points, marking connected
    near-seed-color pixels as alpha=0. Returns a new RGBA image."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    # Seed color: prefer the image's CENTER pixel (guaranteed to be in
    # the "should be transparent" interior for altar frames). Falls back
    # to corners for frames that extend to the border.
    if seed_override is not None:
        seed = seed_override
    else:
        cx, cy = w // 2, h // 2
        center = px[cx, cy]
        seed = (int(center[0]), int(center[1]), int(center[2]))

    visited = [[False] * h for _ in range(w)]
    q: deque[Tuple[int, int]] = deque()

    # Seed 1: every border pixel within tolerance (catches frames
    # where the background extends to the edge, e.g. region altar).
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if color_distance((r, g, b), seed) <= tol:
                q.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            if visited[x][y]:
                continue
            r, g, b, _ = px[x, y]
            if color_distance((r, g, b), seed) <= tol:
                q.append((x, y))
                visited[x][y] = True

    # Seed 2: the image center (catches the arch interior for frames
    # whose border is filled with stone, e.g. wild altar).
    cx, cy = w // 2, h // 2
    if not visited[cx][cy]:
        r, g, b, _ = px[cx, cy]
        if color_distance((r, g, b), seed) <= tol:
            q.append((cx, cy))
            visited[cx][cy] = True

    # BFS — clear alpha on every connected near-seed pixel.
    cleared = 0
    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        cleared += 1
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb, _ = px[nx, ny]
                if color_distance((nr, ng, nb), seed) <= tol:
                    visited[nx][ny] = True
                    q.append((nx, ny))

    # Feather 1 pixel at the alpha boundary to avoid hard-edge aliasing.
    # Simple approach: pixels adjacent to alpha=0 pixels get halved alpha
    # if they are within 1.5× tolerance of the seed.
    boundary_tol = tol * 1.75
    for x in range(1, w - 1):
        for y in range(1, h - 1):
            if px[x, y][3] != 255:
                continue
            r, g, b, _ = px[x, y]
            neighbors_transparent = any(
                px[x + dx, y + dy][3] == 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if neighbors_transparent and color_distance((r, g, b), seed) <= boundary_tol:
                px[x, y] = (r, g, b, 128)

    sys.stdout.write(
        f"  seed={seed} tol={tol} cleared={cleared}/{w*h} "
        f"({cleared/(w*h)*100:.1f}%)\n"
    )
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tol", type=float, default=22.0)
    ap.add_argument("--quality", type=int, default=75)
    ap.add_argument("--max-width", type=int, default=640)
    args = ap.parse_args()

    src = Image.open(args.input).convert("RGBA")
    sys.stdout.write(f"→ {args.input} {src.size} mode={src.mode}\n")

    keyed = flood_alpha(src, tol=args.tol)

    # Scale down for size budget: 80KB at reasonable quality generally
    # means ~640px wide for a 2:3 frame.
    if keyed.size[0] > args.max_width:
        new_w = args.max_width
        new_h = int(keyed.size[1] * (new_w / keyed.size[0]))
        keyed = keyed.resize((new_w, new_h), Image.LANCZOS)
        sys.stdout.write(f"  resized -> {keyed.size}\n")

    # webp with alpha.
    args.out.parent.mkdir(parents=True, exist_ok=True)
    keyed.save(
        args.out,
        "WEBP",
        quality=args.quality,
        lossless=False,
        method=6,
        exact=False,
    )
    size = args.out.stat().st_size
    sys.stdout.write(f"✓ wrote {args.out} ({size} bytes)\n")

    # Auto-reduce quality if over 80KB.
    q = args.quality
    while size > 80 * 1024 and q > 15:
        q -= 10
        keyed.save(args.out, "WEBP", quality=q, lossless=False, method=6, exact=False)
        size = args.out.stat().st_size
        sys.stdout.write(f"  re-encoded @ q={q} -> {size} bytes\n")

    # If still over budget, downscale iteratively.
    current = keyed
    while size > 80 * 1024 and current.size[0] > 320:
        new_w = int(current.size[0] * 0.85)
        new_h = int(current.size[1] * 0.85)
        current = current.resize((new_w, new_h), Image.LANCZOS)
        current.save(args.out, "WEBP", quality=q, lossless=False, method=6, exact=False)
        size = args.out.stat().st_size
        sys.stdout.write(f"  downscaled -> {current.size} @ q={q} -> {size} bytes\n")


if __name__ == "__main__":
    main()
