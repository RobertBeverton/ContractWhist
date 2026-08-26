# Device test — Task 25

**Date:** 2026-08-26
**Device:** Samsung Galaxy Tab A9 (managed by a family/parental-control profile — see "Environment constraints" below)
**Browser tested:** Chrome for Android

## What was tested and confirmed

- **Loads correctly over a real HTTPS connection.** Served from a temporary GitHub Pages deployment (`https://robertbeverton.github.io/ContractWhist/`, built via `.github/workflows/deploy-pages.yml`, manually triggered against `feature/scorer-app`) rather than the local dev machine, because the tablet's parental-control profile blocks both USB debugging and installing a local trusted certificate (see below) — a plain LAN `http://` or self-signed HTTPS origin couldn't be used for a proper test.
- **App renders with correct styling.** This surfaced a real bug: `src/main.js` only ever imported `base.css` — every screen/component stylesheet (`setup.css`, `stepper.css`, `scorer.css`, `totalsBar.css`, `roundEntry.css`, `roundHistory.css`) existed but was never wired in, so the first load on-device showed plain black-and-white unstyled HTML. Fixed in commit `3ae739f` (see the plan's Task 25 section for the full story). Confirmed via a follow-up screenshot that the fix resolved it — fieldsets, buttons, and inputs all render with their intended (if visually minimal/functional) styling.
- **Setup screen is fully usable on-device**: player add flow, "Someone must go down" toggle with its explanatory hint, starting hand size section, and the disabled-with-reason "Start session" button all render and read correctly on the tablet's screen.

## What was attempted but blocked

- **"Add to Home screen" / standalone install**: Chrome does offer an **"Install app"** option (confirming the manifest is being recognized as a PWA candidate at all), but the option is **blocked** — greyed out / non-functional on this device. Not diagnosed further at the user's request; full-screen-in-browser was judged an acceptable fallback for now rather than chasing the install-eligibility failure. **This is the core spec assumption ("an installable... PWA") and remains unverified.**
- **Offline/airplane-mode persistence test** (score a session → airplane mode → force-close → reopen → confirm data survives): **not performed.** Deferred by the user's explicit choice once install was blocked, rather than attempted in a plain browser tab as a fallback. This is the single most safety-critical check in the whole plan (autosave/resume only matters if data actually survives an offline force-close) and **remains unverified on real hardware.**
- **Firefox for Android**: not tested — the Chrome install-block was already a stopping point for this session.

## Environment constraints (specific to this device)

This tablet is configured under a family/parental-control profile (it's the user's son's device), which blocked two of the three planned routes to a proper HTTPS test environment:

1. **USB debugging**: Developer Options could not be enabled — blocked by the supervision profile.
2. **Installing a local trusted CA** (mkcert): a certificate was generated and downloadable, but Android's "Install a certificate" flow was also blocked by the same profile.
3. **GitHub Pages** (used successfully): the only one of the three that didn't require any on-device permission change, since it's a real, already-trusted public HTTPS certificate.

These constraints are specific to this particular tablet's account setup, not a property of the app or the Samsung A9 hardware in general — a differently-configured device (or an admin-mode session on this one) would likely not hit either block.

## Known gap this test surfaced and fixed

- CSS files not wired into `main.js` (see above) — fixed, commit `3ae739f`.
- `vite.config.js` needed a configurable base path (`VITE_BASE` env var) to support the temporary GitHub Pages subpath deployment without changing the app's real (root-path) deployment target — fixed, commit `d85c098`. Confirmed the default build (`VITE_BASE` unset) is byte-identical in behavior to before this change.

## Outstanding before this can be considered a real pass

1. **Diagnose why "Install app" is blocked on this device** — could be the parental-control profile itself restricting PWA installs specifically (plausible, given it blocks Developer Options and CA installs too), or could be a genuine manifest/service-worker issue independent of the device restrictions. Not distinguished yet.
2. **The offline/airplane-mode/force-close data-survival test has not been run on real hardware at all.** This is the spec's central promise and is currently verified only by the execution-based simulation in Review Gate 4 (real store + real actions + `fake-indexeddb`, not a real browser's IndexedDB implementation or a real service worker lifecycle).
3. Firefox for Android untested.
4. Consider testing on a different Android device (without parental controls) to separate "is this an app problem" from "is this a this-specific-tablet problem" for the install-block.
