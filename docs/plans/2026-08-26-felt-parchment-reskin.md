# Felt & Parchment Visual Reskin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current minimal light/dark theme with the single "felt, parchment, and brass" card-table palette from `whistfiles/*.html`, compact the running-totals display, and fix the app's layout to actually use the full width of the target device in both portrait and landscape — without touching any component's markup structure, JS logic, or the accessibility guarantees Review Gates 1–5 already verified.

**Architecture:** This is a CSS-and-markup-only reskin. Every component/screen already reads colours exclusively through the `--bg`/`--surface`/`--text`/`--accent`/`--danger`/`--success`/`--border`/`--focus-ring` custom properties defined once in `tokens.css` — so the palette swap is scoped almost entirely to that one file. Two things go beyond a pure token swap: (1) the totals display needs a new compact grid layout (the mockup's `.total-chip` cards), which is a real CSS/markup change to `totalsBar.js`, not just new colours; (2) `.screen`'s `max-width` and the app's font-loading need to change to suit an 800×1340 tablet used in either orientation, which the mockup (built at a fixed 480px mobile width) never actually addressed.

**Tech Stack:** Same as the existing app — vanilla JS, hand-rolled DOM construction, plain CSS custom properties, Google Fonts (`Fraunces` + `Inter`, both already used in the mockups and permitted by this project's CSP — see Task 1).

**Target device:** Samsung A9 tablet, 800×1340 native resolution, **must work correctly in both portrait and landscape** (confirmed with the user — the tablet gets picked up and turned either way at the table). Do not assume portrait like the mockups did.

**Source material:** `whistfiles/whist-mockup.html` (live scorer, both bidding and tricks-won states), `whistfiles/whist-setup.html`, `whistfiles/whist-final.html`, `whistfiles/whist-history.html`. These are static, unstyled-by-the-real-app HTML/CSS mockups — reference their colours, spacing, and shapes; do not copy their markup structure, since the real app's markup already carries accessibility semantics (`<fieldset>`/`<legend>`, `scope="row"/"col"`, `aria-*` wiring) the mockups don't have and don't need to.

---

## Before you start: what NOT to change

- **No component markup structure changes** beyond what's explicitly specified in a task below. `setup.js`, `scorer.js`, `roundEntry.js`, `roundHistory.js`, `summary.js`, `history.js` keep their current DOM shape, ARIA attributes, and JS logic. This is a reskin, not a rebuild — every accessibility property Gates 1–5 verified (heading order, live regions, `aria-describedby`, keyboard order, focus management) must survive untouched.
- **No dark/light mode branching.** The felt/parchment palette becomes the *only* theme (confirmed with the user). Delete the `@media (prefers-color-scheme: dark)` block in `tokens.css` entirely rather than trying to design a second variant nobody has mocked up.
- **Every existing test must still pass, unmodified.** This plan touches zero `.test.js` files. If a task's CSS/markup change breaks an existing test, that's a signal the task overstepped its scope — stop and re-read the "what not to change" list above rather than editing the test to match.

## Accessibility budget for this plan

Every colour pairing introduced here must be independently contrast-checked against the WCAG relative-luminance formula before it's used — **do not trust the mockup's colours as pre-verified**. A spot-check during planning already found the mockup's own colours would fail multiple AA requirements if mapped naively:
- Brass (`#C9A15A`) on parchment (`#F4EDD9`) = **2.06:1** — fails 1.4.11's 3:1 minimum for UI borders.
- The mockup's bright burgundy (`#A8434A`) on felt-dark (`#0A2B20`) = **2.59:1** — fails 4.5:1 for error text on the page background.
- Sage (`#8FA88E`) on parchment = **2.2:1** — fails badly as a "success" text colour on cards.

Task 1 below computes a corrected palette that keeps the *character* of the mockup (felt, parchment, brass, burgundy, sage) while fixing every pairing that's actually used as text-on-background or border-on-background in the real app. Do not skip straight to copying mockup hex values into `tokens.css`.

---

## Task 1: Compute and verify the felt/parchment palette

**Files:**
- Create: `tests/tokens.contrast.mjs` (a throwaway verification script, NOT a `.test.js` — do not add it to the Vitest suite; delete it at the end of this task after recording its output in the commit message)

**Step 1: Write the contrast-checking script**

```js
// tests/tokens.contrast.mjs — throwaway, not part of the test suite.
// Computes WCAG contrast for every token pairing this app actually uses,
// so palette values can be picked/adjusted BEFORE writing them into
// tokens.css, rather than guessing and finding out from Lighthouse later.

function lin(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Candidate palette — start from the mockup's colours, adjust below where
// a pairing fails, and re-run until every row passes its target.
const palette = {
  bg: '#0A2B20',           // felt-dark — page background
  surface: '#F4EDD9',      // parchment — card background
  text: '#1C2318',         // ink — text ON parchment cards
  textOnBg: '#F4EDD9',     // parchment text ON the felt page (headings, labels outside cards)
  textMuted: '#4A4A3E',    // ink-soft — muted text on parchment
  textMutedOnBg: '#8FA88E',// sage — muted text on felt page
  border: '#8A6C34',       // brass-dark (NOT bright brass — see contrast note)
  accent: '#8A6C34',       // brass-dark, used for solid buttons — text sits ON this
  accentText: '#F4EDD9',   // parchment text on the accent button
  danger: '#7A2E33',       // burgundy (NOT burgundy-bright) — used as text/border, both on parchment and felt
  success: '#2F5233',      // adjusted — mockup's sage fails on parchment; darkened for contrast, keep green hue
  focusRing: '#DDBB78',    // brass-bright — needs to read on BOTH felt and parchment
};

const checks = [
  ['text on surface (card body text)', palette.text, palette.surface, 4.5],
  ['textOnBg on bg (headings/labels on page)', palette.textOnBg, palette.bg, 4.5],
  ['textMuted on surface', palette.textMuted, palette.surface, 4.5],
  ['textMutedOnBg on bg', palette.textMutedOnBg, palette.bg, 4.5],
  ['border on surface (input/card borders)', palette.border, palette.surface, 3.0],
  ['border on bg', palette.border, palette.bg, 3.0],
  ['accent on surface (button bg vs card)', palette.accent, palette.surface, 3.0],
  ['accentText on accent (button label)', palette.accentText, palette.accent, 4.5],
  ['danger on surface (error text/border on card)', palette.danger, palette.surface, 4.5],
  ['danger on bg (error text on page)', palette.danger, palette.bg, 4.5],
  ['success on surface', palette.success, palette.surface, 4.5],
  ['focusRing on surface', palette.focusRing, palette.surface, 3.0],
  ['focusRing on bg', palette.focusRing, palette.bg, 3.0],
];

let allPass = true;
for (const [label, fg, bg, min] of checks) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) allPass = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2)}:1  (need ${min}:1)  ${label}`);
}
console.log(allPass ? '\nAll pairings pass.' : '\nSOME PAIRINGS FAIL — adjust palette above and re-run.');
```

**Step 2: Run it, adjust, iterate**

Run: `node tests/tokens.contrast.mjs`

Expected on the FIRST run: at least the `success on surface` row fails (sage is too light on parchment) and possibly `border`/`accent` depending on which brass shade is used first — this is expected, not a bug in the script. Adjust the hex values in the `palette` object (darken/lighten while keeping the same hue family — e.g. a darker green for success, brass-dark rather than brass-bright for borders) and re-run until every row prints `PASS`. Do not weaken a `min` threshold to make a row pass — fix the colour.

Record the final passing palette values — you'll transcribe them into `tokens.css` in Task 2.

**Step 3: Delete the script**

```bash
rm tests/tokens.contrast.mjs
```

**Step 4: Commit**

Commit nothing yet — this task produces no lasting file. Note the final verified palette values in Task 2's commit message instead (see below), so there's a permanent record of what was checked and why.

---

## Task 2: Rewrite tokens.css with the verified palette, remove dark mode

**Files:**
- Modify: `src/styles/tokens.css`

**Step 1: Replace the file contents**

Use the palette values verified in Task 1 (adjust the placeholders below to match whatever actually passed). Keep every token NAME exactly as-is — only values change — except: **add two new tokens** the felt/parchment split requires that the old light-theme design didn't need (`--text-on-bg` and `--text-muted-on-bg`, for text that sits directly on the page/felt rather than on a parchment card — e.g. screen headings, the totals-strip labels).

> **Correction — the claim originally here ("Task 4 is the only task that introduces such text") was wrong and caused a real incident.** It's actually Task 3 that repoints `body`'s own default `color` to `--text-on-bg`, which affects EVERY element in the app that doesn't have its own explicit `color`, not just new page-level headings. `--text-on-bg` also turned out to be byte-identical to `--surface` (`#F4EDD9`) in the final verified palette — so any `--surface`-background card with no explicit color (found: `.round-entry__row`, not fixed until Task 6) rendered fully invisible between Task 3 and its real fix landing. See Task 3's notes for the incident and the stopgap patch; `tokens.css` itself now carries a standing comment on this collision. When reading "Task N introduces/fixes X" anywhere in this plan, verify it against the actual current file rather than trusting the prose — several such claims drifted as tasks executed out of the order this document assumed.

