import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, STORES } from '../../src/storage/db.js';

beforeEach(async () => {
  // Fresh database per test so state never leaks between them.
  indexedDB.deleteDatabase('contract-whist');
});

describe('openDb', () => {
  it('creates both object stores', async () => {
    const db = await openDb();
    expect([...db.objectStoreNames].sort()).toEqual(['players', 'sessions']);
    db.close();
  });

  it('keys players by id and sessions by sessionId', async () => {
    const db = await openDb();
    const tx = db.transaction([STORES.players, STORES.sessions], 'readonly');
    expect(tx.objectStore(STORES.players).keyPath).toBe('id');
    expect(tx.objectStore(STORES.sessions).keyPath).toBe('sessionId');
    db.close();
  });
});
