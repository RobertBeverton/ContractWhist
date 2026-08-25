# Spec review: contract-whist-scorer-spec_1.md

Reviewed 2026-08-25 against [review-personas.md](./review-personas.md). Findings below, grouped by severity, each tagged with the persona(s) that raised it.

**Status: all findings below resolved and merged into the spec on 2026-08-25.** Kept as a record of what changed and why. See spec sections: Overview/Core principles (storage), Data model (player profiles, `rules.dealerRestriction`, trump-card hand-size cap), Live scorer screen (lock-in button), Storage layer (IndexedDB, no iOS adapter).

Two decisions made during resolution that go beyond the original findings:
- **Trump-card rule**: the hand-size cap formula was wrong even after fixing player-count math — one card must always be held back undealt to turn up as the trump indicator, so the true cap is `floor((52-1)/playerCount)`, not `floor(52/playerCount)`. Caught during review discussion, not in the original findings below.
- **Supabase considered and rejected** for storage: would reverse every core principle in the spec (no backend, no accounts, offline-first) for a benefit (remote sync) that's explicitly out of scope for v1. IndexedDB stands.

## Must fix before building

### 1. `showDirectoryPicker()` does not exist on Android Chrome — the storage adapter as written cannot be built
**Persona:** Skeptical Platform Engineer

The File System Access API's `showDirectoryPicker()` is a **desktop-only** API. Chrome for Android does not implement it (no mainline support has shipped as of this review), and Firefox for Android doesn't implement the File System Access API at all. The whole "Android implementation (primary, build now)" section in the storage adapter is built on an API that isn't present on the target device in either browser you have installed. This isn't a maybe — it's the single biggest fact-check failure in the spec, and it's exactly the kind of "should work per docs" assumption worth killing before any code gets written around it.

**Resolution (confirmed with you):** you don't actually need visible JSON files in a folder — the tablet stays in one place and you just need reliable persistence across sessions. Drop the folder-picker design entirely. Use **IndexedDB** (or OPFS if you want file-like semantics under the hood) as the v1 storage layer instead. This is well-supported in both Chrome and Firefox on Android, persists across app restarts once the PWA has been used a couple of times (subject to standard browser storage-eviction rules for inactive sites — worth a "hasn't been opened in months" caveat, not a v1 blocker), and removes the riskiest unknown in the whole spec.

Keep the `SessionStorage` adapter interface — it's still the right shape — just point the "Android implementation" section at IndexedDB instead of File System Access API. The "export as JSON" idea doesn't disappear, it becomes a nice-to-have: a "share/export this session" button that triggers a normal file download (`<a download>` or the Web Share API), which *is* well-supported, rather than being the primary persistence mechanism.

### 2. Dealer-restriction rule ("screw the dealer") isn't in the spec, and there's no mechanism for house-rule variation at all
**Persona:** Rules Lawyer

You confirmed you don't use this rule today but want a toggle for it later. Right now the spec has no concept of "settings" or "rule variants" anywhere — no settings screen, no field in the session/session-config data for it. That's fine to defer, but it should be named explicitly as a deferred decision, not silently absent, because it affects the data model now even if the UI comes later:

- If a session file doesn't record which rule variant was active, historical sessions become ambiguous once a toggle is added (a partial round where bids summed to the hand size could mean "this session predates the rule" or "the rule was off that day" — you can't tell them apart after the fact).
- Recommendation: add an optional `rules: { dealerRestriction: boolean }` (or similar) object to the session JSON now, defaulting to `false`, even before there's a UI to change it. Costs nothing today, avoids a schema migration later, and the toggle becomes "add a setup-screen control that writes this field" rather than "redesign the file format."

### 3. No way to correct a mistake in an earlier round
**Persona:** Rotating Non-Expert User + explicitly flagged as a known gap in the spec itself

The spec already names this as a known gap ("Editing a round after later rounds have been submitted... consider for v2 if it becomes a real pain point"). Worth pushing back on deferring this one, not because it's wrong to defer, but because of *who* is using this app: a rotating, non-technical scorer, mid-game, under mild social pressure, is the single most error-prone operator profile you could design for. "Wait for it to become a real pain point" means the pain point is *a wrong permanent score in front of your friends*, discovered two rounds later, with no way to fix it except restarting the session.

