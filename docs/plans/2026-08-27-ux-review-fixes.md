# UX Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the real, code-verified gaps found by the three-persona UX review (`docs/review-personas.md` and the published combined report), while leaving alone the several findings that turned out, on reading the actual source, to already be handled correctly.

**Architecture:** Vanilla JS, hand-rolled DOM, single store + full-re-render router (`src/app/store.js`, `src/app/router.js`). No new dependencies, no new build tooling. The one structural addition is a reusable native-`<dialog>`-based confirm component (`src/components/confirmDialog.js`) that replaces all three `window.confirm()` call sites — everything else is markup/CSS-only changes to existing screens and components, plus two small logic additions (round-progress count, live bid/tricks running totals).

**Tech Stack:** Same as the existing app — vanilla JS ES modules, plain CSS custom properties (`src/styles/tokens.css`), Vite 8, Vitest 4. Test environment is currently `environment: 'node'` with no DOM (see Task 0) — Task 0 adds `jsdom` so the new dialog component and other DOM-level changes can be tested directly, without disturbing the existing Node-only logic/storage tests.

---

## Before you start: what the persona review got right vs. wrong

The three-persona review (`docs/review-personas.md`) worked from **screenshots only** (`whistfiles/*.png`), not the actual source. Reading the real code changed the picture for several findings. **Do not implement these as literally stated** — they are either already correct or based on a misreading of a static mockup:

- **H6 "checkbox purpose is ambiguous"** — the player list already sits inside `role="group" aria-labelledby="players-heading"` with heading "Who is playing?" (`setup.js:60-65`). This is reasonably clear; not touched by this plan.
- **H7 / M5 "× has no text label" / "cramped padding"** — `setup.css:98-108` already sizes `.setup__player-remove` to the full 44px `--target-min` with an `aria-label`; only the *visible glyph* has tight padding around it (cosmetic, not a target-size bug). Folded into Task 6 as a minor visual polish, not a target-size fix.
- **H3 / M5 stepper and checkbox target sizes** — `stepper.css:13-21`, `setup.css:66-72,157-163` already enforce `--target-min: 44px` (WCAG 2.5.8) everywhere, contrast-verified. **No fix needed.**
- **H2 "Start session disabled button illegible"** — `base.css:44` uses `opacity: 0.5` on an already-contrast-verified `--surface`/`--text` pair. Still worth a targeted look (Task 7) since opacity-based dimming can still read as "broken" even when the underlying colors are correct, but this is a smaller fix than the persona reports implied.
- **M3 "BID/TRICKS WON headers disconnected from rows"** — false: `stepper.js:26-29` renders a real `<label>` for every single stepper, every time (`Bid`, `Tricks won`), not just a floating column header. **No fix needed.**
- **M9 History "no legend for made/missed"** — the round-history log (not the accuracy table) already spells out "made"/"missed" in words (`roundHistory.js:44`, explicit 1.4.1 compliance comment). The *accuracy table* genuinely has no `%`-meaning legend — kept as Task 11, scoped correctly this time.

Findings confirmed as real gaps are implemented below. Where a finding turned out to be more (or less) work than the persona review implied, the task says so.

## What NOT to change

- Don't touch `--bg`/`--surface`/`--danger`/etc. hex values in `tokens.css` — they're independently contrast-verified (see `docs/plans/2026-08-26-felt-parchment-reskin.md`). If a task needs a *new* token, add it, don't edit existing ones.
- Don't remove or weaken any existing `aria-*`, `role`, `scope`, or focus-management code while touching a file for an unrelated fix in this plan.
- Don't add a framework, state library, or CSS framework. Stay vanilla to match the rest of the app.
- Every existing test must still pass. If a task's change breaks one, that's a signal to stop and re-read this file, not to edit the test to match.

---

## Task 0: Add jsdom so DOM-level components are testable

**Files:**
- Modify: `d:\GitHub\ContractWhist\package.json`
- Modify: `d:\GitHub\ContractWhist\vite.config.js`

**Context:** Per the codebase exploration, `test.environment` is currently `'node'` and there is no `tests/screens/` or `tests/components/` directory — nothing renders DOM in a test today. Task 1 (the new confirm dialog) needs to assert on real `<dialog>` behavior (open/close, focus, button clicks), which needs a DOM. Scope this to new test files only, via a per-file docblock, so the existing Node-only logic/storage tests are untouched.

**Step 1: Install jsdom as a direct dev dependency**

Run: `npm install --save-dev jsdom`

**Step 2: Confirm it's now a direct dependency**

Read `package.json` and confirm `"jsdom"` appears under `devDependencies` (any version `^2x` range npm resolved is fine — it was already present transitively, so this should be a fast, low-risk install).

**Step 3: Leave the global `vite.config.js` test environment as `'node'`**

