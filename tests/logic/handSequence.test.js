import { describe, it, expect } from 'vitest';
import { maxHandSize, buildHandSequence } from '../../src/logic/handSequence.js';

describe('maxHandSize', () => {
  it('reserves one card for the trump turn-up with 4 players', () => {
    // 52 cards, 1 held back for trumps, 51/4 = 12 (not 13).
    expect(maxHandSize(4)).toBe(12);
  });

  it('computes the cap for 5 players', () => {
    expect(maxHandSize(5)).toBe(10);
  });

  it('computes the cap for 2 players', () => {
    expect(maxHandSize(2)).toBe(25);
  });
});

describe('buildHandSequence', () => {
  it('counts down to 1 then back up to the start', () => {
    expect(buildHandSequence(3)).toEqual([3, 2, 1, 2, 3]);
  });

  it('handles a start size of 1 as a single round', () => {
    expect(buildHandSequence(1)).toEqual([1]);
  });

  it('produces 2n-1 rounds for a start size of n', () => {
    expect(buildHandSequence(7)).toHaveLength(13);
  });
});
