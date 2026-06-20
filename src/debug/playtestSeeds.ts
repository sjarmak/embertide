/**
 * Playtest debug seeds. Dev-only URL-param hooks that skip Setup and drop
 * the app into a specific curated state so the designer can exercise a
 * feature without grinding through normal game flow.
 *
 * Usage: append `?debug=<seed>` to the URL. Example: `?debug=craghorn`
 * jumps straight into a Craghorn combat encounter with the current
 * `buildCombatDeck` output from a fresh 2-player init.
 *
 * IMPORTANT: these seeds mutate the live game store. They are enforced
 * dev-only via `import.meta.env.DEV` guards in `applyDebugSeed` and
 * `exposeGameStoreForPlaytest` (embertide-b3vn) — production builds
 * cannot reach the seed application or the `window.__gameStore` exposure.
 * They run once on App mount when the query param matches; no persistent
 * state is touched.
 */

import { KID_CARDS } from '../data/cards';
import { useGameStore, enterCombatAction } from '../store/gameStore';
import type { TierId } from '../core/colosseum';
import { unlockTier } from '../core/colosseum';
import { COLOSSEUM_CRAGHORN_T1 } from '../data/colosseum/tier1';
import { COLOSSEUM_CHIMERA_T2 } from '../data/colosseum/tier2';
import { COLOSSEUM_OSSIARCH_T4 } from '../data/colosseum/tier4';
import { COLOSSEUM_TRINITY_AUROGAX_T5 } from '../data/colosseum/tier5';
import type { CombatBoss } from '../types/combat';

function cardById(id: string) {
  const match = KID_CARDS.find((c) => c.id === id);
  if (!match) {
    // Soft-fail for optional seed cards: a missing id returns undefined
    // so callers can .filter out absent entries. Strict lookups (e.g.
    // the boss card) still throw via the caller's fallback check.
    return undefined;
  }
  return match;
}

export type DebugSeed =
  | 'craghorn'
  | 'craghorn-valor'
  | 'wild-boss-slot'
  | 'emberpeak-combat'
  | 'temple-combat'
  | 'sentinel-combat'
  | 'silver-chimera-combat'
  | 'boulderkin-combat'
  | 'vurmox-destiny'
  | 'hp-downed'
  | 'embertide-filled'
  | 'princess-crystal-freed'
  | 'zone-emberpeak'
  | 'zone-temple'
  | 'zone-dune-sanctum'
  | 'colosseum-tier1'
  | 'colosseum-tier2'
  | 'colosseum-tier4'
  | 'colosseum-tier5';

/**
 * Resolve a `?debug=<seed>` URL param into a known seed id, or null.
 * Accepts any string input; unknown seeds return null so a stale / typo
 * param silently falls through to the normal Setup flow.
 */
export function resolveDebugSeed(search: string): DebugSeed | null {
  const params = new URLSearchParams(search);
  const raw = params.get('debug');
  if (raw === 'craghorn') return 'craghorn';
  if (raw === 'craghorn-valor') return 'craghorn-valor';
  if (raw === 'wild-boss-slot') return 'wild-boss-slot';
  if (raw === 'emberpeak-combat') return 'emberpeak-combat';
  if (raw === 'temple-combat') return 'temple-combat';
  if (raw === 'sentinel-combat') return 'sentinel-combat';
  if (raw === 'silver-chimera-combat') return 'silver-chimera-combat';
  if (raw === 'boulderkin-combat') return 'boulderkin-combat';
  if (raw === 'vurmox-destiny') return 'vurmox-destiny';
  if (raw === 'hp-downed') return 'hp-downed';
  if (raw === 'embertide-filled') return 'embertide-filled';
  if (raw === 'princess-crystal-freed') return 'princess-crystal-freed';
  if (raw === 'zone-emberpeak') return 'zone-emberpeak';
  if (raw === 'zone-temple') return 'zone-temple';
  if (raw === 'zone-dune-sanctum') return 'zone-dune-sanctum';
  if (raw === 'colosseum-tier1') return 'colosseum-tier1';
  if (raw === 'colosseum-tier2') return 'colosseum-tier2';
  if (raw === 'colosseum-tier4') return 'colosseum-tier4';
  if (raw === 'colosseum-tier5') return 'colosseum-tier5';
  return null;
}

/**
 * Expose the game store on `window.__gameStore` so Playwright playtest
 * scenarios can read state via `page.evaluate(...)`. Dev-only — guarded
 * at this function so every call site (including the zone-dune-sanctum
 * arm of `applyDebugSeed`) is covered without relying on caller order.
 */
