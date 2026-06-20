/**
 * Setup screen result payload.
 *
 * Produced by the Setup screen (MH-7) and consumed by whichever orchestration
 * layer starts a new game. Intentionally generic — no franchise strings.
 *
 * `championIds` (embertide-57p) replaces the legacy `regionIds` field:
 * each player picks exactly one Champion at setup; the chosen Champion
 * provides both the starter card and a persistent start-of-turn passive.
 *
 * Per-seat contract (embertide-edv): `championIds.length === players`.
 * Entry i is the champion chosen by seat i. Duplicates are permitted
 * only when the player opts in by explicitly picking an already-taken
 * champion for a later seat.
 *
 * `botSeats` (d8vc, 2026-04-25) replaces the legacy `soloVsBot` boolean:
 * each entry is `true` if seat i is a bot, `false` if human. Length
 * matches `players`. Defaults to all-human (`false × players`). Lets
 * any party (1-4) mix human and bot seats — pre-fix the bot option
 * only existed for solo play.
 */
export type GameConfig = {
  players: 1 | 2 | 3 | 4;
  botSeats: boolean[];
  championIds: string[];
};
