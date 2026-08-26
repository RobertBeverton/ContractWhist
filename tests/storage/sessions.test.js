import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSession,
  loadAllSessions,
  loadInProgressSession,
  createSession,
} from '../../src/storage/sessions.js';

beforeEach(() => {
  indexedDB.deleteDatabase('contract-whist');
});

const players = ['p_alex', 'p_sam'];

describe('createSession', () => {
  it('starts in progress with no rounds', () => {
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    expect(session.status).toBe('in-progress');
    expect(session.rounds).toEqual([]);
  });

  it('records the rule variant in use', () => {
    // Recorded per session so old sessions stay unambiguous if the rule changes.
    const session = createSession({ players, maxSize: 3, dealerRestriction: true });
    expect(session.rules).toEqual({ dealerRestriction: true });
  });

  it('stores the hand sequence for the session', () => {
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    expect(session.handSequence).toEqual([1, 2, 3, 2, 1]);
  });
});

describe('saveSession / loadAllSessions', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await loadAllSessions()).toEqual([]);
  });

  it('round-trips a session', async () => {
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    await saveSession(session);
    expect(await loadAllSessions()).toEqual([session]);
  });

  it('overwrites on repeated save rather than duplicating', async () => {
    // Autosave writes the same sessionId after every round.
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    await saveSession(session);
    await saveSession({ ...session, rounds: [{ hand: 3, results: {} }] });
    const all = await loadAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0].rounds).toHaveLength(1);
  });
});

describe('loadInProgressSession', () => {
  it('returns null when there is no interrupted session', async () => {
    expect(await loadInProgressSession()).toBeNull();
  });

  it('finds an in-progress session to resume', async () => {
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    await saveSession(session);
    expect((await loadInProgressSession()).sessionId).toBe(session.sessionId);
  });

  it('ignores completed sessions', async () => {
    const session = createSession({ players, maxSize: 3, dealerRestriction: false });
    await saveSession({ ...session, status: 'complete' });
    expect(await loadInProgressSession()).toBeNull();
  });
});
