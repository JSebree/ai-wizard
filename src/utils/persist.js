const VERSION = 'v1'; // bump if shape changes
export const key = (name) => `sceneme:${VERSION}:${name}`;

export function load(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function save(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify(value)); } catch {}
}

export function debounce(fn, ms=300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}