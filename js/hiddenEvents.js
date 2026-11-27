// Which events this visitor has chosen to hide. Saved in this browser only (localStorage),
// so it is remembered on this device but isn't shared with other devices or other people.
//
// We store the HIDDEN ids rather than the shown ones, so new events appear by default.

const KEY = 'hiddenEvents';
const hidden = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set(); // storage blocked or corrupted: start with nothing hidden
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...hidden]));
  } catch {
    // Storage can be blocked (private mode); the choice still applies until the page closes.
  }
}

export function isHidden(eventId) {
  return hidden.has(eventId);
}

export function setHidden(eventId, value) {
  if (value) hidden.add(eventId);
  else hidden.delete(eventId);
  save();
}

export function showAll() {
  hidden.clear();
  save();
}

/** How many of the given events are hidden (ignores saved ids of events that no longer exist). */
export function hiddenCount(events) {
  return events.filter((event) => hidden.has(event.id)).length;
}
