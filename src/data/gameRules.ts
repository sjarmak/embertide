/**
 * Player-facing game-rule sections for the in-app Rule Book
 * (embertide-davn).
 *
 * Where {@link KEYWORD_GLOSSARY} explains individual card-face *words*,
 * this module explains how a turn actually *flows* — the structure a
 * 6-year-old needs to sit down and play: how to win, what a turn looks
 * like, where cards come from, how shopping and fighting work, and how
 * zones and bosses fit together. The Rule Book renders these sections
 * first, then folds the keyword glossary in as its final section, so the
 * single "Rules" button is the one place to learn everything.
 *
 * Tone matches the glossary's "Kid (6yo)" voice: short, plain-language
 * sentences, no jargon that isn't immediately explained. Content is
 * grounded in the shipped rules — the three-Embertide co-op win
 * (`EMBERTIDE_PIECES_TO_WIN`), the 10-card starter deck + draw-5 cadence
 * (`src/store/slices/deck.ts`), the Market acquire / Power defeat loop,
 * and the zone spine in `src/rules/zones.ts`.
 */
export interface GameRuleSection {
  /** Stable id — drives the section key and `rules-book-section-*` testid. */
  readonly id: string;
  /** Plain-language section header shown in the Rule Book. */
  readonly title: string;
  /** Kid-readable rule lines, each rendered as its own bullet. */
  readonly lines: readonly string[];
}

export const GAME_RULES: readonly GameRuleSection[] = [
  {
    id: 'how-to-win',
    title: 'How to win',
    lines: [
      'Everyone plays on the same team, working together.',
      'Win by getting all three Embertide pieces: free the Princess, explore the whole map, and beat Vurmox.',
      'If everyone runs out of hearts, the team loses — so look after each other.',
    ],
  },
  {
    id: 'your-turn',
    title: 'Your turn',
    lines: [
      'Start your turn by drawing 5 cards.',
      'Play cards to make Shards (coins to buy) and Power (muscle to fight).',
      'Use them to shop and to beat monsters, in any order you like.',
      'Press End Turn when you are done, and you draw 5 fresh cards on your next turn.',
    ],
  },
  {
    id: 'cards-and-deck',
    title: 'Your cards',
    lines: [
      'You start with a deck of 10 cards.',
      'Cards you use go to a used pile until your turn ends.',
      'When your deck runs out, the used pile is shuffled into a new deck.',
      'Cards you buy join your deck, so they come back to your hand later.',
    ],
  },
  {
    id: 'market',
    title: 'The Market',
    lines: [
      'A row of cards is for sale.',
      'Spend Shards to Acquire a card — it goes into your deck.',
      'When a card is taken, a new one slides in to fill the row.',
    ],
  },
  {
    id: 'fighting',
    title: 'Fighting monsters',
    lines: [
      'Some cards in the row are monsters.',
      'Spend Power to Defeat a monster and grab its reward.',
      'In a big fight you Attack to hurt it, Block to stop its hit, and use Tools for special tricks.',
      'The "Words to know" list at the bottom explains every fighting word.',
    ],
  },
  {
    id: 'chests-and-rewards',
    title: 'Chests and rewards',
    lines: [
      'Beating monsters can give you Keys.',
      'Use a Key to Open a chest and grab the prize inside.',
      'Sometimes you roll the dice (an Omen) to see which good thing happens.',
    ],
  },
  {
    id: 'zones',
    title: 'Travelling the map',
    lines: [
      'You travel through Aurelia places: Sylvanwood, Emberpeak, and more.',
      'Each place has its own monsters and its own big boss.',
      'Beat the big boss of a place to move on to the next one.',
    ],
  },
  {
    id: 'bosses',
    title: 'Boss fights',
    lines: [
      'Bosses are the biggest fights, with special boss words.',
      'A boss can be Guarded (safe for now) or Exposed (open to extra-hard hits).',
      'Watch its Cycle — a timer that fills up — and Break its pieces to win.',
    ],
  },
];
