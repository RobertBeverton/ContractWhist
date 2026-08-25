const FIELD_LABELS = { bid: 'Enter bid', won: 'Enter tricks won' };

function isMissing(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Validate one round's entries. Returns an array of errors (empty === valid).
 * Errors carry `playerId` where they belong to a specific row, so the UI can
 * attach them to that player; round-wide errors omit it.
 *
 * The dealer is the last player in `players`.
 */
export function validateRound({ hand, players, entries, dealerRestriction = false }) {
  const errors = [];

  for (const playerId of players) {
    const entry = entries[playerId] ?? {};
    for (const field of ['bid', 'won']) {
      const value = entry[field];
      if (isMissing(value)) {
        errors.push({ playerId, field, message: FIELD_LABELS[field] });
      } else if (!Number.isInteger(value) || value < 0 || value > hand) {
        errors.push({ playerId, field, message: `Must be between 0 and ${hand}` });
      }
    }
  }

  const allWonPresent = players.every((id) => !isMissing(entries[id]?.won));
  if (allWonPresent) {
    const totalWon = players.reduce((sum, id) => sum + entries[id].won, 0);
    if (totalWon !== hand) {
      errors.push({ field: 'won', message: `Tricks won must add up to ${hand} (currently ${totalWon})` });
    }
  }

  if (dealerRestriction) {
    const allBidsPresent = players.every((id) => !isMissing(entries[id]?.bid));
    if (allBidsPresent) {
      const totalBid = players.reduce((sum, id) => sum + entries[id].bid, 0);
      if (totalBid === hand) {
        const dealerId = players[players.length - 1];
        errors.push({
          playerId: dealerId,
          field: 'bid',
          message: `Bids cannot add up to ${hand} — dealer must change bid`,
        });
      }
    }
  }

  return errors;
}
