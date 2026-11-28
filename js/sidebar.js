// Event list in the sidebar, plus the slide-out drawer behavior on small screens.

import { el, memoryCountLabel } from './util.js';
import { isHidden, setHidden, showAll, hiddenCount } from './hiddenEvents.js';

const list = document.getElementById('event-list');
const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menu-btn');
const scrim = document.getElementById('scrim');
const filter = document.getElementById('event-filter'); // the checkbox panel
const filterToggle = document.getElementById('filter-toggle'); // small button beside "Events"
const filterList = document.getElementById('filter-list');
const filterStatus = document.getElementById('filter-status');
const filterReset = document.getElementById('filter-reset');

export function eventHash(id) {
  return `#/event/${encodeURIComponent(id)}`;
}

/** Lists the events this visitor hasn't hidden. */
export function renderEventList(events, activeId) {
  const visible = events.filter((event) => !isHidden(event.id));
  if (!visible.length) {
    list.replaceChildren(
      el('li', {
        class: 'event-list-empty',
        text: events.length ? 'All events are hidden. Use the filter above to show some.' : 'No events yet.',
      }),
    );
    return;
  }

  list.replaceChildren(
    ...visible.map((event) =>
      el('li', {},
        el('a', {
          class: 'event-link',
          href: eventHash(event.id),
          'aria-current': event.id === activeId ? 'page' : null,
        },
          el('span', { class: 'event-link-name', text: event.name }),
          event.family && el('span', { class: 'event-link-family', text: event.family }),
          el('span', { class: 'event-link-count', text: memoryCountLabel(event.memoryCount) }),
        ),
      ),
    ),
  );
}

/**
 * The filter: a small button beside "Events" opens a panel with one checkbox per event
 * (checked = shown). Built once so focus isn't lost while ticking boxes;
 * onChange() runs after every change.
 */
export function initEventFilter(events, onChange) {
  setFilterOpen(false);
  filterToggle.hidden = events.length < 2;
  if (events.length < 2) return; // nothing worth filtering

  // Assigned (not added) so signing out and back in doesn't stack up handlers.
  filterToggle.onclick = () => setFilterOpen(filter.hidden);

  filterList.replaceChildren(
    ...events.map((event) =>
      el('li', {},
        el('label', { class: 'filter-item' },
          el('input', {
            type: 'checkbox',
            checked: !isHidden(event.id),
            onchange: (e) => {
              setHidden(event.id, !e.target.checked);
              syncFilterStatus(events);
              onChange();
            },
          }),
          el('span', { text: event.name }),
        ),
      ),
    ),
  );

  // Assigned (not added) so signing out and back in doesn't stack up handlers.
  filterReset.onclick = () => {
    showAll();
    for (const box of filterList.querySelectorAll('input')) box.checked = true;
    syncFilterStatus(events);
    onChange();
  };

  syncFilterStatus(events);
}

function setFilterOpen(open) {
  filter.hidden = !open;
  filterToggle.setAttribute('aria-expanded', String(open));
}

// The badge on the button shows how many events are hidden.
function syncFilterStatus(events) {
  const count = hiddenCount(events);
  filterStatus.textContent = String(count);
  filterStatus.hidden = count === 0;
  filterToggle.setAttribute('aria-label', count ? `Filter events (${count} hidden)` : 'Filter events');
  filterReset.hidden = count === 0;
}

export function initDrawer() {
  menuButton.addEventListener('click', () => {
    setDrawer(!document.body.classList.contains('drawer-open'));
  });
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
}

export function closeDrawer() {
  setDrawer(false);
}

function setDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close events list' : 'Open events list');
  if (open) sidebar.querySelector('a')?.focus();
}
