# PRD: Realm Ascension (v3 — premortem-applied)

> Working title **"Realm Ascension"** (project directory remains `embertide` for continuity; public-facing name de-branded). A 2–4 player (plus solo-vs-bot) Aurelia-inspired deckbuilder based on Ascension's skeleton. Locally hosted browser game, iPad-first touch UX. Playable by a 6-year-old after a 2-minute teach. Target session 20 min.
>
> **Design principle:** classical Aurelia vocabulary only (mechanics appearing across the franchise's 37-year span). No BotW/TotK-only primitives (shrines, fusion). Post-premortem: IP skin is user-experience layer only; code and deployment are IP-safe.

**Pipeline status:** `/diverge` → `/converge` → `/premortem` complete. v3 PRD incorporates all 4 premortem risk mitigations. Ready for `/prd-build`.

---

## Premortem Decisions Applied

| Risk Lens | Original Status | v3 Mitigation |
|---|---|---|
| Kid UX cognitive overload | Critical/High | **Kid Mode as default structural subset**; Family Mode as toggle. No longer a UI reveal over the full game. |
| Game balance emergent dominance | Critical/High | **Six balance number fixes applied** (see §Balance Fixes). Slot costs apply to chest-granted items. Kakariko key delayed. Vurmox stir scales by player count. |
| Scope overrun / velocity | Critical/High | **Vertical slice week 1.** Pure-TS engine + event-sourced log demoted MH→SH. React+Zustand direct; engine extraction is v0.2. Card count ~22 Kid / ~42 Family. Pre-committed cut list. |
| IP / local-hosting collapse | Critical/High | **De-branded public name** (Realm Ascension). **Role-based code identifiers.** Aurelia-flavored display text via local `theme.json`, gitignored. No Vercel, no public repo, no off-household sharing. AI-art prompts use generic descriptors. |

---

## Decisions Locked

| # | Tension | Decision | Classical grounding |
|---|---|---|---|
| 1 | Signature mechanic | **Treasure Chests & Keys** | 1986, every game |
| 2 | Mode split | **Kid Mode default + Family Mode toggle** (structural, not UI) | — |
| 3 | Victory | **Family: 3 Embertide pieces** / **Kid: 5 whole hearts** | 1986 |
| 4 | Currencies | **2 shard colors** (Green/Red) | — |
| 5 | Catch-up | **Song of Time** (Kid: auto-targets leader; Family: player-chosen target) | OoT 1998 |
| 6 | Endgame boss | **Vurmox** (Kid: fixed turn 8; Family: heart-scaled stir) | 1986 |
| 7 | Signature item | **Emberblade** (Kid: fixed-turn Item / Family: gated) | 1991 |
| 8 | Whimsy | **Koroks** (Family-only; cut from Kid) | 2002 WW |
| 9 | Revealer item | **Lens of Truth** (Family-only; cut from Kid) | OoT 1998 |
| 10 | Regional flavor | **3 Regions Kid / 6 Regions Family** | 1986 onward |
| 11 | Fusion | **Cut** (TotK-only recency) | — |
| 12 | Shrines | **Cut** (BotW/TotK-only recency) | — |
| 13 | Engine architecture | **Vertical slice first**; pure-TS engine = v0.2 refactor | — |
| 14 | Name | **Realm Ascension** (internal codebase stays `embertide`) | — |

---

## Problem Statement

Ascension is a great deckbuilder but uses dense card text, abstract currencies, and honor-point VP — obstacles for a 6-year-old. A Aurelia skin alone does not solve accessibility. Realm Ascension keeps Ascension's shared-market draw-5 cadence but replaces its vocabulary with **classical Aurelia primitives** so a 6yo's existing associations do the teaching.

**The premortem pipeline exposed four correlated Critical/High risks.** V3 resolves them: the game ships as two modes (Kid default, Family toggle) sharing one codebase; the engine architecture is deferred; balance has six specific number fixes; and the project ships locally only with IP safety measures in code, not just policy.

The signature moment in both modes is opening a **Treasure Chest** with a hard-earned **Key**: the slot-machine thrill of a random classical-Aurelia reward. In Kid Mode, rewards are always safe and useful (hearts, Items). In Family Mode, the reward pool expands (Embertide fragments, Emberblade trigger, Blue Tokens).

---

## Goals & Non-Goals

### Goals
- 6yo takes an unassisted turn after a 2-minute teach (**in Kid Mode**).
- 15-minute Kid game / 20-minute Family game (±5 min tolerance).
- Every visible mechanic maps to a classical Aurelia fingerprint.
- Single-device iPad hotseat primary; solo-vs-bot first-class.
- Code identifiers are role-based; Aurelia skin is a local-only display concern.

### Non-Goals
- Distribution, monetization, app-store presence, public GitHub.
- Deployment to any remote host (Vercel, Netlify, Fly.io, etc.).
- BotW/TotK-only mechanics.
- Pure-TS engine extraction in v0.1 (deferred to v0.2).
- Cross-mode balance (Kid and Family are tuned separately).

---

## Kid Mode (DEFAULT — ships first)

The game that a 6yo plays unassisted on Saturday morning. Structural subset of Family. Fewer cards, fewer systems, simpler numbers.

### Core Loop
- 10-card starter deck per player: 7× Green Shard, 2× Red Shard, 1× Home Region Starter.
- Draw 5 → play all → buy from Elysia Field (6 cards face-up) → discard, end turn.
- Reshuffle when deck empties.
- **First to 5 whole hearts wins.** No fragments, no Embertide piece math.

### Currencies
- **Green Shards** — buy Heroes and Items.
- **Red Shards** — fight monsters.
- **Keys** — drop from every 3rd monster + every boss. Spend to open chests.
- **No Blue Tokens in Kid Mode.** (Removed from chest pool, removed from boss drops.)

### Card Types (Kid Mode set: ~22 cards)
1. **Heroes (7 unique):** Veylin (+2g + Key), Sidon (+2r), Aurelia (draw 2), Coll (+1g +1r), Wren (+1 heart on boss), Liel (play 2 Heroes), Brammel (+1r/kill).
2. **Items (4 unique + 1 special = 5):** Sylvani Sword (+1r on fights), Elysian Shield (ignore 1 damage), Bow (+1r on boss), Boomerang (+1r per 2 fights), **Emberblade** (+2r; appears at fixed turn 6).
3. **Monsters (6 unique + 1 boss = 7):** Scrabling (3r→1 heart), Brute (4r→1), Squidlet (3r→1), Bonereaver (5r→1+Key), Mini-boss Ashen Tyrant (7r+Key→2 hearts), Mini-boss Tidewraith (8r+Key→2 hearts), **Vurmox** (at fixed turn 8, 10r+Key → 2 hearts + game-end trigger).
4. **Treasure Chests (3 variants):** Small (1 Key → Heart or Hero, weighted 60/40), Medium (1 Key → Heart / Item / Hero, weighted 50/30/20), Big (2 Keys → Heart x2 or premium Item, 50/50). **No Embertide fragments, no Emberblade trigger, no Blue Tokens.**

### Inventory — 2 slots only (Kid)
- **Sword + Shield slots** only (Tool and Bow slots don't exist in Kid Mode).
- Slot 1 = 4g, Slot 2 = 6g.
- Full? → Swap (no fusion, no Blue Token).
- **Slot cost applies to chest-granted Items too** (balance fix).

### Song of Time (Kid Mode: auto-targeting)
- Each player starts with 1 token in a visible tray.
- Plays on your turn; **automatically targets the heart-leader and returns one of their slotted Items** (leader chooses which).
- No target selection required from the 6yo.
- When a player is 2+ hearts behind at turn start, their token **glows and vibrates** with on-screen prompt "Play Song of Time?".

### Home Regions — 3 options (Kid)
Each player picks 1 at setup. Gets one flavored starter card replacing Young Link.

| Region | Starter Card | Starter Bonus |
|---|---|---|
| **Sylvanwood** | Sylvani Slingshot (1r, +1 draw on play) | +1 card draw turn 1 |
| **Emberpeak** | Cragkin Hammer (1r, +1r vs fire monster) | +1 Red on first kill |
| **Tidehold** | Maren Fin (1g, discard-to-draw once/game) | +1 heart per chest opened |

### Vurmox (Kid: fixed-turn)
- Vurmox appears in the Elysia Field on **turn 8** (not heart-scaled). Clear, predictable.
- Banner: **"A Dark Hero Appears!"** with ominous but not-scary art.
- Cost 10r + 1 Key. Drops 2 hearts + game-end trigger (first player to 5 hearts in the next 3 turns wins; ties broken by most chests opened).

### First-Game UI (Kid)
- First run: UI hides the Item row for turns 1–2; 2-line tutorial appears turn 1 ("Buy heroes with green. Fight monsters with red. Win with 5 hearts.").
- Turn 3: Item row reveals, 1-line prompt.
- Turn 4: first chest surfaces naturally, 1-line prompt on Key usage.
- After first game: toggle off in settings.

### Cut from Kid Mode (re-added in Family)
- Blue Tokens
- Tool slot and Bow slot (inventory is 2 slots)
- Embertide piece victory + fragment assembly
- Lens of Truth + info asymmetry
- Koroks
- Fusion (already cut entirely)
- Vurmox heart-stir trigger (Kid uses fixed turn)
- 6 regions (Kid has 3)

---

## Family Mode (TOGGLE — unlocked after 2 Kid games completed, or via adult setting)

Everything in Kid Mode, plus:

### Additional Systems
- **4-slot Inventory** (Sword, Shield, Tool, Bow). Costs 4/5/6/8g, **all items pay the slot cost including chest-granted** (balance fix).
- **Embertide piece victory** — 3 pieces to win. Pieces from: boss kill (+1), chest (6% weight, down from 10%), hearts-assembly (every 3 hearts → 1 piece).
- **Blue Tokens** — drop from bosses; no in-v0.1 use yet; visually shown. Reserved for v0.2 Songs expansion.
- **Koroks** (2/game hidden on Field deck cards). 5-second glow; **per-player 3s lockout** on who taps first (balance fix from premortem).
- **Lens of Truth** — named Item; passive reveals chest contents **publicly** (all players see) — no private-info asymmetry (balance + UX fix).
- **Song of Time (Family)** — player-chosen target; leader **cannot re-slot the returned item until end of their next turn** (balance fix).
- **Vurmox (Family)** — heart-scaled stir trigger: **8 hearts at 2p, 12 at 3p, 16 at 4p** (balance fix).
- **Emberblade (Family)** — appears in Field once any player earns their 2nd Embertide piece, OR via chest at fixed 5% rate.
- **6 Home Regions** (adds Duneborn Desert, Kakariko Village, Elysia Field). Kakariko bonus: **"+1 Key after your 2nd turn"** (not starting — balance fix).

### Additional Cards (Family Mode adds ~20 for ~42 total)
- 7 more Heroes (Tingle, Brammel, Fi, Navi, Nabooru, Princess Naerin, Medigo)
- 7 more Items (Grapplethorn, Iron Boots, Lantern, Roc's Cape, Pegasus Boots, Songflute, **Lens of Truth**)
- 5 more Monsters + 2 more bosses (Chimera, Ashjaw, ReDead, Direwolf, Thorn Scrub; Bosses Broodmaw, Hextwins)
- 3 more Home Region cards (Duneborn, Kakariko, Elysia Field)

---

## Balance Fixes (v3, from premortem)

All six applied:

1. **Slot costs apply to ALL Items entering slots** (purchased OR chest-granted). Closes #1 snowball hole.
2. **Kakariko starter bonus:** +1 Key **after your 2nd turn** (not starting). Delays free-chest-open tempo.
3. **Vurmox stir (Family only) scales by player count:** 8h / 12h / 16h at 2p / 3p / 4p. Keeps late-game in all counts.
4. **Chest pool rebalance (Family):** drop Embertide fragment 10%→6%, raise Heart 40%→44%, remove Blue Token 5% slot (reroll Heart instead).
5. **Song of Time re-slot cooldown (Family):** leader cannot re-slot the returned Item until end of their next turn.
6. **Chest pity floor:** after 3 chest opens without a piece/Emberblade trigger, next open is guaranteed ≥Hero-tier. (Applies to Family only.)

---

## Tech Stack (v3 — vertical-slice-first)

| Layer | v0.1 Choice | v0.2+ refactor |
|---|---|---|
| Language | TypeScript 5+ | — |
| Frontend | React 19 + Vite | — |
| State | **Zustand, directly over card data** | Extract pure-TS reducer to `packages/engine/` |
| Animation | Framer Motion (time-boxed) | — |
| Gestures | `@use-gesture/react` | — |
| Persistence | Dexie (IndexedDB) for save/resume only | — |
| Testing | Vitest (no fast-check in v0.1) | Add fast-check property tests once engine is extracted |
| Event log / replay | **Not in v0.1.** | Added in v0.2 when engine is pure |
| LAN transport | **Stub interface only** | LAN via WebSocketTransport in v2 |
| PWA | `vite-plugin-pwa` — install to home screen; wake lock | — |
| Layout | Single Vite project, no monorepo | Split into monorepo when engine extracts |

### Bot (v0.1 shipping)
- ~50 lines of scripted greedy heuristic (buy highest-affordable premium card; fight highest-red monster; use Key on first available chest).
- Synchronous on main thread (no Web Worker in v0.1).
- No archetype commitment, no difficulty tiers in v0.1. **ONE** difficulty called "Hero."

### Bot (v0.2 deferred)
- Move to Web Worker; add archetype commitment + softmax; add Gentle/Fair/Tricky tiers.

### IP Safety (codebase layer)
- Card files named by role: `final-boss.ts`, `legendary-sword.ts`, `forest-sprite.ts`, `revealer-item.ts`.
- Aurelia display text lives in `theme.json` with keys like `final_boss.name = "Vurmox"`. This file is `.gitignore`d and loaded at runtime.
- AI-art prompts use generic descriptors ("pixel-art dark knight with fiery sword," not "Vurmox from Legend of Aurelia").
- No deployment to any public host.
- README declares single-household scope.

---

## Requirements

### Must-Have (v0.1 ships when all MH pass)
- **MH-1: Kid Mode plays start-to-finish in ≤20 min on iPad Safari 18+** (3-player hotseat or solo-vs-bot).
- **MH-2: 6yo playtest success.** Acceptance: one actual playtest, 2-min teach → unassisted turn, ≤2 rules interventions, reaches victory or graceful loss in 15–25 min.
- **MH-3: ~22 Kid Mode cards authored, balanced, renderable.**
- **MH-4: Icon-only cards, ≤10-icon vocabulary.** (Kid Mode uses a reduced icon set.)
- **MH-5: Bot plays to completion without stalls** (≤300ms turn latency with synchronous heuristic).
- **MH-6: Song of Time auto-targets leader; glow fires when 2+ hearts behind.**
- **MH-7: Home Region pick at setup** — 3 regions in Kid Mode; starter card enters deck correctly.
- **MH-8: First-Game UI flow works** — 3 turn-gated tutorial messages, then self-dismisses.
- **MH-9: Chest open → random reward → visible, satisfying reveal animation.** Time-boxed: 2 engineering days max on animation.
- **MH-10: Vurmox appears on turn 8 (Kid)** with banner; 3-turn endgame window fires.
- **MH-11: Slot costs apply to chest-granted Items** (balance fix).
- **MH-12: IP safety** — code identifiers role-based; Aurelia names only in `theme.json` which is gitignored. Vercel/Netlify detection in build script refuses to publish.

### Should-Have
- **SH-1: Family Mode (full current PRD) unlocks via settings or 2-Kid-games-played flag.**
- **SH-2: Pure-TS engine extracted to `packages/engine/` (v0.2).**
- **SH-3: Event-sourced action log + fast-check replay property test (v0.2).**
- **SH-4: Three bot difficulty tiers (v0.2).**
- **SH-5: Save/resume mid-game via IndexedDB.**
- **SH-6: Wake Lock holds 20 min.**

### Nice-to-Have
- **NH-1: LAN multi-device via WebSocket transport (v2).**
- **NH-2: Long-press = voice explanation for pre-readers.**
- **NH-3: Replay viewer.**
- **NH-4: Songflute Songs system (v0.2 second-signature layer).**

---

## MVP Cut Sequence (PRE-COMMITTED, not reactive)

If week-1 velocity slips below vertical-slice gate, these are ALREADY CUT (don't re-evaluate):

1. Family Mode entirely (ship Kid Mode only in v0.1; Family is v0.2)
2. Save/resume mid-game
3. Wake Lock integration
4. Any bot tier beyond "Hero"
5. Hand-drawn art (AI-gen/emoji placeholders only in v0.1)
6. PWA install-to-home (plain web app at localhost acceptable v0.1)

**DO NOT cut:** 2-min teach flow, Song of Time glow prompt, 2-slot Inventory, 5-heart victory, chests+keys, Home Region pick (3 options), role-based code identifiers, IP safety measures.

### Weekly Gate Protocol
End of each week: the game **must** be playable start-to-finish with the target 6yo user. Missed gate = automatic scope cut per list above, NOT schedule extension.

---

## Art / Asset Strategy

- **v0.1:** AI-generated placeholder art using generic fantasy prompts (no Aurelia prompt strings). Card templates via HTML/SVG.
- **v0.2+:** optional commissioned pixel art if project continues.
- Art style: pixel-art, 16-bit era (Link's Awakening DX / LttP-adjacent, but *generic fantasy-tavern-dungeon aesthetic*, not Aurelia-referenced).
- Local only; no CDN; no public URL.
- Skin (theme.json): Aurelia names/flavor loaded at runtime, never committed.

---

## Residual Risk Acknowledgment

Even with de-branded name and role-based code, residual IP risk remains:

- **Display-layer Aurelia naming** means any screenshot shared off-device shows Nintendo IP.
- **Parent/friend video of a child playing** captures "Emberblade" / "Embertide" text.
- **Theme file leak** (forgotten in a backup, synced via iCloud, etc.) exposes the skin.

The user has accepted this residual risk (preference for Aurelia-inspired components over nuclear de-brand). **Mitigation commitment from user:** no Vercel, no public GitHub, no screenshots shared outside household.

Risk reduction: Critical/High → High/Medium. Not eliminated.

---

## Open Questions

1. Koroks in Family Mode — 2 per game feels like a lot given per-player 3s lockout; reduce to 1?
2. Kid Mode Emberblade at fixed turn 6 — is that too early (turn 4 might still be a reasonable appearance)?
3. Should Vurmox Kid Mode fixed-turn be 8 or 10? Agent balance math assumed ~10 turns/game, so turn 8 = 80% through. If games run faster at 2p, might need earlier.
4. First-run flag — per-device or per-player-profile?
5. If the household has a 4yo and an 8yo, is Kid Mode still enjoyable for the 8yo? Or do we need a middle Family-lite?
6. Should the "A Dark Hero Appears!" Vurmox banner include audio? (Low-cost thematic hit.)
7. Theme.json loader — at build time (static) or runtime (dynamic swap)? Dynamic enables swapping to generic theme in one tap; static is simpler.

---

## Build Sequencing (week 1–4 target)

**Week 1 — vertical slice:**
- React + Vite + Zustand project
- ~15 Kid cards as JSON with role-based IDs + theme.json
- Buy/fight/discard loop working with placeholder CSS
- Single iPad hotseat, 2 players, play to 5 hearts
- **Day 5 gate: play one game with the 6yo. Learn.**

**Week 2 — Kid Mode completeness:**
- Remaining Kid cards (~22 total)
- Home Region pick screen + 3 regions
- Vurmox fixed-turn trigger
- Song of Time auto-target + glow prompt
- First-Game UI tutorial (3 prompts)
- Chest open flow + basic reveal animation
- **Day 10 gate: 6yo plays Kid Mode full game unassisted.**

**Week 3 — polish & bot:**
- Scripted greedy bot
- Framer Motion on chest reveal (≤2 days)
- Icon-only card polish
- Solo vs bot mode complete
- iPad touch-target pass
- **Day 15 gate: 6yo plays solo vs bot; parent watches and reports friction.**

**Week 4 — Family Mode (SH) or polish:**
- If Kid Mode is shipped and velocity holds: start Family Mode
- Otherwise: playtest iteration, tuning, animation polish
- **Day 20: v0.1 feature-complete OR Family Mode unlocked as SH-1.**

Engine extraction to pure TS (SH-2) begins v0.2 AFTER playtest data informs the refactor shape.

---

## Research Provenance

- `/diverge` — 5 lenses (prior art, math, kid UX, contrarian, tech).
- `/converge` — 3 positions (minimalist, authentic, engineer), 1-round advocacy.
- User correction — shrines + fusion cut for recency bias; classical Aurelia constraint adopted; koroks, chests, Vurmox, Emberblade, Embertide, Lens of Truth, Home Regions, lands added.
- `/premortem` — 4 lenses (kid UX, balance, scope, IP). All rated Critical/High. Four distinct paths to project failure identified.
- **v3 incorporates all 4 premortem mitigations**: structural Kid/Family mode split, vertical-slice-first engineering, six specific balance fixes, IP skin separation via theme.json + de-branded name.

**Ready for `/prd-build`** — pre-committed scope, pre-committed cut sequence, weekly gates, IP-safe codebase structure.
