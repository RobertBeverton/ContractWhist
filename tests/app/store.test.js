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
