# Contract whist scorer — build spec

## Overview

A PWA (installable web app) for scoring contract whist with a group of friends, used on a shared tablet that's passed around week to week. No backend, no login, no sync service, no network dependency. All data lives in the browser's own persistent storage (IndexedDB) on the tablet.

**Primary device:** Samsung A9 tablet (Android), Chrome or Firefox. Single-platform build — no iOS/adapter abstraction for now (see Storage layer below).

## Core principles

- No database server, no backend, no accounts, no network calls. IndexedDB (in-browser storage) is the entire persistence layer — nothing leaves the device.
- One logical record per session, keyed by session ID. Simple writes, no corruption risk, trivial to combine for analytics (load every session record, concatenate).
- The app must survive a rotating, non-technical scorer: validate input, autosave in-progress state after every round so a crash or accidental close doesn't lose a session, and don't hard-fail if history can't be loaded (app still works with zero history present).
- Install as a PWA (manifest + service worker) so it opens fullscreen from a home-screen icon and works fully offline.

**Note on storage choice:** an earlier draft of this spec used the File System Access API (`showDirectoryPicker()`) to write JSON files into a visible folder. That API is desktop-only and is not implemented by Chrome or Firefox on Android, so it would not have worked on the target device. IndexedDB replaces it — same offline-first, no-backend properties, but actually supported on the target platform. A "share/export this session" button (using a plain file download or the Web Share API, both well-supported on Android) can still produce a JSON file for backup purposes; it's just no longer the primary persistence mechanism.

## Data model

### Player profiles (persistent, separate from sessions)

Players are created once and reused across sessions — a rotating scorer picks from existing profiles rather than retyping names each week (retyping risks typos that silently fork stats — see "Same-group cumulative" below).

```json
{ "id": "p_alex", "name": "Alex" }
```

