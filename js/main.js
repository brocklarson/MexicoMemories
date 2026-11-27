// Entry point. Decides what to show:
//   signed out        -> the sign-in screens
//   opened a reset link -> "choose a new password"
//   signed in         -> the site (events, memories, search)
//
// The site uses hash routing (#/event/<id>) because GitHub Pages has no server routing.
// Search isn't part of the URL. While a search is active it replaces the event view;
// clearing the box (or picking an event) brings the event view back.

import { getEvents, getEvent, getMemories, searchMemories, getMyProfile } from './data.js';
import { isConfigured, linkType, linkError } from './supabase.js';
import { onAuthChange, getSession, signOut } from './auth.js';
import { showAuth } from './authView.js';
import { initAccountMenu, setAccountName } from './accountMenu.js';
import { initTheme } from './theme.js';
import { initDrawer, closeDrawer, initEventFilter, renderEventList, eventHash } from './sidebar.js';
import { isHidden } from './hiddenEvents.js';
import { renderEventView, renderMessage } from './eventView.js';
import { renderSearchResults } from './searchView.js';
import { initMemoryDialog, openMemoryDialog } from './memoryDialog.js';
import { initSearch, resetSearch, MIN_QUERY_LENGTH } from './search.js';
import { el, searchTerms } from './util.js';

const APP_NAME = 'Our Memories';
const main = document.getElementById('main');
const searchStatus = document.getElementById('search-status'); // read aloud by screen readers

// 'loading' -> 'auth' (signed out) | 'reset' (choosing a new password) | 'app' (signed in)
let mode = 'loading';
let recovering = linkType === 'recovery'; // true until a reset link's new password is saved
let currentUserId = null;

let events = [];
let latestRender = 0;
let routeEventId = null; // the event chosen in the URL
let query = '';
let scope = 'all'; // 'all' or 'event' (only the event in the URL)

const isSearching = () => query.length >= MIN_QUERY_LENGTH;
const setState = (state) => { document.body.dataset.state = state; };

// ---------------------------------------------------------------------------
// Signed in / signed out
// ---------------------------------------------------------------------------

function handleAuthEvent(event, session) {
  // Deferred: Supabase asks that its callback not call back into Supabase directly.
  setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (!session) {
      recovering = false;
      showSignedOut();
    } else if (recovering) {
      showResetPassword();
    } else {
      enterApp(session);
    }
  }, 0);
}

let linkErrorShown = false;

function showSignedOut() {
  if (mode === 'auth') return;
  mode = 'auth';
  currentUserId = null;
  latestRender += 1; // cancel any page still loading
  query = '';
  scope = 'all';
  events = [];
  resetSearch();
  setState('signed-out');
  document.title = `Sign in · ${APP_NAME}`;

  let notice = '';
  if (linkError && !linkErrorShown) {
    notice = 'That link is invalid or has expired. Request a new one.';
    linkErrorShown = true;
    history.replaceState(null, '', location.pathname + location.search);
  }
  showAuth(main, { view: notice ? 'forgot' : 'signin', notice });
}

function showResetPassword() {
  if (mode === 'reset') return;
  mode = 'reset';
  setState('recovery');
  document.title = `New password · ${APP_NAME}`;
  showAuth(main, { view: 'reset', onPasswordUpdated: finishPasswordReset });
}

async function finishPasswordReset() {
  recovering = false;
  mode = 'loading';
  const session = await getSession();
  if (session) enterApp(session);
  else showSignedOut();
}

async function enterApp(session) {
  // Supabase can repeat "signed in" (token refresh, tab focus). Ignore repeats.
  if (mode === 'app' && currentUserId === session.user.id) return;
  mode = 'app';
  currentUserId = session.user.id;
  setState('signed-in');
  main.replaceChildren(el('p', { class: 'empty', text: 'Loading…' }));

  try {
    const [profile, loadedEvents] = await Promise.all([getMyProfile(session.user.id), getEvents()]);
    if (mode !== 'app') return; // signed out while loading
    events = loadedEvents;
    setAccountName(profile.displayName);
  } catch {
    if (mode !== 'app') return;
    main.replaceChildren(renderMessage('Couldn’t load events', 'Check your connection and refresh the page.'));
    return;
  }

  initEventFilter(events, onFilterChange);
  render();
}

// ---------------------------------------------------------------------------
// Events and search
// ---------------------------------------------------------------------------

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

  try {
    if (searching) await showSearch(thisRender);
    else await showEvent(thisRender);
  } catch {
    if (thisRender !== latestRender) return;
    main.replaceChildren(renderMessage('Couldn’t load this page', 'Check your connection and try again.'));
  }

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
  if (!link || !query || mode !== 'app') return;
  query = '';
  scope = 'all';
  resetSearch();
  // Same hash means no hashchange will fire, so render here. Otherwise hashchange renders.
  if (link.hash === location.hash) render({ resetScroll: true });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function start() {
  initTheme();
  initDrawer();
  initMemoryDialog();
  initSearch(onQueryChange);
  initAccountMenu(signOut);
  window.addEventListener('hashchange', () => {
    if (mode === 'app') render({ resetScroll: true });
  });

  if (!isConfigured) {
    setState('signed-out');
    main.replaceChildren(
      renderMessage('Almost ready', 'Add your Supabase publishable key to js/config.js to connect the site.'),
    );
    return;
  }

  onAuthChange(handleAuthEvent);
}

start();
