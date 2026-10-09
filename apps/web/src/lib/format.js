// Western digits (0-9) in both languages, Indian digit grouping (1,23,456), India Standard Time.
const IN = new Intl.NumberFormat('en-IN');
export const num = (n) => (n === null || n === undefined ? '–' : IN.format(n));
export const pct = (n) => (n === null || n === undefined ? '–' : `${IN.format(n)}%`);

const TZ = 'Asia/Kolkata';
export function dateTime(iso, lang = 'en') {
  if (!iso) return '–';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}
export function dateOnly(iso, lang = 'en') {
  if (!iso) return '–';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** "3 h", "2 d 4 h": how long ago, short enough for a table cell. */
export function age(iso, lang = 'en') {
  if (!iso) return '–';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const unit = lang === 'hi' ? { d: 'दिन', h: 'घं', m: 'मि' } : { d: 'd', h: 'h', m: 'm' };
  if (d > 0) return `${d} ${unit.d}${h ? ` ${h} ${unit.h}` : ''}`;
  if (h > 0) return `${h} ${unit.h}`;
  return `${mins} ${unit.m}`;
}
