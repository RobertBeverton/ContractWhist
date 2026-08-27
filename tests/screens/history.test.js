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

describe('renderHistory — all-time section class hook', () => {
  it('adds history-screen__all-time only to the "This group, all time" section', () => {
    const screen = renderHistory({
      state: baseState({ selectedPlayerIds: ['p1', 'p2'] }),
      actions: actions(),
    });

    const allTimeSections = screen.querySelectorAll('.history-screen__all-time');
    expect(allTimeSections.length).toBe(1);

    const h2 = allTimeSections[0].querySelector('h2');
    expect(h2.textContent).toBe('This group, all time');

    // Sanity check: no other section (e.g. "Last session", bid accuracy)
    // picked up the class.
    const sections = [...screen.querySelectorAll('section')];
    const withClass = sections.filter((s) => s.classList.contains('history-screen__all-time'));
    expect(withClass).toEqual([allTimeSections[0]]);
  });

  it('does not render the all-time section (or its class) when fewer than 2 players are selected', () => {
    const screen = renderHistory({
      state: baseState({ selectedPlayerIds: ['p1'] }),
      actions: actions(),
    });

    expect(screen.querySelector('.history-screen__all-time')).toBeNull();
  });
});

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
