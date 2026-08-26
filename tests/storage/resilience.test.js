import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAllSessions } from '../../src/storage/sessions.js';
import { loadAllPlayers } from '../../src/storage/players.js';
import * as db from '../../src/storage/db.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storage resilience', () => {
  it('returns an empty session list when the database cannot be opened', async () => {
    vi.spyOn(db, 'openDb').mockRejectedValue(new Error('IndexedDB unavailable'));
    await expect(loadAllSessions()).resolves.toEqual([]);
  });

  it('returns an empty player list when the database cannot be opened', async () => {
    vi.spyOn(db, 'openDb').mockRejectedValue(new Error('IndexedDB unavailable'));
    await expect(loadAllPlayers()).resolves.toEqual([]);
  });
});
