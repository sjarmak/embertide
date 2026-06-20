#!/usr/bin/env python3
"""gen-altar-frames-v2 — regenerate the wild + region altar frame rasters
with clean alpha channels.

Original strategy (intended path): prompt nano-banana-pro with a PURE BLACK
background and chroma-key it out. Preserved below in --mode=regen. If FAL
balance is exhausted, fall back to --mode=cleanup which aggressively removes
checker-pattern transparency-indicator residue from the existing rasters.

The checker residue leaked through u-10c's BFS flood-fill because interior
pockets of grey/white checker pixels were bounded by opaque ornament
details the BFS could not reach. Those residue pixels share a distinctive
signature: fully opaque, pure-grayscale (R≈G≈B), and bright (value >= 180).
Legitimate stone ornament is either saturated (from moss/gold/lighting)
or dark (deep shadow) — so a saturation+value threshold cleanly separates
checker from content.

Usage:
  FAL_API_KEY=... python3 scripts/gen-altar-frames-v2.py --mode=regen --variant=both --backend=fal
  python3 scripts/gen-altar-frames-v2.py --mode=regen --variant=both --backend=comfyui
  python3 scripts/gen-altar-frames-v2.py --mode=cleanup --variant=both

The comfyui backend expects a ComfyUI server running at COMFYUI_URL
(default http://127.0.0.1:8188) with Flux.1-dev weights + ae.safetensors
+ t5xxl + clip_l installed. See scripts/_comfyui_client.py for the
workflow template + substitution contract.
"""

from __future__ import annotations

import argparse
import io
import logging
import os
import sys
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("gen-altar-frames")

REPO_ROOT: Final = Path(__file__).resolve().parent.parent

WILD_PROMPT: Final = (
    "Ornate cathedral-style altar frame illustration against a PURE BLACK "
    "BACKGROUND: carved stone arch with Embertide of Courage motif at apex, "
    "ivy creeping along the sides, two unlit ornamental torch sconces at "
    "base, gold and deep green muted palette, stained glass accents in "
    "green and gold, dramatic side lighting, no central content (empty "
    "archway — the interior of the arch is also pure black background), "
    "portrait aspect 2:3 composition, high detail, 2K resolution"
)

REGION_PROMPT: Final = (
    "Ornate cathedral-style altar frame illustration against a PURE BLACK "
    "BACKGROUND: heavier carved stone arch with Embertide of Power motif at "
    "apex, obsidian flourishes, two LIT ornamental torch sconces at base "
    "with small flame glow, gold and deep crimson muted palette, stained "
    "glass accents in gold and red, dramatic side lighting, no central "
    "content (empty archway — the interior of the arch is also pure black "
    "background), portrait aspect 2:3 composition, high detail, 2K resolution"
)

VARIANTS: Final = {
    "wild": {
        "prompt": WILD_PROMPT,
        "out": REPO_ROOT / "public" / "illustrations" / "cathedral_altar_frame_wild_001.webp",
    },
    "region": {
        "prompt": REGION_PROMPT,
        "out": REPO_ROOT / "public" / "illustrations" / "cathedral_altar_frame_region_001.webp",
    },
}

MAX_WIDTH: Final = 640
SIZE_BUDGET: Final = 80 * 1024

# Cleanup thresholds (tuned to checker-pattern residue).
# Pixels that are opaque (alpha > 200) AND pure grayscale (|R-G|,|G-B| < 6)
# AND bright (min channel >= 175) are treated as checker residue.
CHECKER_GRAY_TOL: Final = 6
CHECKER_MIN_VALUE: Final = 175

# Partial-opacity residue (alpha 30-200) pixels that are also grayscale and
# bright are likely anti-aliased checker edges — zero them too.
CHECKER_PARTIAL_ALPHA_HI: Final = 200