```css
:root {
  /* Surfaces */
  --bg: #0A2B20;               /* felt-dark — the page itself */
  --surface: #F4EDD9;          /* parchment — card backgrounds */
  --border: #8A6C34;           /* brass-dark — verified ≥3:1 on both bg and surface, see Task 1 */

  /* Text ON --surface (cards) */
  --text: #1C2318;             /* ink */
  --text-muted: #4A4A3E;       /* ink-soft */

  /* Text directly ON --bg (the felt page) — headings, labels outside cards */
  --text-on-bg: #F4EDD9;       /* parchment */
  --text-muted-on-bg: #8FA88E; /* sage */

  /* Accent (actions) */
  --accent: #8A6C34;           /* brass-dark — verified ≥3:1 UI contrast on --surface */
  --accent-text: #F4EDD9;      /* parchment text on the accent button */

  /* Status — never used as the ONLY signal (1.4.1) */
  --danger: #7A2E33;           /* burgundy — verified ≥4.5:1 on both --surface and --bg */
  --success: #2F5233;          /* darkened from the mockup's sage — verified ≥4.5:1 on --surface */

  --focus-ring: #DDBB78;       /* brass-bright — verified ≥3:1 on both --surface and --bg */

  /* Sizing — unchanged, not part of the reskin */
  --target-min: 44px;
  --space: 8px;
  --radius: 8px;

  /* Type — font sizes unchanged; families set separately, see Task 3 */
  --font-base: 1.125rem;
  --font-large: 1.75rem;
  --font-total: 2.5rem;
}
```

Note: the exact hex values above are Task 1's starting point, not guaranteed-final — use whatever combination actually printed `PASS` for every row in Task 1's script output.

**Step 2: Delete the dark-mode block**

