// Search results in the main area: matching memories grouped by event.

import { el } from './util.js';
import { renderMemoryGrid } from './eventView.js';
import { eventHash } from './sidebar.js';

/**
 * scopeEvent: the event currently open in the URL, or null. When there is one, a
 *             toggle lets the visitor search all events or only that one.
 * scope:      'all' | 'event' (what was actually searched)
 */
export function renderSearchResults({
  query, terms, results, events, scopeEvent, scope, hiddenCount, onScopeChange,
}) {
  const count = results.length;
  const title = count
    ? `${count} ${count === 1 ? 'memory matches' : 'memories match'} “${query}”`
    : `No memories match “${query}”`;

  return el('section', { class: 'results', 'aria-labelledby': 'results-title' },
    el('header', { class: 'results-head' },
      el('h1', { class: 'results-title', id: 'results-title', text: title }),
      scopeEvent && renderScope(scopeEvent, scope, onScopeChange),
      hiddenCount > 0 && el('p', {
        class: 'results-note',
        text: `${hiddenCount} hidden ${hiddenCount === 1 ? 'event is' : 'events are'} not included.`,
      }),
    ),
    count
      ? renderResults(results, events, terms, scope)
      : el('p', {
        class: 'empty',
        text: scope === 'event'
          ? 'Nothing in this event. Try searching all events.'
          : 'Check the spelling or try fewer words.',
      }),
  );
}

function renderScope(scopeEvent, scope, onScopeChange) {
  const option = (label, value) => el('button', {
    type: 'button',
    title: label,
    'aria-pressed': String(scope === value),
    onclick: () => onScopeChange(value),
    text: label,
  });
  return el('div', { class: 'scope', role: 'group', 'aria-label': 'Search in' },
    option('All events', 'all'),
    option(scopeEvent.name, 'event'),
  );
}

function renderResults(results, events, terms, scope) {
  // One event: no need for a heading, the toggle already says where we searched.
  if (scope === 'event') return renderMemoryGrid(results, terms);

  const byEvent = new Map();
  for (const memory of results) {
    if (!byEvent.has(memory.eventId)) byEvent.set(memory.eventId, []);
    byEvent.get(memory.eventId).push(memory);
  }

  // `events` is already newest first, so groups follow the sidebar order.
  return el('div', { class: 'result-groups' },
    events.filter((event) => byEvent.has(event.id)).map((event) =>
      el('section', { class: 'result-group' },
        el('h2', { class: 'result-group-title' },
          el('a', { href: eventHash(event.id), text: event.name }),
        ),
        renderMemoryGrid(byEvent.get(event.id), terms),
      ),
    ),
  );
}
