# Render Contract

## Invariants

- `viewBox="0 0 24 24"`
- light from top-left only
- one leading family
- one primary fill family
- one secondary fill family
- optional one shade family
- one highlight family
- optional ornament overlay

## Layer order

1. leading
2. fill-primary
3. fill-secondary
4. shade (optional)
5. raster (optional — painterly fill of the illustration cell when `rasterImageUrl` is set)
6. highlight
7. ornament

## Readability thresholds

At 24px:

- silhouette must remain identifiable
- focal element must remain identifiable
- no micro text or faux runes
- eyes, jewels, and voids must remain visually distinct

At 36-48px:

- ornament may add richness
- segmentation may become more apparent
- frame motifs may read clearly

## Themeability rule

Themes may change:

- segmentation preference
- ornament preference
- token mapping
- archetypal motifs

Themes may not change:

- overall layer grammar
- highlight direction
- readability constraints
- requirement for explicit lead/cell structure

## Hero art rule

Hero illustrations should feel:

- noble
- centered or intentionally poised
- legible as a figure, not a collage

## Monster art rule

Monster illustrations should feel:

- unstable
- threatening
- biased toward silhouette tension
- more asymmetrical unless deliberately ritualized
