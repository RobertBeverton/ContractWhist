import { createTotalsBar } from '../components/totalsBar.js';
import { createRoundEntry } from '../components/roundEntry.js';
import { createRoundHistory } from '../components/roundHistory.js';
import { currentHand, isComplete } from '../logic/sessionFlow.js';
import { createConfirmDialog } from '../components/confirmDialog.js';

/**
 * Live scorer screen: heading, totals, round entry (or edit), history, and
 * the end-of-session control.
 *
 * `state.entries` — { [playerId]: { bid, won } } for the round being entered
 * or edited. `state.errors` — from the last lockInRound/editRound/saveEdit
 * attempt. `state.editingIndex` — null normally, or a round index while
 * editing the latest round. `actions.*` (updateEntry, lockInRound, saveEdit,
 * cancelEdit, editLatestRound, endSession) are wired to real logic in Task 20.
 */
export function renderScorer({ state, actions }) {
  const { session, playersById, entries, errors, editingIndex, statusMessage, saveError, saving } = state;
  const screen = document.createElement('section');
  screen.className = 'screen scorer';

  const editing = editingIndex !== null;
  const hand = editing ? session.rounds[editingIndex].hand : currentHand(session);
  const roundNumber = editing ? editingIndex + 1 : session.rounds.length + 1;

  // A completed-but-not-yet-ended session (all rounds played, "See final
  // scores" not yet clicked) is live on screen, if only briefly — hand is
  // null and there's no round to head. Give that state its own heading
  // rather than falling through to `currentHand(session)` unchecked, which
  // would render the nonsensical "Round N — dealing null cards each".
  const heading = document.createElement('h1');
  heading.textContent = editing
    ? `Editing round ${roundNumber} — hand of ${hand}`
    : hand !== null
      ? `Round ${roundNumber} of ${session.handSequence.length} — dealing ${hand} card${hand === 1 ? '' : 's'} each`
      : 'All rounds played';
  screen.append(heading);

  // 4.1.3 Status Messages — announce totals updates without stealing focus.
  const status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = statusMessage ?? '';
  screen.append(status);

  // A save failure must actually be seen, not just announced to assistive
  // tech — the polite live region above is easy to miss, and silently
  // playing on after autosave breaks risks losing the whole session.
  if (saveError) {
    const saveAlert = document.createElement('div');
    saveAlert.setAttribute('role', 'alert');
    saveAlert.className = 'error scorer__alert';
    saveAlert.textContent = saveError;
    screen.append(saveAlert);
  }

  screen.append(createTotalsBar({ session, playersById }));

  // Round-wide errors (e.g. the tricks-won sum) live above the form so they're
  // found without hunting; per-player errors sit with their input.
  const roundErrors = errors.filter((error) => !error.playerId);
  if (roundErrors.length > 0) {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.className = 'error scorer__alert';
    alert.textContent = roundErrors.map((error) => error.message).join(' ');
    screen.append(alert);
  }

  if (hand !== null) {
    screen.append(
      createRoundEntry({
        hand,
        players: session.players,
        playersById,
        entries,
        errors,
        dealerRestriction: session.rules.dealerRestriction,
        onChange: actions.updateEntry,
      }),
    );

    const lockIn = document.createElement('button');
    lockIn.type = 'button';
    lockIn.className = 'primary scorer__lockin';
    lockIn.textContent = editing ? 'Save changes' : 'Record scores';
    // Disabled while a previous lock-in/edit is still saving — belt-and-braces
    // alongside actions.js's own re-entrancy guard, and gives the user a
    // visible reason a rapid double-tap didn't do anything twice.
    lockIn.disabled = Boolean(saving);
    lockIn.addEventListener('click', editing ? actions.saveEdit : actions.lockInRound);
    screen.append(lockIn);

    if (editing) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel edit';
      cancel.addEventListener('click', actions.cancelEdit);
      screen.append(cancel);
    }
  } else {
    // The heading above already says "All rounds played" — this just adds
    // the pointer to what happens next, rather than repeating the heading.
    const done = document.createElement('p');
    done.className = 'muted';
    done.textContent = 'Every round has been scored. See the final scores to finish up.';
    screen.append(done);
  }

  screen.append(
    createRoundHistory({ session, playersById, onEditLatest: actions.editLatestRound }),
  );

  const sessionComplete = isComplete(session);
  const endButton = document.createElement('button');
  endButton.type = 'button';
  endButton.className = 'scorer__end';
  endButton.textContent = sessionComplete ? 'See final scores' : 'End session early';
  const endDialog = createConfirmDialog({
    message: 'End this session now? The game will be marked finished.',
    confirmLabel: 'End session',
    onConfirm: () => actions.endSession(),
  });
  endButton.addEventListener('click', () => {
    // Ending early commits the session as complete — it can no longer be
    // resumed as in-progress. A fat-fingered tap here would silently cut a
    // real game short with no undo, so confirm before committing. No prompt
    // needed once every round is already played — nothing is lost then.
    if (sessionComplete) {
      actions.endSession();
      return;
    }
    document.body.append(endDialog.element);
    endDialog.open();
  });
  screen.append(endButton);

  return screen;
}
