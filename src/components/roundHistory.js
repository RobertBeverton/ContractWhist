/**
 * Compact log of locked-in rounds, most recent first.
 * Only the latest round can be edited in v1.
 */
export function createRoundHistory({ session, playersById, onEditLatest }) {
  const wrapper = document.createElement('section');
  wrapper.setAttribute('aria-labelledby', 'history-heading');

  const heading = document.createElement('h2');
  heading.id = 'history-heading';
  heading.textContent = 'Rounds played';
  wrapper.append(heading);

  if (session.rounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No rounds played yet.';
    wrapper.append(empty);
    return wrapper;
  }

  const latestIndex = session.rounds.length - 1;

  const list = document.createElement('ol');
  list.className = 'history';
  // Every <li> below sets its own `.value`, which determines its displayed
  // ordinal outright — per the HTML list-numbering algorithm, `reversed`
  // only affects auto-increment direction for items *without* an explicit
  // value, so it has no effect on the numbers actually shown here. Kept
  // anyway as an accurate semantic marker (this list's natural order really
  // is descending) for any tooling that reads the IDL property directly.
  list.reversed = true;

  session.rounds.forEach((round, index) => {
    const item = document.createElement('li');
    item.className = 'history__item';
    item.value = index + 1;

    const summary = session.players
      .map((playerId) => {
        const { bid, won, points } = round.results[playerId];
        const name = playersById[playerId]?.name ?? playerId;
        // "made"/"missed" in words — never colour alone (1.4.1).
        const outcome = bid === won ? 'made' : 'missed';
        return `${name} bid ${bid}, won ${won} — ${outcome} (${points})`;
      })
      .join('; ');

    const text = document.createElement('span');
    text.textContent = `Hand of ${round.hand}: ${summary}`;
    item.append(text);

    if (index === latestIndex) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'history__edit';
      // Accessible name says WHICH round — "Edit" alone is ambiguous (2.4.6).
      editButton.setAttribute('aria-label', `Edit last round, hand of ${round.hand}`);
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', onEditLatest);
      item.append(editButton);
    }

    list.prepend(item); // newest at the top
  });

  wrapper.append(list);
  return wrapper;
}
