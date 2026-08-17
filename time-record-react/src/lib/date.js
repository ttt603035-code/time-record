/* ============================================================
   2. DATE UTILS  (ported verbatim from legacy app.js)
   ============================================================ */

export const pad2 = (n) => String(n).padStart(2, '0');

export function isoDate(y, m, d) {
  return y + '-' + pad2(m + 1) + '-' + pad2(d);
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return { y, m: m - 1, d };
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

export function todayISO() {
  const n = new Date();
  return isoDate(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDaysISO(iso, n) {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m, d + n);
  return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function formatLong(iso) {
  const { y, m, d } = parseISO(iso);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(y, m, d));
}

export function formatShort(iso) {
  const { y, m, d } = parseISO(iso);
  return MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function currentMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + mins;
  if (total > 23 * 60 + 55) total = 23 * 60 + 55;
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}

export function validTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function validDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const { y, m, dd } = parseISO(d);
  const dt = new Date(y, m, dd);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === dd;
}
