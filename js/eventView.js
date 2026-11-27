// Main content area: the event header and its memory cards.

import {
  el, formatDateRange, mapsUrl, locationLabel, highlight, safeUrl, showToast,
} from './util.js';
import { icon } from './icons.js';

const DELETED_AUTHOR = '[deleted]';
const PREVIEW_NOTICE = 'Edit and deletion requests are coming soon.';

/** onEditEvent is only passed for the admin; without it there is no Edit button. */
export function renderEventView(event, memories, { onAddMemory, onEditEvent }) {
  return el('article', { class: 'event' },
    renderHeader(event, onEditEvent),
    renderMemories(memories, onAddMemory),
  );
}

export function renderMessage(title, body) {
  return el('div', { class: 'empty-state' },
    el('h1', { text: title }),
    el('p', { text: body }),
  );
}

function renderHeader(event, onEditEvent) {
  const albumUrl = safeUrl(event.albumUrl);
  const mapHref = mapsUrl(event.location);
  return el('header', { class: 'event-head' },
    el('div', { class: 'event-head-top' },
      el('h1', { class: 'event-title', text: event.name }),
      onEditEvent && el('button', { type: 'button', class: 'btn ghost', onclick: onEditEvent }, icon('edit'), 'Edit event'),
    ),
    el('p', { class: 'event-dates', text: formatDateRange(event.startDate, event.endDate) }),
    el('ul', { class: 'event-links' },
      mapHref && el('li', {}, externalLink(mapHref, 'pin', locationLabel(event.location))),
      albumUrl && el('li', {}, externalLink(albumUrl, 'photos', 'Photo album')),
    ),
  );
}

function externalLink(href, iconName, label) {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, icon(iconName), label);
}

function renderMemories(memories, onAddMemory) {
  return el('section', { 'aria-labelledby': 'memories-heading' },
    el('div', { class: 'memories-bar' },
      el('h2', { id: 'memories-heading', text: 'Memories' }),
      el('button', { type: 'button', class: 'btn primary', onclick: onAddMemory }, icon('plus'), 'Add memory'),
    ),
    memories.length
      ? renderMemoryGrid(memories)
      : el('p', { class: 'empty', text: 'No memories yet. Add the first one.' }),
  );
}

/** A grid of memory cards. Pass search `terms` to highlight matches. Also used by search results. */
export function renderMemoryGrid(memories, terms = []) {
  return el('ul', { class: 'memory-grid' }, memories.map((memory) => renderMemory(memory, terms)));
}

function renderMemory(memory, terms) {
  return el('li', {},
    el('article', { class: 'memory' },
      el('p', { class: 'memory-text' }, highlight(memory.text, terms)),
      el('footer', { class: 'memory-foot' },
        memory.authorName
          ? el('span', { class: 'memory-author' }, highlight(memory.authorName, terms))
          : el('span', { class: 'memory-author is-deleted', text: DELETED_AUTHOR }),
        renderMenu(),
      ),
    ),
  );
}

// "More options": suggest an edit or request deletion. Wired up with sign-in later.
function renderMenu() {
  const menu = el('details', { class: 'menu' });
  const item = (label) => el('button', {
    type: 'button',
    text: label,
    onclick: () => {
      menu.open = false;
      showToast(PREVIEW_NOTICE);
    },
  });

  menu.append(
    el('summary', { class: 'icon-btn', 'aria-label': 'More options' }, icon('more')),
    el('div', { class: 'menu-list' }, item('Suggest an edit'), item('Request deletion')),
  );
  return menu;
}

// Close any open "More options" menu when clicking elsewhere or pressing Escape.
document.addEventListener('click', (event) => {
  for (const menu of document.querySelectorAll('.menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  for (const menu of document.querySelectorAll('.menu[open]')) menu.open = false;
});
