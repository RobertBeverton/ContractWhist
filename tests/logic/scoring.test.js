import { describe, it, expect } from 'vitest';
import { roundPoints } from '../../src/logic/scoring.js';

describe('roundPoints', () => {
  it('scores a made contract as 10 + bid', () => {
    expect(roundPoints(3, 3)).toBe(13);
  });

  it('scores a made zero bid as 10', () => {
    // House rule: a made nil bid is worth 10, not 0. See spec "Scoring rule".
    expect(roundPoints(0, 0)).toBe(10);
  });

  it('scores a missed contract as 0 when under', () => {
    expect(roundPoints(3, 1)).toBe(0);
  });

  it('scores a missed contract as 0 when over', () => {
    // Taking more tricks than bid is still a failed contract.
    expect(roundPoints(1, 2)).toBe(0);
  });
});
