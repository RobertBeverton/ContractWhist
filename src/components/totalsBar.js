import { computeTotals, rankPlayers } from '../logic/totals.js';

/**
 * Running totals for every player.
 * A table (not divs) so a screen reader can pair each name with its score.
 */
export function createTotalsBar({ session, playersById }) {
  const wrapper = document.createElement('section');
  wrapper.className = 'totals';
  wrapper.setAttribute('aria-labelledby', 'totals-heading');

  const heading = document.createElement('h2');
  heading.id = 'totals-heading';
  heading.textContent = 'Scores';
  heading.className = 'visually-hidden';

  const totals = computeTotals(session.players, session.rounds);
  const ranked = rankPlayers(totals);

  const table = document.createElement('table');
  table.className = 'totals__table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Player', 'Score']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const { playerId, score } of ranked) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = playersById[playerId]?.name ?? playerId;

    const scoreCell = document.createElement('td');
    scoreCell.className = 'totals__score';
    scoreCell.textContent = String(score);

    row.append(nameCell, scoreCell);
    tbody.append(row);
  }

  table.append(thead, tbody);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.append(table);
  wrapper.append(heading, tableWrapper);
  return wrapper;
}
