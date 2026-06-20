import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CARD_FACE_KEYWORDS } from '../ui/effectText';
import { KEYWORD_GLOSSARY, kidGlossFor } from './keywordGlossary';

// Vitest runs from the repo root, so the doc is reachable from cwd.
const GLOSSARY_DOC = readFileSync(
  resolve(process.cwd(), 'docs/design/keyword-glossary.md'),
  'utf8',
);

/** Collapse all runs of whitespace so doc line-wrapping doesn't defeat a
 * substring match (the doc wraps long Kid lines across newlines). */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const NORMALIZED_DOC = normalize(GLOSSARY_DOC);

describe('keyword glossary data (kw.glossary-ui / lhlo.44)', () => {
  it('has a child-readable gloss for every card-face keyword', () => {
    // Acceptance: every keyword the standardized renderer can bold on a
    // card face (CARD_FACE_KEYWORDS, kw.card-text-format) must be
    // explainable in the player-facing glossary.
    const missing = CARD_FACE_KEYWORDS.filter((keyword) => kidGlossFor(keyword) === undefined);
    expect(missing).toEqual([]);
  });

  it('matches the Kid (6yo) lines authored in docs/design/keyword-glossary.md', () => {
    // The doc (kw.glossary-doc) is the single source of truth. Every gloss
    // string must appear verbatim in the doc (whitespace-normalized so the
    // doc's line wrapping doesn't matter).
    for (const entry of KEYWORD_GLOSSARY) {
      expect(
        NORMALIZED_DOC.includes(normalize(entry.kid)),
        `gloss for "${entry.keyword}" ("${entry.kid}") not found in keyword-glossary.md`,
      ).toBe(true);
    }
  });

  it('has no duplicate keyword entries', () => {
    const keywords = KEYWORD_GLOSSARY.map((entry) => entry.keyword);
    expect(new Set(keywords).size).toBe(keywords.length);
  });
});