function exposeGameStoreForPlaytest(): void {
  // Load-bearing guard (embertide-b3vn). Every call site is protected
  // here so a future refactor can't reintroduce the prod-exposure leak by
  // moving the function call past the applyDebugSeed early-return.
  if (!import.meta.env.DEV) return;
  try {
    const w = globalThis as unknown as {
      __gameStore?: typeof useGameStore;
    };
    w.__gameStore = useGameStore;
  } catch {
    // Fail silent — missing globalThis isn't a playtest blocker.
  }
}

/**
 * Apply the named seed to the live game store. Initializes a 2-player
 * game with default champions, then dispatches the combat-entry action
 * for the target boss. Returns true if a seed was applied (caller should
 * skip the Setup screen).
 */
export function applyDebugSeed(seed: DebugSeed): boolean {
  // Hard prod guard (embertide-b3vn). Even if a future caller forgets
  // the App.tsx-level env check, this returns false in any non-dev build
  // before exposeGameStoreForPlaytest can write to globalThis.
  if (!import.meta.env.DEV) return false;
  exposeGameStoreForPlaytest();
  if (seed === 'craghorn' || seed === 'craghorn-valor') {
    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    // Pre-seed each player's inPlay with useful heroes + items so the
    // combat deck has something to play with. j49z (2026-04-24): the
    // starter-home heroes were retired and the 2026-04-22 rev-2 change
    // re-included starter-green + starter-red in the combat deck, so a
    // fresh starter contributes 10 combat-eligible cards — but they
    // resolve to combat-draw / combat-attack 2 only, which is too thin
    // for a wild boss. The seeded heroes + tower-shield make craghorn
    // playtest sessions feel like mid-game combat instead of a slog.
    //
    // embertide-4uyn.2 (2026-04-24): the `craghorn-valor` sub-seed
    // adds `valor-pendant` (item-passive, on-combat-enter: +2 power)
    // to p0's items so a playtest can compare turn-count with vs
    // without the relic. Keep impl minimal — single extra cardById
    // push guarded on the sub-seed discriminator.
    const freshState = useGameStore.getState();
    const pSeeded = freshState.players.map((p, idx) => {
      const seededHeroIds =
        idx === 0
          ? ['water-warrior', 'wandering-merchant', 'mountain-king']
          : ['sage-keeper', 'ranch-keeper', 'forest-sage'];
      const seededHeroes = seededHeroIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      const baseItems = idx === 0 ? [cardById('tower-shield')] : [];
      const valorAddon = seed === 'craghorn-valor' && idx === 0 ? [cardById('valor-pendant')] : [];
      const seededItems = [...baseItems, ...valorAddon];
      return {
        ...p,
        inPlay: [...p.inPlay, ...seededHeroes],
        items: [...p.items, ...seededItems.filter((c) => c != null)],
      };
    });
    useGameStore.setState({ ...freshState, players: pSeeded });

    const craghorn = cardById('craghorn');
    if (!craghorn) throw new Error('playtestSeeds: craghorn card not found');
    const nextState = useGameStore.getState();
    store.dispatchCombat(
      enterCombatAction(nextState, { kind: 'card', card: craghorn }, 'fightMonster'),
    );
    return true;
  }
  if (
    seed === 'emberpeak-combat' ||
    seed === 'temple-combat' ||
    seed === 'sentinel-combat' ||
    seed === 'silver-chimera-combat' ||
    seed === 'boulderkin-combat'
  ) {
    // REQ-33 (u-10b) — Drop the player into combat in the requested zone
    // so the Playwright visual-regression specs can capture the
    // corresponding zone's combat background. Same seeding shape as the
    // craghorn seed; only the zone + boss monster change.
    //
    // ons0 (ycj.1.1, 2026-05-01) — extended with three wild-boss seeds
    // (sentinel / silver-chimera / boulderkin) so wild-boss-loot-pacing
    // can run a cross-tier comparison against the existing craghorn arm.
    // Region-boss seeds (emberpeak-combat, temple-combat) keep
    // their original visual-regression role; wild seeds share the shape.
    //
    // Round 3 fix: re-read state via `useGameStore.getState()` BEFORE the
    // dispatchCombat call so the COMBAT_ENTER payload is built from the
    // post-zone-change snapshot. Using `useGameStore.getState().dispatchCombat`
    // (rather than a pre-fetched `store` reference) matches the
    // `get().dispatchCombat` pattern used inside the store's own slice
    // actions (see engageWildBossSlot / engageRegionBossSlot) and
    // guarantees the method reads the freshest state.
    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    const freshState = useGameStore.getState();
    const pSeeded = freshState.players.map((p, idx) => {
      const seededHeroIds =
        idx === 0
          ? ['water-warrior', 'wandering-merchant', 'mountain-king']
          : ['sage-keeper', 'ranch-keeper', 'forest-sage'];
      const seededHeroes = seededHeroIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      const seededItems = idx === 0 ? [cardById('tower-shield')] : [];
      return {
        ...p,
        inPlay: [...p.inPlay, ...seededHeroes],
        items: [...p.items, ...seededItems.filter((c) => c != null)],
      };
    });
    const zoneId =
      seed === 'emberpeak-combat' || seed === 'boulderkin-combat'
        ? 'emberpeak'
        : 'gilded-cage';
    const bossId =
      seed === 'emberpeak-combat'
        ? 'ashen-tyrant'
        : seed === 'temple-combat'
          ? 'cagewright-vurmox'
          : seed === 'sentinel-combat'
            ? 'sentinel'
            : seed === 'silver-chimera-combat'
              ? 'silver-chimera'
              : 'boulderkin';
    useGameStore.setState({
      ...freshState,
      players: pSeeded,
      currentZone: zoneId,
    });
    const bossCard = cardById(bossId);
    if (!bossCard) {
      throw new Error(`playtestSeeds: ${bossId} card not found`);
    }
    // Re-read state after the setState so currentZone is included in the
    // snapshot the COMBAT_ENTER action captures (used by buildCombatDeck
    // and the entry-context). Use the freshest dispatchCombat reference
    // from the store rather than the pre-fetched `store` binding.
    const updatedState = useGameStore.getState();
    useGameStore
      .getState()
      .dispatchCombat(
        enterCombatAction(updatedState, { kind: 'card', card: bossCard }, 'fightMonster'),
      );
    return true;
  }
  if (seed === 'vurmox-destiny') {
    // REQ-33 (u-10d, PRD §D3) — Drop the player on the main GameBoard in
    // the Gilded Cage with BOTH Temple wild bosses already defeated
    // so GameBoard mounts VurmoxDestinySlot. No COMBAT_ENTER dispatch —
    // the destiny visual spec screenshots the altar slot itself, not a
    // combat scene. Same 2-player init + hero-seeding shape as the
    // other seeds for consistent pane dimensions.
    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    const freshState = useGameStore.getState();
    const pSeeded = freshState.players.map((p, idx) => {
      const seededHeroIds =
        idx === 0
          ? ['water-warrior', 'wandering-merchant', 'mountain-king']
          : ['sage-keeper', 'ranch-keeper', 'forest-sage'];
      const seededHeroes = seededHeroIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      const seededItems = idx === 0 ? [cardById('tower-shield')] : [];
      return {
        ...p,
        inPlay: [...p.inPlay, ...seededHeroes],
        items: [...p.items, ...seededItems.filter((c) => c != null)],
      };
    });
    // Set currentZone + defeatedBossIds together so GameBoard's
    // conditional mount (Temple + wilds-cleared → VurmoxDestinySlot)
    // triggers on the first render after the setState. Re-read pattern
    // mirrors the u-10b round-3 combat seeds for consistency even
    // though we don't dispatch COMBAT_ENTER here.
    useGameStore.setState({
      ...freshState,
      players: pSeeded,
      currentZone: 'gilded-cage',
      defeatedBossIds: ['sentinel', 'silver-chimera'],
    });
    return true;
  }
  if (seed === 'wild-boss-slot') {
    // REQ-32 (u-9e) — Drop the player on the main GameBoard with the
    // Sylvani wild + region slots populated so playtester scenarios can
    // exercise the engage-wild-then-region / engage-region-only flows.
    // Same 2-player default + deck seeding as the craghorn seed; the
    // only difference is we do NOT dispatch `COMBAT_ENTER`, so the
    // player lands on the main board with both altar slots visible.
    //
    // embertide-98d (2026-04-22): the u-9f balance pass raised
    // Craghorn HP from ~4 to 10 and retuned the wild-boss win-rate to
    // 30-40% at 0 heirlooms. The original seed (3 heroes + a tower-
    // shield) produces a combat deck of ~9 1-damage cards which is
    // thin by design — but the `wild-heirloom-wins-region` and
    // `wild-then-region` playtests assert a deterministic wild WIN
    // so the craghorn-tusk drop can be observed. Seed each player with
    // one pre-earned heirloom so the combat deck carries enough
    // burst / tempo to make the naive `clickFirstCard` harness win
    // reliably. Thematically: the debug seed represents a
    // mid-campaign entry where the team has already accumulated
    // some trophies. Does NOT affect `region-only.spec.ts` (outcome
    // agnostic) or `visual-altar-row.spec.ts` (screenshots the altar
    // row, not the trays).
    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    const freshState = useGameStore.getState();
    const pSeeded = freshState.players.map((p, idx) => {
      const seededHeroIds =
        idx === 0
          ? ['water-warrior', 'wandering-merchant', 'mountain-king']
          : ['sage-keeper', 'ranch-keeper', 'forest-sage'];
      const seededHeroes = seededHeroIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      // p0 gets tower-shield + sentinel-eye (combat-attack damage=6,
      // huge burst for closing out a HP=10 wild boss).
      // p1 gets chimera-sword (combat-attack damage=7, the end-of-core
      // heirloom that replaced silver-chimera-mane in v2.1 gm0.17). The
      // paired damage pools keep the naive-harness Craghorn win-rate well
      // above 95%.
      const seededItemIds = idx === 0 ? ['tower-shield', 'sentinel-eye'] : ['chimera-sword'];
      const seededItems = seededItemIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      return {
        ...p,
        inPlay: [...p.inPlay, ...seededHeroes],
        items: [...p.items, ...seededItems],
      };
    });
    // gm0.12 (v2.1 REVERSE-Q8): region boss slot is SEALED until the
    // zone's wild-boss key has dropped. The wild-boss-slot seed
    // represents a "mid-campaign" entry where the team has already
    // accumulated trophies; pre-populating `bossKeys.sylvani` keeps the
    // visual-altar-row regression baseline stable AND preserves the
    // wild-then-region / wild-heirloom-wins-region playtester intent
    // (the specs defeat the wild first anyway — this is just a
    // convenience so region-slot reachability is exercisable). The
    // region-slot-gating spec (formerly region-only.spec) seeds the
    // locked-door flow explicitly by asserting the SEALED state before
    // any wild-boss engagement.
    useGameStore.setState({
      ...freshState,
      players: pSeeded,
      bossKeys: {
        ...freshState.bossKeys,
        sylvani: ['craghorn'],
      },
      // gm0.9 (REQ-19): the 4-phase session arc gates wild-boss
      // engagement until Rising (turn 3) and region-boss engagement
      // until Boss (turn 6). The wild-boss-slot seed represents a
      // mid-campaign entry, so bump directly to Boss phase — both
      // altars are interactive, every playtester scenario that engages
      // a slot works without an extra end-turn dance, and the
      // visual-altar-row regression baseline stays stable.
      turn: 6,
    });
    return true;
  }

  // State-matrix seeds (embertide-68a). Each drops a 2-player init
  // onto the main board with ONE state surface flipped so Playwright
  // scenarios can screenshot terminal states (HPStrip downed, Embertide
  // filled, PrincessCrystal freed, non-Sylvani zone themes) without
  // grinding through hours of real gameplay.
  if (
    seed === 'hp-downed' ||
    seed === 'embertide-filled' ||
    seed === 'princess-crystal-freed' ||
    seed === 'zone-emberpeak' ||
    seed === 'zone-temple' ||
    seed === 'zone-dune-sanctum'
  ) {
    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    const freshState = useGameStore.getState();

    if (seed === 'hp-downed') {
      // p0 downed: hp=0, downed=true, revivedThisIncident=false so the
      // teammate-revive button is enabled (not greyed for "already
      // revived this incident"). p1 stays at full hp so GameBoard keeps
      // mounting the main board (otherwise both-downed triggers LOSS).
      //
      // currentPlayerIndex = 1 so p1 is active and p0's strip renders
      // from the teammate-view perspective — that's the view where the
      // Revive button surfaces (see GameBoard.tsx: isTeammateView =
      // !isActive, revive only wired when isTeammateView).
      const players = freshState.players.map((p, idx) =>
        idx === 0 ? { ...p, hp: 0, downed: true, revivedThisIncident: false } : p,
      );
      useGameStore.setState({ ...freshState, players, currentPlayerIndex: 1 });
      return true;
    }

    if (seed === 'embertide-filled') {
      // All three shared shards granted. GameBoard's win-check will flip
      // `outcome = 'win'` on next action, so screenshots should capture
      // the board BEFORE any input. The EmbertideStrip renders all three
      // filled-shard SVGs regardless of outcome.
      useGameStore.setState({
        ...freshState,
        sharedEmbertide: { wisdom: true, courage: true, power: true },
      });
      return true;
    }

    if (seed === 'princess-crystal-freed') {
      // Crystal at 0 charges AND freed. The freed-banner + Aurelia-freed
      // element render; the Strike button renders disabled because the
      // pre-freed action is gone (freed=true branch in the gate).
      useGameStore.setState({
        ...freshState,
        princessCrystal: { charges: 0, freed: true },
      });
      return true;
    }

    // Zone-theme seeds — force currentZone so ZoneCell renders the
    // non-default raster + theme-hint tag. Does NOT populate
    // defeatedBossIds, so Wild/Region slot inhabitants reset per the
    // new zone's roster. zone-dune-sanctum (embertide-7itk) also
    // exposes `window.__gameStore` so smart-dune-sanctum-walk can
    // read state.sandstormCounter and per-player hand sizes via
    // page.evaluate; it shares the store-mutating shape with the
    // other zone seeds.
    const zoneId =
      seed === 'zone-emberpeak'
        ? 'emberpeak'
        : seed === 'zone-dune-sanctum'
          ? 'dune-sanctum'
          : 'gilded-cage';
    useGameStore.setState({ ...freshState, currentZone: zoneId });
    if (seed === 'zone-dune-sanctum') exposeGameStoreForPlaytest();
    return true;
  }

  // embertide-bcq8 (+ mvvw extension) — drop into a colosseum-slot
  // fight at one of the shipped tiers (1, 2, 4, 5) so the visual-regression
  // specs at tools/playtester/visual-colosseum-tier{1,2,4,5}.spec.ts can
  // capture the portrait-on-backdrop composite at rendered scale. Tier-3
  // remains gated until its visual-spec follow-up bead lands.
  //
  // NOTE: deliberate divergence from the region-boss seeds above. Those
  // use `kind: 'card'` + default `entrySource='field'` so the engine
  // synthesizes a CombatBoss from the card. Colosseum entry takes a
  // pre-built CombatBoss via `kind: 'boss'` + `entrySource='colosseum-slot'`
  // — this is the same path slotRouter takes in production. The
  // kind/entrySource invariant at combatBootstrap.ts:455-470 enforces
  // the pairing; copying the region-boss shape would throw.
  if (
    seed === 'colosseum-tier1' ||
    seed === 'colosseum-tier2' ||
    seed === 'colosseum-tier4' ||
    seed === 'colosseum-tier5'
  ) {
    const tierBossMap: Record<typeof seed, { tier: TierId; boss: CombatBoss }> = {
      'colosseum-tier1': { tier: 1, boss: COLOSSEUM_CRAGHORN_T1 },
      'colosseum-tier2': { tier: 2, boss: COLOSSEUM_CHIMERA_T2 },
      'colosseum-tier4': { tier: 4, boss: COLOSSEUM_OSSIARCH_T4 },
      'colosseum-tier5': { tier: 5, boss: COLOSSEUM_TRINITY_AUROGAX_T5 },
    };
    const { tier, boss } = tierBossMap[seed];

    const store = useGameStore.getState();
    store.initGame({
      players: 2,
      championIds: ['champion-courage', 'champion-power'],
      names: ['Playtest P1', 'Playtest P2'],
    });
    const freshState = useGameStore.getState();
    const pSeeded = freshState.players.map((p, idx) => {
      const seededHeroIds =
        idx === 0
          ? ['water-warrior', 'wandering-merchant', 'mountain-king']
          : ['sage-keeper', 'ranch-keeper', 'forest-sage'];
      const seededHeroes = seededHeroIds
        .map((id) => cardById(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
      const seededItems = idx === 0 ? [cardById('tower-shield')] : [];
      return {
        ...p,
        inPlay: [...p.inPlay, ...seededHeroes],
        items: [...p.items, ...seededItems.filter((c) => c != null)],
      };
    });
    // Defensive coherence (architect MEDIUM #2): unlock the target tier
    // so HUD/preview surfaces stay consistent with the seeded combat
    // even though dispatchCombat itself bypasses the slotRouter unlock
    // gate.
    const seededProgression = unlockTier(freshState.colosseumProgression, tier);
    useGameStore.setState({
      ...freshState,
      players: pSeeded,
      colosseumProgression: seededProgression,
    });

    // Re-read state after the setState so colosseumProgression + players
    // are included in the snapshot the COMBAT_ENTER action captures (mirrors
    // the round-3 fix at lines 240-247 above for the region-boss seeds).
    // Use the freshest dispatchCombat reference from the store rather than
    // the pre-fetched `store` binding so any intervening setState is
    // observed by the dispatch — same idiom the engine's own slice actions
    // use (engageWildBossSlot / engageRegionBossSlot).
    const updatedState = useGameStore.getState();
    useGameStore
      .getState()
      .dispatchCombat(
        enterCombatAction(updatedState, { kind: 'boss', boss }, 'fightMonster', 'colosseum-slot'),
      );
    return true;
  }

  return false;
}
