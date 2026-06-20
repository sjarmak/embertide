import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../../rules/chestPool';
import { KID_CARDS, buildSupply } from '../../data/cards';
import type { Card } from '../../types/card';
import type { KidGameState, KidPlayer } from '../types';
import { FIELD_SIZE, refillField } from './market';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer()],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

const GRUNT = KID_CARDS.find((c) => c.id === 'grunt-orc')!;
const SPEAR = KID_CARDS.find((c) => c.id === 'spear-orc')!;
const SAGE = KID_CARDS.find((c) => c.id === 'sage-keeper')!;
const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;
const FINAL_BOSS = KID_CARDS.find((c) => c.role === 'final-boss')!;

function padSupply(base: readonly Card[], needed: number): Card[] {
  const out: Card[] = base.slice();
  while (out.length < needed) out.push(GRUNT);
  return out;
}

describe('market slice', () => {
  it('FIELD_SIZE is 6', () => {
    expect(FIELD_SIZE).toBe(6);
  });

  it('refillField tops field up to 6 from the top of supply', () => {
    const supply = padSupply([SPEAR, SAGE, SHORT_SWORD], 10);
    const state = makeState({ field: [], supply });
    const next = refillField(state);
    expect(next.field).toHaveLength(6);
    // The first cards in supply land in field, in order.
    expect(next.field[0]).toBe(SPEAR);
    expect(next.field[1]).toBe(SAGE);
    expect(next.field[2]).toBe(SHORT_SWORD);
    expect(next.supply).toHaveLength(4);
  });

  it('refillField is a no-op when field already has 6 market cards', () => {
    const fullField = [GRUNT, SPEAR, SAGE, SHORT_SWORD, GRUNT, SPEAR];
    const supply = [GRUNT, GRUNT];
    const state = makeState({ field: fullField, supply });
    const next = refillField(state);
    expect(next).toBe(state);
    expect(next.field).toHaveLength(6);
    expect(next.supply).toHaveLength(2);
  });

  it('refillField leaves field < 6 when supply is exhausted (no throw)', () => {
    const supply: Card[] = [GRUNT, SPEAR];
    const state = makeState({ field: [], supply });
    const next = refillField(state);
    expect(next.field).toHaveLength(2);
    expect(next.supply).toHaveLength(0);
  });

  it('refillField does not touch pinned cards (final-boss stays on top)', () => {
    // Field already has the final-boss + 5 market cards = 6 entries, but
    // only 5 count toward the FIELD_SIZE cap — one more slot should refill.
    const fieldWithPinned: Card[] = [FINAL_BOSS, GRUNT, SPEAR, SAGE, SHORT_SWORD, GRUNT];
    const supply: Card[] = [SPEAR, SAGE];
    const state = makeState({ field: fieldWithPinned, supply });
    const next = refillField(state);
    // One new market card drawn → field length 7 (6 market + 1 pinned).
    expect(next.field).toHaveLength(7);
    expect(next.field.some((c) => c.role === 'final-boss')).toBe(true);
    expect(next.supply).toHaveLength(1);
  });

  it('refillField returns new arrays (immutable)', () => {
    const supply = padSupply([SAGE], 6);
    const state = makeState({ field: [], supply });
    const next = refillField(state);
    expect(next).not.toBe(state);
    expect(next.field).not.toBe(state.field);
    expect(next.supply).not.toBe(state.supply);
  });

  // embertide-7c1: chests no longer live in the main supply. Verify the
  // real buildSupply() output never emits chest cards so the market cannot
  // refill chests into the center row.
  it('buildSupply output contains no chest cards (embertide-7c1)', () => {
    const rng = createSeededRng(1);
    const supply = buildSupply(rng);
    for (const card of supply) {
      expect(card.role.startsWith('chest-')).toBe(false);
    }
  });

  it('refillField using a real buildSupply cannot introduce chests into the field', () => {
    const rng = createSeededRng(5);
    const supply = buildSupply(rng);
    const state = makeState({ field: [], supply });
    const next = refillField(state);
    for (const card of next.field) {
      expect(card.role.startsWith('chest-')).toBe(false);
    }
  });

  // a39d (2026-04-25): regulars carry a `zone` tag and may only enter the
  // field while currentZone matches. Off-zone regulars rotate to the back
  // of supply so they remain available when the player advances.
  describe('zone filter (a39d)', () => {
    const BONELET = KID_CARDS.find((c) => c.id === 'bonelet')!;
    const THORN_SCRUB = KID_CARDS.find((c) => c.id === 'thorn-scrub')!;

    it('skips off-zone regulars when refilling the field', () => {
      const supply: Card[] = [BONELET, THORN_SCRUB, BONELET, THORN_SCRUB];
      const state = makeState({ field: [], supply, currentZone: 'sylvani' });
      const next = refillField(state);
      for (const card of next.field) {
        expect(card.zone === undefined || card.zone === 'sylvani').toBe(true);
      }
      expect(next.field.some((c) => c.id === 'bonelet')).toBe(false);
    });

    it('rotates off-zone cards to the back of supply (not lost)', () => {
      const supply: Card[] = [BONELET, THORN_SCRUB];
      const state = makeState({ field: [], supply, currentZone: 'sylvani' });
      const next = refillField(state);
      // thorn-scrub drew into field; bonelet rotated to back of supply.
      expect(next.field).toContain(THORN_SCRUB);
      expect(next.supply).toContain(BONELET);
      expect(next.supply).toHaveLength(1);
    });

    it('untagged cards (generic monsters, items, heroes) draw in any zone', () => {
      const supply = padSupply([GRUNT, SAGE, SHORT_SWORD], 6);
      const state = makeState({ field: [], supply, currentZone: 'hollow-shrine' });
      const next = refillField(state);
      expect(next.field).toHaveLength(6);
    });

    it('hollow-shrine zone draws shadow regulars but not sylvani regulars', () => {
      const supply: Card[] = [BONELET, THORN_SCRUB, BONELET];
      const state = makeState({ field: [], supply, currentZone: 'hollow-shrine' });
      const next = refillField(state);
      expect(next.field.filter((c) => c.id === 'bonelet')).toHaveLength(2);
      expect(next.field.some((c) => c.id === 'thorn-scrub')).toBe(false);
      expect(next.supply).toContain(THORN_SCRUB);
    });
  });
});
