# Game Screen Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three pieces of live user feedback on the scorer (game) screen: the totals-bar chip grid stretches full-width and looks odd with few players, the bid/tricks-won steppers are too easy to bump by accident once a value is set, and "Lock in round" is misleading wording for what is actually the last step of the round.

**Architecture:** All three changes are scoped to the scorer screen and its two child components (`totalsBar.js`, `stepper.js`) plus their CSS. The lock feature is the only one with new interactive behavior — a stepper gains a `locked` boolean render state (derived from `value !== null`, not stored elsewhere) and unlocks on tap/focus, re-locking on blur. No new store fields, no new actions — this is presentational component state expressed through render props, consistent with the rest of the codebase's full-re-render pattern.

**Tech Stack:** Same as the existing app — vanilla JS, hand-rolled DOM, plain CSS custom properties, Vitest + jsdom for component tests (already wired up from the prior UX-fixes branch).

**Source of these findings:** Live user feedback on the deployed build at `https://robertbeverton.github.io/ContractWhist/`, screenshot of the Round 1 scorer screen (2 players, totals bar spanning full width; "Lock in round" button wording).

---

## Before you start: design decisions already settled

These were confirmed with the user before this plan was written — do not re-litigate them:

- **Lock trigger:** a stepper with a non-null `value` renders locked (dimmed number, disabled +/- buttons). An empty stepper (no value yet) is never locked — locking only protects a value that's already been set.
- **Unlock:** a single tap/focus on the locked input reveals it as editable (enables +/- again, allows typing/stepping).
- **Re-lock:** happens automatically on blur (focus leaving the field) — not deferred until "Record scores" is pressed.
- **+/- buttons while locked:** fully disabled (not tappable at all), not "tap unlocks." Only interacting with the number/input itself unlocks.
- **New button wording:** "Record scores" (replacing "Lock in round"). Edit-mode wording ("Save changes") is unrelated and unchanged.

## What NOT to change

- Don't touch `validateRound()` or any scoring/persistence logic — this is presentation and interaction only.
- Don't change the `editing` (edit-a-past-round) flow's button wording — "Save changes" stays as-is; only the non-editing "Lock in round" label changes.
- Don't add new store state for lock/unlock — it's derived per-render from `value`, same pattern the stepper already uses for its own `min`/`max`/`invalid` props.
- Don't change `stepper.js`'s existing accessibility attributes (`aria-label`, `aria-describedby`, `aria-invalid`) — only add what's needed for the new locked state (see Task 2).

---

## Task 1: Constrain and center the totals bar

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\styles\totalsBar.css`

**Context:** `.totals__table` is `display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr))`, which stretches to fill `.screen`'s full width (up to 78rem on the landscape tablet breakpoint) regardless of player count — with 2 players this produces two very wide chips instead of two compact ones. The fix is a `max-width` on the grid itself plus `margin: 0 auto` to center it, so the grid still uses `auto-fit` to add columns as players are added, but stops stretching existing chips wider once there's room.

**Step 1: Read the current CSS**

Read `d:\GitHub\ContractWhist\src\styles\totalsBar.css` in full (already read during planning — reproduced here for reference):

```css
.totals__table {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space);
  width: 100%;
  border-collapse: collapse;
}
```

**Step 2: Add a max-width and center it**

Change the rule to:

```css
.totals__table {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space);
  width: 100%;
  max-width: 40rem;
  margin: 0 auto;
  border-collapse: collapse;
}
```

`40rem` (640px) is a starting point sized for roughly 4-5 chips at a comfortable width (~120-150px each) before wrapping to a second row — enough for the app's realistic player-count range (2-7, per `maxHandSize`'s deck-based cap) without ever feeling like a single row stretched thin. Chips still grow individually via `minmax(100px, 1fr)` when there are only 2-3 players and empty space remains under the cap, but the cap stops that growth from going full-width on a wide tablet screen.

**Step 3: Manual verification**

Since no browser tooling may be available, verify via careful reading: confirm `.totals__table`'s parent (`.totals`, in `totalsBar.js`, a `<section>` with no width constraint of its own) doesn't override this — check `totalsBar.css` doesn't have a `.totals { width: ... }` rule that would need `margin: 0 auto` to also apply there instead. If `npm run dev` / browser tooling IS available in your environment, actually load the app, start a 2-player session, and visually confirm the chips no longer span edge-to-edge.

**Step 4: Run full suite and commit**

```bash
npm test
git add src/styles/totalsBar.css
git commit -m "style: cap and center the totals bar so it doesn't stretch full-width with few players"
```

---

## Task 2: Lock filled-in steppers against accidental edits

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\components\stepper.js`
- Modify: `d:\GitHub\ContractWhist\src\styles\stepper.css`
- Test: `d:\GitHub\ContractWhist\tests\components\stepper.test.js` (new — this component has no existing test file; check first in case one was added since this plan was written)

