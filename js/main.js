// Entry point: loads events, handles hash routing (#/event/<id>), renders the page.
// GitHub Pages has no server routing, so navigation lives in the URL hash.
//
// Search is not part of the URL. While a search is active it replaces the event view;
// clearing the box (or picking an event) brings the event view back.

import { getEvents, getEvent, getMemories, searchMemories } from './data.js';
import { initTheme } from './theme.js';
import { initDrawer, closeDrawer, initEventFilter, renderEventList, eventHash } from './sidebar.js';
import { isHidden } from './hiddenEvents.js';
import { renderEventView, renderMessage } from './eventView.js';
import { renderSearchResults } from './searchView.js';
import { initMemoryDialog, openMemoryDialog } from './memoryDialog.js';
import { initSearch, resetSearch, MIN_QUERY_LENGTH } from './search.js';
import { searchTerms } from './util.js';

const APP_NAME = 'Our Memories';
const main = document.getElementById('main');
const searchStatus = document.getElementById('search-status'); // read aloud by screen readers

let events = [];
let latestRender = 0;
let routeEventId = null; // the event chosen in the URL
let query = '';
let scope = 'all'; // 'all' or 'event' (only the event in the URL)

const isSearching = () => query.length >= MIN_QUERY_LENGTH;

function parseEventId(hash) {
  const match = hash.match(/^#\/event\/(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function resolveEventId() {
  let id = parseEventId(location.hash);
  if (!id) {
    // No event chosen yet: open the newest one that isn't hidden.
    id = events.find((event) => !isHidden(event.id))?.id ?? null;
    if (id) history.replaceState(null, '', eventHash(id));
  }
  return id;
}

async function render({ resetScroll = false, closeMenu = true } = {}) {
  const thisRender = ++latestRender;
  routeEventId = resolveEventId();
  const searching = isSearching();

  renderEventList(events, searching ? null : routeEventId);
  if (closeMenu) closeDrawer();
  searchStatus.textContent = '';

  if (searching) await showSearch(thisRender);
  else await showEvent(thisRender);

  if (resetScroll && thisRender === latestRender) window.scrollTo(0, 0);
}

async function showEvent(thisRender) {
  if (!routeEventId) {
    main.replaceChildren(
      events.length
        ? renderMessage('All events are hidden', 'Open the events list and use Filter events to show some.')
        : renderMessage('No events yet', 'Events will appear here once the admin adds them.'),
    );
    return;
  }

  const [event, memories] = await Promise.all([getEvent(routeEventId), getMemories(routeEventId)]);
  if (thisRender !== latestRender) return; // a newer navigation took over

  if (!event) {
    document.title = APP_NAME;
    main.replaceChildren(renderMessage('Event not found', 'It may have been removed. Pick another event from the list.'));
    return;
  }

  document.title = `${event.name} · ${APP_NAME}`;
  main.replaceChildren(
    renderEventView(event, memories, {
      onAddMemory: () => openMemoryDialog(event, () => render()),
    }),
  );
}

async function showSearch(thisRender) {
  const scopeEvent = events.find((event) => event.id === routeEventId) ?? null;
  const searchedScope = scope === 'event' && scopeEvent ? 'event' : 'all';
  const found = await searchMemories({
    query,
    eventId: searchedScope === 'event' ? scopeEvent.id : null,
  });
  if (thisRender !== latestRender) return;

  // Searching all events skips the ones this visitor has hidden.
  const hiddenEvents = searchedScope === 'all' ? events.filter((event) => isHidden(event.id)) : [];
  const results = found.filter((memory) => !hiddenEvents.some((event) => event.id === memory.eventId));

  document.title = `Search · ${APP_NAME}`;
  main.replaceChildren(
    renderSearchResults({
      query,
      terms: searchTerms(query),
      results,
      events,
      scopeEvent,
      scope: searchedScope,
      hiddenCount: hiddenEvents.length,
      onScopeChange: (next) => {
        scope = next;
        render({ resetScroll: true });
      },
    }),
  );
  searchStatus.textContent = `${results.length} ${results.length === 1 ? 'memory' : 'memories'} found`;
}

// The sidebar list updates in place. The main area only needs a redraw when it
// depends on which events are visible (search results, or the "all hidden" message).
function onFilterChange() {
  renderEventList(events, isSearching() ? null : routeEventId);
  if (isSearching() || !routeEventId) render({ closeMenu: false });
}

function onQueryChange(next) {
  const wasSearching = isSearching();
  query = next;
  if (!isSearching()) scope = 'all';
  if (!wasSearching && !isSearching()) return; // too short to search, nothing on screen changes
  render({ resetScroll: true });
}

// Choosing an event from the sidebar or from search results ends the search.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || !query) return;
  query = '';
  scope = 'all';
  resetSearch();
  // Same hash means no hashchange will fire, so render here. Otherwise hashchange renders.
  if (link.hash === location.hash) render({ resetScroll: true });
});

async function start() {
  initTheme();
  initDrawer();
  initMemoryDialog();
  initSearch(onQueryChange);

  try {
    events = await getEvents();
  } catch {
    main.replaceChildren(renderMessage('Couldn’t load events', 'Check your connection and refresh the page.'));
    return;
  }

  initEventFilter(events, onFilterChange);
  window.addEventListener('hashchange', () => render({ resetScroll: true }));
  render();
}

start();