Do not change `environment: 'node'` globally — every existing test file relies on there being no DOM, and changing this globally is out of scope and risks unrelated breakage. Instead, new test files that need a DOM will opt in per-file with a `// @vitest-environment jsdom` docblock at the top of the file (Vitest reads this automatically; no other config change is needed).

**Step 4: Verify existing tests are unaffected**

Run: `npm test`
Expected: all existing tests still pass, same count as before this task.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add jsdom as a direct dev dependency for DOM-level component tests"
```

---

## Task 1: Build the reusable confirm dialog component

**Fixes:** H1 (native `window.confirm()` breaks the theme — corroborated by all 3 personas)

**Files:**
- Create: `d:\GitHub\ContractWhist\src\components\confirmDialog.js`
- Create: `d:\GitHub\ContractWhist\src\styles\confirmDialog.css`
- Create: `d:\GitHub\ContractWhist\tests\components\confirmDialog.test.js`
- Modify: `d:\GitHub\ContractWhist\src\main.js` (add the new CSS import)

**Context:** Use the native `<dialog>` element rather than a hand-rolled div overlay — it gives focus trapping, `Escape`-to-cancel, and top-layer stacking for free, and (unlike `window.confirm()`) is fully restylable with the app's own tokens. `<dialog>` has been supported in every evergreen browser (including Safari) since 2022, so no polyfill is needed.

The component is a plain factory function matching the rest of `src/components/` (compare `stepper.js`): it builds a `<dialog>`, appends it wherever the caller wants (body, for simplicity, since a confirm dialog is app-modal, not screen-local), and returns `{ open, element }`. Callers pass `onConfirm`/`onCancel` callbacks — this mirrors the existing `window.confirm()` call sites' `if (confirmed) { ... }` shape closely enough that call sites barely change.

**Step 1: Write the failing test**

```js
// tests/components/confirmDialog.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createConfirmDialog } from '../../src/components/confirmDialog.js';

