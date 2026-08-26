const DB_NAME = 'contract-whist';
const DB_VERSION = 1;

export const STORES = { players: 'players', sessions: 'sessions' };

/** Open (and if needed create) the app database. */
export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.players)) {
        db.createObjectStore(STORES.players, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade blocked by another open connection'));
  });
}

/**
 * Promise wrapper around a single IndexedDB request.
 * Resolves on the request's own success, not the enclosing transaction's
 * completion — correct for the single-request-per-transaction calls this
 * project makes (put/getAll), not safe to reuse inside a multi-request
 * transaction without also gating on tx.oncomplete.
 */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
