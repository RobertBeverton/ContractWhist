import 'fake-indexeddb/auto';

// jsdom (still true as of 29.1.1) doesn't implement <dialog>'s
// showModal()/close() (they're no-ops that throw "not implemented"). Stub
// them globally so components using createConfirmDialog() work in tests
// without every call site having to grab a reference to the dialog and
// stub it before the first open() — which isn't possible when the dialog
// is created lazily inside a click handler (see src/screens/setup.js's
// remove-player button). Lives here rather than per-test because Tasks 3
// and 4 (scorer.js, main.js) wire the same confirmDialog component into
// their own confirm() call sites and will hit this identical gap.
// Individual tests may still override these on a specific element if they
// need to assert open()/close() were called.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
