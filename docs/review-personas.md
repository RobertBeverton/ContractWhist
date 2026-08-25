# Spec review personas

Reusable critique lenses for reviewing specs, plans, and PRs in this project. Each persona has a narrow focus — don't let one persona wander into another's territory, that's how you get generic feedback. When reviewing, run the material through each persona in turn and note only what's *specific* to that lens.

Add new personas here as gaps in coverage show up (e.g. if a future review misses an accessibility issue, consider whether a persona should have caught it).

---

## 1. The Skeptical Platform Engineer

**Focus:** Are the technical assumptions actually true? Will this run on the real device, in the real browser, today — not in theory, not per the spec, not per documentation that might describe a different platform than the target.

**Asks:**
- Is every API call in this spec actually supported on the target device/browser combination? (Not "supported by the spec," supported *there*.)
- What's unverified and being taken on faith? What's the cheapest way to verify it before committing design decisions to it?
- What happens on the failure path no one tested — permission denied, storage full, browser killed mid-write, app backgrounded during a save?
- Is there a simpler technology choice that avoids the risky one entirely?

**Voice:** Blunt, allergic to "should work." Wants a spike or a five-minute manual test before an architecture gets built on top of an assumption.

---

## 2. The Rotating Non-Expert User

**Focus:** This app will be operated by whoever's holding the tablet that week — not the builder, not a technical person, mid-game, with people waiting on them. Every screen is judged from that seat.

**Asks:**
- Can someone who has never seen this app before correctly score a round on their first try, under mild social pressure, without instructions?
- What happens when they fat-finger an input, tap the wrong player's box, or need to fix a mistake from two rounds ago? Is recovery possible, or is the data now wrong forever?
- Is the thing they need to look at (running totals, whose turn it is, current hand size) big and unambiguous from across a table?
- Does the app ever put someone in a state where the only way out is "ask the person who built it"?

**Voice:** Impatient, non-technical, mildly distracted by the actual card game happening in front of them. Not interested in features — interested in "just let me enter the score and get back to the game."

---

## 3. The Rules Lawyer

**Focus:** Contract whist has real house-rule variation. This persona checks the data model and scoring logic against how the game is actually played by *this* group, not against a generic/assumed rule set — and flags every place a house-rule variant would break the model.

**Asks:**
- Does the scoring formula match this group's actual rules, including edge cases (nil bids, all-bid-zero rounds, one player bidding the full hand)?
- Are there common house-rule variants (e.g. dealer-restriction / "screw the dealer," bonus scoring, misère rounds) that aren't in the spec at all — not wrong, just absent — and should at least be a named, deferred decision rather than a silent gap?
- Does the data model have room to express a rule change later without a schema migration, or does every house-rule tweak require reshaping the JSON?
- Is validation (e.g. "sum of tricks won must equal hand size") actually a universal rule, or specific to a rule variant this group may not use forever?

**Voice:** Pedantic on purpose. Treats "we'll figure out house rules later" as a bug, not a detail — because it's the one thing hardest to retrofit into a data model after real session data already exists in the old shape.

---

## 4. The YAGNI Editor

**Focus:** Cuts. Every feature, screen, and abstraction in the spec has to justify its presence for v1, used by this specific small group, on this specific device. Default answer to "should we build X" is no.

**Asks:**
- Is this feature solving a problem that exists today, or one the builder imagines might exist later?
- Does this abstraction (e.g. a storage adapter interface for a platform that isn't being built yet) pay for itself now, or is it speculative generality?
- Could two features be merged, or one removed, without anyone noticing for the first ten real sessions?
- If this were cut entirely, what would actually break — and is that consequence real or hypothetical?

**Voice:** Terse, slightly ruthless. Not anti-feature — anti-*premature* feature. Happy to say "write it down as a v2 idea and move on" rather than "don't ever build this."
