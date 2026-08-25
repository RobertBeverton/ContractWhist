import { describe, it, expect } from 'vitest';
import { validateRound } from '../../src/logic/validation.js';

const players = ['p_alex', 'p_sam'];

describe('validateRound', () => {
  it('accepts a valid round', () => {
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 1, won: 2 } };
    expect(validateRound({ hand: 5, players, entries })).toEqual([]);
  });

  it('rejects a missing value', () => {
    const entries = { p_alex: { bid: 2, won: null }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'won', message: 'Enter tricks won' });
  });

  it('rejects a value above the hand size', () => {
    const entries = { p_alex: { bid: 6, won: 3 }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'bid', message: 'Must be between 0 and 5' });
  });

  it('rejects a negative value', () => {
    const entries = { p_alex: { bid: -1, won: 3 }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'bid', message: 'Must be between 0 and 5' });
  });

  it('rejects when tricks won do not sum to the hand size', () => {
    const entries = { p_alex: { bid: 2, won: 1 }, p_sam: { bid: 1, won: 1 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ field: 'won', message: 'Tricks won must add up to 5 (currently 2)' });
  });

  it('does not report the sum error while values are still missing', () => {
    // Avoids showing a confusing sum error before the scorer has finished typing.
    const entries = { p_alex: { bid: 2, won: null }, p_sam: { bid: 1, won: 1 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors.some((e) => e.message.startsWith('Tricks won must add up'))).toBe(false);
  });

  it('rejects a dealer bid making bids equal the hand when the rule is on', () => {
    // "Someone must go down": last player in the list is the dealer.
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 3, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries, dealerRestriction: true });
    expect(errors).toContainEqual({
      playerId: 'p_sam',
      field: 'bid',
      message: 'Bids cannot add up to 5 — dealer must change bid',
    });
  });

  it('allows bids equal to the hand when the rule is off', () => {
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 3, won: 2 } };
    expect(validateRound({ hand: 5, players, entries })).toEqual([]);
  });
});
