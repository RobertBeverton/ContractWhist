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
 * Hand sizes for a whole session: count up from 1 to `maxSize`, then back down to 1.
 * e.g. 3 -> [1, 2, 3, 2, 1]
 */
export function buildHandSequence(maxSize) {
  const up = [];
  for (let n = 1; n <= maxSize; n++) up.push(n);
  const down = [];
  for (let n = maxSize - 1; n >= 1; n--) down.push(n);
  return [...up, ...down];
}
