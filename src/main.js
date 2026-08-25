import './styles/base.css';
import { createStore } from './app/store.js';
import { createRouter } from './app/router.js';
import { createActions } from './app/actions.js';
import { loadAllPlayers } from './storage/players.js';
import { loadInProgressSession } from './storage/sessions.js';
import { renderSetup } from './screens/setup.js';
import { renderScorer } from './screens/scorer.js';

const DEFAULT_START_SIZE = 7;

async function main() {
  const allPlayers = await loadAllPlayers();

  const store = createStore({
    screen: 'setup',
    session: null,
    allPlayers,
    playersById: Object.fromEntries(allPlayers.map((player) => [player.id, player])),
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
  const render = createRouter(root, { setup: renderSetup, scorer: renderScorer });

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