**Context:** Read `d:\GitHub\ContractWhist\src\components\stepper.js` in full before starting (already read during planning — reproduced here):

```js
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

  const makeButton = (text, accessibleLabel, delta) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stepper__button';
    button.textContent = text;
    button.setAttribute('aria-label', `${accessibleLabel} ${label}`);
    button.addEventListener('click', () => {
      const next = clamp((value ?? (delta > 0 ? min - 1 : min + 1)) + delta);
      input.value = String(next);
      onChange(next);
    });
    return button;
  };

  input.addEventListener('input', () => {
    if (input.value === '') return onChange(null);
    const parsed = Number.parseInt(input.value, 10);
    onChange(Number.isNaN(parsed) ? null : parsed);
  });

  controls.append(makeButton('−', 'Decrease', -1), input, makeButton('+', 'Increase', 1));
  wrapper.append(labelEl, controls);
  return wrapper;
}
```

This component has **no internal state today** — every render is a fresh DOM tree built from `value`/`min`/`max`/etc props, and `onChange` bubbles straight up to the store. Lock/unlock needs a small amount of state that survives WITHIN one render but is deliberately NOT lifted to the store (locking is a pure interaction-affordance concern, not data the app needs to persist or that other components need to read).

**The locked/unlocked state must live as local closure state inside `createStepper`, not in `entries`/the store.** Here's why this is safe despite the app's "full re-render on every state change" pattern (see `router.js`'s doc comment): every keystroke/click already re-renders the WHOLE screen via `store.setState()` → `render()` → `root.replaceChildren(renderScreen(...))`, which means `createRoundEntry` (and therefore `createStepper`) is called fresh on every single render regardless — so a `locked` variable declared inside `createStepper`'s function body cannot "survive" a re-render the way `entries` does; it's recreated every time along with the rest of the DOM. This means: **the locked/unlocked state naturally resets to "locked" (if there's a value) on every render** — which is exactly the desired "re-lock unless actively focused" behavior, EXCEPT for the moment between an unlock-tap and the value actually changing, where no state update has fired yet and the component must stay visually unlocked without a re-render happening. Solve this the same way native HTML handles focus/hover states: with CSS, driven by a data attribute the click/focus handler toggles directly on the existing DOM node (not via `onChange`/store), so no store update is needed to open it and no store update is needed to keep it open while the user is interacting.

**Step 1: Write the failing tests**

```js
// tests/components/stepper.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createStepper } from '../../src/components/stepper.js';

function build(overrides = {}) {
  return createStepper({
    id: 'bid-p1',
    label: 'Bid',
    value: null,
    min: 0,
    max: 5,
    onChange: vi.fn(),
    ...overrides,
  });
}

describe('createStepper — lock against accidental edits', () => {
  it('is not locked when there is no value yet', () => {
    const el = build({ value: null });
    expect(el.querySelector('.stepper').dataset.locked).not.toBe('true');
    expect(el.querySelector('.stepper__button')?.disabled).not.toBe(true);
  });

  it('is locked by default once it has a value', () => {
    const el = build({ value: 2 });
    expect(el.dataset.locked).toBe('true');
  });

  it('disables both +/- buttons while locked', () => {
    const el = build({ value: 2 });
    const buttons = el.querySelectorAll('.stepper__button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });

  it('unlocks when the input is focused, re-enabling the buttons', () => {
    const el = build({ value: 2 });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    expect(el.dataset.locked).toBe('false');
    for (const button of el.querySelectorAll('.stepper__button')) {
      expect(button.disabled).toBe(false);
    }
  });

  it('re-locks when the input is blurred', () => {
    const el = build({ value: 2 });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    expect(el.dataset.locked).toBe('true');
    for (const button of el.querySelectorAll('.stepper__button')) {
      expect(button.disabled).toBe(true);
    }
  });

  it('does not fire onChange merely from locking/unlocking', () => {
    const onChange = vi.fn();
    const el = build({ value: 2, onChange });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/stepper.test.js`
Expected: FAIL — `dataset.locked` is `undefined`, buttons aren't disabled.

**Step 3: Implement locking in stepper.js**

