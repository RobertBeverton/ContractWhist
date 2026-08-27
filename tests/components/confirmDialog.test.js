// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createConfirmDialog } from '../../src/components/confirmDialog.js';

describe('createConfirmDialog', () => {
  it('renders the message and both buttons', () => {
    const { element } = createConfirmDialog({
      message: 'Remove Robert from the players list?',
      confirmLabel: 'Remove',
      onConfirm: () => {},
      onCancel: () => {},
    });
    document.body.append(element);

    expect(element.tagName).toBe('DIALOG');
    expect(element.textContent).toContain('Remove Robert from the players list?');
    const buttons = element.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect([...buttons].map((b) => b.textContent)).toEqual(['Cancel', 'Remove']);
  });

  it('calls onConfirm and closes when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    element.close = vi.fn();
    open();

    const confirmButton = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === 'End session',
    );
    confirmButton.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(element.close).toHaveBeenCalled();
  });

  it('calls onCancel and closes when the cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    element.close = vi.fn();
    open();

    const cancelButton = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === 'Cancel',
    );
    cancelButton.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(element.close).toHaveBeenCalled();
  });

  it('treats a native dialog "close" (e.g. Escape key) as cancel, not confirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm,
      onCancel,
    });
    document.body.append(element);
    element.showModal = vi.fn();
    open();

    element.dispatchEvent(new Event('close'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('removes itself from the DOM after closing via the confirm button', () => {
    const { element, open } = createConfirmDialog({
      message: 'End this session now?',
      confirmLabel: 'End session',
      onConfirm: () => {},
    });
    document.body.append(element);
    element.showModal = vi.fn();
    element.close = vi.fn(() => element.dispatchEvent(new Event('close')));
    open();

    const confirmButton = [...element.querySelectorAll('button')].find(
      (b) => b.textContent === 'End session',
    );
    confirmButton.click();

    expect(element.isConnected).toBe(false);
  });
});
