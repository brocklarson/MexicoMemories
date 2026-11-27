// The "Add memory" dialog.

import { addMemory, MAX_MEMORY_LENGTH } from './data.js';
import { showToast } from './util.js';

const dialog = document.getElementById('memory-dialog');
const form = document.getElementById('memory-form');
const textarea = document.getElementById('memory-text');
const counter = document.getElementById('memory-counter');
const subtitle = document.getElementById('memory-dialog-event');
const cancelButton = document.getElementById('memory-cancel');

let current = null; // { event, onSaved } while the dialog is open

export function initMemoryDialog() {
  textarea.maxLength = MAX_MEMORY_LENGTH;
  textarea.addEventListener('input', updateCounter);
  cancelButton.addEventListener('click', () => dialog.close());

  // Clicking the dimmed backdrop (outside the form) closes the dialog.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await addMemory({ eventId: current.event.id, text: textarea.value });
    } catch (error) {
      showToast(error.message);
      return;
    }
    dialog.close();
    showToast('Memory added.');
    current.onSaved();
  });
}

export function openMemoryDialog(event, onSaved) {
  current = { event, onSaved };
  subtitle.textContent = event.name;
  textarea.value = '';
  updateCounter();
  dialog.showModal();
  textarea.focus();
}

function updateCounter() {
  counter.textContent = `${textarea.value.length} / ${MAX_MEMORY_LENGTH}`;
}
