// Small shared helpers. No app logic lives here.

/**
 * Build a DOM element. Text is always inserted as text (never as HTML),
 * so user-written content can't inject markup.
 *
 * el('a', { href: '#', class: 'link' }, 'Label', otherNode)
 * Props: `class`, `text`, `onclick`-style handlers, or any attribute.
 * null / undefined / false props and children are skipped.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

/** "1 memory", "10 memories". */
export function memoryCountLabel(count) {
  return `${count} ${count === 1 ? 'memory' : 'memories'}`;
}

// Opens Google Maps with a pin at the coordinates. Returns null if they're missing.
export function mapsUrl(location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
}

// A pin dropped on a map has no place name, so show its coordinates instead.
export function locationLabel({ label, lat, lng }) {
  return label?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Reads "39.7392, -104.9903" (as copied from Google Maps). Returns { lat, lng } or null. */
export function parseCoordinates(text) {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

/** "Maya & Theo's Wedding" -> "maya-theo-s-wedding": the short name used in the page address. */
export function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Split a search query into lowercase words. A memory must contain every word to match. */
export function searchTerms(query) {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}

/** Returns text split into strings and <mark> elements, ready to pass to el() as children. */
export function highlight(text, terms) {
  if (!terms.length) return [text];
  const pattern = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
    .join('|');
  // With a capture group, split() puts the matches at the odd positions.
  return text
    .split(new RegExp(`(${pattern})`, 'gi'))
    .map((part, i) => (i % 2 ? el('mark', { text: part }) : part));
}

// Only allow http(s) links so a stored "javascript:" URL can never be rendered as a link.
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

let toastTimer;
export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