The `@media (prefers-color-scheme: dark) { ... }` block that followed `:root` in the old file is deleted entirely — confirmed with the user that felt/parchment is the only theme, not a dark-mode variant.

**Step 3: Verify nothing else references the removed dark-mode-only values**

```bash
grep -rn "prefers-color-scheme" src/
```

Expected: no matches (the block you just deleted was the only one).

**Step 4: Run the full test suite**

Run: `npm run test`
Expected: PASS, 68 tests — this task only changes CSS custom property values, no test reads a colour value, so this should be a pure no-op for the test suite. If anything fails, you've changed something beyond `tokens.css` — revert and re-check.

**Step 5: Build check**

Run: `npm run build`
Expected: succeeds, no errors.

**Step 6: Commit**

```bash
git add src/styles/tokens.css
git commit -m "$(cat <<'EOF'
feat: reskin to felt/parchment/brass palette

Replaces the light/dark theme with a single always-on palette matching
the felt-table mockups in whistfiles/. Every pairing independently
contrast-checked against the WCAG relative-luminance formula before
being written here (script run and discarded, not committed — see
docs/plans/2026-08-26-felt-parchment-reskin.md Task 1 for the method
and starting values). Several of the mockup's own colours failed AA
and were adjusted: brass-bright fails 3:1 as a border on parchment
(2.06:1) so --border uses brass-dark instead; burgundy-bright fails
4.5:1 as error text on the felt page (2.59:1) so --danger uses the
darker burgundy; sage fails badly as --success text on parchment
(2.2:1) and was darkened while keeping the green hue.

Dark/light mode switching is removed -- felt/parchment is the only
theme now, confirmed with the user rather than assumed.

No component markup or JS changed. All 68 tests still pass unmodified.
EOF
)"
```

---

## Task 3: Load Fraunces + Inter, apply to body/headings

**Files:**
- Modify: `index.html`
- Modify: `src/styles/base.css`

**Step 1: Add the Google Fonts links to `index.html`**

Both mockups load `Fraunces` (serif, for headings — the "card table" feel) and `Inter` (sans, for body text). Add inside `<head>`, before any other stylesheet link:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Step 2: Apply the fonts in `base.css`**

