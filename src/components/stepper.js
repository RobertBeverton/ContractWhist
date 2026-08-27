/**
 * Accessible number stepper: −/+ buttons around a real number input.
 *
 * Uses a native input (so a keyboard user can type a value directly) plus
 * large buttons (so a tablet user never has to hit a spinner arrow).
 *
 * `value` is captured in the button click handlers at creation time — this
 * component does not track its own state. Callers must re-create it (via a
 * fresh render, not a mutation) after every onChange to reflect the new
 * value; this matches the app's state-store + full-re-render pattern.
 *
 * @param {object} options
 * @param {string} options.id          - input id, for the <label>
 * @param {string} options.label       - visible label text
 * @param {number|null} options.value
 * @param {number} options.min
 * @param {number} options.max
 * @param {string} [options.describedBy] - id of an error message element
 * @param {boolean} [options.invalid]
 * @param {(value: number|null) => void} options.onChange
 */
export function createStepper({ id, label, value, min, max, describedBy, invalid, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'stepper';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  labelEl.className = 'stepper__label';

  const controls = document.createElement('div');
  controls.className = 'stepper__controls';

  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.className = 'stepper__input';
  input.min = String(min);
  input.max = String(max);
  input.inputMode = 'numeric';
  input.value = value ?? '';
  if (invalid) input.setAttribute('aria-invalid', 'true');
  if (describedBy) input.setAttribute('aria-describedby', describedBy);

  const clamp = (n) => Math.min(max, Math.max(min, n));

  // A filled-in field starts locked so a stray tap on +/- can't silently
  // bump an already-recorded value — the player has to deliberately tap the
  // number to open it back up. An empty field has nothing to protect, so it
  // starts open. This is pure interaction state, not app data: it lives on
  // the DOM node itself (data-locked) rather than in the store, because
  // every keystroke elsewhere on the screen already triggers a full
  // re-render (see router.js), which would otherwise wipe out "unlocked"
  // the instant a sibling field changed.
  let locked = value !== null;

  const stepButtons = [];

  const setLocked = (next) => {
    locked = next;
    wrapper.dataset.locked = String(locked);
    for (const button of stepButtons) button.disabled = locked;
  };

  const makeButton = (text, accessibleLabel, delta) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stepper__button';
    button.textContent = text;
    // The visible "−" is not a meaningful name for a screen reader (4.1.2).
    button.setAttribute('aria-label', `${accessibleLabel} ${label}`);
    button.addEventListener('click', () => {
      // From an empty field, either direction steps to `min` (not min ± 1).
      const next = clamp((value ?? (delta > 0 ? min - 1 : min + 1)) + delta);
      input.value = String(next);
      onChange(next);
    });
    stepButtons.push(button);
    return button;
  };

  input.addEventListener('focus', () => setLocked(false));
  input.addEventListener('blur', () => setLocked(value !== null));

  input.addEventListener('input', () => {
    if (input.value === '') return onChange(null);
    const parsed = Number.parseInt(input.value, 10);
    onChange(Number.isNaN(parsed) ? null : parsed);
  });

  controls.append(makeButton('−', 'Decrease', -1), input, makeButton('+', 'Increase', 1));
  wrapper.append(labelEl, controls);
  setLocked(locked);
  return wrapper;
}
