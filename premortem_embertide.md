# Premortem: Embertide

> Four failure-lens narratives from 3 months in the future. All four independently rated the same PRD as Critical/High likelihood of failure — each through a different mechanism.

**Method:** 4 independent agents, no shared context, each writing a failure narrative from a distinct lens (kid UX, game balance, scope overrun, IP/local-hosting).

---

## Risk Registry (sorted by score)

| # | Failure Lens | Severity | Likelihood | Score | Root Cause |
|---|---|---|---|---|---|
| 1 | Kid UX & Cognitive Overload | Critical | High | 12 | "One ruleset" decision — no true Kid Mode; classical-Aurelia primitives all land on 6yo at once |
| 2 | Game Balance & Emergent Dominance | Critical | High | 12 | Inventory escalator governs *purchased* items only; chest-granted items + Kakariko free Key bypass the cost curve |
| 3 | Scope Overrun & Velocity Collapse | Critical | High | 12 | Architecture-first (pure-TS engine + fast-check replay) before any vertical slice or playtest |
| 4 | IP Reality & Local-Hosting Collapse | Critical | High | 12 | Trademarked names baked into code identifiers + no threat model for inevitable leaks (cousin/phone/screenshot) |

**All four scored 12/12.** When every lens returns maximum risk independently, the PRD has a systemic fragility — not a single fix-it risk.

---

## Cross-Cutting Themes (high-confidence vulnerabilities)

### Theme A: Over-design relative to constraints *(all 4 lenses)*
Every lens independently concluded "there is too much in this PRD." UX says too many concepts for a 6yo; balance says too many interacting levers to tune; scope says too many systems to build in 4 weeks; IP says too many trademarked references to hide. The design ceiling is lower than the current scope on every axis.

### Theme B: "Organic discovery" fallacy *(UX + scope)*
Multiple lenses flag places where the PRD assumes a 6yo or player will "discover" systems on their own (post-first-game organic discovery, Song of Time self-use, chest strategy, Vurmox flavor). The kid-UX agent is unambiguous: organic discovery is a 9-year-old's advantage; it's a 6-year-old's abandonment.

### Theme C: Skin and mechanics conflated *(IP + balance + UX)*
IP agent says: rename all identifiers to role-based names. Balance agent says: the Kakariko faction bonus creates mechanical imbalance tied to flavor. UX agent says: Lens of Truth's private-info asymmetry is both a Nintendo-branded item AND a cognitive minefield. The skin layer and the rules layer aren't separable in the current PRD, which means any touch to either cascades into the other.

### Theme D: No vertical slice discipline *(scope, implicit in balance + UX)*
Scope agent calls it out directly (architecture-first killed the project). Balance needs playtest data to exist; UX needs teach sessions to exist. Without a vertical slice shipping by week 1, none of the other risks can even be measured, let alone mitigated.

---

## Mitigation Priority (multi-failure-mode coverage, cheapest first)

| Mitigation | Addresses | Cost | Urgency |
|---|---|---|---|
| **M1: Vertical slice week 1, defer engine purity** | Scope (C), Balance (C), UX (C) | Low | Immediate |
| **M2: True Kid Mode as default; Family Mode as toggle** | UX (C), Scope (H), Balance (M) | Low | Immediate |
| **M3: Cut all "v0.2 organic discovery" systems** (Blue Tokens visually, Korok if needed, Lens asymmetry) | UX (C), Scope (H) | Low | Immediate |
| **M4: Balance number fixes** (slot costs on chest items, Kakariko delay, Vurmox stir scales with player count) | Balance (C), UX (M) | Low | Immediate |
| **M5: De-brand entirely — "Relics of the Realm"** | IP (C), Scope (H), Balance (M) | Medium | **Strategic decision** |
| **M6: Separate skin from engine (theme.json + role-based identifiers)** | IP (C), Scope (M) | Medium | If not de-branded |

---

## Top 5 Design Modifications (recommended pre-build)

