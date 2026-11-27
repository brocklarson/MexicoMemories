// Entry point. Decides what to show:
//   signed out          -> the sign-in screens
//   opened a reset link -> "choose a new password"
//   signed in           -> the site (events, memories, search, account page)
//
// The site uses hash routing because GitHub Pages has no server routing:
//   #/event/<id>  an event    #/account  the account page    #/requests  admin review page
// Search isn't part of the URL. While a search is active it replaces the page;
// clearing the box (or picking an event) brings the page back.

import {
  getEvents, getEvent, getMemories, searchMemories, getMyProfile, getPendingRequests, countPendingRequests,
} from './data.js';
import { isConfigured, linkType, linkError } from './supabase.js';
import { onAuthChange, getSession, signOut } from './auth.js';
import { showAuth } from './authView.js';
import { renderAccount } from './accountView.js';
import { renderRequests } from './requestsView.js';
import { initAccountMenu, setAccountName, setRequestsBadge } from './accountMenu.js';
import { initTheme } from './theme.js';
import { initDrawer, closeDrawer, initEventFilter, renderEventList, eventHash } from './sidebar.js';
import { isHidden } from './hiddenEvents.js';
import { renderEventView, renderMessage } from './eventView.js';
import { renderSearchResults } from './searchView.js';
import { initMemoryDialog, openMemoryDialog } from './memoryDialog.js';
import { initEventDialog, openEventDialog } from './eventDialog.js';
import { initRequestDialog } from './requestDialog.js';
import { initSearch, resetSearch, MIN_QUERY_LENGTH } from './search.js';
import { el, searchTerms } from './util.js';

const APP_NAME = 'Mexico Memories';
const ACCOUNT_HASH = '#/account';
const REQUESTS_HASH = '#/requests';
const main = document.getElementById('main');
const searchStatus = document.getElementById('search-status'); // read aloud by screen readers
const addEventButton = document.getElementById('add-event'); // shown to the admin only

// 'loading' -> 'auth' (signed out) | 'reset' (choosing a new password) | 'app' (signed in)
let mode = 'loading';
let recovering = linkType === 'recovery'; // true until a reset link's new password is saved
let currentUserId = null;
let currentEmail = '';
let profile = null; // { displayName, isAdmin } of the signed-in person

let events = [];
let latestRender = 0;
let routeEventId = null; // the event chosen in the URL (null on the account page)
let query = '';
let scope = 'all'; // 'all' or 'event' (only the event in the URL)

const isSearching = () => query.length >= MIN_QUERY_LENGTH;
// A page that isn't an event: 'account', 'requests', or null.
const currentPage = () => ({ [ACCOUNT_HASH]: 'account', [REQUESTS_HASH]: 'requests' })[location.hash] ?? null;
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
  profile = null;
  latestRender += 1; // cancel any page still loading
  endSearch();
  events = [];
  addEventButton.hidden = true;
  setRequestsBadge({ isAdmin: false, count: 0 });
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
  currentEmail = session.user.email ?? '';
  setState('signed-in');
  main.replaceChildren(el('p', { class: 'empty', text: 'Loading…' }));

  try {
    const [loadedProfile, loadedEvents] = await Promise.all([getMyProfile(session.user.id), getEvents()]);
    if (mode !== 'app') return; // signed out while loading
    profile = loadedProfile;
    events = loadedEvents;
  } catch {
    if (mode !== 'app') return;
    main.replaceChildren(renderMessage('Couldn’t load events', 'Check your connection and refresh the page.'));
    return;
  }

  setAccountName(profile.displayName);
  addEventButton.hidden = !profile.isAdmin;
  initEventFilter(events, onFilterChange);
  render();
  refreshRequestsBadge();
}

// ---------------------------------------------------------------------------
// Pages: events, account, search
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
  const page = currentPage();
  routeEventId = page ? null : resolveEventId();
  const searching = isSearching();

  renderEventList(events, searching || page ? null : routeEventId);
  if (closeMenu) closeDrawer();
  searchStatus.textContent = '';

  try {
    if (searching) await showSearch(thisRender);
    else if (page === 'account') showAccount();
    else if (page === 'requests') await showRequests(thisRender);
    else await showEvent(thisRender);
  } catch {
    if (thisRender !== latestRender) return;
    main.replaceChildren(renderMessage('Couldn’t load this page', 'Check your connection and try again.'));
  }

  if (resetScroll && thisRender === latestRender) window.scrollTo(0, 0);
}

function showAccount() {
  document.title = `Account · ${APP_NAME}`;
  main.replaceChildren(
    renderAccount({
      userId: currentUserId,
      email: currentEmail,
      displayName: profile.displayName,
      onDisplayNameSaved: (name) => {
        profile.displayName = name;
        setAccountName(name);
      },
    }),
  );
}

async function showRequests(thisRender) {
  document.title = `Requests · ${APP_NAME}`;
  if (!profile?.isAdmin) {
    main.replaceChildren(renderMessage('Admin only', 'Only the admin can review requests.'));
    return;
  }
  const requests = await getPendingRequests();
  if (thisRender !== latestRender) return;
  setRequestsBadge({ isAdmin: true, count: requests.length });
  main.replaceChildren(
    renderRequests(requests, { onCountChange: (count) => setRequestsBadge({ isAdmin: true, count }) }),
  );
}

// Admin only: show how many requests are waiting. A failure just leaves the count out.
async function refreshRequestsBadge() {
  if (!profile?.isAdmin) return;
  try {
    const count = await countPendingRequests();
    if (mode === 'app') setRequestsBadge({ isAdmin: true, count });
  } catch { /* the review page itself will show an error if the problem persists */ }
}

async function showEvent(thisRender) {
  if (!routeEventId) {
    main.replaceChildren(
      events.length
        ? renderMessage('All events are hidden', 'Open the events list and use the filter to show some.')
        : renderMessage(
          'No events yet',
          profile?.isAdmin
            ? 'Use the + button next to Events to add the first one.'
            : 'Events will appear here once the admin adds them.',
        ),
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
      onEditEvent: profile?.isAdmin ? () => openEventDialog({ event, onSaved: afterEventSaved }) : null,
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

// After the admin adds or edits an event: reload the list and show that event.
async function afterEventSaved(id) {
  events = await getEvents();
  initEventFilter(events, onFilterChange);
  endSearch();
  const target = eventHash(id);
  if (location.hash === target) render({ resetScroll: true });
  else location.hash = target; // the hashchange renders
}

// The sidebar list updates in place. The main area only needs a redraw when it
// depends on which events are visible (search results, or the "all hidden" message).
function onFilterChange() {
  renderEventList(events, isSearching() || currentPage() ? null : routeEventId);
  if (isSearching() || (!routeEventId && !currentPage())) render({ closeMenu: false });
}

function endSearch() {
  query = '';
  scope = 'all';
  resetSearch();
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
  endSearch();
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
  initEventDialog();
  initRequestDialog();
  initSearch(onQueryChange);
  initAccountMenu(signOut);
  addEventButton.addEventListener('click', () => openEventDialog({ onSaved: afterEventSaved }));
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
