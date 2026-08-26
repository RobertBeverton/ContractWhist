import { describe, it, expect } from 'vitest';
import { computeTotals, rankPlayers } from '../../src/logic/totals.js';

const players = ['p_alex', 'p_sam'];
const rounds = [
  { hand: 2, results: { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } } },
  { hand: 1, results: { p_alex: { bid: 0, won: 1 }, p_sam: { bid: 1, won: 0 } } },
];

describe('computeTotals', () => {
  it('sums points across rounds', () => {
    // Alex: made 1 (11) + missed (0) = 11. Sam: made 1 (11) + missed (0) = 11.
    expect(computeTotals(players, rounds)).toEqual({ p_alex: 11, p_sam: 11 });
  });

  it('returns zeroes when no rounds have been played', () => {
    expect(computeTotals(players, [])).toEqual({ p_alex: 0, p_sam: 0 });
  });
});

describe('rankPlayers', () => {
  it('ranks by descending score', () => {
    const ranked = rankPlayers({ p_alex: 20, p_sam: 35, p_jo: 12 });
    expect(ranked.map((r) => r.playerId)).toEqual(['p_sam', 'p_alex', 'p_jo']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('gives tied players the same rank and skips the next', () => {
    const ranked = rankPlayers({ p_alex: 20, p_sam: 20, p_jo: 12 });
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
