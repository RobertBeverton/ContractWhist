/**
 * Points for one player in one round.
 * House rule: a made contract scores 10 + bid; a missed one scores 0.
 * A made zero bid therefore scores 10.
 */
export function roundPoints(bid, won) {
  return bid === won ? 10 + bid : 0;
}
