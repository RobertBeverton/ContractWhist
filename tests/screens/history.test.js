// tests/screens/history.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHistory } from '../../src/screens/history.js';

function baseState(overrides = {}) {
  return {
    allSessions: [
      {
        sessionId: 's1',
        date: '2026-08-20T10:00:00.000Z',
        status: 'complete',
        players: ['p1', 'p2'],
        rounds: [
          {
            hand: 1,
            results: {
              p1: { bid: 1, won: 1 },
              p2: { bid: 1, won: 0 },
            },
          },
        ],
      },
    ],
    playersById: {
      p1: { id: 'p1', name: 'Robert' },
      p2: { id: 'p2', name: 'Magda' },
    },
    selectedPlayerIds: [],
    ...overrides,
  };
}

function actions() {
  return {
    goTo: vi.fn(),
  };
}

describe('renderHistory — bid-accuracy legend and alignment', () => {
  it('renders a legend paragraph between the caption and the table', () => {
    const screen = renderHistory({ state: baseState(), actions: actions() });

    const paragraphs = [...screen.querySelectorAll('.muted')];
    const legend = paragraphs.find((p) =>
      p.textContent.includes('A player "makes" a hand by winning exactly as many tricks as they bid.'),
    );
    expect(legend).toBeTruthy();

    // Legend should come after the caption and before the table in DOM order.
    const caption = paragraphs.find((p) =>
      p.textContent.includes('How often each player makes their contract'),
    );
    expect(caption).toBeTruthy();
    expect(
      caption.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const table = screen.querySelector('table');
    expect(
      legend.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