### 1. DE-BRAND OR STRICTLY SEPARATE SKIN *(highest-leverage decision)*

**IP agent's recommendation, supported implicitly by scope and balance:**

The "fan fiction, local-only" stance has **zero legal weight**. Nintendo's enforcement history includes *The Missing Link* (2024, crushed day-of-release), AM2R, Pokémon Uranium, PokéRogue, Garry's Mod asset purges, and the Palworld AI-art suit. The Embertide symbol is registered trademark USPTO 78245977. The first leak (cousin, Vercel preview, proud-parent screenshot) is catastrophic rather than survivable.

**Two viable paths:**

- **Nuclear (recommended):** Ship a generic high-fantasy skin. Three **Crown Shards** (not Embertide pieces). **Sunblade** (not Emberblade). **Forest Sprites** (not Koroks). Six kingdoms (not six Elysia regions). A **Dark Lord** (not Vurmox). Mechanics are 100% genre-generic and preserve a 6yo's learning gradient via universal fantasy archetypes (sword, shield, bow, dragon, castle). Unlocks distribution, app-store, portfolio, open-source. *The skin is where the risk is; the mechanics are safe.*

- **Strict skin separation:** Keep Aurelia names only in a local `theme.json` that is `.gitignored` and never deployed. Cards in code have role-based identifiers (`final-boss`, `legendary-weapon`, `forest-hero`). The engine repo is safe; the skin lives on one iPad. Accept that only the immediate household sees the Aurelia skin.

### 2. TRUE KID MODE AS DEFAULT

Not a UI reveal over the full game — a **structural subset**. Kid Mode ships as the default first game. Family Mode (the full current PRD) is a settings toggle.

**Kid Mode removes:**
- Lens of Truth / private-info asymmetry
- Blue Tokens (also removed from chest pool visually)
- 4-slot Inventory → 2-slot (Sword + Shield only)
- Song of Time target-selection → auto-targets leader
- Hearts→fragments→pieces assembly → whole hearts, 5 to win, no fragments
- Vurmox stir trigger → fixed appearance at turn 8 with explicit "this is a fight!" banner
- 6 regions → 3 regions (Forest / Mountain / Water) to reduce pick anxiety
- Koroks → optional setting (off by default for youngest kids)

Family Mode adds them back. One ruleset with subsystems gated by mode flag, not two codebases.

### 3. VERTICAL SLICE FIRST, ENGINE PURITY SECOND

**Drop MH-1 (pure-TS engine) and MH-2 (deterministic replay) from Must-Have to Should-Have.**

Week 1 ships: Zustand store, 15 cards, buy/fight/discard in-browser, no event log, no engine separation. First real 6yo playtest by day 5. Engine extraction becomes a v0.2 refactor once the game is proven to work as a game.

Hard weekly gate: end of each week, the game must be playable start-to-finish with the target user. Missed gate = automatic scope cut, not extension. The PRD's own "MVP cut sequence" is **pre-committed**, not reactive.

### 4. BALANCE NUMBER FIXES (pre-build)

From the balance lens's sim predictions:

