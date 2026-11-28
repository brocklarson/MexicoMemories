// The "Add event" / "Edit event" dialog (admin only; the database enforces that too).

import { createEvent, updateEvent } from './data.js';
import { parseCoordinates, showToast } from './util.js';

const dialog = document.getElementById('event-dialog');
const form = document.getElementById('event-form');
const title = document.getElementById('event-dialog-title');
const nameInput = document.getElementById('event-name');
const family = document.getElementById('event-family');
const album = document.getElementById('event-album');
const coords = document.getElementById('event-coords');
const place = document.getElementById('event-place');
const error = document.getElementById('event-error');
const submit = document.getElementById('event-submit');
const cancel = document.getElementById('event-cancel');

let current = null; // { event, onSaved } while the dialog is open. event is null when adding.

export function initEventDialog() {
  cancel.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', handleSubmit);
}

/**
 * event:   the event to edit, or omit to add a new one
 * onSaved: called with the event's id after it is saved
 */
export function openEventDialog({ event = null, onSaved }) {
  current = { event, onSaved };
  form.reset();
  error.textContent = '';
  title.textContent = event ? 'Edit event' : 'Add event';
  submit.textContent = event ? 'Save changes' : 'Add event';

  if (event) {
    nameInput.value = event.name;
    family.value = event.family ?? '';
    album.value = event.albumUrl ?? '';
    coords.value = event.location ? `${event.location.lat}, ${event.location.lng}` : '';
    place.value = event.location?.label ?? '';
  }

  dialog.showModal();
  nameInput.focus();
}

// Reads and checks the form. Throws an Error with a message the admin can act on.
function readFields() {
  const coordsText = coords.value.trim();
  const label = place.value.trim();
  let location = null;
  if (coordsText) {
    const point = parseCoordinates(coordsText);
    if (!point) throw new Error('Enter coordinates like 39.7392, -104.9903.');
    location = { label: label || null, ...point };
  } else if (label) {
    throw new Error('Add coordinates so the place can link to Google Maps, or clear the place name.');
  }

  return {
    name: nameInput.value.trim(),
    family: family.value.trim() || null,
    albumUrl: album.value.trim() || null,
    location,
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  error.textContent = '';
  submit.disabled = true;
  try {
    const fields = readFields();
    const editing = Boolean(current.event);
    const id = editing ? await updateEvent(current.event.id, fields) : await createEvent(fields);
    dialog.close();
    showToast(editing ? 'Event updated.' : 'Event added.');
    await current.onSaved(id);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}
