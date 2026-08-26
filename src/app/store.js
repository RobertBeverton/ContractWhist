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