def regen_via_fal(prompt: str) -> bytes:
    """Dispatch to fal-ai/nano-banana-pro and return raw image bytes."""
    import fal_client
    import requests

    log.info("→ dispatching to fal-ai/nano-banana-pro (%d chars)", len(prompt))

    result = fal_client.subscribe(
        "fal-ai/nano-banana-pro",
        arguments={
            "prompt": prompt,
            "aspect_ratio": "2:3",
            "output_format": "png",
            "resolution": "2K",
            "num_images": 1,
        },
        with_logs=False,
    )

    images = result.get("images") or []
    if not images:
        raise RuntimeError(f"fal.ai returned no images: {result!r}")
    url = images[0].get("url")
    if not url:
        raise RuntimeError(f"fal.ai image has no url: {images[0]!r}")

    log.info("  fetching %s", url)
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def regen_via_comfyui(prompt: str) -> bytes:
    """Dispatch to a local ComfyUI server running Flux.1-dev and return
    raw image bytes. Produces the same 2:3 portrait aspect as the fal
    path (1024×1536) so downstream chroma-key + webp-encode logic is
    unchanged.
    """
    from _comfyui_client import generate_flux_t2i

    log.info("→ dispatching to local ComfyUI / Flux.1-dev (%d chars)", len(prompt))
    return generate_flux_t2i(
        prompt,
        width=1024,
        height=1536,
        steps=20,
        guidance=3.5,
    )


def clean_checker_residue(img: Image.Image) -> Image.Image:
    """Remove checker-pattern transparency-indicator residue.

    Target: opaque pixels that are pure-grayscale (desaturated) and bright.
    These are the checkerboard squares that leaked through u-10c's flood-
    fill. Legitimate ornament pixels are either saturated (colored stone,
    moss, ivy, gold, ruby) or dark (stone shadow), so this filter keeps
    genuine content intact.
    """
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    alpha = arr[..., 3]

    min_c = np.minimum(np.minimum(r, g), b)
    max_c = np.maximum(np.maximum(r, g), b)
    chroma = (max_c - min_c)

    is_grayscale = chroma <= CHECKER_GRAY_TOL
    is_bright = min_c >= CHECKER_MIN_VALUE

    # Fully opaque checker residue.
    residue_full = (alpha > 200) & is_grayscale & is_bright
    # Partially opaque checker residue (anti-aliased edges of checker).
    residue_partial = (
        (alpha > 20) & (alpha <= CHECKER_PARTIAL_ALPHA_HI) & is_grayscale & is_bright
    )
    residue = residue_full | residue_partial

    cleared = int(residue.sum())
    total = arr.shape[0] * arr.shape[1]
    log.info(
        "  checker residue cleared: %d px (%.2f%%) full=%d partial=%d",
        cleared,
        cleared / total * 100,
        int(residue_full.sum()),
        int(residue_partial.sum()),
    )

    new_alpha = alpha.copy()
    new_alpha[residue] = 0

    # Edge softening: after removing residue, soften any opaque pixel that
    # sits adjacent to newly-transparent pixels AND is itself mid-grey
    # (could be anti-alias edge). Drops them to half alpha.
    transparent_now = new_alpha == 0
    neighbour_transparent = np.zeros_like(transparent_now)
    neighbour_transparent[1:, :] |= transparent_now[:-1, :]
    neighbour_transparent[:-1, :] |= transparent_now[1:, :]
    neighbour_transparent[:, 1:] |= transparent_now[:, :-1]
    neighbour_transparent[:, :-1] |= transparent_now[:, 1:]

    edge_softening = (
        (new_alpha > 200)
        & neighbour_transparent
        & is_grayscale
        & (min_c >= 140)
        & (min_c < CHECKER_MIN_VALUE)
    )
    new_alpha[edge_softening] = np.minimum(new_alpha[edge_softening], 96).astype(np.uint8)
    log.info("  edge-softened %d px", int(edge_softening.sum()))

    arr[..., 3] = new_alpha
    return Image.fromarray(arr, mode="RGBA")


def chroma_key_black(img: Image.Image, tolerance: int = 28) -> Image.Image:
    """Mask near-black pixels to alpha=0 (for regen mode)."""
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    bg_mask = (r < tolerance) & (g < tolerance) & (b < tolerance)
    cleared = int(bg_mask.sum())
    total = arr.shape[0] * arr.shape[1]
    log.info(
        "  chroma-keyed black (tol=%d): %d / %d px (%.1f%%)",
        tolerance,
        cleared,
        total,
        cleared / total * 100,
    )

    alpha = arr[..., 3].copy()
    alpha[bg_mask] = 0
    arr[..., 3] = alpha
    return Image.fromarray(arr, mode="RGBA")


