# Original Design Bible

New subjects for every asset whose legacy brief depicted a specific existing
design. Each entry gives an **original name**, gameplay role (unchanged), an
**original visual identity** built from first principles, and an explicit
*avoid* note so no one re-traces the old design. Rendered in the Elysian
Cathedral style (`elysian-cathedral-art-style.md`).

> The new names here are also the **rename-map additions** the codemod missed
> (the legacy hero/item names were never in `deip/term-map.mjs`). Once approved,
> they fold into the term-map so card data + filenames match the new art.

## The power-entity — the Embertide (relic art)

- **Was:** a triune relic of three golden triangles.
- **Original:** a single roaming current of living ember-light. In glass, a
  radiant off-center **whorl/spiral of molten gold** coalescing out of an
  ethereal blue-white field — like a captured aurora drawn into a coil. Never
  three triangles, never a geometric triad.
- **Used by:** `cathedral_altar_destiny_*`, the Gilded Cage rose-window, any
  "destiny/relic" frame.

## The villain — Vurmox, the Cagewright (`cagewright-vurmox` → `cagewright-vurmox`)

- **Role:** final region boss.
- **Original:** a gaunt, tall jailer-figure in **gilt-locked plate**, a belt-ring
  of small hanging cage-lanterns each holding one flickering stolen ember, a long
  **key-staff**, face hidden behind a gilded grille-mask. Reads as "the keeper who
  hoards light," regal and cold.
- **Avoid:** any beast-man / boar / warlord-of-conquest silhouette.

## Heroes (supply) — legacy NPC names → original characters

| Legacy id | New id / name | Original design (first-principles) |
|---|---|---|
| `coll` | `coll` — Coll the Packwright | wandering tinker-merchant under a towering brass-frame backpack of tiny drawers and swaying lanterns; goggles, ink-stained apron |
| `brammel` | `brammel` — Brammel, Cragkin Forgemaster | broad basalt-skinned smith with cooling-magma veins in the cracks, leather forge-kilt, a splitting-maul over one shoulder |
| `veylin` | `veylin` — Veylin of the Veiled | umbra sentinel in a layered slate shroud, a crescent glaive, a single painted eye-sigil on the brow-wrap |
| `wren` | `wren` — Wren the Mare-Keeper | pastoral herder with a corded braid and a young brightmane foal at her side, lantern on a crook |
| `sael` | `sael` — Sael the Lorekeeper | quiet umbra archivist, rune-tattooed forearms, a lantern-tipped staff, scroll-satchel |
| `pell` | `pell` — Pell the Hooded | sly travelling peddler in a deep beaked mask and patched cloak, a bulging wares-satchel of trinkets |
| `naerin` | `naerin` — Naerin, Maren Tideguard | finned tide-folk noble, coral diadem, a pearl-tipped trident, scaled mantle |
| `liel` | `liel` — Liel of the Sylvanwood | sylvani grove-keeper with bark-textured skin, a mantle of living leaves, playing a carved reed songflute |

*(Avoid for all: the specific face/costume of any existing game character. These
are archetypes — merchant, smith, watcher, herder — given new, original forms.)*

## Monsters that depicted specific designs

| Legacy id | New id / name | Original design |
|---|---|---|
| `hollow-effigy` / `hollow-effigy` | `hollow-effigy` — the Hollow Effigy | a faceless gilded mannequin-revenant in tattered wraps; a single seamed gold mask where a face would be, mismatched spectral limbs, hairline gold fracture-lines aglow. Its fight-gimmick (mimics your last hero) reads as a *blank* figure taking a crude gilt impression — never a specific silhouette |
| `knell` / `knell` | `the-knell` — the Knell | a tolling bell-spirit: a hovering cracked bronze bell as its body, two long chain-arms ending in striker-mauls, one resonance-rune glowing on the bell-face. Instrument is a **bell**, not a drum; no hands-and-eye motif |
| `aurogax` | `aurogax` — Aurogax, the Three-Crowned Wyrm | a gilt-corrupted serpentine wyrm, three ash-scaled heads each ringed by a crown of gilding-fracture; smoke curling from the jaws. Generic multi-headed wyrm, original head/crest design |

## Items that depicted specific designs

| Legacy id | New id / name | Original design |
|---|---|---|
| `aegis-pane` | `aegis-pane` — the Aegis Pane | a tower shield whose face is a panel of **leaded stained glass** (on-motif), throwing back light and spellfire; brass frame |
| `grapnels` | `twin-grapnels` — the Twin Grapnels | paired wrist-mounted harpoon-gauntlets with coiled cord (distinct from the single grapplethorn) |
| `cinder-bloom` | `cinder-bloom` — the Cinder-Bloom | a volatile ember-veined seed-pod on a thorned stem, faint glow at the seams |
| `boomerang` | `returning-crescent` — the Returning Crescent | a curved throwing-blade with engraved flight-runes (boomerang is generic; just strip franchise framing) |
| `vital-ember` | `vital-ember` — the Vital Ember | a cupped glass reliquary holding a steady ember-flame (max-HP up); ties to the Embertide |
| `ember-shard` | `ember-shard` — the Ember Shard | a small chipped fragment of a Vital Ember reliquary |

## Locations to re-anchor (combat BGs / boss doors)

The renamed zones already exist; the briefs must describe **original** interiors,
not "the <named location> from <franchise>":

- **Gilded Cage** (`gilded-cage`) — the Cagewright's vaulted reliquary-hall:
  ranks of hanging cage-lanterns, a central pedestal where the caged Embertide
  whorl glows behind leaded glass. Not a marble "gilded-cage" sanctum.
- **Hollow Shrine** (`hollow-shrine`) — a lantern-lit underground ossuary-shrine,
  silver mist, no specific real-world shrine reference.
- **Dune Sanctum** (`dune-sanctum`) — a half-buried sandstone vault, gold dust.
