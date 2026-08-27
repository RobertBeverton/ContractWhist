import { maxHandSize } from '../logic/handSequence.js';
import { createStepper } from '../components/stepper.js';
import { createConfirmDialog } from '../components/confirmDialog.js';

/**
 * Setup screen: player selection, house rules, hand size, and start.
 *
 * Kept in one file per the plan (the split across Tasks 13/14 was only to
 * keep each task under ~10 minutes).
 *
 * `state.allPlayers` — [{id, name, archived}], from the player-profile store.
 * `state.selectedPlayerIds` — array of currently-checked player ids.
 * `actions.togglePlayer(id)` / `actions.addPlayer(name)` — mutate state
 * (wired to real storage/state logic in a later task).
 * `actions.archivePlayer(id)` / `actions.restorePlayer(id)` — soft-remove
 * a player from the picker and undo that. Archiving never deletes the
 * record — id/name stay intact for past sessions/history to look up — so
 * this screen filters `state.allPlayers` down to non-archived players for
 * the main list, and surfaces archived ones separately for restoring.
 *
 * KNOWN GAP (deliberately deferred, not forgotten): no duplicate-name check
 * on add — two players named "Rob" would render as identical, indistinguishable
 * checkboxes. state.allPlayers is available here if this screen ends up owning
 * the check; revisit when Task 20 wires the real addPlayer action, which is
 * the point a decision on which layer owns this becomes concrete.
 */