Rewrite `createStepper` to track lock state via a `dataset.locked` attribute on the wrapper, toggled by focus/blur listeners on the input, and to disable the two step buttons based on that same state:

```js
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
```

Note the `blur` handler re-locks based on `value !== null` (the CLOSURE's `value`, captured at render time) rather than unconditionally `true` — if the field was empty when this render happened and the user typed a value then tabbed away without the screen re-rendering yet (unlikely given the app's input-fires-onChange-immediately pattern, but possible in principle), this keeps the re-lock decision consistent with "only lock fields that have a value." In practice `onChange` fires synchronously on `input`, which triggers a store update and a fresh render (fresh `createStepper` call with the new `value`) before `blur` can fire, so this is defense-in-depth rather than a load-bearing distinction — but keep it as written since it's more clearly correct than hardcoding `true`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/stepper.test.js`
Expected: PASS, 6 tests.

**Step 5: Add CSS for the locked visual state**

Read `d:\GitHub\ContractWhist\src\styles\stepper.css` in full first. Append:

```css
/* Locked: the value is visible but dimmed, and +/- are disabled (base.css's
   button[disabled] rule already handles their disabled look) — tapping the
   number itself is the only way back in. Unlocked (either because there's
   no value yet, or because the player just tapped in) looks like the
   ordinary, fully-interactive stepper. */
.stepper[data-locked='true'] .stepper__input {
  color: var(--text-muted);
  cursor: pointer;
}
```

Do not add anything that changes the input's `pointer-events` or makes it unfocusable — locking must never prevent the one interaction (tap/focus) that's supposed to unlock it.

**Step 6: Manual verification**

If browser tooling is available: `npm run dev`, start a session, enter a bid, tab/click away — confirm the field dims and its +/- buttons become unclickable. Tap the number — confirm it un-dims and +/- work again. Tab away again — confirm it re-locks. If no browser tooling is available, rely on the automated tests plus careful reading — note this limitation in your report.

**Step 7: Run full suite and commit**

```bash
npm test
git add src/components/stepper.js src/styles/stepper.css tests/components/stepper.test.js
git commit -m "feat: lock filled-in stepper fields against accidental taps until reopened"
```

---

## Task 3: Rename "Lock in round" to "Record scores"

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\scorer.js`

**Context:** `scorer.js`'s lock-in button currently reads `editing ? 'Save changes' : 'Lock in round'`. Only the non-editing label changes — "Save changes" (shown while editing a past round) is a different action with clear, already-correct wording and must stay as-is. Note this button's CSS class is `scorer__lockin` — leave the class name unchanged (renaming a CSS class is a bigger, purely-cosmetic diff for zero user-visible benefit); only the button's visible text and any `aria-label`/accessible-name text should change if the class name or other identifiers reference "lock in" in user-facing copy.

**Step 1: Update the button text**

In `src/screens/scorer.js`, find:

```js
    lockIn.textContent = editing ? 'Save changes' : 'Lock in round';
```

Change to:

```js
    lockIn.textContent = editing ? 'Save changes' : 'Record scores';
```

**Step 2: Check for other references to the old wording**

Grep the codebase for `"Lock in round"` (exact string) to confirm there are no other places displaying this text (e.g. a test asserting on the literal string, a comment describing user-facing copy that's now stale). Update any test assertions that check for the literal old text; leave comments describing the button's *purpose* (e.g. "the lock-in button") as-is — those refer to the underlying action/variable name (`lockIn`, `actions.lockInRound`), not the display text, and don't need to change.

**Step 3: Manual verification**

If browser tooling is available: confirm the button reads "Record scores" during normal play and "Save changes" while editing a past round.

**Step 4: Run full suite and commit**

```bash
npm test
git add src/screens/scorer.js
# also add any test files touched in Step 2, if any
git commit -m "copy: rename 'Lock in round' button to 'Record scores'"
```

---

## Task 4: Full regression pass

**Files:** none (verification only)

**Step 1:** Run `npm test` — confirm all tests pass, including the new `stepper.test.js` file.

**Step 2:** Run `npm run build` — confirm the production build succeeds.

**Step 3:** Code-level walkthrough: re-read `totalsBar.css`, `stepper.js`, `stepper.css`, and `scorer.js` in their final state and confirm all three fixes are present and coherent together (e.g. the locked-stepper CSS doesn't visually clash with the `invalid`/`aria-invalid` error-border styling already in `stepper.css`).

**Step 4:** Report back a summary of what changed, ready for the user to review/test on the deployed build.
