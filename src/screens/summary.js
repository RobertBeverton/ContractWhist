import { computeTotals, rankPlayers } from '../logic/totals.js';

/**
 * Session summary screen: final rankings, export, and next steps.
 *
 * Read-only — `state.session` here is already `status: 'complete'` and
 * already persisted by actions.endSession() (Task 20). This screen never
 * mutates it.
 *
 * "New session": a bare `actions.goTo('setup')` would leave the setup
 * screen's fields (`selectedPlayerIds`, `dealerRestriction`, `maxSize`)
 * exactly as they were — which reads as a deliberate "quick rematch"
 * shortcut (same group, same house rules, one tap to start again) and is
 * kept. What's NOT kept is `state.session`: without clearing it, `session`
 * would keep pointing at the just-finished, already-complete session while
 * the UI shows the setup form for a *new* one, until startSession()
 * eventually overwrites it. Not a live bug today (renderSetup never reads
 * state.session), but stale enough to be a landmine for whatever's added to
 * the setup screen next — so it's cleared here rather than inside `goTo`,
 * which stays a generic, screen-agnostic navigation primitive (the history
 * screen's "Back" button also calls `goTo('setup')` and — unlike this
 * button — should NOT clear the in-progress selection).
 */
export function renderSummary({ state, actions }) {
  const { session, playersById } = state;
  const screen = document.createElement('section');
  screen.className = 'screen summary';

  const heading = document.createElement('h1');
  heading.textContent = 'Final scores';
  screen.append(heading);

  const ranked = rankPlayers(computeTotals(session.players, session.rounds));
  const winners = ranked.filter((r) => r.rank === 1);

  const winnerLine = document.createElement('p');
  winnerLine.className = winners.length > 1 ? 'summary__winner summary__winner--tied' : 'summary__winner';
  const names = winners.map((w) => playersById[w.playerId]?.name ?? w.playerId);
  winnerLine.textContent =
    winners.length === 1
      ? `${names[0]} wins with ${winners[0].score} points.`
      : `Tied on ${winners[0].score} points: ${names.join(' and ')}.`;
  screen.append(winnerLine);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Position', 'Player', 'Score']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const { playerId, score, rank } of ranked) {
    const row = document.createElement('tr');
    if (rank === 1 && winners.length > 1) {
      row.className = 'summary__tied-row';
    }

    const rankCell = document.createElement('td');
    rankCell.textContent = String(rank);

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = playersById[playerId]?.name ?? playerId;

    const scoreCell = document.createElement('td');
    scoreCell.className = 'totals__score';
    scoreCell.textContent = String(score);

    row.append(rankCell, nameCell, scoreCell);
    tbody.append(row);
  }
  table.append(thead, tbody);

  // The table itself scrolls horizontally rather than the whole page, so a
  // narrow viewport (1.4.10 Reflow) never gets a page-wide horizontal
  // scrollbar just because this one table is a little wide.
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.append(table);
  screen.append(tableWrapper);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export this session';
  exportButton.addEventListener('click', () => actions.exportSession(session));

  const historyButton = document.createElement('button');
  historyButton.type = 'button';
  historyButton.textContent = 'View history and stats';
  historyButton.addEventListener('click', () => actions.viewHistory());

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'primary';
  newButton.textContent = 'New session';
  newButton.addEventListener('click', () => actions.startNewSession());

  screen.append(exportButton, historyButton, newButton);
  return screen;
}
