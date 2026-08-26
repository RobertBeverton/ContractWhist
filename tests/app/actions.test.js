import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../../src/app/store.js';
import { createActions } from '../../src/app/actions.js';
import { createPlayer, savePlayer, loadAllPlayers } from '../../src/storage/players.js';

beforeEach(() => {
  indexedDB.deleteDatabase('contract-whist');
});

function setupStoreWithPlayer(name = 'Alex') {
  const player = createPlayer(name);
  const store = createStore({
    allPlayers: [player],
    playersById: { [player.id]: player },
    selectedPlayerIds: [],
  });
  return { player, store, actions: createActions(store) };
}

describe('actions.archivePlayer', () => {
  it('marks the player archived in allPlayers and playersById state', async () => {
    const { player, store, actions } = setupStoreWithPlayer();
    await savePlayer(player);

    await actions.archivePlayer(player.id);

    const { allPlayers, playersById } = store.getState();
    expect(allPlayers.find((p) => p.id === player.id).archived).toBe(true);
    expect(playersById[player.id].archived).toBe(true);
  });

  it('persists the archive to storage', async () => {
    const { player, store, actions } = setupStoreWithPlayer();
    await savePlayer(player);

    await actions.archivePlayer(player.id);

    const [stored] = await loadAllPlayers();
    expect(stored.archived).toBe(true);
    expect(stored.id).toBe(player.id);
    expect(stored.name).toBe(player.name);
  });

  it('un-checks the player from selectedPlayerIds for the session being set up', async () => {
    const { player, store, actions } = setupStoreWithPlayer();
    await savePlayer(player);
    store.setState({ selectedPlayerIds: [player.id] });

    await actions.archivePlayer(player.id);

    expect(store.getState().selectedPlayerIds).not.toContain(player.id);
  });

  it('does not touch an unrelated selected player', async () => {
    const { player, store, actions } = setupStoreWithPlayer('Alex');
    const other = createPlayer('Sam');
    await savePlayer(player);
    await savePlayer(other);
    store.setState({
      allPlayers: [player, other],
      playersById: { [player.id]: player, [other.id]: other },
      selectedPlayerIds: [player.id, other.id],
    });

    await actions.archivePlayer(player.id);

    expect(store.getState().selectedPlayerIds).toEqual([other.id]);
  });
});

describe('actions.restorePlayer', () => {
  it('flips archived back to false in state and storage', async () => {
    const { player, store, actions } = setupStoreWithPlayer();
    await savePlayer(player);
    await actions.archivePlayer(player.id);

    await actions.restorePlayer(player.id);

    const { allPlayers, playersById } = store.getState();
    expect(allPlayers.find((p) => p.id === player.id).archived).toBe(false);
    expect(playersById[player.id].archived).toBe(false);

    const [stored] = await loadAllPlayers();
    expect(stored.archived).toBe(false);
  });
});