def encode_webp(img: Image.Image, out_path: Path) -> int:
    """Save webp, shrink until under SIZE_BUDGET. Returns final file size."""
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if img.size[0] > MAX_WIDTH:
        new_w = MAX_WIDTH
        new_h = int(img.size[1] * (new_w / img.size[0]))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        log.info("  resized -> %s", img.size)

    quality = 85
    img.save(out_path, "WEBP", quality=quality, method=6, exact=False)
    size = out_path.stat().st_size
    log.info("  wrote %s (%d bytes, q=%d)", out_path, size, quality)

    while size > SIZE_BUDGET and quality > 20:
        quality -= 10
        img.save(out_path, "WEBP", quality=quality, method=6, exact=False)
        size = out_path.stat().st_size
        log.info("  re-encoded q=%d -> %d bytes", quality, size)

    current = img
    while size > SIZE_BUDGET and current.size[0] > 320:
        new_w = int(current.size[0] * 0.85)
        new_h = int(current.size[1] * 0.85)
        current = current.resize((new_w, new_h), Image.LANCZOS)
        current.save(out_path, "WEBP", quality=quality, method=6, exact=False)
        size = out_path.stat().st_size
        log.info(
            "  downscaled -> %s q=%d -> %d bytes", current.size, quality, size
        )

    return size


def process_regen(name: str, prompt: str, out: Path, backend: str) -> None:
    log.info("=== %s altar frame (regen via %s) ===", name, backend)
    if backend == "fal":
        raw = regen_via_fal(prompt)
    elif backend == "comfyui":
        raw = regen_via_comfyui(prompt)
    else:
        raise ValueError(f"Unknown regen backend: {backend!r}")
    src = Image.open(io.BytesIO(raw))
    log.info("  raw: %s mode=%s", src.size, src.mode)

    keyed = chroma_key_black(src)
    encode_and_report(keyed, out)


def process_cleanup(name: str, out: Path) -> None:
    log.info("=== %s altar frame (cleanup) ===", name)
    if not out.exists():
        raise FileNotFoundError(f"source raster missing: {out}")
    src = Image.open(out).convert("RGBA")
    log.info("  input: %s mode=%s", src.size, src.mode)

    cleaned = clean_checker_residue(src)
    encode_and_report(cleaned, out)


def encode_and_report(img: Image.Image, out_path: Path) -> None:
    size = encode_webp(img, out_path)

    arr = np.array(img)
    a = arr[..., 3]
    opaque = int((a == 255).sum())
    transparent = int((a == 0).sum())
    partial = int(((a > 0) & (a < 255)).sum())
    total = a.size
    log.info(
        "  alpha: opaque=%.1f%% transparent=%.1f%% partial=%.1f%%",
        opaque / total * 100,
        transparent / total * 100,
        partial / total * 100,
    )
    log.info("  final: %d bytes", size)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", choices=["wild", "region", "both"], default="both")
    ap.add_argument("--mode", choices=["regen", "cleanup"], default="cleanup")
    ap.add_argument(
        "--backend",
        choices=["fal", "comfyui"],
        default="comfyui",
        help="regen backend: 'fal' (remote nano-banana-pro) or 'comfyui' "
        "(local Flux.1-dev server). comfyui is the default once the "
        "local stack is set up.",
    )
    args = ap.parse_args()

    targets = (
        [args.variant] if args.variant in VARIANTS else list(VARIANTS.keys())
    )

    if args.mode == "regen":
        if args.backend == "fal":
            key = os.environ.get("FAL_API_KEY") or os.environ.get("FAL_KEY")
            if not key:
                log.error("FAL_API_KEY not set (required for --backend=fal)")
                return 2
            os.environ["FAL_KEY"] = key
        for name in targets:
            cfg = VARIANTS[name]
            process_regen(name, cfg["prompt"], cfg["out"], args.backend)
    else:
        for name in targets:
            cfg = VARIANTS[name]
            process_cleanup(name, cfg["out"])

    log.info("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
