const DECK_SIZE = 52;
const TRUMP_CARD_RESERVE = 1;

/**
 * Largest hand size dealable to `playerCount` players.
 * One card is always held back undealt to turn up as the trump indicator,
 * so the deck is never fully dealt out.
 */
export function maxHandSize(playerCount) {
  return Math.floor((DECK_SIZE - TRUMP_CARD_RESERVE) / playerCount);
}

/**
 * Hand sizes for a whole session: count down from `startSize` to 1, then back up.
 * e.g. 3 -> [3, 2, 1, 2, 3]
 */
export function buildHandSequence(startSize) {
  const down = [];
  for (let n = startSize; n >= 1; n--) down.push(n);
  const up = [];
  for (let n = 2; n <= startSize; n++) up.push(n);
  return [...down, ...up];
}
