import { computeTotals, rankPlayers } from './totals.js';

const completed = (sessions) => sessions.filter((s) => s.status === 'complete');
const groupKey = (playerIds) => [...playerIds].sort().join('|');

/** Most recent completed session, or null. */
export function lastSession(sessions) {
  const done = completed(sessions);
  if (done.length === 0) return null;
  return done.reduce((latest, s) => (s.sessionId > latest.sessionId ? s : latest));
}

/**
 * Cumulative scores across every session played by exactly this set of players.
 * Matching is by player id and ignores order — a different set is a different group.
 */
export function sameGroupCumulative(sessions, playerIds) {
  const key = groupKey(playerIds);
  const matching = completed(sessions).filter((s) => groupKey(s.players) === key);

  const totals = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const session of matching) {
    const sessionTotals = computeTotals(session.players, session.rounds);
    for (const [id, score] of Object.entries(sessionTotals)) totals[id] += score;
  }

  const mostRecent = lastSession(matching);
  let lastWinnerIds = [];
  if (mostRecent) {
    const ranked = rankPlayers(computeTotals(mostRecent.players, mostRecent.rounds));
    lastWinnerIds = ranked.filter((r) => r.rank === 1).map((r) => r.playerId);
  }

  return { totals, ranked: rankPlayers(totals), sessionCount: matching.length, lastWinnerIds };
}

/**
 * Contract success rate per player, overall and per hand size.
 * Bidding a 7-card hand is a different skill from bidding a 1-card hand,
 * so the breakdown matters more than the headline number.
 */
export function bidAccuracy(sessions, playerIds) {
  const stats = Object.fromEntries(
    playerIds.map((id) => [id, { played: 0, made: 0, byHand: {} }]),
  );

  for (const session of completed(sessions)) {
    for (const round of session.rounds) {
      for (const playerId of playerIds) {
        const result = round.results[playerId];
        if (!result) continue;

        const entry = stats[playerId];
        const hand = (entry.byHand[round.hand] ??= { played: 0, made: 0 });

        entry.played += 1;
        hand.played += 1;
        if (result.bid === result.won) {
          entry.made += 1;
          hand.made += 1;
        }
      }
    }
  }

  return stats;
}