- **Slot costs apply to ALL items entering slots**, including chest-granted (closes the #1 snowball hole).
- **Kakariko starter bonus:** "+1 Key after your 2nd turn" (not starting) — delays the free open past the first-game UI reveal and tempo window.
- **Vurmox stir threshold scales by player count:** 8 hearts at 2p, 12 at 3p, 16 at 4p. Keeps him late-game in all modes.
- **Chest pool rebalance:** drop Embertide-fragment weight 10%→6%; raise Heart weight 40%→44%; remove Blue Token slot entirely (cut from v0.1).
- **Song of Time re-slot cooldown:** leader cannot re-slot the returned item until end of their next turn.
- **Implement chest pity floor** (after 3 chests without a piece, next ≥Hero-tier) — already noted as mitigation but must ship v0.1.

### 5. CUT AGGRESSIVELY — PRE-COMMIT, NOT REACTIVE

Treat these as cut in v0.1 immediately, rather than waiting for velocity to slip:

- Save/resume mid-game
- Three bot difficulty tiers → one tier only
- Emberblade dual-trigger logic → simple Item card, in Field at fixed turn
- Korok whimsy layer → post-MVP
- Vurmox stir logic → fixed turn appearance
- Hand-drawn art → AI-gen / emoji placeholders

Preserved must-haves: hearts-to-win, chests+keys, 2-currency, inventory, First-Game reveal (simplified), ~20 cards (not 45).

---

## Full Failure Narratives (for reference)

### Lens 1 — Kid UX & Cognitive Overload

**Saturday morning, April 18th.** Dad pulled up Embertide on the iPad; six-year-old Maya was already bouncing because the splash said "Aurelia." The 2-minute teach started fine — Maya picked Sylvanwood ("I'm the forest one!"), saw her green shards, and on turn 1 bought a Scrabling fight. Then the cognitive stack started to tower. Green vs Red vs Keys vs Blue Tokens ("what are the blue ones for, Daddy?") vs hearts vs Embertide fragments vs Song of Time (glowing) vs 4 Inventory slots vs Koroks vs Vurmox's looming 10r+Key cost. The First-Game reveal hid Items until turn 4 — but the moment it appeared, Dad had to pause play to explain four slots with escalating costs, breaking the rhythm.

Turn 6 was the breakdown. Older brother Eli (9) had Lens of Truth and could silently see every chest's contents. Maya didn't understand why he kept "knowing" which chests to skip. She opened a Medium chest with her hard-earned Key and rolled a Blue Token — a reward the PRD admits has "no current use in v0.1." Her face collapsed. Next refill, Korok leaf animated; Eli tapped it in 180ms while Maya was still counting "2 of 3 hearts → next piece." Then Vurmox surfaced; banner said "Vurmox has awakened!" which Maya read as the game being over, not a fight. She had 1 piece, 2 loose hearts, 0 Keys. Dad tried to hand his Song of Time to Maya to use on Eli; rules don't allow that. Maya slid the iPad away: "I don't want to play the Aurelia one anymore." They played Uno every Saturday after.

**Root cause:** The "one ruleset" decision — refusing to ship a true Kid Mode in favor of a UI-reveal overlay — guaranteed every classical-Aurelia primitive would eventually hit the 6yo's working memory simultaneously.

### Lens 2 — Game Balance & Emergent Dominance

The "Kakariko Key-Rush" became the only strategy anyone talked about by late June. Kakariko's +1 starting Key meant the Umbra player walked into turn 2 able to crack a chest before anyone else had seen the Item row. With chests at 25% of the deck and a 40% Heart / 10% Fragment / 5% Emberblade-trigger reward pool, the free turn-2 open yielded 0.4 hearts + 0.033 pieces + 25% chance of an Item. Chest-granted Items went into the 4g slot 1 well before the 5/6/8g escalator bit, so the dominant player never actually paid the inventory tax the PRD relied on. Lens of Truth at 5g let them cherry-pick subsequent chests — eliminating variance for the leader while others ate it raw.

Across a 5,000-game sim, 61% of 4-player games had Kakariko in top two by turn 5; Lens-of-Truth by turn 6 correlated with 78% win rate. Vurmox timing went bimodal: 4p surfaced him at turn 5 (Emberblade not yet triggered, only Kakariko leader could afford 10r+Key — game over in 12 min); 2p didn't stir until turn 11+ (35-minute sessions, trailing player mathematically couldn't catch up). Song of Time became ritualistic — in 4p played on turn 2-3 against Kakariko's first Item, re-slotted next turn (escalator hadn't kicked in), never fired again. Simultaneously too weak and too rarely triggered.

**Root cause:** The inventory escalator governs *purchased* Items but not *chest-granted* Items, while Kakariko's +1 starting Key bypasses the entire cost curve — a single balance interaction never sim-tested before lock.

### Lens 3 — Scope Overrun & Velocity Collapse

