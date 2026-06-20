# Elysian Cathedral — Art Style Scaffold

The house style for all card art: **stained-glass, cel-shaded, gothic-cathedral
window illustration.** This style is our own and is carried forward unchanged.
What changes from the legacy art is **the subject** — every subject must be an
original design, never a depiction of an existing franchise's character, item,
creature, or location.

## Authoring rules (read before writing any brief)

1. **Style stays, subject is original.** Keep the cathedral-window scaffold
   below verbatim in spirit. Invent the subject from `original-design-bible.md`.
2. **No franchise references — anywhere.** Strike every "iconic", "legendary",
   "Legend of <X>", "the famous", and any phrasing that points at a real
   property's design. A brief must never instruct the model to make something
   "recognizable as" any existing character. If a sentence only makes sense
   because the reader knows another game, delete it.
3. **Describe form from first principles.** Give silhouette, materials, palette,
   pose, and composition as if the creature/object never existed before — because
   in our world it didn't. Do not describe "X but recolored."
4. **Generic archetypes are fine; specific designs are not.** "A hooded peddler",
   "a multi-headed wyrm", "a reflective tower shield" are generic and allowed.
   Copying the *specific* look of a named character/item is not.
5. **The gilding motif unifies the bestiary.** Per the world bible, the caged
   Embertide's overflow *gilds* hostile creatures — cracked gold-gilt corrosion
   creeping over the form, hairline gold fracture-lines, a faint amber inner glow.
   This is our ownable, original visual signature; lean on it for monsters.

## The scaffold (slot the subject into `<SUBJECT>`)

### Card portrait — monster / hero / item (square 1:1)

> Stained glass cathedral window illustration, square 1:1 format, in the **Elysian
> Cathedral** card-art style: gothic pointed arch frame with leaded stone pillars
> left and right, trefoil/quatrefoil cornices in the arch spandrels, gold-leaf
> filigree inner border `<TIER TREATMENT>`. Subject: `<SUBJECT — original form,
> silhouette, materials, pose, ~60–70% of arch height, centered>`. Background:
> stained-glass panels in `<PALETTE>` arranged `<MOTIF>` behind the subject, thick
> dark leading lines separating segments, painterly tone variation within each
> pane. `<LIGHTING>`. Colors permitted: `<EXPLICIT COLOR LIST>`, dark-leading-outline.
> No text, no letters, no captions, no watermarks, no UI overlays — just the
> stained-glass panel filling the square canvas.

**Tier treatments** (ornamentation density signals card rarity):
- regular enemy — plain leaded border
- wild boss — extra ornamental flourish, denser leading
- region boss — rose-window motif, densest composition, gold-leaf rose in upper arch
- hero (supply) — carved-marble pillars + gold-leaf rose-window tier per supply rank

### Combat background (landscape 16:9)

> Painterly Elysian-Cathedral illustration, landscape 16:9, `<LOCATION — original
> interior/exterior>`. `<FOREGROUND/MIDGROUND/BACKGROUND composition>`. The
> lower-center is an **OPEN CLEAR STAGE** — no creatures, no figures, no text, no
> UI, no banners — it reads as a battlefield the UI sits on top of. Peripheral
> elements are in cool shadow, noticeably darker than the center stage. Overall
> brightness dimmed to ~30–40%. Palette: `<HEX-ANCHORED COLOR LIST>`. Soft
> anti-aliasing, no hard UI edges. No text, no letters, no watermark, no logos.

### Boss door (portrait)

> Stained-glass cathedral door illustration, `<original architectural motif for
> the zone>`, two keyhole sockets, `<materials + palette>`, leaded-glass tympanum
> above. No text, no watermark.

## Per-brief frontmatter (keep this metadata block)

```
# <asset_key>
- **Card / subject:** <id> — <one-line gameplay role>
- **Model:** fal-ai/nano-banana-pro
- **Params:** aspect_ratio=<1:1|16:9>, output_format=webp, resolution=2K, num_images=1
- **Raster:** public/illustrations/<asset_key>_001.webp
- **Spec:** src/illustration/examples/<asset_key>.json
## Prompt
<the scaffold, filled in>
```