describe('createConfirmDialog', () => {
  it('renders the message and both buttons', () => {
    const { element } = createConfirmDialog({
      message: 'Remove Robert from the players list?',
      confirmLabel: 'Remove',
      onConfirm: () => {},
      onCancel: () => {},
    });
    document.body.append(element);

    expect(element.tagName).toBe('DIALOG');
    expect(element.textContent).toContain('Remove Robert from the players list?');
    const buttons = element.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect([...buttons].map((b) => b.textContent)).toEqual(['Cancel', 'Remove']);
  });

  it('calls onConfirm and closes when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    element.close = vi.fn();
    open();

    const confirmButton = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === 'End session',
    );
    confirmButton.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(element.close).toHaveBeenCalled();
  });

  it('calls onCancel and closes when the cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    element.close = vi.fn();
    open();

    const cancelButton = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === 'Cancel',
    );
    cancelButton.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(element.close).toHaveBeenCalled();
  });

  it('treats a native dialog "close" (e.g. Escape key) as cancel, not confirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    open();

    element.dispatchEvent(new Event('close'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/confirmDialog.test.js`
Expected: FAIL — `Cannot find module '../../src/components/confirmDialog.js'`

**Step 3: Write the component**

```js
// src/components/confirmDialog.js
/**
 * Themed replacement for window.confirm(). Uses the native <dialog> element
 * for focus-trapping, Escape-to-cancel, and top-layer stacking — all for
 * free — while staying fully restylable with the app's own tokens, unlike
 * window.confirm() which renders browser chrome no CSS can reach.
 *
 * Usage mirrors the window.confirm() call sites this replaces:
 *   const { element, open } = createConfirmDialog({
 *     message: '...', confirmLabel: '...', onConfirm, onCancel,
 *   });
 *   document.body.append(element);
 *   open();
 *
 * The caller owns appending `element` to the DOM (once) and calling `open()`
 * each time the confirmation is needed — this matches every other component
 * in src/components/, which build DOM but don't manage their own mounting.
 *
 * @param {object} options
 * @param {string} options.message
 * @param {string} options.confirmLabel - e.g. "Remove", "End session"
 * @param {() => void} options.onConfirm
 * @param {() => void} [options.onCancel] - also fires on Escape/backdrop dismiss
 */
export function createConfirmDialog({ message, confirmLabel, onConfirm, onCancel }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';

  const messageEl = document.createElement('p');
  messageEl.className = 'confirm-dialog__message';
  messageEl.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'confirm-dialog__actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'primary';
  confirmButton.textContent = confirmLabel;

  // Tracks whether the dialog is closing because a button handled it
  // (confirm/cancel already ran) vs. a native dismissal (Escape key,
  // backdrop click via ::backdrop) that only fires the 'close' event —
  // without this flag, a button click would run onCancel/onConfirm AND
  // the close-event handler below, double-firing the callback.
  let resolved = false;

  cancelButton.addEventListener('click', () => {
    resolved = true;
    dialog.close();
    onCancel?.();
  });

  confirmButton.addEventListener('click', () => {
    resolved = true;
    dialog.close();
    onConfirm();
  });

  // Escape key and any other native dismissal path fire 'close' without
  // going through either button — treat that as Cancel, matching
  // window.confirm()'s behavior when dismissed without pressing OK.
  dialog.addEventListener('close', () => {
    if (resolved) {
      resolved = false;
      return;
    }
    onCancel?.();
  });

  actions.append(cancelButton, confirmButton);
  dialog.append(messageEl, actions);

  return {
    element: dialog,
    open: () => dialog.showModal(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/confirmDialog.test.js`
Expected: PASS, 4 tests.

**Step 5: Write the CSS**

```css
/* src/styles/confirmDialog.css
   Themed replacement for the browser's native confirm() chrome — parchment
   card, brass border, Fraunces-free (body text, not a heading) to match the
   app's existing dialog-free "Are you sure" UI conventions. */

.confirm-dialog {
  max-width: 26rem;
  width: calc(100% - var(--space) * 4);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  padding: calc(var(--space) * 2);
}

/* The <dialog> element's own backdrop pseudo-element — dims the felt page
   behind it. Darker than a typical scrim because the felt background is
   already dark; a lighter scrim wouldn't read as "dimmed" against it. */
.confirm-dialog::backdrop {
  background: rgba(10, 43, 32, 0.6);
}

.confirm-dialog__message {
  margin: 0 0 calc(var(--space) * 1.5) 0;
  font-size: var(--font-base);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space);
}
```

**Step 6: Wire the CSS import into main.js**

In `src/main.js`, add the import alongside the others (order doesn't matter here since class names are unique, but keep it near the top with the rest):

```js
import './styles/confirmDialog.css';
```

**Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests including the 4 new ones.

**Step 8: Commit**

```bash
git add src/components/confirmDialog.js src/styles/confirmDialog.css tests/components/confirmDialog.test.js src/main.js
git commit -m "feat: add themed confirm dialog component to replace window.confirm()"
```

---

## Task 2: Replace window.confirm() in setup.js (remove player)

**Fixes:** H1, continued — this is the exact call site shown in `whistfiles/Landing-RemovePlayer.png`

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\setup.js:92-107`
- Test: `d:\GitHub\ContractWhist\tests\screens\setup.test.js` (new)

**Step 1: Write the failing test**

```js
// tests/screens/setup.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderSetup } from '../../src/screens/setup.js';

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/screens/setup.test.js`
Expected: FAIL — first test fails because `window.confirm` is still called.

**Step 3: Update setup.js**

Add the import at the top of `src/screens/setup.js`:

```js
import { createConfirmDialog } from '../components/confirmDialog.js';
```

Replace lines 92-107 (the `removeButton` block) with:

```js
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
```

Note: appending the dialog to `document.body` on each click (rather than once, up front) is deliberate — `router.js` fully replaces the screen's root children on every state change (`root.replaceChildren(...)`), so a dialog created once at render time would be orphaned from the live DOM the moment any other state update triggers a re-render while it's open. Appending directly to `document.body` (outside `root`) keeps it alive independent of the router's re-render cycle.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/screens/setup.test.js`
Expected: PASS, 2 tests.

**Step 5: Run the full suite and commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add src/screens/setup.js tests/screens/setup.test.js
git commit -m "fix: replace window.confirm() with themed dialog for remove-player"
```

---

## Task 3: Replace window.confirm() in scorer.js (end session early)

**Fixes:** H1, continued

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\scorer.js:113-127`
- Test: `d:\GitHub\ContractWhist\tests\screens\scorer.test.js` (new — only the confirm behavior; full scorer screen testing is out of scope for this plan)

**Step 1: Write the failing test**

```js
// tests/screens/scorer.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderScorer } from '../../src/screens/scorer.js';

function baseState(overrides = {}) {
  return {
    session: {
      players: ['p1', 'p2'],
      rounds: [],
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/screens/scorer.test.js`
Expected: FAIL — `window.confirm` is still called.

**Step 3: Update scorer.js**

Add the import at the top:

```js
import { createConfirmDialog } from '../components/confirmDialog.js';
```

Replace lines 113-127 with:

```js
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/screens/scorer.test.js`
Expected: PASS, 2 tests.

**Step 5: Run full suite and commit**

```bash
npm test
git add src/screens/scorer.js tests/screens/scorer.test.js
git commit -m "fix: replace window.confirm() with themed dialog for end-session-early"
```

---

## Task 4: Replace window.confirm() in main.js (resume in-progress session)

**Fixes:** H1, continued — the third and final call site

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\main.js:59-67`

**Context:** This one fires at boot, before `store`/`render` exist yet, so it can't reuse `document.body.replaceChildren`-style screen conventions — but `createConfirmDialog` doesn't depend on the store either, so it works fine appended directly to `document.body` here too, same as the other two call sites.

**Step 1: Update main.js**

Add the import near the top:

```js
import { createConfirmDialog } from './components/confirmDialog.js';
```

Replace lines 59-67:

```js
  const inProgress = await loadInProgressSession();
  if (inProgress) {
    await new Promise((resolve) => {
      const dialog = createConfirmDialog({
        message: `Resume the session from ${new Date(inProgress.date).toLocaleString()}?`,
        confirmLabel: 'Resume',
        onConfirm: () => {
          store.setState({ session: inProgress, screen: 'scorer' });
          resolve();
        },
        onCancel: resolve,
      });
      document.body.append(dialog.element);
      dialog.open();
    });
  }
```

This is the one call site where the surrounding code needs to *wait* for the user's choice before continuing to `render(store.getState(), actions)` on the next line — `window.confirm()` was synchronous, so wrapping the dialog's callback-based API in a `Promise` preserves that same "boot pauses here until the user answers" behavior with the async dialog.

**Step 2: Manual verification (no automated test for this one)**

This path only runs when IndexedDB already has an in-progress session at boot — not practically unit-testable without a much heavier boot-sequence test harness than this plan's scope justifies, and `main.js` has no existing tests to extend. Verify by hand:

Run: `npm run dev`, open the app, start a session, lock in a round, then reload the page.
Expected: a themed parchment/brass dialog appears asking "Resume the session from [date/time]?" with Cancel/Resume buttons — no native browser dialog. Clicking Resume goes to the scorer screen with the round preserved; clicking Cancel (or Escape) stays on setup with a fresh session.

**Step 3: Run full suite and commit**

```bash
npm test
git add src/main.js
git commit -m "fix: replace window.confirm() with themed dialog for resume-session prompt"
```

---

## Task 5: Live bid/tricks running-total feedback during round entry

**Fixes:** H5 (no visible validation against house rules while actually entering a round — Task-Flow persona, single-source but concrete and verifiable in code: `scorer.js` only surfaces `state.errors` after a lock-in/edit *attempt*, never live as fields are typed)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\components\roundEntry.js`
- Modify: `d:\GitHub\ContractWhist\src\styles\roundEntry.css`
- Test: `d:\GitHub\ContractWhist\tests\components\roundEntry.test.js` (new)

**Context:** `validateRound()` (`src/logic/validation.js`) already computes "tricks won must add up to N" and the dealer-bid restriction correctly — the gap is purely that nothing shows the *running* total while typing, only a final pass/fail after clicking "Lock in round". This task adds a small live summary line under the stepper rows showing "Tricks won so far: X of N" (and, when `dealerRestriction` is on, the current bid total), computed from `entries` on every render — no new state, no new validation logic, just a read of numbers already available to `createRoundEntry`.

**Step 1: Write the failing test**

```js
// tests/components/roundEntry.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoundEntry } from '../../src/components/roundEntry.js';

const playersById = { p1: { id: 'p1', name: 'Robert' }, p2: { id: 'p2', name: 'Magda' } };

describe('createRoundEntry — live running totals', () => {
  it('shows tricks-won running total against the hand size as entries are made', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2, won: 3 }, p2: { bid: 1, won: 1 } },
      errors: [],
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Tricks won so far: 4 of 5');
  });

  it('shows 0 when no tricks have been entered yet', () => {
    const el = createRoundEntry({
      hand: 3,
      players: ['p1', 'p2'],
      playersById,
      entries: {},
      errors: [],
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Tricks won so far: 0 of 3');
  });

  it('shows the running bid total when a dealer restriction is in effect', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2 }, p2: { bid: 1 } },
      errors: [],
      dealerRestriction: true,
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).toContain('Bids so far: 3 of 5');
  });

  it('omits the bid total line when no dealer restriction is in effect', () => {
    const el = createRoundEntry({
      hand: 5,
      players: ['p1', 'p2'],
      playersById,
      entries: { p1: { bid: 2 }, p2: { bid: 1 } },
      errors: [],
      dealerRestriction: false,
      onChange: vi.fn(),
    });

    const summary = el.querySelector('.round-entry__summary');
    expect(summary.textContent).not.toContain('Bids so far');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/roundEntry.test.js`
Expected: FAIL — `.round-entry__summary` doesn't exist yet.

**Step 3: Update roundEntry.js**

Add a `dealerRestriction` param and the summary block. Insert after the `players.forEach(...)` loop (after line 65, before `return form;`):

```js
export function createRoundEntry({ hand, players, playersById, entries, errors, dealerRestriction, onChange }) {
  const form = document.createElement('div');
  form.className = 'round-entry';

  const errorFor = (playerId, field) =>
    errors.find((e) => e.playerId === playerId && e.field === field);

  players.forEach((playerId, index) => {
    // ... existing loop body unchanged ...
  });

  // Live feedback so a player sees the running total build up as bids/wins
  // are entered, rather than only finding out it's wrong after "Lock in
  // round" — validateRound() already computes the same final numbers, this
  // just surfaces the partial sum earlier, from the same `entries` data
  // already passed in.
  const wonSoFar = players.reduce((sum, id) => sum + (entries[id]?.won ?? 0), 0);
  const summary = document.createElement('p');
  summary.className = 'round-entry__summary muted';
  summary.setAttribute('aria-live', 'polite');
  let summaryText = `Tricks won so far: ${wonSoFar} of ${hand}`;
  if (dealerRestriction) {
    const bidSoFar = players.reduce((sum, id) => sum + (entries[id]?.bid ?? 0), 0);
    summaryText += `. Bids so far: ${bidSoFar} of ${hand}`;
  }
  summary.textContent = summaryText;
  form.append(summary);

  return form;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/roundEntry.test.js`
Expected: PASS, 4 tests.

**Step 5: Wire dealerRestriction through from scorer.js**

In `src/screens/scorer.js`, the `createRoundEntry({...})` call (around line 72) needs `dealerRestriction: session.dealerRestriction` added to its options object, so the summary knows whether to show the bid-total line. Check `session.dealerRestriction` is the correct field name by reading how `state.dealerRestriction` gets copied onto `session` in `src/app/actions.js`'s `startSession` action before wiring this — if the session object stores it under a different key, use that key instead.

**Step 6: Add the CSS**

Append to `src/styles/roundEntry.css` (read the file first to match existing formatting conventions):

```css
.round-entry__summary {
  margin-top: var(--space);
  font-size: 0.9375rem;
}
```

**Step 7: Manual verification**

Run: `npm run dev`, start a session with 3+ players, enter tricks-won values for some but not all players.
Expected: a line below the entry rows updates live as each stepper changes, reading e.g. "Tricks won so far: 2 of 5."

**Step 8: Run full suite and commit**

```bash
npm test
git add src/components/roundEntry.js src/screens/scorer.js src/styles/roundEntry.css tests/components/roundEntry.test.js
git commit -m "feat: show live running bid/tricks totals during round entry"
```

---

## Task 6: Round progress indicator ("Round 2 of ~5")

**Fixes:** L4 (no visible progress through the session — Task-Flow, single-source, low priority but cheap)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\scorer.js`
- Modify: `d:\GitHub\ContractWhist\src\logic\handSequence.js` (read first — check for an existing `totalRounds`-style helper before adding one)
- Test: `d:\GitHub\ContractWhist\tests\logic\handSequence.test.js` (extend, if a new helper is added)

**Step 1: Read the existing hand-sequence logic**

Read `d:\GitHub\ContractWhist\src\logic\handSequence.js` in full. The setup screen already computes `maxHandSize(playerCount)`, and rounds count up from 1 to that max and back down to 1 (per `setup.js`'s hint text: "hands run 1 up to N cards and back down to 1"). Check whether a function already exists (or can trivially be derived) that returns the *total number of rounds* a full session will have, given `maxSize`. If `handSequence.js` already exports something like `fullSequence(maxSize)` or similar, total rounds is just that array's length — reuse it rather than re-deriving the up-down sequence a second time.

**Step 2: Add (or reuse) a total-rounds helper, with a test if new code is written**

If no such helper exists, add one to `handSequence.js` following the file's existing style, with a Vitest unit test in `tests/logic/handSequence.test.js` first (TDD — write the failing test, confirm it fails, implement, confirm it passes), e.g.:

```js
// tests/logic/handSequence.test.js — add alongside existing tests
it('totalRounds returns the count of a full up-and-down sequence', () => {
  expect(totalRounds(5)).toBe(9); // 1,2,3,4,5,4,3,2,1
  expect(totalRounds(1)).toBe(1); // 1
  expect(totalRounds(3)).toBe(5); // 1,2,3,2,1
});
```

**Step 3: Show "Round N of M" in the scorer heading**

In `src/screens/scorer.js`, the heading currently reads (line 34): `Round ${roundNumber} — dealing ${hand} cards each`. Change to include the total, using `session.maxSize` (confirm this field name against how `startSession` populates `session` in `actions.js` — same check as Task 5 Step 5):

```js
      : hand !== null
        ? `Round ${roundNumber} of ${totalRounds(session.maxSize)} — dealing ${hand} cards each`
        : 'All rounds played';
```

Add the import: `import { totalRounds } from '../logic/handSequence.js';` (or wherever the helper ends up).

**Step 4: Manual verification**

Run: `npm run dev`, start a session with a max hand size of 5.
Expected: heading reads "Round 1 of 9 — dealing 1 cards each" (see Task 9 for the "1 cards" pluralization fix, addressed separately).

**Step 5: Run full suite and commit**

```bash
npm test
git add src/screens/scorer.js src/logic/handSequence.js tests/logic/handSequence.test.js
git commit -m "feat: show round progress (N of M) in the scorer heading"
```

---

## Task 7: Strengthen the disabled "Start session" button state

**Fixes:** H2 (disabled button hard to perceive — Accessibility + Visual Design)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\styles\base.css:44`

**Context:** As established above, the underlying `--surface`/`--text` colors are already contrast-verified — the issue is that `opacity: 0.5` alone can still read as "this might be a rendering glitch" rather than "this is intentionally inactive," especially against the mustard/gold `--accent` fill of `button.primary` (which `.setup__start` also carries). Fix by giving disabled buttons a flatter, explicitly-neutral fill instead of just dimming the existing one — same information (this button is off), clearer signal that it's a deliberate state, not a rendering issue.

**Step 1: Update base.css**

Replace line 44:

```css
button[disabled] {
  opacity: 0.7;
  cursor: not-allowed;
  background: var(--surface);
  color: var(--text-muted);
  border-color: var(--border);
}
```

This overrides `button.primary`'s accent fill specifically when disabled (specificity: `button[disabled]` at 0,1,1 beats `button.primary` at 0,2,0? — **check this**: `.primary` is a class selector too, so `button.primary` is 0,1,1 (element+class) and `button[disabled]` is also 0,1,1 (element+attribute) — equal specificity, so **source order decides**, and `button[disabled]` is already declared after `button.primary` in the file, so it wins as-is. Verify this by inspecting the rendered button in devtools rather than trusting the specificity math alone — if `button.primary[disabled]`'s accent color still shows through, add an explicit `button.primary[disabled]` override rule instead of relying on cascade order.)

**Step 2: Manual verification**

Run: `npm run dev`, go to the New Session screen with 0 or 1 players selected.
Expected: "Start session" renders as a clearly neutral/inactive parchment-colored button (matching other disabled buttons in the app, e.g. the disabled "Lock in round" button while `saving`), not a dimmed gold button.

Also check: with 2+ players selected, the button still renders as the normal solid-gold `.primary` style once re-enabled (i.e. this change is scoped to `[disabled]` only and doesn't leak into the enabled state).

**Step 3: Run full suite and commit**

```bash
npm test
git add src/styles/base.css
git commit -m "fix: give disabled buttons a distinct neutral fill instead of dimmed accent color"
```

---

## Task 8: Visual weight for the "Show archived players" disclosure

**Fixes:** M2 (no disclosure affordance — corroborated by all 3 personas)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\styles\setup.css:118-125`

**Context:** `setup.js` already uses a real `<details>/<summary>` (correct semantics, free keyboard support — see the comment at `setup.js:114-119`). The gap is purely visual: `.setup__archived summary` currently has no marker styling, underline, or color distinct from surrounding body text, so it doesn't visually read as interactive until hovered/focused.

**Step 1: Update setup.css**

Replace the `.setup__archived summary` rule (lines 118-125):

```css
.setup__archived summary {
  cursor: pointer;
  min-height: var(--target-min);
  display: flex;
  align-items: center;
  gap: calc(var(--space) / 2);
  font-size: var(--font-base);
  color: var(--accent);
  font-weight: 600;
}

/* The default triangle marker is browser-styled and inconsistent across
   engines; replace it with an explicit chevron that rotates on open, so
   the control's state (collapsed/expanded) is visible at a glance. */
.setup__archived summary::marker,
.setup__archived summary::-webkit-details-marker {
  display: none;
}

.setup__archived summary::before {
  content: '▸';
  display: inline-block;
  transition: transform 0.15s ease;
}

.setup__archived[open] summary::before {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .setup__archived summary::before {
    transition: none;
  }
}
```

**Step 2: Manual verification**

Run: `npm run dev`, go to New Session.
Expected: "Show archived players" now renders in the app's gold/brass accent color with a chevron (▸) that rotates to point down when the disclosure is expanded. Keyboard toggling (Tab to it, Enter/Space) still works exactly as before — this is a CSS-only change, no markup or JS touched.

**Step 3: Run full suite and commit**

```bash
npm test
git add src/styles/setup.css
git commit -m "style: give the archived-players disclosure a visible interactive affordance"
```

---

## Task 9: Fix "dealing 1 cards each" pluralization

**Fixes:** L1 (corroborated by Visual Design + Task-Flow)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\scorer.js`

**Step 1: Update the heading logic**

In `src/screens/scorer.js`, find the heading template (already touched in Task 6 — apply this on top of that change):

```js
      : hand !== null
        ? `Round ${roundNumber} of ${totalRounds(session.maxSize)} — dealing ${hand} card${hand === 1 ? '' : 's'} each`
        : 'All rounds played';
```

**Step 2: Manual verification**

Run: `npm run dev`, start a session — the first and last rounds of any sequence deal exactly 1 card.
Expected: heading reads "Round 1 of 9 — dealing 1 card each" (not "1 cards each"), and "Round 2 of 9 — dealing 2 cards each" for hand sizes ≥ 2.

**Step 3: Run full suite and commit**

```bash
npm test
git add src/screens/scorer.js
git commit -m "fix: correct card/cards pluralization in the round heading"
```

---

## Task 10: Strengthen the tie callout on Final Scores

**Fixes:** H8 (tie handling under-emphasized — corroborated by all 3 personas)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\styles\summary.css`
- Modify: `d:\GitHub\ContractWhist\src\screens\summary.js` (small markup addition, not logic)

**Context:** The tie is already correctly *detected* and stated in plain language (`summary.js:34-42`, `rankPlayers` in `totals.js`) — 1.4.1 compliant (never color-alone). The fix is purely presentational: give the callout a card treatment consistent with the rest of the app, and visually tie the two "Position 1" rows together in the table.

**Step 1: Wrap the winner line in a styled card when there's a tie**

In `src/screens/summary.js`, the `winnerLine` currently gets appended directly to `screen` as a bare `<p>`. Add a class distinguishing the tie case, so CSS can treat it differently without adding a second render path:

```js
  const winnerLine = document.createElement('p');
  winnerLine.className = winners.length > 1 ? 'summary__winner summary__winner--tied' : 'summary__winner';
```

**Step 2: Mark tied rows in the table**

In the `ranked.forEach`-equivalent loop building `tbody` rows, add a class to rows that share the winning rank:

```js
  for (const { playerId, score, rank } of ranked) {
    const row = document.createElement('tr');
    if (rank === 1 && winners.length > 1) {
      row.className = 'summary__tied-row';
    }
    // ... existing rankCell/nameCell/scoreCell code unchanged ...
  }
```

**Step 3: Add the CSS**

Append to `src/styles/summary.css`:

```css
/* Tied-for-first gets a card treatment and an accent left-edge, instead of
   the same caption weight as every other line on the page — a tie is the
   single most narratively important fact on this screen and previously had
   no more visual weight than any other paragraph. */
.summary__winner--tied {
  background: var(--surface);
  color: var(--text);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  padding: calc(var(--space) * 1.25) calc(var(--space) * 1.5);
}

/* Visually links the tied rows in the results table to the callout above,
   so "Position 1" appearing twice reads as "these two are tied," not as a
   ranking bug. */
.screen.summary tbody tr.summary__tied-row {
  background: var(--accent-wash, rgba(124, 98, 48, 0.08));
}
```

Note: `--accent-wash` doesn't exist in `tokens.css` yet — the `rgba(...)` fallback covers it, but check whether adding a real `--accent-wash` token (a low-opacity tint of `--accent`, contrast-independent since it's a background wash, not text) is worth doing for reuse elsewhere in this plan (Task 11 also wants a subtle row-grouping tint). If added, put it in `tokens.css` with a comment explaining it's a background-only wash, never used for text, so it doesn't need the same contrast verification as the text/border tokens above it.

**Step 4: Manual verification**

Run: `npm run dev`, play a session that ends in a tie for first (e.g. two players both score 10, others score less — matches `whistfiles/FinalScore.png`'s scenario).
Expected: the "Tied on N points: X and Y" line now renders as a distinct parchment card with a gold left border, and both rank-1 rows in the table below share a faint gold tint. A non-tied session (single winner) is visually unchanged from before.

**Step 5: Run full suite and commit**

```bash
npm test
git add src/screens/summary.js src/styles/summary.css src/styles/tokens.css
git commit -m "style: give the tied-for-first callout and rows proper visual weight"
```

---

## Task 11: Bid-accuracy table legend and numeric alignment

**Fixes:** M9 (legend + alignment — Task-Flow + Visual Design, correctly scoped per the "what NOT to change" note above — this is about the *accuracy table*, not the round-history log)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\screens\history.js`
- Modify: `d:\GitHub\ContractWhist\src\styles\history.css`

**Step 1: Add a short legend line under the table caption**

In `src/screens/history.js`, after the existing `caption` element (around line 97), add:

```js
  const legend = document.createElement('p');
  legend.className = 'muted';
  legend.textContent = 'A player "makes" a hand by winning exactly as many tricks as they bid.';
  section.append(h2, caption, legend, tableWrapper);
```

(Replace the existing `section.append(h2, caption, tableWrapper);` line with the version above that includes `legend`.)

**Step 2: Right-align numeric columns**

In `src/styles/history.css`, the existing `.history-screen th, .history-screen td` rule sets `text-align: left` for every column, including the percentage columns. Add a targeted override:

```css
/* Percentage/count columns (every column but the first, "Player") read
   better right-aligned with tabular figures, so digits line up vertically
   for fast scanning down a column — left-aligned numbers force the eye to
   re-find the decimal/percent position on every row. */
.history-screen table td:not(:first-child) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

**Step 3: Manual verification**

Run: `npm run dev`, go to History (needs at least one past session — play one through if the dev DB is empty).
Expected: a one-line legend appears under "How often each player makes their contract, by hand size," and the percentage columns in the Bid accuracy table are right-aligned with digits lining up vertically down each column.

**Step 4: Run full suite and commit**

```bash
npm test
git add src/screens/history.js src/styles/history.css
git commit -m "feat: add legend and right-align numerics on the bid-accuracy table"
```

---

## Task 12: Distinguish "This group, all time" from "Last session" visually

**Fixes:** M10 (Visual Design, single-source — the two cards are structurally identical, indistinguishable except by heading text)

**Files:**
- Modify: `d:\GitHub\ContractWhist\src\styles\history.css`
- Modify: `d:\GitHub\ContractWhist\src\screens\history.js` (add a class hook, no logic change)

**Step 1: Add a class hook to the "all time" section**

In `src/screens/history.js`, the "This group, all time" section (around line 58: `const section = document.createElement('section');`) is currently indistinguishable in markup from "Last session"'s section. Give it its own class:

```js
    const section = document.createElement('section');
    section.className = 'history-screen__all-time';
```

**Step 2: Add a distinguishing style**

Append to `src/styles/history.css`:

```css
/* Distinguishes "This group, all time" from "Last session" beyond its
   heading text alone — same card shape as every other section, but a
   subtle accent border marks it as the cumulative/aggregate view rather
   than a second instance of the same kind of card. */
.history-screen__all-time {
  border: 1px solid var(--border);
}
```

**Step 3: Manual verification**

Run: `npm run dev`, go to History with 2+ players selected on the setup screen beforehand (this section only renders when `selectedPlayerIds.length >= 2`, per `history.js:56`) and at least one past session for that exact group.
Expected: "This group, all time" now has a thin brass border distinguishing it from the plain "Last session" card above it.

**Step 4: Run full suite and commit**

```bash
npm test
git add src/screens/history.js src/styles/history.css
git commit -m "style: visually distinguish the all-time-group card from last-session"
```

---

## Task 13: Full regression pass

**Files:** none (verification only)

**Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS, all tests (existing + all new ones added in Tasks 0-12).

**Step 2: Manual walkthrough against all 8 original screenshots**

Run: `npm run dev`. Walk through the full flow once, comparing against `whistfiles/*.png` at each step, confirming every fix landed and nothing regressed:

1. `Landing.png` — setup screen, 0 players: confirm "Start session" now shows the new neutral disabled style (Task 7).
2. `Landing-Players.png` — add a few players: confirm the "Show archived players" chevron affordance (Task 8).
3. `Landing-RemovePlayer.png` — click a player's ×: confirm a themed dialog appears, not a native browser confirm (Task 2).
4. `Landing-RestorePlayer.png` — after removing, expand "Show archived players" and restore: unchanged, confirm no regression.
5. `Game-Round1.png` — start a session: confirm the heading shows "Round 1 of N" with correct singular "card" (Tasks 6, 9), and the live running-totals line appears under the entry rows as you type (Task 5).
6. `Game-Round2.png` — lock in a round, check round history: unchanged, confirm no regression. Click "End session early": confirm the themed dialog (Task 3).
7. `FinalScore.png` — end a session that ties for first: confirm the strengthened tie callout and tied-row tint (Task 10).
8. `History.png` — view history: confirm the bid-accuracy legend, right-aligned numerics (Task 11), and the all-time-group card's border (Task 12).

**Step 3: Build check**

Run: `npm run build`
Expected: production build succeeds with no errors (confirms no accidental syntax issues or unresolved imports across all the files touched).

**Step 4: Report back**

Summarize which of the original findings (H1-H8, M1-M10, L1-L5) were fixed, which were confirmed as already-correct (no change made — see "Before you start" section), and which remain deliberately out of scope, if any. This becomes the changelog entry / PR description.
