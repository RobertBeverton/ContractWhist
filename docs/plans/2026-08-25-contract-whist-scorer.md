# Contract Whist Scorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an offline-first PWA for scoring contract whist on a Samsung A9 Android tablet, storing player profiles and session history in IndexedDB.

**Architecture:** Vanilla ES modules with a thin hand-rolled render layer, built by Vite. Three layers, strictly separated: (1) **pure logic** — scoring, hand sequence, validation, stats — no DOM, no storage, fully unit-tested; (2) **storage** — a single IndexedDB module behind four functions; (3) **UI** — four screens driven by a tiny state store that re-renders on change. Pure logic never imports storage or DOM, which is what makes it cheap to test and hard to break.

**Tech Stack:** Vanilla JS (ES modules), Vite, `vite-plugin-pwa`, Vitest, `fake-indexeddb`.

**Spec:** [contract-whist-scorer-spec_1.md](../../contract-whist-scorer-spec_1.md) — the source of truth. If this plan and the spec disagree, the spec wins; flag the conflict at the next review gate.

**Accessibility:** the app must meet **WCAG 2.2 Level AA**. This is a build constraint, not a final polish pass — it shapes markup, colour choices, and interaction patterns from the first UI task. See [Accessibility requirements](#accessibility-requirements) below; every UI task states its specific obligations, and Review Gates 3, 4 and 5 test against them.

---

## How to execute this plan

**Task size:** each task is designed to take under 10 minutes. If a task takes materially longer, stop and flag it at the next review gate — it means the plan under-estimated and later tasks may need resizing.

**Parallelism:** every task is tagged:
- `[SEQ]` — must run after the previous task; depends on its output.
- `[PAR: group-name]` — can run concurrently with other tasks sharing that group tag, via subagents. Tasks in a `[PAR]` group touch disjoint files and have no shared state.

Dispatch `[PAR]` groups with superpowers:dispatching-parallel-agents. Never parallelise across a review gate.

**Review gates:** after every ~5 tasks and at each phase boundary, run the gate as specified. Gates use the personas in [docs/review-personas.md](../review-personas.md). A gate is a real stop: do not start the next task until its findings are resolved or explicitly deferred.

**TDD is mandatory** for all pure-logic and storage tasks (Phases 1–2, plus stats in Phase 5). Write the failing test, watch it fail, implement minimally, watch it pass, commit. UI tasks (Phases 3–4) are verified by hand — no unit tests, since a hand-rolled render layer's tests mostly assert that the code does what the code does.

**Commit after every task.** Small commits make the review gates and any rollback cheap.

---

## Accessibility requirements

Target: **WCAG 2.2 Level AA**. UI tasks reference this section rather than restating it. The criteria below are the ones this app can realistically fail — not the whole spec.

**Structure and semantics**
- Native elements first: `<button>` for actions, `<input type="number">` for entry, `<table>` for the round history and score tables, real `<label>` for every input. Reach for ARIA only when no native element fits (*4.1.2 Name, Role, Value*).
- One `<h1>` per screen, headings in order, no level skips (*1.3.1 Info and Relationships*).
- Score tables use `<th scope="col">` / `<th scope="row">` so a screen reader can announce "Alex, 87" rather than a bare number.

**Target size — 2.5.8 (new in WCAG 2.2)**
- Minimum 24×24 CSS px. **This project uses 44×44 minimum** for all interactive controls — a tablet passed between people mid-game needs far more than the floor. Bid/trick steppers, lock-in, and nav buttons all comply.

**Dragging — 2.5.7 (new in WCAG 2.2)**
- Any drag interaction needs a single-pointer alternative. The setup screen's hand-size **slider must be paired with −/+ buttons** (or replaced by a stepper outright), because a bare `<input type="range">` is drag-only in practice.

**Focus — 2.4.11 Focus Not Obscured, 2.4.7 Focus Visible**
- Visible focus indicator on every control, minimum 3:1 against the adjacent background. Never `outline: none` without a replacement.
- Keep the focused control clear of sticky headers/footers — relevant once the live scorer has a fixed totals bar.

**Colour and contrast — 1.4.3, 1.4.11**
- Text ≥ 4.5:1 (large text ≥ 3:1). UI components and focus rings ≥ 3:1.
- **Never encode meaning in colour alone** (*1.4.1*). A missed contract shows a symbol or word, not just red; validation errors carry text, not just a red border.

**Disabled controls with a reason (project convention, decided at Review Gate 3)**
- A disabled button whose reason isn't obvious gets a visible, unconditional (not just `aria-describedby`) explanation paragraph next to it — see Task 14's Start button for the reference pattern.
- Use native `disabled` (not `aria-disabled` + focusable), linked via `aria-describedby` for the assistive-tech pass that does reach it. This is a considered tradeoff, not an oversight: native `disabled` is simpler and consistent with every other disabled control in this app, and the reason is visible on-page regardless of whether a given screen reader announces the `aria-describedby` link for an unfocusable element. Re-examine this convention only if Review Gate 5's real TalkBack pass on the actual tablet shows the reason is genuinely unreachable — don't re-litigate it per screen.

**Errors — 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion**
- Errors are announced in text, associated to their input via `aria-describedby`, and the input is marked `aria-invalid="true"`.
- Error text must say how to fix it: "Tricks won must add up to 5 (currently 2)" — not "Invalid input". The `validateRound` messages from Task 4 are already written this way.
- Round-level errors go in a live region so a screen reader user hears them without hunting.

**Live updates — 4.1.3 Status Messages**
- Running totals updating after lock-in, and the "round saved" confirmation, are announced via `aria-live="polite"`. Never `assertive` — it would interrupt on every round.

**Motion, zoom, orientation — 1.4.10 Reflow, 1.4.4 Resize Text, 1.3.4 Orientation**
- Works in portrait and landscape (the tablet will be rotated).
- Usable at 200% zoom and at 320 CSS px width with no horizontal scrolling.
- Respect `prefers-reduced-motion` for any transition.

**Verification** — Review Gate 3 covers keyboard and semantics, Gate 4 covers the live scorer's errors and live regions, and Gate 5 runs a full pass including a real screen reader (TalkBack) on the tablet.

---

## Phase 1: Foundation and pure scoring logic

No UI, no storage, no IndexedDB. This phase builds and fully tests the rules engine. Everything here is pure functions over plain data — the parts that are hardest to debug later if wrong, and cheapest to test now.

### Task 1: Initialise the project [SEQ]

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `index.html`, `src/main.js`

**Step 1: Scaffold**

Run in `d:\GitHub\ContractWhist`:

```bash
npm init -y
npm install --save-dev vite vitest fake-indexeddb vite-plugin-pwa
```

**Step 2: Create `.gitignore`**

```
node_modules/
dist/
dev-dist/
.DS_Store
*.local
```

**Step 3: Create `vite.config.js`**

Keep the PWA plugin config minimal for now — Task 22 fills in the real manifest.

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

**Step 4: Set scripts in `package.json`**

Replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview --host",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Also add `"type": "module"` at the top level of `package.json` — without it, Node treats `.js` as CommonJS and every import in this project breaks.

**Step 5: Create a placeholder `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contract Whist Scorer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**Step 6: Create a placeholder `src/main.js`**

```js
document.querySelector('#app').textContent = 'Contract Whist Scorer';
```

**Step 7: Verify the toolchain works**

Run: `npm run test`
Expected: Vitest runs and reports "No test files found" — exit code may be non-zero, that's fine. The point is that Vitest itself executes without a config error.

Run: `npm run dev`, open the printed localhost URL, confirm "Contract Whist Scorer" renders, then stop the server.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + Vitest project"
```

---

### Task 2: Scoring rule [PAR: logic-a]

The single most important function in the app. `points = made ? 10 + bid : 0`.

**Files:**
- Create: `src/logic/scoring.js`
- Test: `tests/logic/scoring.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { roundPoints } from '../../src/logic/scoring.js';

describe('roundPoints', () => {
  it('scores a made contract as 10 + bid', () => {
    expect(roundPoints(3, 3)).toBe(13);
  });

  it('scores a made zero bid as 10', () => {
    // House rule: a made nil bid is worth 10, not 0. See spec "Scoring rule".
    expect(roundPoints(0, 0)).toBe(10);
  });

  it('scores a missed contract as 0 when under', () => {
    expect(roundPoints(3, 1)).toBe(0);
  });

  it('scores a missed contract as 0 when over', () => {
    // Taking more tricks than bid is still a failed contract.
    expect(roundPoints(1, 2)).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/scoring.test.js`
Expected: FAIL — cannot find module `src/logic/scoring.js`.

**Step 3: Write minimal implementation**

```js
/**
 * Points for one player in one round.
 * House rule: a made contract scores 10 + bid; a missed one scores 0.
 * A made zero bid therefore scores 10.
 */
export function roundPoints(bid, won) {
  return bid === won ? 10 + bid : 0;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/scoring.test.js`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add tests/logic/scoring.test.js src/logic/scoring.js
git commit -m "feat: add round scoring rule"
```

---

### Task 3: Hand sequence and trump-card cap [PAR: logic-a]

The spec's trump-card rule: one card is always held back undealt, so the cap is `floor((52-1)/playerCount)`, **not** `floor(52/playerCount)`. Getting this wrong means dealing a hand that's physically impossible.

**Files:**
- Create: `src/logic/handSequence.js`
- Test: `tests/logic/handSequence.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { maxHandSize, buildHandSequence } from '../../src/logic/handSequence.js';

describe('maxHandSize', () => {
  it('reserves one card for the trump turn-up with 4 players', () => {
    // 52 cards, 1 held back for trumps, 51/4 = 12 (not 13).
    expect(maxHandSize(4)).toBe(12);
  });

  it('computes the cap for 5 players', () => {
    expect(maxHandSize(5)).toBe(10);
  });

  it('computes the cap for 2 players', () => {
    expect(maxHandSize(2)).toBe(25);
  });
});

describe('buildHandSequence', () => {
  it('counts down to 1 then back up to the start', () => {
    expect(buildHandSequence(3)).toEqual([3, 2, 1, 2, 3]);
  });

  it('handles a start size of 1 as a single round', () => {
    expect(buildHandSequence(1)).toEqual([1]);
  });

  it('produces 2n-1 rounds for a start size of n', () => {
    expect(buildHandSequence(7)).toHaveLength(13);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/handSequence.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
const DECK_SIZE = 52;
const TRUMP_CARD_RESERVE = 1;

/**
 * Largest hand size dealable to `playerCount` players.
 * One card is always held back undealt to turn up as the trump indicator,
 * so the deck is never fully dealt out.
 */
export function maxHandSize(playerCount) {
  return Math.floor((DECK_SIZE - TRUMP_CARD_RESERVE) / playerCount);
}

/**
 * Hand sizes for a whole session: count down from `startSize` to 1, then back up.
 * e.g. 3 -> [3, 2, 1, 2, 3]
 */
export function buildHandSequence(startSize) {
  const down = [];
  for (let n = startSize; n >= 1; n--) down.push(n);
  const up = [];
  for (let n = 2; n <= startSize; n++) up.push(n);
  return [...down, ...up];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/handSequence.test.js`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add tests/logic/handSequence.test.js src/logic/handSequence.js
git commit -m "feat: add hand sequence and trump-card-aware size cap"
```

---

### Task 4: Round validation [PAR: logic-a]

**Files:**
- Create: `src/logic/validation.js`
- Test: `tests/logic/validation.test.js`

Validation returns a list of errors rather than throwing, so the UI can show all problems at once and attach each to the right player's row.

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { validateRound } from '../../src/logic/validation.js';

const players = ['p_alex', 'p_sam'];

describe('validateRound', () => {
  it('accepts a valid round', () => {
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 1, won: 2 } };
    expect(validateRound({ hand: 5, players, entries })).toEqual([]);
  });

  it('rejects a missing value', () => {
    const entries = { p_alex: { bid: 2, won: null }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'won', message: 'Enter tricks won' });
  });

  it('rejects a value above the hand size', () => {
    const entries = { p_alex: { bid: 6, won: 3 }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'bid', message: 'Must be between 0 and 5' });
  });

  it('rejects a negative value', () => {
    const entries = { p_alex: { bid: -1, won: 3 }, p_sam: { bid: 1, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ playerId: 'p_alex', field: 'bid', message: 'Must be between 0 and 5' });
  });

  it('rejects when tricks won do not sum to the hand size', () => {
    const entries = { p_alex: { bid: 2, won: 1 }, p_sam: { bid: 1, won: 1 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors).toContainEqual({ field: 'won', message: 'Tricks won must add up to 5 (currently 2)' });
  });

  it('does not report the sum error while values are still missing', () => {
    // Avoids showing a confusing sum error before the scorer has finished typing.
    const entries = { p_alex: { bid: 2, won: null }, p_sam: { bid: 1, won: 1 } };
    const errors = validateRound({ hand: 5, players, entries });
    expect(errors.some((e) => e.message.startsWith('Tricks won must add up'))).toBe(false);
  });

  it('rejects a dealer bid making bids equal the hand when the rule is on', () => {
    // "Someone must go down": last player in the list is the dealer.
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 3, won: 2 } };
    const errors = validateRound({ hand: 5, players, entries, dealerRestriction: true });
    expect(errors).toContainEqual({
      playerId: 'p_sam',
      field: 'bid',
      message: 'Bids cannot add up to 5 — dealer must change bid',
    });
  });

  it('allows bids equal to the hand when the rule is off', () => {
    const entries = { p_alex: { bid: 2, won: 3 }, p_sam: { bid: 3, won: 2 } };
    expect(validateRound({ hand: 5, players, entries })).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/validation.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
const FIELD_LABELS = { bid: 'Enter bid', won: 'Enter tricks won' };

function isMissing(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Validate one round's entries. Returns an array of errors (empty === valid).
 * Errors carry `playerId` where they belong to a specific row, so the UI can
 * attach them to that player; round-wide errors omit it.
 *
 * The dealer is the last player in `players`.
 */
export function validateRound({ hand, players, entries, dealerRestriction = false }) {
  const errors = [];

  for (const playerId of players) {
    const entry = entries[playerId] ?? {};
    for (const field of ['bid', 'won']) {
      const value = entry[field];
      if (isMissing(value)) {
        errors.push({ playerId, field, message: FIELD_LABELS[field] });
      } else if (!Number.isInteger(value) || value < 0 || value > hand) {
        errors.push({ playerId, field, message: `Must be between 0 and ${hand}` });
      }
    }
  }

  const allWonPresent = players.every((id) => !isMissing(entries[id]?.won));
  if (allWonPresent) {
    const totalWon = players.reduce((sum, id) => sum + entries[id].won, 0);
    if (totalWon !== hand) {
      errors.push({ field: 'won', message: `Tricks won must add up to ${hand} (currently ${totalWon})` });
    }
  }

  if (dealerRestriction) {
    const allBidsPresent = players.every((id) => !isMissing(entries[id]?.bid));
    if (allBidsPresent) {
      const totalBid = players.reduce((sum, id) => sum + entries[id].bid, 0);
      if (totalBid === hand) {
        const dealerId = players[players.length - 1];
        errors.push({
          playerId: dealerId,
          field: 'bid',
          message: `Bids cannot add up to ${hand} — dealer must change bid`,
        });
      }
    }
  }

  return errors;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/validation.test.js`
Expected: PASS, 8 tests.

**Step 5: Commit**

```bash
git add tests/logic/validation.test.js src/logic/validation.js
git commit -m "feat: add round validation with optional dealer restriction"
```

---

### Task 5: Session totals [SEQ]

Depends on Task 2 (`roundPoints`). Running totals are always **derived** from the rounds array, never stored incrementally — that is what makes "edit the last round and recompute" trivial rather than error-prone.

**Files:**
- Create: `src/logic/totals.js`
- Test: `tests/logic/totals.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { computeTotals, rankPlayers } from '../../src/logic/totals.js';

const players = ['p_alex', 'p_sam'];
const rounds = [
  { hand: 2, results: { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } } },
  { hand: 1, results: { p_alex: { bid: 0, won: 1 }, p_sam: { bid: 1, won: 0 } } },
];

describe('computeTotals', () => {
  it('sums points across rounds', () => {
    // Alex: made 1 (11) + missed (0) = 11. Sam: made 1 (11) + missed (0) = 11.
    expect(computeTotals(players, rounds)).toEqual({ p_alex: 11, p_sam: 11 });
  });

  it('returns zeroes when no rounds have been played', () => {
    expect(computeTotals(players, [])).toEqual({ p_alex: 0, p_sam: 0 });
  });
});

describe('rankPlayers', () => {
  it('ranks by descending score', () => {
    const ranked = rankPlayers({ p_alex: 20, p_sam: 35, p_jo: 12 });
    expect(ranked.map((r) => r.playerId)).toEqual(['p_sam', 'p_alex', 'p_jo']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('gives tied players the same rank and skips the next', () => {
    const ranked = rankPlayers({ p_alex: 20, p_sam: 20, p_jo: 12 });
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/totals.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
import { roundPoints } from './scoring.js';

/**
 * Running totals per player, always derived from the full rounds array.
 * Never stored incrementally — recomputing from source is what makes editing
 * an earlier round safe.
 */
export function computeTotals(players, rounds) {
  const totals = Object.fromEntries(players.map((id) => [id, 0]));
  for (const round of rounds) {
    for (const playerId of players) {
      const result = round.results[playerId];
      if (result) totals[playerId] += roundPoints(result.bid, result.won);
    }
  }
  return totals;
}

/**
 * Rank players by descending score. Ties share a rank and the next rank is
 * skipped (standard competition ranking: 1, 1, 3).
 */
export function rankPlayers(totals) {
  const sorted = Object.entries(totals)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score);

  let lastScore = null;
  let lastRank = 0;
  return sorted.map((entry, index) => {
    const rank = entry.score === lastScore ? lastRank : index + 1;
    lastScore = entry.score;
    lastRank = rank;
    return { ...entry, rank };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/totals.test.js`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add tests/logic/totals.test.js src/logic/totals.js
git commit -m "feat: add derived session totals and ranking"
```

---

## 🚦 Review Gate 1 — after Task 5

**Run the full suite first:**

Run: `npm run test`
Expected: PASS, 22 tests across 4 files.

**Then review the Phase 1 code against the spec** using [docs/review-personas.md](../review-personas.md):

- **Rules Lawyer** — Does `roundPoints` match the spec's house rules exactly, including a made zero bid scoring 10? Does `maxHandSize` reserve the trump card (12 for 4 players, not 13)? Does the dealer restriction check the *last* player in the list, and only when the rule is on? Is `buildHandSequence` symmetric?
- **Skeptical Platform Engineer** — Is any of this logic accidentally coupled to the DOM, storage, or `Date.now()`? It must be pure and deterministic. Does `npm run test` pass from a clean `node_modules`?
- **YAGNI Editor** — Is there any function, option, or branch here that no screen in the spec actually calls? Cut it now, before UI depends on it.

**Gate criteria — do not start Phase 2 until:**
1. All tests pass.
2. `maxHandSize(4) === 12` (the trump-card rule is correctly applied).
3. Totals are derived from rounds, with no incremental accumulator anywhere.
4. No pure-logic module imports from `src/storage/` or touches `document`.

---

## Phase 2: Storage layer

One IndexedDB module exposing the four functions from the spec, plus the in-progress session autosave. Still no UI. Tests run in Node against `fake-indexeddb`, so this phase is verifiable without a browser.

### Task 6: IndexedDB connection and schema [SEQ]

**Files:**
- Create: `src/storage/db.js`
- Test: `tests/storage/db.test.js`

**Step 1: Add the fake-indexeddb setup to Vitest config**

Modify `vite.config.js` — add a `setupFiles` entry so every storage test gets a clean in-memory IndexedDB:

```js
test: {
  environment: 'node',
  include: ['tests/**/*.test.js'],
  setupFiles: ['tests/setup.js'],
},
```

Create `tests/setup.js`:

```js
import 'fake-indexeddb/auto';
```

**Step 2: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, STORES } from '../../src/storage/db.js';

beforeEach(async () => {
  // Fresh database per test so state never leaks between them.
  indexedDB.deleteDatabase('contract-whist');
});

describe('openDb', () => {
  it('creates both object stores', async () => {
    const db = await openDb();
    expect([...db.objectStoreNames].sort()).toEqual(['players', 'sessions']);
    db.close();
  });

  it('keys players by id and sessions by sessionId', async () => {
    const db = await openDb();
    const tx = db.transaction([STORES.players, STORES.sessions], 'readonly');
    expect(tx.objectStore(STORES.players).keyPath).toBe('id');
    expect(tx.objectStore(STORES.sessions).keyPath).toBe('sessionId');
    db.close();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run tests/storage/db.test.js`
Expected: FAIL — cannot find module.

**Step 4: Write minimal implementation**

```js
const DB_NAME = 'contract-whist';
const DB_VERSION = 1;

export const STORES = { players: 'players', sessions: 'sessions' };

/** Open (and if needed create) the app database. */
export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.players)) {
        db.createObjectStore(STORES.players, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Promise wrapper around a single IndexedDB request. */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/storage/db.test.js`
Expected: PASS, 2 tests.

**Step 6: Commit**

```bash
git add tests/setup.js tests/storage/db.test.js src/storage/db.js vite.config.js
git commit -m "feat: add IndexedDB connection and schema"
```

---

### Task 7: Player profile storage [SEQ]

**Files:**
- Create: `src/storage/players.js`
- Test: `tests/storage/players.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { savePlayer, loadAllPlayers, createPlayer } from '../../src/storage/players.js';

beforeEach(() => {
  indexedDB.deleteDatabase('contract-whist');
});

describe('createPlayer', () => {
  it('generates an id from the name', () => {
    expect(createPlayer('Alex').id).toMatch(/^p_/);
  });

  it('gives two players with the same name different ids', () => {
    // Two real people can share a first name; ids must not collide.
    expect(createPlayer('Alex').id).not.toBe(createPlayer('Alex').id);
  });

  it('trims whitespace from the name', () => {
    expect(createPlayer('  Alex  ').name).toBe('Alex');
  });
});

describe('savePlayer / loadAllPlayers', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await loadAllPlayers()).toEqual([]);
  });

  it('round-trips a saved player', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);
    expect(await loadAllPlayers()).toEqual([player]);
  });

  it('overwrites a player with the same id rather than duplicating', async () => {
    const player = createPlayer('Alex');
    await savePlayer(player);
    await savePlayer({ ...player, name: 'Alexandra' });
    const all = await loadAllPlayers();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Alexandra');
  });

  it('sorts players by name', async () => {
    await savePlayer(createPlayer('Sam'));
    await savePlayer(createPlayer('Alex'));
    expect((await loadAllPlayers()).map((p) => p.name)).toEqual(['Alex', 'Sam']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/players.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
import { openDb, promisifyRequest, STORES } from './db.js';

/**
 * Build a new player profile. The id is stable for the life of the profile,
 * so renaming a player never forks their history.
 */
export function createPlayer(name) {
  const trimmed = name.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player';
  // crypto.randomUUID() (widely supported in the target browsers) gives a
  // collision-safe id; savePlayer does a `put`, so a colliding id would
  // silently overwrite an unrelated player rather than erroring.
  const suffix = crypto.randomUUID().slice(0, 8);
  return { id: `p_${slug}_${suffix}`, name: trimmed };
}

export async function savePlayer(player) {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.players).put(player));
  db.close();
}

/** All player profiles, sorted by name for stable display in the picker. */
export async function loadAllPlayers() {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readonly');
  const players = await promisifyRequest(tx.objectStore(STORES.players).getAll());
  db.close();
  return players.sort((a, b) => a.name.localeCompare(b.name));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage/players.test.js`
Expected: PASS, 7 tests.

**Step 5: Commit**

```bash
git add tests/storage/players.test.js src/storage/players.js
git commit -m "feat: add player profile storage"
```

---

### Task 8: Session storage and autosave [SEQ]

The spec requires autosave after every lock-in and a way to resume an interrupted session. Both are the same `put` into the `sessions` store — an in-progress session is just one with `status: 'in-progress'`.

**Files:**
- Create: `src/storage/sessions.js`
- Test: `tests/storage/sessions.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSession,
  loadAllSessions,
  loadInProgressSession,
  createSession,
} from '../../src/storage/sessions.js';

beforeEach(() => {
  indexedDB.deleteDatabase('contract-whist');
});

const players = ['p_alex', 'p_sam'];

describe('createSession', () => {
  it('starts in progress with no rounds', () => {
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    expect(session.status).toBe('in-progress');
    expect(session.rounds).toEqual([]);
  });

  it('records the rule variant in use', () => {
    // Recorded per session so old sessions stay unambiguous if the rule changes.
    const session = createSession({ players, startSize: 3, dealerRestriction: true });
    expect(session.rules).toEqual({ dealerRestriction: true });
  });

  it('stores the hand sequence for the session', () => {
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    expect(session.handSequence).toEqual([3, 2, 1, 2, 3]);
  });
});

describe('saveSession / loadAllSessions', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await loadAllSessions()).toEqual([]);
  });

  it('round-trips a session', async () => {
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    await saveSession(session);
    expect(await loadAllSessions()).toEqual([session]);
  });

  it('overwrites on repeated save rather than duplicating', async () => {
    // Autosave writes the same sessionId after every round.
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    await saveSession(session);
    await saveSession({ ...session, rounds: [{ hand: 3, results: {} }] });
    const all = await loadAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0].rounds).toHaveLength(1);
  });
});

describe('loadInProgressSession', () => {
  it('returns null when there is no interrupted session', async () => {
    expect(await loadInProgressSession()).toBeNull();
  });

  it('finds an in-progress session to resume', async () => {
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    await saveSession(session);
    expect((await loadInProgressSession()).sessionId).toBe(session.sessionId);
  });

  it('ignores completed sessions', async () => {
    const session = createSession({ players, startSize: 3, dealerRestriction: false });
    await saveSession({ ...session, status: 'complete' });
    expect(await loadInProgressSession()).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/sessions.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
import { openDb, promisifyRequest, STORES } from './db.js';
import { buildHandSequence } from '../logic/handSequence.js';

/**
 * `2026-08-25-1930-a1b2` — sortable, with a random suffix so two sessions
 * started within the same clock minute (e.g. restarting a misconfigured
 * session) don't collide. saveSession does a `put`, so a colliding id would
 * silently overwrite the earlier session rather than erroring.
 */
function buildSessionId(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

export function createSession({ players, startSize, dealerRestriction, now = new Date() }) {
  return {
    sessionId: buildSessionId(now),
    date: now.toISOString(),
    status: 'in-progress',
    rules: { dealerRestriction },
    players: [...players],
    handSequence: buildHandSequence(startSize),
    rounds: [],
  };
}

export async function saveSession(session) {
  const db = await openDb();
  const tx = db.transaction(STORES.sessions, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.sessions).put(session));
  db.close();
}

/** All sessions, newest first. */
export async function loadAllSessions() {
  const db = await openDb();
  const tx = db.transaction(STORES.sessions, 'readonly');
  const sessions = await promisifyRequest(tx.objectStore(STORES.sessions).getAll());
  db.close();
  return sessions.sort((a, b) => b.sessionId.localeCompare(a.sessionId));
}

/** The most recent unfinished session, if one was interrupted. */
export async function loadInProgressSession() {
  const sessions = await loadAllSessions();
  return sessions.find((s) => s.status === 'in-progress') ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage/sessions.test.js`
Expected: PASS, 9 tests.

**Step 5: Commit**

```bash
git add tests/storage/sessions.test.js src/storage/sessions.js
git commit -m "feat: add session storage with autosave and resume"
```

---

### Task 9: Graceful storage failure [SEQ]

The spec: *"don't hard-fail if history can't be loaded (app still works with zero history present)"*. IndexedDB is genuinely unavailable in some states — private browsing on some browsers, disabled site data, storage pressure — and the app must still score a game.

**Files:**
- Modify: `src/storage/players.js`, `src/storage/sessions.js`
- Test: `tests/storage/resilience.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadAllSessions } from '../../src/storage/sessions.js';
import { loadAllPlayers } from '../../src/storage/players.js';
import * as db from '../../src/storage/db.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storage resilience', () => {
  it('returns an empty session list when the database cannot be opened', async () => {
    vi.spyOn(db, 'openDb').mockRejectedValue(new Error('IndexedDB unavailable'));
    await expect(loadAllSessions()).resolves.toEqual([]);
  });

  it('returns an empty player list when the database cannot be opened', async () => {
    vi.spyOn(db, 'openDb').mockRejectedValue(new Error('IndexedDB unavailable'));
    await expect(loadAllPlayers()).resolves.toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/resilience.test.js`
Expected: FAIL — the rejection propagates instead of resolving to `[]`.

**Step 3: Implement**

Wrap both read functions. Reads degrade to empty; **writes still reject** — a failed save must be surfaceable to the user, not silently swallowed.

In `src/storage/sessions.js`, change `loadAllSessions`:

```js
/** All sessions, newest first. Degrades to [] if storage is unavailable. */
export async function loadAllSessions() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.sessions, 'readonly');
    const sessions = await promisifyRequest(tx.objectStore(STORES.sessions).getAll());
    db.close();
    return sessions.sort((a, b) => b.sessionId.localeCompare(a.sessionId));
  } catch (error) {
    console.warn('Could not load sessions; continuing with none.', error);
    return [];
  }
}
```

Apply the same `try/catch` shape to `loadAllPlayers` in `src/storage/players.js`.

Note: the test spies on the `db` module, so both files must call `openDb` via the imported binding (they already do).

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage/resilience.test.js`
Expected: PASS, 2 tests.

**Step 5: Run the whole suite for regressions**

Run: `npm run test`
Expected: PASS, 42 tests.

**Step 6: Commit**

```bash
git add tests/storage/resilience.test.js src/storage/players.js src/storage/sessions.js
git commit -m "feat: degrade gracefully when storage is unavailable"
```

---

## 🚦 Review Gate 2 — after Task 9 (end of Phase 2)

**Run the full suite:**

Run: `npm run test`
Expected: PASS, 42 tests across 7 files.

**Review Phases 1–2 against the spec:**

- **Skeptical Platform Engineer** — Does anything still reference the File System Access API or a folder picker? (It must not; that was the spec's fatal flaw.) Do writes propagate errors while reads degrade to empty? Is `fake-indexeddb` confined to tests and absent from the app bundle?
- **Rules Lawyer** — Does `createSession` persist `rules.dealerRestriction` and `handSequence` on the record itself, so a rule change later can't retroactively reinterpret an old session? Do sessions store player **IDs**, never names?
- **YAGNI Editor** — Is `loadInProgressSession` actually needed for v1, or is it speculative? (Keep it: the spec's autosave requirement is meaningless without a resume path.) Any unused exports?

**Gate criteria — do not start Phase 3 until:**
1. All tests pass.
2. Sessions store player IDs, and `rules` + `handSequence` are on the session record.
3. Read failures return empty; write failures reject.
4. No storage function is unused by the plan's later tasks.

---

## Phase 3: App shell, accessible foundations, and setup screen

UI work begins. Tasks here are verified by hand (browser + keyboard), not unit tests. Every task in this phase must satisfy [Accessibility requirements](#accessibility-requirements).

### Task 10: Design tokens and base stylesheet [PAR: shell]

Contrast-checked colours and 44px touch targets defined once, as CSS custom properties. Doing this before any screen exists prevents retrofitting contrast fixes across four screens later.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`

**Step 1: Create `src/styles/tokens.css`**

Every pairing below is contrast-checked against WCAG AA. Do not add a colour to this file without checking it.

```css
:root {
  /* Surfaces */
  --bg: #ffffff;
  --surface: #f4f6f8;
  --border: #6b7280;          /* 4.8:1 on --bg: passes 1.4.11 for component borders */

  /* Text */
  --text: #14181f;            /* 16.9:1 on --bg */
  --text-muted: #4b5563;      /* 8.0:1 on --bg — muted, still AA for body text */

  /* Accent (actions) */
  --accent: #1d4ed8;          /* 7.5:1 on --bg */
  --accent-text: #ffffff;     /* 7.5:1 on --accent */

  /* Status — never used as the ONLY signal (1.4.1) */
  --danger: #b3261e;          /* 6.4:1 on --bg */
  --success: #12633b;         /* 7.3:1 on --bg */

  --focus-ring: #b45309;      /* 4.6:1 on --bg and 3:1+ against --accent */

  /* Sizing — 2.5.8 requires 24px; 44px chosen for a shared tablet */
  --target-min: 44px;
  --space: 8px;
  --radius: 8px;

  /* Type — scales with user font settings (1.4.4) */
  --font-base: 1.125rem;
  --font-large: 1.75rem;
  --font-total: 2.5rem;       /* running totals, readable across a table */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #10141a;
    --surface: #1b212b;
    --border: #9aa4b2;
    --text: #f2f5f8;
    --text-muted: #c2cad6;
    --accent: #7aa7ff;
    --accent-text: #0b1220;
    --danger: #ff9a92;
    --success: #6ddba4;
    --focus-ring: #ffb454;
  }
}
```

**Step 2: Create `src/styles/base.css`**

```css
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: var(--space);
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: var(--font-base);
  line-height: 1.5;
}

/* 2.4.7 Focus Visible — never remove without replacing. */
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

/* 2.5.8 Target Size */
button, .target {
  min-width: var(--target-min);
  min-height: var(--target-min);
  font-size: var(--font-base);
  border-radius: var(--radius);
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

button.primary {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
}

button[disabled] { opacity: 0.5; cursor: not-allowed; }

/* Visible only to screen readers — for headings and live regions. */
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.error {
  color: var(--danger);
  font-weight: 600;
}

.muted {
  color: var(--text-muted);
}

/* 1.4.10 Reflow — usable at 320px and 200% zoom. */
.screen { max-width: 60rem; margin: 0 auto; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 3: Verify**

Import `./styles/base.css` at the top of `src/main.js`, run `npm run dev`, and confirm the page renders with the token colours and that Tab shows a visible focus ring.

**Step 4: Commit**

```bash
git add src/styles/ src/main.js
git commit -m "feat: add contrast-checked design tokens and base styles"
```

---

### Task 11: App state store and router [PAR: shell]

A ~40-line state container: hold state, re-render on change. No framework.

**Files:**
- Create: `src/app/store.js`, `src/app/router.js`
- Test: `tests/app/store.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/app/store.js';

describe('createStore', () => {
  it('exposes the initial state', () => {
    expect(createStore({ screen: 'setup' }).getState()).toEqual({ screen: 'setup' });
  });

  it('merges a partial update', () => {
    const store = createStore({ screen: 'setup', players: [] });
    store.setState({ screen: 'scorer' });
    expect(store.getState()).toEqual({ screen: 'scorer', players: [] });
  });

  it('notifies subscribers on change', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener)();
    store.setState({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/store.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write `src/app/store.js`**

```js
/**
 * Minimal observable state container. setState shallow-merges a partial
 * update — nested values (e.g. `session`) are replaced wholesale, not
 * deep-merged. Callers updating part of a nested object must spread it
 * themselves: setState({ session: { ...session, rounds: [...] } }).
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState: () => state,
    setState(partial) {
      state = { ...state, ...partial };
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

**Step 4: Write `src/app/router.js`**

Screen swaps must move focus to the new `<h1>`, or a keyboard/screen-reader user is stranded where the old screen was (*2.4.3 Focus Order*).

```js
/**
 * Render the active screen into the root element.
 * `screens` maps a screen name to a render function returning an element.
 *
 * Screens (setup, scorer, ...) are called as `renderScreen(state)` only —
 * they also need `actions` (see e.g. src/screens/setup.js's `{state, actions}`
 * param). Wiring `actions` through is deliberately deferred to Task 20
 * ("Wire actions, autosave, and resume"), which is where the caller of
 * `render(state)` will need to pass `{ state, actions }` instead of a bare
 * state object. Not a bug in this file — just not built yet.
 */
export function createRouter(root, screens) {
  return function render(state) {
    const renderScreen = screens[state.screen];
    if (!renderScreen) throw new Error(`Unknown screen: ${state.screen}`);

    root.replaceChildren(renderScreen(state));

    // Move focus to the new screen's heading so keyboard and screen reader
    // users land in the right place after a screen change.
    const heading = root.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else {
      // A screen with no <h1> silently strands focus — a WCAG 2.4.3
      // violation. Warn loudly so it surfaces during hand-testing.
      console.warn(`Screen "${state.screen}" has no <h1> — focus was not moved.`);
    }
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/app/store.test.js`
Expected: PASS, 4 tests.

**Step 6: Commit**

```bash
git add tests/app/store.test.js src/app/store.js src/app/router.js
git commit -m "feat: add state store and focus-managing router"
```

---

### Task 12: Reusable accessible number stepper [SEQ — after Task 10]

Bid and trick entry happen 4× per round, ~13 rounds a night, by whoever's holding the tablet. A bare `<input type="number">` gives tiny spinner arrows that fail 2.5.8 and invite fat-finger errors. A −/+ stepper with 44px buttons fixes both, and satisfies 2.5.7 by requiring no dragging.

> Runs after Task 10, not alongside it: `stepper.css` consumes the tokens (`--target-min`, `--font-large`) that Task 10 defines, and step 3 can't verify the 44px target without them. It may still run in parallel with Task 11, which shares no files.

**Files:**
- Create: `src/components/stepper.js`, `src/styles/stepper.css`

**Step 1: Write `src/components/stepper.js`**

```js
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

**Step 2: Write `src/styles/stepper.css`**

```css
.stepper__label {
  display: block;
  font-size: var(--font-base);
  margin-bottom: calc(var(--space) / 2);
}

.stepper__controls { display: flex; align-items: stretch; gap: var(--space); }

.stepper__button {
  min-width: var(--target-min);
  min-height: var(--target-min);
  font-size: var(--font-large);
  line-height: 1;
}

.stepper__input {
  width: 4.5rem;
  min-height: var(--target-min);
  font-size: var(--font-large);
  text-align: center;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  /* Hide the native spin buttons — they're far below the 44px target size
     this component exists to provide; the −/+ buttons replace them. */
  -moz-appearance: textfield;
  appearance: textfield;
}

.stepper__input::-webkit-outer-spin-button,
.stepper__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stepper__input[aria-invalid='true'] {
  border-color: var(--danger);
  border-width: 3px;   /* thickness, not just colour (1.4.1) */
}
```

**Step 3: Verify by hand**

Temporarily mount a stepper in `src/main.js`, run `npm run dev`, and confirm:
- Tab reaches −, the input, then + in order.
- Clicking − and + changes the value and respects min/max.
- Typing a value directly works.
- Each button announces a distinct name (inspect the accessibility tree in DevTools).

Then revert the temporary mount.

**Step 4: Commit**

```bash
git add src/components/stepper.js src/styles/stepper.css
git commit -m "feat: add accessible number stepper component"
```

---

### Task 13: Setup screen — player selection [SEQ]

Depends on Tasks 10–12.

**Files:**
- Create: `src/screens/setup.js`, `src/styles/setup.css`

**Step 1: Implement player selection**

A checkbox list of saved players plus an add-player field. Checkboxes (not a custom widget) mean keyboard and screen-reader support comes free, and each row's 44px target satisfies 2.5.8.

**Do not put `.target` on the row.** `base.css`'s sizing utility is `button, .target { min-width; min-height; border; background; cursor: pointer; ... }` — it bundles 44px sizing with visible button chrome. A checkbox-list row is not a button; give `.setup__player` its own `min-height: var(--target-min)` directly in `setup.css` instead (same pattern `.stepper__button` already uses), and leave `:focus-visible` alone since it's a global rule, not scoped to `.target`.

```js
import { maxHandSize } from '../logic/handSequence.js';

/**
 * KNOWN GAP (deliberately deferred, not forgotten): no duplicate-name check
 * on add — two players named "Rob" would render as identical,
 * indistinguishable checkboxes. state.allPlayers is available here if this
 * screen ends up owning the check; revisit when Task 20 wires the real
 * addPlayer action, which is the point a decision on which layer owns this
 * becomes concrete.
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
    row.className = 'setup__player'; // no .target — see note above

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
```

Note: this returns partial output; Task 14 completes the screen. Keep it in one file — the split is only to keep tasks under 10 minutes.

**Step 2: Verify by hand**

Wire the setup screen into the router with stub actions, `npm run dev`, and confirm players list, checkboxes toggle, and add-player appends a row.

**Step 3: Commit**

```bash
git add src/screens/setup.js src/styles/setup.css
git commit -m "feat: add setup screen player selection"
```

---

### Task 14: Setup screen — rules, hand size, and start [SEQ]

Completes the setup screen. The hand-size control is where 2.5.7 (Dragging Movements) applies: a bare range slider is drag-only, so it is paired with −/+ buttons.

**Files:**
- Modify: `src/screens/setup.js`, `src/styles/setup.css`

**Step 1: Add the rules toggle, hand-size stepper, and start button**

Append inside `renderSetup`, before `return`:

```js
  const playerCount = state.selectedPlayerIds.length;
  const maxHand = playerCount >= 2 ? maxHandSize(playerCount) : null;

  // --- Dealer restriction ---------------------------------------------
  const rulesGroup = document.createElement('fieldset');
  const rulesLegend = document.createElement('legend');
  rulesLegend.textContent = 'House rules';

  const ruleRow = document.createElement('div');
  ruleRow.className = 'setup__rule target';

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
  // NOTE: a natively `disabled` button is unfocusable, so a screen reader
  // may never reach this description via aria-describedby regardless — a
  // disabled control's reason is only reliably announced with the
  // aria-disabled (not disabled) + focusable pattern. Kept as plain
  // `disabled` here (matches every other disabled control in this codebase);
  // flagged for Review Gate 3's keyboard/screen-reader pass to confirm
  // whether this is sufficient.
  if (playerCount < 2) {
    const why = document.createElement('p');
    why.id = 'start-reason';
    why.className = 'muted';
    why.textContent = 'Select at least 2 players to start.';
    screen.append(why);
    startButton.setAttribute('aria-describedby', 'start-reason');
  }
  screen.append(startButton);
```

Add the import at the top of the file:

```js
import { createStepper } from '../components/stepper.js';
```

**Step 2: Verify by hand**

Run `npm run dev`. Confirm:
- Selecting 4 players shows "up to 12 cards each"; selecting 5 shows 10.
- The stepper's max follows the player count, and reducing players clamps the value.
- "Start session" is disabled below 2 players, with a visible reason.
- Tab order flows: players → add → rule → hand size → start.
- At 200% browser zoom nothing is cut off or horizontally scrolling.

**Step 3: Commit**

```bash
git add src/screens/setup.js src/styles/setup.css
git commit -m "feat: complete setup screen with rules and hand size"
```

---

## 🚦 Review Gate 3 — after Task 14 (end of Phase 3)

**Run the suite:** `npm run test` → PASS, 46 tests.

**Accessibility check (first of three). In Chrome DevTools:**
1. Run **Lighthouse → Accessibility** on the setup screen. Expected: 100, no violations.
2. **Keyboard only, no mouse:** Tab through the whole screen — add a player, select four, toggle the rule, change hand size, reach Start. Every control must be reachable, operable, and show a visible focus ring.
3. **Zoom to 200%** and narrow to 320px width — no horizontal scroll, nothing clipped (*1.4.10*).
4. Confirm every interactive control is ≥ 44×44 px (*2.5.8*).

**Personas:**
- **Rotating Non-Expert User** — Could someone who has never seen this screen set up tonight's game without being told how? Is it obvious why Start is disabled? Is "Someone must go down" explained rather than assumed?
- **Skeptical Platform Engineer** — Does it work in both Chrome and Firefox? Does the layout survive rotating the tablet (*1.3.4*)?
- **Rules Lawyer** — Does the hand-size max reflect the trump-card reserve at every player count (4→12, 5→10, 6→8)?
- **YAGNI Editor** — Any control here that the spec doesn't call for?

**Gate criteria — do not start Phase 4 until:**
1. Lighthouse accessibility is 100 with zero violations.
2. The screen is fully operable by keyboard alone.
3. Hand-size max is correct for 2–8 players.
4. Usable at 200% zoom and 320px width.

---

## Phase 4: Live scorer

The screen that gets used for two hours straight by a rotating, non-technical scorer. Errors here are the ones that actually hurt: a wrong score nobody notices until the end.

### Task 15: Session state machine [SEQ]

Pure logic for "where are we in the session" — extracted so it is testable without the DOM, and so the lock-in/edit flow can't drift into UI code.

**Files:**
- Create: `src/logic/sessionFlow.js`
- Test: `tests/logic/sessionFlow.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { lockInRound, editRound, currentHand, isComplete } from '../../src/logic/sessionFlow.js';

const base = {
  players: ['p_alex', 'p_sam'],
  handSequence: [2, 1, 2],
  rounds: [],
  rules: { dealerRestriction: false },
};

const entries2 = { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } };

describe('currentHand', () => {
  it('returns the first hand size for a new session', () => {
    expect(currentHand(base)).toBe(2);
  });

  it('advances with each locked-in round', () => {
    const session = { ...base, rounds: [{ hand: 2, results: entries2 }] };
    expect(currentHand(session)).toBe(1);
  });

  it('returns null once every round is played', () => {
    const rounds = [
      { hand: 2, results: entries2 },
      { hand: 1, results: {} },
      { hand: 2, results: entries2 },
    ];
    expect(currentHand({ ...base, rounds })).toBeNull();
  });
});

describe('lockInRound', () => {
  it('appends a validated round', () => {
    const result = lockInRound(base, entries2);
    expect(result.errors).toEqual([]);
    expect(result.session.rounds).toHaveLength(1);
  });

  it('stores computed points with the round', () => {
    const result = lockInRound(base, entries2);
    expect(result.session.rounds[0].results.p_alex).toEqual({ bid: 1, won: 1, points: 11 });
  });

  it('rejects an invalid round without changing the session', () => {
    const bad = { p_alex: { bid: 1, won: 2 }, p_sam: { bid: 1, won: 1 } };
    const result = lockInRound(base, bad);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.session.rounds).toHaveLength(0);
  });

  it('applies the dealer restriction when the session enables it', () => {
    const session = { ...base, rules: { dealerRestriction: true } };
    const bids = { p_alex: { bid: 1, won: 1 }, p_sam: { bid: 1, won: 1 } };
    expect(lockInRound(session, bids).errors.length).toBeGreaterThan(0);
  });

  it('rejects locking in a round once the session is already finished', () => {
    const rounds = [
      { hand: 2, results: entries2 },
      { hand: 1, results: {} },
      { hand: 2, results: entries2 },
    ];
    const finished = { ...base, rounds };
    const result = lockInRound(finished, entries2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.session).toBe(finished);
  });
});

describe('editRound', () => {
  it('replaces an existing round and recomputes its points', () => {
    const session = lockInRound(base, entries2).session;
    const corrected = { p_alex: { bid: 2, won: 2 }, p_sam: { bid: 0, won: 0 } };
    const result = editRound(session, 0, corrected);
    expect(result.errors).toEqual([]);
    expect(result.session.rounds[0].results.p_alex.points).toBe(12);
  });

  it('validates the edit against that round\'s hand size', () => {
    const session = lockInRound(base, entries2).session;
    const invalid = { p_alex: { bid: 1, won: 2 }, p_sam: { bid: 1, won: 1 } };
    expect(editRound(session, 0, invalid).errors.length).toBeGreaterThan(0);
  });
});

describe('isComplete', () => {
  it('is false mid-session', () => {
    expect(isComplete(base)).toBe(false);
  });

  it('is true when all rounds are played', () => {
    const rounds = [{ hand: 2 }, { hand: 1 }, { hand: 2 }];
    expect(isComplete({ ...base, rounds })).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/sessionFlow.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
import { validateRound } from './validation.js';
import { roundPoints } from './scoring.js';

/** Hand size for the round about to be played, or null if the session is done. */
export function currentHand(session) {
  return session.handSequence[session.rounds.length] ?? null;
}

export function isComplete(session) {
  return session.rounds.length >= session.handSequence.length;
}

/** Attach computed points to each player's entry. */
function withPoints(entries, players) {
  const results = {};
  for (const playerId of players) {
    const { bid, won } = entries[playerId];
    results[playerId] = { bid, won, points: roundPoints(bid, won) };
  }
  return results;
}

/**
 * Validate and append a round.
 * Returns `{ session, errors }` — on failure the session is returned unchanged,
 * so callers can render errors without special-casing.
 */
export function lockInRound(session, entries) {
  const hand = currentHand(session);
  if (hand === null) {
    return { session, errors: [{ message: 'This session is already finished' }] };
  }

  const errors = validateRound({
    hand,
    players: session.players,
    entries,
    dealerRestriction: session.rules.dealerRestriction,
  });
  if (errors.length > 0) return { session, errors };

  const round = { hand, results: withPoints(entries, session.players) };
  return { session: { ...session, rounds: [...session.rounds, round] }, errors: [] };
}

/**
 * Replace an already-locked round. Totals are always derived from `rounds`,
 * so correcting a mistake needs no separate recompute step.
 *
 * Validates against `existing.hand` — this round's own stored hand size —
 * not `currentHand(session)`. Later rounds may already exist, in which case
 * currentHand points at a *different*, not-yet-played round; using it here
 * would validate an edit against the wrong hand size.
 */
export function editRound(session, roundIndex, entries) {
  const existing = session.rounds[roundIndex];
  if (!existing) return { session, errors: [{ message: 'That round does not exist' }] };

  const errors = validateRound({
    hand: existing.hand,
    players: session.players,
    entries,
    dealerRestriction: session.rules.dealerRestriction,
  });
  if (errors.length > 0) return { session, errors };

  const rounds = [...session.rounds];
  rounds[roundIndex] = { hand: existing.hand, results: withPoints(entries, session.players) };
  return { session: { ...session, rounds }, errors: [] };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/sessionFlow.test.js`
Expected: PASS, 12 tests.

**Step 5: Commit**

```bash
git add tests/logic/sessionFlow.test.js src/logic/sessionFlow.js
git commit -m "feat: add session flow with lock-in and round editing"
```

---

### Task 16: Running totals display [PAR: scorer]

Big numbers, readable across a table, announced when they change.

**Files:**
- Create: `src/components/totalsBar.js`, `src/styles/totalsBar.css`

**Step 1: Implement**

```js
import { computeTotals, rankPlayers } from '../logic/totals.js';

/**
 * Running totals for every player.
 * A table (not divs) so a screen reader can pair each name with its score.
 */
export function createTotalsBar({ session, playersById }) {
  const wrapper = document.createElement('section');
  wrapper.className = 'totals';
  wrapper.setAttribute('aria-labelledby', 'totals-heading');

  const heading = document.createElement('h2');
  heading.id = 'totals-heading';
  heading.textContent = 'Scores';
  heading.className = 'visually-hidden';

  const totals = computeTotals(session.players, session.rounds);
  const ranked = rankPlayers(totals);

  const table = document.createElement('table');
  table.className = 'totals__table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Player', 'Score']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const { playerId, score } of ranked) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = playersById[playerId]?.name ?? playerId;

    const scoreCell = document.createElement('td');
    scoreCell.className = 'totals__score';
    scoreCell.textContent = String(score);

    row.append(nameCell, scoreCell);
    tbody.append(row);
  }

  table.append(thead, tbody);
  wrapper.append(heading, table);
  return wrapper;
}
```

**Step 2: Write `src/styles/totalsBar.css`**

```css
.totals__table { width: 100%; border-collapse: collapse; }

.totals__table th,
.totals__table td {
  text-align: left;
  padding: var(--space);
  border-bottom: 1px solid var(--border);
  font-size: var(--font-large);
}

.totals__score {
  font-size: var(--font-total);
  font-variant-numeric: tabular-nums;   /* digits don't jitter as scores change */
  font-weight: 700;
  text-align: right;
}
```

**Step 3: Verify by hand** — mount with a stub session, confirm scores are legible at arm's length and the table announces "Alex, 87" in DevTools' accessibility tree.

**Step 4: Commit**

```bash
git add src/components/totalsBar.js src/styles/totalsBar.css
git commit -m "feat: add running totals display"
```

---

### Task 17: Round entry form [PAR: scorer]

**Files:**
- Create: `src/components/roundEntry.js`, `src/styles/roundEntry.css`

**Step 1: Implement**

Each player gets a bid and a won stepper. Errors are bound to the specific input via `aria-describedby` (*3.3.1*), and marked with `aria-invalid` (*4.1.2*).

```js
import { createStepper } from './stepper.js';

/**
 * Bid + tricks-won entry for one round.
 *
 * @param {object} options
 * @param {number} options.hand      - hand size (also the max for each field)
 * @param {string[]} options.players - player ids, dealer last
 * @param {object} options.playersById
 * @param {object} options.entries   - { [playerId]: { bid, won } }
 * @param {Array} options.errors     - from validateRound
 * @param {(playerId: string, field: string, value: number|null) => void} options.onChange
 */
export function createRoundEntry({ hand, players, playersById, entries, errors, onChange }) {
  const form = document.createElement('div');
  form.className = 'round-entry';

  const errorFor = (playerId, field) =>
    errors.find((e) => e.playerId === playerId && e.field === field);

  players.forEach((playerId, index) => {
    const isDealer = index === players.length - 1;
    const row = document.createElement('div');
    row.className = 'round-entry__row';

    const name = document.createElement('h3');
    name.className = 'round-entry__name';
    name.textContent = playersById[playerId]?.name ?? playerId;
    if (isDealer) {
      // Text, not just styling — the dealer matters for the bidding rule (1.4.1).
      const dealerTag = document.createElement('span');
      dealerTag.className = 'round-entry__dealer';
      dealerTag.textContent = ' (dealer)';
      name.append(dealerTag);
    }
    row.append(name);

    for (const field of ['bid', 'won']) {
      const error = errorFor(playerId, field);
      const errorId = `error-${playerId}-${field}`;

      row.append(
        createStepper({
          id: `${field}-${playerId}`,
          label: field === 'bid' ? 'Bid' : 'Tricks won',
          value: entries[playerId]?.[field] ?? null,
          min: 0,
          max: hand,
          invalid: Boolean(error),
          describedBy: error ? errorId : undefined,
          onChange: (value) => onChange(playerId, field, value),
        }),
      );

      if (error) {
        const message = document.createElement('p');
        message.id = errorId;
        message.className = 'error';
        message.textContent = error.message;
        row.append(message);
      }
    }

    form.append(row);
  });

  return form;
}
```

**Step 2: Write `src/styles/roundEntry.css`**

```css
.round-entry__row {
  display: flex;
  flex-wrap: wrap;         /* stacks on narrow widths — 1.4.10 Reflow */
  align-items: flex-end;
  gap: var(--space);
  padding: var(--space);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space);
  background: var(--surface);
}

.round-entry__name {
  flex: 1 1 8rem;
  margin: 0;
  font-size: var(--font-large);
}

.round-entry__dealer { font-size: var(--font-base); color: var(--text-muted); }
```

**Step 3: Verify by hand** — confirm errors read out with their input, and rows stack rather than overflow at 320px.

**Step 4: Commit**

```bash
git add src/components/roundEntry.js src/styles/roundEntry.css
git commit -m "feat: add round entry form with bound error messages"
```

---

### Task 18: Round history log [PAR: scorer]

**Files:**
- Create: `src/components/roundHistory.js`, `src/styles/roundHistory.css`

**Step 1: Implement**

Most recent first. Only the most recent round is editable (per the spec's v1 scope), and the button says so explicitly.

```js
/**
 * Compact log of locked-in rounds, most recent first.
 * Only the latest round can be edited in v1.
 */
export function createRoundHistory({ session, playersById, onEditLatest }) {
  const wrapper = document.createElement('section');
  wrapper.setAttribute('aria-labelledby', 'history-heading');

  const heading = document.createElement('h2');
  heading.id = 'history-heading';
  heading.textContent = 'Rounds played';
  wrapper.append(heading);

  if (session.rounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No rounds played yet.';
    wrapper.append(empty);
    return wrapper;
  }

  const latestIndex = session.rounds.length - 1;

  const list = document.createElement('ol');
  list.className = 'history';
  // Every <li> below sets its own `.value`, which determines its displayed
  // ordinal outright — per the HTML list-numbering algorithm, `reversed`
  // only affects auto-increment direction for items *without* an explicit
  // value, so it has no effect on the numbers actually shown here. Kept
  // anyway as an accurate semantic marker (this list's natural order really
  // is descending) for any tooling that reads the IDL property directly.
  list.reversed = true;

  session.rounds.forEach((round, index) => {
    const item = document.createElement('li');
    item.className = 'history__item';
    item.value = index + 1;

    const summary = session.players
      .map((playerId) => {
        const { bid, won, points } = round.results[playerId];
        const name = playersById[playerId]?.name ?? playerId;
        // "made"/"missed" in words — never colour alone (1.4.1).
        const outcome = bid === won ? 'made' : 'missed';
        return `${name} bid ${bid}, won ${won} — ${outcome} (${points})`;
      })
      .join('; ');

    const text = document.createElement('span');
    text.textContent = `Hand of ${round.hand}: ${summary}`;
    item.append(text);

    if (index === latestIndex) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'history__edit';
      // Accessible name says WHICH round — "Edit" alone is ambiguous (2.4.6).
      editButton.setAttribute('aria-label', `Edit last round, hand of ${round.hand}`);
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', onEditLatest);
      item.append(editButton);
    }

    list.prepend(item);   // newest at the top
  });

  wrapper.append(list);
  return wrapper;
}
```

**Step 2: Write `src/styles/roundHistory.css`**

```css
.history { margin: 0; padding-left: 1.5rem; }

.history__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  padding: calc(var(--space) / 2) 0;
  border-bottom: 1px solid var(--border);
}
```

**Step 3: Verify by hand** — confirm newest-first order and that only the latest round shows Edit.

**Step 4: Commit**

```bash
git add src/components/roundHistory.js src/styles/roundHistory.css
git commit -m "feat: add round history log with edit on latest round"
```

---

### Task 19: Assemble the live scorer screen [SEQ]

Depends on Tasks 15–18.

**Files:**
- Create: `src/screens/scorer.js`, `src/styles/scorer.css`

**Step 1: Implement**

```js
import { createTotalsBar } from '../components/totalsBar.js';
import { createRoundEntry } from '../components/roundEntry.js';
import { createRoundHistory } from '../components/roundHistory.js';
import { currentHand, isComplete } from '../logic/sessionFlow.js';

export function renderScorer({ state, actions }) {
  const { session, playersById, entries, errors, editingIndex, statusMessage } = state;
  const screen = document.createElement('section');
  screen.className = 'screen scorer';

  const editing = editingIndex !== null;
  const hand = editing ? session.rounds[editingIndex].hand : currentHand(session);
  const roundNumber = editing ? editingIndex + 1 : session.rounds.length + 1;

  const heading = document.createElement('h1');
  heading.textContent = editing
    ? `Editing round ${roundNumber} — hand of ${hand}`
    : `Round ${roundNumber} — dealing ${hand} cards each`;
  screen.append(heading);

  // 4.1.3 Status Messages — announce totals updates without stealing focus.
  const status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = statusMessage ?? '';
  screen.append(status);

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
        onChange: actions.updateEntry,
      }),
    );

    const lockIn = document.createElement('button');
    lockIn.type = 'button';
    lockIn.className = 'primary scorer__lockin';
    lockIn.textContent = editing ? 'Save changes' : 'Lock in round';
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
    const done = document.createElement('p');
    done.textContent = 'All rounds played.';
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
  endButton.addEventListener('click', () => {
    // Ending early commits the session as complete — it can no longer be
    // resumed as in-progress. A fat-fingered tap here would silently cut a
    // real game short with no undo, so confirm before committing. No prompt
    // needed once every round is already played — nothing is lost then.
    if (sessionComplete || window.confirm('End this session now? The game will be marked finished.')) {
      actions.endSession();
    }
  });
  screen.append(endButton);

  return screen;
}
```

**Step 2: Write `src/styles/scorer.css`**

```css
.scorer__alert {
  padding: var(--space);
  border: 3px solid var(--danger);
  border-radius: var(--radius);
  margin-bottom: var(--space);
}

.scorer__lockin { width: 100%; font-size: var(--font-large); margin-bottom: var(--space); }
.scorer__end { margin-top: calc(var(--space) * 3); }
```

**Step 3: Verify by hand** — score three rounds end to end with the keyboard only.

**Step 4: Commit**

```bash
git add src/screens/scorer.js src/styles/scorer.css
git commit -m "feat: assemble live scorer screen"
```

---

### Task 20: Wire actions, autosave, and resume [SEQ]

Connects the scorer to storage. Autosave fires after every lock-in, per the spec.

**Files:**
- Create: `src/app/actions.js`
- Modify: `src/main.js`

**Step 1: Implement the actions**

```js
import { lockInRound, editRound } from '../logic/sessionFlow.js';
import { saveSession } from '../storage/sessions.js';
import { createPlayer, savePlayer } from '../storage/players.js';

export function createActions(store) {
  const get = () => store.getState();

  /** Autosave after every change that alters the record. */
  async function persist(session) {
    try {
      await saveSession(session);
      return true;
    } catch (error) {
      console.error('Autosave failed', error);
      store.setState({
        statusMessage: 'Could not save — your scores are still on screen. Try again.',
      });
      return false;
    }
  }

  return {
    updateEntry(playerId, field, value) {
      const { entries } = get();
      store.setState({
        entries: { ...entries, [playerId]: { ...entries[playerId], [field]: value } },
      });
    },

    async lockInRound() {
      const { session, entries } = get();
      const { session: next, errors } = lockInRound(session, entries);
      if (errors.length > 0) return store.setState({ errors });

      store.setState({ session: next, entries: {}, errors: [], statusMessage: 'Round saved.' });
      await persist(next);
    },

    editLatestRound() {
      const { session } = get();
      const index = session.rounds.length - 1;
      if (index < 0) return;
      // Pre-fill the form with what was entered, so a fix is a tweak not a retype.
      const existing = session.rounds[index].results;
      const entries = Object.fromEntries(
        Object.entries(existing).map(([id, { bid, won }]) => [id, { bid, won }]),
      );
      store.setState({ editingIndex: index, entries, errors: [] });
    },

    async saveEdit() {
      const { session, entries, editingIndex } = get();
      const { session: next, errors } = editRound(session, editingIndex, entries);
      if (errors.length > 0) return store.setState({ errors });

      store.setState({
        session: next,
        entries: {},
        errors: [],
        editingIndex: null,
        statusMessage: 'Round updated.',
      });
      await persist(next);
    },

    cancelEdit() {
      store.setState({ editingIndex: null, entries: {}, errors: [] });
    },

    async endSession() {
      const { session } = get();
      const finished = { ...session, status: 'complete' };
      store.setState({ session: finished, screen: 'summary' });
      await persist(finished);
    },

    async addPlayer(name) {
      const player = createPlayer(name);
      await savePlayer(player);
      const { allPlayers } = get();
      store.setState({
        allPlayers: [...allPlayers, player].sort((a, b) => a.name.localeCompare(b.name)),
      });
    },
  };
}
```

**Step 2: Handle resume in `src/main.js`**

On boot, offer to resume an interrupted session rather than silently discarding it.

```js
import { loadInProgressSession } from './storage/sessions.js';

const inProgress = await loadInProgressSession();
if (inProgress) {
  const resume = window.confirm(
    `Resume the session from ${new Date(inProgress.date).toLocaleString()}?`,
  );
  if (resume) {
    store.setState({ session: inProgress, screen: 'scorer' });
  }
}
```

**Step 3: Verify by hand**

- Score two rounds, hard-refresh the browser, confirm the resume prompt restores them.
- Edit the last round, confirm totals recompute and the change survives a refresh.

**Step 4: Commit**

```bash
git add src/app/actions.js src/main.js
git commit -m "feat: wire scorer actions with autosave and resume"
```

---

## 🚦 Review Gate 4 — after Task 20 (end of Phase 4)

**Run the suite:** `npm run test` → PASS, 58 tests.

**Play a full session by hand** — 4 players, start size 3 (9 rounds, quick), entering real numbers.

**Accessibility check (second of three):**
1. **Lighthouse → Accessibility** on the scorer mid-round: 100, no violations.
2. **Trigger each error deliberately** — leave a field blank, enter a value above the hand size, make tricks not sum. Confirm each message is announced, tied to the right input, and says how to fix it (*3.3.1, 3.3.3*).
3. **Keyboard only:** enter and lock in a full round without touching the mouse.
4. Confirm totals updates are announced politely and don't steal focus (*4.1.3*).

**Personas:**
- **Rotating Non-Expert User** — Is it obvious how many cards to deal? Can a mistake in the round just locked in be fixed without panic? Does anything put the scorer in a dead end?
- **Rules Lawyer** — Points correct for made/missed and a made zero bid? Dealer restriction only when enabled, and only on the dealer? Does editing a round recompute totals from scratch?
- **Skeptical Platform Engineer** — Does autosave survive a hard refresh? What happens if a write fails mid-session — is it surfaced, not swallowed?
- **YAGNI Editor** — Anything on this screen that isn't earning its place?

**Gate criteria — do not start Phase 5 until:**
1. A full session can be played, ended, and resumed after a refresh.
2. All three error types are announced and correctly associated.
3. Lighthouse accessibility is 100.
4. Editing the last round recomputes totals correctly.

---

## Phase 5: Session summary, stats, and PWA install

### Task 21: Stats aggregation [SEQ]

Pure logic, TDD'd. The three stats the spec asks for.

**Files:**
- Create: `src/logic/stats.js`
- Test: `tests/logic/stats.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { lastSession, sameGroupCumulative, bidAccuracy } from '../../src/logic/stats.js';

const made = (bid) => ({ bid, won: bid, points: 10 + bid });
const missed = (bid, won) => ({ bid, won, points: 0 });

const sessions = [
  {
    sessionId: '2026-08-18-1930',
    date: '2026-08-18T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam'],
    rounds: [
      { hand: 2, results: { p_alex: made(1), p_sam: missed(1, 1) } },
      { hand: 1, results: { p_alex: missed(1, 0), p_sam: made(1) } },
    ],
  },
  {
    sessionId: '2026-08-25-1930',
    date: '2026-08-25T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam'],
    rounds: [{ hand: 2, results: { p_alex: made(2), p_sam: missed(0, 2) } }],
  },
  {
    sessionId: '2026-08-20-1930',
    date: '2026-08-20T19:30:00Z',
    status: 'complete',
    players: ['p_alex', 'p_sam', 'p_jo'],
    rounds: [{ hand: 1, results: { p_alex: made(0), p_sam: made(1), p_jo: missed(1, 0) } }],
  },
];

describe('lastSession', () => {
  it('returns the most recent completed session', () => {
    expect(lastSession(sessions).sessionId).toBe('2026-08-25-1930');
  });

  it('ignores in-progress sessions', () => {
    const withOpen = [...sessions, { sessionId: '2026-09-01-1930', status: 'in-progress' }];
    expect(lastSession(withOpen).sessionId).toBe('2026-08-25-1930');
  });

  it('returns null when there is no history', () => {
    expect(lastSession([])).toBeNull();
  });
});

describe('sameGroupCumulative', () => {
  it('sums only sessions with exactly the same player set', () => {
    // The 3-player session must not contribute to the 2-player group.
    const result = sameGroupCumulative(sessions, ['p_alex', 'p_sam']);
    expect(result.totals).toEqual({ p_alex: 23, p_sam: 11 });
  });

  it('matches player sets regardless of order', () => {
    const result = sameGroupCumulative(sessions, ['p_sam', 'p_alex']);
    expect(result.sessionCount).toBe(2);
  });

  it('reports the winner of the most recent session with that group', () => {
    const result = sameGroupCumulative(sessions, ['p_alex', 'p_sam']);
    expect(result.lastWinnerIds).toEqual(['p_alex']);
  });

  it('returns empty when the group has never played', () => {
    expect(sameGroupCumulative(sessions, ['p_zoe']).sessionCount).toBe(0);
  });
});

describe('bidAccuracy', () => {
  it('computes overall accuracy per player', () => {
    // Alex: made 1 of 2 in session one, made 1 of 1 in session two = 2/3.
    const result = bidAccuracy(sessions, ['p_alex', 'p_sam']);
    expect(result.p_alex.played).toBe(3);
    expect(result.p_alex.made).toBe(2);
  });

  it('breaks accuracy down by hand size', () => {
    const result = bidAccuracy(sessions, ['p_alex', 'p_sam']);
    expect(result.p_alex.byHand[2]).toEqual({ played: 2, made: 2 });
    expect(result.p_alex.byHand[1]).toEqual({ played: 1, made: 0 });
  });

  it('ignores sessions the player did not play in', () => {
    const result = bidAccuracy(sessions, ['p_jo']);
    expect(result.p_jo.played).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logic/stats.test.js`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```js
import { computeTotals, rankPlayers } from './totals.js';

const completed = (sessions) => sessions.filter((s) => s.status === 'complete');
const groupKey = (playerIds) => [...playerIds].sort().join('|');

/** Most recent completed session, or null. */
export function lastSession(sessions) {
  const done = completed(sessions);
  if (done.length === 0) return null;
  return done.reduce((latest, s) => (s.sessionId > latest.sessionId ? s : latest));
}

/**
 * Cumulative scores across every session played by exactly this set of players.
 * Matching is by player id and ignores order — a different set is a different group.
 */
export function sameGroupCumulative(sessions, playerIds) {
  const key = groupKey(playerIds);
  const matching = completed(sessions).filter((s) => groupKey(s.players) === key);

  const totals = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const session of matching) {
    const sessionTotals = computeTotals(session.players, session.rounds);
    for (const [id, score] of Object.entries(sessionTotals)) totals[id] += score;
  }

  const mostRecent = lastSession(matching);
  let lastWinnerIds = [];
  if (mostRecent) {
    const ranked = rankPlayers(computeTotals(mostRecent.players, mostRecent.rounds));
    lastWinnerIds = ranked.filter((r) => r.rank === 1).map((r) => r.playerId);
  }

  return { totals, ranked: rankPlayers(totals), sessionCount: matching.length, lastWinnerIds };
}

/**
 * Contract success rate per player, overall and per hand size.
 * Bidding a 7-card hand is a different skill from bidding a 1-card hand,
 * so the breakdown matters more than the headline number.
 */
export function bidAccuracy(sessions, playerIds) {
  const stats = Object.fromEntries(
    playerIds.map((id) => [id, { played: 0, made: 0, byHand: {} }]),
  );

  for (const session of completed(sessions)) {
    for (const round of session.rounds) {
      for (const playerId of playerIds) {
        const result = round.results[playerId];
        if (!result) continue;

        const entry = stats[playerId];
        const hand = (entry.byHand[round.hand] ??= { played: 0, made: 0 });

        entry.played += 1;
        hand.played += 1;
        if (result.bid === result.won) {
          entry.made += 1;
          hand.made += 1;
        }
      }
    }
  }

  return stats;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logic/stats.test.js`
Expected: PASS, 10 tests.

**Step 5: Commit**

```bash
git add tests/logic/stats.test.js src/logic/stats.js
git commit -m "feat: add stats aggregation"
```

---

### Task 22: Session summary screen [SEQ]

> Tagged `[SEQ]`, not parallel: step 2 modifies `src/app/actions.js`, which other tasks also touch. Two agents editing one file concurrently is exactly the conflict the `[PAR]` tag is supposed to rule out.

**Files:**
- Create: `src/screens/summary.js`
- Modify: `src/app/actions.js` (append the `exportSession` and `goTo` actions)

**Step 1: Implement**

```js
import { computeTotals, rankPlayers } from '../logic/totals.js';

export function renderSummary({ state, actions }) {
  const { session, playersById } = state;
  const screen = document.createElement('section');
  screen.className = 'screen summary';

  const heading = document.createElement('h1');
  heading.textContent = 'Final scores';
  screen.append(heading);

  const ranked = rankPlayers(computeTotals(session.players, session.rounds));
  const winners = ranked.filter((r) => r.rank === 1);

  const winnerLine = document.createElement('p');
  winnerLine.className = 'summary__winner';
  const names = winners.map((w) => playersById[w.playerId]?.name ?? w.playerId);
  winnerLine.textContent =
    winners.length === 1
      ? `${names[0]} wins with ${winners[0].score} points.`
      : `Tied on ${winners[0].score} points: ${names.join(' and ')}.`;
  screen.append(winnerLine);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Position', 'Player', 'Score']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const { playerId, score, rank } of ranked) {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = String(rank);

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = playersById[playerId]?.name ?? playerId;

    const scoreCell = document.createElement('td');
    scoreCell.className = 'totals__score';
    scoreCell.textContent = String(score);

    row.append(rankCell, nameCell, scoreCell);
    tbody.append(row);
  }
  table.append(thead, tbody);
  screen.append(table);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export this session';
  exportButton.addEventListener('click', () => actions.exportSession(session));

  const historyButton = document.createElement('button');
  historyButton.type = 'button';
  historyButton.textContent = 'View history and stats';
  historyButton.addEventListener('click', () => actions.goTo('history'));

  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'primary';
  newButton.textContent = 'New session';
  newButton.addEventListener('click', () => actions.goTo('setup'));

  screen.append(exportButton, historyButton, newButton);
  return screen;
}
```

**Step 2: Add the export action** to `src/app/actions.js`:

```js
    /** Optional backup copy — a plain download, not the primary persistence. */
    exportSession(session) {
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `whist-${session.sessionId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },

    goTo(screen) {
      store.setState({ screen });
    },
```

**Step 3: Verify by hand** — end a session, confirm rankings, ties, and that export downloads valid JSON.

**Step 4: Commit**

```bash
git add src/screens/summary.js src/app/actions.js
git commit -m "feat: add session summary screen with export"
```

---

### Task 23: History and stats screen [SEQ]

Depends on Task 21.

**Files:**
- Create: `src/screens/history.js`

**Step 1: Implement**

```js
import { lastSession, sameGroupCumulative, bidAccuracy } from '../logic/stats.js';
import { rankPlayers, computeTotals } from '../logic/totals.js';

const percent = (made, played) => (played === 0 ? '—' : `${Math.round((made / played) * 100)}%`);

export function renderHistory({ state, actions }) {
  const { allSessions, playersById, selectedPlayerIds } = state;
  const screen = document.createElement('section');
  screen.className = 'screen history-screen';

  const heading = document.createElement('h1');
  heading.textContent = 'History and stats';
  screen.append(heading);

  const nameOf = (id) => playersById[id]?.name ?? id;

  // Spec: never hard-fail on empty or unreadable history.
  if (allSessions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No past sessions found yet.';
    screen.append(empty, backButton(actions));
    return screen;
  }

  // --- Last session -----------------------------------------------------
  const latest = lastSession(allSessions);
  if (latest) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Last session';
    const when = document.createElement('p');
    when.textContent = new Date(latest.date).toLocaleDateString();

    const ranked = rankPlayers(computeTotals(latest.players, latest.rounds));
    const list = document.createElement('ol');
    for (const { playerId, score } of ranked) {
      const item = document.createElement('li');
      item.textContent = `${nameOf(playerId)} — ${score}`;
      list.append(item);
    }
    section.append(h2, when, list);
    screen.append(section);
  }

  // --- Same-group cumulative -------------------------------------------
  if (selectedPlayerIds.length >= 2) {
    const group = sameGroupCumulative(allSessions, selectedPlayerIds);
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'This group, all time';

    const summary = document.createElement('p');
    summary.textContent =
      group.sessionCount === 0
        ? 'This exact group has not played together yet.'
        : `${group.sessionCount} sessions together. ` +
          `Last won by ${group.lastWinnerIds.map(nameOf).join(' and ')}.`;

    section.append(h2, summary);

    if (group.sessionCount > 0) {
      const list = document.createElement('ol');
      for (const { playerId, score } of group.ranked) {
        const item = document.createElement('li');
        item.textContent = `${nameOf(playerId)} — ${score}`;
        list.append(item);
      }
      section.append(list);
    }
    screen.append(section);
  }

  // --- Bid accuracy -----------------------------------------------------
  const knownPlayerIds = Object.keys(playersById);
  const accuracy = bidAccuracy(allSessions, knownPlayerIds);
  const handSizes = [
    ...new Set(
      Object.values(accuracy).flatMap((entry) => Object.keys(entry.byHand).map(Number)),
    ),
  ].sort((a, b) => a - b);

  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Bid accuracy';
  const caption = document.createElement('p');
  caption.className = 'muted';
  caption.textContent = 'How often each player makes their contract, by hand size.';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of ['Player', 'Overall', ...handSizes.map((h) => `${h}-card`)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const playerId of knownPlayerIds) {
    const entry = accuracy[playerId];
    if (entry.played === 0) continue;

    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = nameOf(playerId);
    row.append(nameCell);

    const overall = document.createElement('td');
    overall.textContent = `${percent(entry.made, entry.played)} (${entry.made}/${entry.played})`;
    row.append(overall);

    for (const hand of handSizes) {
      const cell = document.createElement('td');
      const stat = entry.byHand[hand];
      cell.textContent = stat ? percent(stat.made, stat.played) : '—';
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(thead, tbody);
  section.append(h2, caption, table);
  screen.append(section, backButton(actions));

  return screen;
}

function backButton(actions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Back';
  button.addEventListener('click', () => actions.goTo('setup'));
  return button;
}
```

**Step 2: Verify by hand** — with at least two completed sessions, confirm stats are correct and the empty state appears with none.

**Step 3: Commit**

```bash
git add src/screens/history.js
git commit -m "feat: add history and stats screen"
```

---

### Task 24: PWA manifest, icons, and offline install [SEQ]

**Files:**
- Modify: `vite.config.js`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`

**Step 1: Create the icons**

Three PNGs in `public/`. A plain background in `--accent` (#1d4ed8) with a white card or "♠" glyph is fine. The maskable icon needs its content inside the centre 80% (safe zone) or Android will crop it.

**Step 2: Configure the PWA plugin in `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Contract Whist Scorer',
        short_name: 'Whist',
        description: 'Score contract whist sessions offline.',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        // Spec: tablet is the primary device, but allow rotation (1.3.4).
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell — it must open with no network at all.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
});
```

**Step 3: Add the theme colour to `index.html`**

```html
<meta name="theme-color" content="#1d4ed8" />
```

**Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds, `dist/` contains `manifest.webmanifest` and a generated `sw.js`.

Run: `npm run preview -- --host`
Then in Chrome DevTools → Application → Manifest: no errors, and "Installability" shows the app is installable.

**Step 5: Commit**

```bash
git add vite.config.js index.html public/
git commit -m "feat: add PWA manifest, icons, and offline precaching"
```

---

### Task 25: Install and test on the actual tablet [SEQ]

The spec's core assumption — an installable, fully offline PWA on a Samsung A9 — is not proven until this passes on the real device. Everything before this is theory.

**Files:** none (verification task).

**Step 1: Serve the build on the local network**

```bash
npm run build
npm run preview -- --host
```

Note the network URL (e.g. `http://192.168.1.x:4173`).

**Step 2: Install on the tablet**

Open that URL in Chrome on the Samsung A9 → menu → **Add to Home screen** → open from the home-screen icon. It must launch fullscreen with no browser chrome.

**Step 3: Test offline persistence — the critical check**

1. Score a full session in the installed app.
2. **Turn on aeroplane mode.**
3. Force-close the app and reopen it.
4. Confirm: it opens, history loads, and a new session can be scored — all with no network.
5. Confirm the previous session's data is still there.

**Step 4: Test on Firefox for Android too**

Repeat the install and offline check. Note any behavioural differences — Firefox's install flow differs from Chrome's.

**Step 5: Record the results**

Create `docs/device-test-2026-08-25.md` noting: Android version, Chrome/Firefox versions, whether install worked, whether offline worked, whether IndexedDB survived a force-close, and anything that behaved unexpectedly.

**Step 6: Commit**

```bash
git add docs/device-test-2026-08-25.md
git commit -m "docs: record tablet device test results"
```

---

## 🚦 Review Gate 5 — after Task 25 (final gate)

**Run the suite:** `npm run test` → PASS, 68 tests.

**Accessibility check (third of three — the full pass):**
1. **Lighthouse → Accessibility** on all four screens: 100, zero violations.
2. **Screen reader on the real tablet:** enable **TalkBack** and play a full round — enter bids, trigger an error, lock in. Confirm every control announces a meaningful name, errors are read out, and totals updates are announced without interrupting.
3. **Keyboard-only** pass over all four screens (attach a Bluetooth keyboard, or test in desktop Chrome).
4. **Contrast:** verify every token pairing with a contrast checker — AA (4.5:1 text, 3:1 UI) in both light and dark mode.
5. **Reflow:** 200% zoom and 320px width, portrait and landscape.
6. **Target size:** every control ≥ 44×44 px.

**Full persona review against the spec:**
- **Rules Lawyer** — Walk the spec's Data model and Screens sections line by line against the built app. Does the JSON match? Scoring, trump-card cap, dealer restriction, IDs-not-names?
- **Rotating Non-Expert User** — Hand the tablet to someone who has never seen it and ask them to score a round with no instructions. Watch where they hesitate. That hesitation is the finding.
- **Skeptical Platform Engineer** — Does it work fully offline after a force-close? Both browsers? Is anything left over from the File System Access API design?
- **YAGNI Editor** — Is anything built that the spec doesn't ask for? Anything in the spec that went unbuilt and unflagged?

**Definition of done:**
1. All tests pass.
2. Installs and runs fully offline on the Samsung A9, verified in aeroplane mode.
3. WCAG 2.2 AA verified across all four screens, including a TalkBack pass.
4. A full session can be set up, scored, corrected, ended, and reviewed in stats.
5. Every spec deviation is either resolved or written down as a deliberate, agreed choice.

---

## Task summary

| # | Task | Mode | Phase |
|---|------|------|-------|
| 1 | Initialise the project | `[SEQ]` | 1 |
| 2 | Scoring rule | `[PAR: logic-a]` | 1 |
| 3 | Hand sequence and cap | `[PAR: logic-a]` | 1 |
| 4 | Round validation | `[PAR: logic-a]` | 1 |
| 5 | Session totals | `[SEQ]` | 1 |
| — | **🚦 Review Gate 1** | — | — |
| 6 | IndexedDB schema | `[SEQ]` | 2 |
| 7 | Player storage | `[SEQ]` | 2 |
| 8 | Session storage and autosave | `[SEQ]` | 2 |
| 9 | Graceful storage failure | `[SEQ]` | 2 |
| — | **🚦 Review Gate 2** | — | — |
| 10 | Design tokens | `[PAR: shell]` | 3 |
| 11 | Store and router | `[PAR: shell]` | 3 |
| 12 | Number stepper | `[SEQ]` after 10 | 3 |
| 13 | Setup — players | `[SEQ]` | 3 |
| 14 | Setup — rules and hand size | `[SEQ]` | 3 |
| — | **🚦 Review Gate 3** | — | — |
| 15 | Session state machine | `[SEQ]` | 4 |
| 16 | Totals display | `[PAR: scorer]` | 4 |
| 17 | Round entry form | `[PAR: scorer]` | 4 |
| 18 | Round history log | `[PAR: scorer]` | 4 |
| 19 | Assemble scorer screen | `[SEQ]` | 4 |
| 20 | Wire actions and autosave | `[SEQ]` | 4 |
| — | **🚦 Review Gate 4** | — | — |
| 21 | Stats aggregation | `[SEQ]` | 5 |
| 22 | Summary screen | `[SEQ]` | 5 |
| 23 | History and stats screen | `[SEQ]` | 5 |
| 24 | PWA manifest and icons | `[SEQ]` | 5 |
| 25 | Tablet device test | `[SEQ]` | 5 |
| — | **🚦 Review Gate 5 (final)** | — | — |

**25 tasks, 5 review gates.** Three parallel groups can each be dispatched to concurrent subagents:

- `logic-a` — Tasks 2, 3, 4 (pure logic, no shared files)
- `shell` — Tasks 10, 11 (Task 12 follows Task 10)
- `scorer` — Tasks 16, 17, 18 (three independent components)

Everything else is sequential. Never parallelise across a review gate.

## Deferred to v2

Carried from the spec, plus decisions made while writing this plan:

- Editing a round earlier than the most recent one
- Multi-device sync (Supabase was considered and rejected — it reverses the offline-first, no-accounts principles)
- Date-range filtering on stats
- iOS support (no adapter abstraction was built; revisit the storage module's shape if it's ever needed)
- Deleting or merging player profiles