export function renderSetup({ state, actions }) {
  const screen = document.createElement('section');
  screen.className = 'screen setup';

  const heading = document.createElement('h1');
  heading.textContent = 'New session';
  screen.append(heading);

  // History is reachable from here too, not just from the post-game summary
  // screen (previously the only entry point). Placed right under the
  // heading rather than near "Start session" below: it's a lower-emphasis,
  // read-only detour ("check the record before you play"), and grouping it
  // with the primary "Start session" CTA at the bottom risked it reading as
  // part of that flow (e.g. a "start with history" misread) or stealing
  // thumb-priority from it. Same action as summary.js's "View history and
  // stats" button (actions.viewHistory()) — history.js already adapts its
  // "This group, all time" section to whatever's in state.selectedPlayerIds,
  // so this button intentionally does nothing extra with the current
  // checkboxes; it just reuses them by not resetting selection first.
  // Always shown, even with zero past sessions: history.js already renders
  // a graceful "No past sessions found yet." message with a working Back
  // button for that case, so gating this on history existing would just be
  // a second thing to keep in sync for no real benefit.
  const historyButton = document.createElement('button');
  historyButton.type = 'button';
  historyButton.className = 'setup__history';
  historyButton.textContent = 'View history';
  historyButton.setAttribute('aria-label', 'View history and stats');
  historyButton.addEventListener('click', () => actions.viewHistory());
  screen.append(historyButton);

  // --- Player selection -----------------------------------------------
  const playersGroup = document.createElement('div');
  playersGroup.className = 'setup__group';
  playersGroup.setAttribute('role', 'group');
  playersGroup.setAttribute('aria-labelledby', 'players-heading');
  const playersLegend = document.createElement('h2');
  playersLegend.id = 'players-heading';
  playersLegend.textContent = 'Who is playing?';
  playersGroup.append(playersLegend);

  const activePlayers = state.allPlayers.filter((player) => !player.archived);
  const archivedPlayers = state.allPlayers.filter((player) => player.archived);

  if (activePlayers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No players yet — add the first one below.';
    playersGroup.append(empty);
  }

  for (const player of activePlayers) {
    const row = document.createElement('div');
    row.className = 'setup__player'; // no .target — see setup.css

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `player-${player.id}`;
    checkbox.checked = state.selectedPlayerIds.includes(player.id);
    checkbox.addEventListener('change', () => actions.togglePlayer(player.id));

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = player.name;
    label.className = 'setup__player-label';

    // Soft-remove from the picker. A confirm here is deliberate — unlike
    // toggling a checkbox, this can hide a player from every future
    // session's picker until someone finds the "Show archived players"
    // disclosure below, and (per the mockup) it can fire right next to an
    // already-checked row, so a stray tap deserves one chance to back out.
    // Same pattern as the destructive-action confirm in scorer.js — both
    // now use the themed confirmDialog component instead of
    // window.confirm(), whose browser-native chrome broke the app's visual
    // language and couldn't be restyled or reliably restored focus after
    // closing.
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'setup__player-remove';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Remove ${player.name} from players`);
    const removeDialog = createConfirmDialog({
      message: `Remove ${player.name} from the players list? You can restore them later from "Show archived players."`,
      confirmLabel: 'Remove',
      onConfirm: () => actions.archivePlayer(player.id),
    });
    removeButton.addEventListener('click', () => {
      document.body.append(removeDialog.element);
      removeDialog.open();
    });

    row.append(checkbox, label, removeButton);
    playersGroup.append(row);
  }

  // --- Archived players (restore) --------------------------------------
  // A native <details>/<summary> disclosure: keyboard-accessible for free
  // (Enter/Space toggles it, Tab reaches it in normal order) and needs no
  // extra ARIA wiring, unlike a hand-rolled toggle button + conditional
  // render. Always rendered (even with zero archived players) so the
  // control's presence — and the fact that archiving is reversible — is
  // discoverable without already knowing a player was ever removed.
  const archivedDetails = document.createElement('details');
  archivedDetails.className = 'setup__archived';

  const archivedSummary = document.createElement('summary');
  archivedSummary.textContent =
    archivedPlayers.length > 0
      ? `Show archived players (${archivedPlayers.length})`
      : 'Show archived players';
  archivedDetails.append(archivedSummary);

  if (archivedPlayers.length === 0) {
    const none = document.createElement('p');
    none.className = 'muted';
    none.textContent = 'No archived players.';
    archivedDetails.append(none);
  } else {
    for (const player of archivedPlayers) {
      const row = document.createElement('div');
      row.className = 'setup__player';

      const name = document.createElement('span');
      name.textContent = player.name;
      name.className = 'setup__player-label';

      const restoreButton = document.createElement('button');
      restoreButton.type = 'button';
      restoreButton.textContent = 'Restore';
      restoreButton.setAttribute('aria-label', `Restore ${player.name} to players`);
      restoreButton.addEventListener('click', () => actions.restorePlayer(player.id));

      row.append(name, restoreButton);
      archivedDetails.append(row);
    }
  }

  // --- Add a new player ------------------------------------------------
  const addRow = document.createElement('div');
  addRow.className = 'setup__add';

  const addLabel = document.createElement('label');
  addLabel.htmlFor = 'new-player-name';
  addLabel.textContent = 'Add a new player';

  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.id = 'new-player-name';
  addInput.autocomplete = 'off';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = 'Add player';
  addButton.addEventListener('click', () => {
    const name = addInput.value.trim();
    if (name) {
      actions.addPlayer(name);
      addInput.value = '';
      addInput.focus();   // keep focus for adding several in a row
    }
  });

  addRow.append(addLabel, addInput, addButton);
  playersGroup.append(addRow);
  playersGroup.append(archivedDetails);
  screen.append(playersGroup);

  const playerCount = state.selectedPlayerIds.length;
  const maxHand = playerCount >= 2 ? maxHandSize(playerCount) : null;

  // --- Dealer restriction ---------------------------------------------
  const rulesGroup = document.createElement('div');
  rulesGroup.className = 'setup__group';
  rulesGroup.setAttribute('role', 'group');
  rulesGroup.setAttribute('aria-labelledby', 'rules-heading');
  const rulesLegend = document.createElement('h2');
  rulesLegend.id = 'rules-heading';
  rulesLegend.textContent = 'House rules';

  const ruleRow = document.createElement('div');
  ruleRow.className = 'setup__rule'; // no .target — see setup.css, same fix as .setup__player

  const ruleCheckbox = document.createElement('input');
  ruleCheckbox.type = 'checkbox';
  ruleCheckbox.id = 'dealer-restriction';
  ruleCheckbox.checked = state.dealerRestriction;
  ruleCheckbox.setAttribute('aria-describedby', 'dealer-restriction-hint');
  ruleCheckbox.addEventListener('change', () =>
    actions.setDealerRestriction(ruleCheckbox.checked),
  );

  const ruleLabel = document.createElement('label');
  ruleLabel.htmlFor = ruleCheckbox.id;
  ruleLabel.textContent = 'Someone must go down';

  // 3.3.2 Labels or Instructions — explain the rule, don't assume it's known.
  const ruleHint = document.createElement('p');
  ruleHint.id = 'dealer-restriction-hint';
  ruleHint.className = 'muted';
  ruleHint.textContent =
    "The dealer can't bid a number that makes the bids add up to the hand size.";

  ruleRow.append(ruleCheckbox, ruleLabel);
  rulesGroup.append(rulesLegend, ruleRow, ruleHint);
  screen.append(rulesGroup);

  // --- Highest hand size -------------------------------------------------
  const handGroup = document.createElement('div');
  handGroup.className = 'setup__group';
  handGroup.setAttribute('role', 'group');
  handGroup.setAttribute('aria-labelledby', 'hand-size-heading');
  const handLegend = document.createElement('h2');
  handLegend.id = 'hand-size-heading';
  handLegend.textContent = 'Highest hand size';
  handGroup.append(handLegend);

  if (maxHand === null) {
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'Select at least 2 players to choose a hand size.';
    handGroup.append(hint);
  } else {
    // Live feedback on the deal, per the spec: show how many cards to deal.
    const hint = document.createElement('p');
    hint.id = 'hand-size-hint';
    hint.className = 'muted';
    hint.textContent =
      `${playerCount} players — hands run 1 up to ${maxHand} cards and back down to 1 ` +
      `(one card is kept back to turn up trumps).`;

    handGroup.append(
      hint,
      createStepper({
        id: 'max-hand-size',
        label: 'Max cards in a hand',
        value: Math.min(state.maxSize, maxHand),
        min: 1,
        max: maxHand,
        describedBy: 'hand-size-hint',
        onChange: (value) => actions.setMaxSize(value),
      }),
    );
  }
  screen.append(handGroup);

  // --- Start ------------------------------------------------------------
  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'primary setup__start';
  startButton.textContent = 'Start session';
  startButton.disabled = playerCount < 2;
  startButton.addEventListener('click', () => actions.startSession());

  // Explain WHY it's disabled — a disabled control with no reason is a dead end.
  // NOTE: a natively `disabled` button is unfocusable, so a screen reader
  // may never reach this description via aria-describedby regardless — a
  // disabled control's reason is only reliably announced with the
  // aria-disabled (not disabled) + focusable pattern. Kept as plain
  // `disabled` here (matches the plan's reference code and every other
  // disabled control in this codebase); flagged for Review Gate 3's
  // keyboard/screen-reader pass to confirm whether this is sufficient.
  if (playerCount < 2) {
    const why = document.createElement('p');
    why.id = 'start-reason';
    why.className = 'muted';
    why.textContent = 'Select at least 2 players to start.';
    screen.append(why);
    startButton.setAttribute('aria-describedby', 'start-reason');
  }
  screen.append(startButton);

  return screen;
}
