// Event list in the sidebar, plus the slide-out drawer behavior on small screens.

import { el, formatDateRange } from './util.js';
import { isHidden, setHidden, showAll, hiddenCount } from './hiddenEvents.js';

const list = document.getElementById('event-list');
const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menu-btn');
const scrim = document.getElementById('scrim');
const filter = document.getElementById('event-filter');
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
          el('span', { class: 'event-link-date', text: formatDateRange(event.startDate, event.endDate) }),
        ),
      ),
    ),
  );
}

/**
 * The "Filter events" panel: one checkbox per event (checked = shown).
 * Built once so focus isn't lost while ticking boxes; onChange() runs after every change.
 */
export function initEventFilter(events, onChange) {
  if (events.length < 2) return; // nothing worth filtering

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

  filterReset.addEventListener('click', () => {
    showAll();
    for (const box of filterList.querySelectorAll('input')) box.checked = true;
    syncFilterStatus(events);
    onChange();
  });

  filter.hidden = false;
  syncFilterStatus(events);
}

function syncFilterStatus(events) {
  const count = hiddenCount(events);
  filterStatus.textContent = count ? `${count} hidden` : '';
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
