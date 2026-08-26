import { describe, it, expect } from 'vitest';
import { lockInRound, editRound, currentHand, isComplete } from '../../src/logic/sessionFlow.js';

const base = {
  players: ['p_alex', 'p_sam'],
  handSequence: [2, 1, 2],
  rounds: [],
  rules: { dealerRestriction: false },
};

const entries2 = { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } };

describe('currentHand', () => {
  it('returns the first hand size for a new session', () => {
    expect(currentHand(base)).toBe(2);
  });

  it('advances with each locked-in round', () => {
    const session = { ...base, rounds: [{ hand: 2, results: entries2 }] };
    expect(currentHand(session)).toBe(1);
  });

  it('returns null once every round is played', () => {
    const rounds = [
      { hand: 2, results: entries2 },
      { hand: 1, results: {} },
      { hand: 2, results: entries2 },
    ];
    expect(currentHand({ ...base, rounds })).toBeNull();
  });
});

describe('lockInRound', () => {
  it('appends a validated round', () => {
    const result = lockInRound(base, entries2);
    expect(result.errors).toEqual([]);
    expect(result.session.rounds).toHaveLength(1);
  });

  it('stores computed points with the round', () => {
    const result = lockInRound(base, entries2);
    expect(result.session.rounds[0].results.p_alex).toEqual({ bid: 1, won: 1, points: 11 });
  });

  it('rejects an invalid round without changing the session', () => {
    const bad = { p_alex: { bid: 1, won: 2 }, p_sam: { bid: 1, won: 1 } };
    const result = lockInRound(base, bad);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.session.rounds).toHaveLength(0);
  });

  it('applies the dealer restriction when the session enables it', () => {
    const session = { ...base, rules: { dealerRestriction: true } };
    const bids = { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } };
    expect(lockInRound(session, bids).errors.length).toBeGreaterThan(0);
  });

  it('rejects locking in a round once the session is already finished', () => {
    const rounds = [
      { hand: 2, results: entries2 },
      { hand: 1, results: {} },
      { hand: 2, results: entries2 },
    ];
    const finished = { ...base, rounds };
    const result = lockInRound(finished, entries2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.session).toBe(finished);
  });
});

describe('editRound', () => {
  it('replaces an existing round and recomputes its points', () => {
    const session = lockInRound(base, entries2).session;
    const corrected = { p_alex: { bid: 2, won: 2 }, p_sam: { bid: 0, won: 0 } };
    const result = editRound(session, 0, corrected);
    expect(result.errors).toEqual([]);
    expect(result.session.rounds[0].results.p_alex.points).toBe(12);
  });

  it('validates the edit against that round\'s hand size', () => {
    const session = lockInRound(base, entries2).session;
    const invalid = { p_alex: { bid: 1, won: 2 }, p_sam: { bid: 1, won: 1 } };
    expect(editRound(session, 0, invalid).errors.length).toBeGreaterThan(0);
  });
});

describe('isComplete', () => {
  it('is false mid-session', () => {
    expect(isComplete(base)).toBe(false);
  });

  it('is true when all rounds are played', () => {
    const rounds = [{ hand: 2 }, { hand: 1 }, { hand: 2 }];
    expect(isComplete({ ...base, rounds })).toBe(true);
  });
});
