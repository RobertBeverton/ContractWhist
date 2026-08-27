// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoundEntry } from '../../src/components/roundEntry.js';

const playersById = { p1: { id: 'p1', name: 'Robert' }, p2: { id: 'p2', name: 'Magda' } };

describe('createRoundEntry — live running totals', () => {
  it('shows tricks-won running total against the hand size as entries are made', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2, won: 3 }, p2: { bid: 1, won: 1 } },
      errors: [],
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Tricks won so far: 4 of 5');
  });

  it('shows 0 when no tricks have been entered yet', () => {
    const el = createRoundEntry({
      hand: 3,
      players: ['p1', 'p2'],
      playersById,
      entries: {},
      errors: [],
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Tricks won so far: 0 of 3');
  });

  it('shows the running bid total when a dealer restriction is in effect', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2 }, p2: { bid: 1 } },
      errors: [],
      dealerRestriction: true,
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Bids so far: 3 of 5');
  });

  it('omits the bid total line when no dealer restriction is in effect', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2 }, p2: { bid: 1 } },
      errors: [],
      dealerRestriction: false,
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).not.toContain('Bids so far');
  });
});
