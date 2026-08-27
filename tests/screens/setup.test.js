// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderSetup } from '../../src/screens/setup.js';

// The remove-player button appends a fresh confirm-dialog to document.body
// on every click (see setup.js — intentional, so the dialog survives the
// router's full re-render). Without this, a dialog left over from an
// earlier test would still be in document.body when the next test queries
// `.confirm-dialog`, and querySelector would return the stale one instead
// of the one this test just opened.
afterEach(() => {
  document.body.replaceChildren();
});

function baseState(overrides = {}) {
  return {
    allPlayers: [{ id: 'p1', name: 'Robert', archived: false }],
    selectedPlayerIds: [],
    dealerRestriction: false,
    maxSize: 7,
    ...overrides,
  };
}

describe('renderSetup — remove player confirmation', () => {
  it('does not call window.confirm when removing a player', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const actions = { archivePlayer: vi.fn(), togglePlayer: vi.fn(), viewHistory: vi.fn() };
    const screen = renderSetup({ state: baseState(), actions });
    document.body.append(screen);

    screen.querySelector('.setup__player-remove').click();

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('opens an in-app dialog and only archives the player after confirming', () => {
    const actions = { archivePlayer: vi.fn(), togglePlayer: vi.fn(), viewHistory: vi.fn() };
    const screen = renderSetup({ state: baseState(), actions });
    document.body.append(screen);

    const removeButton = screen.querySelector('.setup__player-remove');
    removeButton.showModal = vi.fn();
    removeButton.close = vi.fn();
    removeButton.click();

    const dialog = document.body.querySelector('.confirm-dialog');
    expect(dialog).toBeTruthy();
    expect(actions.archivePlayer).not.toHaveBeenCalled();

    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const confirmButton = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'Remove',
    );
    confirmButton.click();

    expect(actions.archivePlayer).toHaveBeenCalledWith('p1');
  });
});
