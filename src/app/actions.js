import { lockInRound, editRound } from '../logic/sessionFlow.js';
import { saveSession, createSession } from '../storage/sessions.js';
import { createPlayer, savePlayer } from '../storage/players.js';

export function createActions(store) {
  const get = () => store.getState();

  /**
   * Autosave after every change that alters the record.
   *
   * On failure this sets `saveError` (not `statusMessage`) — a dedicated,
   * always-visible field distinct from the polite live-region status text,
   * because a save failure is exactly the kind of thing a sighted user must
   * actually see, not just have announced to assistive tech. Cleared by the
   * next successful persist.
   */
  async function persist(session) {
    try {
      await saveSession(session);
      store.setState({ saveError: null });
      return true;
    } catch (error) {
      console.error('Autosave failed', error);
      store.setState({
        saveError: 'Could not save — your scores are still on screen, but not backed up. Keep playing; the next round will try saving again.',
      });
      return false;
    }
  }

  return {
    updateEntry(playerId, field, value) {
      const { entries } = get();
      store.setState({
        entries: { ...entries, [playerId]: { ...entries[playerId], [field]: value } },
      });
    },

    async lockInRound() {
      if (get().saving) return; // ignore a double-tap/double-fire while a save is in flight
      const { session, entries } = get();
      const { session: next, errors } = lockInRound(session, entries);
      if (errors.length > 0) return store.setState({ errors });

      store.setState({
        session: next,
        entries: {},
        errors: [],
        statusMessage: 'Round saved.',
        saving: true,
      });
      await persist(next);
      store.setState({ saving: false });
    },

    editLatestRound() {
      const { session } = get();
      const index = session.rounds.length - 1;
      if (index < 0) return;
      // Pre-fill the form with what was entered, so a fix is a tweak not a retype.
      const existing = session.rounds[index].results;
      const entries = Object.fromEntries(
        Object.entries(existing).map(([id, { bid, won }]) => [id, { bid, won }]),
      );
      store.setState({ editingIndex: index, entries, errors: [] });
    },

    async saveEdit() {
      if (get().saving) return;
      const { session, entries, editingIndex } = get();
      const { session: next, errors } = editRound(session, editingIndex, entries);
      if (errors.length > 0) return store.setState({ errors });

      store.setState({
        session: next,
        entries: {},
        errors: [],
        editingIndex: null,
        statusMessage: 'Round updated.',
        saving: true,
      });
      await persist(next);
      store.setState({ saving: false });
    },

    cancelEdit() {
      store.setState({ editingIndex: null, entries: {}, errors: [] });
    },

    async endSession() {
      // No confirmation here — src/screens/scorer.js already gates the call
      // behind window.confirm() before invoking this action (except when the
      // session is already complete, where nothing is lost by ending).
      if (get().saving) return;
      const { session } = get();
      const finished = { ...session, status: 'complete' };
      store.setState({ session: finished, screen: 'summary', saving: true });
      await persist(finished);
      store.setState({ saving: false });
    },

    async addPlayer(name) {
      const player = createPlayer(name);
      await savePlayer(player);
      const { allPlayers, playersById } = get();
      store.setState({
        allPlayers: [...allPlayers, player].sort((a, b) => a.name.localeCompare(b.name)),
        // Kept in sync with allPlayers — the scorer screen looks names up
        // here, and a player added right before starting a session would
        // otherwise render as a raw id instead of their name.
        playersById: { ...playersById, [player.id]: player },
      });
    },

    togglePlayer(id) {
      const { selectedPlayerIds } = get();
      const next = selectedPlayerIds.includes(id)
        ? selectedPlayerIds.filter((playerId) => playerId !== id)
        : [...selectedPlayerIds, id];
      store.setState({ selectedPlayerIds: next });
    },

    setDealerRestriction(value) {
      store.setState({ dealerRestriction: value });
    },

    setStartSize(value) {
      store.setState({ startSize: value });
    },

    async startSession() {
      const { selectedPlayerIds, startSize, dealerRestriction } = get();
      const session = createSession({
        players: selectedPlayerIds,
        startSize,
        dealerRestriction,
      });
      store.setState({ session, screen: 'scorer', entries: {}, errors: [], editingIndex: null });
      // Persist immediately: a session becomes resumable ("in-progress" in
      // storage) the moment it exists, not after the first round is locked
      // in. Without this, closing the tab before round 1 would leave nothing
      // for loadInProgressSession() to find, defeating the resume feature
      // for exactly the window right after setup.
      await persist(session);
    },
  };
}
