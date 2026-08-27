/**
 * Themed replacement for window.confirm(). Uses the native <dialog> element
 * for focus-trapping, Escape-to-cancel, and top-layer stacking — all for
 * free — while staying fully restylable with the app's own tokens, unlike
 * window.confirm() which renders browser chrome no CSS can reach.
 *
 * Usage mirrors the window.confirm() call sites this replaces:
 *   const { element, open } = createConfirmDialog({
 *     message: '...', confirmLabel: '...', onConfirm, onCancel,
 *   });
 *   document.body.append(element);
 *   open();
 *
 * The caller owns appending `element` to the DOM (once) and calling `open()`
 * each time the confirmation is needed — this matches every other component
 * in src/components/, which build DOM but don't manage their own mounting.
 *
 * @param {object} options
 * @param {string} options.message
 * @param {string} options.confirmLabel - e.g. "Remove", "End session"
 * @param {() => void} options.onConfirm
 * @param {() => void} [options.onCancel] - also fires on Escape/backdrop dismiss
 */
export function createConfirmDialog({ message, confirmLabel, onConfirm, onCancel }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';

  const messageEl = document.createElement('p');
  messageEl.className = 'confirm-dialog__message';
  messageEl.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'confirm-dialog__actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'primary';
  confirmButton.textContent = confirmLabel;

  // Tracks whether the dialog is closing because a button handled it
  // (confirm/cancel already ran) vs. a native dismissal (Escape key,
  // backdrop click via ::backdrop) that only fires the 'close' event —
  // without this flag, a button click would run onCancel/onConfirm AND
  // the close-event handler below, double-firing the callback.
  let resolved = false;

  cancelButton.addEventListener('click', () => {
    resolved = true;
    dialog.close();
    onCancel?.();
  });

  confirmButton.addEventListener('click', () => {
    resolved = true;
    dialog.close();
    onConfirm();
  });

  // Escape key and any other native dismissal path fire 'close' without
  // going through either button — treat that as Cancel, matching
  // window.confirm()'s behavior when dismissed without pressing OK.
  dialog.addEventListener('close', () => {
    if (resolved) {
      resolved = false;
      return;
    }
    onCancel?.();
  });

  actions.append(cancelButton, confirmButton);
  dialog.append(messageEl, actions);

  return {
    element: dialog,
    open: () => dialog.showModal(),
  };
}
