import { openDb, promisifyRequest, STORES } from './db.js';
import { buildHandSequence } from '../logic/handSequence.js';

/** `2026-08-25-1930` — sortable, and unique enough for one tablet. */
function buildSessionId(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function createSession({ players, startSize, dealerRestriction, now = new Date() }) {
  return {
    sessionId: buildSessionId(now),
    date: now.toISOString(),
    status: 'in-progress',
    rules: { dealerRestriction },
    players: [...players],
    handSequence: buildHandSequence(startSize),
    rounds: [],
  };
}

export async function saveSession(session) {
  const db = await openDb();
  const tx = db.transaction(STORES.sessions, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.sessions).put(session));
  db.close();
}

/** All sessions, newest first. */
export async function loadAllSessions() {
  const db = await openDb();
  const tx = db.transaction(STORES.sessions, 'readonly');
  const sessions = await promisifyRequest(tx.objectStore(STORES.sessions).getAll());
  db.close();
  return sessions.sort((a, b) => b.sessionId.localeCompare(a.sessionId));
}

/** The most recent unfinished session, if one was interrupted. */
export async function loadInProgressSession() {
  const sessions = await loadAllSessions();
  return sessions.find((s) => s.status === 'in-progress') ?? null;
}