The project bled out on the pure-TS event-sourced engine. MH-1 + MH-2 (pure reducer, seeded RNG, fast-check on 10k sequences) devoured ~18 person-days across weeks 1-2. Fast-check kept finding real nondeterminism — the chest RNG pulled from `Math.random` in one codepath and the seeded RNG in another; Korok marker selection leaked wall-clock time into the seed. Every fix rippled: Vurmox's reshuffle-to-surface broke replay; 3-hearts-auto-snap was order-dependent across concurrent effects. End of week 2: engine passed property tests, zero cards authored, no UI.

Week 3 became Framer Motion hell. Chest-open animation consumed 9 person-days (MH-8's "Apple Arcade polish bar"). Korok tap-to-find (<200ms forgiveness, turn-order tiebreak, 5s glow) was a two-week rabbit hole of pointer-event races. First-Game UI reveal state machine got its own Zustand slice and persistence-resume edge cases. Week 4, nominal ship: debugging Song of Time glow/vibrate interacting with turn-handoff wall. Week 6: 22 of 45 cards existed as data, 8 rendered, bot was stubbed. Weeks 7-12: death march, nothing connected, Vurmox surfaced but sudden-death never wired, bot archetype never tuned (no playable game to tune against). Zero 6yo ever touched it. Burnout week 10. Shelved week 12.

**Root cause:** Committing to pure-TS event-sourced engine with fast-check replay as a week-1 deliverable before any card was playable end-to-end.

### Lens 4 — IP Reality & Local-Hosting Collapse

By week 6 the "local only, fan fiction" stance had already cracked three times without the developer noticing. Engine repo went to GitHub (nominally private, but files named `vurmox.ts`, `emberblade.ts`, `koroks.ts` and AI-gen pixel art in the Link's Awakening DX style). The niece's cousin visited; dev pushed a Vercel preview "just for the weekend" because iPad Safari was easier to test via real URL than `localhost`. A playtest clip of the niece shouting "I got the Embertide!" hit r/Aurelia, 4,800 upvotes in 14 hours. Vercel URL visible in the corner. By Monday the thread's top comment linked the GitHub repo.

DMCA from Nintendo of America, identical to the ones that killed *The Missing Link* (March 2024), AM2R (2016, one day after release), Pokémon Uranium (2016), PokéRogue + Pokémon MMO 3D (September 2024), and the Garry's Mod Nintendo asset purge (2024). Vercel pulled in 48 hours. AI-generated art was the aggravating factor — post-Palworld Nintendo enforcement treats AI-gen character likenesses as commercial-grade trade-dress infringement, not fan art. The Embertide is registered trademark USPTO 78245977. C&D demanded destruction of all assets.

~180 hours of engine work, a working 3-player hotseat, a tuned bot, First-Game reveal UI, Song of Time, 45 hand-tuned cards — none could be shipped, shared, demoed, or kept as portfolio. Niece asked for months why she couldn't play "the Embertide game." The mechanics were generic and salvageable, but skin and engine were never separated; de-branded rebuild took another four weekends.

**Root cause:** Treating "local only, no distribution" as a legal shield rather than a social convention that breaks under the mildest pressures (cousin, phone, screenshot), while baking Nintendo's most aggressively-enforced trademarks directly into card identifiers and AI-generated trade dress.

---

## Confidence Assessment

- **High confidence** on all 4 risks. Independent agents converged on the same "over-designed for constraints" meta-finding from different angles.
- **Highest-leverage single decision:** the de-brand / skin-separation call (M5). Every downstream decision is cheaper once the IP question is resolved.
- **Lowest-cost high-impact decision:** vertical slice week 1 (M1). Process change, no code yet.
- **Most contentious:** cutting Koroks, Lens of Truth, Vurmox stir, Emberblade trigger — these are the whimsy and flavor layers the user *just added*. Honest tension: the classical-Aurelia fidelity the user wanted and the 4-week-solo-MVP reality are in direct conflict.
