#!/usr/bin/env python3
"""Strip the cream/grey halo baked into the princess-crystal PNGs.

The halo is fully-opaque (alpha=255) cream pixels around the crystal
silhouette. It comes in two flavors:

  1. Low-saturation cream / pink-tinted halo (sat < 90, brightness
     > 80) — covers both the cream halo body and the inner halo
     ring that picks up a pink tint from the crystal underneath.
  2. Yellow-cream boundary (G >= R, sat < 120) — picks up the
     halo→crystal transition pixels that sit slightly higher on the
     saturation scale than the cream body.

Saturated pink crystal walls (sat >= 100) are excluded. The dark
crystal outline has low saturation but very low brightness (~70) —
excluded by the brightness floor.

We mark every pixel that is either already transparent OR matches
the halo signature as eligible, then use connected-component
labelling to find the eligible region that touches the image border.
Only border-reachable pixels become transparent, so Aurelia's hair /
dress / skin (sealed inside the crystal silhouette) are preserved.

usage: strip-crystal-halo.py <input.png> <output.png>
"""
import sys
from PIL import Image
import numpy as np
from scipy.ndimage import label

if len(sys.argv) != 3:
    sys.exit("usage: strip-crystal-halo.py <input.png> <output.png>")

inp, out = sys.argv[1], sys.argv[2]
img = Image.open(inp).convert("RGBA")
arr = np.array(img)

rgb = arr[:, :, :3].astype(np.int16)
alpha = arr[:, :, 3]
R, G = rgb[..., 0], rgb[..., 1]
sat = rgb.max(axis=2) - rgb.min(axis=2)
brightness = rgb.mean(axis=2)

opaque_halo = (alpha > 0) & (brightness > 80) & (
    (sat < 90) | ((G >= R - 3) & (sat < 120))
)
eligible = (alpha == 0) | opaque_halo

labels, _ = label(eligible)
border_labels = set(labels[0]) | set(labels[-1]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)
border_mask = np.isin(labels, list(border_labels))

cleared = int(border_mask.sum()) - int((alpha == 0).sum())
arr[border_mask, 3] = 0
print(f"{inp} -> {out}: cleared {cleared} halo pixels")

Image.fromarray(arr, "RGBA").save(out, optimize=True)
