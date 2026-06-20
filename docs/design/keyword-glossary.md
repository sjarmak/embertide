# Keyword Glossary (single source of truth)

> **Status:** authoritative. This doc is the reference every other keyword/boss
> work unit cites (boss-state, combat, item, market, relic-construct, omen,
> health, arena, targeting, card-typing). Source of truth for content: designer
> drop `embertide-keyword-glossary-2026-05-02` and mechanics spec
> `embertide-game-mechanics-spec-2026-05-02`. If code and this doc disagree,
> fix whichever is stale in the same bead — keep them in lockstep.

## Locked rulings (do not contradict)

- **No Energy resource.** The "Energy 3/turn" line in the original glossary drop
  was speculative and is user-rejected (`embertide-energy-resource-rejected-2026-05-02`).
  The real combat-resource model is the existing `COMBAT_PLAYS_PER_TURN` per-turn
  play cap plus power-per-card damage. Activations that the old drop wrote with an
  Energy spend are written here as **Activate (once per turn): …** with no spend
  cost.
- **Card-text format is game-wide.** Every card uses the prefix form
  `Market — …` / `Combat — …` / `Omen — …`. A keyword is **bold** on first
  occurrence on a card, then plain shorthand thereafter.
- **One keyword = one idea.** No hidden state without an explicit visible counter.
  Every boss mechanic must read in ≤2 lines.
- **Dice = Omen only.** No d8/d20 or other dice keywords. Bosses and relics may
  roll dice separately, but the player-facing dice keyword is always Omen (d6).

Each entry below gives a **Rules** line (the precise definition) and a **Kid (6yo)**
line (the child-readable gloss used later by the A5 glossary UI surface).

---

## BOSS-STATE

- **Guarded** — Rules: the boss cannot take damage; may be conditional, e.g.
  "Guarded until [X]". Kid: "Can't be hurt right now."
- **Exposed** — Rules: the boss can take damage and takes `+X` bonus damage
  (default `X = 0`). Kid: "Open to hits — and hits hurt extra."
- **Cycle N** — Rules: at end of turn add 1 cycle counter; when counters reach
  `N` or more, remove all of them and trigger the cycle effect. Kid: "A timer
  counts up; when it's full, something happens."
- **Break N** — Rules: remove `N` break counters; used as a cost or a
  requirement gate. Kid: "Knock pieces off to make something work."
- **Layered** — Rules: the boss is multi-part; outer layers must be destroyed
  before inner ones can be damaged. May be explicit, e.g. "Shell 10 HP, Core 20 HP".
  Kid: "Break the shell before you can hit the inside."
- **Sequence** — Rules: the boss tracks action order and triggers effects on
  ordered conditions (e.g. Fire → Ice → Fire). Kid: "It does moves in a set order."
- **Adaptive** — Rules: the first repeated card type each turn has a `-X` effect
  (it resists you repeating yourself). Kid: "Doing the same trick twice works less."

## COMBAT

- **Attack X** — Rules: deal `X` damage. Kid: "Hit for X."
- **Block X** — Rules: prevent the next `X` damage this turn. Kid: "Stop X of the
  next hit."
- **Stun** — Rules: the target skips its next action. Kid: "It loses a turn."
- **Weaken X** — Rules: the target's next attack deals `X` less damage. Kid:
  "Its next hit is X weaker."
- **Vulnerable X** — Rules: the target takes `X` more damage from all sources
  until end of turn. Kid: "Hits on it do X more, this turn."
- **Multiattack N** — Rules: the attack resolves `N` times (against the same or
  split targets per the card text). Kid: "Hit N times."

## ITEM / AURELIA

- **Bomb** — Rules: removes **Guarded** on hit. Kid: "Blows the guard off."
- **Pierce** — Rules: ignores **Guarded** and **Block**. Kid: "Goes right
  through shields."
- **Grapplethorn** — Rules: target a specific layer/part (see **Layered**). Kid:
  "Grab one exact part."
- **Reflect** — Rules: prevent the next incoming damage and return it to the
  source. Kid: "Bounce the next hit back."
- **Reveal** — Rules: flip a hidden element to active (hidden → active). Kid:
  "Flip the secret face-up."
- **Disarm** — Rules: disable one of the target's abilities until end of turn.
  Kid: "Turn off one of its moves for the turn."

## MARKET

- **Shards +X** — Rules: gain `X` shards (market-only spending currency). Kid:
  "Get X coins to buy with."
- **Power +X** — Rules: gain `X` power (used to defeat center-row monsters). Kid:
  "Get X muscle to beat monsters."
- **Acquire** — Rules: pay shards to gain a card from the center row. Kid: "Buy a
  card from the row."
- **Defeat** — Rules: spend power to defeat a monster in the center row. Kid:
  "Spend muscle to beat a row monster."
- **Key** — Rules: a resource that opens chests. Kid: "Opens chests."
- **Open** — Rules: spend a key to take a chest reward. Kid: "Use a key to grab a
  chest prize."

