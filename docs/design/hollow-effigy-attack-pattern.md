# Hollow-Effigy Wild-Boss Attack Pattern Spec

> **Renamed 2026-04-25 (`embertide-xqjy`):** boss id `shadow-link` → `hollow-effigy`; tone shifted from OoT-style purple/indigo doppelganger to TotK gloom-corruption aesthetic (blackened body, gloom-tendrils, red-orange gloom-eyes). Mechanic — delayed-echo mirror — UNCHANGED; resolver id is now `hollow-effigy-mirror`.
>
> **Bead:** `embertide-gdd.2.4` (parent: `gdd.2` Hollow Shrine zone epic)
> **Predecessor ruling:** `bd memories embertide-designer-ruling-shadow-roster-2026-04-24` (hollow-effigy confirmed as Hollow Shrine wild boss; mirror/echo is the thematic core)
> **Predecessor draft:** `bd memories embertide-gdd-shadow-roster-hollow-shrine-dark-world`
> **Status:** Spec ready for `gdd.2` IMPLEMENTATION SEQUENCE step 3 (wild-boss card + attack pattern). This spec is a memo + design doc; no code changes here.
> **Decision authority:** orchestrator-resolved per parent delegation 'match our style + faithful to Aurelia + 6yo-palatable'. Designer may override before gdd.2 implementation lands.

## Decision summary

**Variant chosen: delayed-echo, max-power, with explicit one-turn telegraph.**

Each turn, hollow-effigy replays the *single highest-power play* the player made on the *previous* player-turn, dealing that much damage to player HP. The replay is announced one turn in advance via a HUD bubble so a 6yo can see what's coming and react.

| Property | Value | Notes |
|---|---|---|
| HP | **6** | matches `craghorn` (10), `boulderkin` (10), `sentinel` (10) wild-boss band; one notch lower because the mechanic adds difficulty without raw HP. |
| `damagePerTurn` (base) | **2** (fallback when no echo source) | applies on turn 1 (no prior play to mirror) and on any turn the player passed without a play. |
| `damagePerTurn` (dynamic) | **= max(2, lastPlayer.maxPower)** clamped at **4** | the hard cap is critical — see soft-clock §below. |
| `targeting` | `'player-hp'` | hollow-effigy is targeting Link directly (mirror fight); battlefield cards do NOT absorb. **NEW BEHAVIOUR** vs other wild bosses, which all use `'battlefield-then-player'`. |
| `onDefeatEffect` | `'wisp-drop'` (WISP_DROP constant in `bossAttackPatterns.ts`) | per wild-boss taxonomy in `bd memories embertide-v2-enemy-rosters-and-wild-region-boss`; matches every other wild boss. |
| Telegraph | HUD bubble + battlefield arrow on the player's just-played highest-power card | always shown the moment the player ends their turn; persists through the boss-turn animation. |
| Soft-clock | hand-cap exempted (player can't lose hand to echo); HP-cap clamps at 4 dmg/turn | REQ-16 envelope respected. |

## Why this variant (over the alternatives)

The bead listed three options:

| Option | Pros | Cons | 6yo verdict |
|---|---|---|---|
| Pure echo (copies last play immediately) | strongest narrative beat ("mirror") | every turn boss does *whatever just happened* — confusing cause/effect chain; hard to reason | ❌ poor — kid can't predict |
| Modified echo (power only, drop secondary effects) | cleaner math, single number to track | still no telegraph; the "what's about to hit me" surprise is on the SAME turn | ⚠ marginal — telegraph still missing |
| **Delayed echo (one turn out)** | telegraph visible the entire next turn; kid can plan around it; simple "max number you played → that's the hit" rule | adds a turn-of-state to the engine | ✅ **best** — predictable + dramatic |

A kid-6yo decision frame says: predictability > drama. The delayed echo turns the mechanic into a small puzzle — *"if I play my big-power card NOW, hollow-effigy will hit me back for that much. Maybe I save it until I have hearts to spare."* That's the design lesson the mirror-fight is supposed to teach (matches the canonical OoT hollow-effigy puzzle: don't fight the mirror straight-on).

## Mechanic walkthrough

### Turn 0 (combat enters)
- hollow-effigy spawns with HP 6, base dpt 2 in the queue.
- HUD shows a placeholder telegraph: *"Mirror-Echo: hollow-effigy will copy your strongest play next turn. (No prior play — base 2 damage.)"*

