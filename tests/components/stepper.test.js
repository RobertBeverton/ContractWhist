// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createStepper } from '../../src/components/stepper.js';

function build(overrides = {}) {
  return createStepper({
    id: 'bid-p1',
    label: 'Bid',
    value: null,
    min: 0,
    max: 5,
    onChange: vi.fn(),
    ...overrides,
  });
}

describe('createStepper — lock against accidental edits', () => {
  it('is not locked when there is no value yet', () => {
    const el = build({ value: null });
    expect(el.dataset.locked).not.toBe('true');
    expect(el.querySelector('.stepper__button')?.disabled).not.toBe(true);
  });

  it('is locked by default once it has a value', () => {
    const el = build({ value: 2 });
    expect(el.dataset.locked).toBe('true');
  });

  it('disables both +/- buttons while locked', () => {
    const el = build({ value: 2 });
    const buttons = el.querySelectorAll('.stepper__button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });

  it('unlocks when the input is focused, re-enabling the buttons', () => {
    const el = build({ value: 2 });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    expect(el.dataset.locked).toBe('false');
    for (const button of el.querySelectorAll('.stepper__button')) {
      expect(button.disabled).toBe(false);
    }
  });

  it('re-locks when the input is blurred', () => {
    const el = build({ value: 2 });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    expect(el.dataset.locked).toBe('true');
    for (const button of el.querySelectorAll('.stepper__button')) {
      expect(button.disabled).toBe(true);
    }
  });

  it('does not fire onChange merely from locking/unlocking', () => {
    const onChange = vi.fn();
    const el = build({ value: 2, onChange });
    const input = el.querySelector('.stepper__input');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
