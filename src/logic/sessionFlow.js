import { validateRound } from './validation.js';
import { roundPoints } from './scoring.js';

/** Hand size for the round about to be played, or null if the session is done. */
export function currentHand(session) {
  return session.handSequence[session.rounds.length] ?? null;
}

export function isComplete(session) {
  return session.rounds.length >= session.handSequence.length;
}

/** Attach computed points to each player's entry. */
function withPoints(entries, players) {
  const results = {};
  for (const playerId of players) {
    const { bid, won } = entries[playerId];
    results[playerId] = { bid, won, points: roundPoints(bid, won) };
  }
  return results;
}

/**
 * Validate and append a round.
 * Returns `{ session, errors }` — on failure the session is returned unchanged,
 * so callers can render errors without special-casing.
 */
export function lockInRound(session, entries) {
  const hand = currentHand(session);
  if (hand === null) {
    return { session, errors: [{ message: 'This session is already finished' }] };
  }

  const errors = validateRound({
    hand,
    players: session.players,
    entries,
    dealerRestriction: session.rules.dealerRestriction,
  });
  if (errors.length > 0) return { session, errors };

  const round = { hand, results: withPoints(entries, session.players) };
  return { session: { ...session, rounds: [...session.rounds, round] }, errors: [] };
}

/**
 * Replace an already-locked round. Totals are always derived from `rounds`,
 * so correcting a mistake needs no separate recompute step.
 *
 * Validates against `existing.hand` — this round's own stored hand size —
 * not `currentHand(session)`. Later rounds may already exist, in which case
 * currentHand points at a *different*, not-yet-played round; using it here
 * would validate an edit against the wrong hand size.
 */
export function editRound(session, roundIndex, entries) {
  const existing = session.rounds[roundIndex];
  if (!existing) return { session, errors: [{ message: 'That round does not exist' }] };

  const errors = validateRound({
    hand: existing.hand,
    players: session.players,
    entries,
    dealerRestriction: session.rules.dealerRestriction,
  });
  if (errors.length > 0) return { session, errors };

  const rounds = [...session.rounds];
  rounds[roundIndex] = { hand: existing.hand, results: withPoints(entries, session.players) };
  return { session: { ...session, rounds }, errors: [] };
}