### Turn 1 (player turn)
- Player plays cards as normal (up to `COMBAT_PLAYS_PER_TURN`, currently 3).
- Engine tracks the *highest single-play power* across the turn — call it `lastPlayerMaxPower`. A `combat-draw` or `combat-bonus` play with no damage contribution is power 0; a `combat-attack 4` play is power 4. The `combat-attack-stun` effect counts its damage component.
- When the player passes / plays out, the engine snapshots `lastPlayerMaxPower` and stores it as `combat.echoQueue: { power: number; sourceCardId: string | null } | null` on the `CombatState`. (See §engine impact below.)
- HUD telegraph updates immediately: *"Mirror-Echo: hollow-effigy will hit P0 for {N} next turn!"* with the source card highlighted.

### Turn 1 (boss turn)
- hollow-effigy reads `combat.echoQueue`. If null OR power < 2, it does the base dpt 2 attack (`'player-hp'` targeting). If power >= 2, it does `min(power, 4)` damage to the active attacker (per the `attackerPlayerIds` routing convention; see `routePlayerHpDamage`).
- Damage clamped at 4 caps the worst case so a player who plays a heroic-effort craghorn-tusk `damage 4 + stunTurns 1` doesn't immediately get a 4-damage echo + a 1-turn-stun grace cycle (the echo is the heavy hit; the stun grace is what makes it survivable).
- Battlefield cards do NOT absorb (`'player-hp'` targeting, NOT `'battlefield-then-player'`) — the echo "mirrors" the player's play, so the player's defensive cards aren't in the way.
- After the boss turn resolves, `combat.echoQueue` is **cleared** so it doesn't double-fire next round.

### Turn 2+ (loop)
- Cycle repeats. Player plays → snapshot `lastPlayerMaxPower` → boss echoes next turn.
- Telegraph stays on screen across the player turn. The kid learns: *"big plays = big incoming damage. Stagger or save."*

### Edge cases

