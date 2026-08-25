import { maxHandSize } from '../logic/handSequence.js';
import { createStepper } from '../components/stepper.js';

/**
 * Setup screen: player selection, house rules, hand size, and start.
 *
 * Kept in one file per the plan (the split across Tasks 13/14 was only to
 * keep each task under ~10 minutes).
 *
 * `state.allPlayers` — [{id, name}], from the player-profile store.
 * `state.selectedPlayerIds` — array of currently-checked player ids.
 * `actions.togglePlayer(id)` / `actions.addPlayer(name)` — mutate state
 * (wired to real storage/state logic in a later task).
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

  // --- Player selection -----------------------------------------------
  const playersGroup = document.createElement('fieldset');
  const playersLegend = document.createElement('legend');
  playersLegend.textContent = 'Who is playing?';
  playersGroup.append(playersLegend);

  if (state.allPlayers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No players yet — add the first one below.';
    playersGroup.append(empty);
  }

  for (const player of state.allPlayers) {
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

    row.append(checkbox, label);
    playersGroup.append(row);
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
  screen.append(playersGroup);

  const playerCount = state.selectedPlayerIds.length;
  const maxHand = playerCount >= 2 ? maxHandSize(playerCount) : null;

  // --- Dealer restriction ---------------------------------------------
  const rulesGroup = document.createElement('fieldset');
  const rulesLegend = document.createElement('legend');
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

  // --- Starting hand size ----------------------------------------------
  const handGroup = document.createElement('fieldset');
  const handLegend = document.createElement('legend');
  handLegend.textContent = 'Starting hand size';
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
      `${playerCount} players — up to ${maxHand} cards each ` +
      `(one card is kept back to turn up trumps).`;

    handGroup.append(
      hint,
      createStepper({
        id: 'start-hand-size',
        label: 'Cards in the first hand',
        value: Math.min(state.startSize, maxHand),
        min: 1,
        max: maxHand,
        describedBy: 'hand-size-hint',
        onChange: (value) => actions.setStartSize(value),
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
  if (playerCount < 2) {
    const why = document.createElement('p');
    why.className = 'muted';
    why.textContent = 'Select at least 2 players to start.';
    screen.append(why);
  }
  screen.append(startButton);

  return screen;
}
