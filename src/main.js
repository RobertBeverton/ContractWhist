import './styles/base.css';
import { createStore } from './app/store.js';
import { createRouter } from './app/router.js';
import { createActions } from './app/actions.js';
import { loadAllPlayers } from './storage/players.js';
import { loadAllSessions, loadInProgressSession } from './storage/sessions.js';
import { renderSetup } from './screens/setup.js';
import { renderScorer } from './screens/scorer.js';
import { renderSummary } from './screens/summary.js';
import { renderHistory } from './screens/history.js';

const DEFAULT_START_SIZE = 7;

async function main() {
  const allPlayers = await loadAllPlayers();
  // Seeded at boot so the history screen has something to show even before
  // its first visit; actions.viewHistory() refetches this on every
  // navigation there so a session finished this run also shows up (see
  // that action's comment in src/app/actions.js for why a refetch-on-nav
  // beats trying to keep this continuously in sync with every save).
  const allSessions = await loadAllSessions();

  const store = createStore({
    screen: 'setup',
    session: null,
    allPlayers,
    playersById: Object.fromEntries(allPlayers.map((player) => [player.id, player])),
    allSessions,
    selectedPlayerIds: [],
    dealerRestriction: false,
    startSize: DEFAULT_START_SIZE,
    entries: {},
    errors: [],
    editingIndex: null,
    statusMessage: null,
    saveError: null,
    saving: false,
  });

  const actions = createActions(store);
  const root = document.querySelector('#app');
  const render = createRouter(root, {
    setup: renderSetup,
    scorer: renderScorer,
    summary: renderSummary,
    history: renderHistory,
  });

  store.subscribe((state) => render(state, actions));

  const inProgress = await loadInProgressSession();
  if (inProgress) {
    const resume = window.confirm(
      `Resume the session from ${new Date(inProgress.date).toLocaleString()}?`,
    );
    if (resume) {
      store.setState({ session: inProgress, screen: 'scorer' });
    }
  }

  render(store.getState(), actions);
}

main();
