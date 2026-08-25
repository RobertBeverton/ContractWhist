import { maxHandSize } from '../logic/handSequence.js';

/**
 * Setup screen: player selection.
 *
 * This is step 1 of the setup screen (Task 13) — rules toggle, hand size,
 * and the start button are added in Task 14. Kept in one file per the plan
 * (the split across tasks is only to keep each task under ~10 minutes).
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

  return { screen, playersGroup };
}
