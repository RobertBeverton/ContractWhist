import { describe, it, expect } from 'vitest';
import { lastSession, sameGroupCumulative, bidAccuracy } from '../../src/logic/stats.js';

const made = (bid) => ({ bid, won: bid, points: 10 + bid });
const missed = (bid, won) => ({ bid, won, points: 0 });

const sessions = [
  {
    sessionId: '2026-08-18-1930',
    date: '2026-08-18T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam'],
    rounds: [
      { hand: 2, results: { p_alex: made(1), p_sam: missed(1, 0) } },
      { hand: 1, results: { p_alex: missed(1, 0), p_sam: made(1) } },
    ],
  },
  {
    sessionId: '2026-08-25-1930',
    date: '2026-08-25T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam'],
    rounds: [{ hand: 2, results: { p_alex: made(2), p_sam: missed(0, 2) } }],
  },
  {
    sessionId: '2026-08-20-1930',
    date: '2026-08-20T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam', 'p_jo'],
    rounds: [{ hand: 1, results: { p_alex: made(0), p_sam: made(1), p_jo: missed(1, 0) } }],
  },
];

describe('lastSession', () => {
  it('returns the most recent completed session', () => {
    expect(lastSession(sessions).sessionId).toBe('2026-08-25-1930');
  });

  it('ignores in-progress sessions', () => {
    const withOpen = [...sessions, { sessionId: '2026-09-01-1930', status: 'in-progress' }];
    expect(lastSession(withOpen).sessionId).toBe('2026-08-25-1930');
  });

  it('returns null when there is no history', () => {
    expect(lastSession([])).toBeNull();
  });
});

describe('sameGroupCumulative', () => {
  it('sums only sessions with exactly the same player set', () => {
    // The 3-player session must not contribute to the 2-player group.
    const result = sameGroupCumulative(sessions, ['p_alex', 'p_sam']);
    expect(result.totals).toEqual({ p_alex: 23, p_sam: 11 });
  });

  it('matches player sets regardless of order', () => {
    const result = sameGroupCumulative(sessions, ['p_sam', 'p_alex']);
    expect(result.sessionCount).toBe(2);
  });

  it('reports the winner of the most recent session with that group', () => {
    const result = sameGroupCumulative(sessions, ['p_alex', 'p_sam']);
    expect(result.lastWinnerIds).toEqual(['p_alex']);
  });

  it('returns empty when the group has never played', () => {
    expect(sameGroupCumulative(sessions, ['p_zoe']).sessionCount).toBe(0);
  });
});

describe('bidAccuracy', () => {
  it('computes overall accuracy per player', () => {
    // Alex played in all three sessions (the group filter is per-player
    // presence, not session membership): made 1 of 2 in session one, made 1
    // of 1 in session two, made 1 of 1 in session three = 3/4.
    const result = bidAccuracy(sessions, ['p_alex', 'p_sam']);
    expect(result.p_alex.played).toBe(4);
    expect(result.p_alex.made).toBe(3);
  });

  it('breaks accuracy down by hand size', () => {
    const result = bidAccuracy(sessions, ['p_alex', 'p_sam']);
    expect(result.p_alex.byHand[2]).toEqual({ played: 2, made: 2 });
    expect(result.p_alex.byHand[1]).toEqual({ played: 2, made: 1 });
  });

  it('ignores sessions the player did not play in', () => {
    const result = bidAccuracy(sessions, ['p_jo']);
    expect(result.p_jo.played).toBe(1);
  });
});
