import { describe, expect, it } from 'vitest';

import { GAME_RULES } from './gameRules';

describe('GAME_RULES (embertide-davn)', () => {
  it('ships at least the core rule sections', () => {
    expect(GAME_RULES.length).toBeGreaterThanOrEqual(6);
  });

  it('uses unique, non-empty section ids', () => {
    const ids = GAME_RULES.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.trim().length).toBeGreaterThan(0);
    }
  });

  it('gives every section a title and at least one rule line', () => {
    for (const section of GAME_RULES) {
      expect(section.title.trim().length).toBeGreaterThan(0);
      expect(section.lines.length).toBeGreaterThan(0);
      for (const line of section.lines) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the win condition up front', () => {
    const first = GAME_RULES[0];
    expect(first.id).toBe('how-to-win');
    const text = first.lines.join(' ');
    expect(text).toMatch(/Embertide/i);
  });
});
