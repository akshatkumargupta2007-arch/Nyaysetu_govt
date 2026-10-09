// Leaflet tooltips are HTML. Anything that came from data (names, complaint codes) is escaped first, so a name
// like <img onerror=...> can only ever show up as text.
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