## DICE / OMEN

- **Omen** — Rules: the single dice keyword umbrella. "When you play this, roll a
  d6 and apply the result." Outcomes are written as grouped ranges
  (`1-2 / 3-4 / 5-6`), **never** six separate outcomes. Three invariants:
  (1) no dead rolls — every face does something; (2) bounded variance — no wild
  `0-10` swings, prefer `2 / 3 / 4`; (3) no required-success — never "roll 5+ or
  nothing". Fits support heroes / utility / hybrid cards; avoid on core attack or
  required boss-tech (too swingy). Kid: "Roll the dice and see which good thing
  happens."
  - **Omen(Song) / Omen(Ancient) / Omen(Shadow)** — Rules: optional **cosmetic**
    flavor tags only; they change wording/theme, never the roll mechanics. Kid:
    "Just a flavor sticker — same dice."
  - **±1 soft control** — Rules: an optional upgrade, "You may adjust the result
    by ±1." This ships as a **relic-only** modifier, never printed on a card.
    Kid: "A special treasure lets you nudge the dice by one."

## RELIC / CONSTRUCT

- **Passive** — Rules: always active while the relic/construct is in play. Kid:
  "Always helping."
- **Activate (once per turn)** — Rules: an ability you may use once per turn, with
  no spend cost (no Energy). Kid: "Use it once each turn."
- **Start of Turn** — Rules: triggers at the start of your turn. Kid: "Happens
  when your turn begins."
- **End of Turn** — Rules: triggers at the end of your turn. Kid: "Happens when
  your turn ends."

## HEALTH

- **Heal X** — Rules: restore `X` HP (never above max). Kid: "Get X hearts back."
- **Ember Shard** — Rules: collect 4 to gain `+1` max HP and heal 1. Kid: "Find 4
  pieces for a new heart."
- **Vital Ember** — Rules: `+1` max HP and heal to full. Kid: "A whole new
  heart, and fill up."

## ARENA

- **Arena Effect** — Rules: a rule that applies to **both** players for the whole
  fight. Kid: "A rule that changes the fight for everyone."
- **Hazard** — Rules: an end-of-turn effect imposed by the arena. Kid: "Something
  bad happens at the end of each turn."

## TARGETING (strict phrasing)

Only these exact phrasings are allowed; no mixed wording.

- **target unit** — Rules: one chosen unit. Kid: "Pick one fighter."
- **target boss** — Rules: the boss specifically. Kid: "Pick the boss."
- **all enemies** — Rules: every enemy unit. Kid: "Every bad guy."
- **all units** — Rules: every unit on the field. Kid: "Everyone."
- **random enemy** — Rules: one enemy chosen at random. Kid: "A surprise bad guy."

## CARD-TYPING (sub-classification layer)

Top-level card types are: **Hero** (discard-deck cards with Market + Combat + Omen
sides), **Construct-Relic** (passive or activate), **Item** (Aurelia-feel:
Bomb / Grapplethorn / Aegis-Pane, etc.), and **Monster** (center-row, defeated with
Power). Layered on top of those is an additive sub-classification:

- **Attack** — Rules: primarily deals damage. Kid: "Mostly hits things."
- **Skill** — Rules: utility/effect without core damage. Kid: "Does a helpful
  trick."
- **Item** — Rules: a Aurelia-feel tool effect. Kid: "A gadget you use."
- **Engine** — Rules: generates resources or scales your economy over time. Kid:
  "Helps you make more stuff."
- **Tech** — Rules: an answer/counter to a specific situation. Kid: "A counter
  for a tricky spot."
- **Hybrid (rare)** — Rules: meaningfully spans two sub-classes at once. Kid:
  "Two kinds in one card."

## BOSS ARCHETYPES (six)

Every boss is `HP + State + Trigger Trackers + Phase Thresholds (75/50/25)`.
Phase rule: never introduce a **new** rule late — phases only remix existing ones.

- **Eye** (Broodmaw) — Rules: **Guarded** + **Cycle N** → becomes **Exposed** when
  the cycle triggers. Kid: "Wait for the eye to open, then hit it."
- **Item-Check** (Ashjaw) — Rules: only a specific item tag (e.g. **Bomb**)
  breaks the guard. Kid: "Need the right tool to get through."
- **Layered** (Talus / Helmaroc) — Rules: **Layered** shell → core; destroy outer
  before inner. Kid: "Break the outside before the inside."
- **Sequence** (Hextwins) — Rules: **Sequence** tracking (Fire → Ice → Fire);
  triggers fire on the ordered pattern. Kid: "It attacks in a set order."
- **Duel** (Dark Link) — Rules: **Adaptive**; resists repeated card types. Kid:
  "Mix up your moves or it copies you."
- **Swarm** (Gyorg / Odolwa) — Rules: minions; rewards AoE over single-target.
  Kid: "Lots of little enemies — hit them all at once."
