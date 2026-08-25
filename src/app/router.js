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
