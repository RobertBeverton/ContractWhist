import { lastSession, sameGroupCumulative, bidAccuracy } from '../logic/stats.js';
import { rankPlayers, computeTotals } from '../logic/totals.js';

const percent = (made, played) => (played === 0 ? '—' : `${Math.round((made / played) * 100)}%`);

/**
 * History and stats screen: last session recap, same-group all-time totals,
 * and bid accuracy across every known player.
 *
 * `state.allSessions` is fetched fresh by `actions.viewHistory()` right
 * before navigating here (see src/app/actions.js) rather than kept live —
 * this is the one screen that reads session history in bulk, so refetching
 * on the way in is simpler and just as correct as trying to keep
 * `allSessions` continuously in sync with every save.
 */
export function renderHistory({ state, actions }) {
  const { allSessions, playersById, selectedPlayerIds } = state;
  const screen = document.createElement('section');
  screen.className = 'screen history-screen';

  const heading = document.createElement('h1');
  heading.textContent = 'History and stats';
  screen.append(heading);

  const nameOf = (id) => playersById[id]?.name ?? id;

  // Spec: never hard-fail on empty or unreadable history.
  if (allSessions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No past sessions found yet.';
    screen.append(empty, backButton(actions));
    return screen;
  }

  // --- Last session -----------------------------------------------------
  const latest = lastSession(allSessions);
  if (latest) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Last session';
    const when = document.createElement('p');
    when.textContent = new Date(latest.date).toLocaleDateString();

    const ranked = rankPlayers(computeTotals(latest.players, latest.rounds));
    const list = document.createElement('ol');
    for (const { playerId, score } of ranked) {
      const item = document.createElement('li');
      item.textContent = `${nameOf(playerId)} — ${score}`;
      list.append(item);
    }
    section.append(h2, when, list);
    screen.append(section);
  }

  // --- Same-group cumulative -------------------------------------------
  if (selectedPlayerIds.length >= 2) {
    const group = sameGroupCumulative(allSessions, selectedPlayerIds);
    const section = document.createElement('section');
    section.className = 'history-screen__all-time';
    const h2 = document.createElement('h2');
    h2.textContent = 'This group, all time';

    const summary = document.createElement('p');
    summary.textContent =
      group.sessionCount === 0
        ? 'This exact group has not played together yet.'
        : `${group.sessionCount} sessions together. ` +
          `Last won by ${group.lastWinnerIds.map(nameOf).join(' and ')}.`;

    section.append(h2, summary);

    if (group.sessionCount > 0) {
      const list = document.createElement('ol');
      for (const { playerId, score } of group.ranked) {
        const item = document.createElement('li');
        item.textContent = `${nameOf(playerId)} — ${score}`;
        list.append(item);
      }
      section.append(list);
    }
    screen.append(section);
  }

  // --- Bid accuracy -----------------------------------------------------
  const knownPlayerIds = Object.keys(playersById);
  const accuracy = bidAccuracy(allSessions, knownPlayerIds);
  const handSizes = [
    ...new Set(
      Object.values(accuracy).flatMap((entry) => Object.keys(entry.byHand).map(Number)),
    ),
  ].sort((a, b) => a - b);

  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Bid accuracy';
  const caption = document.createElement('p');
  caption.className = 'muted';
  caption.textContent = 'How often each player makes their contract, by hand size.';
  const legend = document.createElement('p');
  legend.className = 'muted';
  legend.textContent = 'A player "makes" a hand by winning exactly as many tricks as they bid.';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Player', 'Overall', ...handSizes.map((h) => `${h}-card`)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const playerId of knownPlayerIds) {
    const entry = accuracy[playerId];
    if (entry.played === 0) continue;

    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = nameOf(playerId);
    row.append(nameCell);

    const overall = document.createElement('td');
    overall.textContent = `${percent(entry.made, entry.played)} (${entry.made}/${entry.played})`;
    row.append(overall);

    for (const hand of handSizes) {
      const cell = document.createElement('td');
      const stat = entry.byHand[hand];
      cell.textContent = stat ? percent(stat.made, stat.played) : '—';
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(thead, tbody);

  // This table's column count grows with the number of distinct hand sizes
  // played, so it's the app's most likely candidate to overflow a narrow
  // viewport (1.4.10 Reflow) — scroll the table itself, not the page.
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.append(table);
  section.append(h2, caption, legend, tableWrapper);
  screen.append(section, backButton(actions));

  return screen;
}

function backButton(actions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Back';
  button.addEventListener('click', () => actions.goTo('setup'));
  return button;
}
