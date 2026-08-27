import { createStepper } from './stepper.js';

/**
 * Bid + tricks-won entry for one round.
 *
 * @param {object} options
 * @param {number} options.hand      - hand size (also the max for each field)
 * @param {string[]} options.players - player ids, dealer last
 * @param {object} options.playersById
 * @param {object} options.entries   - { [playerId]: { bid, won } }
 * @param {Array} options.errors     - from validateRound
 * @param {boolean} [options.dealerRestriction] - when true, also show the running bid total
 * @param {(playerId: string, field: string, value: number|null) => void} options.onChange
 */
export function createRoundEntry({ hand, players, playersById, entries, errors, dealerRestriction, onChange }) {
  const form = document.createElement('div');
  form.className = 'round-entry';

  const errorFor = (playerId, field) =>
    errors.find((e) => e.playerId === playerId && e.field === field);

  players.forEach((playerId, index) => {
    const isDealer = index === players.length - 1;
    const row = document.createElement('div');
    row.className = 'round-entry__row';

    const name = document.createElement('h3');
    name.className = 'round-entry__name';
    name.textContent = playersById[playerId]?.name ?? playerId;
    if (isDealer) {
      // Text, not just styling — the dealer matters for the bidding rule (1.4.1).
      const dealerTag = document.createElement('span');
      dealerTag.className = 'round-entry__dealer';
      dealerTag.textContent = ' (dealer)';
      name.append(dealerTag);
    }
    row.append(name);

    for (const field of ['bid', 'won']) {
      const error = errorFor(playerId, field);
      const errorId = `error-${playerId}-${field}`;

      row.append(
        createStepper({
          id: `${field}-${playerId}`,
          label: field === 'bid' ? 'Bid' : 'Tricks won',
          value: entries[playerId]?.[field] ?? null,
          min: 0,
          max: hand,
          invalid: Boolean(error),
          describedBy: error ? errorId : undefined,
          onChange: (value) => onChange(playerId, field, value),
        }),
      );

      if (error) {
        const message = document.createElement('p');
        message.id = errorId;
        message.className = 'error';
        message.textContent = error.message;
        row.append(message);
      }
    }

    form.append(row);
  });

  // Live feedback so a player sees the running total build up as bids/wins
  // are entered, rather than only finding out it's wrong after "Lock in
  // round". validateRound() already computes the same final numbers, this
  // just surfaces the partial sum earlier, from the same `entries` data
  // already passed in.
  const wonSoFar = players.reduce((sum, id) => sum + (entries[id]?.won ?? 0), 0);
  const summary = document.createElement('p');
  summary.className = 'round-entry__summary muted';
  summary.setAttribute('aria-live', 'polite');
  let summaryText = `Tricks won so far: ${wonSoFar} of ${hand}`;
  if (dealerRestriction) {
    const bidSoFar = players.reduce((sum, id) => sum + (entries[id]?.bid ?? 0), 0);
    summaryText += `. Bids so far: ${bidSoFar} of ${hand}`;
  }
  summary.textContent = summaryText;
  form.append(summary);

  return form;
}
