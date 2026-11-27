// The search box in the top bar. This module only handles the input;
// main.js decides what to show for a query.
//
// On phones the box is hidden behind a search button and opens over the top bar.

export const MIN_QUERY_LENGTH = 2;

const topbar = document.getElementById('topbar');
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const openButton = document.getElementById('search-open');
const closeButton = document.getElementById('search-close');

let timer;

/** onQuery(text) is called, debounced, with the trimmed text whenever it changes. */
export function initSearch(onQuery) {
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => onQuery(input.value.trim()), 300); // searching now asks the server
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    onQuery(input.value.trim());
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !input.value) return;
    event.preventDefault();
    resetSearch();
    onQuery('');
  });

  openButton.addEventListener('click', () => {
    topbar.classList.add('search-open');
    input.focus();
  });

  closeButton.addEventListener('click', () => {
    resetSearch();
    onQuery('');
  });
}

/** Empty the box and close it on phones. Does not call onQuery. */
export function resetSearch() {
  clearTimeout(timer);
  input.value = '';
  topbar.classList.remove('search-open');
}
