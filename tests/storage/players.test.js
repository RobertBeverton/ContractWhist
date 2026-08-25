import { describe, it, expect, beforeEach } from 'vitest';
import { savePlayer, loadAllPlayers, createPlayer } from '../../src/storage/players.js';

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
