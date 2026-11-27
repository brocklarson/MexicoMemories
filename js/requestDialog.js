// The "Suggest an edit" / "Request deletion" dialog. Both send a request to the admin.

import { createRequest, MAX_MEMORY_LENGTH, MAX_REASON_LENGTH } from './data.js';
import { showToast } from './util.js';

const dialog = document.getElementById('request-dialog');
const form = document.getElementById('request-form');
const title = document.getElementById('request-dialog-title');
const original = document.getElementById('request-original');
const label = document.getElementById('request-label');
const textarea = document.getElementById('request-text');
const counter = document.getElementById('request-counter');
const error = document.getElementById('request-error');
const submit = document.getElementById('request-submit');
const cancel = document.getElementById('request-cancel');

let current = null; // { kind, memory } while the dialog is open

export function initRequestDialog() {
  cancel.addEventListener('click', () => dialog.close());
  textarea.addEventListener('input', updateCounter);
  form.addEventListener('submit', handleSubmit);
}

/** kind: 'edit' or 'delete'. memory: { id, text } as shown on the card. */
export function openRequestDialog(kind, memory) {
  current = { kind, memory };
  const editing = kind === 'edit';
  error.textContent = '';

  title.textContent = editing ? 'Suggest an edit' : 'Request deletion';
  submit.textContent = editing ? 'Send suggestion' : 'Send request';
  label.textContent = editing ? 'Your suggested text' : 'Reason (optional)';
  textarea.required = editing;
  textarea.rows = editing ? 6 : 3;
  textarea.maxLength = editing ? MAX_MEMORY_LENGTH : MAX_REASON_LENGTH;
  textarea.value = editing ? memory.text : '';

  // Deleting shows the memory so it's clear which one is meant.
  original.hidden = editing;
  original.textContent = editing ? '' : memory.text;

  updateCounter();
  dialog.showModal();
  textarea.focus();
}

function updateCounter() {
  counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
}

async function handleSubmit(event) {
  event.preventDefault();
  error.textContent = '';
  submit.disabled = true;
  try {
    if (current.kind === 'edit' && textarea.value.trim() === current.memory.text.trim()) {
      throw new Error('Change the text before sending your suggestion.');
    }
    await createRequest({ memoryId: current.memory.id, kind: current.kind, text: textarea.value });
    dialog.close();
    showToast('Sent to the admin for review.');
  } catch (err) {
    error.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}
