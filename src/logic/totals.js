import { roundPoints } from './scoring.js';

/**
 * Running totals per player, always derived from the full rounds array.
 * Never stored incrementally — recomputing from source is what makes editing
 * an earlier round safe.
 */
export function computeTotals(players, rounds) {
  const totals = Object.fromEntries(players.map((id) => [id, 0]));
  for (const round of rounds) {
    for (const playerId of players) {
      const result = round.results[playerId];
      if (result) totals[playerId] += roundPoints(result.bid, result.won);
    }
  }
  return totals;
}

/**
 * Rank players by descending score. Ties share a rank and the next rank is
 * skipped (standard competition ranking: 1, 1, 3).
 */
export function rankPlayers(totals) {
  const sorted = Object.entries(totals)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score);

  let lastScore = null;
  let lastRank = 0;
  return sorted.map((entry, index) => {
    const rank = entry.score === lastScore ? lastRank : index + 1;
    lastScore = entry.score;
    lastRank = rank;
    return { ...entry, rank };
  });
}
