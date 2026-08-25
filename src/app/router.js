/**
 * Render the active screen into the root element.
 * `screens` maps a screen name to a render function returning an element.
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
    }
  };
}
