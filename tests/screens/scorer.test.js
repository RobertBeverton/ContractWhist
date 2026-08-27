// tests/screens/scorer.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderScorer } from '../../src/screens/scorer.js';

// The end-session button appends a fresh confirm-dialog to document.body on
// every click. Without this, a dialog left over from an earlier test would
// still be in document.body when the next test queries `.confirm-dialog`,
// and querySelector would return the stale one instead of the one this test
// just opened (same gap as tests/screens/setup.test.js hit for Task 2).
afterEach(() => {
  document.body.replaceChildren();
});

function baseState(overrides = {}) {
  return {
    session: {
      players: ['p1', 'p2'],
      handSequence: [2, 1, 2],
      rounds: [],
      rules: { dealerRestriction: false },
      status: 'in-progress',
    },
    playersById: { p1: { id: 'p1', name: 'Robert' }, p2: { id: 'p2', name: 'Magda' } },
    entries: {},
    errors: [],
    editingIndex: null,
    statusMessage: null,
    saveError: null,
    saving: false,
    ...overrides,
  };
}

describe('renderScorer — end session confirmation', () => {
  it('does not call window.confirm when ending an incomplete session early', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const actions = { updateEntry: vi.fn(), lockInRound: vi.fn(), editLatestRound: vi.fn(), endSession: vi.fn() };
    const screen = renderScorer({ state: baseState(), actions });
    document.body.append(screen);

    screen.querySelector('.scorer__end').click();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(actions.endSession).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('calls endSession only after confirming in the themed dialog', () => {
    const actions = { updateEntry: vi.fn(), lockInRound: vi.fn(), editLatestRound: vi.fn(), endSession: vi.fn() };
    const screen = renderScorer({ state: baseState(), actions });
    document.body.append(screen);

    screen.querySelector('.scorer__end').click();

    const dialog = document.body.querySelector('.confirm-dialog');
    expect(dialog).toBeTruthy();
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    const confirmButton = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'End session',
    );
    confirmButton.click();

    expect(actions.endSession).toHaveBeenCalledTimes(1);
  });
});
