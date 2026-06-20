/**
 * Tier-5 spec smoke-test (embertide-p24m). Asserts Trinity Aurogax
 * is wired end-to-end: combat spec carries the Sequence archetype +
 * 3-head step list, Card-data appears in KID_CARDS, CardArt resolves
 * the raster, and the theme dictionary surfaces the display name.
 */
import { describe, expect, it } from 'vitest';
import { COLOSSEUM_TRINITY_AUROGAX_T5, TIER_5_ROSTER } from './tier5';
import { KID_CARDS } from '../cards';
import { GENERIC_BASE_ID_THEME } from '../../theme/generic';
import { illustrationForBaseId } from '../../ui/CardArt';

describe('colosseum tier-5 spec — Trinity Aurogax wiring smoke-test', () => {
  it('combat spec is Sequence archetype with 3-head step list', () => {
    expect(COLOSSEUM_TRINITY_AUROGAX_T5.archetype).toBe('sequence');
    expect(COLOSSEUM_TRINITY_AUROGAX_T5.sourceCardId).toBe('trinity-aurogax');

    const sequenceTag = COLOSSEUM_TRINITY_AUROGAX_T5.stateTags?.[0];
    if (sequenceTag?.kind !== 'sequence') {
      throw new Error('expected sequence tag');
    }
    expect(sequenceTag.steps).toEqual(['gloom-head', 'umbra-head', 'auren-head']);
    expect(sequenceTag.currentIndex).toBe(0);
  });

  it('wires the trinity-aurogax-heads bossAttackResolver', () => {
    expect(COLOSSEUM_TRINITY_AUROGAX_T5.attackPattern.bossAttackResolver).toBe(
      'trinity-aurogax-heads',
    );
  });

  it('TIER_5_ROSTER seeds with the capstone Trinity Aurogax', () => {
    expect(TIER_5_ROSTER).toHaveLength(1);
    expect(TIER_5_ROSTER[0]).toBe(COLOSSEUM_TRINITY_AUROGAX_T5);
  });

  it('Card-data is registered in KID_CARDS so by-id lookups resolve', () => {
    const card = KID_CARDS.find((c) => c.id === 'trinity-aurogax');
    expect(card).toBeDefined();
    // role is 'mini-boss' (not 'final-boss') so the capstone stays
    // out of v2.0 endgame branches (`isPinnedRole` / `isMiniOrFinalBoss`).
    // See colosseum.ts docstring for the rationale.
    expect(card?.role).toBe('mini-boss');
    // Capstone is NOT a zone region/wild-boss — bossTier intentionally
    // omitted so zone-routing hooks stay untriggered.
    expect(card?.bossTier).toBeUndefined();
  });

  it('GENERIC_BASE_ID_THEME surfaces the Trinity Aurogax display name', () => {
    expect(GENERIC_BASE_ID_THEME['trinity-aurogax']).toBe('Trinity Aurogax');
  });

  it('CardArt resolves the trinity-aurogax raster spec', () => {
    // illustrationForBaseId returns the rendered ReactElement when a
    // spec exists; null otherwise. We only assert non-null here — the
    // shape of the rendered element belongs to CardArt's own tests.
    const rendered = illustrationForBaseId('trinity-aurogax', 64);
    expect(rendered).not.toBeNull();
  });
});
