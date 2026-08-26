import { openDb, promisifyRequest, STORES } from './db.js';
import { buildHandSequence } from '../logic/handSequence.js';

/**
 * `2026-08-25-1930-a1b2` — sortable, with a random suffix so two sessions
 * started within the same clock minute (e.g. restarting a misconfigured
 * session) don't collide. saveSession does a `put`, so a colliding id would
 * silently overwrite the earlier session rather than erroring.
 */
function buildSessionId(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

export function createSession({ players, maxSize, dealerRestriction, now = new Date() }) {
  return {
    sessionId: buildSessionId(now),
    date: now.toISOString(),
    status: 'in-progress',
    rules: { dealerRestriction },
    players: [...players],
    handSequence: buildHandSequence(maxSize),
    rounds: [],
  };
}

export async function saveSession(session) {
  const db = await openDb();
  const tx = db.transaction(STORES.sessions, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.sessions).put(session));
  db.close();
}

/** All sessions, newest first. Degrades to [] if storage is unavailable. */
export async function loadAllSessions() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.sessions, 'readonly');
    const sessions = await promisifyRequest(tx.objectStore(STORES.sessions).getAll());
    db.close();
    return sessions.sort((a, b) => b.sessionId.localeCompare(a.sessionId));
  } catch (error) {
    console.warn('Could not load sessions; continuing with none.', error);
    return [];
  }
}

/** The most recent unfinished session, if one was interrupted. */
export async function loadInProgressSession() {
  const sessions = await loadAllSessions();
  return sessions.find((s) => s.status === 'in-progress') ?? null;
}