Replace the `font-family` in the existing `body` rule, and add heading styling. Real fallback stacks matter here — the tablet may be slow to fetch fonts, or (per this project's own offline-first design) may be opening the app with no network at all on a repeat visit, in which case the browser falls back to the stack below until the font is cached by the service worker.

```css
body {
  margin: 0;
  padding: var(--space);
  background: var(--bg);
  color: var(--text-on-bg);
  font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: var(--font-base);
  line-height: 1.5;
}

h1, h2, h3 {
  font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
  font-weight: 600;
}
```

Note `body`'s `color` changes from `var(--text)` to `var(--text-on-bg)` — the page background is now dark felt, and `--text` is specifically the ink colour meant for parchment cards (see Task 2). Anything that should render in card-ink (i.e., anything actually inside a `--surface`-background card) needs to set `color: var(--text)` on that card container explicitly — Task 4 handles this for `button`/`.target`.

> **Real incident, already resolved — read before treating "Task 4 handles this" as sufficient.** Code review of Task 3 found the claim above was wrong in one important way: `.round-entry__name` (a player-name `<h3>` inside `.round-entry__row`, which has `background: var(--surface)`) is NOT touched by Task 4 (Task 4 only modifies `base.css`; the actual fix for `roundEntry.css` was always Task 6's job, two tasks later). Worse, `--text-on-bg` and `--surface` turned out to be byte-identical hex values in this palette (`#F4EDD9`), so the gap wasn't just "low contrast until Task 4" — it was a total, 1:1-contrast, invisible heading, live on the deployed GitHub Pages test site the user actively checks. This was patched immediately as a stopgap (`color: var(--text)` added directly to `.round-entry__row` in `roundEntry.css`, landed as its own commit right after Task 3, not deferred to Task 6) rather than left broken. **Standing rule for Tasks 5–9**: any task that changes a widely-inherited default (like `body`'s `color` here, or Task 2's `--danger` token) must not be treated as safely deferrable-and-independently-deployable from the task(s) that patch its fallout — either fix known-severe cases immediately (as done here), or explicitly hold the deploy until the patch-up task lands. Don't assume "a later task covers it" without checking which later task and whether a deploy could land in between.

**Step 3: Verify offline precaching still covers the fonts**

The service worker precaches `**/*.{js,css,html,png,svg}` (see `vite.config.js`) — Google Fonts' CSS and woff2 files are fetched from `fonts.googleapis.com`/`fonts.gstatic.com` at runtime, not bundled by Vite, so they are NOT covered by that precache glob. This means a cold offline start (no cache from a prior visit) will silently fall back to the system font stack rather than error — confirm this is true by reading `vite.config.js`'s `workbox` config, and note in your task report whether Workbox's default runtime-caching behavior (if any) picks these up on a *second* online visit. Do not attempt to add a `runtimeCaching` rule for Google Fonts in this task — that's a bigger scope than a font swap; just confirm the fallback degrades gracefully (no error, no layout break, just system-font headings) and report what you found.

**Step 4: Build and manually inspect**

Run: `npm run build && npm run preview`

Open the preview URL, confirm headings render in a serif face and body text in a sans face (or confirm the fallback stack renders sensibly if fonts don't load in this environment — either is an acceptable pass for this step, since real device confirmation happens at Task 9).

**Step 5: Run the full test suite**

Run: `npm run test`
Expected: PASS, 68 tests, unchanged.

**Step 6: Commit**

```bash
git add index.html src/styles/base.css
git commit -m "feat: load Fraunces/Inter fonts, apply to headings and body"
```

---

## Task 4: Restyle base.css surfaces (buttons, cards, inputs) for the new palette

**Files:**
- Modify: `src/styles/base.css`

**Step 1: Update `button`/`.target` to use card-ink text on a parchment-ish surface**

The existing rule already uses `--surface`/`--text`/`--border` correctly by *name* — but since Task 3 changed `body`'s default text colour to `--text-on-bg`, anything that's meant to look like a card/control (not page text) now needs its OWN explicit `color`, or it will inherit the wrong (page-level) text colour. Update:

```css
/* 2.5.8 Target Size */
button, .target {
  min-width: var(--target-min);
  min-height: var(--target-min);
  font-size: var(--font-base);
  border-radius: var(--radius);
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);              /* unchanged in VALUE, but now load-bearing:
                                       body's default text colour is --text-on-bg,
                                       so this explicit override is required. */
  cursor: pointer;
}
```

(If this line was already exactly this in the file, no change needed here — just confirm it's present and not accidentally relying on inheritance.)

**Step 2: Give `.screen` a card-like felt-adjacent treatment, matching the mockup's card shadow**

The mockup wraps each screen's main content in a `.card` with a subtle shadow and a dashed top rule. Rather than introduce a new `.card` class that every screen would need to opt into (a markup change this plan avoids), apply an equivalent visual treatment at the `.screen` level, which every screen already has via `screen.className = 'screen ...'`:

```css
/* 1.4.10 Reflow — usable at 320px and up to landscape tablet widths. */
.screen {
  max-width: 60rem;
  margin: 0 auto;
}
```

This stays a layout-only rule (no background/shadow) — the mockup's actual "parchment card" look comes from individual sections (fieldsets, the round-entry rows, the totals grid) already having `background: var(--surface)` via their own component CSS, which Tasks 5–8 handle. Giving `.screen` itself a card treatment would visually nest cards-within-cards awkwardly, since `<fieldset>` elements already render as bordered boxes inside it — don't add a background/shadow to `.screen` itself.

**Step 3: Restyle `.error`/`.muted`/focus ring for the new palette**

```css
.error {
  color: var(--danger);
  font-weight: 600;
}

.muted {
  color: var(--text-muted-on-bg);   /* CHANGED from --text-muted: .muted is used
                                        on setup.js's page-level hint paragraphs,
                                        which sit on the felt page, not a card. */
}
```

Check every current usage of `.muted` (`grep -rn "className = 'muted'" src/` — should be `setup.js` and `history.js`) to confirm each one is genuinely page-level text and not inside a parchment card; if any usage turns out to be inside a card (background: var(--surface)), that specific element needs `--text-muted` instead of the shared `.muted` class changing wholesale — check this rather than assuming.

`:focus-visible`'s `outline: 3px solid var(--focus-ring)` needs no code change — it already reads the token by name, and Task 1/2 already verified `--focus-ring` meets 3:1 against both `--bg` and `--surface`.

**Step 4: Run the full test suite and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests; build succeeds.

**Step 5: Manual check**

`npm run preview`, open the setup screen (the only screen reachable with zero prior state). Confirm: page background is felt-dark, the `.muted` hint text ("Select at least 2 players...") is legible against the felt page, and once a `<fieldset>` renders, its border/background look like a card (parchment) rather than blending into the felt page.

**Step 6: Commit**

```bash
git add src/styles/base.css
git commit -m "feat: restyle base.css surfaces for felt/parchment palette"
```

---

## Task 5: Compact totals display — the "total-chip" grid

**Files:**
- Modify: `src/components/totalsBar.js`
- Modify: `src/styles/totalsBar.css`

This is the one component the user specifically flagged: "the total score cards could be shorter, there's lots of empty vertical space." Replace the current full-width `<table>` row-per-player layout with the mockup's compact grid of small cards, one per player, showing name (small) over score (large) — while KEEPING the underlying semantic `<table>` structure Gate 3/5 already verified (`scope="row"`/`scope="col"`, so a screen reader still pairs "Alex" with "87" as one announced unit). The visual compaction comes from CSS grid layout and smaller row height, not from abandoning the table.

**Step 1: Restructure `totalsBar.js` to render each player as a table row styled as a compact chip**

Read the current file first (`src/components/totalsBar.js`) — do not paste over it blindly, since the exact current structure (a `<table>` inside a `<div class="table-scroll">`, per the Review Gate 5 fix) must be preserved. The change here is CSS-only: no new elements, no attribute changes. Confirm this by diffing your change — if `totalsBar.js`'s diff shows anything beyond adding `className` values that didn't exist before (there should be none needed — the existing classes `totals`, `totals__table`, `totals__score` already give every element you need to hook), stop and reconsider; this task should be achievable in CSS alone by changing how the *existing* elements lay out.

**Step 2: Rewrite `totalsBar.css` as a grid**

```css
/* A table visually laid out as a compact grid of chips, not a row list --
   each <tr> becomes one grid cell. Semantics (scope="row"/"col", the table
   itself) are unchanged; this is presentation only. */
.totals__table {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space);
  width: 100%;
  border-collapse: collapse;
}

.totals__table thead {
  /* The header row (Player/Score column labels) stays visually hidden --
     the totals-heading <h2> above the table already gives it an accessible
     name (see totalsBar.js), and repeating "Player"/"Score" as grid-cell
     text would look wrong for a chip layout. Screen readers still get the
     scope="col" semantics from the table structure itself. */
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.totals__table tbody {
  display: contents;   /* let <tr> children participate directly in the grid */
}

.totals__table tr {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--space) * 0.75) var(--space);
}

.totals__table th,
.totals__table td {
  text-align: left;
  padding: 0;
  border: none;
  font-size: var(--font-base);
  color: var(--text);
}

.totals__table th[scope='row'] {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.totals__score {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.75rem;              /* reduced from --font-total (2.5rem) to
                                       fit the compact chip — still comfortably
                                       larger than body text for at-a-glance
                                       reading, just not full-width-row sized */
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--text);
}
```

**Step 3: Check `display: contents` doesn't break the existing accessibility tree**

`display: contents` on `<tbody>` removes the tbody's own box but is documented to preserve its children's participation in the accessibility tree correctly in current Chrome/Firefox (the target browsers per this project's spec) — this is a well-known pattern for "grid/flex-ify a table without losing table semantics," but confirm it, don't assume: after building, inspect the rendered totals table's accessibility tree (via a stub-DOM script reading `role`/computed structure, or the closest equivalent verification method already established in this project's test history — e.g. `tests/setup.js`'s `fake-indexeddb` pattern for storage, adapted here for a one-off DOM check) and confirm each row still exposes as a table row with its `scope="row"`/`scope="col"` cells intact, not as a flattened list of unrelated divs.

**Step 4: Run tests and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests (no test reads `totalsBar.js`'s rendered structure directly, so this is expected to be unaffected, but running confirms no import/syntax error).

**Step 5: Manual verification against the specific complaint**

`npm run preview`, get to the scorer screen with at least 4 players (may need to play through Setup with real data, or temporarily seed `main.js`'s initial state for inspection — revert any temporary seeding before commit). Confirm: chips are visibly shorter than the old full-width rows, name is small/muted, score is large/bold, chips wrap into multiple rows/columns using `auto-fit` as the tablet width allows (this should look like a genuine grid, not a single cramped row, at both 800px portrait and 1340px landscape widths — check both).

**Step 6: Commit**

```bash
git add src/components/totalsBar.js src/styles/totalsBar.css
git commit -m "feat: compact totals display into a chip grid, reducing vertical space"
```

---

## Task 6: Restyle round entry, round history, and the scorer screen

**Files:**
- Modify: `src/styles/roundEntry.css`
- Modify: `src/styles/roundHistory.css`
- Modify: `src/styles/scorer.css`
- Modify: `src/styles/stepper.css`

No markup/JS changes in this task — every class these files target already exists on the correct elements (verified in the earlier CSS review). This is the highest-visual-impact task besides the totals grid, since round entry is what a rotating scorer stares at for two hours a night.

**Step 1: `roundEntry.css` — parchment card rows, matching the mockup's player-row look**

> **Note:** `.round-entry__row` currently has a `color: var(--text)` line already — a stopgap added right after Task 3 landed (see that task's note) when `.round-entry__name` was found rendering fully invisible on the deployed test site. The block below still sets `color: var(--text)` explicitly on `.round-entry__name` itself, which is the correct long-term home for it (matches how `.round-entry__dealer` already scopes its own color) — so applying this step's CSS as written is fine; the row-level stopgap becomes redundant once this lands and can be dropped from `.round-entry__row`, but leaving it doesn't cause a bug either.

```css
.round-entry__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  padding: var(--space) calc(var(--space) * 1.25);
  border: none;
  border-bottom: 1px solid rgba(28, 35, 24, 0.08);  /* matches mockup's subtle
                                                         row divider on parchment */
  margin-bottom: 0;
  background: var(--surface);
}

.round-entry__row:first-of-type {
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}

.round-entry__row:last-of-type {
  border-bottom: none;
  border-bottom-left-radius: var(--radius);
  border-bottom-right-radius: var(--radius);
}

.round-entry__name {
  flex: 1 1 8rem;
  margin: 0;
  font-size: var(--font-large);
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  color: var(--text);
}

.round-entry__dealer {
  font-size: var(--font-base);
  color: var(--text-muted);
  font-weight: 400;
}
```

Note the change from "each row is its own bordered/margined box" to "rows share one continuous parchment surface with dividers between them, rounded only at the very top/bottom" — this matches the mockup's `.card` containing a list of `.player-row`s, rather than a stack of separate boxes. The row-level `background: var(--surface)` was already there; this task changes the border/radius treatment around it.

**Step 2: `roundHistory.css` — parchment rows for the history list**

```css
.history { margin: 0; padding-left: 0; list-style: none; }

.history__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  padding: calc(var(--space) * 1.25) var(--space);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space);
  color: var(--text);
}
```

(Switching from `padding-left: 1.5rem` + default `<ol>` numbering to `list-style: none` — the round number is already conveyed in the item's own text content per `roundHistory.js`'s `Hand of ${round.hand}: ...` summary, so the browser's own decimal marker was redundant visual noise the mockup also drops. Confirm `roundHistory.js`'s actual summary text still includes the round/hand identification before making this change — it does, per the existing component, but check rather than assume.)

**Step 3: `scorer.css` — the alert box and lock-in button**

> **Already done by Task 2's implementer.** Task 2 found `.scorer__alert` had no `background` at all (inheriting `body`'s raw `--bg`), which meant its `--danger` text/border failed contrast (2.66:1, needs 4.5:1/3:1) — proven unfixable by re-picking `--danger` itself (Task 1's math), so it was given a genuine `background: var(--surface)` and `color: var(--text)` right away rather than left broken until this task. **Do not use the low-opacity `rgba(122, 46, 51, 0.08)` treatment below** — that colour is the pre-Task-1 burgundy (stale) and was never contrast-checked at that opacity against `--bg`; the solid `--surface` background already in place is the verified, correct approach. Confirm the current file already has this (`grep -n "background" src/styles/scorer.css`) before touching `.scorer__alert` — if present, leave that rule alone and only add/adjust `.scorer__lockin`/`.scorer__end` below.
>
> **`.scorer__end` still needs the same fix this task must apply**: it currently sets `color: var(--danger)` and `border-color: var(--danger)` directly against the page background (`--bg`) — the same failing pairing Task 2 found elsewhere (2.66:1). Use `var(--danger-on-bg)` (added by Task 2's fix, `#DB767D`) instead, since this button sits on raw felt, not a parchment surface.

```css
.scorer__lockin {
  width: 100%;
  font-size: var(--font-large);
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  margin-bottom: var(--space);
}

.scorer__end {
  margin-top: calc(var(--space) * 3);
  background: transparent;
  color: var(--danger-on-bg);   /* NOT --danger — this button sits on raw --bg */
  border-color: var(--danger-on-bg);
}
```

**Step 4: `stepper.css` — parchment input, brass buttons**

```css
.stepper__label {
  display: block;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: calc(var(--space) / 2);
  font-weight: 600;
}

.stepper__controls { display: flex; align-items: stretch; gap: calc(var(--space) / 2); }

.stepper__button {
  min-width: var(--target-min);
  min-height: var(--target-min);
  font-size: var(--font-large);
  line-height: 1;
  background: var(--bg);
  color: var(--text-on-bg);
  border-color: var(--border);
}

.stepper__input {
  width: 4.5rem;
  min-height: var(--target-min);
  font-size: var(--font-large);
  text-align: center;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text-on-bg);
  -moz-appearance: textfield;
  appearance: textfield;
}

.stepper__input::-webkit-outer-spin-button,
.stepper__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stepper__input[aria-invalid='true'] {
  border-color: var(--danger-on-bg);   /* NOT --danger — already fixed by
                                           Task 2, see the note below */
  border-width: 3px;
}
```

> **Already done by Task 2's implementer.** Task 2 traced this exact rule and found `var(--danger)` fails here (2.66:1, needs 3:1) because the stepper input's own background is `--bg`, not `--surface` — `--danger` was only ever contrast-verified for a `--surface` background. Rather than distort the shared `--danger` token (which would break its already-correct uses elsewhere), Task 2 added `--danger-on-bg` (`#DB767D`, verified 5.0:1 on `--bg`) specifically for danger content sitting on raw felt. Confirm the current file already uses `--danger-on-bg` here (`grep -n "aria-invalid" src/styles/stepper.css`) before making any change — if present, this step needs no action.

Note: the stepper's button/input use `--bg`/`--text-on-bg` (felt colours), NOT `--surface`/`--text` (parchment colours) — this is a deliberate choice matching the mockup, where steppers sit as a slightly-recessed "well" against the parchment card, not as another parchment surface. Verify this reads correctly (sufficient contrast between the stepper's felt-dark well and the parchment card it sits inside) — Task 1's contrast script already confirms `--text-on-bg` on `--bg` passes, but the NEW pairing this introduces (`--bg` well against `--surface` card background, i.e. is the boundary between them visible enough to read as a distinct control) is not a text-contrast concern (1.4.11 doesn't apply the same way to a background-against-background boundary) but is worth a manual visual check in Step 6.

**Step 5: Run tests and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests; build succeeds.

**Step 6: Manual verification**

`npm run preview`, walk through a live round: confirm player rows read as one continuous parchment card (not separate boxes), confirm the stepper's felt-coloured well is visually distinct from the parchment card around it and text inside it (the number, the +/− glyphs) is legible, confirm the round-wide error alert renders in a low-opacity burgundy card matching the mockup's look, confirm "Lock in round" is a solid brass button with legible ink-coloured (or parchment, per Task 2's `--accent-text`) label text.

**Step 7: Commit**

```bash
git add src/styles/roundEntry.css src/styles/roundHistory.css src/styles/scorer.css src/styles/stepper.css
git commit -m "feat: restyle round entry, history, and scorer controls for felt/parchment"
```

---

## Task 7: Restyle setup screen

**Files:**
- Modify: `src/styles/setup.css`

**Step 1: Update fieldset/legend styling**

The current app relies on the browser's native `<fieldset>`/`<legend>` rendering (visible in the earlier black-and-white screenshot from Task 25's device test — a plain grey box with a notched border around the legend). The mockup instead uses parchment `.card`s with a serif `<h2>`-style heading. Since this plan avoids restructuring markup (fieldset/legend stays, for its free accessibility grouping semantics), style the native fieldset to look like a parchment card instead of fighting the browser's default chrome:

```css
fieldset {
  border: none;
  background: var(--surface);
  border-radius: var(--radius);
  padding: calc(var(--space) * 1.5);
  margin: 0 0 var(--space) 0;
  color: var(--text);
}

legend {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.1875rem;
  font-weight: 600;
  color: var(--text);
  padding: 0;
  margin-bottom: var(--space);
}
```

Note this is a NEW rule added to `setup.css` (or, if you judge it applies identically to every screen using a `<fieldset>` — confirm via `grep -rn "createElement('fieldset')" src/`, currently only `setup.js` — keep it scoped to `setup.css` unless another screen also uses fieldsets, in which case move it to `base.css` instead so it's not duplicated).

**Step 2: Update the player-row and rule-row styling**

```css
.setup__player {
  display: flex;
  align-items: center;
  gap: var(--space);
  min-height: var(--target-min);
  color: var(--text);
}

.setup__player input[type='checkbox'] {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  accent-color: var(--accent);
}

.setup__player label {
  font-size: var(--font-base);
}

.setup__add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space);
  margin-top: var(--space);
}

.setup__add input[type='text'] {
  min-height: var(--target-min);
  font-size: var(--font-base);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text-on-bg);
  padding: 0 calc(var(--space) * 1.5);
}

.setup__rule {
  display: flex;
  align-items: center;
  gap: var(--space);
  min-height: var(--target-min);
  color: var(--text);
}

.setup__rule input[type='checkbox'] {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  accent-color: var(--accent);
}

.setup__start {
  margin-top: var(--space);
  font-family: 'Fraunces', Georgia, serif;
  font-size: var(--font-large);
  font-weight: 600;
}
```

(`accent-color` is the standard CSS property for native checkbox tint — supported in current Chrome/Firefox per this project's target browsers; it's a small addition to make the checkbox itself pick up the brass accent rather than rendering in the browser's default blue.)

**Step 2: Run tests and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests; build succeeds.

**Step 3: Manual verification**

`npm run preview`, open the setup screen (reachable with zero state — the natural starting screen). Compare directly against `whistfiles/whist-setup.html` opened side by side. Confirm: each fieldset now looks like a parchment card, not a native browser fieldset box; the "Start session" button uses the serif heading font at large size, matching the mockup's "Deal the first hand" button; checkboxes are brass-tinted.

**Step 4: Commit**

```bash
git add src/styles/setup.css
git commit -m "feat: restyle setup screen fieldsets and controls for felt/parchment"
```

---

## Task 8: Restyle summary and history screens (new stylesheets)

**Files:**
- Create: `src/styles/summary.css`
- Create: `src/styles/history.css`
- Modify: `src/main.js` (two new CSS imports)

Per Review Gate 5's finding, `summary.js` and `history.js` currently have NO dedicated stylesheet at all — they render bare, browser-default-styled tables (already partially mitigated by the Gate 5 `.table-scroll` fix for reflow, but with none of the mockup's visual treatment). This task closes that gap as part of the reskin rather than leaving it as a separate follow-up.

**Step 1: Create `src/styles/summary.css`**

```css
.summary__winner {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--text-on-bg);
  margin: 0 0 var(--space) 0;
}

.screen.summary table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: var(--radius);
  overflow: hidden;   /* clips the table's own corners to the radius */
}

.screen.summary th,
.screen.summary td {
  text-align: left;
  padding: calc(var(--space) * 0.75) var(--space);
  border-bottom: 1px solid rgba(28, 35, 24, 0.08);
  color: var(--text);
  font-size: var(--font-base);
}

.screen.summary tbody tr:last-child th,
.screen.summary tbody tr:last-child td {
  border-bottom: none;
}

.screen.summary button {
  margin-top: var(--space);
  width: 100%;
}

.screen.summary button.primary {
  font-family: 'Fraunces', Georgia, serif;
  font-size: var(--font-large);
  font-weight: 600;
}
```

**Step 2: Create `src/styles/history.css`**

```css
.history-screen section {
  background: var(--surface);
  border-radius: var(--radius);
  padding: calc(var(--space) * 1.5);
  margin-bottom: var(--space);
  color: var(--text);
}

.history-screen h2 {
  font-size: 1.0625rem;
  margin: 0 0 var(--space) 0;
}

.history-screen ol {
  margin: 0;
  padding-left: 1.25rem;
}

.history-screen ol li {
  display: flex;
  justify-content: space-between;
  padding: calc(var(--space) / 2) 0;
  border-bottom: 1px solid rgba(28, 35, 24, 0.08);
}

.history-screen ol li:last-child { border-bottom: none; }

.history-screen table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space);
}

.history-screen th,
.history-screen td {
  text-align: left;
  padding: calc(var(--space) * 0.6) calc(var(--space) * 0.75);
  border-bottom: 1px solid rgba(28, 35, 24, 0.08);
  font-size: 0.9375rem;
  color: var(--text);
}
```

**Step 3: Import both new files in `main.js`**

Find the existing block of stylesheet imports (`import './styles/base.css';` and its neighbours) and add:

```js
import './styles/summary.css';
import './styles/history.css';
```

**Step 4: Run tests and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests; build succeeds.

**Step 5: Manual verification**

`npm run preview`. Reach the summary screen (finish a session) and the history screen (View history and stats). Confirm both now render as parchment cards with proper spacing, matching `whistfiles/whist-final.html` and `whistfiles/whist-history.html`'s general look (exact podium/medal visual from `whist-final.html` is NOT in scope for this task — that's a markup change, noted as a possible follow-up, not built here). Confirm the bid-accuracy table (potentially the widest table in the app) still scrolls horizontally rather than breaking layout at narrow widths — the `.table-scroll` wrapper from Review Gate 5 is untouched by this task and must still work.

**Step 6: Commit**

```bash
git add src/styles/summary.css src/styles/history.css src/main.js
git commit -m "feat: add summary and history stylesheets (previously unstyled)"
```

---

## Task 9: Landscape/portrait width verification and fix

**Files:**
- Modify: `src/styles/base.css` (likely `.screen`'s max-width and/or a new landscape-specific rule)

This task exists because the mockups were built at a fixed 480px width and never validated against the actual target (800×1340 portrait, and landscape when rotated) — confirmed with the user this is a real gap, not a hypothetical one.

**Step 1: Measure the problem**

Using the project's established headless-browser screenshot method (Edge in `--headless` mode, as used during the mockup review — see this plan's originating conversation for the exact command shape), render the built app's setup screen at:
- 800×1340 (portrait, matches the Samsung A9 native resolution)
- 1340×800 (landscape)
- 320×568 (WCAG 1.4.10 Reflow minimum — must still not be broken by this reskin)

```bash
npm run build && npm run preview -- --host &
# wait for the server, then for each viewport:
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --window-size=800,1340 --screenshot="/tmp/setup-portrait.png" "http://localhost:4173/"
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --window-size=1340,800 --screenshot="/tmp/setup-landscape.png" "http://localhost:4173/"
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --window-size=320,568 --screenshot="/tmp/setup-320.png" "http://localhost:4173/"
```

Inspect all three screenshots (read them as images, don't just confirm the files exist). Look specifically for: excessive unused horizontal space in landscape (the current `.screen { max-width: 60rem }` = 960px, so landscape's 1340px width should mostly be used, unlike the mockup's 480px cap — confirm this is actually true now, not assumed), and confirm nothing overflows or clips at 320px.

**Step 2: If landscape still wastes significant space, widen `.screen` or add a landscape-specific layout rule**

`60rem` (960px) was already wider than the mockup's 480px cap, so this task may find the current width is already reasonable and needs no change — verify before editing. If the screenshots show meaningful unused space in landscape (more than would be reasonable for readable line-length at this content type — card-based UI, not flowing prose, so a wider max-width than a text-heavy site is appropriate), consider:

```css
@media (orientation: landscape) and (min-width: 900px) {
  .screen {
    max-width: 78rem;   /* widen further specifically for landscape tablet use */
  }
}
```

Only add this if Step 1's screenshots actually justify it — do not add speculative CSS for a problem the measurement didn't confirm.

**Step 3: Re-screenshot after any change, confirm the fix**

Repeat Step 1's screenshot capture if you made a change in Step 2, and confirm the landscape view now uses the width better without breaking the 320px or portrait views.

**Step 4: Run tests and build**

```bash
npm run test
npm run build
```
Expected: PASS, 68 tests.

**Step 5: Commit**

```bash
git add src/styles/base.css
git commit -m "feat: verify and tune layout width for landscape/portrait tablet use"
```

(If Step 2 found no change was needed, commit nothing for this task — note in your final report that the width was verified sufficient as-is, with the screenshot evidence.)

---

## 🚦 Review Gate — after Task 9 (reskin complete)

This plan does not renumber or replace Review Gates 1–5 from the original build plan (`docs/plans/2026-08-25-contract-whist-scorer.md`) — this is a single additional gate for the reskin specifically.

**Run the suite:** `npm run test` → PASS, 68 tests, unchanged from before this plan started.

**Re-verify what Gate 5 already checked, since colours changed:**
1. **Contrast** — re-run a script equivalent to Task 1's against the FINAL `tokens.css` (not the Task 1 draft — confirm no value drifted during Tasks 2–9). Every pairing must still independently pass.
2. **Focus visibility** — confirm `:focus-visible`'s ring is still clearly visible against both `--bg` and `--surface` at the new brass-bright colour.
3. **Colour-never-sole-signal** — spot check `.stepper__input[aria-invalid='true']` still changes border WIDTH as well as colour (it does per Task 6's CSS, but confirm the diff didn't drop this).
4. **Reflow** — Task 9 already covers 320px/800px/1340px; confirm once more after all of Tasks 5–8's changes are in, since Task 9 may have run before later tasks landed depending on execution order.
5. **Target size** — confirm 44px minimums are untouched (no task in this plan changes `--target-min` or removes a `min-height`/`min-width` rule).

**Persona review** (see `docs/review-personas.md`):
- **Rotating Non-Expert User** — Is the new palette actually MORE usable at a glance across a table, or does the serif display font/smaller totals chips risk being harder to read quickly under time pressure? This is a real, not rhetorical, question — large bold sans-serif numbers (the old design) are a conservative choice for at-a-distance reading; a serif numeral font is a stylistic tradeoff. Confirm the chosen `--font-total`-replacement size in Task 5 is still comfortably legible, not just "smaller."
- **Skeptical Platform Engineer** — Does `display: contents` (Task 5) and `accent-color` (Task 7) actually render as expected in both Chrome and Firefox for Android specifically, not just desktop Edge (used for screenshot verification in this plan, since it was the only browser available in this environment)? Flag this as needing Task 25-style real-device confirmation if it can't be verified further here.
- **YAGNI Editor** — Did any task introduce a CSS rule, colour, or class that ended up unused? (E.g., if Task 9 concludes no landscape-specific rule was needed, confirm no dead media query was left committed.)

**Definition of done for this plan:**
1. All 68 tests pass, unmodified.
2. Every colour pairing in the final `tokens.css` is independently contrast-verified (script output recorded in commit messages, not just eyeballed).
3. No component's markup structure, ARIA attributes, or JS logic changed from before this plan (verify via `git diff` against the pre-reskin commit for every `.js` file touched — only `totalsBar.js` should show a diff, and Task 5 requires that diff to be non-existent or trivial).
4. The totals display is visibly more compact than before (Task 5's specific ask).
5. Summary and history screens have real, dedicated styling (previously had none).
6. Layout is verified (via screenshots, not assumption) to work reasonably at 320px, 800×1340 portrait, and 1340×800 landscape.
7. Dark mode is fully removed, felt/parchment is the only theme.
