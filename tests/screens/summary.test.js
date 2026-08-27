// tests/screens/summary.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderSummary } from '../../src/screens/summary.js';

function baseState(overrides = {}) {
  return {
    session: {
      players: ['p1', 'p2', 'p3'],
      rounds: [],
      status: 'complete',
    },
    playersById: {
      p1: { id: 'p1', name: 'Robert' },
      p2: { id: 'p2', name: 'Magda' },
      p3: { id: 'p3', name: 'Sam' },
    },
    ...overrides,
  };
}

function actions() {
  return {
    exportSession: vi.fn(),
    viewHistory: vi.fn(),
    startNewSession: vi.fn(),
  };
}

describe('renderSummary — tie callout', () => {
  it('marks a tied-for-first session with summary__winner--tied and summary__tied-row', () => {
    const state = baseState({
      session: {
        players: ['p1', 'p2', 'p3'],
        status: 'complete',
        rounds: [
          {
            hand: 2,
            results: {
              p1: { bid: 2, won: 2 }, // 12 points
              p2: { bid: 2, won: 2 }, // 12 points
              p3: { bid: 1, won: 0 }, // 0 points
            },
          },
        ],
      },
    });

    const screen = renderSummary({ state, actions: actions() });

    const winnerLine = screen.querySelector('.summary__winner');
    expect(winnerLine.classList.contains('summary__winner--tied')).toBe(true);

    const tiedRows = screen.querySelectorAll('tbody tr.summary__tied-row');
    expect(tiedRows.length).toBe(2);
  });

  it('does not add tie classes for a session with a single winner', () => {
    const state = baseState({
      session: {
        players: ['p1', 'p2', 'p3'],
        status: 'complete',
        rounds: [
          {
            hand: 2,
            results: {
              p1: { bid: 2, won: 2 }, // 12 points
              p2: { bid: 1, won: 0 }, // 0 points
              p3: { bid: 1, won: 0 }, // 0 points
            },
          },
        ],
      },
    });

    const screen = renderSummary({ state, actions: actions() });

    const winnerLine = screen.querySelector('.summary__winner');
    expect(winnerLine.classList.contains('summary__winner--tied')).toBe(false);

    const tiedRows = screen.querySelectorAll('tbody tr.summary__tied-row');
    expect(tiedRows.length).toBe(0);
  });
});
