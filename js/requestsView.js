// The admin's review page (#/requests): each open request with Approve and Deny.

import { el } from './util.js';
import { resolveRequest } from './data.js';

const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const DELETED_PERSON = '[deleted]';

/**
 * requests:        open requests from getPendingRequests()
 * onCountChange(n): called with how many are left after each decision
 */
export function renderRequests(requests, { onCountChange }) {
  const list = el('ul', { class: 'request-list' });
  const page = el('article', { class: 'requests' },
    el('h1', { class: 'account-title', text: 'Review requests' }),
    list,
  );

  const empty = el('p', { class: 'empty', text: 'No requests waiting. You’re all caught up.' });
  const refresh = () => {
    const left = list.children.length;
    empty.hidden = left > 0;
    onCountChange(left);
  };

  for (const request of requests) {
    const item = el('li', {}, renderRequest(request, async (approve) => {
      await resolveRequest(request.id, approve);
      item.remove();
      refresh();
    }));
    list.append(item);
  }
  page.append(empty);
  empty.hidden = requests.length > 0;
  return page;
}

function renderRequest(request, decide) {
  const editing = request.kind === 'edit';
  const error = el('p', { class: 'form-error', role: 'alert' });

  const buttons = [
    el('button', { type: 'button', class: 'btn ghost', text: 'Deny', onclick: () => run(false) }),
    el('button', {
      type: 'button',
      class: editing ? 'btn primary' : 'btn danger',
      text: editing ? 'Approve edit' : 'Delete memory',
      onclick: () => run(true),
    }),
  ];

  async function run(approve) {
    error.textContent = '';
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await decide(approve);
    } catch (err) {
      error.textContent = err.message;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  const meta = [request.requesterName ?? DELETED_PERSON, request.eventName, date.format(new Date(request.createdAt))]
    .filter(Boolean).join(' · ');

  return el('article', { class: 'request' },
    el('header', { class: 'request-head' },
      el('h2', { text: editing ? 'Edit suggestion' : 'Deletion request' }),
      el('p', { class: 'request-meta', text: meta }),
    ),
    block(editing ? 'Current text' : 'Memory', request.memoryText,
      request.memoryAuthor ?? DELETED_PERSON),
    editing && block('Suggested text', request.newText, null, true),
    !editing && request.reason && block('Reason', request.reason),
    error,
    el('div', { class: 'request-actions' }, ...buttons),
  );
}

function block(heading, text, byline = null, highlighted = false) {
  return el('div', { class: highlighted ? 'request-block is-new' : 'request-block' },
    el('h3', { text: byline ? `${heading} (by ${byline})` : heading }),
    el('p', { class: 'memory-text', text }),
  );
}