| Scenario | Behaviour |
|---|---|
| Player passes without playing | `echoQueue` stays null; next boss turn uses base dpt 2 |
| Player plays only `combat-draw` cards (no damage) | `echoQueue.power = 0`; falls back to base dpt 2 |
| Player plays a `combat-bonus` (resource buff, no damage) | same as above — counts as 0 power for echo math |
| Player plays a `combat-attack-stun` (e.g. craghorn-tusk dmg=4 stunTurns=1) | echo uses dmg component (4) → caps at 4. The stun applies normally to the boss. The boss-stun grace turn does NOT cause the echo to skip — the echo still fires when the boss eventually un-stuns, using the most recent stored echoQueue. (Matches existing bossStunTurns semantics.) |
| Player downed before boss turn | echo still resolves on remaining standing players (`'player-hp'` routing per `routePlayerHpDamage`'s live-only logic). |
| Both players downed before boss turn | wouldAllBeDowned flips terminal=loss; echo is moot. |
| Player plays MULTIPLE attacks in one turn | only the highest single-play power is echoed (NOT sum). Two `combat-attack 3` plays → echo of 3, not 6. This is the key soft-clock — caps the worst case at 4 even with stacked plays. |

## REQ-16 soft-clock safety envelope

REQ-16 mandates that no enemy effect can drain a player's hand or HP to zero in a single sweep. Echo's relevant safety knobs:

1. **Damage cap at 4.** The strongest 6yo play in this scenario is a `craghorn-tusk` (4 damage). A 4-damage echo is bad but survivable from full HP (5 → 1, downed only with a follow-up). At 5 hpMax, the kid can take ~one full echo per zone-clear before needing a heart to recover.
2. **No multi-target stack.** Echo is single-target on the active attacker, splitting per `routePlayerHpDamage` only when both players are alive (`damage / liveCount` arithmetic + remainder on attacker-id). With 2 players alive, a 4-damage echo splits to 2 each; the active attacker eats the +1 remainder if odd. That's gentler than aoe.
3. **Battlefield bypass is offset by HP cap.** Yes, the echo skips battlefield-absorb (so a tower-shield doesn't help), but the 4-damage cap means tower-shield wasn't going to be the deciding factor anyway. The compensating safety is the 1-turn telegraph.
4. **Hand-discard exempt.** No echo variant proposed here touches hand discards. The mechanic is purely HP-side.
5. **Telegraph is mandatory.** A 6yo without a telegraph is a 6yo confused. The HUD bubble + battlefield arrow on the source card is part of the spec, NOT a polish-pass deferral.

## Engine impact (for gdd.2 step 3 implementation)

### `BossAttackPattern` shape

The current `BossAttackPattern` (`src/types/combat.ts:120`) has a fixed `damagePerTurn: number`. Hollow-effigy's pattern is dynamic — depends on combat history. Two implementation options:

**Option A — pattern-level reducer hook (preferred, cleaner)**
- Extend `BossAttackPattern` with optional `bossAttackResolver?: 'hollow-effigy-mirror'` discriminator.
- `reduceBossResolve` in `src/core/combatEngine.ts` (~line 833) checks the discriminator and computes `damage = resolveShadowLinkMirror(state.combat)` when set, else uses `boss.attackPattern.damagePerTurn`.
- New helper `resolveShadowLinkMirror(combat: CombatState): number` in `combatEngine.ts` reads `combat.echoQueue` and clamps.

**Option B — boss-specific override in reduceBossResolve**
- Hardcode `if (boss.sourceCardId === 'hollow-effigy') { ... }` in `reduceBossResolve`.
- Faster to write; uglier; doesn't generalize when knell lands a similar pattern.

**Pick Option A.** It's still cheap (one optional field + one switch arm in the resolver) and stays open for knell's drum-telegraph + any future region-boss with a stateful pattern.

### `CombatState` shape

Add one field:

```ts
// In src/types/combat.ts CombatState:
/**
 * Echo queue for hollow-effigy's delayed mirror attack pattern (gdd.2.4).
 * `power` is the player's highest single-play power on the turn just
 * ended; cleared each boss-turn after the echo fires. `null` on combat
 * entry and after a no-play / no-damage player turn.
 */
readonly echoQueue: { readonly power: number; readonly sourceCardId: string | null } | null;
```

Initialized to `null` on `COMBAT_ENTER`. Updated in `reducePlayerPass` (and on terminal `'players' → 'boss'` activeActor flips) by reading the just-finished player turn's plays. Cleared in `reduceBossResolve` after the echo fires.

### Telegraph plumbing

- New `data-testid="combat-hollow-effigy-echo-telegraph"` on the CombatBossPanel when `combat.echoQueue !== null && boss.sourceCardId === 'hollow-effigy'`.
- Bubble text: *"Mirror-Echo: hollow-effigy will hit for {power} next turn!"* (or fallback "*…will swipe for 2 next turn!*" when `echoQueue.power < 2`).
- Battlefield-arrow is harder visually; minimum-viable telegraph is the bubble alone. Battlefield arrow is gdd.2.5 polish if a follow-up bead files for it.

### Tests (target)

Per gdd.2 step 9 conventions, tests should land alongside the implementation:

1. `bossAttackPatterns.test.ts` — hollow-effigy entry exists, dpt=2 fallback, targeting='player-hp', onDefeatEffect=wisp-drop.
2. `combatEngine.test.ts` (new describe block: "hollow-effigy mirror-echo"):
   - turn 1: player plays a `combat-attack 3` → echoQueue.power=3
   - boss turn: hollow-effigy does 3 damage to active attacker (split if 2 alive)
   - clamps at 4: player plays 5-power card → echo damage = 4
   - falls back to 2 when player passes (echoQueue null)
   - max-not-sum: two attacks of 3 each → echo=3, not 6
   - boss-stun grace: craghorn-tusk stunTurns delays the echo by 1 boss-turn but doesn't drop it
   - terminal=loss path still works when echo would down the last player (uses wouldAllBeDowned)

## Cross-references

- Designer ruling: `bd memories embertide-designer-ruling-shadow-roster-2026-04-24`
- Roster draft: `bd memories embertide-gdd-shadow-roster-hollow-shrine-dark-world`
- Existing pattern table: `src/data/bossAttackPatterns.ts` (lines 36–180)
- Engine boss-turn resolver: `src/core/combatEngine.ts::reduceBossResolve` (~line 833)
- BossAttackPattern type: `src/types/combat.ts` (line 120)
- Craghorn-horn stun precedent: `src/data/combatEffects.ts` (`combat-attack-stun`)
- gdd.1 tide-gauge slice (parallel pattern): the gdd.2 zone-mechanic slice will copy gdd.1's substrate-only-slice + tuning-bead-followup cadence.

## Followup beads (file at gdd.2 implementation time, not now)

- `gdd.2.4.1` — Battlefield-arrow polish on hollow-effigy echo telegraph (P3, polish)
- `gdd.2.4.2` — Tune the damage cap (current spec: 4) after first playtest run; check whether 3 is friendlier for 5hp kids
- `gdd.2.4.3` — Multi-combat hollow-effigy playtest (does the kid learn the telegraph after 2-3 encounters?)