This doesn't need full undo/audit-log machinery for v1. A minimal version — tap a row in the round history log, re-open just that round's bid/won inputs, resubmit, recompute running totals from that point forward — is a small, contained feature (the recompute logic already exists, since totals are presumably derived from the rounds array rather than stored incrementally). Recommend pulling a minimal "edit last round only" into v1 rather than the full "edit any past round," which keeps scope small while covering the highest-frequency real mistake (fat-fingering the round you just entered).

## Worth deciding now, cheap to fix

### 4. Storage adapter interface for iOS is speculative generality for a platform not being built
**Persona:** YAGNI Editor

The spec explicitly says iOS is "build later, not now," yet the interface is being designed today to accommodate an implementation that doesn't exist and an install base of one device. This isn't necessarily wrong — a clean interface boundary is cheap — but two things follow from dropping File System Access API (finding #1):

- With storage moving to IndexedDB, the Android/iOS adapter split described in the spec (folder handle vs. share-sheet-per-save) no longer applies as written; that whole section needs rewriting anyway once #1 lands, so this is a good moment to also ask whether designing for iOS at all is buying you anything right now versus just keeping the storage calls behind one small module (not necessarily a formal interface with two implementations) and revisiting the shape if/when an iOS build actually happens.
- Keep it simple: one `storage.js`-style module with `saveSession`/`loadAllSessions`/etc. functions. Don't design the abstraction for a second platform until there's a second platform.

### 5. "Same-group cumulative" stat depends on exact player-set match, which is fragile
**Persona:** Rules Lawyer + Rotating Non-Expert User

The spec defines this as filtering sessions where the player set *exactly* matches. In practice: name typos ("Priya" vs "Priya "), someone joining 20 minutes late and being added mid-session, or a regular being called "Jo" one week and "Joanne" another, will silently split what should be one continuous group history into two "different groups" with no error and no indication anything went wrong to the person entering names.

Cheap mitigations worth deciding now rather than after data exists in the old shape:
- Trim + case-normalize names before comparison and storage.
- Consider a lightweight "known players" list (autocomplete/pick-from-existing on the setup screen) rather than free-text every time, so the rotating scorer selects "Priya" from a list instead of retyping her name and risking a mismatch. This also directly serves screen 1 ("Add/remove players... dedupe check") which already implies some notion of a canonical player list.

### 6. Validation described only in terms of the failure case, not what "inline error" means on a shared tablet
**Persona:** Rotating Non-Expert User

Section 2 says "show inline error, don't advance, on failure" for bid/won validation — reasonable, but worth being explicit that the error needs to be legible at arm's length (large text, clearly tied to the specific player's row that's wrong, not a generic toast) given the stated design goal of "running totals... shown large enough to read across a table." Not a structural issue, just flagging so the UI pass doesn't default to a small inline red text under an input box that nobody at the far end of the table can read.

## Smaller notes

- **Bid-of-zero scoring confirmed correct** (Rules Lawyer): you confirmed `points = made ? 10 + bid : 0` with a made bid-0 scoring 10 matches your house rules as written. No change needed, but worth documenting *why* explicitly in the spec (one line: "a made zero-bid scores 10, per house rules") since it's the kind of formula detail a future reader (including future-you) might second-guess and "fix" incorrectly.
- **Hand-size cap formula** (`floor(52 / playerCount)`) is correct for a standard 52-card deck dealt evenly with no cards held back — worth a one-line comment in the spec or code confirming that assumption (no joker, no undealt cards) since it's exactly the kind of thing that's obvious now and mysterious in six months.
- **Autosave** (spec section 2) is good practice already, but now that storage is IndexedDB rather than a folder+localStorage split, autosave and "final export" arguably become the same storage mechanism rather than two different ones (localStorage for autosave, folder write for export). Simplifies rather than complicates — flagging so the storage-adapter rewrite (finding #1) collapses this into one code path instead of two.

## Overall

The spec's structure, scope discipline (explicit out-of-scope section), and data model are solid — this isn't a rewrite, it's one load-bearing wall (the storage API) that needs replacing, plus a handful of cheap-now/expensive-later decisions to make before the data model is locked in by real session files. Recommend: fix #1 (storage) and #2 (rules field) before writing any code, since both affect the shape of data that will exist from session one; #3 (edit-last-round) is worth pulling into v1 scope; the rest are cheap opportunistic improvements.