Stored as its own collection in IndexedDB, independent of session records. The setup screen offers "pick existing player" (autocomplete/list from this store) or "add new player" (creates a new profile, persisted immediately so it's available next week too).

### Sessions

One record per session, keyed by `sessionId` (sortable, e.g. `2026-08-25` or `2026-08-25-1930` if more than one session could occur on the same day).

```json
{
  "sessionId": "2026-08-25",
  "date": "2026-08-25T19:30:00Z",
  "rules": { "dealerRestriction": false },
  "players": ["p_alex", "p_sam", "p_jo", "p_priya"],
  "rounds": [
    {
      "hand": 7,
      "locked": true,
      "results": {
        "p_alex": { "bid": 3, "won": 3, "points": 13 },
        "p_sam":  { "bid": 2, "won": 1, "points": 0 },
        "p_jo":   { "bid": 1, "won": 1, "points": 11 },
        "p_priya":{ "bid": 1, "won": 2, "points": 0 }
      }
    }
  ],
  "finalScores": { "p_alex": 87, "p_sam": 62, "p_jo": 71, "p_priya": 55 }
}
```

`players` stores player **IDs**, referencing the player-profile store — not names directly — so a later name edit or typo fix doesn't fork a player's history.

Scoring rule: `points = made ? 10 + bid : 0`, where `made = (bid === won)`. A made zero-bid scores 10, per house rules. Sum of `won` across all players in a round must equal `hand`.

`rules.dealerRestriction`: when `true`, the last bidder (dealer) may not bid a number that would make the sum of all bids equal `hand` (a common "someone must go down" house rule). Defaults to `false`. Recorded per-session (not just as a global setting) so historical sessions remain unambiguous about which rule was active, even if the setting is changed later. No UI toggle in v1 (see Setup screen) — the field exists now so adding the toggle later doesn't require a data migration.

### Hand sequence and trump-card rule

One card is always held back undealt after dealing, to be turned up as the trump indicator — the deck is never fully dealt out. Max hand size is therefore:

```
maxHand = floor((52 - 1) / playerCount)
```

E.g. 4 players → floor(51/4) = 12 (not 13). 5 players → floor(51/5) = 10.

Hand sequence starts at a configurable size (default: the computed `maxHand` for the current player count, adjustable down via the setup slider), counts down to 1, then back up to the starting size. E.g. start 11 (4 players, if chosen below the max of 12) → 11,10,...,1,...,10,11.

The live-scorer screen shows the current hand size and, implicitly, cards-dealt-per-player for that round — see Setup and Live scorer screens below for where this is surfaced.

## Screens

### 1. Setup
- Pick players: select from existing player profiles (list/autocomplete) or add a new player (name → creates a persistent profile, reused in future sessions). Minimum 2 players.
- Dealer-restriction toggle: "someone must go down" rule (see `rules.dealerRestriction` above). Off by default. Applies for the whole session.
- Starting hand size slider — default and max computed live from player count (`floor((52-1)/playerCount)`, see Hand sequence above); the screen shows the computed max as player count changes (e.g. "4 players → up to 12 cards").
- "Start session" button

### 2. Live scorer
- Running totals per player, shown large enough to read across a table
- Current round: hand size shown clearly (e.g. "Round 3 — dealing 5 cards each"), per-player bid + tricks-won inputs
- **Lock-in button**: bid/won values for the current round are editable freely until the round is explicitly locked in (a distinct action from just filling the inputs). This covers the common real case of someone changing their mind on a bid, or fat-fingering a number, before the round is finalized. Once locked, the round is validated and added to the round history; running totals update. Locking is required to advance to the next round.
  - If `rules.dealerRestriction` is on: reject a dealer bid that would make the sum of all bids equal `hand`, same "show inline error, don't advance" treatment as other validation failures.
- Validation before lock-in: every player has both values filled, values within `[0, hand]`, sum of tricks won across all players equals `hand`. Show inline error (large, tied clearly to the specific player's row — legible at arm's length across a table), don't lock in, on failure.
- **Editing the most recently locked-in round**: tapping the top entry in the round history log re-opens it for editing (same lock-in flow), and running totals recompute from that point forward on save. Editing any round further back than the most recent one is out of scope for v1 (see below).
- Round history log (compact, most recent first)
- "End session" button (can end early, before the hand sequence completes)
- **Autosave**: persist in-progress session state (players, rounds so far, current index) after every round lock-in, so an app close/crash doesn't lose data. This is the same IndexedDB write used for the session record generally — see Storage layer below — not a separate mechanism.

### 3. Session end
- Show final rankings
- Session record is already persisted via autosave; mark it complete/final in storage
- Optional: "share/export session" — produces a JSON file of the session via a normal file download or the Web Share API, for anyone who wants a backup copy off-device. Not required for the app to function.

### 4. History / stats
- "Load history" — reads all session records from IndexedDB, computes stats in memory. No caching layer needed; expected volume is low (one record per session, years of use = low hundreds of records at most).
- If history can't be loaded or is empty, don't error — show an empty state ("No past sessions found yet") and let the rest of the app work normally.

Stats to compute, all-time (no date filtering needed):
- **Last session**: date, players, final scores, ranked
- **Same-group cumulative**: filter all sessions where the player set (by ID, not name — see Data model) exactly matches the currently selected/active group, sum `finalScores` across those sessions, show ranked cumulative totals, and show who won the most recent session with that exact group
- **Bid accuracy**: per player, % of rounds where `bid === won` (i.e. contract made), overall and broken out by hand size (since bidding on a 7-card hand is a different skill than bidding on a 1-card hand). Simple aggregation: for each player, count rounds played and rounds made, group by `hand` value.

## Storage layer

All persistence goes through one small module — not a multi-platform adapter interface, since only one platform (Android/Chrome or Firefox) is being built:

```
savePlayer(player: PlayerProfile): Promise<void>
loadAllPlayers(): Promise<PlayerProfile[]>
saveSession(session: SessionData): Promise<void>
loadAllSessions(): Promise<SessionData[]>
```

Implemented directly against IndexedDB (two object stores: `players`, `sessions`). No permission prompts, no folder handles — IndexedDB is available to the PWA as soon as it's installed. Standard browser storage-eviction caveats apply if the app goes unused for a long time (months), same as any other installed PWA's local data; not a v1 concern.

If a second platform (e.g. iOS) is ever built, revisit this module's shape then — don't design the abstraction now for a platform that isn't being built.

## Explicitly out of scope for v1

- Multi-device live sync
- User accounts / auth
- Date-range filtering on stats (all-time only for now)
- Editing a round further back than the most recently locked-in one (the lock-in button plus "edit most recent round" covers the common fat-finger/change-of-mind case; deeper history edits deferred until real use shows it's needed)

## Tech stack

- **Vanilla JS (ES modules) + Vite** — no framework. Small hand-rolled render layer; fewest moving parts for an app this size.
- **`vite-plugin-pwa`** for the manifest and service worker (offline install).
- **Vitest** for unit tests covering the logic that's easy to get silently wrong: scoring, hand sequence, round validation, stats aggregation, and the storage module. UI is verified by hand on the tablet — no E2E browser automation in v1.
- **`fake-indexeddb`** so storage-module tests run in Node without a browser.

## Implementation

See [docs/plans/2026-08-25-contract-whist-scorer.md](docs/plans/2026-08-25-contract-whist-scorer.md) for the task-by-task build plan.

> **Note:** an earlier draft of this spec referenced a working HTML/JS scorer prototype from the design process. That artifact is not available in this repo, so the live-scorer logic is built fresh from the rules specified above rather than ported.
