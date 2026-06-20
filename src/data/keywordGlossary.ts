/**
 * Player-facing keyword glossary (kw.glossary-ui / lhlo.44).
 *
 * Maps every card-face keyword (the bold vocabulary emitted by the
 * standardized Market — / Combat — / Omen — renderer, kw.card-text-format
 * / lhlo.38) to its CHILD-READABLE gloss. The audience is a 6-year-old, so
 * each line is the short "Kid (6yo)" gloss authored in
 * docs/design/keyword-glossary.md — that doc is the single source of truth
 * (kw.glossary-doc / lhlo.8). The `kid` strings here are copied verbatim
 * from the doc's Kid lines; `keywordGlossary.test.ts` asserts they stay in
 * lockstep with the doc and that every rendered card-face keyword
 * (`CARD_FACE_KEYWORDS`) has an entry here.
 *
 * `X` / `N` are kept as the doc writes them — the card face shows the
 * concrete number; the glossary explains the shape of the effect.
 */
export interface KeywordGloss {
  /** Canonical keyword spelling, matching docs/design/keyword-glossary.md. */
  readonly keyword: string;
  /** Child-readable gloss, verbatim from the doc's Kid (6yo) line. */
  readonly kid: string;
  /** Display grouping header shown in the glossary panel. */
  readonly category: string;
}

export const KEYWORD_GLOSSARY: readonly KeywordGloss[] = [
  // COMBAT
  { keyword: 'Attack', kid: 'Hit for X.', category: 'Fighting' },
  { keyword: 'Block', kid: 'Stop X of the next hit.', category: 'Fighting' },
  { keyword: 'Stun', kid: 'It loses a turn.', category: 'Fighting' },
  { keyword: 'Weaken', kid: 'Its next hit is X weaker.', category: 'Fighting' },
  { keyword: 'Vulnerable', kid: 'Hits on it do X more, this turn.', category: 'Fighting' },
  { keyword: 'Multiattack', kid: 'Hit N times.', category: 'Fighting' },
  // HEALTH
  { keyword: 'Heal', kid: 'Get X hearts back.', category: 'Fighting' },
  // DICE / OMEN
  {
    keyword: 'Omen',
    kid: 'Roll the dice and see which good thing happens.',
    category: 'Dice',
  },
  // MARKET
  { keyword: 'Shards', kid: 'Get X coins to buy with.', category: 'Shopping' },
  { keyword: 'Power', kid: 'Get X muscle to beat monsters.', category: 'Shopping' },
  { keyword: 'Acquire', kid: 'Buy a card from the row.', category: 'Shopping' },
  { keyword: 'Defeat', kid: 'Spend muscle to beat a row monster.', category: 'Shopping' },
  { keyword: 'Key', kid: 'Opens chests.', category: 'Shopping' },
  { keyword: 'Open', kid: 'Use a key to grab a chest prize.', category: 'Shopping' },
  // ITEM / AURELIA
  { keyword: 'Bomb', kid: 'Blows the guard off.', category: 'Tools' },
  { keyword: 'Pierce', kid: 'Goes right through shields.', category: 'Tools' },
  { keyword: 'Grapplethorn', kid: 'Grab one exact part.', category: 'Tools' },
  { keyword: 'Reflect', kid: 'Bounce the next hit back.', category: 'Tools' },
  { keyword: 'Reveal', kid: 'Flip the secret face-up.', category: 'Tools' },
  { keyword: 'Disarm', kid: 'Turn off one of its moves for the turn.', category: 'Tools' },
  // BOSS-STATE
  { keyword: 'Guarded', kid: "Can't be hurt right now.", category: 'Boss words' },
  { keyword: 'Exposed', kid: 'Open to hits — and hits hurt extra.', category: 'Boss words' },
  {
    keyword: 'Cycle',
    kid: "A timer counts up; when it's full, something happens.",
    category: 'Boss words',
  },
  { keyword: 'Break', kid: 'Knock pieces off to make something work.', category: 'Boss words' },
];

const KID_GLOSS_BY_KEYWORD: ReadonlyMap<string, string> = new Map(
  KEYWORD_GLOSSARY.map((entry) => [entry.keyword, entry.kid]),
);

/** Child-readable gloss for a keyword, or `undefined` if none is authored. */
export function kidGlossFor(keyword: string): string | undefined {
  return KID_GLOSS_BY_KEYWORD.get(keyword);
}

/**
 * Ordered list of the distinct category headers, in first-appearance order
 * — drives the section grouping in the glossary panel without a second
 * authored list to keep in sync.
 */
export const KEYWORD_GLOSSARY_CATEGORIES: readonly string[] = [
  ...new Set(KEYWORD_GLOSSARY.map((entry) => entry.category)),
];
