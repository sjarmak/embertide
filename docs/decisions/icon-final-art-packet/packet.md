# Icon final-art decision

See [contact-sheet.png](./contact-sheet.png). It shows the actual SVG components at the sizes and on the Cathedral surfaces used by the game.

## 1. Which icons carry the placeholder marker?

The entire 14-icon set is marked, not a subset: **GreenShard, RedShard, Key, Heart, Sword, Shield, Hero, Monster, Chest, Boss, WisdomShard, CourageShard, PowerShard, and Magnifier.** The file itself calls the set placeholders (`src/icons/index.tsx:15-18`), and each component carries the marker: GreenShard (`:83`), RedShard (`:125`), Key (`:158`), Heart (`:203`), Sword (`:242`), Shield (`:285`), Hero (`:337`), Monster (`:375`), Chest (`:424`), Boss (`:474`), WisdomShard (`:532`), CourageShard (`:561`), PowerShard (`:590`), Magnifier (`:626`). The icon test also enumerates all 14 and requires the marker on every export (`src/icons/index.test.tsx:22-42`, `:53-62`).

## 2. Where can a marked icon actually appear in normal play?

Nine are reachable. **GreenShard, Sword, Chest, and Key** appear in the player tray (`src/ui/PlayerTray.tsx:95-125`). GreenShard, Sword, and Key also appear on costs (`src/ui/CostBadge.tsx:29-59`). **GreenShard, Sword, Key, Heart, WisdomShard, CourageShard, and PowerShard** appear inside card rules text (`src/ui/effectText/icons.tsx:21-42`; insertion at `src/ui/effectText/tokens.tsx:55-89`). Heart appears in non-card chest rewards (`src/ui/ChestReveal.tsx:148-160`, `:248-255`). Sword appears in boss attack intent (`src/ui/CombatBossStage.tsx:198-205`). Chest marks attached-chest cards (`src/ui/CardTemplate.tsx:172-179`). **Magnifier** appears on market and always-available card detail buttons (`src/ui/Field.tsx:188-202`; `src/ui/AlwaysAvailableRow.tsx:249-263`).

Five are not reachable in a valid current run: **RedShard has no production caller. Hero, Shield, Monster, and Boss exist behind safety-net fallbacks, but real art always wins.** Card art checks illustrations first (`src/ui/CardArt.tsx:412-433`), and its role-art table covers every current role (`src/ui/CardArt.tsx:173-192`; role list at `src/types/card.ts:39-64`). The boss portrait's icon is behind the always-present mini-boss illustration (`src/ui/CardArt.tsx:471-487`). Chest reward branches name Hero and Shield (`src/ui/ChestReveal.tsx:157-168`), but card rewards carry a real card (`src/store/slices/chests.ts:176-191`) and therefore render its CardTemplate instead (`src/ui/ChestReveal.tsx:69-74`, `:220-254`).

## 3. If these are FINAL, what changes?

Promote the existing set without redrawing it: remove the 14 `data-hc-placeholder` attributes and change the header/status language in `src/icons/index.tsx:2-18` and the shard migration wording at `:511-518`; change the all-exports test from “must be a V-3 placeholder” to “must not carry a placeholder marker” (`src/icons/index.test.tsx:53-62`) and update its stale V-3 wording (`:79-81`); update the outdated explanation that source placeholders may remain (`scripts/verify-no-placeholders.mjs:4-10`) while leaving the scanner itself intact (`:19`, `:61-75`). Then build and run the no-placeholder gate. **Players see no visual change afterward**: only status metadata, comments, and the test expectation change.

## 4. If these are PLACEHOLDERS, what art is still owed?

**Fourteen final vector glyphs are owed:** GreenShard, RedShard, Key, Heart, Sword, Shield, Hero, Monster, Chest, Boss, WisdomShard, CourageShard, PowerShard, and Magnifier. Replace the SVG drawing content while preserving the component names and their `size`, `title`, and `tint` interface (`src/icons/index.tsx:21-30`). Keep each marker until its replacement is approved; the production gate is intentionally designed to reject any remaining marked icon (`scripts/verify-no-placeholders.mjs:61-75`).
