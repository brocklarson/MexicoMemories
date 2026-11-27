// Light/dark toggle. The initial theme is applied by the inline script in index.html;
// this module wires up the button and remembers the choice.

const button = document.getElementById('theme-btn');
const root = document.documentElement;

export function initTheme() {
  syncLabel();
  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    syncLabel();
  });
}

function syncLabel() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to ${next} mode`);
}
