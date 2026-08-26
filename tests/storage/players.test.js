import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePlayer,
  loadAllPlayers,
  createPlayer,
  archivePlayer,
  restorePlayer,
} from '../../src/storage/players.js';

beforeEach(() => {
  indexedDB.deleteDatabase('contract-whist');
});

describe('createPlayer', () => {
  it('generates an id from the name', () => {
    expect(createPlayer('Alex').id).toMatch(/^p_/);
  });

  it('gives two players with the same name different ids', () => {
    // Two real people can share a first name; ids must not collide.
    expect(createPlayer('Alex').id).not.toBe(createPlayer('Alex').id);
  });

  it('trims whitespace from the name', () => {
    expect(createPlayer('  Alex  ').name).toBe('Alex');
  });

  it('defaults new players to not archived', () => {
    expect(createPlayer('Alex').archived).toBe(false);
  });
});

describe('savePlayer / loadAllPlayers', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await loadAllPlayers()).toEqual([]);
  });

  it('round-trips a saved player', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);
    expect(await loadAllPlayers()).toEqual([player]);
  });

  it('overwrites a player with the same id rather than duplicating', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);
    await savePlayer({ ...player, name: 'Alexandra' });
    const all = await loadAllPlayers();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Alexandra');
  });

  it('sorts players by name', async () => {
    await savePlayer(createPlayer('Sam'));
    await savePlayer(createPlayer('Alex'));
    expect((await loadAllPlayers()).map((p) => p.name)).toEqual(['Alex', 'Sam']);
  });
});

describe('archivePlayer / restorePlayer', () => {
  it('flips archived to true and preserves id/name', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);

    await archivePlayer(player.id);

    const [stored] = await loadAllPlayers();
    expect(stored.id).toBe(player.id);
    expect(stored.name).toBe('Alex');
    expect(stored.archived).toBe(true);
  });

  it('restorePlayer flips archived back to false', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);
    await archivePlayer(player.id);

    await restorePlayer(player.id);

    const [stored] = await loadAllPlayers();
    expect(stored.archived).toBe(false);
  });

  it('loadAllPlayers still returns archived players (needed for past-session name lookups)', async () => {
    const active = createPlayer('Alex');
    const gone = createPlayer('Sam');
    await savePlayer(active);
    await savePlayer(gone);

    await archivePlayer(gone.id);

    const all = await loadAllPlayers();
    expect(all.map((p) => p.name)).toEqual(['Alex', 'Sam']);
    expect(all.find((p) => p.id === gone.id).archived).toBe(true);
  });

  it('archivePlayer is a no-op if the id does not exist', async () => {
    await expect(archivePlayer('p_missing_0000')).resolves.not.toThrow();
    expect(await loadAllPlayers()).toEqual([]);
  });
});
